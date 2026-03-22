/**
 * LLM-based 용신/희신/기신 판별 + DB 캐시.
 * 동일 4주(四柱) 조합은 영구 재사용.
 */

import { prisma } from '@/lib/db/prisma'

export interface YongshinResult {
  용신_오행: string
  희신_오행: string[]
  기신_오행: string[]
  구신_오행: string[]
  reasoning?: string
}

// ── 4주 키 추출 ──────────────────────────────────

export function extractFourPillarKey(sajuReport: Record<string, unknown>): string | null {
  try {
    // normalized format: 만세력_사주원국.{연주,월주,일주,시주} = ["甲","子"]
    const wonguk =
      (sajuReport['만세력_사주원국'] as Record<string, string[]> | undefined) ??
      (sajuReport['원국'] as Record<string, string[]> | undefined)
    if (!wonguk) return null

    const keyPairs: [string, string][] = [
      ['연주', 'year'], ['월주', 'month'], ['일주', 'day'], ['시주', 'hour'],
    ]
    const parts: string[] = []
    for (const [kor, eng] of keyPairs) {
      const p = wonguk[kor] ?? wonguk[eng]
      if (!p || p.length < 2) return null
      parts.push(`${p[0]}${p[1]}`)
    }
    return parts.join('_')
  } catch {
    return null
  }
}

// ── 캐시 조회 ──────────────────────────────────

export async function getCachedYongshin(fourPillars: string): Promise<YongshinResult | null> {
  const cached = await prisma.yongshinCache.findUnique({
    where: { fourPillars },
  })
  if (!cached) return null
  return {
    용신_오행: cached.yongshinElem,
    희신_오행: cached.heeshinElems,
    기신_오행: cached.gishinElems,
    구신_오행: cached.gushinElems,
    reasoning: cached.reasoning ?? undefined,
  }
}

// ── 캐시 저장 ──────────────────────────────────

export async function saveCachedYongshin(
  fourPillars: string,
  result: YongshinResult,
  model: string
): Promise<void> {
  await prisma.yongshinCache.upsert({
    where: { fourPillars },
    create: {
      fourPillars,
      yongshinElem: result.용신_오행,
      heeshinElems: result.희신_오행,
      gishinElems: result.기신_오행,
      gushinElems: result.구신_오행,
      reasoning: result.reasoning ?? null,
      model,
    },
    update: {
      yongshinElem: result.용신_오행,
      heeshinElems: result.희신_오행,
      gishinElems: result.기신_오행,
      gushinElems: result.구신_오행,
      reasoning: result.reasoning ?? null,
      model,
    },
  })
}

// ── LLM 프롬프트 빌드 ──────────────────────────

interface PromptMeta {
  gender: 'male' | 'female'
  calendar: 'solar' | 'lunar'
}

function buildYongshinPrompt(sajuReport: Record<string, unknown>, meta: PromptMeta): string {
  const wonguk =
    (sajuReport['만세력_사주원국'] as Record<string, string[]> | undefined) ??
    (sajuReport['원국'] as Record<string, string[]>)

  const yearP = wonguk['연주'] ?? wonguk['year']
  const monthP = wonguk['월주'] ?? wonguk['month']
  const dayP = wonguk['일주'] ?? wonguk['day']
  const hourP = wonguk['시주'] ?? wonguk['hour']

  const genderStr = meta.gender === 'female' ? '여성' : '남성'
  const calendarStr = meta.calendar === 'lunar' ? '음력' : '양력'

  return `너는 사주명리학(四柱命理學) 전문가다. 아래 사주만 보고 용신(用神), 희신(喜神), 기신(忌神), 구신(仇神)을 판별하라.

## 사주
- 년주: ${yearP[0]}${yearP[1]}
- 월주: ${monthP[0]}${monthP[1]}
- 일주: ${dayP[0]}${dayP[1]}
- 시주: ${hourP[0]}${hourP[1]}
- 성별: ${genderStr}
- 역법: ${calendarStr}

## 판별 절차
1. 일간(日干)의 오행과 음양을 파악하라.
2. 월령(月令)과 지장간을 분석하여 일간의 강약(신강/신약/중화)을 직접 판단하라.
3. 격국(格局)을 정하라.
4. 억부(抑扶)·조후(調候)·통관(通關)을 종합하여 용신을 정하라.
5. 신약이면 일간을 돕는 오행(인성/비겁), 신강이면 설기·억제하는 오행(식상/재성/관살)이 용신.
6. 중화에 가까우면 격국 주성을 보호하는 방향으로 용신을 정하라.
7. 조후가 시급해도 조후 오행이 일간을 설기(식상/재성)하면서 일간이 약하면 조후를 적용하지 마라.

## 출력 (반드시 아래 JSON만 출력)
\`\`\`json
{
  "용신_오행": "水",
  "희신_오행": ["木"],
  "기신_오행": ["火", "土"],
  "구신_오행": [],
  "reasoning": "2~3문장 한국어 근거"
}
\`\`\`
오행은 木/火/土/金/水 중 하나만 사용.`
}

// ── LLM 호출 ──────────────────────────────────

import { callGemini, GEMINI_MODEL } from '@/lib/ai/gemini'

const YONGSHIN_MODEL = GEMINI_MODEL

async function callGeminiForYongshin(prompt: string): Promise<YongshinResult> {
  const text = await callGemini(prompt, YONGSHIN_MODEL)

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('LLM 용신 응답에서 JSON 파싱 실패')
  const jsonStr = jsonMatch[1] ?? jsonMatch[0]
  const parsed = JSON.parse(jsonStr.trim())

  const VALID_ELEMS = new Set(['木', '火', '土', '金', '水'])
  if (!VALID_ELEMS.has(parsed['용신_오행'])) {
    throw new Error(`유효하지 않은 용신 오행: ${parsed['용신_오행']}`)
  }

  return {
    용신_오행: parsed['용신_오행'],
    희신_오행: (parsed['희신_오행'] ?? []).filter((e: string) => VALID_ELEMS.has(e)),
    기신_오행: (parsed['기신_오행'] ?? []).filter((e: string) => VALID_ELEMS.has(e)),
    구신_오행: (parsed['구신_오행'] ?? []).filter((e: string) => VALID_ELEMS.has(e)),
    reasoning: parsed['reasoning'] ?? undefined,
  }
}

// ── 메인 함수: 캐시 확인 → LLM 호출 → 캐시 저장 ──

export async function resolveYongshin(
  sajuReport: Record<string, unknown>,
  meta: { gender: 'male' | 'female'; isLunar: boolean }
): Promise<{ result: YongshinResult; source: 'cache' | 'llm' | 'rule' } | null> {
  const fourPillars = extractFourPillarKey(sajuReport)
  if (!fourPillars) return null

  // 1) 캐시 확인
  const cached = await getCachedYongshin(fourPillars)
  if (cached) {
    console.log(`[yongshin-llm] cache HIT: ${fourPillars}`)
    return { result: cached, source: 'cache' }
  }

  // 2) LLM 호출
  console.log(`[yongshin-llm] cache MISS: ${fourPillars} → calling ${YONGSHIN_MODEL}`)
  try {
    const prompt = buildYongshinPrompt(sajuReport, {
      gender: meta.gender,
      calendar: meta.isLunar ? 'lunar' : 'solar',
    })
    const llmResult = await callGeminiForYongshin(prompt)

    // 3) 캐시 저장
    await saveCachedYongshin(fourPillars, llmResult, YONGSHIN_MODEL)
    console.log(`[yongshin-llm] saved: ${fourPillars} → 용신=${llmResult.용신_오행}`)

    return { result: llmResult, source: 'llm' }
  } catch (err) {
    console.error('[yongshin-llm] LLM 호출 실패, 룰 베이스 fallback:', err)
    return null
  }
}
