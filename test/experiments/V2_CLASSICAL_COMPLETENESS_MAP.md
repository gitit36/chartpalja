# V2 Classical Completeness Map (D/Y)

**Date:** 2026-08-13  
**Purpose:** Classify traditional concepts for selective scoring — not additive completeness theater.

Layers: **CORE** | **CONTEXTUAL** | **SECONDARY** | **OPTIONAL / SCHOOL-DEPENDENT** | **EXCLUDED FROM NUMERIC CORE**

---

## Map

| Concept | Class | Engine today | V2 D/Y use |
|---------|-------|--------------|------------|
| 月令 | CORE (context) | Folded into strength/ohang; not exported label | Efficacy context for luck elements |
| 日主强弱 | CONTEXTUAL | `신강신약` structured | Strength regime; not equal-balance |
| 格局 | CONTEXTUAL | `classify_geokguk` reliable | Structure complete/damage/rescue |
| 用神 | CORE (structural) | `determine_yongshin` | Activation/root/attack — not fixed + |
| 喜神 | CORE (structural) | nested | Same as 用 |
| 忌神 | CORE (structural) | nested | Same as 忌 — not fixed − |
| 相神 | CONTEXTUAL | **Missing** | Derive support dependency where possible; else interpret-only |
| 调候 | CONTEXTUAL | `조후용신` + climate | Separate need when reliable |
| 扶抑 | CONTEXTUAL | nested in yongshin | Via strength regime |
| 去病 | CONTEXTUAL | disease diagnose/resolve | Structural disease shift |
| 通关 | CONTEXTUAL | `_find_tonggwan` | Mediation when clear |
| 从格/化格 | CONTEXTUAL | Cong/Hwa branches | Separate branch; uncertain → small/0 |
| 五行旺衰 | CONTEXTUAL | Implicit | Excess/deficiency, not 20/20/20/20/20 |
| 得令 | CONTEXTUAL | Inside strength | Seasonal efficacy |
| 得地/通根 | CORE | Inside strength; weak export | effective_qi / rooting |
| 透干 | CORE | Inside strength | Exposure/activation |
| 藏干 | CORE | `BRANCH_JIJANGGAN` | Hidden activation |
| 十神 | CORE (contextual role) | Natal + luck fields | Role classifier; domain ≠ valence |
| 天干生克 | CORE | `STEM_KE` / relations | Direct + mediated |
| 天干五合 | CORE | `STEM_COMBINE` | Conditional 合化 |
| 地支六合 | CORE | `BRANCH_COMBINE` | Contextual |
| 地支三合 | CORE | `TRINE_SETS` | Regime / activation |
| 三会/方局 | CONTEXTUAL | `DIRECTION_SETS` (방합) | Treat as seasonal trio; 삼회 label absent |
| 半合 | CONTEXTUAL | `BRANCH_SEMI_COMBINE` | Weaker combination |
| 冲 | CORE | relations | Contextual clash roles |
| 刑 | CORE | relations | Contextual |
| 破 | CORE | relations | Contextual |
| 害 | CORE | relations | Contextual |
| 墓库 | SECONDARY | Weak (운성 묘 heuristics) | Not “open treasury = good” |
| 12运星 | SECONDARY | Reliable labels + scalar scores | Phase/vitality; small/interpretive |
| 空亡 | SECONDARY | Gongmang classify | Secondary efficacy damp |
| 神煞 | EXCLUDED FROM NUMERIC CORE | Rich natal + subset luck | Explanation / domain only |
| 宫位/pillar target | CORE | `_calc_incoming_relations` targets | Track year/month/day/hour; esp. 月支/日支 |
| 伏吟 | CONTEXTUAL | **Missing** | Detect same-pillar repetition |
| 反吟 | CONTEXTUAL | **Missing** | Detect opposing pillar if unambiguous |
| 岁运并临 | CONTEXTUAL | **Missing** | D=Y pillar / stem-branch echo |
| 纳音 | OPTIONAL | Present | Interpretation only |
| 胎元 | OPTIONAL | Missing | Omit |
| 命宫 | OPTIONAL | Missing | Omit |
| 小运 | OPTIONAL | Missing | Omit (Month/Day hierarchy covers product need) |

---

## Balance correction

**EXCLUDED:** “closer to 20/20/20/20/20 = better.”

Use: elemental_distribution · needed · excessive · deficient · seasonal usefulness · structural usefulness.

---

## Scoring vs interpretation

```
RAW OBSERVATION → CONTEXT CLASSIFICATION → NUMERIC CONTRIBUTION → EXPLANATION
```

Ambiguous 合化, ambiguous 12운성, 神煞, unresolved clash valence → interpretation / event-intensity only.
