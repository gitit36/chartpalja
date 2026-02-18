# 사주 분석 서비스

Next.js 기반 사주 분석 웹 애플리케이션. Saju 계산은 **Python을 “한 번만 실행되는 도구”**로 사용합니다 (상시 Python 서버 없음).

## 동작 방식

- **런타임**: 사용자가 "사주 분석 시작"을 누르면 Next.js가 `python_service/run_once.py`를 **한 번** 실행(서브프로세스)하고, stdin으로 입력을 넘겨 JSON 결과를 받아 DB에 저장합니다.
- **Python 서버 불필요**: 포트 8000, 상시 실행 없음. Python은 요청 시마다 한 번씩만 실행됩니다.

## Quick Start

### 1. 의존성 설치

**Node:**
```bash
npm install
```

**Python (sajupy + saju_engine):**
```bash
cd python_service && pip install -r requirements.txt && cd ..
```

### 2. 환경 변수

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PYTHON_PATH` | No (default: `python3`) | Python 실행 파일 (Windows: `python` 등) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption secret (min 32 chars) |
| `KAKAO_*`, `KAKAOPAY_*` | For auth/pay | Kakao OAuth / KakaoPay 설정 |

### 3. DB 설정

```bash
npm run db:generate
npm run db:migrate
```

### 4. 실행

```bash
npm run dev
```

Next.js만 실행됩니다. [http://localhost:3000](http://localhost:3000) 에서 사용합니다.

- Python 서버를 띄울 필요 없음.
- "사주 분석 시작" 시마다 `python3 python_service/run_once.py` 가 한 번 실행됩니다.

## 검증 (1997-03-06 03:25 남성, 양력)

1. **한 번에 실행 스크립트**
   ```bash
   echo '{"birth_date":"1997-03-06","birth_time":"03:25","gender":"male"}' | python3 python_service/run_once.py
   ```
   연·월·일·시주 등 정규화된 JSON이 stdout에 출력됩니다.

2. **Next.js**
   - `/app/input` 에서 생년월일·시간 입력 후 게스트로 시작 → summary에서 "사주 분석 시작" 클릭.
   - summary에 사주 카드가 그대로 나오면 동일한 Python 계산이 쓰인 것입니다.

## 프로젝트 구조

```
saju/
├── python_service/
│   ├── run_once.py      # 한 번 실행: stdin(JSON) → stdout(보고서 JSON)
│   ├── saju_lib.py      # 공통 계산·정규화 (saju_engine 래핑)
│   ├── main.py          # (선택) FastAPI 서버 — 로컬 검증용
│   └── requirements.txt
├── saju_engine.py       # 사주 엔진 (17개 섹션, sajupy + shinsal_lookup.csv)
├── shinsal_lookup.csv   # 신살 CSV 데이터
├── obsolete/            # 구버전·미사용 파일 보관
├── test/                # 테스트 전용 (별도)
├── src/
│   └── lib/saju/
│       └── saju-report.ts  # buildSajuReportViaPython() → subprocess로 run_once.py 호출
└── package.json
```

## 참고

- Saju 계산은 **saju_engine.py** (sajupy + CSV 신살)를 사용합니다.
- DB에는 생년월일·시각 원본을 저장하지 않고, `inputRedacted`(birthYear + 옵션)와 계산된 보고서 JSON만 저장합니다.
- Python이 PATH에 없으면 503 에러가 나며, `PYTHON_PATH` 로 실행 파일을 지정할 수 있습니다.
