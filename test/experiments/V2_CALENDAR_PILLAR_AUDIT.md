# V2 Calendar / Pillar Audit

**Date:** 2026-08-13  
**Scope:** Read-only audit of production `saju_engine.py` + `sajupy`  
**Rule:** No production changes. Experiments keep production-compatible conventions unless an obvious bug is isolated.

---

## Summary

Natal year = **立春** (astronomical). Month = solar **節**. Daewoon direction/起運 = standard 陽男陰女 + 節差÷3.

Material D/Y caveats (not auto-fixed this phase):

| ID | Issue | Class | Blocks D/Y scoring? |
|----|-------|-------|---------------------|
| G | Chart yearly sewoon uses **Gregorian year**, not 立春 window | ENGINE_POLICY / POSSIBLE_BUG vs classical | No — labels & engine share same convention |
| H | `build_wolwoon` 子/丑 interval inversion | POSSIBLE_BUG | Month/Day only (later) |
| D | Lon-only solar (no EOT); 半時 on civil clock | SCHOOL_VARIANT / POSSIBLE_BUG | Hour-sensitive births only |
| C | `early_zi_time` defaults differ by API | ENGINE_POLICY | Hour/day edge cases |

**Foundation verdict for Phase 2.5:** usable for Daewoon/Sewoon development under existing engine convention. Not `V2_DY_ORTHODOX_FOUNDATION_ISSUE`.

---

## A. Natal year pillar

| Item | Detail |
|------|--------|
| Policy | Astronomical 立春 (sun lon 315°). Not lunar NY / Jan 1. |
| Code | `ipchun`, `_year_gz`, enrich override vs sajupy |
| Class | **STANDARD_CORE_MATCH** + **ENGINE_POLICY** (precision override) |

## B. Natal month pillar

| Item | Detail |
|------|--------|
| Policy | Solar 節 months; sajupy term_time on 節 day |
| Engine | Full `_term_deg` recompute only forced near 立春 year fix |
| Class | **STANDARD_CORE_MATCH** intent; **SCHOOL_VARIANT** where sajupy≠engine term time |

## C. Day pillar

| Item | Detail |
|------|--------|
| Policy | sajupy CSV sexagenary day; fixed UTC offset (default +9); no IANA DST |
| 子時 | `early_zi_time`: 조자시 keeps day; 야자시 rolls 23:xx → next day |
| Class | **SCHOOL_VARIANT** (조/야자시) + **ENGINE_POLICY** (fixed offset) |

## D. Hour pillar

| Item | Detail |
|------|--------|
| Solar | Longitude×4min only — **no Equation of Time** |
| Boundaries | Engine 半時 (+30m) override on **civil** clock |
| Class | Lon-only / 半時 = **SCHOOL_VARIANT**; civil vs solar mix = **POSSIBLE_BUG** |

## E. Daewoon direction

| Item | Detail |
|------|--------|
| Policy | 陽男陰女 순행 / 陰男陽女 역행 from year-stem yin-yang + gender |
| Code | `is_fwd` → `build_daewoon` from month pillar |
| Class | **STANDARD_CORE_MATCH** |

## F. Daewoon 起運

| Item | Detail |
|------|--------|
| Policy | 節差÷3 (節 only, not 中氣); precise age for blocks; `start_year = birth_year + floor(start_age)` |
| Class | **STANDARD_CORE_MATCH**; civil-KST 起運 if solar-time on = **POSSIBLE_BUG** / SCHOOL_VARIANT |

## G. Sewoon boundary

| Path | Boundary | Class |
|------|----------|-------|
| `build_sewoon` | 立春→立春 | STANDARD_CORE_MATCH |
| `build_yearly_timeline` / chart years | **Gregorian calendar year** | ENGINE_POLICY (conflict with classical) |

Phase 2.5 D/Y experiments use yearly timeline → **civil-year sewoon**. Document as known school/product policy, not open Val B / redesign.

## H. Future Month boundary

| Item | Detail |
|------|--------|
| Intent | 12 節 via `build_wolwoon` / `MONTH_BD` |
| Bug | 子 interval inverted; 丑 can span ~year — **POSSIBLE_BUG** |
| Contract | Fix/audit before Phase 3 Month scoring |

## I. Future Day boundary

| Item | Detail |
|------|--------|
| Policy | Civil `YYYY-MM-DD` sexagenary; no 子時 rollover for 일운 |
| Class | **ENGINE_POLICY**; inherits Month 子/丑 bug for upper context |

---

## School-dependent (not bugs)

1. 立春 year vs lunar New Year  
2. 節-only 起運 vs mixed 中氣 schools  
3. 半時 vs 整時 hour branches  
4. 早子時 vs 夜子時  
5. Longitude solar vs full EOT true solar  
6. Civil-year labeled sewoon vs 立春-year labeled sewoon  

---

## Experiment convention (frozen for this phase)

Use existing production-compatible packing (`enrich_saju` / daewoon detail / yearly timeline meta) identical to V2_DY_B reference runs.
