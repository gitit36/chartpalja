# V2 DY 2.7A Evaluation Report

**Decision:** `SKIP_27B`
**Status (interim):** `V2_DY_B_FINAL_FINAL_FREEZE`
**Measured:** 2026-08-13T02:25:44

## Phase 2.6 erratum

Phase 2.6 used A for primary parent attribution; correct local is annual_dev_B=0.65*A+0.35*B_trigger. Final pairwise/hit/same/cross/OLD/amplitude from 2.6 remain valid.

## Final score metrics (unchanged formulas)

| model | FA pw | FA hit | OLD pw | OLD hit |
|---|---:|---|---:|---|
| V2_DY_B | 0.6429 | 9/14 | 0.5749 | 40/56 |
| H1::CONS | 0.6429 | 9/14 | 0.5652 | 38/56 |
| H2::CONS | 0.6429 | 9/14 | 0.5654 | 36/56 |

## Marginal value (primary)

### H1
- **FRESH_A_DEV**: MARGINAL_NET=0.0 (help=0.0179 harm=0.0179) subjects improve/worsen/tie=1/1/12
  - B parent NET (ann_B)=0.1071 · A-only NET=0.0892 · flip=0.0357
  - boot overall={'n_pairs': 56, 'n_subjects': 14, 'mean': 0.0001, 'median': 0.0, 'p025': -0.0536, 'p975': 0.0536, 'frac_gt0': 0.3572} · boot HIGH={'n': 0}
  - by band={'LOW': {'n': 36, 'n_subjects': 12, 'subjects': ['Arnold Schwarzenegger', 'Bill Gates', 'Britney Spears', 'Diana, Princess of Wales', 'George Clooney', 'Johnny Depp', 'Martha Stewart', 'Meryl Streep', 'Michael Jordan', 'Robert Downey Jr.', 'Tiger Woods', 'Whitney Houston'], 'B_pairwise': 0.6111, 'C_pairwise': 0.6389, 'MARGINAL_HELP_rate': 0.0278, 'MARGINAL_HARM_rate': 0.0, 'MARGINAL_NET': 0.0278}, 'MID': {'n': 13, 'n_subjects': 6, 'subjects': ['Bill Gates', 'George Clooney', 'Marilyn Monroe', 'Meryl Streep', 'Michael Jordan', 'Roger Federer'], 'B_pairwise': 0.7692, 'C_pairwise': 0.6923, 'MARGINAL_HELP_rate': 0.0, 'MARGINAL_HARM_rate': 0.0769, 'MARGINAL_NET': -0.0769}, 'HIGH': {'n': 0}}
- **OLD_DEV**: MARGINAL_NET=-0.0165 (help=0.0303 harm=0.0468) subjects improve/worsen/tie=14/12/30
  - B parent NET (ann_B)=0.0048 · A-only NET=-0.0083 · flip=0.0365
  - boot overall={'n_pairs': 1454, 'n_subjects': 56, 'mean': -0.0156, 'median': -0.0142, 'p025': -0.0604, 'p975': 0.0184, 'frac_gt0': 0.2414} · boot HIGH={'n_pairs': 82, 'n_subjects': 18, 'mean': 0.0645, 'median': 0.0633, 'p025': -0.1342, 'p975': 0.2639, 'frac_gt0': 0.7154}
  - by band={'LOW': {'n': 616, 'n_subjects': 52, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Barack Obama', 'Björk', 'Chris Brown', 'Dennis Rodman', 'Diana Ross', 'Donald Trump', 'Drake', 'Elizabeth Taylor', 'Hillary Clinton', 'John Ritter', 'Justin Bieber', 'Kamala Harris', 'Kylie Jenner', 'Lionel Messi', 'Madonna', 'Michael Jackson', 'Monica Lewinsky', 'Sean Penn', '강호동', '권지용', '김부겸', '김어준', '김연아', '김영삼', '김우중', '김희민', '남진', '노무현', '노태우', '박근혜', '박나래', '박세리', '박정희', '박찬호', '봉준호', '서태지', '손흥민', '신성일', '신해철', '오세훈', '윤석열', '이건희', '이명박', '이병철', '이재용', '전두환', '정몽구', '정주영', '조용필', '홍준표'], 'B_pairwise': 0.5568, 'C_pairwise': 0.5244, 'MARGINAL_HELP_rate': 0.013, 'MARGINAL_HARM_rate': 0.0455, 'MARGINAL_NET': -0.0325}, 'MID': {'n': 329, 'n_subjects': 37, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Barack Obama', 'Dennis Rodman', 'Diana Ross', 'Donald Trump', 'Elizabeth Taylor', 'Hillary Clinton', 'John Ritter', 'Kamala Harris', 'Lionel Messi', 'Madonna', 'Michael Jackson', 'Monica Lewinsky', 'Sean Penn', '강호동', '김어준', '김연아', '김우중', '노무현', '노태우', '문재인', '박근혜', '박세리', '박찬호', '서태지', '신성일', '이건희', '이명박', '이병철', '이재용', '장미희', '전두환', '전소연', '정몽구', '정주영', '홍준표'], 'B_pairwise': 0.5562, 'C_pairwise': 0.5289, 'MARGINAL_HELP_rate': 0.0578, 'MARGINAL_HARM_rate': 0.0851, 'MARGINAL_NET': -0.0274}, 'HIGH': {'n': 82, 'n_subjects': 18, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Diana Ross', 'Elizabeth Taylor', 'Hillary Clinton', 'Madonna', '강호동', '김부겸', '김어준', '김희민', '노무현', '노태우', '문재인', '박정희', '오세훈', '이명박', '이병철', '정주영'], 'B_pairwise': 0.5488, 'C_pairwise': 0.6098, 'MARGINAL_HELP_rate': 0.2073, 'MARGINAL_HARM_rate': 0.1463, 'MARGINAL_NET': 0.061}}
- **COMBINED_DEV_DIAGNOSTIC**: MARGINAL_NET=-0.0159 (help=0.0298 harm=0.0457) subjects improve/worsen/tie=15/13/42
  - B parent NET (ann_B)=0.0086 · A-only NET=-0.0047 · flip=0.0364
  - boot overall={'n_pairs': 1510, 'n_subjects': 70, 'mean': -0.0153, 'median': -0.014, 'p025': -0.0585, 'p975': 0.018, 'frac_gt0': 0.238} · boot HIGH={'n_pairs': 82, 'n_subjects': 18, 'mean': 0.0647, 'median': 0.0634, 'p025': -0.1348, 'p975': 0.2667, 'frac_gt0': 0.7166}
  - by band={'LOW': {'n': 652, 'n_subjects': 64, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Arnold Schwarzenegger', 'Barack Obama', 'Bill Gates', 'Björk', 'Britney Spears', 'Chris Brown', 'Dennis Rodman', 'Diana Ross', 'Diana, Princess of Wales', 'Donald Trump', 'Drake', 'Elizabeth Taylor', 'George Clooney', 'Hillary Clinton', 'John Ritter', 'Johnny Depp', 'Justin Bieber', 'Kamala Harris', 'Kylie Jenner', 'Lionel Messi', 'Madonna', 'Martha Stewart', 'Meryl Streep', 'Michael Jackson', 'Michael Jordan', 'Monica Lewinsky', 'Robert Downey Jr.', 'Sean Penn', 'Tiger Woods', 'Whitney Houston', '강호동', '권지용', '김부겸', '김어준', '김연아', '김영삼', '김우중', '김희민', '남진', '노무현', '노태우', '박근혜', '박나래', '박세리', '박정희', '박찬호', '봉준호', '서태지', '손흥민', '신성일', '신해철', '오세훈', '윤석열', '이건희', '이명박', '이병철', '이재용', '전두환', '정몽구', '정주영', '조용필', '홍준표'], 'B_pairwise': 0.5598, 'C_pairwise': 0.5307, 'MARGINAL_HELP_rate': 0.0138, 'MARGINAL_HARM_rate': 0.0429, 'MARGINAL_NET': -0.0291}, 'MID': {'n': 342, 'n_subjects': 43, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Barack Obama', 'Bill Gates', 'Dennis Rodman', 'Diana Ross', 'Donald Trump', 'Elizabeth Taylor', 'George Clooney', 'Hillary Clinton', 'John Ritter', 'Kamala Harris', 'Lionel Messi', 'Madonna', 'Marilyn Monroe', 'Meryl Streep', 'Michael Jackson', 'Michael Jordan', 'Monica Lewinsky', 'Roger Federer', 'Sean Penn', '강호동', '김어준', '김연아', '김우중', '노무현', '노태우', '문재인', '박근혜', '박세리', '박찬호', '서태지', '신성일', '이건희', '이명박', '이병철', '이재용', '장미희', '전두환', '전소연', '정몽구', '정주영', '홍준표'], 'B_pairwise': 0.5643, 'C_pairwise': 0.5351, 'MARGINAL_HELP_rate': 0.0556, 'MARGINAL_HARM_rate': 0.0848, 'MARGINAL_NET': -0.0292}, 'HIGH': {'n': 82, 'n_subjects': 18, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Diana Ross', 'Elizabeth Taylor', 'Hillary Clinton', 'Madonna', '강호동', '김부겸', '김어준', '김희민', '노무현', '노태우', '문재인', '박정희', '오세훈', '이명박', '이병철', '정주영'], 'B_pairwise': 0.5488, 'C_pairwise': 0.6098, 'MARGINAL_HELP_rate': 0.2073, 'MARGINAL_HARM_rate': 0.1463, 'MARGINAL_NET': 0.061}}

### H2
- **FRESH_A_DEV**: MARGINAL_NET=0.0 (help=0.0179 harm=0.0179) subjects improve/worsen/tie=1/1/12
  - B parent NET (ann_B)=0.1071 · A-only NET=0.0892 · flip=0.0357
  - boot overall={'n_pairs': 56, 'n_subjects': 14, 'mean': 0.0001, 'median': 0.0, 'p025': -0.0536, 'p975': 0.0536, 'frac_gt0': 0.3508} · boot HIGH={'n': 0}
  - by band={'LOW': {'n': 36, 'n_subjects': 12, 'subjects': ['Arnold Schwarzenegger', 'Bill Gates', 'Britney Spears', 'Diana, Princess of Wales', 'George Clooney', 'Johnny Depp', 'Martha Stewart', 'Meryl Streep', 'Michael Jordan', 'Robert Downey Jr.', 'Tiger Woods', 'Whitney Houston'], 'B_pairwise': 0.6111, 'C_pairwise': 0.6389, 'MARGINAL_HELP_rate': 0.0278, 'MARGINAL_HARM_rate': 0.0, 'MARGINAL_NET': 0.0278}, 'MID': {'n': 13, 'n_subjects': 6, 'subjects': ['Bill Gates', 'George Clooney', 'Marilyn Monroe', 'Meryl Streep', 'Michael Jordan', 'Roger Federer'], 'B_pairwise': 0.7692, 'C_pairwise': 0.6923, 'MARGINAL_HELP_rate': 0.0, 'MARGINAL_HARM_rate': 0.0769, 'MARGINAL_NET': -0.0769}, 'HIGH': {'n': 0}}
  - attr={'UNCHANGED': 54, 'D_ONLY_HARM': 1, 'D_ONLY_HELP': 1}
- **OLD_DEV**: MARGINAL_NET=-0.0144 (help=0.0351 harm=0.0495) subjects improve/worsen/tie=14/11/31
  - B parent NET (ann_B)=0.0048 · A-only NET=-0.0083 · flip=0.0365
  - boot overall={'n_pairs': 1454, 'n_subjects': 56, 'mean': -0.0137, 'median': -0.0122, 'p025': -0.0567, 'p975': 0.0227, 'frac_gt0': 0.264} · boot HIGH={'n_pairs': 82, 'n_subjects': 18, 'mean': 0.0991, 'median': 0.1013, 'p025': -0.0822, 'p975': 0.2769, 'frac_gt0': 0.8458}
  - by band={'LOW': {'n': 616, 'n_subjects': 52, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Barack Obama', 'Björk', 'Chris Brown', 'Dennis Rodman', 'Diana Ross', 'Donald Trump', 'Drake', 'Elizabeth Taylor', 'Hillary Clinton', 'John Ritter', 'Justin Bieber', 'Kamala Harris', 'Kylie Jenner', 'Lionel Messi', 'Madonna', 'Michael Jackson', 'Monica Lewinsky', 'Sean Penn', '강호동', '권지용', '김부겸', '김어준', '김연아', '김영삼', '김우중', '김희민', '남진', '노무현', '노태우', '박근혜', '박나래', '박세리', '박정희', '박찬호', '봉준호', '서태지', '손흥민', '신성일', '신해철', '오세훈', '윤석열', '이건희', '이명박', '이병철', '이재용', '전두환', '정몽구', '정주영', '조용필', '홍준표'], 'B_pairwise': 0.5568, 'C_pairwise': 0.526, 'MARGINAL_HELP_rate': 0.0162, 'MARGINAL_HARM_rate': 0.0471, 'MARGINAL_NET': -0.0308}, 'MID': {'n': 329, 'n_subjects': 37, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Barack Obama', 'Dennis Rodman', 'Diana Ross', 'Donald Trump', 'Elizabeth Taylor', 'Hillary Clinton', 'John Ritter', 'Kamala Harris', 'Lionel Messi', 'Madonna', 'Michael Jackson', 'Monica Lewinsky', 'Sean Penn', '강호동', '김어준', '김연아', '김우중', '노무현', '노태우', '문재인', '박근혜', '박세리', '박찬호', '서태지', '신성일', '이건희', '이명박', '이병철', '이재용', '장미희', '전두환', '전소연', '정몽구', '정주영', '홍준표'], 'B_pairwise': 0.5562, 'C_pairwise': 0.5258, 'MARGINAL_HELP_rate': 0.0669, 'MARGINAL_HARM_rate': 0.0973, 'MARGINAL_NET': -0.0304}, 'HIGH': {'n': 82, 'n_subjects': 18, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Diana Ross', 'Elizabeth Taylor', 'Hillary Clinton', 'Madonna', '강호동', '김부겸', '김어준', '김희민', '노무현', '노태우', '문재인', '박정희', '오세훈', '이명박', '이병철', '정주영'], 'B_pairwise': 0.5488, 'C_pairwise': 0.6463, 'MARGINAL_HELP_rate': 0.2073, 'MARGINAL_HARM_rate': 0.1098, 'MARGINAL_NET': 0.0976}}
  - attr={'UNCHANGED': 1331, 'D_ONLY_HARM': 30, 'D_AND_DXY_HELP': 30, 'D_ONLY_HELP': 13, 'D_AND_DXY_HARM': 30, 'MIXED_EFFECT': 16, 'DXY_ONLY_HELP': 2, 'DXY_ONLY_HARM': 2}
- **COMBINED_DEV_DIAGNOSTIC**: MARGINAL_NET=-0.0139 (help=0.0344 harm=0.0483) subjects improve/worsen/tie=15/12/43
  - B parent NET (ann_B)=0.0086 · A-only NET=-0.0047 · flip=0.0364
  - boot overall={'n_pairs': 1510, 'n_subjects': 70, 'mean': -0.0131, 'median': -0.0118, 'p025': -0.0533, 'p975': 0.0215, 'frac_gt0': 0.2652} · boot HIGH={'n_pairs': 82, 'n_subjects': 18, 'mean': 0.0981, 'median': 0.0985, 'p025': -0.0778, 'p975': 0.275, 'frac_gt0': 0.845}
  - by band={'LOW': {'n': 652, 'n_subjects': 64, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Arnold Schwarzenegger', 'Barack Obama', 'Bill Gates', 'Björk', 'Britney Spears', 'Chris Brown', 'Dennis Rodman', 'Diana Ross', 'Diana, Princess of Wales', 'Donald Trump', 'Drake', 'Elizabeth Taylor', 'George Clooney', 'Hillary Clinton', 'John Ritter', 'Johnny Depp', 'Justin Bieber', 'Kamala Harris', 'Kylie Jenner', 'Lionel Messi', 'Madonna', 'Martha Stewart', 'Meryl Streep', 'Michael Jackson', 'Michael Jordan', 'Monica Lewinsky', 'Robert Downey Jr.', 'Sean Penn', 'Tiger Woods', 'Whitney Houston', '강호동', '권지용', '김부겸', '김어준', '김연아', '김영삼', '김우중', '김희민', '남진', '노무현', '노태우', '박근혜', '박나래', '박세리', '박정희', '박찬호', '봉준호', '서태지', '손흥민', '신성일', '신해철', '오세훈', '윤석열', '이건희', '이명박', '이병철', '이재용', '전두환', '정몽구', '정주영', '조용필', '홍준표'], 'B_pairwise': 0.5598, 'C_pairwise': 0.5322, 'MARGINAL_HELP_rate': 0.0169, 'MARGINAL_HARM_rate': 0.0445, 'MARGINAL_NET': -0.0276}, 'MID': {'n': 342, 'n_subjects': 43, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Barack Obama', 'Bill Gates', 'Dennis Rodman', 'Diana Ross', 'Donald Trump', 'Elizabeth Taylor', 'George Clooney', 'Hillary Clinton', 'John Ritter', 'Kamala Harris', 'Lionel Messi', 'Madonna', 'Marilyn Monroe', 'Meryl Streep', 'Michael Jackson', 'Michael Jordan', 'Monica Lewinsky', 'Roger Federer', 'Sean Penn', '강호동', '김어준', '김연아', '김우중', '노무현', '노태우', '문재인', '박근혜', '박세리', '박찬호', '서태지', '신성일', '이건희', '이명박', '이병철', '이재용', '장미희', '전두환', '전소연', '정몽구', '정주영', '홍준표'], 'B_pairwise': 0.5643, 'C_pairwise': 0.5322, 'MARGINAL_HELP_rate': 0.0643, 'MARGINAL_HARM_rate': 0.0965, 'MARGINAL_NET': -0.0322}, 'HIGH': {'n': 82, 'n_subjects': 18, 'subjects': ['Al Gore', 'Amy Klobuchar', 'Diana Ross', 'Elizabeth Taylor', 'Hillary Clinton', 'Madonna', '강호동', '김부겸', '김어준', '김희민', '노무현', '노태우', '문재인', '박정희', '오세훈', '이명박', '이병철', '정주영'], 'B_pairwise': 0.5488, 'C_pairwise': 0.6463, 'MARGINAL_HELP_rate': 0.2073, 'MARGINAL_HARM_rate': 0.1098, 'MARGINAL_NET': 0.0976}}
  - attr={'UNCHANGED': 1385, 'D_ONLY_HARM': 31, 'D_AND_DXY_HELP': 30, 'D_ONLY_HELP': 14, 'D_AND_DXY_HARM': 30, 'MIXED_EFFECT': 16, 'DXY_ONLY_HELP': 2, 'DXY_ONLY_HARM': 2}

## 2.7B gate

```{
  "run": false,
  "justified_by": null,
  "h1_ok": false,
  "h1_fail_reasons": [
    "E_fail_erratum_or_story"
  ],
  "h2_ok": false,
  "h2_fail_reasons": [
    "E_fail_erratum_or_story"
  ]
}```


---

## ERRATUM (closure audit)

Fixed accidental `or True` in H2 D vs D×Y **attribution labels** (`experiment_v2_dy_27_eval.py`). Headline pairwise / marginal NET / SKIP_27B unchanged. Only `attr_counts` for joint D+D×Y harm/mixed labels were corrected (e.g. OLD H2: more MIXED_EFFECT, fewer forced D_AND_DXY_HARM).
