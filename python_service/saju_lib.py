"""
Shared Saju computation using saju_engine.py (v3).
Loads saju_engine.py and exposes compute_report() for one-off runs.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
ENGINE_PATH = ROOT / "saju_engine.py"

_engine_module = None


def _load_engine():
    global _engine_module
    if _engine_module is not None:
        return _engine_module
    if not ENGINE_PATH.exists():
        raise FileNotFoundError(f"Engine not found: {ENGINE_PATH}")
    spec = importlib.util.spec_from_file_location("saju_engine", ENGINE_PATH)
    _engine_module = importlib.util.module_from_spec(spec)
    sys.modules["saju_engine"] = _engine_module
    spec.loader.exec_module(_engine_module)
    return _engine_module


def _parse_date(birth_date: str) -> tuple:
    parts = birth_date.split("-")
    if len(parts) != 3:
        raise ValueError("birth_date must be YYYY-MM-DD")
    return int(parts[0]), int(parts[1]), int(parts[2])


def _parse_time(birth_time: str) -> tuple:
    parts = birth_time.split(":")
    if len(parts) < 2:
        return 12, 0
    return int(parts[0]) if parts[0] else 12, int(parts[1]) if parts[1] else 0


_PILLAR_KEY_MAP = {"year": "연주", "month": "월주", "day": "일주", "hour": "시주"}
_GANJI_STEM_KEYS = ["연간", "월간", "일간", "시간"]
_GANJI_BRANCH_KEYS = ["연지", "월지", "일지", "시지"]


def _normalize_for_frontend(report: Dict[str, Any], redact: bool) -> Dict[str, Any]:
    """saju_engine.py enrich_saju+compute_all 출력 -> 프론트엔드 형식으로 정규화"""
    out: Dict[str, Any] = {}

    # 1) 만세력_사주원국
    wonkuk = report.get("원국") or report.get("만세력_사주원국")
    if wonkuk and isinstance(wonkuk, dict):
        mapped = {}
        for eng_key, kor_key in _PILLAR_KEY_MAP.items():
            if eng_key in wonkuk:
                mapped[kor_key] = wonkuk[eng_key]
            elif kor_key in wonkuk:
                mapped[kor_key] = wonkuk[kor_key]
        out["만세력_사주원국"] = mapped if mapped else wonkuk

    # 2) 천간지지
    ganji_detail = report.get("천간지지_상세", [])
    if ganji_detail and isinstance(ganji_detail, list) and len(ganji_detail) >= 4:
        stems_dict = {}
        branches_dict = {}
        for i, item in enumerate(ganji_detail[:4]):
            stems_dict[_GANJI_STEM_KEYS[i]] = item.get("천간", "")
            branches_dict[_GANJI_BRANCH_KEYS[i]] = item.get("지지", "")
        out["천간지지"] = {"천간": stems_dict, "지지": branches_dict}
    elif "천간지지" in report:
        out["천간지지"] = report["천간지지"]

    # 3) 오행십성_상세
    ten_gods_raw = report.get("십성(천간)", {})
    hidden_tg_raw = report.get("지장간_십성", {})
    if ganji_detail and isinstance(ganji_detail, list) and len(ganji_detail) >= 4:
        cheongan_list = []
        jiji_list = []
        for i, item in enumerate(ganji_detail[:4]):
            stem = item.get("천간", "")
            tg_key = _GANJI_STEM_KEYS[i]
            tg_val = ten_gods_raw.get(tg_key, "")
            if i == 2:
                tg_val = "일원"
            cheongan_list.append({
                "stem": stem,
                "element": item.get("천간오행", ""),
                "ten_god": tg_val,
            })
            branch = item.get("지지", "")
            br_key = _GANJI_BRANCH_KEYS[i]
            hidden_raw = hidden_tg_raw.get(br_key, [])
            hidden_stems = []
            for h in hidden_raw:
                hidden_stems.append({
                    "stem": h.get("간", ""),
                    "ten_god": h.get("십성", ""),
                })
            jiji_list.append({
                "branch": branch,
                "hidden_stems": hidden_stems,
                "12운성": item.get("12운성", ""),
                "납음": item.get("납음", ""),
            })
        out["오행십성_상세"] = {
            "천간": cheongan_list,
            "지지(지장간포함)": jiji_list,
        }
    elif "오행십성_상세" in report:
        out["오행십성_상세"] = report["오행십성_상세"]

    # 4) 오행분포
    ohang_raw = report.get("오행분포(가중)") or report.get("오행분포")
    if isinstance(ohang_raw, dict):
        if "분포" in ohang_raw and isinstance(ohang_raw["분포"], dict):
            out["오행분포"] = ohang_raw["분포"]
        else:
            out["오행분포"] = ohang_raw

    # 5) 신강신약
    for key in ("신강신약(정밀)", "신강신약"):
        if key in report:
            val = report[key]
            if isinstance(val, dict):
                normalized = {}
                if "점수" in val or "score" in val:
                    normalized["score"] = val.get("점수", val.get("score", 0))
                if "판정" in val:
                    normalized["판정"] = val["판정"]
                out["신강신약"] = normalized if normalized else val
            else:
                out["신강신약"] = val
            break

    # 6) 용신희신
    yong = report.get("용신희신(정밀엔진)") or report.get("용신희신") or report.get("용신")
    if yong and isinstance(yong, dict):
        out["용신희신"] = {
            "용신": yong.get("용신", ""),
            "용신_오행": yong.get("용신_오행", ""),
            "희신": yong.get("희신", []),
            "기신": yong.get("기신", []),
        }

    # 7) 신살길성
    shinsal_raw = report.get("신살길성")
    if isinstance(shinsal_raw, dict):
        if "발현_신살" in shinsal_raw:
            shinsal_out = {}
            for hit in shinsal_raw["발현_신살"]:
                name = hit.get("name", "")
                if name:
                    ev = hit.get("evidence", {})
                    targets = ev.get("hits", []) or ev.get("targets", [])
                    if isinstance(targets, list) and targets:
                        shinsal_out[name] = targets
                    elif ev.get("target"):
                        shinsal_out[name] = [ev["target"]]
            out["신살길성"] = shinsal_out
        else:
            out["신살길성"] = shinsal_raw

    # 8) 공망
    if isinstance(shinsal_raw, dict) and "공망" in shinsal_raw:
        gm = shinsal_raw["공망"]
        if isinstance(gm, dict) and "공망지지" in gm:
            out["공망"] = gm
    elif "공망" in report:
        out["공망"] = report["공망"]

    # 9) 대운
    if "대운" in report:
        daewoon = dict(report["대운"])
        if "대운기둥(10개)" in daewoon:
            daewoon["대운기둥10"] = daewoon.pop("대운기둥(10개)", [])
        elif "블록" in daewoon and "대운기둥10" not in daewoon:
            blocks = daewoon.get("블록", [])
            daewoon["대운기둥10"] = [
                {
                    "order": b.get("index", i + 1),
                    "daewoon_pillar": b.get("ganzhi", ""),
                    "start_age_years": b.get("start_age", 0),
                    "end_age_years": b.get("end_age", 0),
                }
                for i, b in enumerate(blocks)
            ]
        out["대운"] = daewoon

    # 10) 세운, 월운
    sewoon = report.get("세운(연운)") or report.get("세운")
    if sewoon is not None:
        out["세운"] = sewoon
    if "월운" in report:
        out["월운"] = report["월운"]

    # 11) 격국
    if "격국" in report:
        out["격국"] = report["격국"]

    # 12) 입력정보
    inp_raw = report.get("입력정보") or report.get("입력")
    if inp_raw:
        if redact and isinstance(inp_raw, dict):
            inp = dict(inp_raw)
            inp.pop("birth_date", None)
            inp.pop("birth_time", None)
            out["입력정보"] = inp
        else:
            out["입력정보"] = inp_raw

    # 13) 확장 필드
    if "_extended" in report:
        out["_extended"] = report["_extended"]

    # 14) chart_data
    if "chart_data" in report:
        out["chartData"] = report["chart_data"]

    # 15) 사주관계 (합충형파해)
    if "사주관계" in report:
        out["사주관계"] = report["사주관계"]

    # 16) 패턴점수
    if "패턴점수" in report:
        out["패턴점수"] = report["패턴점수"]

    # 17) DomainScore
    if "DomainScore" in report:
        out["DomainScore"] = report["DomainScore"]

    return out


def compute_report(
    birth_date: str,
    birth_time: str = "12:00",
    time_unknown: bool = False,
    gender: str = "male",
    city: Optional[str] = "Seoul",
    utc_offset: int = 9,
    use_solar_time: bool = True,
    early_zi_time: bool = False,
    is_lunar: bool = False,
    is_leap_month: bool = False,
    redact: bool = True,
) -> Dict[str, Any]:
    """Compute Saju report using saju_engine.py and return normalized JSON."""
    mod = _load_engine()
    BirthInput = getattr(mod, "BirthInput")
    compute_all = getattr(mod, "compute_all")

    y, m, d = _parse_date(birth_date)
    hour, minute = (12, 0) if time_unknown else _parse_time(birth_time)

    calendar = "lunar" if is_lunar else "solar"
    birth = BirthInput(
        year=y,
        month=m,
        day=d,
        hour=hour,
        minute=minute,
        calendar=calendar,
        is_leap_month=is_leap_month,
        gender=gender,
        city=city or "Seoul",
        use_solar_time=use_solar_time,
        utc_offset=utc_offset,
        early_zi_time=early_zi_time,
    )

    report = compute_all(birth)
    return _normalize_for_frontend(report, redact=redact)
