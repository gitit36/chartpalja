# G Fresh Validation Spec

**Purpose:** Define a genuinely unseen validation corpus for cleaned G architectures.  
**Status:** Protocol + eligibility only. **Do not score models on fresh subjects until labels are frozen.**

## Contamination / eligibility

### Absolute exclusion

Every name that appears **anywhere** in `test/yongshin_subjects.json` is **DEVELOPMENT / CONTAMINATED** and is **ineligible** for fresh validation — regardless of:

```text
validation_tier
include_in_strict_validation
source_quality
prior train / holdout / soft_exclude labels
whether the person was ever scored
candidate / strict_candidate / unused status
```

### Programmatic check (mandatory before adding a subject)

```bash
python -c "
import json, unicodedata, re
raw = json.load(open('test/yongshin_subjects.json'))
blocked = {s['name'].strip() for s in raw if s.get('name')}
# also block NFC/NFKC and casefold forms
def norm(s):
    return unicodedata.normalize('NFKC', s).casefold().strip()
blocked_n = {norm(n) for n in blocked}
cand = 'NEW_NAME_HERE'
assert cand.strip() not in blocked
assert norm(cand) not in blocked_n
print('OK eligible:', cand)
"
```

Also reject obvious aliases / alternate spellings of blocked names (e.g. “Bieber” ↔ “Justin Bieber”, “윤 석열” ↔ “윤석열”).

### Snapshot of blocked names (n=58, as of 2026-08-12)

```text
Al Gore, Amy Klobuchar, Barack Obama, Björk, Chris Brown, Dennis Rodman,
Diana Ross, Donald Trump, Drake, Elizabeth Taylor, Hillary Clinton,
John Ritter, Justin Bieber, Kamala Harris, Kylie Jenner, Lionel Messi,
Madonna, Michael Jackson, Monica Lewinsky, Ron Howard, Sean Penn,
강호동, 권지용, 김부겸, 김어준, 김연아, 김영삼, 김우중, 김희민, 남진,
노무현, 노태우, 문재인, 박근혜, 박나래, 박세리, 박정희, 박찬호, 본인,
봉준호, 서태지, 손흥민, 신성일, 신해철, 오세훈, 윤석열, 이건희,
이명박, 이병철, 이재용, 장미희, 전두환, 전소연, 정몽구, 정몽헌,
정주영, 조용필, 홍준표
```

Re-run the exclusion script when the JSON grows — the live file is the source of truth.

---

## Target corpus size

```text
≥ 25–30 NEW subjects (names absent from yongshin_subjects.json)
```

Prefer diversity across:

| Dimension | Examples |
|-----------|----------|
| Career type | politics, sport, entertainment, business, science, arts |
| Gender | balanced |
| Birth era | 1940s–2000s |
| Culture / country | KR / US / EU / other — avoid only repeating the existing KR-politics + US-celeb mix |
| Event types | career, health, relationship/family, financial/legal/reputation |
| Outcome mix | clear success years and clear failure years |

Birth data: prefer known birth time + documented source quality.

---

## Label schema (freeze before any G scoring)

For each subject, declare **before** viewing B9/G outputs:

```text
name
birth: {y, m, d, h, min, calendar, leap?}
birth_data_source_quality: A_birth_record | B_biography | C_uncertain | …
gender
time_quality: known | unknown | approximate

good: [{year, month?, day?, label, weight, confidence, axis?, source, ambiguity?}]
bad:  [{year, month?, day?, label, weight, confidence, axis?, source, ambiguity?}]

exclude_from_validation: bool   # per event or subject if needed
```

### Predeclared mixed-year rule

If a calendar year contains both a major positive and major negative event:

```text
DEFAULT: mark the year ambiguity_flag=true and exclude_from_validation=true
         unless one event clearly dominates by pre-written severity notes.
FORBIDDEN: deciding after seeing model scores.
```

### Ambiguity

Ambiguous years must be flagged **before** scoring. Do not silently relabel because the model disagrees.

---

## Protocol (enforced)

1. **Freeze** subject list + life-event labels before viewing candidate G scores.  
2. No `yongshin_subjects.json` name may enter fresh validation.  
3. No model rule/threshold/pattern/coeff/axis/feature may be added because of a fresh-validation failure **and** still count that subject as unseen.  
4. If a fresh failure inspires a model change: move that subject to DEVELOPMENT; freeze the new model; evaluate on another still-unseen slice.  
5. Never silently relabel good/bad because the model disagrees.  
6. Ambiguous years flagged before scoring.  
7. Mixed years follow the predeclared rule above.  
8. Final metrics only after architecture + coefficients + labels are frozen.  
9. Existing JSON performance = DEVELOPMENT only.  
10. Fresh results reported **separately** — never pooled with development to inflate headline accuracy.

### Anti-patch rule

Do **not** add any rule because it fixes Messi, Brown, Hillary, Bieber, Gore, Jackson, or any other blocked name. Ablation effects on those subjects are reportable diagnostics only.

---

## Split design

### Preferred (≥30 new subjects)

```text
Fresh Validation A  (~15)  — one-shot after G candidate freeze
Fresh Validation B  (~15)  — final untouched confirmation
```

- Use A only after the cleaned G architecture is frozen.  
- If A causes a model change, A becomes development evidence; **B remains untouched**.  
- Do not repeatedly iterate against B.

### Minimum (25–30 subjects)

```text
Hold out a Final Confirmation subset of ≥10 subjects
never scored during architecture selection.
Remaining new subjects = Validation A (one-shot).
```

Document membership in the freeze commit / file before any scoring.

---

## Metrics (fresh set, when scored later)

Predictive (within B9-A hierarchy, frozen α/D):

```text
hit rate, pairwise, AUC macro/micro, raw/std separation,
per-subject separation, worst subjects
```

Structural:

```text
G dist, A_y within-block SD, effective influence, correlations,
pattern activation, saturation
```

Report flips vs `G_REF` with subject/year maps.

**Primary property:** within-daewoon-block ranking of better/worse years — not absolute G calibration.

---

## Collection workflow (no scoring)

1. Propose candidate name → run exclusion script.  
2. Attach birth data + sources.  
3. Attach good/bad years with sources **blind to model**.  
4. Peer / self checklist: mixed-year rule, ambiguity flags.  
5. Append to a new file (suggested): `test/experiments/g_fresh_subjects.json` (not `yongshin_subjects.json`).  
6. Freeze file hash / commit message: `G_FRESH_LABELS_FROZEN`.  
7. Only then allow scoring scripts to read the fresh file.

### Suggested empty scaffold

```json
{
  "spec": "G_FRESH_VALIDATION_SPEC.md",
  "status": "collecting",
  "labels_frozen": false,
  "split": {"validation_a": [], "validation_b": []},
  "subjects": []
}
```

---

## What this phase does NOT do

- Does not invent 25–30 labeled celebrities in this commit without real sources.  
- Does not run G/B9 on fresh names yet.  
- Does not move contaminated names into “fresh” by renaming tiers.

## Confirmation checklist for any proposed fresh subject

- [ ] Name absent from `yongshin_subjects.json` (script OK)  
- [ ] Not an alias of a blocked name  
- [ ] Birth data + source recorded  
- [ ] Good/bad years recorded with sources before scoring  
- [ ] Mixed/ambiguous years handled by predeclared rules  
- [ ] Assigned to Validation A or B before scoring begins  
