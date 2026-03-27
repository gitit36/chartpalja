# -*- coding: utf-8 -*-
"""
saju_engine_v3.3.py
─────────────────────────────────────────────────────────────────
v2 → v3 개선사항
 Q1 [변경] 신살 BASE 확장: 연지/일지 → 연지/월지/일지/시지 모두 사용
 Q2 [변경] 용신/희신/기신: 십성명 + 실제 오행(木火土金水) 동시 반환
 Q3 [추가] 사주관계 확장: 천간충·천간극·반합·삼합완성·방합
 Q4 [추가] 신살 추가: 격각살·금신살·음양차착살·오행덕귀인·
           천덕합·월덕합·삼태·문곡귀인·태백살·복덕살·천후귀인·천하귀인
─────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import csv, os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Dict, List, Optional, Tuple, Any
import math

from sajupy import calculate_saju, lunar_to_solar

# ──────────────────────────────────────────────
# SECTION 1 : 기본 상수
# ──────────────────────────────────────────────
KST = timezone(timedelta(hours=9))
UTC = timezone.utc

HEAVENLY_STEMS   = list("甲乙丙丁戊己庚辛壬癸")
EARTHLY_BRANCHES = list("子丑寅卯辰巳午未申酉戌亥")

STEM_ELEMENT = {"甲":"木","乙":"木","丙":"火","丁":"火","戊":"土",
                "己":"土","庚":"金","辛":"金","壬":"水","癸":"水"}
BRANCH_ELEMENT_MAIN = {"子":"水","丑":"土","寅":"木","卯":"木","辰":"土","巳":"火",
                       "午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水"}
YINYANG_STEM = {"甲":"陽","乙":"陰","丙":"陽","丁":"陰","戊":"陽",
                "己":"陰","庚":"陽","辛":"陰","壬":"陽","癸":"陰"}
YINYANG_BRANCH = {"子":"陽","丑":"陰","寅":"陽","卯":"陰","辰":"陽","巳":"陰",
                  "午":"陽","未":"陰","申":"陽","酉":"陰","戌":"陽","亥":"陰"}
BRANCH_HIDDEN_STEMS = {
    "子":["癸"],          "丑":["己","癸","辛"],
    "寅":["甲","丙","戊"],"卯":["乙"],
    "辰":["戊","乙","癸"],"巳":["丙","戊","庚"],
    "午":["丁","己"],     "未":["己","丁","乙"],
    "申":["庚","壬","戊"],"酉":["辛"],
    "戌":["戊","辛","丁"],"亥":["壬","甲"],
}

# ── [v5] 지장간 역할 명시 (source-of-truth) ──────────────────────
# 명리학 원칙: 지장간 본기/중기/여기는 역할과 역량이 다르다.
# BRANCH_HIDDEN_STEMS의 리스트 순서가 일부 지지에서 표준과 불일치하므로,
# 역할(본기/중기/여기)을 명시적으로 지정하여 인덱스 의존을 제거한다.
BRANCH_JIJANGGAN = {
    "子": {"본기": "癸", "중기": "壬",  "여기": None},
    "丑": {"본기": "己", "중기": "辛",  "여기": "癸"},
    "寅": {"본기": "甲", "중기": "丙",  "여기": "戊"},
    "卯": {"본기": "乙", "중기": "甲",  "여기": None},
    "辰": {"본기": "戊", "중기": "癸",  "여기": "乙"},
    "巳": {"본기": "丙", "중기": "戊",  "여기": "庚"},
    "午": {"본기": "丁", "중기": "己",  "여기": "丙"},
    "未": {"본기": "己", "중기": "乙",  "여기": "丁"},
    "申": {"본기": "庚", "중기": "壬",  "여기": "戊"},
    "酉": {"본기": "辛", "중기": "庚",  "여기": None},
    "戌": {"본기": "戊", "중기": "丁",  "여기": "辛"},
    "亥": {"본기": "壬", "중기": "甲",  "여기": None},
}

# 역할별 가중치: 지장간 개수에 따라 합이 1.0이 되도록 정규화
_JIJANGGAN_W = {
    3: {"본기": 0.5, "중기": 0.3, "여기": 0.2},
    2: {"본기": 0.7, "중기": 0.3, "여기": 0.0},
    1: {"본기": 1.0, "중기": 0.0, "여기": 0.0},
}

def get_jijanggan(branch: str) -> list:
    """(천간, 역할, 가중치) 리스트 반환. 역할: '본기'|'중기'|'여기'."""
    jj = BRANCH_JIJANGGAN.get(branch)
    if not jj:
        return []
    count = sum(1 for r in ("본기", "중기", "여기") if jj[r])
    weights = _JIJANGGAN_W.get(count, _JIJANGGAN_W[1])
    result = []
    for role in ("본기", "중기", "여기"):
        stem = jj[role]
        if stem:
            result.append((stem, role, weights[role]))
    return result


def _hidden_stems_by_role(branch: str) -> List[str]:
    """지장간을 여기→중기→본기 순서로 반환한다 (전통 명리학 표기 순서)."""
    items = get_jijanggan(branch)
    return [stem for stem, _role, _weight in reversed(items)]


def _add_branch_weighted_elements(
    cnt: Dict[str, float],
    branch: str,
    scale: float = 1.0,
) -> None:
    """지지 1개를 지장간 역할 가중치에 따라 오행 카운트로 분해한다."""
    for stem, _role, weight in get_jijanggan(branch):
        cnt[STEM_ELEMENT[stem]] += scale * weight

GANZHI_60   = [HEAVENLY_STEMS[i%10]+EARTHLY_BRANCHES[i%12] for i in range(60)]
BRANCH_INDEX = {b:i for i,b in enumerate(EARTHLY_BRANCHES)}

def ganzhi_index(gz:str)->int:
    if gz not in GANZHI_60: raise ValueError(f"Invalid ganzhi: {gz}")
    return GANZHI_60.index(gz)
def next_ganzhi(gz:str,step:int)->str: return GANZHI_60[(ganzhi_index(gz)+step)%60]
def jeomsin_round(x:float)->int:
    if x<0: return -jeomsin_round(-x)
    return int(x+0.5)

# ──────────────────────────────────────────────
# SECTION 2 : 12운성 & 납음
# ──────────────────────────────────────────────
UNSEONG_ORDER = ["장생","목욕","관대","건록","제왕","쇠","병","사","묘","절","태","양"]
JANGSAENG_START_BRANCH = {"甲":"亥","乙":"午","丙":"寅","丁":"酉","戊":"寅","己":"酉",
                           "庚":"巳","辛":"子","壬":"申","癸":"卯"}
def twelve_unseong(day_stem:str, branch:str)->str:
    s=JANGSAENG_START_BRANCH.get(day_stem)
    if not s: return "?"
    fwd=(YINYANG_STEM[day_stem]=="陽")
    step=(BRANCH_INDEX[branch]-BRANCH_INDEX[s])%12 if fwd else (BRANCH_INDEX[s]-BRANCH_INDEX[branch])%12
    return UNSEONG_ORDER[step]

NAYIN_30 = [
    "海中金","海中金","爐中火","爐中火","大林木","大林木","路旁土","路旁土",
    "劍鋒金","劍鋒金","山頭火","山頭火","澗下水","澗下水","城頭土","城頭土",
    "白蠟金","白蠟金","楊柳木","楊柳木","泉中水","泉中水","屋上土","屋上土",
    "霹靂火","霹靂火","松柏木","松柏木","長流水","長流水","砂中金","砂中金",
    "山下火","山下火","平地木","平地木","壁上土","壁上土","金箔金","金箔金",
    "覆燈火","覆燈火","天河水","天河水","大驛土","大驛土","釵釧金","釵釧金",
    "桑柘木","桑柘木","大溪水","大溪水","沙中土","沙中土","天上火","天上火",
    "石榴木","石榴木","大海水","大海水",
]
def nayin(gz:str)->str: return NAYIN_30[ganzhi_index(gz)]

# ══════════════════════════════════════════════
# SECTION 3 : 십성 (v3.3 – 한글 표기 통일)
# ══════════════════════════════════════════════

# 변경: "七殺" → "偏官" 통일 (칠살→편관)

GEN_MAP = {"木":"火","火":"土","土":"金","金":"水","水":"木"}
KE_MAP = {"木":"土","土":"水","水":"火","火":"金","金":"木"}
GEN_INV = {v: k for k, v in GEN_MAP.items()}  # X를 생하는 오행: GEN_INV["火"]="木"

def ten_god(day: str, tgt: str) -> str:
    de, te = STEM_ELEMENT[day], STEM_ELEMENT[tgt]
    dy, ty = YINYANG_STEM[day], YINYANG_STEM[tgt]
    s = (dy == ty)
    if te == de: return "비견" if s else "겁재"
    if te == GEN_MAP[de]: return "식신" if s else "상관"
    if te == KE_MAP[de]: return "편재" if s else "정재"
    if de == KE_MAP[te]: return "편관" if s else "정관"
    if de == GEN_MAP[te]: return "편인" if s else "정인"
    return "?"

def branch_main_hs(br: str) -> Optional[str]:
    jj = BRANCH_JIJANGGAN.get(br)
    return jj["본기"] if jj else None

def branch_main_tg(day: str, br: str) -> str:
    m = branch_main_hs(br)
    return ten_god(day, m) if m else "?"

def day_tengo_ohaeng(day_stem: str) -> Dict[str, str]:
    de = STEM_ELEMENT[day_stem]
    inv_ke = {v: k for k, v in KE_MAP.items()}
    inv_gen = {v: k for k, v in GEN_MAP.items()}
    return {
        "비겁": de,
        "식상": GEN_MAP[de],
        "재성": KE_MAP[de],
        "관살": inv_ke[de],
        "인성": inv_gen[de],
    }

# 십성 카테고리 매핑 (한글 통일)

_TENGO_CATEGORY = {
    "비견": "비겁", "겁재": "비겁",
    "식신": "식상", "상관": "식상",
    "편재": "재성", "정재": "재성",
    "편관": "관살", "정관": "관살",
    "편인": "인성", "정인": "인성",
}

# ──────────────────────────────────────────────
# SECTION 4 : 합/충/형/파/해 + 관계 확장 테이블
# ──────────────────────────────────────────────
STEM_COMBINE = {("甲","己"),("己","甲"),("乙","庚"),("庚","乙"),("丙","辛"),("辛","丙"),
                ("丁","壬"),("壬","丁"),("戊","癸"),("癸","戊")}

# [추가] 천간충 (甲庚·乙辛·丙壬·丁癸)
STEM_CLASH = {("甲","庚"),("庚","甲"),("乙","辛"),("辛","乙"),("丙","壬"),("壬","丙"),("丁","癸"),("癸","丁")}

# [추가] 천간극 (일방이 타방 오행을 克) + 정극/편극 구분
_STEM_KE: set = set()
_STEM_KE_TYPE: dict = {}  # (s1,s2) -> "정극"/"편극"
for _s1 in HEAVENLY_STEMS:
    for _s2 in HEAVENLY_STEMS:
        if _s1!=_s2 and KE_MAP.get(STEM_ELEMENT[_s1])==STEM_ELEMENT[_s2]:
            _STEM_KE.add((_s1,_s2))
            _STEM_KE_TYPE[(_s1,_s2)] = "정극" if YINYANG_STEM[_s1]!=YINYANG_STEM[_s2] else "편극"
STEM_KE_PAIRS = frozenset(_STEM_KE)

def _stem_ke_label(s1: str, s2: str) -> str:
    return _STEM_KE_TYPE.get((s1, s2), "극")

# 지지 관계 (기존)
BRANCH_COMBINE = {("子","丑"),("丑","子"),("寅","亥"),("亥","寅"),("卯","戌"),("戌","卯"),
                  ("辰","酉"),("酉","辰"),("巳","申"),("申","巳"),("午","未"),("未","午")}
BRANCH_CLASH   = {("子","午"),("午","子"),("丑","未"),("未","丑"),("寅","申"),("申","寅"),
                  ("卯","酉"),("酉","卯"),("辰","戌"),("戌","辰"),("巳","亥"),("亥","巳")}
BRANCH_HARM    = {("子","未"),("未","子"),("丑","午"),("午","丑"),("寅","巳"),("巳","寅"),
                  ("卯","辰"),("辰","卯"),("申","亥"),("亥","申"),("酉","戌"),("戌","酉")}
BRANCH_BREAK   = {("子","酉"),("酉","子"),("丑","辰"),("辰","丑"),("寅","亥"),("亥","寅"),
                  ("卯","午"),("午","卯"),("申","巳"),("巳","申"),("未","戌"),("戌","未")}
BRANCH_PUNISH  = {("寅","巳"),("巳","寅"),("巳","申"),("申","巳"),("寅","申"),("申","寅"),
                  ("丑","戌"),("戌","丑"),("戌","未"),("未","戌"),("丑","未"),("未","丑"),
                  ("子","卯"),("卯","子"),("辰","辰"),("午","午"),("酉","酉"),("亥","亥")}

_PUNISH_WUEUN  = {("寅","巳"),("巳","寅"),("巳","申"),("申","巳"),("寅","申"),("申","寅")}
_PUNISH_JISE   = {("丑","戌"),("戌","丑"),("戌","未"),("未","戌"),("丑","未"),("未","丑")}
_PUNISH_MURYE  = {("子","卯"),("卯","子")}
_PUNISH_SELF   = {("辰","辰"),("午","午"),("酉","酉"),("亥","亥")}

def _punish_type_label(b1: str, b2: str) -> str:
    pair = (b1, b2)
    if pair in _PUNISH_WUEUN:
        return "무은지형"
    if pair in _PUNISH_JISE:
        return "지세지형"
    if pair in _PUNISH_MURYE:
        return "무례지형"
    if pair in _PUNISH_SELF:
        return "자형"
    return "형"

# [추가] 반합(半合) – 삼합의 2지지 조합 (왕지 포함 + 왕지 미포함)
BRANCH_SEMI_COMBINE = {
    # 왕지 포함
    ("申","子"):"水반합",("子","申"):"水반합",("子","辰"):"水반합",("辰","子"):"水반합",
    ("寅","午"):"火반합",("午","寅"):"火반합",("午","戌"):"火반합",("戌","午"):"火반합",
    ("亥","卯"):"木반합",("卯","亥"):"木반합",("卯","未"):"木반합",("未","卯"):"木반합",
    ("巳","酉"):"金반합",("酉","巳"):"金반합",("酉","丑"):"金반합",("丑","酉"):"金반합",
    # 왕지 미포함 (생지+묘지 조합)
    ("申","辰"):"水반합",("辰","申"):"水반합",
    ("寅","戌"):"火반합",("戌","寅"):"火반합",
    ("亥","未"):"木반합",("未","亥"):"木반합",
    ("巳","丑"):"金반합",("丑","巳"):"金반합",
}
# [추가] 삼합(三合) 완성 세트
TRINE_SETS = {
    frozenset(["申","子","辰"]):"水삼합",
    frozenset(["寅","午","戌"]):"火삼합",
    frozenset(["亥","卯","未"]):"木삼합",
    frozenset(["巳","酉","丑"]):"金삼합",
}
# [추가] 방합(方合) – 계절 3지지 완성
DIRECTION_SETS = {
    frozenset(["寅","卯","辰"]):"木방합(봄)",
    frozenset(["巳","午","未"]):"火방합(여름)",
    frozenset(["申","酉","戌"]):"金방합(가을)",
    frozenset(["亥","子","丑"]):"水방합(겨울)",
}

# ──────────────────────────────────────────────
# SECTION 5 : CSV 로드
# ──────────────────────────────────────────────
try:
    _CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shinsal_lookup.csv")
except NameError:
    _CSV_PATH = os.path.join(os.getcwd(), "shinsal_lookup.csv")

_SHINSAL_YEAR_BRANCH: Dict[str,Dict[str,List[str]]] = {}
_SHINSAL_DAY_STEM:    Dict[str,Dict[str,List[str]]] = {}
_SHINSAL_KIND:        Dict[str,str]                 = {}

def _load_shinsal_csv(path:str)->None:
    if not os.path.exists(path):
        print(f"[경고] CSV 없음: {path}"); return
    with open(path,encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name  = row["shinsal_name"].strip()
            kind  = row["kind"].strip()
            basis = row["basis_type"].strip()
            key   = row["lookup_key"].strip()
            tgts  = [t.strip() for t in [row.get("target1",""),row.get("target2","")] if t.strip()]
            _SHINSAL_KIND[name] = kind
            if basis=="year_branch": _SHINSAL_YEAR_BRANCH.setdefault(name,{})[key]=tgts
            elif basis=="day_stem":  _SHINSAL_DAY_STEM.setdefault(name,{})[key]=tgts

_load_shinsal_csv(_CSV_PATH)

# ──────────────────────────────────────────────
# SECTION 6 : 신살 인코드 테이블
# ──────────────────────────────────────────────
def get_trine(br:str)->str:
    if br in "申子辰": return "申子辰"
    if br in "寅午戌": return "寅午戌"
    if br in "亥卯未": return "亥卯未"
    if br in "巳酉丑": return "巳酉丑"
    return ""

PEACH_BY_TRINE         = {"申子辰":"酉","寅午戌":"卯","亥卯未":"子","巳酉丑":"午"}
HORSE_BY_TRINE         = {"申子辰":"寅","寅午戌":"申","亥卯未":"巳","巳酉丑":"亥"}
FLORAL_CANOPY_BY_TRINE = {"申子辰":"辰","寅午戌":"戌","亥卯未":"未","巳酉丑":"丑"}
GENERAL_STAR_BY_TRINE  = {"申子辰":"子","寅午戌":"午","亥卯未":"卯","巳酉丑":"酉"}
PANAN_BY_TRINE         = {"申子辰":"辰","寅午戌":"戌","亥卯未":"未","巳酉丑":"丑"}
WANGSHEN_BY_TRINE      = {"申子辰":"亥","寅午戌":"巳","亥卯未":"申","巳酉丑":"寅"}
JIESHA_BY_TRINE        = {"申子辰":"巳","寅午戌":"亥","亥卯未":"申","巳酉丑":"寅"}
THREE_SAL_BY_TRINE     = {
    "申子辰":{"劫煞":"巳","災煞":"午","天煞":"未"},
    "寅午戌":{"劫煞":"亥","災煞":"子","天煞":"丑"},
    "亥卯未":{"劫煞":"申","災煞":"酉","天煞":"戌"},
    "巳酉丑":{"劫煞":"寅","災煞":"卯","天煞":"辰"},
}
NOBLEMAN_TIAN_YI  = {"甲":["丑","未"],"乙":["子","申"],"丙":["亥","酉"],"丁":["酉","亥"],
                     "戊":["丑","未"],"己":["子","申"],"庚":["午","寅"],"辛":["寅","午"],
                     "壬":["卯","巳"],"癸":["巳","卯"]}
WENCHANG          = {"甲":"巳","乙":"午","丙":"申","丁":"酉","戊":"申","己":"酉","庚":"亥","辛":"子","壬":"寅","癸":"卯"}
LUXING            = {"甲":"寅","乙":"卯","丙":"巳","丁":"午","戊":"巳","己":"午","庚":"申","辛":"酉","壬":"亥","癸":"子"}
YANGREN           = {"甲":"卯","乙":"寅","丙":"午","丁":"巳","戊":"午","己":"巳","庚":"酉","辛":"申","壬":"子","癸":"亥"}
TAIJI             = {"甲":["子","午"],"乙":["丑","未"],"丙":["寅","申"],"丁":["卯","酉"],
                     "戊":["辰","戌"],"己":["巳","亥"],"庚":["子","午"],"辛":["丑","未"],
                     "壬":["寅","申"],"癸":["卯","酉"]}
GUOYIN            = {"甲":"戌","乙":"亥","丙":"丑","丁":"寅","戊":"丑","己":"寅","庚":"辰","辛":"巳","壬":"未","癸":"申"}
FUXING            = {"甲":"子","乙":"丑","丙":"寅","丁":"卯","戊":"辰","己":"巳","庚":"午","辛":"未","壬":"申","癸":"酉"}
HAKDANG           = {"甲":"亥","乙":"午","丙":"寅","丁":"酉","戊":"寅","己":"酉","庚":"巳","辛":"子","壬":"申","癸":"卯"}
SAGWAN            = {"甲":"巳","乙":"午","丙":"申","丁":"酉","戊":"申","己":"酉","庚":"亥","辛":"子","壬":"寅","癸":"卯"}
HONGYEOM          = {"甲":"午","乙":"申","丙":"寅","丁":"未","戊":"辰","己":"辰","庚":"戌","辛":"酉","壬":"子","癸":"申"}
TIANDE_MB         = {"寅":"丁","卯":"申","辰":"壬","巳":"辛","午":"亥","未":"甲",
                     "申":"癸","酉":"寅","戌":"丙","亥":"乙","子":"巳","丑":"庚"}
YUEDE_MB          = {"寅":"丙","卯":"甲","辰":"壬","巳":"庚","午":"丙","未":"甲",
                     "申":"壬","酉":"庚","戌":"丙","亥":"甲","子":"壬","丑":"庚"}
TIANYI_MB         = {"寅":"丑","卯":"寅","辰":"卯","巳":"辰","午":"巳","未":"午",
                     "申":"未","酉":"申","戌":"酉","亥":"戌","子":"亥","丑":"子"}
HONGRAN_YB        = {"子":"卯","丑":"寅","寅":"丑","卯":"子","辰":"亥","巳":"戌","午":"酉","未":"申","申":"未","酉":"午","戌":"巳","亥":"辰"}
TIANXI_YB         = {"子":"酉","丑":"申","寅":"未","卯":"午","辰":"巳","巳":"辰","午":"卯","未":"寅","申":"丑","酉":"子","戌":"亥","亥":"戌"}
GUCHEN_YB         = {"子":"寅","丑":"寅","寅":"巳","卯":"巳","辰":"巳","巳":"申","午":"申","未":"申","申":"亥","酉":"亥","戌":"亥","亥":"寅"}
GUASU_YB          = {"子":"戌","丑":"戌","寅":"丑","卯":"丑","辰":"丑","巳":"辰","午":"辰","未":"辰","申":"未","酉":"未","戌":"未","亥":"戌"}
# ── [Fix-9] 추가 신살 테이블 ──────────────────
# 재살(災殺): 삼합국 기반 — 이미 THREE_SAL_BY_TRINE에 災煞 포함, 별칭 등록
# 관귀살(官貴): 일간 기준
GWANGUI_DS = {"甲":"未","乙":"辰","丙":"酉","丁":"亥","戊":"酉","己":"亥","庚":"丑","辛":"午","壬":"卯","癸":"巳"}
# 현광살(懸光): 일간 기준
HYUNGWANG_DS = {"甲":"酉","乙":"申","丙":"子","丁":"亥","戊":"子","己":"亥","庚":"卯","辛":"寅","壬":"午","癸":"巳"}
# 천복귀인(天福): 일간 기준
TIANFU_DS = {"甲":"子","乙":"丑","丙":"寅","丁":"卯","戊":"辰","己":"巳","庚":"午","辛":"未","壬":"申","癸":"酉"}
# 관록(官祿): 일간 기준, 정관의 록지
GWANROK_DS = {"甲":"酉","乙":"申","丙":"子","丁":"亥","戊":"子","己":"亥","庚":"卯","辛":"寅","壬":"午","癸":"巳"}
# 명예살: 연지 기준
MYUNGYE_YB = {"子":"午","丑":"巳","寅":"辰","卯":"卯","辰":"寅","巳":"丑","午":"子","未":"亥","申":"戌","酉":"酉","戌":"申","亥":"未"}
# 천사(天赦): 계절별 특정 일주만 해당
TIANSA_TABLE = {"봄":"戊寅","여름":"甲午","가을":"戊申","겨울":"甲子","토":"戊辰"}
# 천은(天恩): 일간 기준
TIANEUN_DS = {"甲":"丑","乙":"子","丙":"卯","丁":"寅","戊":"巳","己":"辰","庚":"未","辛":"午","壬":"酉","癸":"申"}
# 청룡/현무/주작/백호 방위 (연지 삼합국 기반)
DIRECTION_SPIRIT_BY_TRINE = {
    "寅午戌": {"청룡":"寅","주작":"午","백호":"戌"},
    "申子辰": {"현무":"子","청룡":"辰","백호":"申"},
    "亥卯未": {"청룡":"卯","주작":"未","현무":"亥"},
    "巳酉丑": {"백호":"酉","현무":"丑","주작":"巳"},
}
# 목덕살(木德): 봄(寅卯辰)월생→木덕, 기타 계절도 대응
MOKDEOK_SEASON = {"寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土","申":"金","酉":"金","戌":"土","亥":"水","子":"水","丑":"土"}
# 연살(年殺): 연지 기준
YEONSAL_YB = {"子":"午","丑":"未","寅":"申","卯":"酉","辰":"戌","巳":"亥","午":"子","未":"丑","申":"寅","酉":"卯","戌":"辰","亥":"巳"}
# 휴식살(休息): 연지 기준 (삼합 묘지)
HYUSIK_BY_TRINE = {"申子辰":"辰","寅午戌":"戌","亥卯未":"未","巳酉丑":"丑"}

# ── [Fix-16] 추가 신살 테이블 ──────────────────

# 천시귀인(天時): 일간 기준
TIANSHI_DS = {"甲":"午","乙":"巳","丙":"巳","丁":"午","戊":"未","己":"未","庚":"申","辛":"酉","壬":"子","癸":"亥"}
# 천관성(天官星): 일간 기준 — 정관의 녹지
TIANGUAN_DS = {"甲":"酉","乙":"申","丙":"亥","丁":"子","戊":"寅","己":"卯","庚":"巳","辛":"午","壬":"未","癸":"申"}
# 천수성(天壽星): 일간 기준
TIANSHOU_DS = {"甲":"丑","乙":"辰","丙":"未","丁":"戌","戊":"未","己":"戌","庚":"丑","辛":"辰","壬":"未","癸":"戌"}
# 천문성(天門星): 일간 기준
TIANMEN_DS = {"甲":"亥","乙":"戌","丙":"亥","丁":"戌","戊":"亥","己":"戌","庚":"亥","辛":"戌","壬":"亥","癸":"戌"}
# 천의성(天醫2): 월지→천의 별도 매핑 (기존 TIANYI_MB과 같으나 세부용)
# 금여록(金輿祿): 일간 기준
KINYEOLOK_DS = {"甲":"辰","乙":"巳","丙":"未","丁":"申","戊":"未","己":"申","庚":"戌","辛":"亥","壬":"丑","癸":"寅"}
# 태양귀인/태음귀인: 연지 기준
TAEYANG_YB = {"子":"巳","丑":"午","寅":"巳","卯":"午","辰":"巳","巳":"午","午":"未","未":"申","申":"酉","酉":"戌","戌":"亥","亥":"子"}
TAEEUM_YB = {"子":"亥","丑":"子","寅":"丑","卯":"寅","辰":"卯","巳":"辰","午":"巳","未":"午","申":"未","酉":"申","戌":"酉","亥":"戌"}
# 삼기귀인(三奇): 天三奇=甲戊庚, 地三奇=乙丙丁, 人三奇=壬癸辛
SAMGI_HEAVEN = frozenset(["甲","戊","庚"])
SAMGI_EARTH  = frozenset(["乙","丙","丁"])
SAMGI_HUMAN  = frozenset(["壬","癸","辛"])
# 옥당귀인(玉堂): 일간 기준
OKDANG_DS = {"甲":"未","乙":"辰","丙":"亥","丁":"酉","戊":"亥","己":"酉","庚":"丑","辛":"寅","壬":"巳","癸":"卯"}
# 권세귀인: 일간 기준
GWONSE_DS = {"甲":"寅","乙":"卯","丙":"巳","丁":"午","戊":"巳","己":"午","庚":"申","辛":"酉","壬":"亥","癸":"子"}
# 천계귀인: 일간 기준
TIANGYE_DS = {"甲":"未","乙":"申","丙":"酉","丁":"亥","戊":"酉","己":"亥","庚":"丑","辛":"寅","壬":"卯","癸":"巳"}
# 봉각살(鳳閣): 일간 기준 (식신의 록지)
BONGGAK_DS = {"甲":"巳","乙":"午","丙":"申","丁":"酉","戊":"申","己":"酉","庚":"亥","辛":"子","壬":"寅","癸":"卯"}
# 용덕귀인/봉덕귀인: 연지 기준
YONGDEOK_YB = {"子":"巳","丑":"午","寅":"卯","卯":"辰","辰":"巳","巳":"午","午":"未","未":"申","申":"酉","酉":"戌","戌":"亥","亥":"子"}
BONGDEOK_YB = {"子":"亥","丑":"子","寅":"酉","卯":"戌","辰":"亥","巳":"子","午":"丑","未":"寅","申":"卯","酉":"辰","戌":"巳","亥":"午"}
# 천살(天殺): 삼합 기반 — THREE_SAL_BY_TRINE에 이미 天煞 있음, 별도 등록

WONJIN_PAIRS      = {("子","未"),("未","子"),("丑","午"),("午","丑"),("寅","酉"),("酉","寅"),
                     ("卯","申"),("申","卯"),("辰","亥"),("亥","辰"),("巳","戌"),("戌","巳")}
GUIMUN_PAIRS      = {("子","酉"),("酉","子"),("丑","午"),("午","丑"),("寅","未"),("未","寅"),
                     ("卯","申"),("申","卯"),("辰","亥"),("亥","辰"),("巳","戌"),("戌","巳"),("未","子"),("子","未")}
TIANLUO_SET       = {"辰","巳"}
DIWANG_SET        = {"戌","亥"}
KUIGANG           = {"庚辰","庚戌","壬辰","戊戌"}
GOLAN             = {"甲寅","乙巳","丁巳","戊申","辛亥","壬寅","癸巳"}
BAEKHO            = {"甲辰","乙未","丙戌","丁丑","戊辰","己丑","庚辰","辛未","壬戌","癸丑"}
HYUNCHIM_STEMS    = {"甲","丙","壬"}
HYUNCHIM_BRANCHES = {"申","卯","酉"}
SAMGI_SETS        = [(frozenset({"甲","戊","庚"}),"天三奇(甲戊庚)"),(frozenset({"乙","丙","丁"}),"地三奇(乙丙丁)"),(frozenset({"壬","癸","辛"}),"人三奇(壬癸辛)")]
# [추가] 격각살 – 辰戌丑未 2개 이상
GAKGAK_SET        = {"辰","戌","丑","未"}
# [추가] 금신살 – 특정 일주
GEUMSHIN_PILLARS  = {"己巳","己丑","癸巳","癸酉","癸丑"}
# [추가] 음양차착살 – 결혼 운에 영향, 특정 일주
EUMYANG_PILLARS   = {"丙子","丁丑","戊寅","壬午","癸未","甲申","庚子","辛丑","壬寅","丙午","丁未","戊申"}

# ──────────────────────────────────────────────
# SECTION 7 : 공망
# ──────────────────────────────────────────────
XUNKONG_BY_JIA = {"甲子":["戌","亥"],"甲戌":["申","酉"],"甲申":["午","未"],
                  "甲午":["辰","巳"],"甲辰":["寅","卯"],"甲寅":["子","丑"]}
def day_xun_start(gz:str)->str:
    idx=ganzhi_index(gz); return GANZHI_60[idx-(idx%10)]
def xunkong(gz:str)->List[str]: return XUNKONG_BY_JIA.get(day_xun_start(gz),[])

# ══════════════════════════════════════════════
# SECTION 8 : 신강/신약 (v3.3 – 근묘화실 가중치 + 투간/통근)
# ══════════════════════════════════════════════

# 근묘화실(根苗花實) 위치별 가중치: 일지(근)>월지(묘)>시지(화)>연지(실)

_POSITION_WEIGHT_BRANCH = {"일지": 1.5, "월지": 1.2, "시지": 1.0, "연지": 0.8}
_POSITION_WEIGHT_STEM = {"일간": 0, "월간": 1.2, "시간": 1.0, "연간": 0.8}

SEASON_SUPPORT = {
    "寅": "木", "卯": "木", "辰": "土", "巳": "火", "午": "火", "未": "土",
    "申": "金", "酉": "金", "戌": "土", "亥": "水", "子": "水", "丑": "土",
}

def strength_score(day_stem: str, month_branch: str,stems: List[str], branches: List[str]) -> Tuple[float, str]:
    """v3.3: 근묘화실 가중치 + 득령 세분화"""
    de = STEM_ELEMENT[day_stem]
    inv_gen = {v: k for k, v in GEN_MAP.items()}
    insung_elem = inv_gen.get(de, "")
    sc = 0.0

    # ── 득령(월지 계절) — 왕상휴수사 5단계 ──
    se = SEASON_SUPPORT.get(month_branch, "")
    jaesung_elem = KE_MAP.get(de, "")  # 내가 극하는 오행 = 재성
    if se == de:
        sc += 5.0   # 旺(왕): 월지 = 일간 오행
    elif se == insung_elem:
        sc += 3.0   # 相(상): 월지 = 인성(나를 생하는 오행)
    elif GEN_MAP.get(de) == se:
        sc += 1.0   # 休(휴): 월지 = 식상(내가 생하는 오행)
    elif KE_MAP.get(se, "") == de:
        sc -= 2.0   # 囚(수): 월지 = 관살(나를 극하는 오행)
    elif se == jaesung_elem:
        sc -= 1.0   # 사(死): 월지 = 재성(내가 극하는 오행)

    # ── 천간 통기(투간) ──────────────────────
    stem_labels = ["연간", "월간", "일간", "시간"]
    for i, s in enumerate(stems):
        if i == 2: continue # 일간 자신 제외
        w = _POSITION_WEIGHT_STEM.get(stem_labels[i], 1.0)
        if STEM_ELEMENT[s] == de:
            sc += 2.0 * w # 비겁 투간
        elif STEM_ELEMENT[s] == insung_elem:
            sc += 1.5 * w # 인성 투간

    # ── 지지 통근(지장간) — [v5] get_jijanggan 기반 (순서 의존 제거) ──
    branch_labels = ["연지", "월지", "일지", "시지"]
    _JJ_DEPTH = {"본기": 1.0, "중기": 0.6, "여기": 0.3}
    for i, b in enumerate(branches):
        w = _POSITION_WEIGHT_BRANCH.get(branch_labels[i], 1.0)
        for h, role, _jw in get_jijanggan(b):
            depth_w = _JJ_DEPTH.get(role, 0.2)
            if STEM_ELEMENT[h] == de:
                sc += 2.0 * w * depth_w
            elif STEM_ELEMENT[h] == insung_elem:
                sc += 1.0 * w * depth_w

    # ── 12운성 보정 ────────────────────────
    _UNSEONG_STRENGTH = {
        "장생": 0.8, "목욕": 0.2, "관대": 0.6, "건록": 1.0, "제왕": 1.2,
        "쇠": -0.2, "병": -0.5, "사": -0.8, "묘": -0.6, "절": -1.0,
        "태": 0.0, "양": 0.3,
    }
    for i, b in enumerate(branches):
        w = _POSITION_WEIGHT_BRANCH.get(branch_labels[i], 1.0)
        uns = twelve_unseong(day_stem, b)
        sc += _UNSEONG_STRENGTH.get(uns, 0.0) * w

    # ── 판정 (8단계) ─────────────────────────
    if sc >= 15.0:
        verdict = "극왕"
    elif sc >= 12.0:
        verdict = "태강"
    elif sc >= 9.0:
        verdict = "신강"
    elif sc >= 6.5:
        verdict = "중화신강"
    elif sc >= 4.0:
        verdict = "중화신약"
    elif sc >= 2.0:
        verdict = "신약"
    elif sc >= 0.0:
        verdict = "태약"
    else:
        verdict = "극약"

    return round(sc, 1), verdict

# 8단계 판정 → 기존 로직 호환용 그룹핑 상수
_STRONG_VERDICTS = frozenset({"극왕", "태강", "신강"})
_VERY_STRONG_VERDICTS = frozenset({"극왕", "태강"})
_NEUTRAL_VERDICTS = frozenset({"중화신강", "중화신약"})
_WEAK_VERDICTS = frozenset({"신약", "태약", "극약"})
_VERY_WEAK_VERDICTS = frozenset({"태약", "극약"})

# ══════════════════════════════════════════════
# SECTION 9 : 격국 / 용신 / 희신 / 기신 (v3.3 대폭 개선)
# ══════════════════════════════════════════════

# 개선: 격국 정교화 + 조후용신 + 통관용신 + 종격/화격 + 합화/합거

# ── 9-1: 격국 판별 정교화 ────────────────────

def _is_stem_in_pillars(stem: str, stems: List[str], exclude_idx: int = 2) -> bool:
    """특정 천간이 원국 천간에 투출되어 있는지 (일간 제외)"""
    for i, s in enumerate(stems):
        if i == exclude_idx: continue
        if s == stem: return True
    return False

def classify_geokguk(day_stem: str, month_branch: str, stems: List[str], branches: List[str], verdict: str) -> Dict[str, Any]:
    """
    v3.3 격국 판별:
    1) 건록격/양인격 우선 체크
    2) 월지 본기 → 비겁이면 중기·여기로 이동
    3) 투출 확인 (지장간 중 천간에 드러난 것 우선)
    4) 잡기격(辰戌丑未) 세부 판별
    5) 종격(극왕/극약 시) 체크
    """
    ds_elem = STEM_ELEMENT[day_stem]

    # ── 종격 체크 (극왕/극약·태약) ─────────────
    if verdict in _VERY_WEAK_VERDICTS:
        # 종재격/종살격/종아격 판별 — [v5] get_jijanggan 기반 (순서 의존 제거)
        cnt = {"비겁": 0.0, "식상": 0.0, "재성": 0.0, "관살": 0.0, "인성": 0.0}
        _jj_dw = {"본기": 1.0, "중기": 0.6, "여기": 0.3}
        for s in stems:
            tg = ten_god(day_stem, s)
            cat = _TENGO_CATEGORY.get(tg)
            if cat: cnt[cat] += 1.0
        for b in branches:
            for h, role, _w in get_jijanggan(b):
                dw = _jj_dw.get(role, 0.2)
                tg = ten_god(day_stem, h)
                cat = _TENGO_CATEGORY.get(tg)
                if cat: cnt[cat] += dw
        dominant = max(cnt, key=cnt.get)
        if dominant == "재성" and cnt["재성"] >= 3.0:
            return {"격국": "종재격", "격국_십성": "재성", "월지_본기": None, "격국유형": "종격", "비고": f"{verdict}+재성 압도({cnt['재성']:.1f})→종재격"}
        if dominant == "관살" and cnt["관살"] >= 3.0:
            return {"격국": "종살격", "격국_십성": "관살", "월지_본기": None, "격국유형": "종격", "비고": f"{verdict}+관살 압도({cnt['관살']:.1f})→종살격"}
        if dominant == "식상" and cnt["식상"] >= 3.0:
            return {"격국": "종아격", "격국_십성": "식상", "월지_본기": None, "격국유형": "종격", "비고": f"{verdict}+식상 압도({cnt['식상']:.1f})→종아격"}

    if verdict in _VERY_STRONG_VERDICTS:
        # 원국에 재성/관살/식상이 거의 없으면 종왕격 — [v5] get_jijanggan 기반
        cnt = {"재성": 0.0, "관살": 0.0, "식상": 0.0}
        _jj_dw2 = {"본기": 1.0, "중기": 0.6, "여기": 0.3}
        for s in stems:
            tg = ten_god(day_stem, s)
            cat = _TENGO_CATEGORY.get(tg)
            if cat in cnt: cnt[cat] += 1.0
        for b in branches:
            for h, role, _w in get_jijanggan(b):
                dw = _jj_dw2.get(role, 0.2)
                tg = ten_god(day_stem, h)
                cat = _TENGO_CATEGORY.get(tg)
                if cat in cnt: cnt[cat] += dw
        if sum(cnt.values()) <= 1.5:
            return {"격국": "종왕격", "격국_십성": "비겁", "월지_본기": None, "격국유형": "종격", "비고": f"{verdict}+제극 요소 미약({sum(cnt.values()):.1f})→종왕격"}

    # ── 화격(化格) 체크 ─────────────────────
    # 명리학 원칙: 화격 성립 조건이 매우 엄격함
    # 1) 일간이 인접 천간(월간 or 시간)과 합
    # 2) 합화 오행 = 월지 오행
    # 3) 일간이 신약~중화여야 함 (신강이면 자기 힘이 강해 변화 거부)
    # 4) 합화 오행을 극하는 오행이 천간에 없어야 함 (충극이 있으면 합화 파괴)
    mb_elem = BRANCH_ELEMENT_MAIN.get(month_branch, "")
    day_idx = 2  # stems[2] = 일간
    if verdict not in _STRONG_VERDICTS:  # 신강 이상이면 화격 불성립
        for i, s in enumerate(stems):
            if i == day_idx:
                continue
            if abs(i - day_idx) != 1:  # 인접 천간만 유효 (월간=1, 시간=3)
                continue
            pair = (stems[day_idx], s) if day_idx < i else (s, stems[day_idx])
            hw_elem = _STEM_COMBINE_RESULT.get(pair)
            if not hw_elem:
                hw_elem = _STEM_COMBINE_RESULT.get((s, stems[day_idx]))
            if hw_elem and hw_elem == mb_elem:
                # 합화 오행을 극하는 오행이 천간에 있으면 화격 파괴
                ke_of_hw = {v: k for k, v in KE_MAP.items()}.get(hw_elem, "")
                has_ke = any(
                    STEM_ELEMENT[stems[j]] == ke_of_hw
                    for j in range(4) if j != day_idx and j != i
                )
                if has_ke:
                    continue
                _HWHA_NAME = {"土": "화토격", "金": "화금격", "水": "화수격", "木": "화목격", "火": "화화격"}
                hw_name = _HWHA_NAME.get(hw_elem, f"화{hw_elem}격")
                labels = ["연간", "월간", "일간", "시간"]
                return {
                    "격국": hw_name,
                    "격국_십성": "합화",
                    "월지_본기": None,
                    "격국유형": "화격",
                    "비고": f"일간{stems[day_idx]}+{labels[i]}{s} 합→{hw_elem}화, 월지{month_branch}({mb_elem})=화오행→화격 성립",
                }

    # ── [Fix-15] 일행득기격(一行得氣格) = 외격 체크 ──
    # 방합(方合) 완성 + 일간 오행 = 방합 오행 → 곡직격/염상격/가색격/종혁격/윤하격
    bset = frozenset(branches)
    _ILHAENG_MAP = {
        frozenset(["寅","卯","辰"]): ("木","곡직격(曲直格)"),
        frozenset(["巳","午","未"]): ("火","염상격(炎上格)"),
        frozenset(["申","酉","戌"]): ("金","종혁격(從革格)"),
        frozenset(["亥","子","丑"]): ("水","윤하격(潤下格)"),
    }
    for dirset, (elem, gname) in _ILHAENG_MAP.items():
        if dirset.issubset(bset) and ds_elem == elem:
            return {"격국": gname, "격국_십성": "비견", "월지_본기": None,
                    "격국유형": "외격(일행득기)", "비고": f"방합 {','.join(sorted(dirset))}→{elem} + 일간 {day_stem}({ds_elem})=동일→{gname}"}
    # 토 방합은 辰戌丑未 4지지
    if {"辰","戌","丑","未"}.issubset(bset) and ds_elem == "土":
        return {"격국": "가색격(稼穡格)", "격국_십성": "비견", "월지_본기": None,
                "격국유형": "외격(일행득기)", "비고": "辰戌丑未 전부+일간 土→가색격"}

    # ── 건록격/양인격 우선 체크 ────────────────
    if month_branch == LUXING.get(day_stem):
        return {"격국": "건록격", "격국_십성": "비견", "월지_본기": day_stem, "격국유형": "특수격", "비고": "월지가 일간의 록(祿)"}
    if month_branch == YANGREN.get(day_stem):
        return {"격국": "양인격", "격국_십성": "겁재", "월지_본기": None, "격국유형": "특수격", "비고": "월지가 일간의 양인(羊刃)"}

    # ── 월지 지장간 탐색 ─────────────────────
    # 격국 결정은 본기 우선이므로 get_jijanggan (본기→중기→여기)을 직접 사용
    jjg_items = get_jijanggan(month_branch)
    hidden_bongi_first = [stem for stem, _role, _w in jjg_items]
    hidden_display = _hidden_stems_by_role(month_branch)
    if not hidden_bongi_first:
        return {"격국": "불명", "격국_십성": "?", "월지_본기": None, "격국유형": "불명", "비고": "월지 지장간 없음"}

    _TG_TO_GEOK = {
        "비견": None, "겁재": None, # 비겁은 격국 불가 → 다음 지장간
        "식신": "식신격", "상관": "상관격",
        "편재": "편재격", "정재": "정재격",
        "편관": "편관격", "정관": "정관격",
        "편인": "편인격", "정인": "정인격",
    }

    # 투출 우선: 지장간 중 천간에 드러난 것
    for h in hidden_bongi_first:
        if _is_stem_in_pillars(h, stems):
            tg = ten_god(day_stem, h)
            geok = _TG_TO_GEOK.get(tg)
            if geok:
                return {"격국": geok, "격국_십성": tg, "월지_본기": h, "격국유형": "정격(투출)", "비고": f"월지 지장간 {h}이 천간에 투출"}

    # ── [Fix-15] 잡기격(雜氣格) 판별: 辰戌丑未 월지 ──
    _JAPGI_BRANCHES = {"辰", "戌", "丑", "未"}
    if month_branch in _JAPGI_BRANCHES:
        for h in hidden_bongi_first:
            if _is_stem_in_pillars(h, stems):
                tg = ten_god(day_stem, h)
                geok = _TG_TO_GEOK.get(tg)
                if geok:
                    return {"격국": geok, "격국_십성": tg, "월지_본기": h,
                            "격국유형": "잡기격(투출)", "비고": f"잡기격: 월지 {month_branch}({','.join(hidden_display)}) 중 {h} 투출→{geok}"}
        for h in hidden_bongi_first:
            tg = ten_god(day_stem, h)
            geok = _TG_TO_GEOK.get(tg)
            if geok:
                return {"격국": geok, "격국_십성": tg, "월지_본기": h,
                        "격국유형": "잡기격", "비고": f"잡기격: 월지 {month_branch}({','.join(hidden_display)}) 지장간 순서→{geok}"}

    # 투출 없으면 본기→중기→여기 순서
    for h in hidden_bongi_first:
        tg = ten_god(day_stem, h)
        geok = _TG_TO_GEOK.get(tg)
        if geok:
            return {"격국": geok, "격국_십성": tg, "월지_본기": h, "격국유형": "정격", "비고": f"월지 지장간 {h} (본기/중기/여기 순)"}

    # 전부 비겁이면 → 건록격 변형
    return {"격국": "비겁격", "격국_십성": "비견", "월지_본기": hidden_bongi_first[0], "격국유형": "변격", "비고": "월지 지장간 전체가 비겁"}


# ── 9-2: 조후용신 테이블 ─────────────────────

# 일간(10) × 월지(12) → 조후용신 (전통 명리학 적천수/궁통보감 기반)

# 값: (주용신오행, 보조용신오행)

_JOHU_TABLE = {
    # 甲木
    ("甲","寅"): ("火","水"), ("甲","卯"): ("火","金"), ("甲","辰"): ("火","水"),
    ("甲","巳"): ("水","金"), ("甲","午"): ("水","金"), ("甲","未"): ("水","金"),
    ("甲","申"): ("火","水"), ("甲","酉"): ("火","水"), ("甲","戌"): ("火","水"),
    ("甲","亥"): ("火","土"), ("甲","子"): ("火","土"), ("甲","丑"): ("火","土"),
    # 乙木
    ("乙","寅"): ("火","水"), ("乙","卯"): ("火","水"), ("乙","辰"): ("火","水"),
    ("乙","巳"): ("水","金"), ("乙","午"): ("水","金"), ("乙","未"): ("水","金"),
    ("乙","申"): ("火","水"), ("乙","酉"): ("火","水"), ("乙","戌"): ("火","水"),
    ("乙","亥"): ("火","土"), ("乙","子"): ("火","土"), ("乙","丑"): ("火","土"),
    # 丙火
    ("丙","寅"): ("木","水"), ("丙","卯"): ("木","水"), ("丙","辰"): ("木","水"),
    ("丙","巳"): ("水","金"), ("丙","午"): ("水","金"), ("丙","未"): ("水","土"),
    ("丙","申"): ("木","水"), ("丙","酉"): ("木","水"), ("丙","戌"): ("木","水"),
    ("丙","亥"): ("木","火"), ("丙","子"): ("木","火"), ("丙","丑"): ("木","火"),
    # 丁火
    ("丁","寅"): ("木","水"), ("丁","卯"): ("木","水"), ("丁","辰"): ("木","水"),
    ("丁","巳"): ("水","金"), ("丁","午"): ("水","金"), ("丁","未"): ("水","金"),
    ("丁","申"): ("木","火"), ("丁","酉"): ("木","火"), ("丁","戌"): ("木","火"),
    ("丁","亥"): ("木","火"), ("丁","子"): ("木","火"), ("丁","丑"): ("木","火"),
    # 戊土
    ("戊","寅"): ("火","木"), ("戊","卯"): ("火","水"), ("戊","辰"): ("火","水"),
    ("戊","巳"): ("水","金"), ("戊","午"): ("水","金"), ("戊","未"): ("水","木"),
    ("戊","申"): ("火","水"), ("戊","酉"): ("火","水"), ("戊","戌"): ("火","水"),
    ("戊","亥"): ("火","木"), ("戊","子"): ("火","木"), ("戊","丑"): ("火","木"),
    # 己土
    ("己","寅"): ("火","木"), ("己","卯"): ("火","水"), ("己","辰"): ("火","水"),
    ("己","巳"): ("水","金"), ("己","午"): ("水","金"), ("己","未"): ("水","金"),
    ("己","申"): ("火","水"), ("己","酉"): ("火","水"), ("己","戌"): ("火","水"),
    ("己","亥"): ("火","木"), ("己","子"): ("火","木"), ("己","丑"): ("火","木"),
    # 庚金
    ("庚","寅"): ("土","火"), ("庚","卯"): ("土","火"), ("庚","辰"): ("土","水"),
    ("庚","巳"): ("水","土"), ("庚","午"): ("水","土"), ("庚","未"): ("水","土"),
    ("庚","申"): ("火","木"), ("庚","酉"): ("火","木"), ("庚","戌"): ("火","土"),
    ("庚","亥"): ("土","火"), ("庚","子"): ("土","火"), ("庚","丑"): ("土","火"),
    # 辛金
    ("辛","寅"): ("土","水"), ("辛","卯"): ("土","水"), ("辛","辰"): ("土","水"),
    ("辛","巳"): ("水","土"), ("辛","午"): ("水","火"), ("辛","未"): ("水","土"),
    ("辛","申"): ("火","水"), ("辛","酉"): ("火","水"), ("辛","戌"): ("火","水"),
    ("辛","亥"): ("土","火"), ("辛","子"): ("土","火"), ("辛","丑"): ("土","火"),
    # 壬水
    ("壬","寅"): ("火","木"), ("壬","卯"): ("火","金"), ("壬","辰"): ("火","土"),
    ("壬","巳"): ("金","火"), ("壬","午"): ("金","火"), ("壬","未"): ("金","火"),
    ("壬","申"): ("火","土"), ("壬","酉"): ("火","土"), ("壬","戌"): ("火","土"),
    ("壬","亥"): ("火","木"), ("壬","子"): ("火","木"), ("壬","丑"): ("火","木"),
    # 癸水
    ("癸","寅"): ("火","金"), ("癸","卯"): ("火","金"), ("癸","辰"): ("火","土"),
    ("癸","巳"): ("金","火"), ("癸","午"): ("金","火"), ("癸","未"): ("金","水"),
    ("癸","申"): ("火","土"), ("癸","酉"): ("火","土"), ("癸","戌"): ("火","土"),
    ("癸","亥"): ("火","木"), ("癸","子"): ("火","木"), ("癸","丑"): ("火","木"),
}

# ── 9-3: 통관용신 판별 ──────────────────────

def _find_tonggwan(stems: List[str], branches: List[str], day_stem: str) -> Optional[str]:
    """원국에서 상극 대립이 강할 때, 중간 오행(통관)을 찾는다"""
    de = STEM_ELEMENT[day_stem]
    cnt = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}
    for s in stems:
        cnt[STEM_ELEMENT[s]] += 1
    for b in branches:
        cnt[BRANCH_ELEMENT_MAIN[b]] += 1

    # 일간 오행을 극하는 오행(관살)이 2개 이상이면 통관 필요
    ke_elem = None
    for e, k in KE_MAP.items():
        if k == de: # e가 de를 극함 → e가 관살
            ke_elem = e; break
    if ke_elem and cnt.get(ke_elem, 0) >= 2:
        # 통관 = 관살 오행이 생하는 오행 (관살→식상 of 관살)
        tonggwan = GEN_MAP.get(ke_elem)
        return tonggwan
    return None

# ── 9-4: 합화 판정 ──────────────────────────

_STEM_COMBINE_RESULT = {
    ("甲","己"): "土", ("己","甲"): "土",
    ("乙","庚"): "金", ("庚","乙"): "金",
    ("丙","辛"): "水", ("辛","丙"): "水",
    ("丁","壬"): "木", ("壬","丁"): "木",
    ("戊","癸"): "火", ("癸","戊"): "火",
}

def _check_hapwha(stems: List[str], month_branch: str) -> List[Dict[str, Any]]:
    """천간합이 실제로 화(化)하는지 판정. 월지 오행이 합화 결과와 같아야 화 성립."""
    results = []
    mb_elem = BRANCH_ELEMENT_MAIN.get(month_branch, "")
    labels = ["연간", "월간", "일간", "시간"]
    for i in range(4):
        for j in range(i + 1, 4):
            pair = (stems[i], stems[j])
            hw_elem = _STEM_COMBINE_RESULT.get(pair)
            if hw_elem:
                is_hwha = (hw_elem == mb_elem)
                results.append({
                    "합": f"{labels[i]}{stems[i]}-{labels[j]}{stems[j]}",
                    "합화오행": hw_elem,
                    "화성립": is_hwha,
                    "상태": "합화(化)" if is_hwha else "합거(拘)",
                    "비고": f"월지 {month_branch}({mb_elem}){'=합화오행→화 성립' if is_hwha else '≠합화오행→합만 되고 변화 안됨'}"
                })
    return results

# ── 9-5: 형충 해소 판정 ─────────────────────

def _check_clash_resolution(branches: List[str]) -> List[Dict[str, Any]]:
    """삼합이 충/형을 풀어주는 경우 체크"""
    resolutions = []
    bset = set(branches)
    labels = ["연지", "월지", "일지", "시지"]

    for i in range(4):
        for j in range(i + 1, 4):
            bi, bj = branches[i], branches[j]
            if (bi, bj) in BRANCH_CLASH:
                # 충이 있는 경우 → 삼합의 나머지 하나가 있으면 해소 가능
                for tset, tname in TRINE_SETS.items():
                    if bi in tset and bj in tset:
                        third = (tset - {bi, bj})
                        if third.issubset(bset):
                            resolutions.append({
                                "유형": "충해소",
                                "충": f"{labels[i]}{bi}↯{labels[j]}{bj}",
                                "해소근거": f"삼합({tname}) 완성으로 충이 약화",
                            })
    return resolutions

# ── 9-5b: 조후 민감도 평가 ─────────────────────

# 계절의 한서(寒暑) 극단성: 한겨울/한여름일수록 조후가 중요
_SEASON_EXTREMITY = {
    "子": 1.0, "丑": 0.8,  # 겨울 (한)
    "亥": 0.8,
    "午": 1.0, "未": 0.8,  # 여름 (서)
    "巳": 0.8,
    "寅": 0.4, "卯": 0.3,  # 봄 (온)
    "辰": 0.2,
    "申": 0.4, "酉": 0.3,  # 가을 (량)
    "戌": 0.2,
}

# 일간과 계절의 조후 필요도 가중치 (한(寒)간이 한월이면 ↑, 서(暑)간이 서월이면 ↑)
_STEM_SEASON_NEED = {
    ("壬","子"):0.3, ("壬","丑"):0.3, ("壬","亥"):0.2,  # 수일간 + 겨울 → 과한
    ("癸","子"):0.3, ("癸","丑"):0.3, ("癸","亥"):0.2,
    ("丙","午"):0.3, ("丙","巳"):0.2, ("丙","未"):0.2,  # 화일간 + 여름 → 과한
    ("丁","午"):0.3, ("丁","巳"):0.2, ("丁","未"):0.2,
    ("甲","寅"):0.1, ("甲","卯"):0.1,  # 목일간 + 봄 → 약간 과한
    ("乙","寅"):0.1, ("乙","卯"):0.1,
    ("庚","申"):0.1, ("庚","酉"):0.1,  # 금일간 + 가을 → 약간 과한
    ("辛","申"):0.1, ("辛","酉"):0.1,
}

def _johu_importance_score(day_stem: str, month_branch: str,
                           stems: List[str], branches: List[str]) -> float:
    """
    조후 민감도 점수 (0.0 ~ 2.0+).
    높을수록 조후용신이 중요한 명식.
    """
    score = 0.0
    # (1) 월지의 계절 극단성
    score += _SEASON_EXTREMITY.get(month_branch, 0.2)
    # (2) 일간-월지 조합의 한서 필요도
    score += _STEM_SEASON_NEED.get((day_stem, month_branch), 0.0)
    # (3) 원국 내 조후 오행 부족 여부
    johu_pair = _JOHU_TABLE.get((day_stem, month_branch))
    if johu_pair:
        johu_elem = johu_pair[0]
        cnt = sum(1 for s in stems if STEM_ELEMENT[s] == johu_elem)
        cnt += sum(0.5 for b in branches if BRANCH_ELEMENT_MAIN[b] == johu_elem)
        if cnt == 0:
            score += 0.5  # 조후 오행이 원국에 전혀 없으면 ↑
        elif cnt <= 1:
            score += 0.2  # 희소하면 ↑
    return round(score, 2)

JOHU_OVERRIDE_THRESHOLD = 1.2  # 이 이상이면 조후가 억부를 대체

# ── 9-5c: 병인 진단 ──────────────────────────
# 명리학 원칙: 용신은 "부족 오행"이 아니라 "사주의 가장 큰 병(불균형)을 해결하는 오행"이다.
# 병인을 먼저 정의한 뒤 해결 오행을 선택해야 정확한 용신이 나온다.

_HANNANJOSEUP = {
    "寅": "온", "卯": "온", "辰": "온습",
    "巳": "서", "午": "서조", "未": "서습",
    "申": "량", "酉": "량조", "戌": "조",
    "亥": "한", "子": "한습", "丑": "한습",
}

def _diagnose_disease(
    day_stem: str,
    month_branch: str,
    stems: List[str],
    branches: List[str],
    verdict: str,
    tmap: Dict[str, str],
) -> Dict[str, Any]:
    """
    원국의 '가장 큰 병(불균형)'을 진단한다.
    반환: {
      "primary": {"병인": str, "병인_오행": str, "유형": "과다"|"부족"|"한서"|"극전쟁", "시급도": float},
      "secondary": {...} | None,
      "한난조습": str,
      "조후_시급도": float,  # 0.0~1.0
      "억부_시급도": float,  # 0.0~1.0
      "십성분포": Dict[str, float],
    }
    """
    de = STEM_ELEMENT[day_stem]
    inv_gen = {v: k for k, v in GEN_MAP.items()}

    # ── 오행 분포(지장간 가중치 포함) ──────────
    ohang_cnt: Dict[str, float] = {"木": 0.0, "火": 0.0, "土": 0.0, "金": 0.0, "水": 0.0}
    for s in stems:
        ohang_cnt[STEM_ELEMENT[s]] += 1.0
    for b in branches:
        _add_branch_weighted_elements(ohang_cnt, b, scale=1.0)
    total_oh = sum(ohang_cnt.values())
    avg_oh = total_oh / 5.0

    # ── 십성 분포(가중) ─────────────────────
    cat_cnt: Dict[str, float] = {"비겁": 0.0, "식상": 0.0, "재성": 0.0, "관살": 0.0, "인성": 0.0}
    _jj_dw = {"본기": 1.0, "중기": 0.6, "여기": 0.3}
    for i, s in enumerate(stems):
        if i == 2:
            cat_cnt["비겁"] += 1.0
            continue
        tg = ten_god(day_stem, s)
        cat = _TENGO_CATEGORY.get(tg)
        if cat:
            cat_cnt[cat] += 1.0
    for b in branches:
        for h, role, _w in get_jijanggan(b):
            dw = _jj_dw.get(role, 0.2)
            tg = ten_god(day_stem, h)
            cat = _TENGO_CATEGORY.get(tg)
            if cat:
                cat_cnt[cat] += dw

    # ── 한난조습 진단 ──────────────────────
    climate = _HANNANJOSEUP.get(month_branch, "온")
    fire_total = ohang_cnt["火"]
    water_total = ohang_cnt["水"]
    johu_urgency = 0.0
    if "한" in climate:
        johu_urgency = 0.3 + max(0, water_total - fire_total) * 0.15
        if fire_total < 0.5:
            johu_urgency += 0.3
    elif "서" in climate:
        johu_urgency = 0.3 + max(0, fire_total - water_total) * 0.15
        if water_total < 0.5:
            johu_urgency += 0.3
    elif "조" in climate:
        johu_urgency = 0.15 + max(0, (fire_total + ohang_cnt["土"]) - water_total * 2) * 0.1
    elif "습" in climate:
        johu_urgency = 0.15 + max(0, water_total - fire_total) * 0.1
    johu_urgency = min(1.0, round(johu_urgency, 2))

    # ── 억부 시급도 ──────────────────────
    _VERDICT_URGENCY = {
        "극왕": 1.0, "태강": 0.8, "신강": 0.5,
        "중화신강": 0.15, "중화신약": 0.15,
        "신약": 0.5, "태약": 0.8, "극약": 1.0,
    }
    eokbu_urgency = _VERDICT_URGENCY.get(verdict, 0.3)

    # ── 십성 과다/부족 병인 탐색 ───────────
    diseases: List[Dict[str, Any]] = []

    bigyeop = cat_cnt["비겁"] + cat_cnt["인성"]  # 일간 편 세력
    seol_gi = cat_cnt["식상"] + cat_cnt["재성"] + cat_cnt["관살"]  # 반대 세력

    for cat_name in ("비겁", "인성", "식상", "재성", "관살"):
        val = cat_cnt[cat_name]
        elem = tmap[cat_name]
        if val >= 3.5:
            diseases.append({"병인": f"{cat_name}과다", "병인_오행": elem,
                             "유형": "과다", "시급도": round(0.5 + (val - 3.5) * 0.2, 2)})
        elif val >= 2.5 and ohang_cnt[elem] >= avg_oh * 1.6:
            diseases.append({"병인": f"{cat_name}과다", "병인_오행": elem,
                             "유형": "과다", "시급도": round(0.3 + (val - 2.5) * 0.2, 2)})

    # 관살 과다 → 일간 피극이 핵심 병인
    if cat_cnt["관살"] >= 2.0 and verdict in _WEAK_VERDICTS:
        urg = 0.6 + (cat_cnt["관살"] - 2.0) * 0.2
        diseases.append({"병인": "관살과다+신약", "병인_오행": tmap["관살"],
                         "유형": "극전쟁", "시급도": round(min(1.0, urg), 2)})

    # 인성 과다 → 일간 과보호/설기 부족
    if cat_cnt["인성"] >= 2.5 and verdict in _STRONG_VERDICTS:
        urg = 0.5 + (cat_cnt["인성"] - 2.5) * 0.2
        diseases.append({"병인": "인성과다+신강", "병인_오행": tmap["인성"],
                         "유형": "과다", "시급도": round(min(1.0, urg), 2)})

    # 비겁 과다 (신강인데 비겁이 많으면 식상/재성으로 빼야)
    # 극왕/태강은 비겁 임계값을 낮춤 (이미 세력이 과도하다고 판정됨)
    bigyeop_threshold = 2.0 if verdict in _VERY_STRONG_VERDICTS else 3.0
    if cat_cnt["비겁"] >= bigyeop_threshold and verdict in _STRONG_VERDICTS:
        urg = 0.4 + (cat_cnt["비겁"] - bigyeop_threshold) * 0.2
        if verdict in _VERY_STRONG_VERDICTS:
            urg = max(urg, 0.6)
        diseases.append({"병인": "비겁과다", "병인_오행": de,
                         "유형": "과다", "시급도": round(min(1.0, urg), 2)})

    # 상극 대립 병인 (통관 필요)
    # 관살과 비겁이 모두 강하면 양측이 격돌 → 통관이 병인 해결
    ke_of_de = {v: k for k, v in KE_MAP.items()}.get(de, "")  # 일간을 극하는 오행 = 관살 오행
    if ke_of_de:
        gwansal_power = ohang_cnt.get(ke_of_de, 0)
        bigyeop_power = ohang_cnt.get(de, 0)
        if gwansal_power >= 1.8 and bigyeop_power >= 1.8:
            clash_intensity = min(gwansal_power, bigyeop_power) * 0.3
            tonggwan_elem = GEN_MAP.get(ke_of_de, "")  # 관살이 생하는 오행 = 통관
            if tonggwan_elem:
                diseases.append({
                    "병인": f"상극대립({ke_of_de}↔{de})",
                    "병인_오행": tonggwan_elem,
                    "유형": "통관필요",
                    "시급도": round(min(1.0, 0.3 + clash_intensity), 2)
                })

    # 한서 병인
    if johu_urgency >= 0.5:
        if "한" in climate:
            diseases.append({"병인": "한(寒)", "병인_오행": "水",
                             "유형": "한서", "시급도": johu_urgency})
        elif "서" in climate:
            diseases.append({"병인": "서(暑)", "병인_오행": "火",
                             "유형": "한서", "시급도": johu_urgency})
        elif "조" in climate:
            diseases.append({"병인": "조(燥)", "병인_오행": "火",
                             "유형": "한서", "시급도": johu_urgency})

    # 한서 병인이 시급하면 최우선 (명리학 원칙: 조후가 가장 시급하면 다른 모든 것에 우선)
    # 그 외에는 시급도 순 정렬
    def _disease_priority(d):
        priority = d["시급도"]
        if d["유형"] == "한서" and priority >= 0.5:
            priority += 1.0  # 한서 최우선 부스트
        return priority
    diseases.sort(key=_disease_priority, reverse=True)

    primary = diseases[0] if diseases else {
        "병인": "경미불균형", "병인_오행": "",
        "유형": "약함", "시급도": 0.1
    }
    secondary = diseases[1] if len(diseases) >= 2 else None

    return {
        "primary": primary,
        "secondary": secondary,
        "한난조습": climate,
        "조후_시급도": johu_urgency,
        "억부_시급도": eokbu_urgency,
        "십성분포": {k: round(v, 2) for k, v in cat_cnt.items()},
        "오행분포_raw": {k: round(v, 2) for k, v in ohang_cnt.items()},
    }


# 병인으로부터 용신/희신/기신 오행을 동적 도출
def _resolve_disease(
    disease: Dict[str, Any],
    day_stem: str,
    month_branch: str,
    tmap: Dict[str, str],
    verdict: str,
    cat_cnt: Dict[str, float],
) -> Dict[str, Any]:
    """
    병인을 해결하는 용신/희신/기신 카테고리를 반환.
    반환: {"용신_cat": str, "용신_오행": str,
           "희신_cat": [str], "기신_cat": [str],
           "비고": str}
    """
    de = STEM_ELEMENT[day_stem]
    byungin = disease["병인"]
    byungin_elem = disease["병인_오행"]
    byungin_type = disease["유형"]

    # 과다 병인의 해결 오행 → 극하거나 설기하는 카테고리
    if byungin_type == "과다":
        if "인성과다" in byungin:
            # 인성(나를 생하는 오행)이 과다 → 재성(인성을 극)으로 제어 + 식상(설기)이 희신
            return {"용신_cat": "재성", "용신_오행": tmap["재성"],
                    "희신_cat": ["식상"], "기신_cat": ["인성"],
                    "비고": f"병인:{byungin}→재성으로 인성 극제"}
        if "관살과다" in byungin:
            # 관살 과다 → 인성(화살, 관살 에너지를 흡수해 나를 생) 또는 식상(제살)
            if cat_cnt.get("인성", 0) >= 1.0:
                return {"용신_cat": "인성", "용신_오행": tmap["인성"],
                        "희신_cat": ["비겁"], "기신_cat": ["재성", "관살"],
                        "비고": f"병인:{byungin}→인성으로 화살(化殺)"}
            else:
                return {"용신_cat": "식상", "용신_오행": tmap["식상"],
                        "희신_cat": ["비겁"], "기신_cat": ["재성"],
                        "비고": f"병인:{byungin}→식상으로 제살(制殺)"}
        if "비겁과다" in byungin:
            # 비겁 과다 → 관살(극비겁) 또는 식상(설비겁)
            if cat_cnt.get("관살", 0) >= 1.0:
                return {"용신_cat": "관살", "용신_오행": tmap["관살"],
                        "희신_cat": ["재성"], "기신_cat": ["인성", "비겁"],
                        "비고": f"병인:{byungin}→관살로 비겁 제어"}
            else:
                return {"용신_cat": "식상", "용신_오행": tmap["식상"],
                        "희신_cat": ["재성"], "기신_cat": ["인성"],
                        "비고": f"병인:{byungin}→식상으로 설기"}
        if "식상과다" in byungin:
            return {"용신_cat": "인성", "용신_오행": tmap["인성"],
                    "희신_cat": ["비겁"], "기신_cat": ["식상"],
                    "비고": f"병인:{byungin}→인성으로 식상 극제"}
        if "재성과다" in byungin:
            return {"용신_cat": "비겁", "용신_오행": tmap["비겁"],
                    "희신_cat": ["인성"], "기신_cat": ["재성"],
                    "비고": f"병인:{byungin}→비겁으로 분재(分財)"}

    if byungin_type == "극전쟁":
        # 관살+신약 → 인성 화살(化殺)이 최선
        return {"용신_cat": "인성", "용신_오행": tmap["인성"],
                "희신_cat": ["비겁"], "기신_cat": ["재성", "관살"],
                "비고": f"병인:{byungin}→인성으로 화살·신약 보강"}

    if byungin_type == "통관필요":
        # 상극 대립 → 통관 오행이 용신 (병인_오행이 이미 통관 오행)
        tonggwan_e = byungin_elem
        tg_cat = ""
        for cat, e in tmap.items():
            if e == tonggwan_e:
                tg_cat = cat
                break
        # 희신 = 통관이 생하는 오행 (용신의 수혜측)
        gen_of_tg = GEN_MAP.get(tonggwan_e, "")
        hui_cat = ""
        for cat, e in tmap.items():
            if e == gen_of_tg:
                hui_cat = cat
                break
        # 기신 = 용신을 극하는 오행 + 대립의 공격측
        ke_inv_tg = {v: k for k, v in KE_MAP.items()}
        gi_cats = []
        # 1) 용신을 극하는 오행
        ke_of_yong = ke_inv_tg.get(tonggwan_e, "")
        if ke_of_yong:
            for cat, e in tmap.items():
                if e == ke_of_yong:
                    gi_cats.append(cat)
                    break
        # 2) 대립의 공격측(관살 오행) — 용신/희신이 아닌 경우만
        de_local = STEM_ELEMENT[day_stem]
        ke_of_de = ke_inv_tg.get(de_local, "")
        if ke_of_de and ke_of_de != tonggwan_e and ke_of_de != gen_of_tg:
            for cat, e in tmap.items():
                if e == ke_of_de and cat not in gi_cats:
                    gi_cats.append(cat)
                    break
        return {"용신_cat": tg_cat or "통관", "용신_오행": tonggwan_e,
                "희신_cat": [hui_cat] if hui_cat else [],
                "기신_cat": gi_cats,
                "비고": f"병인:{byungin}→통관용신({tonggwan_e})"}

    if byungin_type == "한서":
        # 한/서/조 → 조후 오행
        johu_pair = _JOHU_TABLE.get((day_stem, month_branch))
        if johu_pair:
            johu_elem = johu_pair[0]
            johu_cat = ""
            for cat, e in tmap.items():
                if e == johu_elem:
                    johu_cat = cat
                    break
            gi_elem = {v: k for k, v in KE_MAP.items()}.get(johu_elem, "")
            gi_cat = ""
            for cat, e in tmap.items():
                if e == gi_elem:
                    gi_cat = cat
                    break
            return {"용신_cat": johu_cat or "조후", "용신_오행": johu_elem,
                    "희신_cat": [], "기신_cat": [gi_cat] if gi_cat else [],
                    "비고": f"병인:{byungin}→조후용신({johu_elem})"}

    # fallback
    return None


# ── 9-6: 종합 용신 판별 ─────────────────────

def determine_yongshin(geok_info: Dict, verdict: str, day_stem: str,
                       month_branch: str, stems: List[str],
                       branches: List[str]) -> Dict[str, Any]:
    """
    v6 용신 판별 — 병인 진단 기반:
    1) 종격/화격/외격이면 전용 용신
    2) 병인 진단 → 가장 큰 병을 해결하는 오행 = 용신
    3) 억부 테이블은 fallback
    4) 조후 전환은 병인 시급도 비교로 결정
    5) 통관용신은 보조 희신으로 편입
    """
    tmap = day_tengo_ohaeng(day_stem)
    geok = geok_info["격국"]
    geok_type = geok_info.get("격국유형", "정격")

    def _cat_label(cat: str) -> str:
        LABELS = {
            "비겁": "비겁(비견·겁재)", "식상": "식상(식신·상관)",
            "재성": "재성(편재·정재)", "관살": "관살(편관·정관)",
            "인성": "인성(편인·정인)",
        }
        return f"{LABELS.get(cat, cat)}/{tmap.get(cat, '?')}"

    def _add_gushin(res):
        """기신 오행으로부터 구신(仇神) 오행 도출: 기신을 생하는 오행 (기신/용신/희신과 중복 제거)"""
        gi_es = res.get("기신_오행", [])
        gu_es = list({GEN_INV.get(e, "") for e in gi_es if e in GEN_INV} - {""})
        yong_e = res.get("용신_오행", "")
        hee_es = set(res.get("희신_오행", []))
        gi_set = set(gi_es)
        gu_es = [e for e in gu_es if e != yong_e and e not in hee_es and e not in gi_set]
        res["구신_오행"] = gu_es
        return res

    result = {
        "격국유형": geok_type,
        "합화정보": _check_hapwha(stems, month_branch),
        "형충해소": _check_clash_resolution(branches),
    }

    # ── 종격 용신 ────────────────────────────
    if geok_type == "종격":
        if geok == "종재격":
            result.update({
                "용신": _cat_label("재성"), "용신_오행": tmap["재성"],
                "희신": [_cat_label("식상")], "희신_오행": [tmap["식상"]],
                "기신": [_cat_label("비겁"), _cat_label("인성")],
                "기신_오행": [tmap["비겁"], tmap["인성"]],
                "비고": "종재격: 재성을 따라가는 사주, 비겁·인성이 오면 격파",
                "용신체계": "종격전용",
            })
            return _add_gushin(result)
        if geok == "종살격":
            result.update({
                "용신": _cat_label("관살"), "용신_오행": tmap["관살"],
                "희신": [_cat_label("재성")], "희신_오행": [tmap["재성"]],
                "기신": [_cat_label("비겁"), _cat_label("인성")],
                "기신_오행": [tmap["비겁"], tmap["인성"]],
                "비고": "종살격: 관살을 따라가는 사주, 비겁·인성이 오면 격파",
                "용신체계": "종격전용",
            })
            return _add_gushin(result)
        if geok == "종아격":
            result.update({
                "용신": _cat_label("식상"), "용신_오행": tmap["식상"],
                "희신": [_cat_label("재성")], "희신_오행": [tmap["재성"]],
                "기신": [_cat_label("인성"), _cat_label("관살")],
                "기신_오행": [tmap["인성"], tmap["관살"]],
                "비고": "종아격: 식상을 따라가는 사주, 인성·관살이 오면 격파",
                "용신체계": "종격전용",
            })
            return _add_gushin(result)
        if geok == "종왕격":
            result.update({
                "용신": _cat_label("비겁"), "용신_오행": tmap["비겁"],
                "희신": [_cat_label("인성")], "희신_오행": [tmap["인성"]],
                "기신": [_cat_label("관살"), _cat_label("재성")],
                "기신_오행": [tmap["관살"], tmap["재성"]],
                "비고": "종왕격: 비겁이 압도적, 관살·재성이 오면 위험",
                "용신체계": "종격전용",
            })
            return _add_gushin(result)

    # ── 화격 용신 ─────────────────────────────
    if geok_type == "화격":
        hw_elem = geok_info.get("비고", "")
        _GEOK_TO_ELEM = {"화토격": "土", "화금격": "金", "화수격": "水", "화목격": "木", "화화격": "火"}
        hw_ohaeng = _GEOK_TO_ELEM.get(geok, "")
        if hw_ohaeng:
            gen_inv = {v: k for k, v in GEN_MAP.items()}
            ke_inv = {v: k for k, v in KE_MAP.items()}
            hui_elem = gen_inv.get(hw_ohaeng, "")
            gi_elem = ke_inv.get(hw_ohaeng, "")
            result.update({
                "용신": f"합화오행({hw_ohaeng})", "용신_오행": hw_ohaeng,
                "희신": [f"생화오행({hui_elem})"] if hui_elem else [],
                "희신_오행": [hui_elem] if hui_elem else [],
                "기신": [f"극화오행({gi_elem})"] if gi_elem else [],
                "기신_오행": [gi_elem] if gi_elem else [],
                "비고": f"화격: {geok} — 합화 오행({hw_ohaeng})의 기운을 따르는 사주",
                "용신체계": "화격전용",
                "판정확신도": "높음(화격 성립)",
            })
            return _add_gushin(result)

    # ── [Fix-15] 외격(일행득기) 용신 ──────────
    if geok_type.startswith("외격"):
        _ILHAENG_YONG = {
            "곡직격(曲直格)": {"용신":"비겁","희신":["인성"],"기신":["관살","재성"]},
            "염상격(炎上格)": {"용신":"비겁","희신":["인성"],"기신":["관살","재성"]},
            "가색격(稼穡格)": {"용신":"비겁","희신":["인성"],"기신":["관살"]},
            "종혁격(從革格)": {"용신":"비겁","희신":["인성"],"기신":["관살","재성"]},
            "윤하격(潤下格)": {"용신":"비겁","희신":["인성"],"기신":["재성"]},
        }
        irow = _ILHAENG_YONG.get(geok, {"용신":"비겁","희신":["인성"],"기신":["관살"]})
        result.update({
            "용신": _cat_label(irow["용신"]), "용신_오행": tmap.get(irow["용신"],"?"),
            "희신": [_cat_label(h) for h in irow["희신"]], "희신_오행": [tmap.get(h,"?") for h in irow["희신"]],
            "기신": [_cat_label(g) for g in irow["기신"]], "기신_오행": [tmap.get(g,"?") for g in irow["기신"]],
            "비고": f"외격({geok}): 일행득기→비겁(같은 오행)이 용신, 극하는 오행이 기신",
            "용신체계": "외격전용",
        })
        return _add_gushin(result)

    # ── 병인 진단 ────────────────────────────
    diag = _diagnose_disease(day_stem, month_branch, stems, branches, verdict, tmap)
    result["병인진단"] = diag

    # ── 억부용신 (fallback 테이블) ──────────
    STRONG_TABLE = {
        "식신격": {"용신": "식상", "희신": ["재성"], "기신": ["인성", "비겁"]},
        "상관격": {"용신": "재성", "희신": ["관살"], "기신": ["비겁"]},
        "편재격": {"용신": "식상", "희신": ["관살"], "기신": ["비겁"]},
        "정재격": {"용신": "식상", "희신": ["관살"], "기신": ["비겁"]},
        "편관격": {"용신": "인성", "희신": ["식상"], "기신": ["재성"]},
        "정관격": {"용신": "인성", "희신": ["재성"], "기신": ["식상"]},
        "편인격": {"용신": "재성", "희신": ["관살"], "기신": ["식상"]},
        "정인격": {"용신": "재성", "희신": ["관살"], "기신": ["식상"]},
        "비겁격": {"용신": "식상", "희신": ["재성"], "기신": ["인성"]},
        "건록격": {"용신": "식상", "희신": ["재성"], "기신": ["인성"]},
        "양인격": {"용신": "관살", "희신": ["인성"], "기신": ["비겁"]},
    }
    WEAK_TABLE = {
        "식신격": {"용신": "비겁", "희신": ["인성"], "기신": ["관살"]},
        "상관격": {"용신": "인성", "희신": ["비겁"], "기신": ["관살"]},
        "편재격": {"용신": "비겁", "희신": ["인성"], "기신": ["관살"]},
        "정재격": {"용신": "비겁", "희신": ["인성"], "기신": ["관살"]},
        "편관격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성"]},
        "정관격": {"용신": "인성", "희신": ["비겁"], "기신": ["식상"]},
        # v6.1: 편인격/정인격 + 신약 → 인성이 격국 주성이자 일간 생조 → 인성이 용신
        "편인격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성", "식상"]},
        "정인격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성", "식상"]},
        "비겁격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성"]},
        "건록격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성"]},
        "양인격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성"]},
    }

    # v6.1: 중화 판정에서도 격국 기반 방향성 제공 (조후 미적용 fallback용)
    # 격국의 주성(격신)을 용신으로 → 격국 유지 방향
    NEUTRAL_TABLE = {
        "식신격": {"용신": "식상", "희신": ["재성"], "기신": ["인성"]},
        "상관격": {"용신": "식상", "희신": ["재성"], "기신": ["인성"]},
        "편재격": {"용신": "재성", "희신": ["식상"], "기신": ["비겁"]},
        "정재격": {"용신": "재성", "희신": ["식상"], "기신": ["비겁"]},
        "편관격": {"용신": "관살", "희신": ["재성"], "기신": ["식상"]},
        "정관격": {"용신": "관살", "희신": ["재성"], "기신": ["식상"]},
        "편인격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성", "식상"]},
        "정인격": {"용신": "인성", "희신": ["비겁"], "기신": ["재성", "식상"]},
        "비겁격": {"용신": "비겁", "희신": ["인성"], "기신": ["관살"]},
        "건록격": {"용신": "비겁", "희신": ["인성"], "기신": ["관살"]},
        "양인격": {"용신": "관살", "희신": ["인성"], "기신": ["비겁"]},
    }
    if verdict in _NEUTRAL_VERDICTS:
        neutral_row = NEUTRAL_TABLE.get(geok, {"용신": "비겁", "희신": ["인성"], "기신": ["관살"]})
        eokbu = {
            "용신_cat": "균형", "용신_오행": "전체",
            "희신_cat": [], "기신_cat": [],
            "비고": "신강신약 균형→격국 유지 우선",
            "_neutral_row": neutral_row,
        }
    elif verdict in _STRONG_VERDICTS:
        row = STRONG_TABLE.get(geok, {"용신": "식상", "희신": ["재성"], "기신": ["인성"]})
        eokbu = {"용신_cat": row["용신"], "용신_오행": tmap.get(row["용신"], "?"), "희신_cat": row["희신"], "기신_cat": row["기신"], "비고": f"억부법: {verdict}×{geok}"}
    else:
        row = WEAK_TABLE.get(geok, {"용신": "인성", "희신": ["비겁"], "기신": ["재성"]})
        eokbu = {"용신_cat": row["용신"], "용신_오행": tmap.get(row["용신"], "?"), "희신_cat": row["희신"], "기신_cat": row["기신"], "비고": f"억부법: {verdict}×{geok}"}

    # ── 병인 기반 용신 도출 시도 ──────────────
    disease_resolved = None
    primary = diag["primary"]
    if primary["시급도"] >= 0.3:
        disease_resolved = _resolve_disease(
            primary, day_stem, month_branch, tmap, verdict, diag["십성분포"]
        )

    # ── 조후 민감도 계산 ─────────────────────
    johu_importance = _johu_importance_score(day_stem, month_branch, stems, branches)

    # ── 조후용신 ─────────────────────────────
    johu_pair = _JOHU_TABLE.get((day_stem, month_branch))
    johu = {}
    if johu_pair:
        johu = {
            "조후_주용신": johu_pair[0],
            "조후_보조용신": johu_pair[1],
            "비고": f"적천수/궁통보감 기준: {day_stem}일간 {month_branch}월",
        }

    # ── 통관용신 ─────────────────────────────
    tonggwan_elem = _find_tonggwan(stems, branches, day_stem)
    tonggwan = {}
    if tonggwan_elem:
        tonggwan = {
            "통관용신": tonggwan_elem,
            "비고": "관살 과다→통관 오행으로 기운 소통",
        }

    # ── [Fix-12] 제화(制化) 보정 ──────────────────
    _JEHWA_MAP = {
        ("水","火"): "木", ("火","金"): "土", ("金","木"): "水",
        ("木","土"): "火", ("土","水"): "金",
    }
    ohang_cnt = diag["오행분포_raw"]
    jehwa_info = []
    for (attk, dfnd), mediator in _JEHWA_MAP.items():
        if ohang_cnt.get(attk,0)>=2 and ohang_cnt.get(dfnd,0)>=1:
            med_cnt = ohang_cnt.get(mediator,0)
            if med_cnt >= 1:
                jehwa_info.append({"공격":attk,"방어":dfnd,"중재":mediator,"중재량":round(med_cnt,1),"효과":"제화 작용→상극 완화"})
            elif mediator == eokbu.get("용신_오행"):
                jehwa_info.append({"공격":attk,"방어":dfnd,"중재":mediator,"중재량":0,"효과":"용신이 제화 역할→용신 가치 ↑"})
    result["제화정보"] = jehwa_info

    jehwa_bonus = any(j["중재"] == eokbu.get("용신_오행") and j["중재량"] >= 1 for j in jehwa_info)

    # ── 조후 오행 → 십성 카테고리 역매핑 ────────
    def _elem_to_cat(elem: str) -> str:
        for cat, e in tmap.items():
            if e == elem: return cat
        return ""

    # ── 최종 용신 결정: 병인 → 조후 → 억부 순 ──
    # 병인 시급도와 조후 시급도를 비교하여 더 시급한 쪽이 주도권을 갖는다.
    johu_override = False
    johu_main_elem = johu.get("조후_주용신", "")
    johu_sub_elem = johu.get("조후_보조용신", "")

    # 1) 병인 기반 판정이 성공적이면 그것을 우선 사용
    # 2) 조후 시급도가 억부 시급도를 넘으면 조후 전환
    # 3) 그 외에는 억부 유지

    use_disease = False
    if disease_resolved:
        # 병인 시급도가 충분히 높고, 조후 한서 병인이면 조후 전환도 고려
        if primary["유형"] == "한서":
            johu_override = True
        else:
            use_disease = True

    if not use_disease and not johu_override:
        de = STEM_ELEMENT[day_stem]
        if eokbu["용신_cat"] == "균형" and johu_main_elem:
            # v6.1: 중화→조후 override 전 검증
            # (a) 조후 오행이 일간의 식상(설기) 또는 재성(간접설기)이면 → 일간을 약화시키므로 차단
            johu_is_drain = (GEN_MAP.get(de) == johu_main_elem or
                             KE_MAP.get(de) == johu_main_elem)
            # (b) 조후 오행이 원국 천간에 이미 2개 이상 존재하면 → 조후 이미 해결
            johu_stem_cnt = sum(1 for s in stems if STEM_ELEMENT.get(s) == johu_main_elem)
            johu_branch_main_cnt = sum(
                1 for b in branches
                for h, role, _ in get_jijanggan(b)
                if role == "본기" and STEM_ELEMENT.get(h) == johu_main_elem
            )
            johu_already_sufficient = (johu_stem_cnt + johu_branch_main_cnt) >= 2
            if not johu_is_drain and not johu_already_sufficient:
                johu_override = True
            # else: 조후 부적합 → fallback to 격국 기반 억부
        elif eokbu["용신_cat"] == "균형":
            # 조후 테이블 자체가 없는 경우 → 격국 기반 fallback
            pass
        elif johu and eokbu["용신_오행"] != johu_main_elem:
            if diag["조후_시급도"] > diag["억부_시급도"]:
                johu_override = True
            elif johu_importance >= JOHU_OVERRIDE_THRESHOLD:
                johu_override = True

    # ── 용신 확정 ────────────────────────────
    if use_disease and disease_resolved:
        dr = disease_resolved
        final_elem = dr["용신_오행"]
        yong_label = _cat_label(dr["용신_cat"]) if dr["용신_cat"] not in ("조후",) else f"조후({final_elem})"
        confidence = f"높음(병인진단: {primary['병인']})"
        bigo = dr["비고"]

        hui_cats = dr.get("희신_cat", [])
        gi_cats = dr.get("기신_cat", [])

        # 조후 보조: 병인 용신이 조후와 일치하면 확신도 보너스
        if johu and final_elem == johu_main_elem:
            confidence = f"매우높음(병인+조후 일치: {primary['병인']})"
        elif johu and johu_main_elem:
            johu_cat = _elem_to_cat(johu_main_elem)
            if johu_cat and johu_cat not in hui_cats and johu_cat != dr["용신_cat"]:
                hui_cats = list(hui_cats) + [johu_cat]

        result.update({
            "용신": yong_label, "용신_오행": final_elem,
            "희신": [_cat_label(c) for c in hui_cats],
            "희신_오행": [tmap.get(c, "?") for c in hui_cats],
            "기신": [_cat_label(c) for c in gi_cats],
            "기신_오행": [tmap.get(c, "?") for c in gi_cats],
        })
    elif johu_override and johu_main_elem:
        final_elem = johu_main_elem
        johu_cat = _elem_to_cat(johu_main_elem)
        johu_sub_cat = _elem_to_cat(johu_sub_elem) if johu_sub_elem else ""
        hui_cats = []
        hui_elems = []
        ke_of_de = {v: k for k, v in KE_MAP.items()}.get(STEM_ELEMENT[day_stem], "")
        # 조후 보조용신 → 일간을 극하는 관살이면 희신에서 제외
        if johu_sub_elem and johu_sub_elem != johu_main_elem:
            if johu_sub_elem != ke_of_de:
                hui_cats.append(johu_sub_cat)
                hui_elems.append(johu_sub_elem)
        # 용신이 생하는 오행 = 직접적 수혜 오행 (인성→비겁, 식상→재성 등)
        gen_of_yong = GEN_MAP.get(johu_main_elem, "")
        gen_of_yong_cat = _elem_to_cat(gen_of_yong)
        if gen_of_yong and gen_of_yong not in hui_elems:
            hui_cats.append(gen_of_yong_cat)
            hui_elems.append(gen_of_yong)
        # 용신을 생하는 오행 = 용신 강화 (부가 희신)
        # 단, 해당 오행이 일간을 극하는(관살) 관계면 희신에서 제외
        gen_inv = {v: k for k, v in GEN_MAP.items()}
        gen_elem = gen_inv.get(johu_main_elem, "")
        gen_cat = _elem_to_cat(gen_elem)
        if gen_elem and gen_elem != johu_main_elem and gen_elem not in hui_elems:
            if gen_elem != ke_of_de:
                hui_cats.append(gen_cat)
                hui_elems.append(gen_elem)
        ke_inv = {v: k for k, v in KE_MAP.items()}
        gi_elem = ke_inv.get(johu_main_elem, "")
        gi_cat = _elem_to_cat(gi_elem)
        gi_cats = [gi_cat] if gi_elem else []
        gi_elems = [gi_elem] if gi_elem else []
        # 식상(일간의 설기)도 용신 효과를 상쇄하므로 기신에 포함
        siksang_elem = tmap.get("식상", "")
        siksang_cat = "식상"
        if siksang_elem and siksang_elem not in gi_elems:
            gi_cats.append(siksang_cat)
            gi_elems.append(siksang_elem)

        if eokbu["용신_cat"] == "균형":
            yong_label = f"조후용신({johu_main_elem})"
            confidence = "높음(중화→조후 적용)"
            bigo = f"중화 판정→조후용신 적용 (민감도 {johu_importance})"
        else:
            yong_label = _cat_label(johu_cat) if johu_cat else f"조후({johu_main_elem})"
            confidence = f"높음(조후 우선: 시급도 {diag['조후_시급도']})"
            bigo = f"억부({eokbu['용신_오행']})→조후({johu_main_elem}) 전환 (조후시급도 {diag['조후_시급도']})"

        result.update({
            "용신": yong_label, "용신_오행": final_elem,
            "희신": [_cat_label(c) for c in hui_cats],
            "희신_오행": hui_elems,
            "기신": [_cat_label(c) for c in gi_cats],
            "기신_오행": gi_elems,
        })
    else:
        # v6.1: 중화인데 조후 미적용 → 격국 기반 용신 fallback
        if eokbu["용신_cat"] == "균형" and "_neutral_row" in eokbu:
            nrow = eokbu["_neutral_row"]
            final_elem = tmap.get(nrow["용신"], "?")
            yong_label = _cat_label(nrow["용신"])
            confidence = "보통(중화→격국유지)"
            bigo = f"중화→조후부적합→격국({geok}) 주성 유지"
            result.update({
                "용신": yong_label, "용신_오행": final_elem,
                "희신": [_cat_label(h) for h in nrow["희신"]],
                "희신_오행": [tmap.get(h, "?") for h in nrow["희신"]],
                "기신": [_cat_label(g) for g in nrow["기신"]],
                "기신_오행": [tmap.get(g, "?") for g in nrow["기신"]],
            })
        else:
            if johu and eokbu["용신_오행"] == johu.get("조후_주용신"):
                final_elem = eokbu["용신_오행"]
                confidence = "매우높음(억부+조후+제화 일치)" if jehwa_bonus else "높음(억부+조후 일치)"
            elif johu:
                final_elem = eokbu["용신_오행"]
                confidence = "보통(억부·조후 불일치)"
            else:
                final_elem = eokbu["용신_오행"]
                confidence = "보통"
            yong_label = _cat_label(eokbu["용신_cat"]) if eokbu["용신_cat"] != "균형" else "중화(균형유지)"
            bigo = eokbu["비고"]
            result.update({
                "용신": yong_label, "용신_오행": final_elem,
                "희신": [_cat_label(h) for h in eokbu.get("희신_cat", [])],
                "희신_오행": [tmap.get(h, "?") for h in eokbu.get("희신_cat", [])],
                "기신": [_cat_label(g) for g in eokbu.get("기신_cat", [])],
                "기신_오행": [tmap.get(g, "?") for g in eokbu.get("기신_cat", [])],
            })

    tonggwan_applied = False
    if tonggwan_elem:
        current_hee = list(result.get("희신_오행", []))
        current_gi = set(result.get("기신_오행", []))
        # 명리학 원칙: 통관은 상극을 완충하는 보조축이므로, 주용신을 덮기보다
        # 최종 용신/희신이 포착하지 못한 경우 보조 희신으로 편입한다.
        if (
            tonggwan_elem != result.get("용신_오행")
            and tonggwan_elem not in current_hee
            and tonggwan_elem not in current_gi
        ):
            result.setdefault("희신", []).append(f"통관보조({tonggwan_elem})")
            result.setdefault("희신_오행", []).append(tonggwan_elem)
            tonggwan_applied = True
            bigo = f"{bigo}; 통관 보조오행 {tonggwan_elem} 반영"
        else:
            tonggwan_applied = (
                tonggwan_elem == result.get("용신_오행")
                or tonggwan_elem in current_hee
            )

    result.update({
        "억부용신": eokbu,
        "조후용신": johu,
        "통관용신": tonggwan,
        "용신체계": "억부+조후+통관보조" if tonggwan_elem else "억부+조후",
        "판정확신도": confidence,
        "조후민감도": johu_importance,
        "조후전환": johu_override,
        "통관적용": tonggwan_applied,
        "비고": bigo,
    })
    return _add_gushin(result)

# ══════════════════════════════════════════════
# SECTION 10 : 오행분포 (v3.3 – 지장간 가중치 포함)
# ══════════════════════════════════════════════

def ohang_imbalance(stems: List[str], branches: List[str],
                    month_branch: str = "", day_stem: str = "") -> Dict[str, Any]:
    """v6: 6단계 다층 보정 오행분포 산출.
    1차: 천간/지지 기본 점수
    2차: 월령(계절) 가중치
    3차: 통근/투출 보정
    4차: 지장간 역할 가중치
    5차: 생극 증감
    6차: 조후(한난조습) 보정
    """
    # ── 1차: 기본 존재감 (천간 1.0, 지지 본기 1.0) ──
    cnt_raw = {"木": 0.0, "火": 0.0, "土": 0.0, "金": 0.0, "水": 0.0}
    for s in stems:
        cnt_raw[STEM_ELEMENT[s]] += 1.0
    for b in branches:
        _add_branch_weighted_elements(cnt_raw, b, scale=1.0)

    # ── 역량 계산 (다층 보정) ──
    cnt = dict(cnt_raw)

    # ── 2차: 월령 가중치 — 월지 계절 오행에 보너스 ──
    if month_branch:
        season_elem = SEASON_SUPPORT.get(month_branch, "")
        if season_elem:
            cnt[season_elem] += 1.5

    # ── 3차: 통근/투출 보정 — 천간이 지지에 뿌리 있으면 ──
    if day_stem:
        for i, s in enumerate(stems):
            s_elem = STEM_ELEMENT[s]
            for b in branches:
                for h, role, _w in get_jijanggan(b):
                    if STEM_ELEMENT[h] == s_elem and role == "본기":
                        cnt[s_elem] += 0.3
                        break

    # ── 4차: 지장간은 이미 1차에서 반영됨 ──

    # ── 5차: 생극 증감 ──
    snapshot = dict(cnt)
    for e in ("木", "火", "土", "金", "水"):
        gen_target = GEN_MAP[e]  # e가 생하는 오행
        ke_target = KE_MAP[e]    # e가 극하는 오행
        if snapshot[e] >= 2.0:
            cnt[gen_target] += snapshot[e] * 0.1  # 생 증가
            cnt[ke_target] -= snapshot[e] * 0.1   # 극 감소
    for e in cnt:
        cnt[e] = max(0.0, cnt[e])

    # ── 6차: 조후(한난조습) 보정 ──
    if month_branch:
        climate = _HANNANJOSEUP.get(month_branch, "온")
        if "한" in climate:
            cnt["水"] += 0.5
            cnt["火"] = max(0.0, cnt["火"] - 0.3)
        elif "서" in climate:
            cnt["火"] += 0.5
            cnt["水"] = max(0.0, cnt["水"] - 0.3)

    cnt_display_raw = {e: round(v, 1) for e, v in cnt_raw.items()}
    cnt_int_raw = {e: int(round(v)) for e, v in cnt_raw.items()}
    cnt_power = {e: round(v, 1) for e, v in cnt.items()}

    excess = [e for e, v in cnt.items() if v >= 3.0]
    deficient = [e for e, v in cnt.items() if v < 0.5]
    low = [e for e, v in cnt.items() if 0.5 <= v < 1.5]

    _OHANG_INFO = {
        "木": {"보완": "金", "팁": "절제·정리·스틸 톤 인테리어", "장부": "간·담"},
        "火": {"보완": "水", "팁": "수영·명상·블랙 컬러, 카페인 줄이기", "장부": "심장·소장"},
        "土": {"보완": "木", "팁": "산책·독서·그린 컬러, 미니멀리즘", "장부": "비장·위"},
        "金": {"보완": "火", "팁": "댄스·레드 컬러, 협업 강화", "장부": "폐·대장"},
        "水": {"보완": "土", "팁": "근력 운동·브라운 컬러, 루틴 관리", "장부": "신장·방광"},
    }

    return {
        "분포": cnt_display_raw,
        "분포_정수": cnt_int_raw,
        "분포_역량": cnt_power,
        "과다": excess,
        "부족": deficient,
        "적음": low,
        "과다_보완_오행": {e: _OHANG_INFO[e]["보완"] for e in excess},
        "부족_보완팁": {e: _OHANG_INFO[e]["팁"] for e in deficient},
        "건강_주의": {e: _OHANG_INFO[e]["장부"] for e in excess + deficient},
    }

# ──────────────────────────────────────────────
# SECTION 11 : PatternScore
# ──────────────────────────────────────────────
_PAT_W = {"합":+0.9,"충":-1.2,"형":-0.8,"파":-1.0,"해":-0.6,"원진":-0.4,"극":-0.5,"반합":+0.6}

def pattern_score(relations:List[Dict[str,Any]])->Dict[str,Any]:
    total=0.0; breakdown=[]
    for rel in relations:
        for r in rel.get("relations",[]):
            for k,w in _PAT_W.items():
                if k in r:
                    total+=w; breakdown.append({"between":rel["between"],"pattern":r,"weight":w})
                    break
    if total>=0.8: lv="길(吉) – 조화로운 원국"
    elif total>=-0.4: lv="중립 – 보통"
    elif total>=-1.2: lv="주의 – 갈등 에너지"
    else: lv="흉(凶) – 충돌 과다"
    return {"총점":round(total,2),"등급":lv,"상세":breakdown}

# ──────────────────────────────────────────────
# SECTION 12 : DomainScore
# ──────────────────────────────────────────────
_TG_DOM = {
    "비견":{"직업":0.3,"재물":-0.2,"건강":0.1,"연애":-0.1,"결혼":-0.1},
    "겁재":{"직업":0.2,"재물":-0.4,"건강":0.0,"연애":-0.2,"결혼":-0.3},
    "식신":{"직업":0.4,"재물":0.3,"건강":0.5,"연애":0.3,"결혼":0.2},
    "상관":{"직업":0.5,"재물":0.2,"건강":0.0,"연애":0.4,"결혼":-0.2},
    "편재":{"직업":0.3,"재물":0.5,"건강":0.0,"연애":0.5,"결혼":0.1},
    "정재":{"직업":0.2,"재물":0.6,"건강":0.0,"연애":0.2,"결혼":0.5},
    "편관":{"직업":0.4,"재물":-0.1,"건강":-0.3,"연애":0.1,"결혼":-0.2},
    "정관":{"직업":0.6,"재물":0.2,"건강":0.0,"연애":0.1,"결혼":0.4},
    "편인":{"직업":0.3,"재물":-0.1,"건강":0.1,"연애":0.0,"결혼":-0.1},
    "정인":{"직업":0.4,"재물":0.1,"건강":0.3,"연애":0.0,"결혼":0.2},
}
_GEOK_DOM = {
    "식신격":{"직업":0.5,"건강":0.5},"상관격":{"직업":0.6,"연애":0.4},
    "편재격":{"재물":0.8,"연애":0.3},"정재격":{"재물":0.7,"결혼":0.4},
    "편관격":{"직업":0.5},           "정관격":{"직업":0.6,"결혼":0.4},
    "편인격":{"직업":0.3},           "정인격":{"직업":0.4,"건강":0.3},
    "비겁격":{"직업":0.3},
}
_SHINSAL_DOM = {
    "도화(桃花)":{"연애":0.6,"결혼":0.3},"역마(驛馬)":{"직업":0.4},
    "장성(將星)":{"직업":0.5},"천을귀인(天乙)":{"직업":0.4,"재물":0.3},
    "문창귀인(文昌)":{"직업":0.4},"양인(羊刃)":{"건강":-0.4,"직업":0.2},
    "괴강(魁罡)":{"직업":0.4},"고란(孤鸞)":{"결혼":-0.5,"연애":-0.3},
    "홍란(紅鸞)":{"연애":0.5,"결혼":0.4},"천희(天喜)":{"연애":0.4,"결혼":0.3},
    "고진(孤辰)":{"결혼":-0.4},"과숙(寡宿)":{"결혼":-0.4},
    "백호살(白虎)":{"건강":-0.5},"귀문관살(鬼門關)":{"건강":-0.3},
    # [Fix-9] 추가 신살 도메인
    "관귀살(官貴)":{"직업":0.4,"재물":0.2},"관록살(官祿)":{"직업":0.5,"재물":0.3},
    "천복귀인(天福)":{"재물":0.3,"건강":0.2},"천은(天恩)":{"직업":0.2,"건강":0.2},
    "명예살":{"직업":0.4},"목덕살(月德)":{"건강":0.3,"직업":0.2},
    "현광살(懸光)":{"건강":-0.2},"연살(年殺)":{"건강":-0.2,"재물":-0.2},
    "재살(災殺)":{"건강":-0.4,"재물":-0.3},"육해살(六害)":{"결혼":-0.3,"연애":-0.2},
    "휴식살(休息)":{"직업":-0.1,"건강":0.2},
    # [Fix-16] 추가
    "천시귀인(天時)":{"직업":0.2},"천관성(天官)":{"직업":0.4,"재물":0.2},
    "천수성(天壽)":{"건강":0.4},"금여록(金輿祿)":{"재물":0.4,"결혼":0.2},
    "옥당귀인(玉堂)":{"직업":0.3},"권세귀인(權勢)":{"직업":0.5},
    "천계귀인(天界)":{"직업":0.2,"건강":0.2},"봉각(鳳閣)":{"직업":0.3,"연애":0.2},
    "태양귀인(太陽)":{"직업":0.3,"재물":0.2},"태음귀인(太陰)":{"연애":0.3,"결혼":0.2},
    "용덕귀인(龍德)":{"직업":0.3},"봉덕귀인(鳳德)":{"연애":0.2,"결혼":0.2},
    "천삼기(天三奇)":{"직업":0.5,"재물":0.3},"지삼기(地三奇)":{"직업":0.4,"연애":0.2},
    "인삼기(人三奇)":{"직업":0.3,"건강":0.2},
    "천살(天煞)":{"건강":-0.3,"재물":-0.2},"파살(破殺)":{"재물":-0.3},
    "충살(冲殺)":{"직업":-0.3,"건강":-0.2},"형살(刑殺)":{"직업":-0.2,"건강":-0.3},
}

# [Fix-14] 흉신별 RiskPenalty 계수 (도메인 점수에 별도 페널티)
_RISK_PENALTY = {
    "양인(羊刃)":       {"건강": 1.5, "직업": 0.5},
    "백호살(白虎)":     {"건강": 1.8},
    "겁살(劫殺)":       {"재물": 1.2, "건강": 0.8},
    "재살(災殺)":       {"건강": 1.5, "재물": 1.0},
    "귀문관살(鬼門關)": {"건강": 1.2, "연애": 0.5},
    "고란(孤鸞)":       {"결혼": 1.5, "연애": 1.0},
    "고진(孤辰)":       {"결혼": 1.2},
    "과숙(寡宿)":       {"결혼": 1.2},
    "원진살(怨嗔)":     {"결혼": 0.8, "연애": 0.8},
    "육해살(六害)":     {"결혼": 0.8, "연애": 0.6},
    "현광살(懸光)":     {"건강": 0.6},
    "연살(年殺)":       {"건강": 0.6, "재물": 0.6},
    "천라(天羅)":       {"직업": 0.8, "건강": 0.5},
    "지망(地網)":       {"직업": 0.8, "건강": 0.5},
}

def domain_score(geok:str,shinsal_hits:List[str],ten_gods_all:Dict[str,str],verdict:str)->Dict[str,Any]:
    dom={"직업":5.0,"재물":5.0,"건강":5.0,"연애":5.0,"결혼":5.0}
    risk={"직업":0.0,"재물":0.0,"건강":0.0,"연애":0.0,"결혼":0.0}
    for tg in ten_gods_all.values():
        for d,w in _TG_DOM.get(tg,{}).items(): dom[d]+=w
    for d,w in _GEOK_DOM.get(geok,{}).items(): dom[d]+=w
    if verdict in _STRONG_VERDICTS: dom["직업"]+=0.3; dom["건강"]+=0.2
    elif verdict in _WEAK_VERDICTS: dom["건강"]-=0.3
    for name in shinsal_hits:
        for k,bmap in _SHINSAL_DOM.items():
            if k.split("(")[0] in name or name.split("(")[0] in k:
                for d,w in bmap.items(): dom[d]+=w
        for k,pmap in _RISK_PENALTY.items():
            if k.split("(")[0] in name or name.split("(")[0] in k:
                for d,p in pmap.items(): risk[d]+=p
    for d in dom:
        dom[d] -= risk[d]
        dom[d]=max(0.0,min(10.0,round(dom[d],1)))
    def _g(v): return "High🟢" if v>=7 else ("Mid⚪" if v>=4 else "Low🔴")
    return {"점수":dom,"등급":{d:_g(v) for d,v in dom.items()},
            "리스크페널티":{d:round(v,1) for d,v in risk.items() if v>0}}

# ──────────────────────────────────────────────
# SECTION 13 : 신살 계산 엔진 [Q1 + Q4 확장]
# ──────────────────────────────────────────────
def _hb(tgts,all_b): s=set(all_b); return [t for t in tgts if t and t in s]
def _hs(tgts,all_s): s=set(all_s); return [t for t in tgts if t and t in s]
def _pairs(all_b,pset):
    hits=[]
    for i in range(len(all_b)):
        for j in range(i+1,len(all_b)):
            if (all_b[i],all_b[j]) in pset: hits.append(f"{all_b[i]}-{all_b[j]}")
    return hits
def _tri_hit(base,mapping,all_b):
    tri=get_trine(base); t=mapping.get(tri)
    return t,(_hb([t],all_b) if t else [])
def _csv_hit_yb(name,key,all_b): tgts=_SHINSAL_YEAR_BRANCH.get(name,{}).get(key,[]); return tgts,_hb(tgts,all_b)
def _csv_hit_ds(name,key,all_b): tgts=_SHINSAL_DAY_STEM.get(name,{}).get(key,[]); return tgts,_hb(tgts,all_b)

class StarCollector:
    def __init__(self): self._seen=set(); self.hits=[]; self.hit_count=0
    def add(self,name,kind,basis,hit,ev):
        key=(name,basis,str(ev.get("target") or ev.get("targets") or ev.get("hits","")))
        if key in self._seen or not hit: self._seen.add(key); return
        self._seen.add(key)
        self.hits.append({"name":name,"type":kind,"basis":basis,"evidence":ev})
        self.hit_count+=1

def build_shinsal_detail(stems,branches,pillars)->Dict[str,Any]:
    """[Q1] 삼합기반 신살: 연지/월지/일지/시지 모두 BASE로 사용"""
    ys,ms,ds,hs_stem = stems
    yb,mb,db,hb_br   = branches
    day_gz = pillars["day"]
    c = StarCollector()

    # ── [Q1 변경] 4주 지지 모두 BASE ────────────────
    TRINE_BASES = [("연지",yb),("월지",mb),("일지",db),("시지",hb_br)]

    for basis_name, base in TRINE_BASES:
        tri = get_trine(base)
        if not tri: continue

        # 도화(桃花) / 함지(咸池) = 동일 지지
        tgt,hits=_tri_hit(base,PEACH_BY_TRINE,branches)
        if hits:
            c.add("도화(桃花)","흉살",basis_name,True,{"base":base,"trine":tri,"target":tgt,"hits":hits})
            c.add("함지살(咸池)","흉살",basis_name,True,{"base":base,"trine":tri,"target":tgt,"hits":hits,"비고":"도화와 동일"})

        # 역마
        tgt,hits=_tri_hit(base,HORSE_BY_TRINE,branches)
        c.add("역마(驛馬)","흉살",basis_name,bool(hits),{"base":base,"trine":tri,"target":tgt,"hits":hits})

        # 화개
        tgt,hits=_tri_hit(base,FLORAL_CANOPY_BY_TRINE,branches)
        c.add("화개(華蓋)","기타",basis_name,bool(hits),{"base":base,"trine":tri,"target":tgt,"hits":hits})

        # 장성
        tgt,hits=_tri_hit(base,GENERAL_STAR_BY_TRINE,branches)
        c.add("장성(將星)","길신",basis_name,bool(hits),{"base":base,"trine":tri,"target":tgt,"hits":hits})

        # 반안
        tgt,hits=_tri_hit(base,PANAN_BY_TRINE,branches)
        c.add("반안(攀鞍)","길신",basis_name,bool(hits),{"base":base,"trine":tri,"target":tgt,"hits":hits})

        # 망신
        tgt,hits=_tri_hit(base,WANGSHEN_BY_TRINE,branches)
        c.add("망신(亡神)","흉살",basis_name,bool(hits),{"base":base,"trine":tri,"target":tgt,"hits":hits})

        # 겁살
        tgt,hits=_tri_hit(base,JIESHA_BY_TRINE,branches)
        c.add("겁살(劫殺)","흉살",basis_name,bool(hits),{"base":base,"trine":tri,"target":tgt,"hits":hits})

        # 삼살 3종
        for k in ("劫煞","災煞","天煞"):
            t=THREE_SAL_BY_TRINE.get(tri,{}).get(k)
            h=_hb([t],branches) if t else []
            c.add(k,"흉살",basis_name,bool(h),{"base":base,"trine":tri,"target":t,"hits":h})

        # [추가] CSV 기반 지살/월살 (연지/일지 기준과 동일하게 4주 base로)
        for sname in ("지살","월살"):
            tgts,hits=_csv_hit_yb(sname,base,branches)
            c.add(sname,"흉살",basis_name,bool(hits),{"base":base,"targets":tgts,"hits":hits})

    # ── CSV 기반 연지/일지 한정 신살 ────────────────
    for sname in ("상문살","조객살","태백살"):
        tgts,hits=_csv_hit_yb(sname,yb,branches)
        c.add(sname,"흉살","연지",bool(hits),{"year_branch":yb,"targets":tgts,"hits":hits})

    # ── 홍란/천희/고진/과숙 ─────────────────────────
    for sname,tbl,kind in [("홍란(紅鸞)",HONGRAN_YB,"길신"),("천희(天喜)",TIANXI_YB,"길신"),
                           ("고진(孤辰)",GUCHEN_YB,"흉살"),("과숙(寡宿)",GUASU_YB,"흉살")]:
        tgt=tbl.get(yb); h=_hb([tgt],branches) if tgt else []
        c.add(sname,kind,"연지",bool(h),{"year_branch":yb,"target":tgt,"hits":h})

    # ── 일간 기준 길신 ──────────────────────────────
    for sname,vals,kind in [
        ("천을귀인(天乙)",NOBLEMAN_TIAN_YI.get(ds,[]),"길신"),
        ("문창귀인(文昌)",[WENCHANG.get(ds)],"길신"),
        ("록신(祿神)",[LUXING.get(ds)],"길신"),
        ("태극귀인(太極)",TAIJI.get(ds,[]),"길신"),
        ("국인귀인(國印)",[GUOYIN.get(ds)],"길신"),
        ("복성귀인(福星)",[FUXING.get(ds)],"길신"),
        ("학당귀인(學堂)",[HAKDANG.get(ds)],"길신"),
        ("사관귀인(詞館)",[SAGWAN.get(ds)],"길신"),
        ("홍염(紅艶)",[HONGYEOM.get(ds)],"기타"),
    ]:
        v=[x for x in vals if x]; h=_hb(v,branches)
        c.add(sname,kind,"일간",bool(h),{"day_stem":ds,"targets":v,"hits":h})

    # 양인
    tgt=YANGREN.get(ds); h=_hb([tgt],branches) if tgt else []
    c.add("양인(羊刃)","흉살","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # CSV 기반 일간 신살
    for sname in ("금여","암록","협록","천관귀인","문곡귀인","복덕살","천후귀인","천하귀인"):
        tgts,hits=_csv_hit_ds(sname,ds,branches)
        kind=_SHINSAL_KIND.get(sname,"길신")
        c.add(sname,kind,"일간",bool(hits),{"day_stem":ds,"targets":tgts,"hits":hits})

    # ── [추가] 오행덕귀인 (일간 오행 기반) ─────────────
    de=STEM_ELEMENT[ds]
    OHANG_DEOK_NAMES={"木":"목덕귀인(木德)","火":"화덕귀인(火德)","土":"토덕귀인(土德)",
                      "金":"금덕귀인(金德)","水":"수덕귀인(水德)"}
    c.add(OHANG_DEOK_NAMES[de],"길신","일간",True,{"day_stem":ds,"day_elem":de,"비고":"일간 오행과 같은 덕귀인 자동 발현"})

    # ── 월지 기준 ──────────────────────────────────
    ts_td=TIANDE_MB.get(mb); h_td=_hs([ts_td],stems) if ts_td else []
    c.add("천덕귀인(天德)","길신","월지",bool(h_td),{"month_branch":mb,"target_stem":ts_td,"hits":h_td})
    ts_yd=YUEDE_MB.get(mb); h_yd=_hs([ts_yd],stems) if ts_yd else []
    c.add("월덕귀인(月德)","길신","월지",bool(h_yd),{"month_branch":mb,"target_stem":ts_yd,"hits":h_yd})
    tb_yi=TIANYI_MB.get(mb); h_yi=_hb([tb_yi],branches) if tb_yi else []
    c.add("천의성(天醫)","기타","월지",bool(h_yi),{"month_branch":mb,"target":tb_yi,"hits":h_yi})

    # [추가] 천덕합/월덕합: 천덕/월덕귀인의 간과 합이 되는 간이 원국에 있는지
    if ts_td:
        hap_partner = next((s2 for (s1,s2) in STEM_COMBINE if s1==ts_td),None)
        if hap_partner and hap_partner in stems:
            c.add("천덕합(天德合)","길신","월지",True,{"month_branch":mb,"tiande_stem":ts_td,"hap_partner":hap_partner})
    if ts_yd:
        hap_partner2= next((s2 for (s1,s2) in STEM_COMBINE if s1==ts_yd),None)
        if hap_partner2 and hap_partner2 in stems:
            c.add("월덕합(月德合)","길신","월지",True,{"month_branch":mb,"yuede_stem":ts_yd,"hap_partner":hap_partner2})

    # ── 지지 조합형 ────────────────────────────────
    wp=_pairs(branches,WONJIN_PAIRS)
    c.add("원진살(怨嗔)","흉살","지지조합",bool(wp),{"pairs":wp})
    gp=_pairs(branches,GUIMUN_PAIRS)
    c.add("귀문관살(鬼門關)","흉살","지지조합",bool(gp),{"pairs":gp})
    tl=[b for b in branches if b in TIANLUO_SET]
    c.add("천라(天羅)","흉살","지지",bool(tl),{"hits":tl})
    dw=[b for b in branches if b in DIWANG_SET]
    c.add("지망(地網)","흉살","지지",bool(dw),{"hits":dw})

    # [추가] 삼태(三台) – 삼합 완성시 길신
    bset=frozenset(branches)
    for tset,tname in TRINE_SETS.items():
        if tset.issubset(bset):
            c.add(f"삼태귀인({tname})","길신","삼합완성",True,{"trine":tname,"branches":sorted(tset)})

    # ── 일주 특수 ──────────────────────────────────
    c.add("괴강(魁罡)","흉살","일주",(day_gz in KUIGANG),{"day_pillar":day_gz})
    c.add("고란(孤鸞)","흉살","일주",(day_gz in GOLAN),{"day_pillar":day_gz})
    c.add("백호살(白虎)","흉살","일주",(day_gz in BAEKHO),{"day_pillar":day_gz})

    # [추가] 금신살
    c.add("금신살(金神)","흉살","일주",(day_gz in GEUMSHIN_PILLARS),{"day_pillar":day_gz})

    # [추가] 음양차착살
    c.add("음양차착살","흉살","일주",(day_gz in EUMYANG_PILLARS),{"day_pillar":day_gz,"비고":"결혼·이성 관계 주의"})

    # [추가] 격각살 – 辰戌丑未 2개 이상
    gakgak_hits=[b for b in branches if b in GAKGAK_SET]
    c.add("격각살(格角)","흉살","지지",len(gakgak_hits)>=2,{"hits":gakgak_hits,"count":len(gakgak_hits)})

    # 현침살
    hc_s=[s for s in stems if s in HYUNCHIM_STEMS]; hc_b=[b for b in branches if b in HYUNCHIM_BRANCHES]
    c.add("현침살(懸針)","흉살","천간+지지",bool(hc_s and hc_b),{"stems":hc_s,"branches":hc_b})

    # 삼기
    sset=frozenset(stems)
    for sg,sname in SAMGI_SETS:
        c.add(f"삼기_{sname}","길신","천간",sg.issubset(sset),{"required":sorted(sg),"found":sorted(sg&sset)})

    # ── [Fix-9] 추가 신살 체크 ────────────────────

    # 관귀살(官貴) — 일간 기준
    tgt_gw = GWANGUI_DS.get(ds)
    h_gw = _hb([tgt_gw], branches) if tgt_gw else []
    c.add("관귀살(官貴)","길신","일간",bool(h_gw),{"day_stem":ds,"target":tgt_gw,"hits":h_gw})

    # 현광살(懸光) — 일간 기준
    tgt_hg = HYUNGWANG_DS.get(ds)
    h_hg = _hb([tgt_hg], branches) if tgt_hg else []
    c.add("현광살(懸光)","특수신","일간",bool(h_hg),{"day_stem":ds,"target":tgt_hg,"hits":h_hg})

    # 천복귀인(天福) — 일간 기준
    tgt_tf = TIANFU_DS.get(ds)
    h_tf = _hb([tgt_tf], branches) if tgt_tf else []
    c.add("천복귀인(天福)","길신","일간",bool(h_tf),{"day_stem":ds,"target":tgt_tf,"hits":h_tf})

    # 관록살(官祿) — 일간 기준
    tgt_gr = GWANROK_DS.get(ds)
    h_gr = _hb([tgt_gr], branches) if tgt_gr else []
    c.add("관록살(官祿)","길신","일간",bool(h_gr),{"day_stem":ds,"target":tgt_gr,"hits":h_gr})

    # 천은(天恩) — 일간 기준
    tgt_te = TIANEUN_DS.get(ds)
    h_te = _hb([tgt_te], branches) if tgt_te else []
    c.add("천은(天恩)","길신","일간",bool(h_te),{"day_stem":ds,"target":tgt_te,"hits":h_te})

    # 명예살 — 연지 기준
    tgt_my = MYUNGYE_YB.get(yb)
    h_my = _hb([tgt_my], branches) if tgt_my else []
    c.add("명예살","특수신","연지",bool(h_my),{"year_branch":yb,"target":tgt_my,"hits":h_my})

    # 연살(年殺) — 연지 기준
    tgt_ys = YEONSAL_YB.get(yb)
    h_ys = _hb([tgt_ys], branches) if tgt_ys else []
    c.add("연살(年殺)","흉살","연지",bool(h_ys),{"year_branch":yb,"target":tgt_ys,"hits":h_ys})

    # 휴식살(休息) — 4주 삼합 기반
    for basis_name, base in TRINE_BASES:
        tri = get_trine(base)
        tgt_hy = HYUSIK_BY_TRINE.get(tri)
        h_hy = _hb([tgt_hy], branches) if tgt_hy else []
        c.add("휴식살(休息)","특수신",basis_name,bool(h_hy),{"base":base,"trine":tri,"target":tgt_hy,"hits":h_hy})

    # 청룡/현무/주작 — 삼합 방위 영수
    for basis_name, base in TRINE_BASES:
        tri = get_trine(base)
        spirits = DIRECTION_SPIRIT_BY_TRINE.get(tri, {})
        for spirit_name, spirit_branch in spirits.items():
            h_sp = _hb([spirit_branch], branches)
            c.add(f"{spirit_name}(方位)","특수신",basis_name,bool(h_sp),{"base":base,"trine":tri,"target":spirit_branch,"hits":h_sp})

    # 목덕살(木德) — 월지 계절 기반
    mb_season_elem = MOKDEOK_SEASON.get(mb, "")
    ds_elem = STEM_ELEMENT[ds]
    if mb_season_elem == ds_elem:
        c.add("목덕살(月德)","길신","월지",True,{"month_branch":mb,"season_elem":mb_season_elem,"day_elem":ds_elem,"비고":"일간 오행이 월지 계절과 동기화"})

    # 육해살(六害) — 이미 해(害)가 관계에 있지만 별도 신살로 등록
    harm_pairs = _pairs(branches, BRANCH_HARM)
    c.add("육해살(六害)","흉살","지지조합",bool(harm_pairs),{"pairs":harm_pairs})

    # 재살(災殺) — THREE_SAL_BY_TRINE의 災煞를 한글화하여 별도 등록
    for basis_name, base in TRINE_BASES:
        tri = get_trine(base)
        t_js = THREE_SAL_BY_TRINE.get(tri, {}).get("災煞")
        h_js = _hb([t_js], branches) if t_js else []
        c.add("재살(災殺)","흉살",basis_name,bool(h_js),{"base":base,"trine":tri,"target":t_js,"hits":h_js})

    # ── [Fix-16] 추가 신살 체크 ────────────────

    # 천시귀인(天時) — 일간 기준
    tgt = TIANSHI_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("천시귀인(天時)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 천관성(天官星) — 일간 기준
    tgt = TIANGUAN_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("천관성(天官)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 천수성(天壽) — 일간 기준
    tgt = TIANSHOU_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("천수성(天壽)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 천문성(天門) — 일간 기준
    tgt = TIANMEN_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("천문성(天門)","특수신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 금여록(金輿祿) — 일간 기준
    tgt = KINYEOLOK_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("금여록(金輿祿)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 옥당귀인(玉堂) — 일간 기준
    tgt = OKDANG_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("옥당귀인(玉堂)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 권세귀인 — 일간 기준
    tgt = GWONSE_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("권세귀인(權勢)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 천계귀인 — 일간 기준
    tgt = TIANGYE_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("천계귀인(天界)","길신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 봉각살(鳳閣) — 일간 기준
    tgt = BONGGAK_DS.get(ds)
    h = _hb([tgt], branches) if tgt else []
    c.add("봉각(鳳閣)","특수신","일간",bool(h),{"day_stem":ds,"target":tgt,"hits":h})

    # 태양귀인/태음귀인 — 연지 기준
    tgt_ty = TAEYANG_YB.get(yb)
    h_ty = _hb([tgt_ty], branches) if tgt_ty else []
    c.add("태양귀인(太陽)","길신","연지",bool(h_ty),{"year_branch":yb,"target":tgt_ty,"hits":h_ty})

    tgt_te = TAEEUM_YB.get(yb)
    h_te = _hb([tgt_te], branches) if tgt_te else []
    c.add("태음귀인(太陰)","길신","연지",bool(h_te),{"year_branch":yb,"target":tgt_te,"hits":h_te})

    # 용덕귀인/봉덕귀인 — 연지 기준
    tgt_yd = YONGDEOK_YB.get(yb)
    h_yd = _hb([tgt_yd], branches) if tgt_yd else []
    c.add("용덕귀인(龍德)","길신","연지",bool(h_yd),{"year_branch":yb,"target":tgt_yd,"hits":h_yd})

    tgt_bd = BONGDEOK_YB.get(yb)
    h_bd = _hb([tgt_bd], branches) if tgt_bd else []
    c.add("봉덕귀인(鳳德)","길신","연지",bool(h_bd),{"year_branch":yb,"target":tgt_bd,"hits":h_bd})

    # 삼기귀인(三奇) — 천간 세트 체크 (기존 삼기와 별도로 분류)
    sset_stems = frozenset(stems)
    if SAMGI_HEAVEN.issubset(sset_stems):
        c.add("천삼기(天三奇)","길신","천간세트",True,{"stems":sorted(SAMGI_HEAVEN),"비고":"甲戊庚 모두 천간에 있음"})
    if SAMGI_EARTH.issubset(sset_stems):
        c.add("지삼기(地三奇)","길신","천간세트",True,{"stems":sorted(SAMGI_EARTH),"비고":"乙丙丁 모두 천간에 있음"})
    if SAMGI_HUMAN.issubset(sset_stems):
        c.add("인삼기(人三奇)","길신","천간세트",True,{"stems":sorted(SAMGI_HUMAN),"비고":"壬癸辛 모두 천간에 있음"})

    # 천살(天煞) — 삼합 기반 (THREE_SAL_BY_TRINE의 天煞를 한글화 별도 등록)
    for basis_name, base in TRINE_BASES:
        tri = get_trine(base)
        t_ts = THREE_SAL_BY_TRINE.get(tri, {}).get("天煞")
        h_ts = _hb([t_ts], branches) if t_ts else []
        c.add("천살(天煞)","흉살",basis_name,bool(h_ts),{"base":base,"trine":tri,"target":t_ts,"hits":h_ts})

    # 파살(破殺) — 지지파 조합
    PA_PAIRS = {("子","酉"),("酉","子"),("丑","辰"),("辰","丑"),("寅","亥"),("亥","寅"),
                ("卯","午"),("午","卯"),("巳","申"),("申","巳"),("未","戌"),("戌","未")}
    pa_hits = _pairs(branches, PA_PAIRS)
    c.add("파살(破殺)","흉살","지지조합",bool(pa_hits),{"pairs":pa_hits})

    # 충살(冲殺) — 지지충 기반
    chung_hits = _pairs(branches, BRANCH_CLASH)
    c.add("충살(冲殺)","흉살","지지조합",bool(chung_hits),{"pairs":chung_hits})

    # 형살(刑殺) — 지지형 기반
    hyung_hits = _pairs(branches, BRANCH_PUNISH)
    c.add("형살(刑殺)","흉살","지지조합",bool(hyung_hits),{"pairs":hyung_hits})

    # 공망 (일주 기준 + 년주 기준)
    year_gz = stems[0] + branches[0]
    emp_day = xunkong(day_gz); emp_day_h = _hb(emp_day, branches)
    emp_year = xunkong(year_gz); emp_year_h = _hb(emp_year, branches)
    return {"발현_신살":c.hits,"발현_수":c.hit_count,
            "공망":{
                "일주":day_gz,"순시작":day_xun_start(day_gz),
                "공망지지":emp_day,"원국_적중":emp_day_h,
                "년주":year_gz,"년주_순시작":day_xun_start(year_gz),
                "년주_공망지지":emp_year,"년주_원국_적중":emp_year_h,
            }}

# ──────────────────────────────────────────────
# SECTION 14 : 사주 관계 계산 [Q3 확장]
# ──────────────────────────────────────────────
def calc_relations(stems,branches)->Dict[str,Any]:
    """[Q3] 천간충·천간극·반합·삼합완성·방합 포함 전체 관계"""
    labels=["연","월","일","시"]
    pairs=[]

    for i in range(4):
        for j in range(i+1,4):
            si,sj=stems[i],stems[j]; bi,bj=branches[i],branches[j]
            rels=[]
            # 천간 관계
            if (si,sj) in STEM_COMBINE:
                rels.append(f"천간합({si}{sj})")
            if (si,sj) in STEM_CLASH:
                rels.append(f"천간충({si}↯{sj})")  # [추가]
            if (si,sj) in STEM_KE_PAIRS:
                rels.append(f"천간{_stem_ke_label(si,sj)}({si}克{sj})")
            # 지지 관계
            if (bi,bj) in BRANCH_COMBINE:
                rels.append(f"지지합({bi}{bj})")
            if (bi,bj) in BRANCH_CLASH:
                rels.append(f"지지충({bi}↯{bj})")
            if (bi,bj) in BRANCH_HARM:
                rels.append(f"지지해({bi}↦{bj})")
            if (bi,bj) in BRANCH_BREAK:
                rels.append(f"지지파({bi}×{bj})")
            if (bi,bj) in BRANCH_PUNISH:
                rels.append(f"지지형({_punish_type_label(bi,bj)}:{bi}刑{bj})")
            if (bi,bj) in WONJIN_PAIRS:
                rels.append(f"원진({bi}↔{bj})")
            # [추가] 반합
            rh=BRANCH_SEMI_COMBINE.get((bi,bj))
            if rh: rels.append(f"반합({rh}:{bi}{bj})")
            if rels:
                pairs.append({"between":f"{labels[i]}-{labels[j]}",
                              "stems":f"{si}-{sj}","branches":f"{bi}-{bj}","relations":rels})

    # [추가] 삼합/방합 – 3지지 전체 조합 체크
    bset=frozenset(branches); multi_rels=[]
    for tset,tname in TRINE_SETS.items():
        if tset.issubset(bset): multi_rels.append(f"삼합완성({tname})")
    for dset,dname in DIRECTION_SETS.items():
        if dset.issubset(bset): multi_rels.append(f"방합완성({dname})")

    return {"쌍별관계":pairs,"다지지관계":multi_rels}

# ──────────────────────────────────────────────
# SECTION 15 : 24절기 / 대운 / 세운 / 월운 (v3.1 개선)
# ──────────────────────────────────────────────
# [핵심 변경] 대운 기점 계산 시 절(節)만 사용, 중기(中氣) 제외
# 절기차÷3 = 대운 시작나이 (1일≈4개월, 나머지일 비례 반영)
# ──────────────────────────────────────────────

def _jd(dt):
    '''datetime → 율리우스일 변환'''
    y, m = dt.year, dt.month
    D = dt.day + (dt.hour + (dt.minute + dt.second / 60) / 60) / 24
    if m <= 2:
        y -= 1
        m += 12
    A = y // 100
    return int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + D + (2 - A + (A // 4)) - 1524.5


def _sunlon(dt):
    '''태양 황경 계산'''
    T = (_jd(dt) - 2451545) / 36525
    L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360
    M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360
    Mr = math.radians(M)
    om = math.radians((125.04 - 1934.136 * T) % 360)
    C = (
        (1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(Mr)
        + (0.019993 - 0.000101 * T) * math.sin(2 * Mr)
        + 0.000289 * math.sin(3 * Mr)
    )
    return (L0 + C - 0.00569 - 0.00478 * math.sin(om)) % 360


def _adiff(a, t):
    '''각도 차이 계산 (-180 ~ +180)'''
    return ((a - t + 540) % 360) - 180


def _bisect(d0, d1, tg, n=60):
    '''이분법으로 절기 시각 정밀 탐색 (1분 이내 정밀도)'''
    for _ in range(n):
        mid = d0 + (d1 - d0) / 2
        if (_adiff(_sunlon(d0), tg) <= 0) != (_adiff(_sunlon(mid), tg) <= 0):
            d1 = mid
        else:
            d0 = mid
        if (d1 - d0).total_seconds() <= 60:
            return mid
    return d0 + (d1 - d0) / 2


# ── 절(節) vs 중기(中氣) 구분 ──────────────────
# 절(節) 12개의 황경도:
# 소한=285, 입춘=315, 경칩=345, 청명=15, 입하=45, 망종=75,
# 소서=105, 입추=135, 백로=165, 한로=195, 입동=225, 대설=255

JEOL_DEGREES = [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255]
ALL_24_DEGREES = [i * 15.0 for i in range(24)]  # 0, 15, 30, …, 345


@lru_cache(maxsize=16)
def _terms(year):
    '''해당 연도의 24절기 datetime 목록 반환 (UTC)'''
    st = datetime(year - 1, 12, 20, tzinfo=UTC)
    en = datetime(year + 1, 1, 20, tzinfo=UTC)
    step = timedelta(hours=6)
    tgs = ALL_24_DEGREES
    t = st
    l0 = _sunlon(t)
    last = {g: _adiff(l0, g) for g in tgs}
    found = []
    t += step
    while t <= en:
        lon = _sunlon(t)
        for g in tgs:
            dp, dn = last[g], _adiff(lon, g)
            if (dp < 0 and dn >= 0) or (dp > 0 and dn <= 0):
                found.append(_bisect(t - step, t, g))
            last[g] = dn
        t += step
    found.sort()
    dd = []
    for x in found:
        if not dd or abs((x - dd[-1]).total_seconds()) > 3600:
            dd.append(x)
    y0 = datetime(year, 1, 1, tzinfo=UTC)
    y1 = datetime(year, 12, 31, 23, 59, tzinfo=UTC)
    r = [d for d in dd if y0 <= d <= y1]
    return r[:24] if len(r) >= 24 else sorted(dd[:24])


def _term_deg(year, deg):
    '''특정 황경도(deg)에 해당하는 절기 시각을 찾는다'''
    st = datetime(year - 1, 12, 15, tzinfo=UTC)
    en = datetime(year + 1, 1, 15, tzinfo=UTC)
    step = timedelta(hours=6)
    pt = st
    pd = _adiff(_sunlon(pt), float(deg))
    t = st + step
    while t <= en:
        d = _adiff(_sunlon(t), float(deg))
        if (pd < 0 and d >= 0) or (pd > 0 and d <= 0):
            # 실제 zero-crossing인지 확인 (180° 반대편 false crossing 제거)
            if abs(d) < 90:
                return _bisect(pt, t, float(deg)).astimezone(KST)
        pt, pd = t, d
        t += step
    return _terms(year)[0].astimezone(KST)


def _find_jeol_dates(year):
    '''해당 연도 전후의 절(節) 날짜만 추출하여 정렬 반환 (KST)'''
    results = []
    for y in (year - 1, year, year + 1):
        for deg in JEOL_DEGREES:
            try:
                dt = _term_deg(y, deg)
                results.append(dt)
            except Exception:
                continue
    # 중복 제거 및 정렬
    seen = set()
    unique = []
    for dt in sorted(results):
        key = dt.strftime('%Y%m%d%H')
        if key not in seen:
            seen.add(key)
            unique.append(dt)
    return unique


def _next_jeol(bkst, forward=True):
    '''
    생일(bkst, KST)로부터 순행이면 다음 절(節), 역행이면 이전 절(節)을 찾는다.
    대운 계산에서는 반드시 절(節)만 사용. 중기(中氣) 제외.
    '''
    jeol_dates = _find_jeol_dates(bkst.year)

    if forward:
        for dt in jeol_dates:
            if dt > bkst:
                return dt
    else:
        for dt in reversed(jeol_dates):
            if dt < bkst:
                return dt

    # fallback: 범위 확장
    extended = _find_jeol_dates(bkst.year + (1 if forward else -1))
    if forward:
        for dt in extended:
            if dt > bkst:
                return dt
    else:
        for dt in reversed(extended):
            if dt < bkst:
                return dt
    return jeol_dates[0] if forward else jeol_dates[-1]


def ipchun(year):
    '''입춘 시각 반환'''
    return _term_deg(year, 315)


def _year_gz(dtkst):
    '''해당 시점의 연간지 산출 (입춘 기준)'''
    y = dtkst.year
    ip = ipchun(y)
    ey = y if dtkst >= ip else y - 1
    return ey, GANZHI_60[(ganzhi_index('甲子') + (ey - 1984)) % 60]


# ── 대운 시작나이 계산 (v3.1 개선) ──────────────

def dw_start(bkst, fwd):
    '''
    대운 시작나이 산출 (절기차÷3 법)

    규칙:
    1. 순행(양남/음녀) → 생일~다음 절(節)까지 일수
    2. 역행(음남/양녀) → 이전 절(節)~생일까지 일수
    3. 일수 ÷ 3 = 대운 시작나이 (년)
    '''
    jeol_dt = _next_jeol(bkst, forward=fwd)

    if fwd:
        diff = jeol_dt - bkst
    else:
        diff = bkst - jeol_dt

    total_days = diff.total_seconds() / 86400.0
    start_age = total_days / 3.0

    start_age_rounded = round(start_age)
    start_age_precise = round(start_age, 1)

    return {
        'birth': str(bkst.date()),
        'jeol_date': jeol_dt.isoformat(),
        'direction': '순행(→다음절)' if fwd else '역행(←이전절)',
        'days_to_jeol': round(total_days, 1),
        'start_age': float(start_age_rounded),
        'start_age_precise': float(start_age_precise),
    }


# ── 기존 호환용 ────────────────────────────────

def _next_prev(bkst, fwd):
    '''하위 호환용 — 24절기 전체 기준 탐색 (세운/월운 등에서 사용)'''
    bu = bkst.astimezone(UTC)
    ts = []
    for y in (bu.year - 1, bu.year, bu.year + 1):
        ts.extend(_terms(y))
    ts.sort()
    if fwd:
        for t in ts:
            if t > bu:
                return t.astimezone(KST)
    else:
        for t in reversed(ts):
            if t < bu:
                return t.astimezone(KST)
    return (ts[0] if fwd else ts[-1]).astimezone(KST)


# ── 세운 ───────────────────────────────────────

def build_sewoon(now, n=20):
    '''세운 n년분 생성'''
    ey, _ = _year_gz(now)
    out = []
    for y in range(ey, ey + n):
        idx = (ganzhi_index('甲子') + (y - 1984)) % 60
        out.append({
            'year': y, 'ganzhi': GANZHI_60[idx],
            'start': ipchun(y).isoformat(), 'end': ipchun(y + 1).isoformat(),
        })
    return out


# ── 월운 ───────────────────────────────────────

MONTH_BD = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285]
MONTH_BRL = list('寅卯辰巳午未申酉戌亥子丑')


def _fms(ys):
    '''연상기월법 — 연간→월간 시작 천간'''
    if ys in ('甲', '己'):
        return '丙'
    if ys in ('乙', '庚'):
        return '戊'
    if ys in ('丙', '辛'):
        return '庚'
    if ys in ('丁', '壬'):
        return '壬'
    if ys in ('戊', '癸'):
        return '甲'
    raise ValueError(f'Invalid year stem: {ys}')


def build_wolwoon(now):
    '''월운 12개월분 생성'''
    ey, ygz = _year_gz(now)
    ys = ygz[0]
    bds = [_term_deg(ey, d) for d in MONTH_BD]
    ip = ipchun(ey)
    bds.sort()
    si = min(range(len(bds)), key=lambda i: abs((bds[i] - ip).total_seconds()))
    bds = bds[si:] + bds[:si]
    bds.append(ipchun(ey + 1))
    fs = _fms(ys)
    ssi = HEAVENLY_STEMS.index(fs)
    return [
        {
            'month_index': i + 1, 'branch': MONTH_BRL[i],
            'ganzhi': HEAVENLY_STEMS[(ssi + i) % 10] + MONTH_BRL[i],
            'start': bds[i].isoformat(), 'end': bds[i + 1].isoformat(),
        }
        for i in range(12)
    ]


# ── 성별/순역행 ───────────────────────────────

def _ng(g):
    '''성별 문자열 정규화'''
    x = g.strip().lower()
    if x in ('m', 'male', '남', '남자'):
        return 'male'
    if x in ('f', 'female', '여', '여자'):
        return 'female'
    raise ValueError(f'Invalid gender: {g}')


def is_fwd(gender, ys):
    '''양남음녀 순행/역행 판별'''
    g = _ng(gender)
    y = (YINYANG_STEM[ys] == '陽')
    return y if g == 'male' else (not y)


# ── 대운 간지 시퀀스 ──────────────────────────

def build_daewoon(mp, fwd, start_age, n=10):
    '''대운 간지 시퀀스 n개 생성'''
    step = 1 if fwd else -1
    cur = next_ganzhi(mp, step)
    age = start_age
    out = []
    for i in range(n):
        out.append({
            'index': i + 1,
            'start_age': round(age, 1),
            'end_age': round(age + 10, 1),
            'ganzhi': cur,
        })
        age += 10
        cur = next_ganzhi(cur, step)
    return out


# ──────────────────────────────────────────────
# SECTION 16 : BirthInput & compute_all
# ──────────────────────────────────────────────
@dataclass
class BirthInput:
    year:int; month:int; day:int; hour:int; minute:int=0
    calendar:str="solar"; is_leap_month:bool=False; gender:str="male"
    city:str="Seoul"; use_solar_time:bool=True; utc_offset:int=9; early_zi_time:bool=False

def enrich_saju(inp: BirthInput) -> Dict[str, Any]:
    import sys as _sys
    _dbg = _sys.stderr.write
    _dbg(f"[SAJU_DEBUG] original_input: {inp.year}-{inp.month:02d}-{inp.day:02d} {inp.hour:02d}:{inp.minute:02d}\n")
    _dbg(f"[SAJU_DEBUG] calendar={inp.calendar}, is_leap_month={inp.is_leap_month}, gender={inp.gender}\n")
    _dbg(f"[SAJU_DEBUG] early_zi_time={inp.early_zi_time}\n")

    # 음력 변환
    if inp.calendar.lower() in ("lunar", "음력"):
        sol = lunar_to_solar(inp.year, inp.month, inp.day, is_leap_month=inp.is_leap_month)
        sy, sm, sd, sol_m = sol["solar_year"], sol["solar_month"], sol["solar_day"], sol
        _dbg(f"[SAJU_DEBUG] lunar→solar: {inp.year}-{inp.month:02d}-{inp.day:02d} → {sy}-{sm:02d}-{sd:02d}\n")
    else:
        sy, sm, sd, sol_m = inp.year, inp.month, inp.day, None
        _dbg(f"[SAJU_DEBUG] solar input (no conversion): {sy}-{sm:02d}-{sd:02d}\n")

    bkst = datetime(sy, sm, sd, inp.hour, inp.minute, tzinfo=KST)
    _dbg(f"[SAJU_DEBUG] final_datetime(KST): {bkst.isoformat()}\n")
    try:
        saju = calculate_saju(sy, sm, sd, inp.hour, inp.minute, city=inp.city,
        use_solar_time=inp.use_solar_time, utc_offset=inp.utc_offset,
        early_zi_time=inp.early_zi_time)
    except TypeError:
        saju = calculate_saju(sy, sm, sd, inp.hour, inp.minute,
        use_solar_time=inp.use_solar_time, utc_offset=inp.utc_offset,
        early_zi_time=inp.early_zi_time)

    # ── 반시(半時) 경계 보정 ──────────────────────
    # 전통 시간 경계: 丑 01:30~03:30, 寅 03:30~05:30, ... (표준은 01:00~03:00, 03:00~05:00)
    # sajupy는 표준 경계 사용 → 반시 경계와 다를 때 시주를 보정한다.
    _HALFHOUR_BOUNDARIES = [
        (23, 30,  1, 30, "子"), ( 1, 30,  3, 30, "丑"), ( 3, 30,  5, 30, "寅"),
        ( 5, 30,  7, 30, "卯"), ( 7, 30,  9, 30, "辰"), ( 9, 30, 11, 30, "巳"),
        (11, 30, 13, 30, "午"), (13, 30, 15, 30, "未"), (15, 30, 17, 30, "申"),
        (17, 30, 19, 30, "酉"), (19, 30, 21, 30, "戌"), (21, 30, 23, 30, "亥"),
    ]
    def _halfhour_branch(h: int, m: int) -> str:
        t = h * 60 + m
        for sh, sm_, eh, em_, br in _HALFHOUR_BOUNDARIES:
            start = sh * 60 + sm_
            end = eh * 60 + em_
            if start > end:  # 子시: 23:30 ~ 01:30 wraps midnight
                if t >= start or t < end:
                    return br
            else:
                if start <= t < end:
                    return br
        return "子"

    # 오호결원법: 일간 → 시간 천간 시작 인덱스 (甲子=0)
    _DAY_STEM_HOUR_START = {
        "甲": 0, "己": 0, "乙": 2, "庚": 2, "丙": 4,
        "辛": 4, "丁": 6, "壬": 6, "戊": 8, "癸": 8,
    }
    def _hour_stem_from_day(day_st: str, hour_br: str) -> str:
        start = _DAY_STEM_HOUR_START[day_st]
        br_idx = EARTHLY_BRANCHES.index(hour_br)
        return HEAVENLY_STEMS[(start + br_idx) % 10]

    correct_hb = _halfhour_branch(inp.hour, inp.minute)
    sajupy_hb = saju["hour_branch"]
    if correct_hb != sajupy_hb:
        new_hs = _hour_stem_from_day(saju["day_stem"], correct_hb)
        _dbg(f"[SAJU_DEBUG] 반시보정: {saju['hour_stem']}{sajupy_hb}→{new_hs}{correct_hb} ({inp.hour:02d}:{inp.minute:02d})\n")
        saju["hour_stem"] = new_hs
        saju["hour_branch"] = correct_hb
        saju["hour_pillar"] = new_hs + correct_hb

    pillars = {"year": saju["year_pillar"], "month": saju["month_pillar"], "day": saju["day_pillar"], "hour": saju["hour_pillar"]}
    stems = [saju["year_stem"], saju["month_stem"], saju["day_stem"], saju["hour_stem"]]
    branches = [saju["year_branch"], saju["month_branch"], saju["day_branch"], saju["hour_branch"]]
    _dbg(f"[SAJU_DEBUG] pillars: 연={pillars['year']} 월={pillars['month']} 일={pillars['day']} 시={pillars['hour']}\n")
    ds = saju["day_stem"]; ys = saju["year_stem"]
    mb = saju["month_branch"]; mp = saju["month_pillar"]
    db = saju["day_branch"]

    # 천간지지 상세
    ganji = []
    for k, st, br in [("연주", stems[0], branches[0]), ("월주", stems[1], branches[1]), ("일주", stems[2], branches[2]), ("시주", stems[3], branches[3])]:
        hs = _hidden_stems_by_role(br)
        ganji.append({
            "주": k, "간지": st + br, "천간": st, "지지": br,
            "천간음양": YINYANG_STEM[st], "지지음양": YINYANG_BRANCH[br],
            "천간오행": STEM_ELEMENT[st], "지지오행": BRANCH_ELEMENT_MAIN[br],
            "지장간": hs, "지장간오행": [STEM_ELEMENT[x] for x in hs],
            "납음": nayin(st + br), "12운성": twelve_unseong(ds, br),
            "지지십성": branch_main_tg(ds, br),
        })

    # 십성
    ten_gods = {"연간": ten_god(ds, stems[0]), "월간": ten_god(ds, stems[1]), "시간": ten_god(ds, stems[3])}
    hidden_tg = {}
    for lbl, br in [("연지", branches[0]), ("월지", branches[1]), ("일지", branches[2]), ("시지", branches[3])]:
        hidden_tg[lbl] = [{"간": h, "십성": ten_god(ds, h)} for h in _hidden_stems_by_role(br)]

    # 오행 (v6: 6단계 다층 보정)
    ohang = ohang_imbalance(stems, branches, month_branch=mb, day_stem=ds)

    # 사주관계
    rels = calc_relations(stems, branches)
    pscr = pattern_score(rels["쌍별관계"])

    # 신살
    shinsal = build_shinsal_detail(stems, branches, pillars)
    hit_names = [h["name"] for h in shinsal["발현_신살"]]

    # 신강신약 (v3.3: 근묘화실 가중치)
    sc, vd = strength_score(ds, mb, stems, branches)

    # 격국 (v3.3: 정교화 – 투출/종격/건록격/양인격)
    geok = classify_geokguk(ds, mb, stems, branches, vd)

    # 용신 (v3.3: 억부+조후+통관+종격)
    yong = determine_yongshin(geok, vd, ds, mb, stems, branches)

    # 궁성론 (v3.3 + v6.2 진공/가공)
    natal_gm_info = classify_natal_gongmang(pillars["day"], pillars["year"], branches)
    gongmang = xunkong(pillars["day"])
    gungseong = build_gungseong(ds, stems, branches, pillars, gongmang, natal_gm_info)

    # DomainScore
    all_tg = {**ten_gods, **{f"{k}_{v['간']}": v["십성"] for k, vs in hidden_tg.items() for v in vs}}
    dscore = domain_score(geok["격국"], hit_names, all_tg, vd)

    # 대운/세운/월운
    fwd = is_fwd(inp.gender, ys)
    dw_m = dw_start(bkst, fwd)
    now = datetime.now(tz=KST)

    return {
        "입력": {"달력": inp.calendar, "년": inp.year, "월": inp.month, "일": inp.day,
        "시": inp.hour, "분": inp.minute, "성별": inp.gender, "음력→양력": sol_m},
        "원국": pillars,
        "천간지지_상세": ganji,
        "오행분포": ohang,
        "십성(천간)": ten_gods,
        "지장간_십성": hidden_tg,
        "사주관계": rels,
        "패턴점수": pscr,
        "신살길성": shinsal,
        "신강신약": {"점수": sc, "판정": vd},
        "격국": geok,
        "용신": yong,
        "궁성론": gungseong,
        "공망분류": natal_gm_info,
        "DomainScore": dscore,
        "대운": {
            "방향": "순행" if fwd else "역행",
            "시작나이": dw_m["start_age"],
            "시작나이_정밀": dw_m.get("start_age_precise", dw_m["start_age"]),
            "블록": build_daewoon(mp, fwd, dw_m.get("start_age_precise", dw_m["start_age"])),
            "메타": dw_m,
        },
        "세운": build_sewoon(now, 20),
        "월운": build_wolwoon(now),
    } 

# ══════════════════════════════════════════════

# SECTION 16-A : 궁성론 (v3.3 신규)

# ══════════════════════════════════════════════

# 궁성(宮城): 각 기둥이 인생의 어떤 영역을 담당하는지

# 연주=조상/사회, 월주=부모/직업, 일주=배우자/자신, 시주=자녀/말년

_GUNGSEONG = {
    "연주": {"궁": "조상궁·사회궁", "영역": "조상, 사회적 환경, 유년기(1~15세)"},
    "월주": {"궁": "부모궁·직업궁", "영역": "부모, 직업/학업, 청년기(16~30세)"},
    "일주": {"궁": "배우자궁·자아궁", "영역": "배우자, 자기 자신, 중년기(31~45세)"},
    "시주": {"궁": "자녀궁·말년궁", "영역": "자녀, 제자, 말년(46세~)"},
}

def build_gungseong(day_stem: str, stems: List[str], branches: List[str],
                    pillars: Dict[str, str], gongmang: List[str],
                    natal_gm_info: Optional[Dict] = None) -> List[Dict[str, Any]]:
    """궁성별 십성 + 공망(진공/가공) + 12운성 조합 분석"""
    labels = ["연주", "월주", "일주", "시주"]
    pillar_keys = ["year", "month", "day", "hour"]
    # 년주 공망 지지도 포함
    year_gm = xunkong(pillars["year"]) if pillars.get("year") else []
    all_gm = set(gongmang) | set(year_gm)
    # natal_gm_info에서 각 기둥의 공망 유형 조회
    _hit_map: Dict[int, Dict] = {}
    if natal_gm_info:
        for hit in natal_gm_info.get("all_hits", []):
            _hit_map[hit["pillar_idx"]] = hit
    result = []
    for i, label in enumerate(labels):
        st, br = stems[i], branches[i]
        gz = pillars[pillar_keys[i]]
        tg_stem = ten_god(day_stem, st) if i != 2 else "일간(본인)"
        tg_branch = branch_main_tg(day_stem, br)
        unseong = twelve_unseong(day_stem, br)
        is_gongmang = br in all_gm and i != 2
        gm_hit = _hit_map.get(i)
        gm_type = gm_hit["type"] if gm_hit else None
        gm_source = gm_hit["source"] if gm_hit else None
        hidden_tg = [{"간": h, "십성": ten_god(day_stem, h)} for h in _hidden_stems_by_role(br)]
        info = _GUNGSEONG[label]
        warnings = []
        if is_gongmang and gm_type:
            if gm_type == "진공":
                warnings.append(f"{info['궁']}에 공망(진공)→해당 영역의 기운이 비어 실질적 결과 약화")
            elif gm_type == "가공(합)":
                warnings.append(f"{info['궁']}에 공망이나 합으로 해소(가공)→영향 미미")
            elif gm_type == "가공(충)":
                warnings.append(f"{info['궁']}에 공망이나 충으로 일부 해소(가공)→영향 약화")
        elif is_gongmang:
            warnings.append(f"{info['궁']}에 공망→해당 영역 허(虛)한 기운, 실질적 결과 약화 가능")
        # 12운성 약세
        if unseong in ("사", "묘", "절"):
            warnings.append(f"{info['궁']}에 {unseong}→해당 영역 에너지 약함")
        # 12운성 강세
        if unseong in ("제왕", "건록", "장생"):
            warnings.append(f"{info['궁']}에 {unseong}→해당 영역 에너지 강함")
        # 양인이 해당 궁에 있는 경우
        if br == YANGREN.get(day_stem):
            warnings.append(f"{info['궁']}에 양인 해당 영역에서 과격한 에너지, 갈등 주의")
        # 도화가 해당 궁에 있는 경우
        tri = get_trine(branches[0])
        if PEACH_BY_TRINE.get(tri) == br:
            warnings.append(f"{info['궁']}에 도화 해당 영역에서 매력 발산, 이성 인연")
        # 역마가 해당 궁에 있는 경우
        if HORSE_BY_TRINE.get(tri) == br:
            warnings.append(f"{info['궁']}에 역마 해당 영역에서 이동 및 변화 에너지")
        
        result.append({
            "궁": label,
            "궁성": info["궁"],
            "영역": info["영역"],
            "간지": gz,
            "천간십성": tg_stem,
            "지지십성": tg_branch,
            "12운성": unseong,
            "공망여부": is_gongmang,
            "공망유형": gm_type,
            "공망출처": gm_source,
            "지장간십성": hidden_tg,
            "특이사항": warnings,
        })
    return result

# ──────────────────────────────────────────────
# SECTION 17 : JSON 직렬화 출력 (v3.1 교체)
# ──────────────────────────────────────────────

import json as _json
from datetime import datetime, timedelta
from typing import Dict, Any


def _make_serializable(obj):
    """dict/list 내부의 non-serializable 타입을 재귀적으로 변환"""

    if isinstance(obj, dict):
        return {str(k): _make_serializable(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple)):
        return [_make_serializable(v) for v in obj]

    if isinstance(obj, (set, frozenset)):
        return sorted(_make_serializable(v) for v in obj)

    if isinstance(obj, datetime):
        return obj.isoformat()

    if isinstance(obj, timedelta):
        return obj.total_seconds()

    if isinstance(obj, float):
        if obj != obj:  # NaN 체크
            return None
        return obj

    if isinstance(obj, (int, str, bool)) or obj is None:
        return obj

    # 기타 타입은 문자열 변환
    return str(obj)


def saju_to_json(
    r: Dict[str, Any],
    indent: int = 2,
    ensure_ascii: bool = False
) -> str:
    """enrich_saju 결과 dict → JSON 문자열"""
    return _json.dumps(
        _make_serializable(r),
        indent=indent,
        ensure_ascii=ensure_ascii
    )


def saju_to_dict(r: Dict[str, Any]) -> Dict[str, Any]:
    """enrich_saju 결과 → JSON-safe dict (API 응답용)"""
    return _make_serializable(r)




# ── 신살 가중치 (귀인력 산출용) ─────────────────
_SHINSAL_WEIGHT = {
    "천을귀인(天乙)": 5, "문창귀인(文昌)": 3, "록신(祿神)": 4,
    "장성(將星)": 4, "홍란(紅鸞)": 3, "천희(天喜)": 3,
    "태극귀인(太極)": 2, "국인귀인(國印)": 2, "복성귀인(福星)": 2,
    "학당귀인(學堂)": 2, "사관귀인(詞館)": 2, "반안(攀鞍)": 2,
    "천덕귀인(天德)": 3, "월덕귀인(月德)": 3, "천덕합(天德合)": 2,
    "월덕합(月德合)": 2, "삼기": 3, "금여": 2, "암록": 2, "협록": 2,
    "천관귀인": 2, "문곡귀인": 2, "복덕살": 2, "천후귀인": 2, "천하귀인": 2,
    "도화(桃花)": -2, "역마(驛馬)": -1, "양인(羊刃)": -4,
    "백호살(白虎)": -5, "괴강(魁罡)": -2, "고란(孤鸞)": -3,
    "귀문관살(鬼門關)": -3, "고진(孤辰)": -3, "과숙(寡宿)": -3,
    "원진살(怨嗔)": -2, "현침살(懸針)": -2, "격각살(格角)": -2,
    "금신살(金神)": -2, "음양차착살": -2, "천라(天羅)": -2, "지망(地網)": -2,
    "망신(亡神)": -2, "겁살(劫殺)": -2, "함지살(咸池)": -2,
    # [Fix-9] 추가 신살
    "관귀살(官貴)": 3, "천복귀인(天福)": 2, "관록살(官祿)": 3,
    "천은(天恩)": 2, "명예살": 2, "목덕살(月德)": 2,
    "현광살(懸光)": -2, "연살(年殺)": -2, "휴식살(休息)": -1,
    "재살(災殺)": -3, "육해살(六害)": -2,
    # [Fix-16] 추가
    "천시귀인(天時)": 2, "천관성(天官)": 3, "천수성(天壽)": 2,
    "천문성(天門)": 1, "금여록(金輿祿)": 3, "옥당귀인(玉堂)": 2,
    "권세귀인(權勢)": 3, "천계귀인(天界)": 2, "봉각(鳳閣)": 2,
    "태양귀인(太陽)": 2, "태음귀인(太陰)": 2, "용덕귀인(龍德)": 2,
    "봉덕귀인(鳳德)": 2, "천삼기(天三奇)": 4, "지삼기(地三奇)": 3,
    "인삼기(人三奇)": 3, "천살(天煞)": -3, "파살(破殺)": -2,
    "충살(冲殺)": -3, "형살(刑殺)": -3,
}

_REL_WEIGHT = {
    "합": 0.9, "반합": 0.5,
    "충": -1.5, "파": -1.2, "형": -1.0, "해": -0.7, "원진": -0.4, "극": -0.6,
}

_EVENT_TRIGGERS = {
    "이직_전환": {
        "shinsal": {"역마(驛馬)": 25, "겁살(劫殺)": 10, "양인(羊刃)": 8},
        "relation": {"충": 20, "형": 10, "파": 12},
        "unseong": {"절": 15, "묘": 10, "사": 8},
        "tengo": {"편관": 12, "상관": 10, "겁재": 8},
    },
    "연애_결혼": {
        "shinsal": {"도화(桃花)": 25, "홍란(紅鸞)": 20, "천희(天喜)": 15, "함지살(咸池)": 10},
        "relation": {"합": 15},
        "unseong": {"목욕": 12, "장생": 8},
        "tengo": {"정재": 12, "편재": 10, "정관": 8},
    },
    "건강_주의": {
        "shinsal": {"백호살(白虎)": 25, "귀문관살(鬼門關)": 15},
        "relation": {"충": 12, "형": 10},
        "unseong": {"병": 20, "사": 18, "묘": 12, "절": 10},
        "tengo": {"편관": 8},
    },
    "재물_기회": {
        "shinsal": {"록신(祿神)": 15, "천을귀인(天乙)": 10, "금여": 8},
        "relation": {"합": 12, "반합": 8},
        "unseong": {"건록": 12, "제왕": 15, "장생": 8, "관대": 8},
        "tengo": {"정재": 18, "편재": 15, "식신": 10},
    },
    "학업_시험": {
        "shinsal": {"문창귀인(文昌)": 20, "학당귀인(學堂)": 15, "문곡귀인": 12, "사관귀인(詞館)": 10},
        "relation": {"합": 8},
        "unseong": {"관대": 10, "건록": 8, "장생": 8},
        "tengo": {"정인": 15, "편인": 12},
    },
    "대인_갈등": {
        "shinsal": {"원진살(怨嗔)": 20, "귀문관살(鬼門關)": 15, "고진(孤辰)": 12, "과숙(寡宿)": 10},
        "relation": {"충": 15, "형": 12, "해": 10, "극": 8},
        "unseong": {"쇠": 8},
        "tengo": {"편관": 10, "겁재": 10, "상관": 8},
    },
}


def _calc_yongshin_power(dw_fit, sw_fit=None):
    """[v6] float 부합도 반영 (구신 포함)"""
    p = 0.0
    p += float(dw_fit.get("용신부합", 0)) * 0.3
    p += float(dw_fit.get("희신부합", 0)) * 0.15
    p -= float(dw_fit.get("기신부합", 0)) * 0.25
    p -= float(dw_fit.get("구신부합", 0)) * 0.1
    if sw_fit:
        p += float(sw_fit.get("용신부합", 0)) * 0.3
        p += float(sw_fit.get("희신부합", 0)) * 0.15
        p -= float(sw_fit.get("기신부합", 0)) * 0.25
        p -= float(sw_fit.get("구신부합", 0)) * 0.1
    return max(-1.0, min(1.0, round(p, 2)))


_UNSEONG_SEVERITY_MULT = {
    "제왕": 1.2, "건록": 1.15, "장생": 1.1, "관대": 1.05,
    "사": 1.15, "묘": 1.1, "절": 1.2, "병": 1.1,
}

def _extract_rel_keys(rels_list, unseong=""):
    uns_mult = _UNSEONG_SEVERITY_MULT.get(unseong, 1.0)
    pos, neg = 0.0, 0.0
    keys = []
    items = []
    for r in (rels_list or []):
        if isinstance(r, dict): items.extend(r.get("relations", []) or [])
        elif isinstance(r, str): items.append(r)
        elif isinstance(r, list): items.extend([str(x) for x in r])
        else: items.append(str(r))
    for r_str in items:
        for k, w in _REL_WEIGHT.items():
            if k in r_str:
                keys.append(k)
                if w > 0: pos += abs(w) * uns_mult
                else: neg += abs(w) * uns_mult
                break
    return round(pos, 2), round(neg, 2), keys


def _calc_energy_field(rels_orig, rels_dw=None, yong_info=None,
                       inc_stem="", inc_branch="",
                       orig_stems=None, orig_branches=None):
    """[v5] 타격받는 원국 기둥 기준으로 합충 길흉 판정."""
    if yong_info and orig_stems:
        extractor = lambda rl: _weighted_rel_score_v2(
            rl, yong_info, orig_stems, orig_branches or [])
    else:
        extractor = _extract_rel_keys
    p1, n1, k1 = extractor(rels_orig)
    p2, n2, k2 = (0.0, 0.0, [])
    if rels_dw is not None:
        p2, n2, k2 = _extract_rel_keys(rels_dw)
    raw_dir = (p1 + p2) - (n1 + n2)
    clamped_dir = max(-_ENERGY_DIR_CLAMP, min(_ENERGY_DIR_CLAMP, raw_dir))
    return {
        "total": round(p1 + n1 + p2 + n2, 2),
        "positive": round(p1 + p2, 2),
        "negative": round(n1 + n2, 2),
        "direction": round(clamped_dir, 2),
        "keys": k1 + k2,
    }


# ── [v5] 명리학 원칙: 합충의 길흉은 "타격받는 원국 요소"가 용신/기신인지로 판정.
# incoming이 아니라 target(원국 기둥)의 오행을 보는 것이 정통 명리학 관점.
_REL_GUARD_MAX = 1.4  # 관계 가중치 절대값 상한 (이중 카운트 방지)
_ENERGY_DIR_CLAMP = 4.5  # energy_field direction 절대값 상한

def _weighted_rel_score_v2(rels_list, yong_info, orig_stems, orig_branches):
    """[v5] 타격받는 원국 기둥의 용/희/기 여부로 합충 길흉 판정."""
    if not yong_info:
        return _extract_rel_keys(rels_list)

    yong_e = yong_info.get("용신_오행", "")
    hee_es = set(yong_info.get("희신_오행", []))
    gi_es = set(yong_info.get("기신_오행", []))
    labels = ["연", "월", "일", "시"]

    pos, neg = 0.0, 0.0
    keys = []

    for r in (rels_list or []):
        if not isinstance(r, dict):
            for r_str in ([r] if isinstance(r, str) else r if isinstance(r, list) else [str(r)]):
                for k, w in _REL_WEIGHT.items():
                    if k in str(r_str):
                        keys.append(k)
                        if w > 0: pos += min(abs(w), _REL_GUARD_MAX)
                        else: neg += min(abs(w), _REL_GUARD_MAX)
                        break
            continue

        # pillar_idx 우선, fallback to label parsing
        pidx = r.get("pillar_idx")
        if pidx is None:
            with_label = r.get("with", "")
            pidx = next((i for i, lb in enumerate(labels)
                         if with_label.startswith(lb)), None)

        target_elems = set()
        if pidx is not None and orig_stems and pidx < len(orig_stems):
            target_elems.add(STEM_ELEMENT.get(orig_stems[pidx], ""))
            target_elems.add(BRANCH_ELEMENT_MAIN.get(
                orig_branches[pidx] if orig_branches and pidx < len(orig_branches) else "", ""))
        target_elems.discard("")

        tgt_yh = bool(target_elems & ({yong_e} | hee_es))
        tgt_gi = bool(target_elems & gi_es)

        for r_str in r.get("relations", []):
            for k, w in _REL_WEIGHT.items():
                if k not in r_str:
                    continue
                keys.append(k)
                aw = min(abs(w), _REL_GUARD_MAX)
                if w > 0:  # 합/반합
                    if tgt_gi:
                        pos += aw * 1.1   # 기신 합거(약하게 길)
                    elif tgt_yh:
                        neg += aw * 0.7   # 용신 합거(약하게 흉)
                    else:
                        pos += aw
                else:  # 충/형/파/해/원진/극
                    if tgt_gi:
                        pos += aw * 0.9   # 기신 충제거(강하게 길)
                    elif tgt_yh:
                        neg += aw * 1.4   # 용신 충손상(강하게 흉)
                    else:
                        neg += aw
                break

    return round(pos, 2), round(neg, 2), keys


def _calc_noble_power(gil_list, hyung_list):
    sc = 0
    for name in gil_list:
        matched = False
        for k, w in _SHINSAL_WEIGHT.items():
            if (k in name) or (name in k): sc += int(w); matched = True; break
        if not matched: sc += 2
    for name in hyung_list:
        matched = False
        for k, w in _SHINSAL_WEIGHT.items():
            if (k in name) or (name in k): sc += int(w); matched = True; break
        if not matched: sc -= 2
    return max(-15, min(15, sc))


def _calc_tengo_balance(day_stem, extra_stems, extra_branches):
    """십성 밸런스 (레이더 차트용). 천간은 1.0, 지지는 지장간 역할별 가중치 반영."""
    bal = {"비겁": 0.0, "식상": 0.0, "재성": 0.0, "관살": 0.0, "인성": 0.0}
    for s in extra_stems:
        if s in STEM_ELEMENT:
            tg = ten_god(day_stem, s)
            cat = _TENGO_CATEGORY.get(tg)
            if cat:
                bal[cat] += 1.0
    for b in extra_branches:
        for h, _role, w in get_jijanggan(b):
            tg = ten_god(day_stem, h)
            cat = _TENGO_CATEGORY.get(tg)
            if cat:
                bal[cat] += w
    return {k: round(v, 2) for k, v in bal.items()}


def _calc_season_tag(yong_power, energy_total, energy_direction):
    if yong_power >= 0.3 and energy_total >= 2.0:
        return {"tag": "확장기", "emoji": "🚀", "desc": "에너지와 운이 함께 상승하는 시기"}
    if yong_power >= 0.2 and energy_total < 2.0:
        return {"tag": "안정기", "emoji": "🏠", "desc": "큰 변화 없이 안정적으로 운이 유지되는 시기"}
    if abs(yong_power) < 0.2 and energy_total >= 2.0:
        return {"tag": "전환기", "emoji": "🔄", "desc": "합과 충이 교차하여 큰 변화가 예상되는 시기"}
    if yong_power <= -0.2 and energy_total < 1.5:
        return {"tag": "인내기", "emoji": "❄️", "desc": "에너지가 낮고 운이 약한 시기, 내실을 다질 때"}
    if yong_power <= -0.1 and energy_total >= 2.0:
        return {"tag": "격변기", "emoji": "⚡", "desc": "위기와 기회가 공존하는 시기, 큰 결단이 필요"}
    return {"tag": "평온기", "emoji": "🌿", "desc": "무난하고 평탄한 시기"}


def _calc_event_probabilities(shinsal_all, rel_keys, unseong, tengo_list):
    result = {}
    for evt, triggers in _EVENT_TRIGGERS.items():
        prob = 5
        shinsal_triggers = triggers.get("shinsal", {})
        for name in shinsal_all:
            # 한글 부분만 추출하여 정확한 매칭 (한자 괄호 무시)
            name_kr = name.split("(")[0].strip()
            for k, v in shinsal_triggers.items():
                k_kr = k.split("(")[0].strip()
                if name_kr == k_kr or k_kr in name_kr:
                    prob += v
                    break
        for k in rel_keys:
            prob += triggers.get("relation", {}).get(k, 0)
        prob += triggers.get("unseong", {}).get(unseong, 0)
        for tg in tengo_list:
            prob += triggers.get("tengo", {}).get(tg, 0)
        result[evt] = int(min(95, max(5, prob)))
    return result


# ──────────────────────────────────────────────
# SECTION 18 : 대운·세운 상세 분석 엔진 (v3.2 신규)
# ──────────────────────────────────────────────
# 주식 차트 비유:
# 캔들(OHLC)  = 종합운점수(score/trend)
# 거래량      = 길신카운트
# RSI         = 용신력
# 변동성      = 충격지수
# MACD        = 오행균형도
# ──────────────────────────────────────────────

from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta

# (옵션) 십성→도메인 점수 보정 맵이 아직 없으면 빈 dict로라도 두세요.
# 프로젝트 어딘가에 _TG_DOM이 이미 정의돼 있으면 이 줄은 제거해도 됩니다.
try:
    _TG_DOM
except NameError:
    _TG_DOM: Dict[str, Dict[str, float]] = {}

# ── 12운성 점수 매핑 ───────────────────────────
_UNSEONG_SCORE = {
    "장생": 10, "목욕": 2, "관대": 8, "건록": 10, "제왕": 12,
    "쇠": -2, "병": -6, "사": -10, "묘": -8, "절": -12, "태": 0, "양": 4,
}

# ── [v5] 12운성 신강/신약별 감쇠 승수 (0.0~1.0만 허용, 부호 반전 금지) ──
# 명리학 원칙: 신강이면 왕성한 운성의 *양적 효과*가 줄어들 뿐, 부호가 뒤집히지 않는다.
# 신강+제왕: 양 효과 거의 소멸(0.05) + 별도 과잉 penalty로 처리.
# 신강+사/절: 원래 음의 부호 유지, 감쇠만 적용(절대 양으로 전환 안 함).
_UNSEONG_VERDICT_MULT = {
    #                  약/중화  신강   태강   극왕
    "장생":           (1.0,    0.25,  0.15,  0.1),
    "목욕":           (1.0,    0.8,   0.75,  0.7),
    "관대":           (1.0,    0.35,  0.2,   0.15),
    "건록":           (1.0,    0.15,  0.08,  0.05),
    "제왕":           (1.0,    0.05,  0.02,  0.0),
    "쇠":             (1.0,    0.5,   0.4,   0.35),
    "병":             (1.0,    0.3,   0.25,  0.2),
    "사":             (1.0,    0.15,  0.12,  0.1),
    "묘":             (1.0,    0.2,   0.15,  0.1),
    "절":             (1.0,    0.1,   0.07,  0.05),
    "태":             (1.0,    1.0,   1.0,   1.0),
    "양":             (1.0,    0.65,  0.55,  0.45),
}

# 신강에서 양의 운성이 올 때 별도 고정 감점 (과잉 부담)
_SINGANG_EXCESS_PENALTY = {
    #               신강    태강    극왕
    "제왕":        (-2.0,  -3.0,  -4.0),
    "건록":        (-1.0,  -1.8,  -2.5),
    "장생":        (-0.5,  -0.8,  -1.0),
    "관대":        (-0.5,  -0.8,  -1.0),
}


def _unseong_mult(unseong: str, verdict: str, geok_type: str) -> float:
    """12운성 감쇠 승수 반환. 항상 0.0~1.0 — 부호를 절대 뒤집지 않는다."""
    if geok_type in ("종격", "화격") or geok_type.startswith("외격"):
        return 1.0
    tup = _UNSEONG_VERDICT_MULT.get(unseong, (1.0, 1.0, 1.0, 1.0))
    if verdict == "극왕":
        return tup[3]
    if verdict == "태강":
        return tup[2]
    if verdict == "신강":
        return tup[1]
    return tup[0]


def _singang_excess_pen(unseong: str, verdict: str, geok_type: str) -> float:
    """신강 이상 과잉 penalty (항상 ≤ 0). 승수와 독립된 고정 감점 항."""
    if geok_type in ("종격", "화격") or geok_type.startswith("외격"):
        return 0.0
    tup = _SINGANG_EXCESS_PENALTY.get(unseong)
    if not tup:
        return 0.0
    if verdict == "극왕":
        return tup[2]
    if verdict == "태강":
        return tup[1]
    if verdict == "신강":
        return tup[0]
    return 0.0


# ── [v5] 월운 가산 혼합 상수 ──────────────────────
# 명리학 원칙: 나쁜 해에서도 용신 월운이면 실질 회복 가능해야 함.
# 기존 곱셈 모델(sw*1±25%)은 기조가 나쁘면 월운 변동이 소멸되는 결함.
MONTH_BLEND_SW = 0.65     # 세운 base 비중 (YEAR_BLEND_WEIGHT)
MONTH_BLEND_MW = 0.35     # 월운 독립점수 비중

# ── [v5] 용신/희신/기신 부합 판정: float 0.0~1.0 (get_jijanggan 기반) ──
# 명리학 원칙: 천간/지지 본기/중기/여기 위치에 따라 부합 강도가 다르다.
# 본기에 용신 오행이 있으면 강한 부합, 여기에만 있으면 약한 부합.
_STEM_FIT_W = 0.35  # 천간 가중치

def _check_yongshin_fit(stem: str, branch: str, yong_info: Dict[str, Any], day_stem: str) -> Dict[str, float]:
    """대운/세운 간지의 용신 부합도 (0.0~1.0). get_jijanggan 기반."""
    yong_e = yong_info.get("용신_오행", "?")
    hee_es = set(yong_info.get("희신_오행", []))
    gi_es = set(yong_info.get("기신_오행", []))
    gu_es = set(yong_info.get("구신_오행", []))

    se = STEM_ELEMENT[stem]
    jj = get_jijanggan(branch)

    def _score(target_set):
        stem_sc = _STEM_FIT_W if se in target_set else 0.0
        branch_sc = 0.0
        for hs, _role, w in jj:
            if STEM_ELEMENT[hs] in target_set:
                branch_sc += w
        total = min(1.0, round(stem_sc + branch_sc, 2))
        return round(stem_sc, 2), round(branch_sc, 2), total

    y_stem, y_branch, y_total = _score({yong_e})
    h_stem, h_branch, h_total = _score(hee_es)
    g_stem, g_branch, g_total = _score(gi_es)
    u_stem, u_branch, u_total = _score(gu_es)

    return {
        "용신부합": y_total,
        "용신부합_천간": y_stem,
        "용신부합_지지": y_branch,
        "희신부합": h_total,
        "희신부합_천간": h_stem,
        "희신부합_지지": h_branch,
        "기신부합": g_total,
        "기신부합_천간": g_stem,
        "기신부합_지지": g_branch,
        "구신부합": u_total,
        "구신부합_천간": u_stem,
        "구신부합_지지": u_branch,
    }

# ── 외래 간지 vs 원국 관계 분석 ─────────────────
def _calc_incoming_relations(
    inc_stem: str,
    inc_branch: str,
    orig_stems: List[str],
    orig_branches: List[str]
) -> List[Dict[str, Any]]:
    """외부 간지(대운/세운)와 원국 4주 간의 관계 목록.
    [v5] pillar_idx(0~3) 필드 추가 — 타격대상 기준 길흉 판정에 사용."""
    labels = ["연", "월", "일", "시"]
    rels: List[Dict[str, Any]] = []

    for i in range(4):
        os, ob = orig_stems[i], orig_branches[i]
        pairs: List[str] = []

        # 천간
        if (inc_stem, os) in STEM_COMBINE:
            pairs.append(f"천간합({inc_stem}{os})")
        if (inc_stem, os) in STEM_CLASH:
            pairs.append(f"천간충({inc_stem}↯{os})")
        if (inc_stem, os) in STEM_KE_PAIRS:
            pairs.append(f"천간{_stem_ke_label(inc_stem,os)}({inc_stem}克{os})")

        # 지지
        if (inc_branch, ob) in BRANCH_COMBINE:
            pairs.append(f"지지합({inc_branch}{ob})")
        if (inc_branch, ob) in BRANCH_CLASH:
            pairs.append(f"지지충({inc_branch}↯{ob})")
        if (inc_branch, ob) in BRANCH_HARM:
            pairs.append(f"지지해({inc_branch}↦{ob})")
        if (inc_branch, ob) in BRANCH_BREAK:
            pairs.append(f"지지파({inc_branch}×{ob})")
        if (inc_branch, ob) in BRANCH_PUNISH:
            pairs.append(f"지지형({_punish_type_label(inc_branch,ob)}:{inc_branch}刑{ob})")
        if (inc_branch, ob) in WONJIN_PAIRS:
            pairs.append(f"원진({inc_branch}↔{ob})")

        rh = BRANCH_SEMI_COMBINE.get((inc_branch, ob))
        if rh:
            pairs.append(f"반합({rh}:{inc_branch}{ob})")

        if pairs:
            rels.append({
                "with": f"{labels[i]}주({os}{ob})",
                "pillar_idx": i,
                "with_pillar_key": labels[i],
                "relations": pairs,
            })

    return rels


def _calc_two_pillar_relations(s1: str, b1: str, s2: str, b2: str) -> List[str]:
    """두 기둥(대운 vs 세운) 간 관계"""
    rels: List[str] = []
    if (s1, s2) in STEM_COMBINE:
        rels.append(f"천간합({s1}{s2})")
    if (s1, s2) in STEM_CLASH:
        rels.append(f"천간충({s1}↯{s2})")
    if (s1, s2) in STEM_KE_PAIRS:
        rels.append(f"천간{_stem_ke_label(s1,s2)}({s1}克{s2})")

    if (b1, b2) in BRANCH_COMBINE:
        rels.append(f"지지합({b1}{b2})")
    if (b1, b2) in BRANCH_CLASH:
        rels.append(f"지지충({b1}↯{b2})")
    if (b1, b2) in BRANCH_HARM:
        rels.append(f"지지해({b1}↦{b2})")
    if (b1, b2) in BRANCH_BREAK:
        rels.append(f"지지파({b1}×{b2})")
    if (b1, b2) in BRANCH_PUNISH:
        rels.append(f"지지형({_punish_type_label(b1,b2)}:{b1}刑{b2})")
    if (b1, b2) in WONJIN_PAIRS:
        rels.append(f"원진({b1}↔{b2})")

    rh = BRANCH_SEMI_COMBINE.get((b1, b2))
    if rh:
        rels.append(f"반합({rh}:{b1}{b2})")
    return rels


# ── 외래 지지의 간이 신살 체크 ──────────────────
def _check_incoming_shinsal(inc_branch: str, day_stem: str, year_branch: str,
                            all_branches: List[str] = None) -> Tuple[List[str], List[str]]:
    """대운/세운 지지가 원국 기준으로 발현시키는 신살 목록
    all_branches: 원국 4주 지지 [연지,월지,일지,시지] — 삼합 기반 신살의 base 확장용
    """
    hits_gil: List[str] = []
    hits_hyung: List[str] = []
    ds = day_stem

    bases = all_branches if all_branches else [year_branch]

    seen_peach = seen_horse = seen_general = False
    for base_br in bases:
        tri = get_trine(base_br)
        if not seen_peach and PEACH_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("도화(桃花)"); seen_peach = True
        if not seen_horse and HORSE_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("역마(驛馬)"); seen_horse = True
        if not seen_general and GENERAL_STAR_BY_TRINE.get(tri) == inc_branch:
            hits_gil.append("장성(將星)"); seen_general = True

    # 화개/반안/망신/겁살 — build_shinsal_detail과 동일하게 4주 base
    seen_hwagae = seen_banan = seen_mangshin = seen_geobsal = False
    for base_br in bases:
        tri = get_trine(base_br)
        if not seen_hwagae and FLORAL_CANOPY_BY_TRINE.get(tri) == inc_branch:
            hits_gil.append("화개(華蓋)"); seen_hwagae = True
        if not seen_banan and PANAN_BY_TRINE.get(tri) == inc_branch:
            hits_gil.append("반안(攀鞍)"); seen_banan = True
        if not seen_mangshin and WANGSHEN_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("망신(亡神)"); seen_mangshin = True
        if not seen_geobsal and JIESHA_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("겁살(劫殺)"); seen_geobsal = True

    if inc_branch in NOBLEMAN_TIAN_YI.get(ds, []):
        hits_gil.append("천을귀인(天乙)")
    if inc_branch == WENCHANG.get(ds):
        hits_gil.append("문창귀인(文昌)")
    if inc_branch == LUXING.get(ds):
        hits_gil.append("록신(祿神)")
    if inc_branch == YANGREN.get(ds):
        hits_hyung.append("양인(羊刃)")

    if inc_branch == HONGRAN_YB.get(year_branch):
        hits_gil.append("홍란(紅鸞)")
    if inc_branch == TIANXI_YB.get(year_branch):
        hits_gil.append("천희(天喜)")
    if inc_branch == GUCHEN_YB.get(year_branch):
        hits_hyung.append("고진(孤辰)")
    if inc_branch == GUASU_YB.get(year_branch):
        hits_hyung.append("과숙(寡宿)")

    return hits_gil, hits_hyung



# ── [v5] 오행균형도: 용신 기반 (용/희 vs 기/구 비율) ─────────────
# 명리학 원칙: 이상적 오행 분포는 5행 균등이 아니라 용/희신 오행이 적절히 강한 상태.
def _ohang_balance(stems_list: List[str], branches_list: List[str],
                   yong_info: dict = None) -> float:
    """용신 기반 균형도 (0~1). 용/희 비율이 높을수록 1에 가까움."""
    cnt = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}
    for s in stems_list:
        if s in STEM_ELEMENT:
            cnt[STEM_ELEMENT[s]] += 1
    for b in branches_list:
        _add_branch_weighted_elements(cnt, b, scale=1.0)

    total = sum(cnt.values())
    if total == 0:
        return 0.5

    if not yong_info:
        # fallback: 기존 분산 기반
        avg = total / 5.0
        variance = sum((v - avg) ** 2 for v in cnt.values()) / 5.0
        max_var = ((total - avg) ** 2) * 4 / 5 + (avg ** 2) / 5 if total > 0 else 1.0
        return round(1.0 - (variance / max(max_var, 1.0)), 2) if max_var else 1.0

    yong_e = yong_info.get("용신_오행", "")
    hee_es = set(yong_info.get("희신_오행", []))
    gi_es = set(yong_info.get("기신_오행", []))
    gu_es = set(yong_info.get("구신_오행", []))
    good = sum(cnt.get(e, 0) for e in ({yong_e} | hee_es) if e)
    bad = sum(cnt.get(e, 0) for e in (gi_es | gu_es) if e)
    ratio = (good - bad * 0.5) / total
    return round(max(0.0, min(1.0, 0.5 + ratio)), 2)


# ── [v5] 12운성×십성 맥락 보정 ────────────────────
# 명리학 원칙: 묘(墓)는 재성에겐 축적(+), 관성에겐 정체(-). 맥락 없는 일률 점수는 오류.
# 보정은 기본 12운성 점수의 30~50% 범위로 제한.
_UNSEONG_TENGO_CONTEXT = {
    ("묘", "편재"):  +4,  ("묘", "정재"):  +4,
    ("묘", "정관"):  -3,  ("묘", "편관"):  -3,
    ("장생", "정관"): +3, ("장생", "정인"): +3,
    ("제왕", "편관"): -3, ("제왕", "겁재"): -3,
    ("목욕", "정관"): -2, ("목욕", "편재"): -2,
    ("사", "편재"):   -3, ("절", "정관"):   -3,
}

def _unseong_tengo_adj(unseong: str, tg_stem: str, tg_branch: str) -> float:
    """12운성×십성 맥락 보정값 (기본 점수의 보조항)."""
    adj = _UNSEONG_TENGO_CONTEXT.get((unseong, tg_stem), 0)
    adj += _UNSEONG_TENGO_CONTEXT.get((unseong, tg_branch), 0)
    return adj * 0.5


def _debug_unseong_context_stats(samples: list):
    """S3 안정성 로그: 샘플 리스트로 unseong_tengo_adj 통계를 출력."""
    import logging
    adjs = []
    for inp in samples:
        r = enrich_saju(inp)
        dw_list = build_daewoon_detail(r)
        ds = r["원국"]["day"][0]
        for d in dw_list:
            tgs = ten_god(ds, d["stem"])
            tgb = branch_main_tg(ds, d["branch"])
            a = _unseong_tengo_adj(d["12운성"], tgs, tgb)
            adjs.append(abs(a))
    if not adjs:
        return
    avg_a = sum(adjs) / len(adjs)
    max_a = max(adjs)
    min_a = min(adjs)
    stats = {"avg_adj": round(avg_a, 3), "max_adj": round(max_a, 3), "min_adj": round(min_a, 3)}
    msg = f"UNSEONG_CONTEXT_STATS {stats}"
    if avg_a > 1.0 or max_a > 2.5:
        logging.warning(msg + " — exceeds safe range (avg≤1.0, max≤2.5)")
    else:
        logging.info(msg)


# ── [v5] 삼합/방합 완성 체크 ─────────────────────
# 명리학 원칙: 원국+대운/세운 지지로 삼합/방합 완성 시 해당 오행이 극강해짐.
def _check_trine_direction(inc_branch: str, orig_branches: List[str],
                           extra_branches: List[str] = None) -> List[Dict]:
    """incoming 지지 포함 삼합/방합 완성 체크."""
    all_b = set(orig_branches + (extra_branches or []) + [inc_branch])
    hits = []
    for tset, tname in TRINE_SETS.items():
        if inc_branch in tset and tset.issubset(all_b):
            hits.append({"type": "삼합", "name": tname, "element": tname[0]})
    for dset, dname in DIRECTION_SETS.items():
        if inc_branch in dset and dset.issubset(all_b):
            hits.append({"type": "방합", "name": dname, "element": dname[0]})
    return hits


def _trine_energy_adj(trine_hits: list, yong_info: dict) -> tuple:
    """삼합/방합 완성 시 용/기 기반 pos/neg 보정."""
    if not yong_info or not trine_hits:
        return 0.0, 0.0
    yong_e = yong_info.get("용신_오행", "")
    hee_es = set(yong_info.get("희신_오행", []))
    gi_es = set(yong_info.get("기신_오행", []))
    pos, neg = 0.0, 0.0
    for h in trine_hits:
        elem = h["element"]
        if elem in ({yong_e} | hee_es):
            pos += 2.5
        elif elem in gi_es:
            neg += 2.5
    return pos, neg


# ── [v6.2] 공망 진공/가공 + 항목별 차등 감쇠 + 해공 ─────
# 명리학 원칙:
#   진공(眞空): 합·충 없이 그대로 공망 → 완전 감쇠
#   가공(假空): 합·충으로 공망이 풀림 → 감쇠 완화/해소
#   해공: 대운/세운/월운에서 충·합으로 공망 채워짐 → 영역 활성화

_GONGMANG_DAMP_JINGONG = {  # 진공: 완전 감쇠
    "unseong": 0.9,  "rel": 0.75,  "yfit_branch": 0.85,  "trine": 0.70,
}
_GONGMANG_DAMP_GAGONG_CHUNG = {  # 가공(충): 충으로 일부 해소
    "unseong": 0.95, "rel": 0.88,  "yfit_branch": 0.92,  "trine": 0.85,
}
_GONGMANG_DAMP_GAGONG_HAP = {  # 가공(합): 합으로 거의 해소
    "unseong": 1.0,  "rel": 0.95,  "yfit_branch": 0.98,  "trine": 0.95,
}

_GONGMANG_NONE = {"unseong": 1.0, "rel": 1.0, "yfit_branch": 1.0, "trine": 1.0}

_HAEGONG_BONUS = {"합": 2.0, "충": 1.0}

_GUNGSEONG_AREA = {
    0: ("년주", "조상궁·초년운"),
    1: ("월주", "부모궁·사회기반"),
    2: ("일주", "배우자궁·자기기반"),
    3: ("시주", "자녀궁·말년운"),
}

def _gongmang_type(gm_branch: str, other_branches: List[str]) -> str:
    """공망 지지가 다른 지지와 합/충 관계가 있는지 → 진공/가공 판별."""
    for ob in other_branches:
        if ob == gm_branch:
            continue
        if (gm_branch, ob) in BRANCH_COMBINE:
            return "가공(합)"
        if (gm_branch, ob) in BRANCH_CLASH:
            return "가공(충)"
    return "진공"


def classify_natal_gongmang(day_gz: str, year_gz: str,
                            natal_branches: List[str]) -> Dict[str, Any]:
    """원국 공망을 진공/가공으로 분류하고 위치별 매핑.

    Returns: {
        "일주공망": { "공망지지": [...], "원국적중": [{branch, pillar_idx, pillar, type, 영역}] },
        "년주공망": { ... },
        "all_hits": [...]   ← 편의용 flat list
    }
    """
    result: Dict[str, Any] = {}
    all_hits: List[Dict] = []

    for source, gz, skip_idx in [("일주공망", day_gz, 2), ("년주공망", year_gz, 0)]:
        gm_branches = xunkong(gz)
        hits: List[Dict] = []
        for i, nb in enumerate(natal_branches):
            if i == skip_idx:
                continue
            if nb in gm_branches:
                gm_t = _gongmang_type(nb, natal_branches)
                hit = {
                    "branch": nb,
                    "pillar_idx": i,
                    "pillar": _GUNGSEONG_AREA[i][0],
                    "type": gm_t,
                    "영역": _GUNGSEONG_AREA[i][1],
                    "source": source,
                }
                hits.append(hit)
                all_hits.append(hit)
        result[source] = {"공망지지": gm_branches, "원국적중": hits}

    result["all_hits"] = all_hits
    return result


def _gongmang_factors(branch: str, day_gz: str,
                      orig_branches: Optional[List[str]] = None) -> dict:
    """공망 감쇠 계수 (진공/가공 구분). is_gongmang, gongmang_type은 export용."""
    if branch not in xunkong(day_gz):
        d = _GONGMANG_NONE.copy()
        d["is_gongmang"] = False
        d["gongmang_type"] = None
        return d

    gm_t = "진공"
    damp = _GONGMANG_DAMP_JINGONG
    if orig_branches:
        gm_t = _gongmang_type(branch, orig_branches)
        if gm_t == "가공(합)":
            damp = _GONGMANG_DAMP_GAGONG_HAP
        elif gm_t == "가공(충)":
            damp = _GONGMANG_DAMP_GAGONG_CHUNG

    d = damp.copy()
    d["is_gongmang"] = True
    d["gongmang_type"] = gm_t
    return d


def _haegong_check(incoming_branch: str,
                   natal_gm_info: Optional[Dict] = None) -> Dict[str, Any]:
    """운의 지지가 원국 공망 지지를 충/합으로 해공하는지 확인.

    Returns: {"resolved": [{branch, pillar, method, 영역, bonus}], "bonus": float}
    """
    if not natal_gm_info:
        return {"resolved": [], "bonus": 0.0}

    resolved = []
    for hit in natal_gm_info.get("all_hits", []):
        gm_br = hit["branch"]
        method = None
        if (incoming_branch, gm_br) in BRANCH_COMBINE:
            method = "합"
        elif (incoming_branch, gm_br) in BRANCH_CLASH:
            method = "충"
        if method:
            base = _HAEGONG_BONUS[method]
            # 이미 가공이면 해공 효과 축소
            if hit["type"] == "가공(합)":
                base *= 0.3
            elif hit["type"] == "가공(충)":
                base *= 0.5
            resolved.append({
                "branch": gm_br, "pillar": hit["pillar"],
                "method": method, "영역": hit["영역"],
                "source": hit["source"], "bonus": round(base, 2),
            })

    return {"resolved": resolved, "bonus": round(sum(r["bonus"] for r in resolved), 2)}


# ── [v5] 신살 맥락 감응 ──────────────────────────
# 명리학 원칙: 도화/양인/역마 등은 신강/신약·격국에 따라 길흉이 달라짐.
# 예) 양인은 신약이면 비겁보강(+), 신강이면 과잉(-). 보정은 ±0~3 범위.
_SHINSAL_CONTEXT_RULES = {
    "양인": {"신약": +2, "태약": +2, "극약": +3, "신강": -2, "태강": -3, "극왕": -3},
    "도화": {"신약": +1, "태약": +1, "극약": +1, "신강": -1, "태강": -1, "극왕": -1, "종격": 0},
    "역마": {"신약": +1, "태약": +1, "극약": +1, "신강": +1, "태강": 0, "극왕": 0},
    "겁살": {"신약": +1, "태약": +1, "극약": +2, "신강": -1, "태강": -2, "극왕": -2},
    "화개": {"신강": +1, "태강": +1, "극왕": +1, "신약": 0, "태약": 0, "극약": 0},
}

def _contextual_shinsal_adj(
    gil_list: list, hyung_list: list,
    verdict: str, geok_type: str = ""
) -> float:
    """신살 맥락 보정값. 기존 길/흉 분류에 verdict 기반 가감."""
    adj = 0.0
    for name in gil_list + hyung_list:
        for key, rules in _SHINSAL_CONTEXT_RULES.items():
            if key in name:
                adj += rules.get(verdict, 0)
                break
    return adj


def _shinsal_adj_detail(
    gil_list: list, hyung_list: list,
    verdict: str, geok_type: str = ""
) -> Dict[str, float]:
    """Export용: 개별 신살 맥락 보정 상세 (점수 로직 미사용)."""
    detail: Dict[str, float] = {}
    for name in gil_list + hyung_list:
        for key, rules in _SHINSAL_CONTEXT_RULES.items():
            if key in name:
                val = rules.get(verdict, 0)
                if val != 0:
                    detail[name] = float(val)
                break
    return detail


# ── [v6] 병인 해소 판정 ──────────────────────────
def _disease_resolution_score(
    inc_stem: str, inc_branch: str,
    disease_info: Optional[Dict] = None,
    tmap: Optional[Dict[str, str]] = None,
) -> float:
    """대운/세운 간지가 원국 병인을 해소(+) 또는 악화(-)하는 정도. ±0~8 범위."""
    if not disease_info or not tmap:
        return 0.0
    primary = disease_info.get("primary")
    if not primary or primary.get("시급도", 0) < 0.2:
        return 0.0

    byungin_elem = primary.get("병인_오행", "")
    byungin_type = primary.get("유형", "")
    if not byungin_elem:
        return 0.0

    inc_s_elem = STEM_ELEMENT.get(inc_stem, "")
    inc_b_elem = BRANCH_ELEMENT_MAIN.get(inc_branch, "")

    sc = 0.0
    urgency = primary["시급도"]

    if byungin_type in ("과다", "극전쟁"):
        # 과다 병인: 극하는 오행이 오면 해소, 같은 오행이 오면 악화
        ke_of_byungin = {v: k for k, v in KE_MAP.items()}.get(byungin_elem, "")
        if inc_s_elem == ke_of_byungin:
            sc += 3.0 * urgency
        if inc_b_elem == ke_of_byungin:
            sc += 5.0 * urgency
        if inc_s_elem == byungin_elem:
            sc -= 2.0 * urgency
        if inc_b_elem == byungin_elem:
            sc -= 4.0 * urgency
        # 설기(병인 오행이 생하는 오행)도 약간의 해소
        gen_of_byungin = GEN_MAP.get(byungin_elem, "")
        if gen_of_byungin:
            if inc_s_elem == gen_of_byungin:
                sc += 1.0 * urgency
            if inc_b_elem == gen_of_byungin:
                sc += 1.5 * urgency

    elif byungin_type == "통관필요":
        # 통관 오행이 오면 해소, 대립 양측이 강화되면 악화
        if inc_s_elem == byungin_elem:
            sc += 3.0 * urgency
        if inc_b_elem == byungin_elem:
            sc += 5.0 * urgency

    elif byungin_type == "한서":
        # 한서 병인: 조후 해소 오행이 오면 해소
        if "한" in primary["병인"]:
            if inc_s_elem == "火": sc += 3.0 * urgency
            if inc_b_elem == "火": sc += 5.0 * urgency
            if inc_s_elem == "水": sc -= 2.0 * urgency
            if inc_b_elem == "水": sc -= 3.0 * urgency
        elif "서" in primary["병인"]:
            if inc_s_elem == "水": sc += 3.0 * urgency
            if inc_b_elem == "水": sc += 5.0 * urgency
            if inc_s_elem == "火": sc -= 2.0 * urgency
            if inc_b_elem == "火": sc -= 3.0 * urgency

    return round(max(-8.0, min(8.0, sc)), 2)


# ── 종합운점수 산출 ────────────────────────────
def _composite_score(
    base: float,
    yong_fit: Dict[str, float],
    unseong: str,
    noble_power: int,
    energy_direction: float,
    balance: float,
    geok_type: str = "",
    verdict: str = "",
    tg_stem: str = "",
    tg_branch: str = "",
    trine_pos: float = 0.0,
    trine_neg: float = 0.0,
    gm: dict = None,
    shinsal_adj: float = 0.0,
    disease_resolution: float = 0.0,
    natal_balance: float = 0.5,
    haegong_bonus: float = 0.0,
) -> Dict[str, Any]:
    """0~100 종합운점수 + breakdown (v6.2 full — 해공 포함)."""
    if gm is None:
        gm = {"unseong": 1.0, "rel": 1.0, "yfit_branch": 1.0}

    def _fit_with_gongmang(key: str) -> float:
        stem_sc = float(yong_fit.get(f"{key}_천간", 0.0))
        branch_sc = float(
            yong_fit.get(
                f"{key}_지지",
                max(0.0, float(yong_fit.get(key, 0.0)) - stem_sc),
            )
        )
        return stem_sc + branch_sc * gm["yfit_branch"]

    # yongshin_fit component
    yf = _fit_with_gongmang("용신부합")
    hf = _fit_with_gongmang("희신부합")
    gf = _fit_with_gongmang("기신부합")
    uf = _fit_with_gongmang("구신부합")
    # 용신 적합도: 12/7 계수 (v6.1 — 다른 축이 살아나도록 진폭 축소)
    yfit_sc = (yf * 12 + hf * 7 - gf * 12 - uf * 7)
    if yf > 0 and gf > 0:
        yfit_sc -= 2.5 * min(yf, gf)

    # unseong component
    uns_raw = _UNSEONG_SCORE.get(unseong, 0)
    uns_sc = (uns_raw * 0.8 * _unseong_mult(unseong, verdict, geok_type) * gm["unseong"]
              + _singang_excess_pen(unseong, verdict, geok_type) * gm["unseong"])

    # unseong context (十星)
    uns_ctx = _unseong_tengo_adj(unseong, tg_stem, tg_branch) * gm["unseong"]

    # relations — noble_power 기여도 축소 (shinsal_adj와의 이중 반영 방지)
    rel_sc = (energy_direction * 2 * gm["rel"] + noble_power * 0.25)

    # trine — 공망 시 별도 감쇠 적용 (v6.1)
    tri_sc = (trine_pos - trine_neg) * gm.get("trine", gm["rel"])

    # balance — 원국 대비 개선도 (v6.1: delta 기반)
    balance_delta = balance - natal_balance
    bal_sc = max(-5.0, min(5.0, balance_delta * 15))
    if geok_type in ("종격", "화격") or geok_type.startswith("외격"):
        bal_sc = -bal_sc

    # shinsal
    shin_sc = shinsal_adj

    # disease resolution
    dis_sc = disease_resolution

    # 해공 보너스 (운이 원국 공망 지지를 충/합으로 활성화)
    haeg_sc = haegong_bonus

    sc = base + yfit_sc + uns_sc + uns_ctx + rel_sc + tri_sc + bal_sc + shin_sc + dis_sc + haeg_sc
    clamped = max(0, min(100, round(sc)))

    return {
        "score": clamped,
        "breakdown": {
            "base": round(base, 2),
            "yongshin_fit": round(yfit_sc, 2),
            "unseong": round(uns_sc, 2),
            "unseong_context": round(uns_ctx, 2),
            "relations": round(rel_sc, 2),
            "trine": round(tri_sc, 2),
            "balance": round(bal_sc, 2),
            "shinsal": round(shin_sc, 2),
            "disease_resolution": round(dis_sc, 2),
            "haegong": round(haeg_sc, 2),
        },
    }


def _calc_sewoon_independent_score(
    sw_stem: str, sw_branch: str, day_stem: str, year_branch: str,
    orig_stems: list, orig_branches: list,
    dw_stem: str, dw_branch: str,
    yong: dict, geok_type: str = "", verdict: str = "",
    day_gz: str = "", disease_info: Optional[Dict] = None,
    tmap: Optional[Dict[str, str]] = None,
    natal_balance: float = 0.5,
    natal_gm_info: Optional[Dict] = None,
) -> Dict[str, Any]:
    """세운 독립점수 산출 (v6.2 full — 진공/가공/해공). Returns {"score": int, "breakdown": dict}."""
    sw_yfit = _check_yongshin_fit(sw_stem, sw_branch, yong, day_stem)
    sw_unseong = twelve_unseong(day_stem, sw_branch)
    sw_rels = _calc_incoming_relations(sw_stem, sw_branch, orig_stems, orig_branches)
    sw_rels_dw = _calc_two_pillar_relations(sw_stem, sw_branch, dw_stem, dw_branch)
    sw_energy = _calc_energy_field(sw_rels, sw_rels_dw, yong_info=yong,
                                   inc_stem=sw_stem, inc_branch=sw_branch,
                                   orig_stems=orig_stems, orig_branches=orig_branches)
    sw_balance = _ohang_balance(
        orig_stems + [dw_stem, sw_stem],
        orig_branches + [dw_branch, sw_branch],
        yong_info=yong
    )
    sw_gil, sw_hyung = _check_incoming_shinsal(sw_branch, day_stem, year_branch, orig_branches)

    sw_tg_s = ten_god(day_stem, sw_stem)
    sw_tg_b = branch_main_tg(day_stem, sw_branch)

    sw_trine = _check_trine_direction(sw_branch, orig_branches, [dw_branch])
    sw_t_pos, sw_t_neg = _trine_energy_adj(sw_trine, yong)
    sw_gm = _gongmang_factors(sw_branch, day_gz, orig_branches) if day_gz else _GONGMANG_NONE.copy()
    sw_haegong = _haegong_check(sw_branch, natal_gm_info)
    sw_shinsal_adj = _contextual_shinsal_adj(sw_gil, sw_hyung, verdict, geok_type)
    sw_dis_res = _disease_resolution_score(sw_stem, sw_branch, disease_info, tmap)

    return _composite_score(
        50, sw_yfit, sw_unseong,
        _calc_noble_power(sw_gil, sw_hyung),
        sw_energy["direction"], sw_balance, geok_type, verdict,
        tg_stem=sw_tg_s, tg_branch=sw_tg_b,
        trine_pos=sw_t_pos, trine_neg=sw_t_neg, gm=sw_gm,
        shinsal_adj=sw_shinsal_adj,
        disease_resolution=sw_dis_res,
        natal_balance=natal_balance,
        haegong_bonus=sw_haegong["bonus"],
    )


def _score_grade(sc: int) -> str:
    if sc >= 80:
        return "大吉"
    if sc >= 65:
        return "中吉"
    if sc >= 50:
        return "平"
    if sc >= 35:
        return "小凶"
    return "大凶"


# ── 대운 상세 빌드 ─────────────────────────────
def build_daewoon_detail(r: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    enrich_saju 결과(r)를 받아 대운기둥10 상세를 생성.
    기존 r["대운"]["블록"]을 확장한 구조 반환.
    """
    day_stem = r["원국"]["day"][0]
    day_branch = r["원국"]["day"][1]
    year_branch = r["원국"]["year"][1]
    yong = r["용신"]
    geok_type = r.get("격국", {}).get("격국유형", "")
    verdict = r.get("신강신약", {}).get("판정", "")
    disease_info = yong.get("병인진단")
    tmap = day_tengo_ohaeng(day_stem)
    day_gz = day_stem + day_branch

    orig_stems = [r["원국"][k][0] for k in ("year", "month", "day", "hour")]
    orig_branches = [r["원국"][k][1] for k in ("year", "month", "day", "hour")]
    natal_gm_info = r.get("공망분류")

    # v6.1: 원국 고유 균형도 (balance delta 기준선)
    natal_bal = _ohang_balance(orig_stems, orig_branches, yong_info=yong)

    birth_year = r["입력"]["년"]

    # 음력→양력 보정
    sol = r["입력"].get("음력→양력")
    if sol and sol.get("solar_year"):
        birth_year = sol["solar_year"]

    blocks = r["대운"]["블록"]
    result: List[Dict[str, Any]] = []

    for blk in blocks:
        gz = blk["ganzhi"]
        stem, branch = gz[0], gz[1]
        start_age = blk["start_age"]
        end_age = blk["end_age"]
        # 명리학/제품 원칙: 시작나이 정밀값은 블록에는 유지하고, 연도 경계는 절삭으로 일관화한다.
        start_year = birth_year + math.floor(start_age)
        end_year = birth_year + math.floor(end_age)

        # 십성
        tg_stem = ten_god(day_stem, stem)
        tg_branch = branch_main_tg(day_stem, branch)

        # 12운성
        unseong = twelve_unseong(day_stem, branch)

        # 납음
        ny = nayin(gz)

        # 용신 부합
        yfit = _check_yongshin_fit(stem, branch, yong, day_stem)

        # 오행 변화
        oh_change = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}
        oh_change[STEM_ELEMENT[stem]] += 1
        oh_change[BRANCH_ELEMENT_MAIN[branch]] += 1

        # 원국과 관계
        rels_w_orig = _calc_incoming_relations(stem, branch, orig_stems, orig_branches)

        # 신살
        gil, hyung = _check_incoming_shinsal(branch, day_stem, year_branch, orig_branches)

        # 오행균형도 (원국 + 대운)
        all_stems = orig_stems + [stem]
        all_branches = orig_branches + [branch]
        balance = _ohang_balance(all_stems, all_branches, yong_info=yong)

        # 귀인력 (차등 가중치) + 에너지장 (관계 방향성)
        dw_noble_for_score = _calc_noble_power(gil, hyung)
        dw_energy_for_score = _calc_energy_field(rels_w_orig, yong_info=yong, inc_stem=stem, inc_branch=branch,
                                                   orig_stems=orig_stems, orig_branches=orig_branches)

        # [v5] 삼합/방합 + 공망(진공/가공) + 신살맥락 + 해공
        dw_trine = _check_trine_direction(branch, orig_branches)
        dw_t_pos, dw_t_neg = _trine_energy_adj(dw_trine, yong)
        dw_gm = _gongmang_factors(branch, day_gz, orig_branches)
        dw_haegong = _haegong_check(branch, natal_gm_info)
        dw_shinsal_adj = _contextual_shinsal_adj(gil, hyung, verdict, geok_type)
        dw_dis_res = _disease_resolution_score(stem, branch, disease_info, tmap)

        _comp_result = _composite_score(
            50, yfit, unseong, dw_noble_for_score,
            dw_energy_for_score["direction"], balance, geok_type, verdict,
            tg_stem=tg_stem, tg_branch=tg_branch,
            trine_pos=dw_t_pos, trine_neg=dw_t_neg, gm=dw_gm,
            shinsal_adj=dw_shinsal_adj,
            disease_resolution=dw_dis_res,
            natal_balance=natal_bal,
            haegong_bonus=dw_haegong["bonus"],
        )
        composite = _comp_result["score"]
        composite_breakdown = _comp_result["breakdown"]

        # 도메인 점수 (원국 base ± 대운 보정)
        base_dom = r["DomainScore"]["점수"].copy()
        dom: Dict[str, float] = {}

        for d in ("직업", "재물", "건강", "연애", "결혼"):
            adj = 0.0
            adj += float(yfit["용신부합"]) * 0.8
            adj += float(yfit["희신부합"]) * 0.4
            adj -= float(yfit["기신부합"]) * 0.8
            adj -= float(yfit.get("구신부합", 0)) * 0.4

            for tg in (tg_stem, tg_branch):
                adj += _TG_DOM.get(tg, {}).get(d, 0.0)

            # [v5] 도메인에서도 감쇠승수 적용 (과잉 penalty는 종합운에만)
            adj += _UNSEONG_SCORE.get(unseong, 0) * 0.05 * _unseong_mult(unseong, verdict, geok_type)

            dom[d] = max(0.0, min(10.0, round(base_dom[d] + adj, 1)))

        dw_ypower = _calc_yongshin_power(yfit)
        dw_energy = _calc_energy_field(rels_w_orig, yong_info=yong, inc_stem=stem, inc_branch=branch,
                                       orig_stems=orig_stems, orig_branches=orig_branches)
        dw_noble = _calc_noble_power(gil, hyung)
        dw_tengo_bal = _calc_tengo_balance(day_stem, orig_stems + [stem], orig_branches + [branch])
        dw_season = _calc_season_tag(dw_ypower, dw_energy["total"], dw_energy["direction"])
        _, _, dw_rel_keys = _extract_rel_keys(rels_w_orig, unseong)
        dw_events = _calc_event_probabilities(
            gil + hyung, dw_rel_keys, unseong, [tg_stem, tg_branch]
        )

        result.append({
            "order": blk["index"],
            "daewoon_pillar": gz,
            "stem": stem,
            "branch": branch,
            "stemElement": STEM_ELEMENT[stem],
            "branchElement": BRANCH_ELEMENT_MAIN[branch],
            "start_age_years": start_age,
            "end_age_years": end_age,
            "start_year": start_year,
            "end_year": end_year,
            "십성_천간": tg_stem,
            "십성_지지": tg_branch,
            "12운성": unseong,
            "납음": ny,
            "용신부합": yfit["용신부합"],
            "희신부합": yfit["희신부합"],
            "기신부합": yfit["기신부합"],
            "오행변화": oh_change,
            "관계_with_원국": rels_w_orig,
            "신살_길신": gil,
            "신살_흉살": hyung,
            "indicators": {
                "용신력": dw_ypower,
                "에너지장": dw_energy,
                "귀인력": dw_noble,
                "오행균형도": balance,
                "12운성점수": _UNSEONG_SCORE.get(unseong, 0),
            },
            "십성밸런스": dw_tengo_bal,
            "domainScore": dom,
            "종합운점수": composite,
            "등급": _score_grade(composite),
            "breakdown": composite_breakdown,
            "trine_hits": [dict(h, applies_to="daewoon") for h in dw_trine],
            "gongmang_factors": dw_gm,
            "haegong": dw_haegong,
            "shinsal_context_adj": _shinsal_adj_detail(gil, hyung, verdict, geok_type),
            "시즌태그": dw_season,
            "이벤트확률": dw_events,
        })

    return result


# ──────────────────────────────────────────────
# SECTION 19 : 연도별 타임라인 빌드 (v3.2 신규)
# ──────────────────────────────────────────────

def _sewoon_gz(year: int) -> str:
    """특정 연도의 세운 간지"""
    idx = (ganzhi_index("甲子") + (year - 1984)) % 60
    return GANZHI_60[idx]


def build_yearly_timeline(
        r: Dict[str, Any],
        daewoon_detail: List[Dict[str, Any]],
        span: int = 100,
        include_monthly=False
    ) -> List[Dict[str, Any]]:
    """
    birth_year ~ birth_year+span 까지 연도별 차트 데이터 생성.
    각 연도에 대운 base + 세운 보정 적용.
    """
    day_stem = r["원국"]["day"][0]
    day_branch = r["원국"]["day"][1]
    year_branch = r["원국"]["year"][1]
    yong = r["용신"]
    geok_type = r.get("격국", {}).get("격국유형", "")
    verdict = r.get("신강신약", {}).get("판정", "")
    day_gz = day_stem + day_branch
    disease_info = yong.get("병인진단")
    tmap_yt = day_tengo_ohaeng(day_stem)

    orig_stems = [r["원국"][k][0] for k in ("year", "month", "day", "hour")]
    orig_branches = [r["원국"][k][1] for k in ("year", "month", "day", "hour")]
    natal_gm_info = r.get("공망분류")

    # v6.1: 원국 고유 균형도
    natal_bal = _ohang_balance(orig_stems, orig_branches, yong_info=yong)

    birth_year = r["입력"]["년"]
    sol = r["입력"].get("음력→양력")
    if sol and sol.get("solar_year"):
        birth_year = sol["solar_year"]

    # 대운 연도→블록 매핑
    dw_map: Dict[int, Dict[str, Any]] = {}
    for dw in daewoon_detail:
        for y in range(dw["start_year"], dw["end_year"]):
            dw_map[y] = dw

    timeline: List[Dict[str, Any]] = []

    for yi in range(span):
        year = birth_year + yi
        age = yi

        # 해당 대운 찾기
        dw = dw_map.get(year)
        if not dw:
            # 대운 전(유아기) 또는 범위 밖 → 가장 가까운 블록 사용
            if daewoon_detail:
                dw = daewoon_detail[0] if year < daewoon_detail[0]["start_year"] else daewoon_detail[-1]
            else:
                continue

        dw_trend = dw["종합운점수"]

        # 세운 간지
        sw_gz = _sewoon_gz(year)
        sw_stem, sw_branch = sw_gz[0], sw_gz[1]

        # 세운 십성
        sw_tg_stem = ten_god(day_stem, sw_stem)
        sw_tg_branch = branch_main_tg(day_stem, sw_branch)

        # 세운 12운성
        sw_unseong = twelve_unseong(day_stem, sw_branch)

        # 세운 용신부합
        sw_yfit = _check_yongshin_fit(sw_stem, sw_branch, yong, day_stem)

        # 세운 vs 원국 관계
        sw_rels_orig = _calc_incoming_relations(sw_stem, sw_branch, orig_stems, orig_branches)

        # 세운 vs 대운 관계
        sw_rels_dw = _calc_two_pillar_relations(sw_stem, sw_branch, dw["stem"], dw["branch"])

        # 세운 신살
        sw_gil, sw_hyung = _check_incoming_shinsal(sw_branch, day_stem, year_branch, orig_branches)

        # ── 보조지표 계산 ─────────────────────
        dw_yfit = {"용신부합": dw["용신부합"], "희신부합": dw["희신부합"], "기신부합": dw["기신부합"]}
        ypower = _calc_yongshin_power(dw_yfit, sw_yfit)

        energy = _calc_energy_field(sw_rels_orig, sw_rels_dw, yong_info=yong, inc_stem=sw_stem, inc_branch=sw_branch,
                                    orig_stems=orig_stems, orig_branches=orig_branches)

        all_gil = dw["신살_길신"] + sw_gil
        all_hyung = dw["신살_흉살"] + sw_hyung
        noble = _calc_noble_power(all_gil, all_hyung)

        balance = _ohang_balance(
            orig_stems + [dw["stem"], sw_stem],
            orig_branches + [dw["branch"], sw_branch],
            yong_info=yong,
        )
        unseong_12 = _UNSEONG_SCORE.get(sw_unseong, 0)
        tengo_bal = _calc_tengo_balance(day_stem, orig_stems + [dw["stem"], sw_stem], orig_branches + [dw["branch"], sw_branch])

        # ── 종합 점수 (계층 가중합산 + 시너지 + 해공) ──
        _sw_result = _calc_sewoon_independent_score(
            sw_stem, sw_branch, day_stem, year_branch,
            orig_stems, orig_branches, dw["stem"], dw["branch"],
            yong, geok_type, verdict, day_gz=day_gz,
            disease_info=disease_info, tmap=tmap_yt,
            natal_balance=natal_bal, natal_gm_info=natal_gm_info,
        )
        sw_sc = _sw_result["score"]
        sw_breakdown = _sw_result["breakdown"]

        # [v5 export] 삼합/방합·공망·신살 메타 (설명용)
        sw_trine_hits = _check_trine_direction(sw_branch, orig_branches, [dw["branch"]])
        sw_gm_factors = _gongmang_factors(sw_branch, day_gz, orig_branches)
        sw_haegong = _haegong_check(sw_branch, natal_gm_info)
        sw_shinsal_detail = _shinsal_adj_detail(
            dw["신살_길신"] + sw_gil, dw["신살_흉살"] + sw_hyung, verdict, geok_type
        )

        dw_dev = float(dw_trend) - 50
        sw_dev = sw_sc - 50
        avg_dir = (dw_dev + sw_dev) / 100.0
        strength = abs(dw_dev / 50.0) * abs(sw_dev / 50.0)
        # v6.1: 시너지 cap ±5 (과도한 방향 증폭 억제)
        synergy = max(-5, min(5, avg_dir * strength * 12))
        score = max(0, min(100, round(float(dw_trend) * 0.6 + sw_sc * 0.4 + synergy)))

        # ── 캔들 OHLC ───────────────────────
        sw_noble_pos = _calc_noble_power(sw_gil, [])
        sw_noble_neg = abs(_calc_noble_power([], sw_hyung))
        candle_open = int(dw_trend)
        candle_close = int(score)
        candle_high = score + sw_noble_pos * 0.6 + max(ypower, 0) * 8
        candle_low = score - sw_noble_neg * 0.6 - abs(min(energy["direction"], 0)) * 4
        candle_high = int(min(100, round(candle_high)))
        candle_low = int(max(0, round(candle_low)))

        # ── 시즌 태그 ───────────────────────
        season = _calc_season_tag(ypower, energy["total"], energy["direction"])

        # ── 이벤트 확률 ──────────────────────
        _, _, rel_keys_o = _extract_rel_keys(sw_rels_orig, sw_unseong)
        _, _, rel_keys_dw = _extract_rel_keys(sw_rels_dw, sw_unseong)
        events = _calc_event_probabilities(
            all_gil + all_hyung,
            rel_keys_o + rel_keys_dw,
            sw_unseong,
            [sw_tg_stem, sw_tg_branch, dw["십성_천간"], dw["십성_지지"]],
        )

        # 도메인 점수
        dom: Dict[str, float] = {}
        for d in ("직업", "재물", "건강", "연애", "결혼"):
            base = dw["domainScore"].get(d, 5.0)
            adj = 0.0
            adj += float(sw_yfit["용신부합"]) * 0.5
            adj += float(sw_yfit["희신부합"]) * 0.3
            adj -= float(sw_yfit["기신부합"]) * 0.4
            for tg in (sw_tg_stem, sw_tg_branch):
                adj += _TG_DOM.get(tg, {}).get(d, 0.0)
            dom[d] = max(0.0, min(10.0, round(base + adj, 1)))

        timeline.append({
            "year": year,
            "age": age,
            "대운전환기": _is_daewoon_transition(year, daewoon_detail),
            "세운_일주관계": _calc_sewoon_ilju_relation(sw_stem, sw_branch, day_stem, day_branch),
            "월운_요약": _build_monthly_fortune(year, day_stem, day_branch, sw_branch, yong, verdict, geok_type) if include_monthly else [],
            "대운_pillar": dw["daewoon_pillar"],
            "세운_pillar": sw_gz,
            "세운_stem": sw_stem,
            "세운_branch": sw_branch,
            "세운_stemElement": STEM_ELEMENT[sw_stem],
            "세운_branchElement": BRANCH_ELEMENT_MAIN[sw_branch],
            "세운_십성_천간": sw_tg_stem,
            "세운_십성_지지": sw_tg_branch,
            "세운_12운성": sw_unseong,
            "세운_용신부합": sw_yfit["용신부합"],
            "세운_희신부합": sw_yfit["희신부합"],
            "세운_기신부합": sw_yfit["기신부합"],
            "세운_구신부합": sw_yfit.get("구신부합", False),
            "세운_관계_with_원국": sw_rels_orig,
            "세운_관계_with_대운": sw_rels_dw,
            "세운_신살_길신": sw_gil,
            "세운_신살_흉살": sw_hyung,
            "candle": {
                "open": candle_open,
                "close": candle_close,
                "high": candle_high,
                "low": candle_low,
                "type": "양봉" if candle_close >= candle_open else "음봉",
            },
            "scores": {
                "종합": score,
                "직업": dom["직업"],
                "재물": dom["재물"],
                "건강": dom["건강"],
                "연애": dom["연애"],
                "결혼": dom["결혼"],
            },
            "breakdown": sw_breakdown,
            "trine_hits": [dict(h, applies_to="yearly") for h in sw_trine_hits],
            "gongmang_factors": sw_gm_factors,
            "haegong": sw_haegong,
            "shinsal_context_adj": sw_shinsal_detail,
            "indicators": {
                "용신력": ypower,
                "에너지장": energy,
                "귀인력": noble,
                "오행균형도": balance,
                "12운성곡선": unseong_12,
                "십성밸런스": tengo_bal,
            },
            "시즌태그": season,
            "이벤트확률": events,
        })

    return timeline

# ══════════════════════════════════════════════

# SECTION 20-A : 연도별 타임라인 확장 (v3.3)

# ══════════════════════════════════════════════

# 추가: 대운전환기 플래그, 세운-일주 직접 관계, 월운 반영

def _is_daewoon_transition(year: int, dw_detail: List[Dict]) -> Dict[str, Any]:
    """대운 전환기(±1년) 판별"""
    for i, dw in enumerate(dw_detail):
        sy = dw["start_year"]
        if abs(year - sy) <= 1 and year >= sy - 1:
            prev_dw = dw_detail[i - 1] if i > 0 else None
            return {
                "전환기": True,
                "전환연도": sy,
                "이전대운": prev_dw["daewoon_pillar"] if prev_dw else None,
                "신규대운": dw["daewoon_pillar"],
                "비고": "대운 교체기(±1년)는 인생의 큰 전환점",
            }
    return {"전환기": False}

def _calc_sewoon_ilju_relation(sw_stem: str, sw_branch: str, day_stem: str, day_branch: str) -> List[str]:
    """세운 간지와 일주 간지의 직접 관계 (특히 중요)"""
    rels = []
    # 천간
    if (sw_stem, day_stem) in STEM_COMBINE:
        rels.append(f"세운천간합일간({sw_stem}합{day_stem})→인연·기회")
    if (sw_stem, day_stem) in STEM_CLASH:
        rels.append(f"세운천간충일간({sw_stem}충{day_stem})→갈등·변화")
    if (sw_stem, day_stem) in STEM_KE_PAIRS:
        rels.append(f"세운천간극일간({sw_stem}극{day_stem})→압박·도전")
    # 지지
    if (sw_branch, day_branch) in BRANCH_COMBINE:
        rels.append(f"세운지지합일지({sw_branch}합{day_branch})→배우자운·안정")
    if (sw_branch, day_branch) in BRANCH_CLASH:
        rels.append(f"세운지지충일지({sw_branch}충{day_branch})→이동·이별·큰변화")
    if (sw_branch, day_branch) in BRANCH_HARM:
        rels.append(f"세운지지해일지({sw_branch}해{day_branch})→은근한 방해")
    if (sw_branch, day_branch) in BRANCH_PUNISH:
        rels.append(f"세운지지형일지({sw_branch}형{day_branch})→마찰·구설")
    return rels

def _build_monthly_fortune(year: int, day_stem: str, day_branch: str, year_branch: str, yong_info: Dict, verdict: str = "", geok_type: str = "") -> List[Dict[str, Any]]:
    """특정 연도의 12개월 월운 간이 분석"""
    try:
        from datetime import datetime
        now_proxy = datetime(year, 6, 15, tzinfo=KST)
        ey, ygz = _year_gz(now_proxy)
        ys = ygz[0]
        fs = _fms(ys)
        ssi = HEAVENLY_STEMS.index(fs)
    except Exception:
        return []

    months = []
    for i in range(12):
        m_stem = HEAVENLY_STEMS[(ssi + i) % 10]
        m_branch = MONTH_BRL[i]
        m_tg = ten_god(day_stem, m_stem)
        m_unseong = twelve_unseong(day_stem, m_branch)
        m_yfit = _check_yongshin_fit(m_stem, m_branch, yong_info, day_stem)

        # 월운-일주 관계
        m_rels = []
        if (m_branch, day_branch) in BRANCH_CLASH:
            m_rels.append(f"월지충일지({m_branch}충{day_branch})")
        if (m_branch, day_branch) in BRANCH_COMBINE:
            m_rels.append(f"월지합일지({m_branch}합{day_branch})")

        score_adj = 0
        score_adj += float(m_yfit["용신부합"]) * 8
        score_adj += float(m_yfit["희신부합"]) * 4
        score_adj -= float(m_yfit["기신부합"]) * 8
        score_adj -= float(m_yfit.get("구신부합", 0)) * 4
        score_adj += _UNSEONG_SCORE.get(m_unseong, 0) * 0.5 * _unseong_mult(m_unseong, verdict, geok_type)

        months.append({
            "월": i + 1,
            "월건": m_branch,
            "간지": m_stem + m_branch,
            "십성": m_tg,
            "12운성": m_unseong,
            "용신부합": m_yfit["용신부합"],
            "희신부합": m_yfit["희신부합"],
            "기신부합": m_yfit["기신부합"],
            "월운_일주관계": m_rels,
            "점수보정": round(score_adj),
        })
    return months

# ══════════════════════════════════════════════
# SECTION 22 : 월운 상세 빌드 (v3.3)
# ══════════════════════════════════════════════

# 세운 타임라인과 동일 구조로 12개월분 생성
# 차트에서 “1년” 클릭 시 1월~12월 표시용

# ══════════════════════════════════════════════
# 월건(月建) 절기 기반 월 시작 지지

MONTH_BRANCHES = list("寅卯辰巳午未申酉戌亥子丑")  # 1월(寅)~12월(丑)

def _month_stem(year_stem: str, month_idx: int) -> str:
    """연간 기준 월간 산출 (연상기월법)"""
    fs = _fms(year_stem)
    ssi = HEAVENLY_STEMS.index(fs)
    return HEAVENLY_STEMS[(ssi + month_idx) % 10]

def build_monthly_timeline(r, dw_detail, target_year: int) -> List[Dict[str, Any]]:
    """
    특정 연도의 12개월 월운 상세 데이터 생성.
    세운 타임라인(연도별)과 동일한 구조.

    Parameters:
        r: enrich_saju 결과
        dw_detail: build_daewoon_detail 결과
        target_year: 조회 대상 연도
    """
    ds = r["원국"]["day"][0]
    db = r["원국"]["day"][1]
    yb = r["원국"]["year"][1]
    yong = r["용신"]
    geok_type = r.get("격국", {}).get("격국유형", "")
    verdict = r.get("신강신약", {}).get("판정", "")
    disease_info_mt = yong.get("병인진단")
    tmap_mt = day_tengo_ohaeng(ds)
    o_stems = [r["원국"][k][0] for k in ("year", "month", "day", "hour")]
    o_branches = [r["원국"][k][1] for k in ("year", "month", "day", "hour")]
    natal_gm_info = r.get("공망분류")

    # v6.1: 원국 고유 균형도
    natal_bal = _ohang_balance(o_stems, o_branches, yong_info=yong)

    birth_year = r["입력"]["년"]
    sol = r["입력"].get("음력→양력")
    if sol and sol.get("solar_year"):
        birth_year = sol["solar_year"]

    # 해당 연도의 대운 찾기
    dw = None
    for d in dw_detail:
        if d["start_year"] <= target_year < d["end_year"]:
            dw = d
            break
    if not dw:
        if dw_detail:
            dw = dw_detail[0] if target_year < dw_detail[0]["start_year"] else dw_detail[-1]
        else:
            dw = None
    if not dw:
        return []

    # 해당 연도의 세운 간지
    sw_gz = _sewoon_gz(target_year)
    sw_s, sw_b = sw_gz[0], sw_gz[1]

    # ── 세운 독립점수 (통일 함수 사용) ────────────
    _sw_ind_result = _calc_sewoon_independent_score(
        sw_s, sw_b, ds, yb, o_stems, o_branches, dw["stem"], dw["branch"], yong, geok_type, verdict,
        day_gz=ds + db, disease_info=disease_info_mt, tmap=tmap_mt,
        natal_balance=natal_bal, natal_gm_info=natal_gm_info,
    )
    sw_ind = _sw_ind_result["score"]
    dw_t = float(dw["종합운점수"])
    dw_dev = dw_t - 50
    sw_dev = sw_ind - 50
    avg_dir = (dw_dev + sw_dev) / 100.0
    strength = abs(dw_dev / 50.0) * abs(sw_dev / 50.0)
    # v6.1: 시너지 cap ±5
    synergy = max(-5, min(5, avg_dir * strength * 12))
    sw_base_score = max(0, min(100, round(dw_t * 0.6 + sw_ind * 0.4 + synergy)))

    # 연간 기준 월간 산출
    try:
        now_proxy = datetime(target_year, 6, 15, tzinfo=KST)
        month_defs = build_wolwoon(now_proxy)
    except Exception:
        month_defs = []
        for mi in range(12):
            month_defs.append({
                "month_index": mi + 1,
                "branch": MONTH_BRANCHES[mi],
                "ganzhi": _month_stem(sw_s, mi) + MONTH_BRANCHES[mi],
            })

    timeline = []
    for mi, month_meta in enumerate(month_defs):
        m_gz = month_meta["ganzhi"]
        m_stem = m_gz[0]
        m_branch = month_meta["branch"]
        month_num = month_meta.get("month_index", mi + 1)
        month_start = month_meta.get("start")
        month_end = month_meta.get("end")

        # ── 기본 정보 ────────────────────────
        m_tg_stem = ten_god(ds, m_stem)
        m_tg_branch = branch_main_tg(ds, m_branch)
        m_unseong = twelve_unseong(ds, m_branch)
        m_naeum = nayin(m_gz)

        # ── 용신 부합 ────────────────────────
        m_yfit = _check_yongshin_fit(m_stem, m_branch, yong, ds)

        # ── 월운 vs 원국 관계 ─────────────────
        m_rels_orig = _calc_incoming_relations(
            m_stem, m_branch, o_stems, o_branches
        )

        # ── 월운 vs 대운 관계 ─────────────────
        m_rels_dw = _calc_two_pillar_relations(
            m_stem, m_branch, dw["stem"], dw["branch"]
        )

        # ── 월운 vs 세운 관계 ─────────────────
        m_rels_sw = _calc_two_pillar_relations(
            m_stem, m_branch, sw_s, sw_b
        )

        # ── 월운-일주 직접 관계 ───────────────
        m_ilju_rels = _calc_sewoon_ilju_relation(
            m_stem, m_branch, ds, db
        )

        # ── 월운 신살 ────────────────────────
        m_gil, m_hyung = _check_incoming_shinsal(
            m_branch, ds, yb, o_branches
        )

        # ── 보조지표 ────────────────────────
        dw_yfit = {
            "용신부합": dw["용신부합"],
            "희신부합": dw["희신부합"],
            "기신부합": dw["기신부합"],
        }
        m_ypower = _calc_yongshin_power(dw_yfit, m_yfit)

        m_energy = _calc_energy_field(
            m_rels_orig, m_rels_dw + m_rels_sw,
            yong_info=yong, inc_stem=m_stem, inc_branch=m_branch,
            orig_stems=o_stems, orig_branches=o_branches
        )

        all_gil = dw["신살_길신"] + m_gil
        all_hyung = dw["신살_흉살"] + m_hyung
        m_noble = _calc_noble_power(m_gil, m_hyung)

        m_balance = _ohang_balance(
            o_stems + [dw["stem"], sw_s, m_stem],
            o_branches + [dw["branch"], sw_b, m_branch],
            yong_info=yong,
        )

        m_unseong_score = _UNSEONG_SCORE.get(m_unseong, 0)

        m_tengo_bal = _calc_tengo_balance(
            ds,
            o_stems + [dw["stem"], sw_s, m_stem],
            o_branches + [dw["branch"], sw_b, m_branch],
        )

        # [v5] 삼합/방합 + 공망(진공/가공) + 신살맥락 + 해공
        m_trine = _check_trine_direction(m_branch, o_branches, [dw["branch"], sw_b])
        m_t_pos, m_t_neg = _trine_energy_adj(m_trine, yong)
        m_gm = _gongmang_factors(m_branch, ds + db, o_branches)
        m_haegong = _haegong_check(m_branch, natal_gm_info)
        m_shinsal_adj = _contextual_shinsal_adj(m_gil, m_hyung, verdict, geok_type)
        m_shinsal_detail = _shinsal_adj_detail(m_gil, m_hyung, verdict, geok_type)
        m_dis_res = _disease_resolution_score(m_stem, m_branch, disease_info_mt, tmap_mt)

        # ── 종합 점수: v6.2 가산 혼합 + 해공 ──
        _m_comp = _composite_score(
            50, m_yfit, m_unseong, _calc_noble_power(m_gil, m_hyung),
            m_energy["direction"], m_balance, geok_type, verdict,
            tg_stem=m_tg_stem, tg_branch=m_tg_branch,
            trine_pos=m_t_pos, trine_neg=m_t_neg, gm=m_gm,
            shinsal_adj=m_shinsal_adj,
            disease_resolution=m_dis_res,
            natal_balance=natal_bal,
            haegong_bonus=m_haegong["bonus"],
        )
        m_ind = _m_comp["score"]
        m_breakdown = _m_comp["breakdown"]

        # [v6.1] 가산 혼합 모델: 세운 중립(45~55)이면 월운 비중 높여 변동 체감↑
        if 45 <= sw_base_score <= 55:
            mw = 0.42  # 중립 해 → 월운 42%
            sw_w = 1.0 - mw
        else:
            mw = MONTH_BLEND_MW   # 극단 해 → 월운 35%
            sw_w = MONTH_BLEND_SW
        score = max(0, min(100, round(
            sw_base_score * sw_w + m_ind * mw
        )))

        # ── 캔들 OHLC ────────────────────────
        candle_open = int(sw_base_score)
        candle_close = score
        candle_high = min(
            100,
            round(score + len(m_gil) * 3 + max(m_ypower, 0) * 8),
        )
        candle_low = max(
            0,
            round(
                score
                - len(m_hyung) * 3
                - abs(min(m_energy["direction"], 0)) * 4
            ),
        )

        # ── 시즌태그 ────────────────────────
        m_season = _calc_season_tag(
            m_ypower,
            m_energy["total"],
            m_energy["direction"],
        )

        # ── 이벤트확률 ───────────────────────
        _, _, m_rel_keys_orig = _extract_rel_keys(m_rels_orig)
        _, _, m_rel_keys_dw = _extract_rel_keys(m_rels_dw)
        _, _, m_rel_keys_sw = _extract_rel_keys(m_rels_sw)

        m_events = _calc_event_probabilities(
            all_gil + all_hyung,
            m_rel_keys_orig + m_rel_keys_dw + m_rel_keys_sw,
            m_unseong,
            [
                m_tg_stem,
                m_tg_branch,
                dw["십성_천간"],
                dw["십성_지지"],
            ],
        )

        # ── 도메인 점수 ──────────────────────
        dom = {}
        for d in ("직업", "재물", "건강", "연애", "결혼"):
            base = dw["domainScore"].get(d, 5.0)
            adj = 0.0
            adj += float(m_yfit["용신부합"]) * 0.4
            adj += float(m_yfit["희신부합"]) * 0.2
            adj -= float(m_yfit["기신부합"]) * 0.3
            for tg in (m_tg_stem, m_tg_branch):
                adj += _TG_DOM.get(tg, {}).get(d, 0.0)

            dom[d] = max(
                0.0,
                min(10.0, round(base + adj, 1)),
            )

        timeline.append({
            "month": month_num,
            "start": month_start,
            "end": month_end,
            "월건": m_branch,
            "간지": m_gz,
            "stem": m_stem,
            "branch": m_branch,
            "stemElement": STEM_ELEMENT[m_stem],
            "branchElement": BRANCH_ELEMENT_MAIN[m_branch],
            "대운_pillar": dw["daewoon_pillar"],
            "세운_pillar": sw_gz,
            "십성_천간": m_tg_stem,
            "십성_지지": m_tg_branch,
            "12운성": m_unseong,
            "납음": m_naeum,
            "용신부합": m_yfit["용신부합"],
            "희신부합": m_yfit["희신부합"],
            "기신부합": m_yfit["기신부합"],
            "구신부합": m_yfit.get("구신부합", False),
            "관계_with_원국": m_rels_orig,
            "관계_with_대운": m_rels_dw,
            "관계_with_세운": m_rels_sw,
            "일주관계": m_ilju_rels,
            "신살_길신": m_gil,
            "신살_흉살": m_hyung,
            "candle": {
                "open": candle_open,
                "close": candle_close,
                "high": candle_high,
                "low": candle_low,
                "type": "양봉" if candle_close >= candle_open else "음봉",
            },
            "scores": {
                "종합": score,
                "직업": dom["직업"],
                "재물": dom["재물"],
                "건강": dom["건강"],
                "연애": dom["연애"],
                "결혼": dom["결혼"],
            },
            "breakdown": m_breakdown,
            "trine_hits": [dict(h, applies_to="monthly") for h in m_trine],
            "gongmang_factors": m_gm,
            "haegong": m_haegong,
            "shinsal_context_adj": m_shinsal_detail,
            "indicators": {
                "용신력": m_ypower,
                "에너지장": m_energy,
                "귀인력": m_noble,
                "오행균형도": m_balance,
                "12운성곡선": m_unseong_score,
                "십성밸런스": m_tengo_bal,
            },
            "시즌태그": m_season,
            "이벤트확률": m_events,
        })

    return timeline
# ══════════════════════════════════════════════
# SECTION: 일진(日辰) 해석 엔진 [Fix-13]
# ══════════════════════════════════════════════

def build_daily_fortune(r: Dict[str, Any], target_date_str: str) -> Dict[str, Any]:
    """
    특정 날짜의 일진(日辰) 해석.
    target_date_str: 'YYYY-MM-DD' 형식
    r: compute_all 결과
    """
    from datetime import datetime
    target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")
    
    # 율리우스 일수 기반 일진 산출 (기준: 1984-01-01 = 甲子일)
    y, m, d_val = target_dt.year, target_dt.month, target_dt.day
    if m <= 2:
        y -= 1; m += 12
    jd = int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d_val - 1524.5
    base_jd = 2445336.5  # 1983-01-27 = 甲子日
    day_offset = int(jd - base_jd) % 60
    d_stem = HEAVENLY_STEMS[day_offset % 10]
    d_branch = EARTHLY_BRANCHES[day_offset % 12]
    d_pillar = d_stem + d_branch
    
    ds = r["원국"]["day"][0]
    db = r["원국"]["day"][1]
    o_stems = [r["원국"][p][0] for p in ("year","month","day","hour")]
    o_branches = [r["원국"][p][1] for p in ("year","month","day","hour")]
    yong = r["용신"]
    
    # 십신
    tg_stem = ten_god(ds, d_stem)
    tg_branch = ten_god(ds, branch_main_hs(d_branch) or d_stem)
    
    # 12운성
    d_unseong = twelve_unseong(ds, d_branch)
    
    # 용신 부합
    d_elem_s = STEM_ELEMENT[d_stem]
    d_elem_b = BRANCH_ELEMENT_MAIN.get(d_branch, "")
    yong_elem = yong.get("용신_오행", "")
    hui_elems = yong.get("희신_오행", [])
    gi_elems = yong.get("기신_오행", [])
    
    gu_elems = yong.get("구신_오행", [])

    yong_match = d_elem_s == yong_elem or d_elem_b == yong_elem
    hui_match = d_elem_s in hui_elems or d_elem_b in hui_elems
    gi_match = d_elem_s in gi_elems or d_elem_b in gi_elems
    gu_match = d_elem_s in gu_elems or d_elem_b in gu_elems

    # 일진-원국 관계
    d_rels_orig = _calc_incoming_relations(d_stem, d_branch, o_stems, o_branches)

    # 신살
    d_gil, d_hyung = _check_incoming_shinsal(d_branch, ds, o_branches[0], o_branches)

    # 에너지장
    d_energy = _calc_energy_field(d_rels_orig, [], yong_info=yong,
                                  inc_stem=d_stem, inc_branch=d_branch,
                                  orig_stems=o_stems, orig_branches=o_branches)

    # 점수 산출
    d_geok_type = r.get("격국", {}).get("격국유형", "")
    d_verdict = r.get("신강신약", {}).get("판정", "")
    d_day_gz = ds + db

    d_tg_s = ten_god(ds, d_stem)
    d_tg_b = branch_main_tg(ds, d_branch)
    d_gm = _gongmang_factors(d_branch, d_day_gz, o_branches)
    d_haegong = _haegong_check(d_branch, r.get("공망분류"))
    d_trine = _check_trine_direction(d_branch, o_branches)
    d_t_pos, d_t_neg = _trine_energy_adj(d_trine, yong)
    d_shinsal_adj = _contextual_shinsal_adj(d_gil, d_hyung, d_verdict, d_geok_type)

    d_yfit = {
        "용신부합": 1.0 if yong_match else 0.0,
        "희신부합": 1.0 if hui_match else 0.0,
        "기신부합": 1.0 if gi_match else 0.0,
        "구신부합": 1.0 if gu_match else 0.0,
    }
    _d_comp = _composite_score(
        50, d_yfit, d_unseong, _calc_noble_power(d_gil, d_hyung),
        d_energy["direction"], 0.5, d_geok_type, d_verdict,
        tg_stem=d_tg_s, tg_branch=d_tg_b,
        trine_pos=d_t_pos, trine_neg=d_t_neg, gm=d_gm,
        shinsal_adj=d_shinsal_adj,
        haegong_bonus=d_haegong["bonus"],
    )
    score = _d_comp["score"]
    d_breakdown = _d_comp["breakdown"]
    
    # 등급
    if score >= 70: grade = "길일(吉日)"
    elif score >= 55: grade = "보통"
    elif score >= 40: grade = "소흉(小凶)"
    else: grade = "흉일(凶日)"
    
    # 시즌 태그
    ypower = 0.3 if yong_match else (-0.2 if gi_match else 0.0)
    season = _calc_season_tag(ypower, d_energy["total"], d_energy["direction"])
    
    return {
        "날짜": target_date_str,
        "일진": d_pillar,
        "천간": d_stem,
        "지지": d_branch,
        "십신_천간": tg_stem,
        "십신_지지": tg_branch,
        "12운성": d_unseong,
        "용신부합": yong_match,
        "희신부합": hui_match,
        "기신부합": gi_match,
        "구신부합": gu_match,
        "관계": d_rels_orig,
        "신살_길신": d_gil,
        "신살_흉살": d_hyung,
        "에너지장": d_energy,
        "점수": score,
        "등급": grade,
        "breakdown": d_breakdown,
        "trine_hits": [dict(h, applies_to="daily") for h in d_trine],
        "gongmang_factors": d_gm,
        "haegong": d_haegong,
        "shinsal_context_adj": _shinsal_adj_detail(d_gil, d_hyung, d_verdict, d_geok_type),
        "시즌태그": season,
        "오행": {"천간": STEM_ELEMENT[d_stem], "지지": BRANCH_ELEMENT_MAIN.get(d_branch, "")},
    }


# ══════════════════════════════════════════════
# build_chart_payload 패치: 월운 데이터 추가
# ══════════════════════════════════════════════

def build_chart_payload(r, include_monthly_year: int = None):
    """
    v3.3: 차트 페이로드 생성.
    include_monthly_year가 지정되면 해당 연도의 12개월 월운도 포함.
    """
    ds = r["원국"]["day"][0]
    yong = r["용신"]
    dw_detail = build_daewoon_detail(r)
    timeline = build_yearly_timeline(r, dw_detail, span=100)

    # 월운 데이터 (선택적)
    monthly = None
    if include_monthly_year:
        monthly = build_monthly_timeline(r, dw_detail, include_monthly_year)

    birth_year = r["입력"]["년"]
    sol = r["입력"].get("음력→양력")
    if sol and sol.get("solar_year"):
        birth_year = sol["solar_year"]

    payload = {
        "meta": {
            "birthYear": birth_year,
            "gender": r["입력"]["성별"],
            "dayStem": ds,
            "dayElement": STEM_ELEMENT[ds],
            "strength": r["신강신약"]["판정"],
            "geokguk": r["격국"]["격국"],
            "geokgukType": r["격국"].get("격국유형", "정격"),
            "yongshin": {
                "label": yong.get("용신", ""),
                "element": yong.get("용신_오행", "")
            },
            "heeshin": [
                {"label": h, "element": e}
                for h, e in zip(
                    yong.get("희신", []),
                    yong.get("희신_오행", [])
                )
            ],
            "gishin": [
                {"label": g, "element": e}
                for g, e in zip(
                    yong.get("기신", []),
                    yong.get("기신_오행", [])
                )
            ],
            "johu": yong.get("조후용신", {}),
            "tonggwan": yong.get("통관용신", {}),
            "confidence": yong.get("판정확신도", "보통"),
        },
        "원국_baseline": {
            "오행분포": r["오행분포"]["분포"],
            "patternScore": r["패턴점수"]["총점"],
            "domainScore": r["DomainScore"]["점수"],
        },
        "궁성론": r.get("궁성론", []),
        "대운기둥10": dw_detail,
        "연도별_타임라인": timeline,
        "보조지표_범례": {
            "용신력": {
                "desc": "대운+세운(+월운)이 용신/희신 오행을 공급하는 정도",
                "range": [-1, 1],
                "analogy": "RSI"
            },
            "에너지장": {
                "desc": "합·충·형·파·해·극의 절대 에너지 총량",
                "range": [0, 10],
                "analogy": "거래대금"
            },
            "귀인력": {
                "desc": "길신/흉살 가중합산 (양수=귀인 도움, 음수=자력 극복)",
                "range": [-20, 20],
                "analogy": "기관수급"
            },
            "12운성곡선": {
                "desc": "12운성 점수 (생→왕→사→절 사이클)",
                "range": [-12, 12],
                "analogy": "이동평균선"
            },
            "오행균형도": {
                "desc": "원국+대운+세운(+월운) 합산 오행 균형",
                "range": [0, 1],
                "analogy": "MACD"
            },
            "십성밸런스": {
                "desc": "비겁/식상/재성/관살/인성 5축 에너지 분포",
                "range": "radar",
                "analogy": "섹터로테이션"
            },
            "시즌태그": {
                "desc": "확장기/안정기/전환기/인내기/격변기/평온기",
                "range": "category",
                "analogy": "시장국면"
            },
            "이벤트확률": {
                "desc": "이직·연애·건강·재물·학업·갈등 발생 가능성(%)",
                "range": [5, 95],
                "analogy": "종목리포트"
            },
        },
    }

    if monthly is not None:
        payload["월운_타임라인"] = {
            "target_year": include_monthly_year,
            "data": monthly,
        }

    return payload


# ══════════════════════════════════════════════
# compute_all 패치: 월운 연도 파라미터 추가
# ══════════════════════════════════════════════

def compute_all(inp: BirthInput, monthly_year: int = None,
                yongshin_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if monthly_year is None:
        monthly_year = datetime.now(KST).year
    r = enrich_saju(inp)

    # LLM 용신 override: 캐시된 LLM 판별 결과로 룰 베이스 용신을 대체
    if yongshin_override:
        tmap = day_tengo_ohaeng(r["원국"]["day"][0])
        _cat_for = {e: c for c, e in tmap.items()}
        yo = yongshin_override.get("용신_오행", "")
        he = yongshin_override.get("희신_오행", [])
        gi = yongshin_override.get("기신_오행", [])
        gu = yongshin_override.get("구신_오행", [])
        def _label(elem):
            cat = _cat_for.get(elem, "")
            LABELS = {
                "비겁": "비겁(비견·겁재)", "식상": "식상(식신·상관)",
                "재성": "재성(편재·정재)", "관살": "관살(편관·정관)",
                "인성": "인성(편인·정인)",
            }
            return f"{LABELS.get(cat, cat)}/{elem}" if cat else f"LLM({elem})"

        r["용신"].update({
            "용신": _label(yo), "용신_오행": yo,
            "희신": [_label(e) for e in he], "희신_오행": list(he),
            "기신": [_label(e) for e in gi], "기신_오행": list(gi),
            "구신_오행": list(gu),
            "용신체계": "LLM판별",
        })

    r["chart_data"] = build_chart_payload(
        r,
        include_monthly_year=monthly_year
    )
    return r


if __name__ == "__main__":
    import sys

    inp = BirthInput(
        year=1997,
        month=3,
        day=6,
        hour=3,
        minute=25,
        calendar="solar",
        gender="male"
    )

    monthly_year = None

    args = sys.argv[1:]

    if len(args) >= 5:
        inp = BirthInput(
            year=int(args[0]),
            month=int(args[1]),
            day=int(args[2]),
            hour=int(args[3]),
            minute=int(args[4]),
            calendar=args[5] if len(args) > 5 else "solar",
            gender=args[6] if len(args) > 6 else "male",
        )

    # 8번째 인자: 월운 조회 연도 (optional)
    if len(args) > 7:
        monthly_year = int(args[7])

    r = compute_all(inp, monthly_year=monthly_year)
    print(saju_to_json(r["chart_data"]))