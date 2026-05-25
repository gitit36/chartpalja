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
 * macOS Apple Silicon에서 Node가 x86_64(Rosetta) 빌드로 실행되고 있는 경우,
 * spawn한 Python도 x86_64 모드로 강제되어 arm64-only로 빌드된 numpy
 * (`_multiarray_umath.cpython-39-darwin.so`)를 dlopen하지 못한다.
 * 이때는 `/usr/bin/arch -arm64`를 prefix해 Python을 명시적으로 arm64로 띄운다.
 */
function shouldForceArm64(): boolean {
  if (process.platform !== 'darwin') return false
  if (process.arch === 'arm64') return false  // 이미 arm64 Node면 불필요
  try {
    return fs.existsSync('/usr/bin/arch')
  } catch { return false }
}
const FORCE_ARM64 = shouldForceArm64()

/**
 * Run Python script once with input on stdin, return normalized report JSON.
 * Do not log birthDate/birthTime.
 */
export async function buildSajuReportViaPython(
  input: SajuReportInput
): Promise<Record<string, unknown>> {
  const projectRoot = process.cwd()
  const pythonServiceDir = path.join(projectRoot, 'python_service')
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
  console.log('[saju-report] Using Python:', PYTHON_CMD, FORCE_ARM64 ? '(arch -arm64)' : '')

  // cwd를 python_service로 두면 Python의 sys.path[0]이 python_service가 되어
  // 프로젝트 루트의 .py 파일들이 numpy/pandas import 경로를 흔드는 일이 없다.
  // (run_once.py와 saju_lib.py는 ROOT를 __file__로 계산하므로 cwd와 무관.)
  //
  // 부모(npm run dev)가 conda base 활성 셸에서 띄워진 경우 PYTHONHOME 등이
  // 자식에 전달되면 venv 인식이 깨진다. 부모 env는 유지하되 위험한 키만 제거한다.
  // 또한 user-site의 잘못된 패키지가 venv 패키지를 가리지 않도록 PYTHONNOUSERSITE=1.
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.PYTHONPATH
  delete env.PYTHONHOME
  delete env.CONDA_PREFIX
  delete env.CONDA_DEFAULT_ENV
  delete env.CONDA_PYTHON_EXE
  delete env.CONDA_SHLVL
  env.PYTHONDONTWRITEBYTECODE = '1'
  env.PYTHONNOUSERSITE = '1'
  const venvBin = path.dirname(PYTHON_CMD)
  env.VIRTUAL_ENV = path.dirname(venvBin)
  // venv bin이 PATH 최우선, anaconda 경로는 제거 (dyld 충돌 방지).
  const cleanedPath = (env.PATH ?? '')
    .split(':')
    .filter(p => p && !/anaconda|miniconda/i.test(p))
  env.PATH = [venvBin, ...cleanedPath].join(':')

  // arm64 강제가 필요하면 /usr/bin/arch -arm64 PYTHON_CMD ... 로 호출한다.
  const cmd = FORCE_ARM64 ? '/usr/bin/arch' : PYTHON_CMD
  const args = FORCE_ARM64 ? ['-arm64', PYTHON_CMD, 'run_once.py'] : ['run_once.py']

  const result = spawnSync(cmd, args, {
    input: inputStr,
    encoding: 'utf-8',
    cwd: pythonServiceDir,
    env,
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
