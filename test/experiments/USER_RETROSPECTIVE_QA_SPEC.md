# User Retrospective QA Spec (blind)

**Purpose:** Future real-user perceived-accuracy study for Timing Engine V2.  
**Do not run automatically. Do not optimize the engine per respondent.**

---

## Protocol

1. Collect answers **before** showing any scores / chart.  
2. Generate chart with frozen engine (D/Y/M/Day when available).  
3. Compare privately; score with rubric below.  
4. Aggregate only — no named patches.

---

## Pre-chart survey

### Years (last 5–10)

1. Which **2 years** were especially good?  
2. Which **2 years** were especially difficult?

### Broad periods (Daewoon-relevant)

3. Which **3–5 year period** felt strongest / most supportive?  
4. Which **3–5 year period** felt hardest?  
5. Roughly when did life direction change materially (if any)?  
6. Was there a generally **good decade with one major bad year**? (Y/N + year)  
7. Was there a generally **difficult period with one unusually good year**? (Y/N + year)

### Optional

8. Any month in the last year unusually good/bad?

---

## Rubric

| Check | Pass |
|-------|------|
| Good years | ≥1 of 2 selected good years above subject median Y (or in top half of decade) |
| Bad years | ≥1 of 2 selected bad years below subject median Y |
| Strong period | Overlap ≥2 years with chart’s higher-D / higher mean-Y window |
| Hard period | Overlap ≥2 years with lower regime window |
| Cross-baseline story | If user reports good-in-bad or bad-in-good decade, chart shows ≥1 clear crossing |

**Product success (guidance):**

- Majority of users: ≥3/4 of year picks directionally consistent  
- Strong majority: “overall flow feels accurate” (subjective Likert)

---

## Anti-patterns

- Do not reveal scores before answers.  
- Do not retune weights on individual users.  
- Use for V2.1 / post-Val-B perception QA only.
