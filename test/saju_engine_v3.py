# -*- coding: utf-8 -*-
"""
saju_engine_v3.py
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
UNSEONG_ORDER = ["長生","沐浴","冠帶","臨官","帝旺","衰","病","死","墓","絶","胎","養"]
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

# ──────────────────────────────────────────────
# SECTION 3 : 십성
# ──────────────────────────────────────────────
GEN_MAP = {"木":"火","火":"土","土":"金","金":"水","水":"木"}
KE_MAP  = {"木":"土","土":"水","水":"火","火":"金","金":"木"}

def ten_god(day:str, tgt:str)->str:
    de,te=STEM_ELEMENT[day],STEM_ELEMENT[tgt]
    dy,ty=YINYANG_STEM[day],YINYANG_STEM[tgt]
    s=(dy==ty)
    if te==de:          return "比肩" if s else "劫財"
    if te==GEN_MAP[de]: return "食神" if s else "傷官"
    if te==KE_MAP[de]:  return "偏財" if s else "正財"
    if de==KE_MAP[te]:  return "七殺" if s else "正官"
    if de==GEN_MAP[te]: return "偏印" if s else "正印"
    return "?"

def branch_main_hs(br:str)->Optional[str]:
    hs=BRANCH_HIDDEN_STEMS.get(br,[])
    return hs[0] if hs else None

def branch_main_tg(day:str,br:str)->str:
    m=branch_main_hs(br)
    return ten_god(day,m) if m else "?"

# [추가] 일간 오행 기준 십성 카테고리→실제 오행 매핑
def day_tengo_ohaeng(day_stem:str)->Dict[str,str]:
    """일간 기준 각 십성 카테고리의 실제 오행 반환"""
    de=STEM_ELEMENT[day_stem]
    inv_ke  = {v:k for k,v in KE_MAP.items()}
    inv_gen = {v:k for k,v in GEN_MAP.items()}
    return {
        "비겁": de,
        "식상": GEN_MAP[de],
        "재성": KE_MAP[de],
        "관살": inv_ke[de],
        "인성": inv_gen[de],
    }

# ──────────────────────────────────────────────
# SECTION 4 : 합/충/형/파/해 + 관계 확장 테이블
# ──────────────────────────────────────────────
STEM_COMBINE = {("甲","己"),("己","甲"),("乙","庚"),("庚","乙"),("丙","辛"),("辛","丙"),
                ("丁","壬"),("壬","丁"),("戊","癸"),("癸","戊")}
# [추가] 천간충 (甲庚·乙辛·丙壬·丁癸)
STEM_CLASH = {("甲","庚"),("庚","甲"),("乙","辛"),("辛","乙"),("丙","壬"),("壬","丙"),("丁","癸"),("癸","丁")}
# [추가] 천간극 (生성 관계로 일방이 타방 오행을 克)
_STEM_KE: set = set()
for _s1 in HEAVENLY_STEMS:
    for _s2 in HEAVENLY_STEMS:
        if _s1!=_s2 and KE_MAP.get(STEM_ELEMENT[_s1])==STEM_ELEMENT[_s2]:
            _STEM_KE.add((_s1,_s2))
STEM_KE_PAIRS = frozenset(_STEM_KE)

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

# [추가] 반합(半合) – 삼합의 왕지 포함 2지지
BRANCH_SEMI_COMBINE = {
    ("申","子"):"水반합",("子","申"):"水반합",("子","辰"):"水반합",("辰","子"):"水반합",
    ("寅","午"):"火반합",("午","寅"):"火반합",("午","戌"):"火반합",("戌","午"):"火반합",
    ("亥","卯"):"木반합",("卯","亥"):"木반합",("卯","未"):"木반합",("未","卯"):"木반합",
    ("巳","酉"):"金반합",("酉","巳"):"金반합",("酉","丑"):"金반합",("丑","酉"):"金반합",
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
    _CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shinsal_lookup_v2.csv")
except NameError:
    _CSV_PATH = os.path.join(os.getcwd(), "shinsal_lookup_v2.csv")

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

# ──────────────────────────────────────────────
# SECTION 8 : 신강/신약
# ──────────────────────────────────────────────
SEASON_SUPPORT = {"寅":"木","卯":"木","辰":"土","巳":"火","午":"火","未":"土",
                  "申":"金","酉":"金","戌":"土","亥":"水","子":"水","丑":"土"}

def strength_score(day_stem:str,month_branch:str,stems:List[str],branches:List[str])->Tuple[int,str]:
    de=STEM_ELEMENT[day_stem]; sc=0
    se=SEASON_SUPPORT.get(month_branch,"")
    if se==de: sc+=4
    elif GEN_MAP.get(de)==se: sc+=1
    elif GEN_MAP.get(se,"")==de: sc+=2
    for s in stems:
        if STEM_ELEMENT[s]==de: sc+=2
    for b in branches:
        if any(STEM_ELEMENT[x]==de for x in BRANCH_HIDDEN_STEMS.get(b,[])): sc+=2
    inv_gen={v:k for k,v in GEN_MAP.items()}
    for s in stems:
        if STEM_ELEMENT[s]==inv_gen.get(de,""): sc+=1
    v="신강" if sc>=9 else ("중간" if sc>=6 else "신약")
    return sc,v

# ──────────────────────────────────────────────
# SECTION 9 : 격국 / 용신 / 희신 / 기신 [Q2 개선]
# ──────────────────────────────────────────────
_TG_TO_GEOK = {
    "比肩":"비겁격","劫財":"비겁격","食神":"식신격","傷官":"상관격",
    "偏財":"편재격","正財":"정재격","七殺":"편관격","正官":"정관격",
    "偏印":"편인격","正印":"정인격",
}

def classify_geokguk(day_stem:str,month_branch:str)->Dict[str,Any]:
    """월지 본기 십성 → 격국 판별"""
    main=branch_main_hs(month_branch)
    if not main: return {"격국":"불명","격국_십성":"?","월지_본기":None}
    tg=ten_god(day_stem,main)
    return {"격국":_TG_TO_GEOK.get(tg,"잡기격"),"격국_십성":tg,"월지_본기":main}

def determine_yongshin(geok:str, verdict:str, day_stem:str)->Dict[str,Any]:
    """[Q2] 신강/신약 × 격국 → 용신/희신/기신 + 실제 오행 반환"""
    tmap=day_tengo_ohaeng(day_stem)

    def _fmt(cat:str)->str:
        LABELS={"비겁":"비겁(比劫)","식상":"식상(食傷)","재성":"재성(財星)","관살":"관살(官殺)","인성":"인성(印星)"}
        return f"{LABELS.get(cat,cat)}/{tmap.get(cat,'?')}"

    # 신강 용신표
    STRONG_TABLE = {
        "식신격":  {"용신":"식상","희신":["재성"],"기신":["인성","비겁"]},
        "상관격":  {"용신":"재성","희신":["관살"],"기신":["비겁"]},
        "편재격":  {"용신":"식상","희신":["관살"],"기신":["비겁"]},
        "정재격":  {"용신":"식상","희신":["관살"],"기신":["비겁"]},
        "편관격":  {"용신":"인성","희신":["식상"],"기신":["재성"]},
        "정관격":  {"용신":"인성","희신":["재성"],"기신":["식상"]},
        "편인격":  {"용신":"재성","희신":["관살"],"기신":["식상"]},
        "정인격":  {"용신":"재성","희신":["관살"],"기신":["식상"]},
        "비겁격":  {"용신":"식상","희신":["재성"],"기신":["인성"]},
    }
    # 신약 용신표
    WEAK_TABLE = {
        "식신격":  {"용신":"비겁","희신":["인성"],"기신":["관살"]},
        "상관격":  {"용신":"인성","희신":["비겁"],"기신":["관살"]},
        "편재격":  {"용신":"비겁","희신":["인성"],"기신":["관살"]},
        "정재격":  {"용신":"비겁","희신":["인성"],"기신":["관살"]},
        "편관격":  {"용신":"인성","희신":["비겁"],"기신":["재성"]},
        "정관격":  {"용신":"인성","희신":["비겁"],"기신":["식상"]},
        "편인격":  {"용신":"비겁","희신":["관살"],"기신":["재성"]},
        "정인격":  {"용신":"비겁","희신":["관살"],"기신":["재성"]},
        "비겁격":  {"용신":"인성","희신":["비겁"],"기신":["재성"]},
    }
    # 중간: 균형 유지
    if verdict=="중간":
        return {"용신":"중화(균형 유지)","용신_오행":"전체","희신":[],"기신":[],"비고":"신강신약 균형 상태 – 격국 유지가 우선"}

    tbl = STRONG_TABLE if verdict=="신강" else WEAK_TABLE
    row = tbl.get(geok, {"용신":"인성","희신":["비겁"],"기신":["재성"]})

    return {
        "용신":    _fmt(row["용신"]),
        "용신_오행": tmap.get(row["용신"],"?"),
        "희신":    [_fmt(h) for h in row["희신"]],
        "희신_오행": [tmap.get(h,"?") for h in row["희신"]],
        "기신":    [_fmt(g) for g in row["기신"]],
        "기신_오행": [tmap.get(g,"?") for g in row["기신"]],
        "비고":    f"{verdict} × {geok}",
    }

# ──────────────────────────────────────────────
# SECTION 10 : 오행 불균형 진단
# ──────────────────────────────────────────────
_OHANG_INFO = {
    "木":{"보완":"金","팁":"절제·정리·스틸 톤 인테리어","장부":"간·담"},
    "火":{"보완":"水","팁":"수영·명상·블랙 컬러, 카페인↓","장부":"심장·소장"},
    "土":{"보완":"木","팁":"산책·독서·그린 컬러, 미니멀리즘","장부":"비장·위"},
    "金":{"보완":"火","팁":"댄스·레드 컬러, 협업 강화","장부":"폐·대장"},
    "水":{"보완":"土","팁":"근력 운동·브라운 컬러, GTD 체크","장부":"신장·방광"},
}

def ohang_imbalance(stems:List[str],branches:List[str])->Dict[str,Any]:
    cnt={"木":0,"火":0,"土":0,"金":0,"水":0}
    for s in stems: cnt[STEM_ELEMENT[s]]+=1
    for b in branches: cnt[BRANCH_ELEMENT_MAIN[b]]+=1
    excess=[e for e,v in cnt.items() if v>=3]
    deficient=[e for e,v in cnt.items() if v==0]
    low=[e for e,v in cnt.items() if v==1]
    return {
        "분포":cnt,"과다(3개↑)":excess,"부족(0개)":deficient,"적음(1개)":low,
        "과다_보완_오행":{e:_OHANG_INFO[e]["보완"] for e in excess},
        "부족_보완팁":{e:_OHANG_INFO[e]["팁"] for e in deficient},
        "건강_주의":{e:_OHANG_INFO[e]["장부"] for e in excess+deficient},
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
    "比肩":{"직업":0.3,"재물":-0.2,"건강":0.1,"연애":-0.1,"결혼":-0.1},
    "劫財":{"직업":0.2,"재물":-0.4,"건강":0.0,"연애":-0.2,"결혼":-0.3},
    "食神":{"직업":0.4,"재물":0.3,"건강":0.5,"연애":0.3,"결혼":0.2},
    "傷官":{"직업":0.5,"재물":0.2,"건강":0.0,"연애":0.4,"결혼":-0.2},
    "偏財":{"직업":0.3,"재물":0.5,"건강":0.0,"연애":0.5,"결혼":0.1},
    "正財":{"직업":0.2,"재물":0.6,"건강":0.0,"연애":0.2,"결혼":0.5},
    "七殺":{"직업":0.4,"재물":-0.1,"건강":-0.3,"연애":0.1,"결혼":-0.2},
    "正官":{"직업":0.6,"재물":0.2,"건강":0.0,"연애":0.1,"결혼":0.4},
    "偏印":{"직업":0.3,"재물":-0.1,"건강":0.1,"연애":0.0,"결혼":-0.1},
    "正印":{"직업":0.4,"재물":0.1,"건강":0.3,"연애":0.0,"결혼":0.2},
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
}

def domain_score(geok:str,shinsal_hits:List[str],ten_gods_all:Dict[str,str],verdict:str)->Dict[str,Any]:
    dom={"직업":5.0,"재물":5.0,"건강":5.0,"연애":5.0,"결혼":5.0}
    for tg in ten_gods_all.values():
        for d,w in _TG_DOM.get(tg,{}).items(): dom[d]+=w
    for d,w in _GEOK_DOM.get(geok,{}).items(): dom[d]+=w
    if verdict=="신강": dom["직업"]+=0.3; dom["건강"]+=0.2
    elif verdict=="신약": dom["건강"]-=0.3
    for name in shinsal_hits:
        for k,bmap in _SHINSAL_DOM.items():
            if k.split("(")[0] in name or name.split("(")[0] in k:
                for d,w in bmap.items(): dom[d]+=w
    for d in dom: dom[d]=max(0.0,min(10.0,round(dom[d],1)))
    def _g(v): return "High🟢" if v>=7 else ("Mid⚪" if v>=4 else "Low🔴")
    return {"점수":dom,"등급":{d:_g(v) for d,v in dom.items()}}

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

    # 공망
    emp=xunkong(day_gz); emp_h=_hb(emp,branches)
    return {"발현_신살":c.hits,"발현_수":c.hit_count,
            "공망":{"일주":day_gz,"순시작":day_xun_start(day_gz),"공망지지":emp,"원국_적중":emp_h}}

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
                rels.append(f"천간극({si}克{sj})")  # [추가]
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
                rels.append(f"지지형({bi}刑{bj})")
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
# 절기차÷3 = 대운 시작나이 (1일≈4개월)
# ──────────────────────────────────────────────

import math
from datetime import datetime, timedelta
from functools import lru_cache

# -------------------------------------------------
# 1. 태양 황경 계산
# -------------------------------------------------

def _jd(dt):
    y, m = dt.year, dt.month
    D = dt.day + (dt.hour + (dt.minute + dt.second / 60) / 60) / 24
    if m <= 2:
        y -= 1
        m += 12
    A = y // 100
    return (
        int(365.25 * (y + 4716))
        + int(30.6001 * (m + 1))
        + D
        + (2 - A + (A // 4))
        - 1524.5
    )


def _sunlon(dt):
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
    return ((a - t + 540) % 360) - 180


def _bisect(d0, d1, tg, n=60):
    for _ in range(n):
        mid = d0 + (d1 - d0) / 2
        if (_adiff(_sunlon(d0), tg) <= 0) != (_adiff(_sunlon(mid), tg) <= 0):
            d1 = mid
        else:
            d0 = mid
        if (d1 - d0).total_seconds() <= 60:
            return mid
    return d0 + (d1 - d0) / 2


# -------------------------------------------------
# 2. 절(節) 정의
# -------------------------------------------------

JEOL_DEGREES = [
    285, 315, 345, 15, 45, 75,
    105, 135, 165, 195, 225, 255
]

ALL_24_DEGREES = [i * 15.0 for i in range(24)]


# -------------------------------------------------
# 3. 절기 계산
# -------------------------------------------------

def _term_deg(year, deg):
    st = datetime(year - 1, 12, 15, tzinfo=UTC)
    en = datetime(year + 1, 1, 15, tzinfo=UTC)
    step = timedelta(hours=6)

    pt = st
    pd = _adiff(_sunlon(pt), float(deg))
    t = st + step

    while t <= en:
        d = _adiff(_sunlon(t), float(deg))
        if (pd < 0 and d >= 0) or (pd > 0 and d <= 0):
            return _bisect(pt, t, float(deg)).astimezone(KST)
        pt, pd = t, d
        t += step

    return st.astimezone(KST)


def _find_jeol_dates(year):
    results = []
    for y in (year - 1, year, year + 1):
        for deg in JEOL_DEGREES:
            try:
                results.append(_term_deg(y, deg))
            except Exception:
                continue

    unique = {}
    for dt in results:
        key = dt.strftime("%Y%m%d%H")
        unique[key] = dt

    return sorted(unique.values())


def _next_jeol(bkst, forward=True):
    jeol_dates = _find_jeol_dates(bkst.year)

    if forward:
        for dt in jeol_dates:
            if dt > bkst:
                return dt
    else:
        for dt in reversed(jeol_dates):
            if dt < bkst:
                return dt

    return jeol_dates[0] if forward else jeol_dates[-1]


# -------------------------------------------------
# 4. 대운 시작나이 계산
# -------------------------------------------------

def dw_start(bkst, fwd):
    jeol_dt = _next_jeol(bkst, forward=fwd)

    if fwd:
        diff = jeol_dt - bkst
    else:
        diff = bkst - jeol_dt

    total_days = diff.total_seconds() / 86400.0
    start_age = total_days / 3.0

    return {
        "birth": str(bkst.date()),
        "jeol_date": jeol_dt.isoformat(),
        "direction": "순행" if fwd else "역행",
        "days_to_jeol": round(total_days, 1),
        "start_age": round(start_age),
        "start_age_precise": round(start_age, 1),
    }


# -------------------------------------------------
# 5. 세운
# -------------------------------------------------

def build_sewoon(now, n=20):
    ey, _ = _year_gz(now)
    out = []
    for y in range(ey, ey + n):
        idx = (ganzhi_index("甲子") + (y - 1984)) % 60
        out.append({
            "year": y,
            "ganzhi": GANZHI_60[idx],
            "start": ipchun(y).isoformat(),
            "end": ipchun(y + 1).isoformat()
        })
    return out


# -------------------------------------------------
# 6. 월운
# -------------------------------------------------

MONTH_BD = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285]
MONTH_BRL = list("寅卯辰巳午未申酉戌亥子丑")


def build_wolwoon(now):
    ey, ygz = _year_gz(now)
    ys = ygz[0]

    bds = [_term_deg(ey, d) for d in MONTH_BD]
    bds.sort()
    bds.append(ipchun(ey + 1))

    fs = _fms(ys)
    ssi = HEAVENLY_STEMS.index(fs)

    return [
        {
            "month_index": i + 1,
            "branch": MONTH_BRL[i],
            "ganzhi": HEAVENLY_STEMS[(ssi + i) % 10] + MONTH_BRL[i],
            "start": bds[i].isoformat(),
            "end": bds[i + 1].isoformat()
        }
        for i in range(12)
    ]


# -------------------------------------------------
# 7. 대운 생성
# -------------------------------------------------

def build_daewoon(mp, fwd, start_age, n=10):
    step = 1 if fwd else -1
    cur = next_ganzhi(mp, step)
    age = start_age
    out = []

    for i in range(n):
        out.append({
            "index": i + 1,
            "start_age": round(age, 1),
            "end_age": round(age + 10, 1),
            "ganzhi": cur
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
    city:str="Seoul"; use_solar_time:bool=True; utc_offset:int=9; early_zi_time:bool=True

def enrich_saju(inp:BirthInput)->Dict[str,Any]:
    # 음력 변환
    if inp.calendar.lower() in("lunar","음력"):
        sol=lunar_to_solar(inp.year,inp.month,inp.day,is_leap_month=inp.is_leap_month)
        sy,sm,sd,sol_m=sol["solar_year"],sol["solar_month"],sol["solar_day"],sol
    else:
        sy,sm,sd,sol_m=inp.year,inp.month,inp.day,None

    bkst=datetime(sy,sm,sd,inp.hour,inp.minute,tzinfo=KST)
    try:
        saju=calculate_saju(sy,sm,sd,inp.hour,inp.minute,city=inp.city,
                            use_solar_time=inp.use_solar_time,utc_offset=inp.utc_offset,early_zi_time=inp.early_zi_time)
    except TypeError:
        saju=calculate_saju(sy,sm,sd,inp.hour,inp.minute,
                            use_solar_time=inp.use_solar_time,utc_offset=inp.utc_offset,early_zi_time=inp.early_zi_time)

    pillars={"year":saju["year_pillar"],"month":saju["month_pillar"],"day":saju["day_pillar"],"hour":saju["hour_pillar"]}
    stems=[saju["year_stem"],saju["month_stem"],saju["day_stem"],saju["hour_stem"]]
    branches=[saju["year_branch"],saju["month_branch"],saju["day_branch"],saju["hour_branch"]]
    ds=saju["day_stem"]; ys=saju["year_stem"]; mb=saju["month_branch"]; mp=saju["month_pillar"]

    # 천간지지 상세
    ganji=[]
    for k,st,br in [("연주",stems[0],branches[0]),("월주",stems[1],branches[1]),
                    ("일주",stems[2],branches[2]),("시주",stems[3],branches[3])]:
        hs=BRANCH_HIDDEN_STEMS.get(br,[])
        ganji.append({"주":k,"간지":st+br,"천간":st,"지지":br,
                      "천간음양":YINYANG_STEM[st],"지지음양":YINYANG_BRANCH[br],
                      "천간오행":STEM_ELEMENT[st],"지지오행":BRANCH_ELEMENT_MAIN[br],
                      "지장간":hs,"지장간오행":[STEM_ELEMENT[x] for x in hs],
                      "납음":nayin(st+br),"12운성":twelve_unseong(ds,br),
                      "지지십성":branch_main_tg(ds,br)})

    # 십성
    ten_gods={"연간":ten_god(ds,stems[0]),"월간":ten_god(ds,stems[1]),"시간":ten_god(ds,stems[3])}
    hidden_tg={}
    for lbl,br in [("연지",branches[0]),("월지",branches[1]),("일지",branches[2]),("시지",branches[3])]:
        hidden_tg[lbl]=[{"간":h,"십성":ten_god(ds,h)} for h in BRANCH_HIDDEN_STEMS.get(br,[])]

    # 오행 불균형
    ohang=ohang_imbalance(stems,branches)

    # [Q3] 사주 관계 (확장)
    rels=calc_relations(stems,branches)

    # PatternScore
    pscr=pattern_score(rels["쌍별관계"])

    # 신살 (Q1 확장)
    shinsal=build_shinsal_detail(stems,branches,pillars)
    hit_names=[h["name"] for h in shinsal["발현_신살"]]

    # 신강/신약
    sc,vd=strength_score(ds,mb,stems,branches)

    # 격국/용신 (Q2 개선)
    geok=classify_geokguk(ds,mb)
    yong=determine_yongshin(geok["격국"],vd,ds)

    # DomainScore
    all_tg={**ten_gods,**{f"{k}_{v['간']}":v["십성"] for k,vs in hidden_tg.items() for v in vs}}
    dscore=domain_score(geok["격국"],hit_names,all_tg,vd)

    # 대운/세운/월운
    # 대운/세운/월운
    fwd = is_fwd(inp.gender, ys)
    dw_m = dw_start(bkst, fwd)
    now = datetime.now(tz=KST)
    return {
        "입력":{"달력":inp.calendar,"년":inp.year,"월":inp.month,"일":inp.day,"시":inp.hour,"분":inp.minute,
                "성별":inp.gender,"음력→양력":sol_m},
        "원국":pillars,
        "천간지지_상세":ganji,
        "오행분포":ohang,
        "십성(천간)":ten_gods,
        "지장간_십성":hidden_tg,
        "사주관계":rels,               # [Q3] dict 구조 변경
        "패턴점수":pscr,
        "신살길성":shinsal,
        "신강신약":{"점수":sc,"판정":vd},
        "격국":geok,
        "용신":yong,                   # [Q2] 오행 포함
        "DomainScore":dscore,
        "대운": {
            "방향": "순행" if fwd else "역행",
            "시작나이": dw_m["start_age"],           # 정수 반올림 (전통)
            "시작나이_정밀": dw_m["start_age_precise"],  # 소수1자리 (정밀)
            "블록": build_daewoon(mp, fwd, dw_m["start_age"]),
            "메타": dw_m,  # jeol_date, days_to_jeol 등 포함
        },
        "세운": build_sewoon(now, 20),
        "월운": build_wolwoon(now),
    }

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


# ══════════════════════════════════════════════
# SECTION 18 : 보조지표 산출 함수 (v3.2)
# ══════════════════════════════════════════════

from typing import Dict, Any, List, Tuple, Optional

# (옵션) _TG_DOM이 아직 없으면 빈 dict로 방어
try:
    _TG_DOM
except NameError:
    _TG_DOM: Dict[str, Dict[str, float]] = {}

# ── 12운성 점수 ────────────────────────────────
_UNSEONG_SCORE = {
    "長生": 10, "沐浴": 2, "冠帶": 8, "臨官": 10, "帝旺": 12,
    "衰": -2, "病": -6, "死": -10, "墓": -8, "絶": -12, "胎": 0, "養": 4,
}

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
}

# ── 관계 가중치 ────────────────────────────────
_REL_WEIGHT = {
    "합": 0.9, "반합": 0.5,
    "충": -1.5, "파": -1.2, "형": -1.0, "해": -0.7, "극": -0.6,
}

# ── 이벤트 확률 매핑 (신살/십성/운성 → 이벤트 카테고리) ──
_EVENT_TRIGGERS = {
    "이직_전환": {
        "shinsal": {"역마(驛馬)": 25, "겁살(劫殺)": 10, "양인(羊刃)": 8},
        "relation": {"충": 20, "형": 10, "파": 12},
        "unseong": {"絶": 15, "墓": 10, "死": 8},
        "tengo": {"七殺": 12, "傷官": 10, "劫財": 8},
    },
    "연애_결혼": {
        "shinsal": {"도화(桃花)": 25, "홍란(紅鸞)": 20, "천희(天喜)": 15, "함지살(咸池)": 10},
        "relation": {"합": 15},
        "unseong": {"沐浴": 12, "長生": 8},
        "tengo": {"正財": 12, "偏財": 10, "正官": 8},
    },
    "건강_주의": {
        "shinsal": {"백호살(白虎)": 25, "귀문관살(鬼門關)": 15},
        "relation": {"충": 12, "형": 10},
        "unseong": {"病": 20, "死": 18, "墓": 12, "絶": 10},
        "tengo": {"七殺": 8},
    },
    "재물_기회": {
        "shinsal": {"록신(祿神)": 15, "천을귀인(天乙)": 10, "금여": 8},
        "relation": {"합": 12, "반합": 8},
        "unseong": {"臨官": 12, "帝旺": 15, "長生": 8, "冠帶": 8},
        "tengo": {"正財": 18, "偏財": 15, "食神": 10},
    },
    "학업_시험": {
        "shinsal": {"문창귀인(文昌)": 20, "학당귀인(學堂)": 15, "문곡귀인": 12, "사관귀인(詞館)": 10},
        "relation": {"합": 8},
        "unseong": {"冠帶": 10, "臨官": 8, "長生": 8},
        "tengo": {"正印": 15, "偏印": 12},
    },
    "대인_갈등": {
        "shinsal": {"원진살(怨嗔)": 20, "귀문관살(鬼門關)": 15, "고진(孤辰)": 12, "과숙(寡宿)": 10},
        "relation": {"충": 15, "형": 12, "해": 10, "극": 8},
        "unseong": {"衰": 8},
        "tengo": {"七殺": 10, "劫財": 10, "傷官": 8},
    },
}

# ── 용신/희신/기신 부합 판정 ───────────────────
def _check_yongshin_fit(stem: str, branch: str, yong_info: Dict[str, Any], day_stem: str) -> Dict[str, bool]:
    se = STEM_ELEMENT[stem]
    be = BRANCH_ELEMENT_MAIN[branch]

    main_hs = branch_main_hs(branch)
    elements = {se, be}
    if main_hs:
        elements.add(STEM_ELEMENT[main_hs])

    yong_e = yong_info.get("용신_오행", "?")
    hee_es = yong_info.get("희신_오행", [])
    gi_es = yong_info.get("기신_오행", [])

    return {
        "용신부합": bool(yong_e in elements),
        "희신부합": bool(any(h in elements for h in hee_es)),
        "기신부합": bool(any(g in elements for g in gi_es)),
    }

# ── 외래 간지 vs 원국 관계 ─────────────────────
def _calc_incoming_relations(inc_stem: str, inc_branch: str, orig_stems: List[str], orig_branches: List[str]) -> List[Dict[str, Any]]:
    labels = ["연", "월", "일", "시"]
    rels: List[Dict[str, Any]] = []

    for i in range(4):
        os, ob = orig_stems[i], orig_branches[i]
        pairs: List[str] = []

        if (inc_stem, os) in STEM_COMBINE:
            pairs.append(f"천간합({inc_stem}{os})")
        if (inc_stem, os) in STEM_CLASH:
            pairs.append(f"천간충({inc_stem}↯{os})")
        if (inc_stem, os) in STEM_KE_PAIRS:
            pairs.append(f"천간극({inc_stem}克{os})")

        if (inc_branch, ob) in BRANCH_COMBINE:
            pairs.append(f"지지합({inc_branch}{ob})")
        if (inc_branch, ob) in BRANCH_CLASH:
            pairs.append(f"지지충({inc_branch}↯{ob})")
        if (inc_branch, ob) in BRANCH_HARM:
            pairs.append(f"지지해({inc_branch}↦{ob})")
        if (inc_branch, ob) in BRANCH_BREAK:
            pairs.append(f"지지파({inc_branch}×{ob})")
        if (inc_branch, ob) in BRANCH_PUNISH:
            pairs.append(f"지지형({inc_branch}刑{ob})")

        rh = BRANCH_SEMI_COMBINE.get((inc_branch, ob))
        if rh:
            pairs.append(f"반합({rh}:{inc_branch}{ob})")

        if pairs:
            rels.append({"with": f"{labels[i]}주({os}{ob})", "relations": pairs})

    return rels


def _calc_two_pillar_relations(s1: str, b1: str, s2: str, b2: str) -> List[str]:
    rels: List[str] = []
    if (s1, s2) in STEM_COMBINE:
        rels.append(f"천간합({s1}{s2})")
    if (s1, s2) in STEM_CLASH:
        rels.append(f"천간충({s1}↯{s2})")
    if (s1, s2) in STEM_KE_PAIRS:
        rels.append(f"천간극({s1}克{s2})")

    if (b1, b2) in BRANCH_COMBINE:
        rels.append(f"지지합({b1}{b2})")
    if (b1, b2) in BRANCH_CLASH:
        rels.append(f"지지충({b1}↯{b2})")
    if (b1, b2) in BRANCH_HARM:
        rels.append(f"지지해({b1}↦{b2})")
    if (b1, b2) in BRANCH_BREAK:
        rels.append(f"지지파({b1}×{b2})")
    if (b1, b2) in BRANCH_PUNISH:
        rels.append(f"지지형({b1}刑{b2})")

    rh = BRANCH_SEMI_COMBINE.get((b1, b2))
    if rh:
        rels.append(f"반합({rh}:{b1}{b2})")
    return rels

# ── 외래 지지 간이 신살 ────────────────────────
def _check_incoming_shinsal(inc_branch: str, day_stem: str, year_branch: str) -> Tuple[List[str], List[str]]:
    hits_gil: List[str] = []
    hits_hyung: List[str] = []
    ds = day_stem

    for base_br in [year_branch]:
        tri = get_trine(base_br)

        if PEACH_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("도화(桃花)")
        if HORSE_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("역마(驛馬)")
        if GENERAL_STAR_BY_TRINE.get(tri) == inc_branch:
            hits_gil.append("장성(將星)")

        # 확장: 화개/겁살/망신 (사용자가 추가한 룰)
        if FLORAL_CANOPY_BY_TRINE.get(tri) == inc_branch:
            hits_gil.append("화개(華蓋)")
        if JIESHA_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("겁살(劫殺)")
        if WANGSHEN_BY_TRINE.get(tri) == inc_branch:
            hits_hyung.append("망신(亡神)")

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

    if inc_branch in TAIJI.get(ds, []):
        hits_gil.append("태극귀인(太極)")
    if inc_branch == GUOYIN.get(ds):
        hits_gil.append("국인귀인(國印)")
    if inc_branch == FUXING.get(ds):
        hits_gil.append("복성귀인(福星)")

    # CSV 기반 확장 룰: _SHINSAL_DAY_STEM / _SHINSAL_KIND 가 프로젝트에 존재한다고 가정
    for sname in ("금여", "암록", "협록", "천관귀인", "문곡귀인", "복덕살", "천후귀인", "천하귀인"):
        tgts = _SHINSAL_DAY_STEM.get(sname, {}).get(ds, [])
        if inc_branch in tgts:
            kind = _SHINSAL_KIND.get(sname, "길신")
            (hits_gil if kind == "길신" else hits_hyung).append(sname)

    return hits_gil, hits_hyung

# ── 용신력 ─────────────────────────────────────
def _calc_yongshin_power(dw_fit: Dict[str, bool], sw_fit: Optional[Dict[str, bool]] = None) -> float:
    p = 0.0
    if dw_fit.get("용신부합"):
        p += 0.3
    if dw_fit.get("희신부합"):
        p += 0.15
    if dw_fit.get("기신부합"):
        p -= 0.25

    if sw_fit:
        if sw_fit.get("용신부합"):
            p += 0.3
        if sw_fit.get("희신부합"):
            p += 0.15
        if sw_fit.get("기신부합"):
            p -= 0.25

    return max(-1.0, min(1.0, round(p, 2)))

# ── 에너지장 (충격지수 대체) ───────────────────
def _extract_rel_keys(rels_list: Any) -> Tuple[float, float, List[str]]:
    """관계 목록에서 키워드 추출 → (positive_sum, negative_sum, all_keys)"""
    pos, neg = 0.0, 0.0
    keys: List[str] = []

    items: List[str] = []
    for r in (rels_list or []):
        if isinstance(r, dict):
            items.extend(r.get("relations", []) or [])
        elif isinstance(r, str):
            items.append(r)
        elif isinstance(r, list):
            items.extend([str(x) for x in r])
        else:
            items.append(str(r))

    for r_str in items:
        for k, w in _REL_WEIGHT.items():
            if k in r_str:
                keys.append(k)
                if w > 0:
                    pos += abs(w)
                else:
                    neg += abs(w)
                break

    return round(pos, 2), round(neg, 2), keys


def _calc_energy_field(rels_orig: Any, rels_dw: Optional[Any] = None) -> Dict[str, Any]:
    p1, n1, k1 = _extract_rel_keys(rels_orig)
    p2, n2, k2 = (0.0, 0.0, [])
    if rels_dw is not None:
        p2, n2, k2 = _extract_rel_keys(rels_dw)

    return {
        "total": round(p1 + n1 + p2 + n2, 2),
        "positive": round(p1 + p2, 2),
        "negative": round(n1 + n2, 2),
        "direction": round((p1 + p2) - (n1 + n2), 2),
        "keys": k1 + k2,
    }

# ── 귀인력 ─────────────────────────────────────
def _calc_noble_power(gil_list: List[str], hyung_list: List[str]) -> int:
    sc = 0

    for name in gil_list:
        matched = False
        for k, w in _SHINSAL_WEIGHT.items():
            if (k in name) or (name in k):
                sc += int(w)
                matched = True
                break
        if not matched:
            sc += 2

    for name in hyung_list:
        matched = False
        for k, w in _SHINSAL_WEIGHT.items():
            if (k in name) or (name in k):
                sc += int(w)  # 흉살은 가중치가 음수로 들어있음
                matched = True
                break
        if not matched:
            sc -= 2

    return sc

# ── 오행균형도 ─────────────────────────────────
def _ohang_balance(stems_list: List[str], branches_list: List[str]) -> float:
    cnt = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}

    for s in stems_list:
        if s in STEM_ELEMENT:
            cnt[STEM_ELEMENT[s]] += 1

    for b in branches_list:
        if b in BRANCH_ELEMENT_MAIN:
            cnt[BRANCH_ELEMENT_MAIN[b]] += 1

    vals = list(cnt.values())
    total = sum(vals)
    if total == 0:
        return 0.5

    avg = total / 5.0
    var = sum((v - avg) ** 2 for v in vals) / 5.0

    # 정규화 상한(보수적): total^2/5
    max_var = max((total ** 2) / 5.0, 1.0)
    return round(max(0.0, min(1.0, 1.0 - var / max_var)), 2)

# ── 십성 파워밸런스 ────────────────────────────
_TENGO_CATEGORY = {
    "比肩": "비겁", "劫財": "비겁", "食神": "식상", "傷官": "식상",
    "偏財": "재성", "正財": "재성", "七殺": "관살", "正官": "관살",
    "偏印": "인성", "正印": "인성",
}

def _calc_tengo_balance(day_stem: str, extra_stems: List[str], extra_branches: List[str]) -> Dict[str, int]:
    bal = {"비겁": 0, "식상": 0, "재성": 0, "관살": 0, "인성": 0}

    for s in extra_stems:
        if s in STEM_ELEMENT:
            tg = ten_god(day_stem, s)
            cat = _TENGO_CATEGORY.get(tg)
            if cat:
                bal[cat] += 1

    for b in extra_branches:
        mh = branch_main_hs(b)
        if mh:
            tg = ten_god(day_stem, mh)
            cat = _TENGO_CATEGORY.get(tg)
            if cat:
                bal[cat] += 1

    return bal

# ── 인생 시즌 태그 ─────────────────────────────
def _calc_season_tag(yong_power: float, energy_total: float, energy_direction: float) -> Dict[str, str]:
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

# ── 이벤트 확률 ────────────────────────────────
def _calc_event_probabilities(
    shinsal_all: List[str],
    rel_keys: List[str],
    unseong: str,
    tengo_list: List[str]
) -> Dict[str, int]:
    result: Dict[str, int] = {}

    for evt, triggers in _EVENT_TRIGGERS.items():
        prob = 5  # base 5%

        for name in shinsal_all:
            for k, v in triggers.get("shinsal", {}).items():
                if (k in name) or (name in k):
                    prob += v
                    break

        for k in rel_keys:
            prob += triggers.get("relation", {}).get(k, 0)

        prob += triggers.get("unseong", {}).get(unseong, 0)

        for tg in tengo_list:
            prob += triggers.get("tengo", {}).get(tg, 0)

        result[evt] = int(min(95, max(5, prob)))

    return result

# ── 종합운점수 ─────────────────────────────────
def _composite_score(
    base: float,
    yfit: Dict[str, bool],
    unseong: str,
    noble_power: int,
    energy: Dict[str, Any],
    balance: Optional[float] = None
) -> int:
    sc = float(base)

    if yfit.get("용신부합"):
        sc += 15
    if yfit.get("희신부합"):
        sc += 8
    if yfit.get("기신부합"):
        sc -= 12

    sc += _UNSEONG_SCORE.get(unseong, 0)
    sc += noble_power * 0.8
    sc += float(energy.get("direction", 0)) * 2

    if balance is not None:
        sc += (balance - 0.5) * 6

    return max(0, min(100, round(sc)))

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


# ══════════════════════════════════════════════
# SECTION 19 : 대운 상세 빌드
# ══════════════════════════════════════════════

def build_daewoon_detail(r: Dict[str, Any]) -> List[Dict[str, Any]]:
    ds = r["원국"]["day"][0]
    yb = r["원국"]["year"][1]
    yong = r["용신"]

    o_stems = [r["원국"][k][0] for k in ("year", "month", "day", "hour")]
    o_branches = [r["원국"][k][1] for k in ("year", "month", "day", "hour")]

    birth_year = r["입력"]["년"]
    sol = r["입력"].get("음력→양력")
    if sol and sol.get("solar_year"):
        birth_year = sol["solar_year"]

    blocks = r["대운"]["블록"]
    result: List[Dict[str, Any]] = []

    for blk in blocks:
        gz = blk["ganzhi"]
        stem, branch = gz[0], gz[1]
        sa, ea = blk["start_age"], blk["end_age"]
        sy, ey = birth_year + int(sa), birth_year + int(ea)

        tg_stem = ten_god(ds, stem)
        tg_branch = branch_main_tg(ds, branch)
        unseong = twelve_unseong(ds, branch)
        ny = nayin(gz)

        yfit = _check_yongshin_fit(stem, branch, yong, ds)

        oh = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}
        oh[STEM_ELEMENT[stem]] += 1
        oh[BRANCH_ELEMENT_MAIN[branch]] += 1

        rels_orig = _calc_incoming_relations(stem, branch, o_stems, o_branches)
        gil, hyung = _check_incoming_shinsal(branch, ds, yb)

        ypower = _calc_yongshin_power(yfit)
        energy = _calc_energy_field(rels_orig)
        noble = _calc_noble_power(gil, hyung)
        balance = _ohang_balance(o_stems + [stem], o_branches + [branch])
        tengo_bal = _calc_tengo_balance(ds, [stem], [branch])

        composite = _composite_score(50, yfit, unseong, noble, energy, balance=balance)

        season = _calc_season_tag(ypower, energy["total"], energy["direction"])
        all_shinsal = gil + hyung
        _, _, rel_keys = _extract_rel_keys(rels_orig)
        events = _calc_event_probabilities(all_shinsal, rel_keys, unseong, [tg_stem, tg_branch])

        base_dom = r["DomainScore"]["점수"].copy()
        dom: Dict[str, float] = {}
        for d in ("직업", "재물", "건강", "연애", "결혼"):
            adj = 0.0
            if yfit["용신부합"]:
                adj += 0.8
            if yfit["희신부합"]:
                adj += 0.4
            if yfit["기신부합"]:
                adj -= 0.6
            for tg in (tg_stem, tg_branch):
                adj += _TG_DOM.get(tg, {}).get(d, 0.0)
            adj += _UNSEONG_SCORE.get(unseong, 0) * 0.05
            dom[d] = max(0.0, min(10.0, round(base_dom[d] + adj, 1)))

        result.append({
            "order": blk["index"],
            "daewoon_pillar": gz,
            "stem": stem,
            "branch": branch,
            "stemElement": STEM_ELEMENT[stem],
            "branchElement": BRANCH_ELEMENT_MAIN[branch],
            "start_age_years": sa,
            "end_age_years": ea,
            "start_year": sy,
            "end_year": ey,
            "십성_천간": tg_stem,
            "십성_지지": tg_branch,
            "12운성": unseong,
            "납음": ny,
            "용신부합": yfit["용신부합"],
            "희신부합": yfit["희신부합"],
            "기신부합": yfit["기신부합"],
            "오행변화": oh,
            "관계_with_원국": rels_orig,
            "신살_길신": gil,
            "신살_흉살": hyung,
            "indicators": {
                "용신력": ypower,
                "에너지장": energy,
                "귀인력": noble,
                "오행균형도": balance,
                "12운성점수": _UNSEONG_SCORE.get(unseong, 0),
            },
            "십성밸런스": tengo_bal,
            "domainScore": dom,
            "종합운점수": composite,
            "등급": _score_grade(composite),
            "시즌태그": season,
            "이벤트확률": events,
        })

    return result


# ══════════════════════════════════════════════
# SECTION 20 : 연도별 타임라인 빌드
# ══════════════════════════════════════════════

def _sewoon_gz(year: int) -> str:
    idx = (ganzhi_index("甲子") + (year - 1984)) % 60
    return GANZHI_60[idx]


def build_yearly_timeline(r: Dict[str, Any], dw_detail: List[Dict[str, Any]], span: int = 86) -> List[Dict[str, Any]]:
    ds = r["원국"]["day"][0]
    yb = r["원국"]["year"][1]
    yong = r["용신"]

    o_stems = [r["원국"][k][0] for k in ("year", "month", "day", "hour")]
    o_branches = [r["원국"][k][1] for k in ("year", "month", "day", "hour")]

    birth_year = r["입력"]["년"]
    sol = r["입력"].get("음력→양력")
    if sol and sol.get("solar_year"):
        birth_year = sol["solar_year"]

    dw_map: Dict[int, Dict[str, Any]] = {}
    for dw in dw_detail:
        for y in range(dw["start_year"], dw["end_year"]):
            dw_map[y] = dw

    timeline: List[Dict[str, Any]] = []

    for yi in range(span):
        year = birth_year + yi

        dw = dw_map.get(year)
        if not dw:
            if dw_detail:
                dw = dw_detail[0] if year < dw_detail[0]["start_year"] else dw_detail[-1]
            else:
                continue

        sw_gz = _sewoon_gz(year)
        sw_s, sw_b = sw_gz[0], sw_gz[1]

        sw_tg_s = ten_god(ds, sw_s)
        sw_tg_b = branch_main_tg(ds, sw_b)
        sw_unseong = twelve_unseong(ds, sw_b)
        sw_yfit = _check_yongshin_fit(sw_s, sw_b, yong, ds)

        sw_rels_orig = _calc_incoming_relations(sw_s, sw_b, o_stems, o_branches)
        sw_rels_dw = _calc_two_pillar_relations(sw_s, sw_b, dw["stem"], dw["branch"])
        sw_gil, sw_hyung = _check_incoming_shinsal(sw_b, ds, yb)

        # ── 보조지표 ────────────────────────
        dw_yfit = {
            "용신부합": dw["용신부합"],
            "희신부합": dw["희신부합"],
            "기신부합": dw["기신부합"],
        }
        ypower = _calc_yongshin_power(dw_yfit, sw_yfit)

        energy = _calc_energy_field(sw_rels_orig, sw_rels_dw)

        all_gil = dw["신살_길신"] + sw_gil
        all_hyung = dw["신살_흉살"] + sw_hyung
        noble = _calc_noble_power(all_gil, all_hyung)

        balance = _ohang_balance(o_stems + [dw["stem"], sw_s], o_branches + [dw["branch"], sw_b])
        unseong_12 = _UNSEONG_SCORE.get(sw_unseong, 0)
        tengo_bal = _calc_tengo_balance(ds, [dw["stem"], sw_s], [dw["branch"], sw_b])

        # ── 종합 점수 ───────────────────────
        dw_trend = dw["종합운점수"]
        sc = float(dw_trend)

        if sw_yfit["용신부합"]:
            sc += 10
        if sw_yfit["희신부합"]:
            sc += 5
        if sw_yfit["기신부합"]:
            sc -= 8

        sc += unseong_12 * 0.5
        sc += _calc_noble_power(sw_gil, sw_hyung) * 0.5
        sc += energy["direction"] * 1.5
        sc += (balance - 0.5) * 6

        score = max(0, min(100, round(sc)))

        # ── 캔들 OHLC ───────────────────────
        candle_open = int(dw_trend)
        candle_close = int(score)

        candle_high = score + len(sw_gil) * 3 + max(ypower, 0) * 8
        candle_low = score - len(sw_hyung) * 3 - abs(min(energy["direction"], 0)) * 4

        candle_high = int(min(100, round(candle_high)))
        candle_low = int(max(0, round(candle_low)))

        # ── 시즌 태그 ───────────────────────
        season = _calc_season_tag(ypower, energy["total"], energy["direction"])

        # ── 이벤트 확률 ──────────────────────
        _, _, rel_keys_o = _extract_rel_keys(sw_rels_orig)
        _, _, rel_keys_dw = _extract_rel_keys(sw_rels_dw)
        events = _calc_event_probabilities(
            all_gil + all_hyung,
            rel_keys_o + rel_keys_dw,
            sw_unseong,
            [sw_tg_s, sw_tg_b, dw["십성_천간"], dw["십성_지지"]],
        )

        # ── 도메인 점수 ──────────────────────
        dom: Dict[str, float] = {}
        for d in ("직업", "재물", "건강", "연애", "결혼"):
            base = dw["domainScore"].get(d, 5.0)
            adj = 0.0
            if sw_yfit["용신부합"]:
                adj += 0.5
            if sw_yfit["희신부합"]:
                adj += 0.3
            if sw_yfit["기신부합"]:
                adj -= 0.4
            for tg in (sw_tg_s, sw_tg_b):
                adj += _TG_DOM.get(tg, {}).get(d, 0.0)
            dom[d] = max(0.0, min(10.0, round(base + adj, 1)))

        timeline.append({
            "year": year,
            "age": yi,
            "대운_pillar": dw["daewoon_pillar"],
            "세운_pillar": sw_gz,
            "세운_stem": sw_s,
            "세운_branch": sw_b,
            "세운_stemElement": STEM_ELEMENT[sw_s],
            "세운_branchElement": BRANCH_ELEMENT_MAIN[sw_b],
            "세운_십성_천간": sw_tg_s,
            "세운_십성_지지": sw_tg_b,
            "세운_12운성": sw_unseong,
            "세운_용신부합": sw_yfit["용신부합"],
            "세운_희신부합": sw_yfit["희신부합"],
            "세운_기신부합": sw_yfit["기신부합"],
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
# SECTION 21 : 차트 페이로드 + 통합 진입점
# ══════════════════════════════════════════════

def build_chart_payload(r: Dict[str, Any]) -> Dict[str, Any]:
    ds = r["원국"]["day"][0]
    yong = r["용신"]

    dw_detail = build_daewoon_detail(r)
    timeline = build_yearly_timeline(r, dw_detail, span=86)

    return {
        "meta": {
            "birthYear": r["입력"]["년"],
            "gender": r["입력"]["성별"],
            "dayStem": ds,
            "dayElement": STEM_ELEMENT[ds],
            "strength": r["신강신약"]["판정"],
            "geokguk": r["격국"]["격국"],
            "yongshin": {"label": yong.get("용신", ""), "element": yong.get("용신_오행", "")},
            "heeshin": [
                {"label": h, "element": e}
                for h, e in zip(yong.get("희신", []), yong.get("희신_오행", []))
            ],
            "gishin": [
                {"label": g, "element": e}
                for g, e in zip(yong.get("기신", []), yong.get("기신_오행", []))
            ],
        },
        "원국_baseline": {
            "오행분포": r["오행분포"]["분포"],
            "patternScore": r["패턴점수"]["총점"],
            "domainScore": r["DomainScore"]["점수"],
        },
        "대운기둥10": dw_detail,
        "연도별_타임라인": timeline,
        "보조지표_범례": {
            "용신력":     {"desc": "대운+세운이 용신/희신 오행을 공급하는 정도", "range": [-1, 1], "analogy": "RSI"},
            "에너지장":   {"desc": "합·충·형·파·해·극의 절대 에너지 총량", "range": [0, 10], "analogy": "거래대금"},
            "귀인력":     {"desc": "길신/흉살 가중합산 (양수=귀인 도움, 음수=자력 극복)", "range": [-20, 20], "analogy": "기관수급"},
            "12운성곡선": {"desc": "세운 12운성 점수 (生→旺→死→絶 사이클)", "range": [-12, 12], "analogy": "이동평균선"},
            "오행균형도": {"desc": "원국+대운+세운 합산 오행 균형 (1=완전균형)", "range": [0, 1], "analogy": "MACD"},
            "십성밸런스": {"desc": "비겁/식상/재성/관살/인성 5축 에너지 분포", "range": "radar", "analogy": "섹터로테이션"},
            "시즌태그":   {"desc": "확장기/안정기/전환기/인내기/격변기/평온기", "range": "category", "analogy": "시장국면"},
            "이벤트확률": {"desc": "이직·연애·건강·재물·학업·갈등 발생 확률(%)", "range": [5, 95], "analogy": "종목리포트"},
        },
    }


def compute_all(inp: "BirthInput") -> Dict[str, Any]:
    r = enrich_saju(inp)
    r["chart_data"] = build_chart_payload(r)
    return r


if __name__ == "__main__":
    import sys

    inp = BirthInput(
        year=1993, month=3, day=15, hour=9, minute=30,
        calendar="solar", gender="male"
    )

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

    r = compute_all(inp)
    print(saju_to_json(r["chart_data"]))
