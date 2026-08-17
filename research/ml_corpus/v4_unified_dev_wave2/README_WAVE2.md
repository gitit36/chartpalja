# SAJU ML V4 - Unified DEV Wave 2 roster freeze

## Purpose
Freeze a completely fresh Wave 2 roster after Wave 1 froze 73 usable pairs.

Wave 1:
- COMPETITIVE 28 / 30
- PROJECT 19 / 25
- STATUS 26 / 45
- total usable pairs 73
- positive-earlier share 49.315%
- same-year pairs 0

Predeclared Wave 2 roster target:
- COMPETITIVE 3
- PROJECT 8
- STATUS 33
- TOTAL 44

The 44 targets come only from Wave 1 pair deficits and observed axis pairability:
ceil(2/0.9333)=3, ceil(6/0.76)=8, ceil(19/0.5778)=33.

## Methodological rules
- Never replace any Wave 1 subject.
- Exclude all prior consumed/development subjects and all 100 Wave 1 subjects.
- Wave 2 uses a newly predeclared role-only seed universe; the Wave 1 base seed list is not reused for selection.
- Candidate-universe expansion may use broad public role/category, Rodden-AA availability, birth-year eligibility, prior-development exclusion, Wave-1 exclusion, and identity disambiguation only.
- Do not use event outcomes, event pairability, positive-earlier/later chronology, astrology features, or astrology scores.
- Once Wave 2 membership is frozen, do not replace subjects after event collection starts.
- Sealed holdouts remain undefined/unloaded.

## Place files

research/ml/
  09_saju_ml_v4_unified_dev_wave2_subject_roster_freeze.ipynb

research/ml_corpus/v4_unified_dev_wave2/
  V4_UNIFIED_DEV_WAVE2_PREDECLARED_SEED_UNIVERSE_R3.csv
  V4_UNIFIED_DEV_WAVE2_COLLECTION_CONTRACT.json

Existing Wave 1 files must remain:

research/ml/artifacts/v4_unified_dev_roster/
  V4_UNIFIED_DEV_SUBJECT_ROSTER_100.csv
  V4_UNIFIED_DEV_SUBJECT_ROSTER_FREEZE.json
  PersonList-15k.csv

research/ml/artifacts/v4_unified_dev_wave1/
  V4_UNIFIED_DEV_WAVE1_FREEZE_DECISION.json

## Run

Kernel Restart
-> Run All

Expected final status:

V4_UNIFIED_DEV_WAVE2_SUBJECT_UNIVERSE_FROZEN

Expected output directory:

research/ml/artifacts/v4_unified_dev_wave2_roster/

## Send back

- V4_UNIFIED_DEV_WAVE2_SUBJECT_ROSTER_44.csv
- V4_UNIFIED_DEV_WAVE2_SUBJECT_ROSTER_FREEZE.json
- V4_UNIFIED_DEV_WAVE2_SEED_RESOLUTION_AUDIT.csv

Do not start event collection before this roster freeze completes.
Do not generate astrology features after the roster freeze either; Wave 2 event/source collection and combined event-corpus QA come first.
