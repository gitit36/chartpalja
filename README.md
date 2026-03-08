# 차트팔자 — 사주팔자, 차트로 읽다

100년 인생의 흐름을 하나의 차트로 시각화하는 사주 분석 서비스.

## 핵심 구조

```
사주 입력 → Python 엔진 (deterministic score)
         → 100세 타임라인 + breakdown
         → Gemini LLM (서사 해설)
         → 차트 + 운세 해설 UI
```

- **점수**: Python 사주 엔진이 계산 (saju_engine.py v5)
- **해설**: Google Gemini가 breakdown 기반으로 reasoning 서사 생성
- **Python 서버 불필요**: 요청마다 subprocess로 1회 실행

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 15, React, Tailwind CSS, Recharts |
| Backend | Next.js API Routes, Prisma ORM |
| Engine | Python 3 (sajupy, saju_engine.py) |
| AI | Google Gemini 2.5 Flash |
| DB | PostgreSQL |
| Auth | Kakao OAuth + Guest Mode |

## Quick Start

### 1. 의존성 설치

```bash
npm install
```

```bash
cd python_service && pip install -r requirements.txt && cd ..
```

### 2. 환경 변수

```bash
cp .env.example .env
# .env 파일에 실제 값 입력
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `SESSION_SECRET` | Yes | Session encryption (min 32 chars) |
| `KAKAO_CLIENT_ID` | For auth | Kakao OAuth Client ID |
| `PYTHON_PATH` | No | Python 실행 파일 (default: `python3`) |

### 3. DB 설정

```bash
npx prisma db push
```

### 4. 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 사용합니다.

## 프로젝트 구조

```
├── src/
│   ├── app/
│   │   ├── (marketing)/        # 랜딩 페이지
│   │   ├── app/
│   │   │   ├── input/          # 사주 입력
│   │   │   ├── list/           # 사주 목록
│   │   │   └── saju/[id]/      # 사주 상세 (차트 + 해설)
│   │   └── api/
│   │       ├── saju/           # 사주 CRUD + 운세 생성
│   │       └── auth/kakao/     # 카카오 OAuth
│   ├── components/
│   │   ├── ChartTab.tsx        # 총운 차트 + 보조지표 + 비교하기
│   │   ├── InfoTab.tsx         # 사주 정보 탭
│   │   └── summary/           # 사주 요약 컴포넌트
│   ├── lib/
│   │   ├── ai/                # LLM 프롬프트 + 데이터 추출
│   │   ├── saju/              # 사주 리포트 빌더 + 차트 데이터 변환
│   │   └── auth/, db/         # 인증, DB
│   └── types/                 # TypeScript 타입 정의
├── python_service/
│   ├── run_once.py            # 엔트리포인트 (stdin → stdout)
│   ├── saju_lib.py            # 엔진 래퍼
│   └── requirements.txt
├── saju_engine.py             # 사주 엔진 v5 (핵심)
├── shinsal_lookup.csv         # 신살 데이터
├── prisma/schema.prisma       # DB 스키마
├── test/
│   ├── test_scoring_v5.py     # 엔진 테스트 (pytest)
│   └── snapshots/             # 스냅샷 테스트 데이터
├── docs/                      # 제품 기획서, 엔진 진화 기록
└── public/                    # 정적 에셋 (로고)
```

## 테스트

```bash
pytest test/test_scoring_v5.py -v
```

## 주요 기능

- **100세 인생 차트**: 세운/월운/대운 시각화
- **보조지표**: 유리한 흐름, 변화의 파도, 귀인의 도움, 오행 균형도, 십성 밸런스, 이벤트 확률
- **비교하기**: 두 사람의 차트 오버레이 + 궁합 분석
- **AI 운세 해설**: 엔진 breakdown 기반 LLM reasoning 서사
- **사주 정보**: 원국, 오행 분포, 십성 배치, 대운 흐름, 신살, 사주관계
- **음력 윤달 지원**
