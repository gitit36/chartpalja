/**
 * Saju computation via Python one-off script (saju_engine.py + saju_lib).
 * No Python server. Server-side only: call from API routes.
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

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

function resolvePythonCmd(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH
  const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python3')
  try {
    if (fs.existsSync(venvPython)) return venvPython
  } catch { /* ignore */ }
  return 'python3'
}
const PYTHON_CMD = resolvePythonCmd()

/**
 * Run Python script once with input on stdin, return normalized report JSON.
 * Do not log birthDate/birthTime.
 */
export async function buildSajuReportViaPython(
  input: SajuReportInput
): Promise<Record<string, unknown>> {
  const cwd = process.cwd()
  const scriptPath = path.join(cwd, 'python_service', 'run_once.py')
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
  console.log('[saju-report] Using Python:', PYTHON_CMD)
  const result = spawnSync(PYTHON_CMD, [scriptPath], {
    input: inputStr,
    encoding: 'utf-8',
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.error) {
    throw new Error(`Python not available: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'Unknown error'
    console.error('[saju-report] Python stderr:', stderr)
    throw new Error(`Python Saju script failed: ${stderr}`)
  }
  const stdout = result.stdout?.trim()
  if (!stdout) {
    throw new Error('Python Saju script produced no output')
  }
  try {
    return JSON.parse(stdout) as Record<string, unknown>
  } catch {
    throw new Error('Python Saju script returned invalid JSON')
  }
}
