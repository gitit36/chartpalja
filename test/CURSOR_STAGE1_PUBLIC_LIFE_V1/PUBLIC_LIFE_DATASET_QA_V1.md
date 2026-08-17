# PUBLIC_LIFE_V1 dataset QA

Status: `PUBLIC_LIFE_V1_FROZEN_RND`

- Subjects: 40
- Scoring events: 160
- Positive / negative years: 80 / 80
- Same-year positive/negative collisions: 0
- Existing OLD_DEV / Fresh A / Validation B overlap: 0
- Birth-time provenance: Rodden AA via retained VedAstro source rows
- DEV / CHECK / FINAL: 24 / 8 / 8
- Split seed: 20260815
- Full dataset SHA256: `fa975419d8299cb38a8d9cac2c04e418dd6f5819cad4fbbb7550b524614ccd2f`
- FINAL sealed SHA256: `d11a1937cbf6017b8156712bfb6a59e05602a4006e704dd4c51c3b44701177f1`

Why 40 rather than forcing 100:
The 100-person candidate corpus contained weak, duplicated-year, or factually inaccurate labels. V1 keeps only four directionally clear scoring years per retained subject.

Notable corrections included Aaron Spelling 2001, Jennifer Lawrence 2017, Anjelica Huston event years, Ashley Judd 2006, Billy Connolly same-year collision, Buzz Aldrin post-NASA years, Drew Barrymore award year, plus replacements for weak/colliding rows in Harrison Dillard, Justine Henin, Miles Davis, Rock Hudson, and Rocky Bleier. Ann Jillian, Laura Ling, Mark Hamill, and Steve Prefontaine were removed rather than forcing weak labels.

DEV distribution: `{"gender": {"male": 14, "female": 10}, "birth_era": {"1900-1939": 8, "1980+": 4, "1940-1959": 8, "1960-1979": 4}, "confidence": {"high": 92, "medium": 4}, "evidence_grade": {"A": 37, "B": 59}}`
CHECK distribution: `{"gender": {"female": 3, "male": 5}, "birth_era": {"1940-1959": 3, "1960-1979": 1, "1980+": 2, "1900-1939": 2}, "confidence": {"high": 31, "medium": 1}, "evidence_grade": {"B": 28, "A": 4}}`
FINAL identities are withheld from Stage 1; n=8.

Limitations:
- public-figure selection/documentation bias
- career positives and health/family/legal negatives are overrepresented
- public events proxy yearly lived valence rather than subjective self-report
- FINAL n=8 is product-R&D holdout evidence, not a scientific accuracy estimate
