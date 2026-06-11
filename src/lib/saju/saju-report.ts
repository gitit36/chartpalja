/**
 * Saju computation via Python one-off script (saju_engine.py + saju_lib).
 * No Python server. Server-side only: call from API routes.
 */

import { runPythonScript, isForcingArm64, pythonCmd } from './python-runner'

export type SajuReportInput = {
  birthDate: string
  birthTime: string
  timeUnknown?: boolean
  gender?: 'male' | 'female'
  city?: string
  useSolarTime?: boolean
  earlyZiTime?: boolean
  utcOffset?: number
  isLunar?: boolean
  isLeapMonth?: boolean
  yongshinOverride?: {
    용신_오행: string
    희신_오행: string[]
    기신_오행: string[]
    구신_오행: string[]
  }
}

/**
 * Run Python script once with input on stdin, return normalized report JSON.
 * Do not log birthDate/birthTime.
 */
export async function buildSajuReportViaPython(
  input: SajuReportInput
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    birth_date: input.birthDate,
    birth_time: input.timeUnknown ? '12:00' : (input.birthTime || '12:00'),
    time_unknown: !!input.timeUnknown,
    gender: input.gender === 'female' ? 'female' : 'male',
    city: input.city ?? 'Seoul',
    utc_offset: input.utcOffset ?? 9,
    use_solar_time: input.useSolarTime ?? true,
    early_zi_time: input.earlyZiTime ?? false,
    is_lunar: !!input.isLunar,
    is_leap_month: !!input.isLeapMonth,
  }
  if (input.yongshinOverride) {
    body.yongshin_override = input.yongshinOverride
  }
  const inputStr = JSON.stringify(body)
  console.log('[saju-report] Using Python:', pythonCmd(), isForcingArm64() ? '(arch -arm64)' : '')

  const stdout = runPythonScript('run_once.py', inputStr)
  try {
    return JSON.parse(stdout) as Record<string, unknown>
  } catch {
    throw new Error('Python Saju script returned invalid JSON')
  }
}
