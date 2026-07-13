/**
 * Gemini 호출 실측 토큰/비용 기록.
 * - 운영 마진 분석용 JSONL 로그
 * - 가격표는 공식 Paid tier 기준 (2026-07 확인)
 */

import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

export type GeminiUsageFeature =
  | 'period_year'
  | 'period_year_range'
  | 'period_month'
  | 'period_month_range'
  | 'period_week'
  | 'period_week_range'
  | 'period_compat'
  | 'fortune'
  | 'compat'
  | 'measure'
  | 'other'

export interface GeminiTokenUsage {
  promptTokenCount: number
  candidatesTokenCount: number
  /** thinking 토큰 — output 과금에 포함 */
  thoughtsTokenCount: number
  totalTokenCount: number
}

export interface GeminiUsageRecord {
  at: string
  feature: GeminiUsageFeature
  model: string
  usage: GeminiTokenUsage
  /** USD */
  costUsd: number
  /** KRW, FX 가정 포함 */
  costKrw: number
  meta?: Record<string, unknown>
}

/** 공식 Gemini Developer API Paid tier ($ / 1M tokens) — 2026-07 */
export const GEMINI_PRICE_USD_PER_M = {
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
} as const

export type PricedGeminiModel = keyof typeof GEMINI_PRICE_USD_PER_M

export const USD_KRW = 1350

export function extractGeminiUsage(usageMetadata: unknown): GeminiTokenUsage | null {
  if (!usageMetadata || typeof usageMetadata !== 'object') return null
  const u = usageMetadata as Record<string, unknown>
  const prompt = Number(u.promptTokenCount ?? 0) || 0
  const candidates = Number(u.candidatesTokenCount ?? 0) || 0
  const thoughts = Number(u.thoughtsTokenCount ?? 0) || 0
  const total = Number(u.totalTokenCount ?? prompt + candidates + thoughts) || prompt + candidates + thoughts
  if (prompt === 0 && candidates === 0 && thoughts === 0 && total === 0) return null
  return {
    promptTokenCount: prompt,
    candidatesTokenCount: candidates,
    thoughtsTokenCount: thoughts,
    totalTokenCount: total,
  }
}

/** output 과금 = candidates + thoughts (공식: output includes thinking) */
export function billableOutputTokens(usage: GeminiTokenUsage): number {
  return usage.candidatesTokenCount + usage.thoughtsTokenCount
}

export function estimateCostUsd(
  usage: GeminiTokenUsage,
  model: string,
): number {
  const price = GEMINI_PRICE_USD_PER_M[model as PricedGeminiModel]
    ?? GEMINI_PRICE_USD_PER_M['gemini-2.5-flash']
  const input = usage.promptTokenCount / 1_000_000 * price.input
  const output = billableOutputTokens(usage) / 1_000_000 * price.output
  return input + output
}

export function estimateCostKrw(usage: GeminiTokenUsage, model: string, fx = USD_KRW): number {
  return estimateCostUsd(usage, model) * fx
}

/** 같은 토큰량을 다른 모델 단가에 대입 (thinking 비율이 모델마다 다를 수 있음 — 상한 근사) */
export function extrapolateCostUsd(usage: GeminiTokenUsage, model: PricedGeminiModel): number {
  return estimateCostUsd(usage, model)
}

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'gemini-usage.jsonl')

export async function appendGeminiUsageLog(record: GeminiUsageRecord): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true })
    await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, 'utf8')
  } catch (err) {
    console.warn('[gemini-usage] failed to write log', err)
  }
}

export function buildUsageRecord(
  feature: GeminiUsageFeature,
  model: string,
  usage: GeminiTokenUsage,
  meta?: Record<string, unknown>,
): GeminiUsageRecord {
  const costUsd = estimateCostUsd(usage, model)
  return {
    at: new Date().toISOString(),
    feature,
    model,
    usage,
    costUsd,
    costKrw: costUsd * USD_KRW,
    meta,
  }
}

export function logGeminiUsageConsole(record: GeminiUsageRecord): void {
  const { usage } = record
  console.info(
    `[gemini-usage] feature=${record.feature} model=${record.model}`
    + ` prompt=${usage.promptTokenCount} cand=${usage.candidatesTokenCount}`
    + ` thoughts=${usage.thoughtsTokenCount} total=${usage.totalTokenCount}`
    + ` cost=$${record.costUsd.toFixed(5)} (₩${Math.round(record.costKrw)})`,
  )
}
