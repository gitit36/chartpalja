# -*- coding: utf-8 -*-
"""
용신·타임라인 캘리브레이션 하니스 (v4 — 검증 프레임워크 고도화)
─────────────────────────────────────────────────────────────────
"점수가 실제 인생의 고저와 맞는가?"를 사람 단위로 검증한다.

전제 (중요):
  · JSON의 birth 값은 "만세력에 그대로 넣는 KST 기준 시각"이다. (해외 출생자도 이미 KST 변환됨)
  · timezone 변환 / geocoding / longitude 보정을 절대 하지 않는다 (use_solar_time=False).
  · original_birth는 출력용 참고 정보일 뿐, 계산에는 절대 쓰지 않는다.
  · 용신 산식/점수는 건드리지 않는다. 통과시키려고 life_events/weight를 자동 수정하지 않는다.

검증 등급 (JSON, 선택):
  · validation_tier: "core" | "strict_candidate" | "candidate"
      - core            : 생시 정확 + good/bad 이벤트 명확 → 정밀 검증 적합
      - strict_candidate: 생시 정확하나 이벤트 라벨이 다소 애매한 후보
      - candidate       : 참고용
      - (없으면 기존 로직과 호환: tier=None)

life_events (JSON):
  "good"/"bad": [ {"year":2016, "label":"...", "weight":1.0, "confidence":"high|medium|low",
                   "exclude_from_validation":false} ]
      - weight 없으면 1.0 (분리도 계산은 weight만 사용)
      - confidence 없으면 "medium"
      - exclude_from_validation(=context_only) true면 리포트엔 표시하되 평균계산에서 제외 (기본 false)
      - 같은 해가 good·bad에 동시에 있으면 collision으로 감지·표시 (자동 제외는 안 함)

CLI:
  (기본)                       전체 평가
  --strict                     A급 & include_in_strict_validation=true 만 표시
  --core-strict                위 + validation_tier=="core" + good/bad 각 2개 이상만 표시
  --include-candidates         C/D/unknown 후보까지 표시
  --show-skipped               필터로 제외된 인물도 표시
  --explain NAME               특정 인물 1명의 이벤트별 상세+breakdown 진단 출력 (단독)
  --sensitivity-yongshin NAME  용신 오행(木火土金水) 가정별 분리도 비교 (단독)
  --export-events PATH         평가 대상 전원의 이벤트 단위 결과를 CSV로 저장 (단독)
  --top-failures N             분리도 낮은 순으로 실패자 N명 출력 (기본 10)
"""
from __future__ import annotations

import csv
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import saju_engine as se  # noqa: E402

SUBJ_PATH = os.path.join(os.path.dirname(__file__), "yongshin_subjects.json")

# strict 검증에 허용되는 A급 출처
A_GRADES = ("A_official", "A_birth_record", "A_rodden_AA")
VALIDATION_TIERS = ("core", "strict_candidate", "candidate")

MIN_EVENTS = 2          # good/bad 각각 최소 개수
HARD_FAIL_SEP = -2.0    # 이 값 이하면 hard_fail, 초과~0이하면 near_miss
# low_confidence_events: low 비중 ≥ 30% 이거나 low 이벤트 ≥ 2개
LOW_CONF_RATIO = 0.30
LOW_CONF_MIN_COUNT = 2
# label_weak: strict_candidate / low_confidence_events / weight≤0.7 이벤트 비중 ≥ 50%
LOW_WEIGHT_THRESH = 0.7
LOW_WEIGHT_RATIO = 0.5

# 시지(地支時) → 중앙 시각
_BRANCH_REP_HOUR = {
    "子": (0, 30), "丑": (2, 30), "寅": (4, 30), "卯": (6, 30),
    "辰": (8, 30), "巳": (10, 30), "午": (12, 30), "未": (14, 30),
    "申": (16, 30), "酉": (18, 30), "戌": (20, 30), "亥": (22, 30),
}
_TIME_LABEL = {"known": "시각(분)", "branch": "시지중앙", "unknown": "시각미상→정오"}
_CONF_VALUES = {"high", "medium", "low"}

_TEMPLATE = [
    {
        "name": "본인(예시 — 실제 값으로 교체)",
        "gender": "male",
        "birth": {"y": 1997, "m": 3, "d": 6, "h": 3, "min": 0,
                  "branch": None, "calendar": "solar"},
        "original_birth": {"place": "Seoul, KR", "note": ""},
        "source_quality": "A_birth_record",
        "include_in_strict_validation": True,
        "validation_tier": "core",
        "life_events": {
            "good": [{"year": 2016, "label": "", "weight": 1.0, "confidence": "high"},
                     {"year": 2019, "label": "", "weight": 1.0, "confidence": "high"}],
            "bad": [{"year": 2018, "label": "", "weight": 1.0, "confidence": "high"},
                    {"year": 2009, "label": "", "weight": 1.0, "confidence": "medium"}],
        },
        "yongshin_override": None,
    }
]


# ─────────────────────────────────────────────────────────────
# 스키마 읽기
# ─────────────────────────────────────────────────────────────

def event_years(events):
    """life_events 배열에서 연도만 추출 (dict{year} / 정수 모두 허용). 하위호환용."""
    return [e["year"] if isinstance(e, dict) else e
            for e in (events or [])
            if (isinstance(e, dict) and e.get("year") is not None) or isinstance(e, int)]


def _events(events):
    """[{year:int, weight:float, label:str, confidence:str, exclude:bool}] 정규화.

    exclude_from_validation(또는 alias context_only)=true 이면 리포트에는 표시하되
    good/bad 평균 계산에서는 제외한다. 기본 False.
    """
    out = []
    for e in events or []:
        if isinstance(e, dict) and e.get("year") is not None:
            conf = str(e.get("confidence", "medium")).strip().lower()
            if conf not in _CONF_VALUES:
                conf = "medium"
            exclude = bool(e.get("exclude_from_validation", False) or e.get("context_only", False))
            out.append({"year": int(e["year"]),
                        "weight": float(e.get("weight", 1.0)),
                        "label": e.get("label", ""),
                        "confidence": conf,
                        "exclude": exclude})
        elif isinstance(e, int):
            out.append({"year": e, "weight": 1.0, "label": "", "confidence": "medium",
                        "exclude": False})
    return out


_MALE = {"male", "m", "남", "남자", "man", "1"}
_FEMALE = {"female", "f", "여", "여자", "woman", "0"}


def norm_gender(raw):
    """gender를 'male'/'female'로 normalize. (normalized, warning|None)."""
    if raw is None or str(raw).strip() == "":
        return "male", "gender 누락 → male 임시 적용(확인 필요)"
    s = str(raw).strip().lower()
    if s in _MALE:
        return "male", None
    if s in _FEMALE:
        return "female", None
    return "male", f"gender 값 인식 불가('{raw}') → male 임시 적용(확인 필요)"


def norm_tier(raw):
    """validation_tier normalize. 없거나 미허용이면 None(기존 로직 호환)."""
    if isinstance(raw, str) and raw.strip().lower() in VALIDATION_TIERS:
        return raw.strip().lower()
    return None


def normalize(subj):
    """v2(정제) 스키마를 내부표준으로. 구(v1: y/m/d/h, good_years/bad_years)도 가볍게 수용."""
    if "birth" in subj or "life_events" in subj:
        birth = dict(subj.get("birth") or {})
        original_birth = subj.get("original_birth")
        le = subj.get("life_events") or {}
        good, bad = list(le.get("good") or []), list(le.get("bad") or [])
        sq = subj.get("source_quality", "unknown")
        strict_flag = bool(subj.get("include_in_strict_validation", True))
    else:  # v1 가벼운 수용
        birth = {"y": subj.get("y"), "m": subj.get("m"), "d": subj.get("d"),
                 "h": subj.get("h"), "min": subj.get("mi", subj.get("min")),
                 "branch": subj.get("branch"),
                 "calendar": "lunar" if subj.get("lunar") else "solar",
                 "gender": subj.get("gender", "male")}
        original_birth = None
        good = [{"year": y} for y in subj.get("good_years", [])]
        bad = [{"year": y} for y in subj.get("bad_years", [])]
        sq = subj.get("source_quality", "unknown")
        strict_flag = bool(subj.get("include_in_strict_validation", False))

    birth.setdefault("calendar", "solar")
    birth.setdefault("branch", None)

    # gender: person 최상위 → birth → original_birth 순으로 실제 JSON 값을 읽어 normalize
    raw_gender = (subj.get("gender")
                  if subj.get("gender") is not None else birth.get("gender"))
    if raw_gender is None and original_birth:
        raw_gender = original_birth.get("gender")
    gender, gender_warning = norm_gender(raw_gender)
    birth["gender"] = gender

    # h는 있는데 min만 없으면 0으로 간주(시 단위까지만 아는 경우)
    if birth.get("h") is not None and birth.get("min") is None:
        birth["min"] = 0

    h, mi, branch = birth.get("h"), birth.get("min"), birth.get("branch")
    if h is not None and mi is not None:
        time_quality = "known"
    elif branch in _BRANCH_REP_HOUR:
        time_quality = "branch"
    else:
        time_quality = "unknown"

    return {
        "name": subj.get("name", "?"),
        "birth": birth,
        "original_birth": original_birth,
        "gender": gender,
        "good": _events(good),
        "bad": _events(bad),
        "source_quality": sq,
        "include_in_strict_validation": strict_flag,
        "validation_tier": norm_tier(subj.get("validation_tier")),
        "time_quality": time_quality,
        "yongshin_override": subj.get("yongshin_override"),
        "warnings": [w for w in (gender_warning,) if w],
    }


def resolve_hour(n):
    """(hour, minute, is_noon_fallback). h/min 우선, 없으면 시지중앙, 그것도 없으면 정오."""
    b, tq = n["birth"], n["time_quality"]
    if tq == "known":
        return int(b["h"]), int(b["min"]), False
    if tq == "branch":
        hh, mm = _BRANCH_REP_HOUR[b["branch"]]
        return hh, mm, False
    return 12, 0, True


def kst_str(n):
    b = n["birth"]
    hh, mm, _ = resolve_hour(n)
    return f"{b['y']}-{b['m']:02d}-{b['d']:02d} {hh:02d}:{mm:02d} KST"


# ─────────────────────────────────────────────────────────────
# 등급/필터링
# ─────────────────────────────────────────────────────────────

def is_strict_eligible(n):
    return n["include_in_strict_validation"] and (n["source_quality"] in A_GRADES)


def is_core_eligible(n):
    return (is_strict_eligible(n)
            and n["validation_tier"] == "core"
            and len(n["good"]) >= MIN_EVENTS
            and len(n["bad"]) >= MIN_EVENTS)


def eligibility(n, strict=False, core_strict=False, include_candidates=False):
    """표시(평가 출력) 대상 여부 → (eligible, skip_reason)."""
    if include_candidates:
        return True, None
    if core_strict:
        if is_core_eligible(n):
            return True, None
        rs = []
        if not n["include_in_strict_validation"]:
            rs.append("include_in_strict_validation=false")
        if n["source_quality"] not in A_GRADES:
            rs.append(f"source_quality={n['source_quality']}(A급 아님)")
        if n["validation_tier"] != "core":
            rs.append(f"validation_tier={n['validation_tier']}(core 아님)")
        if len(n["good"]) < MIN_EVENTS or len(n["bad"]) < MIN_EVENTS:
            rs.append("good/bad 이벤트<2")
        return False, ", ".join(rs)
    if strict:
        if is_strict_eligible(n):
            return True, None
        rs = []
        if not n["include_in_strict_validation"]:
            rs.append("include_in_strict_validation=false")
        if n["source_quality"] not in A_GRADES:
            rs.append(f"source_quality={n['source_quality']}(A급 아님)")
        return False, ", ".join(rs)
    return True, None


# ─────────────────────────────────────────────────────────────
# 분류 (severity / tags)
# ─────────────────────────────────────────────────────────────

def severity_of(sep):
    """실패 severity. 통과(sep>0)/평가불가(nan)면 None. 하나만 부여."""
    if sep != sep:          # nan
        return None
    if sep > 0:
        return None
    return "hard_fail" if sep <= HARD_FAIL_SEP else "near_miss"


def confidence_ratio(n):
    """good+bad 이벤트 중 low confidence 비율."""
    evs = n["good"] + n["bad"]
    if not evs:
        return 0.0
    return sum(1 for e in evs if e["confidence"] == "low") / len(evs)


def event_tags(n):
    """severity와 별개로 동시 부여 가능한 보조 태그들 (계산엔 미반영, 진단용)."""
    evs = n["good"] + n["bad"]
    total = len(evs)
    low_cnt = sum(1 for e in evs if e["confidence"] == "low")
    low_ratio = (low_cnt / total) if total else 0.0
    low_weight_ratio = (sum(1 for e in evs if e["weight"] <= LOW_WEIGHT_THRESH) / total) if total else 0.0

    low_confidence_events = (low_ratio >= LOW_CONF_RATIO) or (low_cnt >= LOW_CONF_MIN_COUNT)
    label_weak = (n["validation_tier"] == "strict_candidate"
                  or low_confidence_events
                  or low_weight_ratio >= LOW_WEIGHT_RATIO)

    tags = []
    if n["validation_tier"] == "strict_candidate":
        tags.append("strict_candidate")
    if label_weak:
        tags.append("label_weak")
    if low_confidence_events:
        tags.append("low_confidence_events")
    return tags


# ─────────────────────────────────────────────────────────────
# 평가 (geocoding 없음: use_solar_time=False, KST 그대로)
# ─────────────────────────────────────────────────────────────

def _year_scores(n, override="__natal__"):
    """(r, scores, meta_by_year). override=None/dict면 해당 용신으로 강제(민감도용)."""
    hh, mm, _ = resolve_hour(n)
    b = n["birth"]
    inp = se.BirthInput(
        year=b["y"], month=b["m"], day=b["d"], hour=hh, minute=mm,
        gender=n["gender"],
        calendar="lunar" if str(b.get("calendar", "solar")).lower() in ("lunar", "음력") else "solar",
        is_leap_month=b.get("leap", False),
        use_solar_time=False,   # ★ 진태양시/경도 보정 안 함 → JSON birth(KST) 그대로
    )
    yo = n.get("yongshin_override") if override == "__natal__" else override
    r = se.compute_all(inp, yongshin_override=yo)
    scores, meta = {}, {}
    for e in r["chart_data"]["연도별_타임라인"]:
        c = e.get("candle") or {}
        if "close" in c:
            scores[e["year"]] = c["close"]
            meta[e["year"]] = e
    return r, scores, meta


def _wavg(events, scores):
    """weighted average + 사용된 이벤트 수. exclude=true 이벤트는 제외."""
    num = den = 0.0
    used = 0
    for e in events:
        if e.get("exclude"):
            continue
        y = e["year"]
        if y in scores:
            w = e["weight"]
            num += scores[y] * w
            den += w
            used += 1
    return (num / den if den else float("nan")), used


def _detail(events, scores):
    """이벤트별 진단 상세: year/label/weight/confidence/exclude/year_score/weighted_score."""
    out = []
    for e in events:
        ys = scores.get(e["year"])
        out.append({
            "year": e["year"], "label": e.get("label", ""),
            "weight": e["weight"], "confidence": e["confidence"],
            "exclude": e.get("exclude", False),
            "year_score": ys,
            "weighted_score": (ys * e["weight"]) if (ys is not None and not e.get("exclude")) else None,
        })
    return out


def detect_collisions(n, scores):
    """good/bad에 동시에 존재하는 year 감지. → [{year, good, bad, score}]."""
    good_years = {e["year"] for e in n["good"]}
    bad_years = {e["year"] for e in n["bad"]}
    out = []
    for y in sorted(good_years & bad_years):
        out.append({
            "year": y,
            "good": [e["label"] or "?" for e in n["good"] if e["year"] == y],
            "bad": [e["label"] or "?" for e in n["bad"] if e["year"] == y],
            "score": scores.get(y),
        })
    return out


def evaluate(n, keep_meta=False):
    r, scores, meta = _year_scores(n)
    g_avg, g_used = _wavg(n["good"], scores)   # 같은 해 중복 제거 안 함, weight 기반
    b_avg, b_used = _wavg(n["bad"], scores)
    yong = r["용신"]
    info = {
        "용신": f'{yong.get("용신","?")} (오행 {yong.get("용신_오행","?")})',
        "용신_오행": yong.get("용신_오행", "?"),
        "용신체계": yong.get("용신체계", "룰베이스"),
        "신강신약": r["신강신약"]["판정"],
        "격국": r["격국"]["격국"],
        "원국": r.get("원국", {}),
        "good_avg": g_avg, "bad_avg": b_avg,
        "good_used": g_used, "bad_used": b_used,
        "good_detail": _detail(n["good"], scores),
        "bad_detail": _detail(n["bad"], scores),
        "allmin": min(scores.values()) if scores else None,
        "allmax": max(scores.values()) if scores else None,
        "tags": event_tags(n),
        "collisions": detect_collisions(n, scores),
    }
    if keep_meta:
        ev_years = {e["year"] for e in n["good"] + n["bad"]}
        info["year_meta"] = {y: meta.get(y) for y in ev_years}
    if g_used < MIN_EVENTS or b_used < MIN_EVENTS:
        info["status"] = "na"   # 평가 불가
        info["sep"] = float("nan")
        info["severity"] = None
    else:
        info["sep"] = g_avg - b_avg
        info["status"] = "pass" if info["sep"] > 0 else "fail"
        info["severity"] = severity_of(info["sep"])
    return info


# ─────────────────────────────────────────────────────────────
# 요약 helper
# ─────────────────────────────────────────────────────────────

def tally(recs):
    """(pass, fail, na, passrate%)."""
    p = sum(1 for _, e in recs if e["status"] == "pass")
    f = sum(1 for _, e in recs if e["status"] == "fail")
    na = sum(1 for _, e in recs if e["status"] == "na")
    rate = (100.0 * p / (p + f)) if (p + f) else float("nan")
    return p, f, na, rate


def _rate_str(rate):
    return f"{rate:.0f}%" if rate == rate else "—"


def _fnum(x, nd=1):
    return f"{x:.{nd}f}" if isinstance(x, (int, float)) and x == x else "-"


# ─────────────────────────────────────────────────────────────
# 진단: breakdown / 용신 민감도 / 의심원인
# ─────────────────────────────────────────────────────────────

_ELEMENTS = ["木", "火", "土", "金", "水"]
YONG_SENS_IMPROVE = 1.0   # 다른 오행이 분리도를 이만큼 이상 개선하면 yongshin_mismatch 의심


def _year_breakdown(meta):
    """연도별 점수 구성요소 breakdown(엔진 타임라인 엔트리 기반)."""
    if not meta:
        return None
    bd = meta.get("breakdown", {})
    return {
        "year_ganzhi": meta.get("세운_pillar"),
        "daewoon": meta.get("대운_pillar"),
        "annual_stem": meta.get("세운_stem"),
        "annual_branch": meta.get("세운_branch"),
        "stem_element": meta.get("세운_stemElement"),
        "branch_element": meta.get("세운_branchElement"),
        "ten_god_stem": meta.get("세운_십성_천간"),
        "ten_god_branch": meta.get("세운_십성_지지"),
        "yongshin_fit": bd.get("yongshin_fit"),
        "yong_match": meta.get("세운_용신부합"),
        "hee_match": meta.get("세운_희신부합"),
        "gishin_match": meta.get("세운_기신부합"),
        "structural_adj": bd.get("structural_adj"),    # 기신파괴/용신활성 등
        "balance": bd.get("balance"),                  # 오행균형 기여
        "unseong": bd.get("unseong"),
        "unseong_context": bd.get("unseong_context"),
        "relations": bd.get("relations"),              # 합/충/형 등 관계 기여
        "ilju_relations": meta.get("세운_일주관계"),
        "final_year_score": (meta.get("candle") or {}).get("close"),
    }


def yongshin_sensitivity(n):
    """용신 오행을 木/火/土/金/水로 각각 가정했을 때 good_avg/bad_avg/separation 비교."""
    rows = []
    for elem in _ELEMENTS:
        override = {"용신_오행": elem, "희신_오행": [], "기신_오행": [], "구신_오행": []}
        _, scores, _ = _year_scores(n, override=override)
        g, gu = _wavg(n["good"], scores)
        b, bu = _wavg(n["bad"], scores)
        sep = (g - b) if (gu >= MIN_EVENTS and bu >= MIN_EVENTS) else float("nan")
        rows.append({"elem": elem, "good_avg": g, "bad_avg": b, "sep": sep})
    return rows


def suspected_issues(n, ev, sens=None):
    """실패 원인 추정 태그 목록."""
    issues = []
    if ev.get("collisions"):
        issues.append("same_year_collision")

    evs = n["good"] + n["bad"]
    weak = sum(1 for e in evs
               if e["confidence"] == "low" or e["weight"] <= LOW_WEIGHT_THRESH or e.get("exclude"))
    if evs and weak / len(evs) >= 0.5:
        issues.append("data_label_issue")

    if sens is None:
        sens = yongshin_sensitivity(n)
    cur = ev["sep"]
    valid = [s for s in sens if s["sep"] == s["sep"]]
    best = max(valid, key=lambda s: s["sep"]) if valid else None
    if (best and cur == cur and best["elem"] != ev.get("용신_오행")
            and best["sep"] - cur >= YONG_SENS_IMPROVE and best["sep"] > 0):
        issues.append("yongshin_mismatch")
    else:
        issues.append("scoring_formula_issue")
    return issues


# ─────────────────────────────────────────────────────────────
# 진단: --explain / --export-events / --sensitivity-yongshin
# ─────────────────────────────────────────────────────────────

EXPORT_COLUMNS = [
    "name", "gender", "source_quality", "validation_tier", "strict_target",
    "polarity", "event_year", "event_label", "weight", "confidence",
    "year_score", "weighted_score",
    "person_good_avg", "person_bad_avg", "separation", "pass_fail", "severity", "tags",
]


def _find_subject(raw, name):
    """이름으로 subject 1명 찾기: 정확 → 대소문자무시 → 부분일치."""
    norms = [normalize(s) for s in raw]
    for n in norms:
        if n["name"] == name:
            return n
    low = name.strip().lower()
    for n in norms:
        if n["name"].strip().lower() == low:
            return n
    for n in norms:
        if low in n["name"].strip().lower():
            return n
    return None


def explain(raw, name):
    """특정 인물 1명 상세 진단 출력 (연도별 점수 구성요소 breakdown 포함)."""
    n = _find_subject(raw, name)
    if n is None:
        print(f"[--explain] '{name}' 인물을 찾을 수 없습니다.")
        return 1
    ev = evaluate(n, keep_meta=True)
    meta = ev.get("year_meta", {})
    print(f"══════════ 상세 진단: {n['name']} ══════════")
    print(f"  gender                          : {n['gender']}")
    print(f"  source_quality                  : {n['source_quality']}")
    print(f"  validation_tier                 : {n['validation_tier']}")
    print(f"  include_in_strict_validation    : {n['include_in_strict_validation']}")
    print(f"  birth(KST)                      : {kst_str(n)} [{_TIME_LABEL[n['time_quality']]}]")
    og = ev["원국"]
    print(f"  사주 원국                       : 年 {og.get('year','?')}  月 {og.get('month','?')}  "
          f"日 {og.get('day','?')}  時 {og.get('hour','?')}")
    print(f"  신강신약 / 격국                 : {ev['신강신약']} / {ev['격국']}")
    print(f"  용신                            : {ev['용신']} [{ev['용신체계']}]")
    print(f"  점수 범위(평생)                 : {ev['allmin']}~{ev['allmax']}")

    if ev["collisions"]:
        print("\n  ⚠️  same-year good/bad collision 감지")
        for c in ev["collisions"]:
            print(f"      {c['year']} good/bad collision detected")
            print(f"        good: {', '.join(c['good'])}")
            print(f"        bad : {', '.join(c['bad'])}")
            print(f"        same year score = {_fnum(c['score'])}")
        print("        warning: year-level scoring cannot distinguish same-year mixed events")

    def _rows(detail, polarity):
        print(f"\n  [{polarity}] year   label                         w     conf     excl  year_score  weighted")
        for d in detail:
            print(f"      {d['year']:<6} {str(d['label'])[:26]:<28} "
                  f"{d['weight']:<5.2f} {d['confidence']:<7} "
                  f"{('Y' if d['exclude'] else '-'):<5} "
                  f"{_fnum(d['year_score']):>10}  {_fnum(d['weighted_score']):>8}")
            bd = _year_breakdown(meta.get(d["year"]))
            if bd:
                print(f"            └ 干支 {bd['year_ganzhi']}  대운 {bd['daewoon']}  "
                      f"세운 {bd['annual_stem']}({bd['stem_element']})/{bd['annual_branch']}({bd['branch_element']})")
                print(f"              십성 {bd['ten_god_stem']}/{bd['ten_god_branch']}  "
                      f"용신부합 {bd['yong_match']}·희신 {bd['hee_match']}·기신 {bd['gishin_match']}")
                print(f"              ┊ yongshin_fit {_fnum(bd['yongshin_fit'],2)}  "
                      f"structural(기신/용신) {_fnum(bd['structural_adj'],2)}  "
                      f"balance {_fnum(bd['balance'],2)}  unseong {_fnum(bd['unseong'],2)}")
                rels = bd['relations']
                ilju = bd['ilju_relations'] or []
                print(f"              ┊ 관계(합·충·형충파해) {_fnum(rels,2)}"
                      + (f"  일주관계: {', '.join(ilju)}" if ilju else ""))
                print(f"              ⇒ final year_score = {bd['final_year_score']}")
    _rows(ev["good_detail"], "good")
    _rows(ev["bad_detail"], "bad")

    print(f"\n  good weighted avg               : {_fnum(ev['good_avg'])}  (n={ev['good_used']})")
    print(f"  bad  weighted avg               : {_fnum(ev['bad_avg'])}  (n={ev['bad_used']})")
    print(f"  separation                      : {_fnum(ev['sep'], 2)}")
    status = {"pass": "통과", "fail": "실패", "na": "평가불가"}[ev["status"]]
    print(f"  결과                            : {status}")
    print(f"  severity                        : {ev['severity'] or '-'}")
    print(f"  tags                            : {', '.join(ev['tags']) if ev['tags'] else '-'}")
    return 0


def sensitivity_yongshin(raw, name):
    """특정 인물의 용신 오행 가정별 분리도 민감도 출력."""
    n = _find_subject(raw, name)
    if n is None:
        print(f"[--sensitivity-yongshin] '{name}' 인물을 찾을 수 없습니다.")
        return 1
    ev = evaluate(n)
    cur_elem = ev.get("용신_오행")
    print(f"══════════ 용신 민감도: {n['name']} ══════════")
    print(f"  현재 용신(엔진): {ev['용신']}  → separation {_fnum(ev['sep'], 2)}")
    print(f"  (가정: 용신 오행만 교체, 희신/기신/구신 비움 · 점수 산식 미수정)")
    rows = yongshin_sensitivity(n)
    for s in rows:
        mark = "  ← 현재" if s["elem"] == cur_elem else ""
        print(f"   if {s['elem']}:  good_avg {_fnum(s['good_avg'])}  "
              f"bad_avg {_fnum(s['bad_avg'])}  separation {_fnum(s['sep'], 2)}{mark}")
    valid = [s for s in rows if s["sep"] == s["sep"]]
    if valid:
        best = max(valid, key=lambda s: s["sep"])
        print(f"\n  최고 분리도 가정: {best['elem']} (separation {_fnum(best['sep'], 2)})")
        if best["elem"] != cur_elem and best["sep"] - (ev["sep"] if ev["sep"] == ev["sep"] else -99) >= YONG_SENS_IMPROVE:
            print("  → 현재 용신과 다른 오행이 더 잘 분리 ⇒ yongshin 판단 이슈 가능성")
        else:
            print("  → 용신 오행 교체로도 개선 미미 ⇒ 점수 산식/데이터 라벨 쪽 가능성")
    return 0


def export_events(all_records, path):
    """평가 대상 인물들의 이벤트 단위 결과를 CSV로 저장."""
    rows = 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=EXPORT_COLUMNS)
        w.writeheader()
        for n, ev in all_records:
            base = {
                "name": n["name"], "gender": n["gender"],
                "source_quality": n["source_quality"],
                "validation_tier": n["validation_tier"] or "",
                "strict_target": is_strict_eligible(n),
                "person_good_avg": _fnum(ev["good_avg"]),
                "person_bad_avg": _fnum(ev["bad_avg"]),
                "separation": _fnum(ev["sep"], 2),
                "pass_fail": ev["status"],
                "severity": ev["severity"] or "",
                "tags": "|".join(ev["tags"]),
            }
            for polarity, detail in (("good", ev["good_detail"]), ("bad", ev["bad_detail"])):
                for d in detail:
                    row = dict(base)
                    row.update({
                        "polarity": polarity,
                        "event_year": d["year"], "event_label": d["label"],
                        "weight": d["weight"], "confidence": d["confidence"],
                        "year_score": "" if d["year_score"] is None else d["year_score"],
                        "weighted_score": "" if d["weighted_score"] is None else round(d["weighted_score"], 2),
                    })
                    w.writerow(row)
                    rows += 1
    print(f"[--export-events] {rows}개 이벤트 행을 저장했습니다 → {path}")
    return 0


# ─────────────────────────────────────────────────────────────

def _opt_value(argv, name, default=None):
    """`--name VALUE` 형태의 값 추출. 값이 없으면 default."""
    if name in argv:
        i = argv.index(name)
        if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            return argv[i + 1]
    return default


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    core_strict = "--core-strict" in argv
    strict = "--strict" in argv or core_strict
    include_candidates = "--include-candidates" in argv
    show_skipped = "--show-skipped" in argv
    explain_name = _opt_value(argv, "--explain")
    sensitivity_name = _opt_value(argv, "--sensitivity-yongshin")
    export_path = _opt_value(argv, "--export-events")
    top_failures = None
    if "--top-failures" in argv:
        raw_n = _opt_value(argv, "--top-failures", "10")
        try:
            top_failures = int(raw_n)
        except (TypeError, ValueError):
            top_failures = 10

    if not os.path.exists(SUBJ_PATH):
        with open(SUBJ_PATH, "w") as f:
            json.dump(_TEMPLATE, f, ensure_ascii=False, indent=2)
        print(f"템플릿 생성됨: {SUBJ_PATH}")
        return 0

    with open(SUBJ_PATH) as f:
        raw = json.load(f)

    # ── 단독 진단 모드 ──
    if explain_name:
        return explain(raw, explain_name)
    if sensitivity_name:
        return sensitivity_yongshin(raw, sensitivity_name)

    if core_strict:
        mode = "core-strict (A급·검증대상·tier=core·이벤트≥2)"
    elif strict:
        mode = "strict (A급·검증대상)"
    elif include_candidates:
        mode = "candidates (후보 포함)"
    else:
        mode = "전체"
    print("══════════ 용신·타임라인 캘리브레이션 (v4) ══════════")
    print(f"모드: {mode}   표본 {len(raw)}명   (KST 그대로 사용 · geocoding 없음)")

    # 요약은 모드와 무관하게 일관 산출하기 위해 전원 평가
    all_records = []
    skipped = []
    for subj in raw:
        n = normalize(subj)
        all_records.append((n, evaluate(n)))

    # ── CSV 내보내기 (단독 동작) ──
    if export_path:
        return export_events(all_records, export_path)

    for n, ev in all_records:
        eligible, reason = eligibility(n, strict, core_strict, include_candidates)
        if not eligible:
            skipped.append((n, reason))
            continue
        se_flag = "Y" if is_strict_eligible(n) else "N"
        tier = n["validation_tier"] or "-"
        print(f"\n● {n['name']}  ({kst_str(n)} [{_TIME_LABEL[n['time_quality']]}], {n['gender']})")
        print(f"   출처={n['source_quality']}  strict대상={se_flag}  tier={tier}")
        for w in n["warnings"]:
            print(f"   ⚠️  {w}")
        if n["original_birth"]:
            ob = n["original_birth"]
            ref = " · ".join(x for x in (ob.get("place") or ob.get("location") or "",
                                         ob.get("note") or "") if x)
            if ref:
                print(f"   🌐 (참고) 원출생: {ref}  ※계산엔 미사용")
        print(f"   신강신약={ev['신강신약']}  격국={ev['격국']}  용신={ev['용신']} [{ev['용신체계']}]")
        print(f"   점수 범위(평생) {ev['allmin']}~{ev['allmax']}")
        if ev["status"] == "na":
            print(f"   ⚠️  good/bad 이벤트 부족 (good {ev['good_used']}/bad {ev['bad_used']}, "
                  f"각 {MIN_EVENTS}개 이상 필요) → 평가 불가"
                  + (f"  [tags: {', '.join(ev['tags'])}]" if ev["tags"] else ""))
            continue
        mark = "✅ 통과" if ev["status"] == "pass" else f"❌ 실패({ev['severity']})"
        extra = f"  [tags: {', '.join(ev['tags'])}]" if ev["tags"] else ""
        print(f"   good 평균 {ev['good_avg']:.1f} (n={ev['good_used']})  vs  "
              f"bad 평균 {ev['bad_avg']:.1f} (n={ev['bad_used']})  "
              f"→ 분리도 {ev['sep']:+.1f}  {mark}{extra}")
        for c in ev["collisions"]:
            print(f"   ⚠️  {c['year']} same-year good/bad collision "
                  f"(good: {', '.join(c['good'])} / bad: {', '.join(c['bad'])}, "
                  f"score={_fnum(c['score'])})")

    # ── 요약 ────────────────────────────────────
    strict_recs = [(n, e) for n, e in all_records if is_strict_eligible(n)]
    core_recs = [(n, e) for n, e in all_records if is_core_eligible(n)]

    def _line(label, recs):
        p, f, na, rate = tally(recs)
        print(f"  {label:<14} 통과 {p}/{p + f} ({_rate_str(rate)})  "
              f"· 평가불가 {na}  · 대상 {len(recs)}명")

    print("\n══════════ 요약 ══════════")
    _line("전체", all_records)
    _line("strict", strict_recs)
    _line("core_strict", core_recs)

    def _names(recs, pred):
        return [f"{n['name']}({e['sep']:+.1f})" for n, e in recs if pred(n, e)]

    near = _names(all_records, lambda n, e: e["severity"] == "near_miss")
    hard = _names(all_records, lambda n, e: e["severity"] == "hard_fail")
    cand = [n["name"] for n, e in all_records if "strict_candidate" in e["tags"]]
    weak = [n["name"] for n, e in all_records if "label_weak" in e["tags"]]
    lowc = [n["name"] for n, e in all_records if "low_confidence_events" in e["tags"]]
    na_list = [n["name"] for n, e in all_records if e["status"] == "na"]

    print("\n── 실패 분류 ──")
    print(f"  near_miss({len(near)}):  {', '.join(near) if near else '-'}")
    print(f"  hard_fail({len(hard)}):  {', '.join(hard) if hard else '-'}")
    print("\n── 보조 태그 ──")
    print(f"  strict_candidate({len(cand)}):  {', '.join(cand) if cand else '-'}")
    print(f"  label_weak({len(weak)}):  {', '.join(weak) if weak else '-'}")
    print(f"  low_confidence_events({len(lowc)}):  {', '.join(lowc) if lowc else '-'}")
    print(f"\n  평가불가({len(na_list)}):  {', '.join(na_list) if na_list else '-'}")

    # ── Top 실패 (분리도 낮은 순) ──
    if top_failures is not None:
        fails = sorted([(n, e) for n, e in all_records if e["status"] == "fail"],
                       key=lambda r: r[1]["sep"])
        print(f"\n── Top {top_failures} 실패 (분리도 낮은 순) ──")
        if not fails:
            print("  (실패자 없음)")
        for n, e in fails[:top_failures]:
            tg = f"  [tags: {', '.join(e['tags'])}]" if e["tags"] else ""
            print(f"  {e['sep']:+6.1f}  {n['name']:<16} [{e['severity']}]"
                  f"  tier={n['validation_tier'] or '-'}{tg}")

    # ── core 실패자 정밀 진단 ──
    core_fails = [(n, e) for n, e in all_records
                  if is_core_eligible(n) and e["status"] == "fail"]
    if core_fails:
        print("\n══════════ core 실패자 정밀 진단 ══════════")
        print("  (suspected issue 판정 위해 용신 민감도 분석 수행)")
        for n, e in sorted(core_fails, key=lambda r: r[1]["sep"]):
            good_sorted = sorted(
                [d for d in e["good_detail"] if d["year_score"] is not None and not d["exclude"]],
                key=lambda d: d["year_score"])
            bad_sorted = sorted(
                [d for d in e["bad_detail"] if d["year_score"] is not None and not d["exclude"]],
                key=lambda d: d["year_score"], reverse=True)
            issues = suspected_issues(n, e)
            print(f"\n  ● {n['name']}  separation {_fnum(e['sep'], 2)}  severity={e['severity']}")
            print(f"     same-year collision : "
                  f"{'예 (' + ', '.join(str(c['year']) for c in e['collisions']) + ')' if e['collisions'] else '아니오'}")
            print("     낮은 good years(top3): "
                  + (", ".join(f"{d['year']}={_fnum(d['year_score'])}" for d in good_sorted[:3]) or "-"))
            print("     높은 bad  years(top3): "
                  + (", ".join(f"{d['year']}={_fnum(d['year_score'])}" for d in bad_sorted[:3]) or "-"))
            print(f"     suspected issue     : {', '.join(issues)}")

    if skipped:
        print(f"\n[스킵됨] {len(skipped)}명 (필터 제외)")
        if show_skipped:
            for n, reason in skipped:
                print(f"  · {n['name']:<16} 출처={n['source_quality']:<18} 사유: {reason}")
        else:
            print("  (--show-skipped 로 상세 표시)")

    print("\n※ 분리도>0 통과, ≤0 실패. near_miss: -2.0<sep≤0, hard_fail: sep≤-2.0.")
    print("※ tags는 severity와 별개의 보조 신호(라벨/이벤트 신뢰도). good/bad 각 2개 미만은 평가 불가.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
