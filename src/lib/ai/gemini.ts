/**
 * 공용 Gemini API 호출 유틸리티.
 * - 단일 모델 사용 (품질 일관성)
 * - 일시적 429 → 1회 재시도, 할당량 소진 → 즉시 실패
 */

export const GEMINI_MODEL = 'gemini-2.5-flash'

const MAX_RETRIES = 1
const BASE_DELAY_MS = 3_000

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key || key === 'your-gemini-api-key') {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가해주세요.')
  }
  return key
}

function isQuotaExhausted(error: unknown): boolean {
  const msg = String(error)
  return msg.includes('exceeded your current quota') ||
         msg.includes('limit: 0') ||
         (msg.includes('quota') && msg.includes('limit'))
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const status = (error as Record<string, unknown>).status ??
                   (error as Record<string, unknown>).httpStatusCode
    if (status === 429) return true
  }
  const msg = String(error)
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED')
}

export async function callGemini(
  prompt: string,
  model: string = GEMINI_MODEL,
): Promise<string> {
  const apiKey = getApiKey()
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await genModel.generateContent(prompt)
      return result.response.text()
    } catch (err) {
      lastError = err
      if (isQuotaExhausted(err)) {
        console.warn(`[gemini] quota exhausted (model=${model}), no retry`)
        break
      }
      if (!isRateLimitError(err) || attempt === MAX_RETRIES) break

      const backoff = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(`[gemini] 429 (model=${model}, attempt=${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round(backoff / 1000)}s...`)
      await new Promise(r => setTimeout(r, backoff))
    }
  }
  throw lastError
}
