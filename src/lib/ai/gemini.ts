/**
 * 공용 Gemini API 호출 유틸리티.
 * - 기본 모델: gemini-2.5-flash
 * - usageMetadata 실측 로그 (마진 분석용)
 * - 일시적 429 → 1회 재시도, 할당량 소진 → 즉시 실패
 */

import {
  appendGeminiUsageLog,
  buildUsageRecord,
  extractGeminiUsage,
  logGeminiUsageConsole,
  type GeminiTokenUsage,
  type GeminiUsageFeature,
} from '@/lib/ai/gemini-usage'

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

export interface CallGeminiOptions {
  model?: string
  feature?: GeminiUsageFeature
  meta?: Record<string, unknown>
  /** true면 usage를 반환 (측정 스크립트용). 기본 호출은 텍스트만. */
  returnUsage?: boolean
}

export interface CallGeminiResult {
  text: string
  usage: GeminiTokenUsage | null
  model: string
}

async function generateOnce(
  prompt: string,
  model: string,
): Promise<{ text: string; usage: GeminiTokenUsage | null }> {
  const apiKey = getApiKey()
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })
  const result = await genModel.generateContent(prompt)
  const usage = extractGeminiUsage(result.response.usageMetadata)
  return { text: result.response.text(), usage }
}

async function recordUsage(
  feature: GeminiUsageFeature,
  model: string,
  usage: GeminiTokenUsage | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!usage) return
  const record = buildUsageRecord(feature, model, usage, meta)
  logGeminiUsageConsole(record)
  await appendGeminiUsageLog(record)
}

/**
 * 텍스트만 반환 (기존 호출부 호환).
 * 옵션으로 feature를 넘기면 logs/gemini-usage.jsonl 에 실측 기록.
 */
export async function callGemini(
  prompt: string,
  modelOrOpts: string | CallGeminiOptions = GEMINI_MODEL,
): Promise<string> {
  const opts: CallGeminiOptions = typeof modelOrOpts === 'string'
    ? { model: modelOrOpts }
    : modelOrOpts
  const result = await callGeminiWithUsage(prompt, opts)
  return result.text
}

/** usage까지 포함한 호출 (측정·운영 분석용) */
export async function callGeminiWithUsage(
  prompt: string,
  opts: CallGeminiOptions = {},
): Promise<CallGeminiResult> {
  const model = opts.model ?? GEMINI_MODEL
  const feature = opts.feature ?? 'other'

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { text, usage } = await generateOnce(prompt, model)
      await recordUsage(feature, model, usage, opts.meta)
      return { text, usage, model }
    } catch (err) {
      lastError = err
      if (isQuotaExhausted(err)) {
        console.warn(`[gemini] quota exhausted (model=${model}), no retry`)
        break
      }
      if (!isRateLimitError(err) || attempt === MAX_RETRIES) break

      const backoff = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(`[gemini] 429 (model=${model}, attempt=${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round(backoff / 1000)}s...`)
      await Promise.resolve(new Promise(r => setTimeout(r, backoff)))
    }
  }
  throw lastError
}
