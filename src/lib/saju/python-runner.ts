/**
 * Shared one-off Python runner for the Saju engine.
 *
 * Spawns `python_service/<script>` with a JSON string on stdin and returns the
 * trimmed stdout. Both the chart report (run_once.py) and the daily-fortune
 * batch (daily_once.py) go through here so env/architecture handling stays in
 * one place.
 *
 * Concurrency: spawnSync blocks the Node event loop, so a single Next process
 * can only run one Python child at a time. We still track active/peak and
 * enforce PYTHON_MAX_CONCURRENCY (default 1) for observability and safety if
 * the runner is later switched to async spawn.
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

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
 * spawn한 Python도 x86_64 모드로 강제되어 arm64-only로 빌드된 numpy를
 * dlopen하지 못한다. 이때는 `/usr/bin/arch -arm64`를 prefix해 Python을 arm64로 띄운다.
 */
function shouldForceArm64(): boolean {
  if (process.platform !== 'darwin') return false
  if (process.arch === 'arm64') return false
  try {
    return fs.existsSync('/usr/bin/arch')
  } catch { return false }
}
const FORCE_ARM64 = shouldForceArm64()

/** Max concurrent Python children (default 1). spawnSync already serializes. */
export const PYTHON_MAX_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.PYTHON_MAX_CONCURRENCY || '1', 10) || 1,
)

let pythonActive = 0
let pythonPeak = 0
let pythonTotal = 0

export function getPythonRunnerStats(): {
  active: number
  peak: number
  total: number
  max: number
} {
  return {
    active: pythonActive,
    peak: pythonPeak,
    total: pythonTotal,
    max: PYTHON_MAX_CONCURRENCY,
  }
}

function buildEnv(): NodeJS.ProcessEnv {
  // 부모(npm run dev)가 conda base 활성 셸에서 띄워졌을 때 PYTHONHOME 등이
  // 자식에 전달되면 venv 인식이 깨진다. 부모 env는 유지하되 위험한 키만 제거한다.
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
  const cleanedPath = (env.PATH ?? '')
    .split(':')
    .filter(p => p && !/anaconda|miniconda/i.test(p))
  env.PATH = [venvBin, ...cleanedPath].join(':')
  return env
}

/** Re-emit `[python-mem] ...` lines from child stderr into Node logs. */
function forwardPythonMemLogs(stderr: string | Buffer | null | undefined, scriptName: string): void {
  if (!stderr) return
  const text = typeof stderr === 'string' ? stderr : stderr.toString('utf-8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('[python-mem]')) continue
    // Keep the stable prefix; add script for correlation with [mem] after-python lines.
    console.log(`${trimmed} script=${scriptName}`)
  }
}

/**
 * Run a python_service script once with `inputStr` on stdin.
 * Returns trimmed stdout. Throws on spawn error / non-zero exit / empty output.
 */
export function runPythonScript(
  scriptName: string,
  inputStr: string,
  opts?: { timeoutMs?: number },
): string {
  if (pythonActive >= PYTHON_MAX_CONCURRENCY) {
    // With spawnSync this should be unreachable (event loop blocked). Log loudly
    // if it ever happens (e.g. after an async-spawn migration).
    console.warn(
      `[python-runner] concurrency limit reached active=${pythonActive} max=${PYTHON_MAX_CONCURRENCY} script=${scriptName}`,
    )
  }

  const pythonServiceDir = path.join(process.cwd(), 'python_service')

  const cmd = FORCE_ARM64 ? '/usr/bin/arch' : PYTHON_CMD
  const args = FORCE_ARM64 ? ['-arm64', PYTHON_CMD, scriptName] : [scriptName]

  pythonActive += 1
  pythonTotal += 1
  if (pythonActive > pythonPeak) pythonPeak = pythonActive
  const t0 = Date.now()
  try {
    const result = spawnSync(cmd, args, {
      input: inputStr,
      encoding: 'utf-8',
      cwd: pythonServiceDir,
      env: buildEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: opts?.timeoutMs,
    })
    if (result.error) {
      throw new Error(`Python not available: ${result.error.message}`)
    }
    // Forward Python peak-RSS lines even on success (stdout stays the JSON payload).
    forwardPythonMemLogs(result.stderr, scriptName)
    if (result.status !== 0) {
      const stderr = result.stderr?.trim() || 'Unknown error'
      console.error(`[python-runner] ${scriptName} stderr:`, stderr)
      throw new Error(`Python script failed (${scriptName}): ${stderr}`)
    }
    const stdout = result.stdout?.trim()
    if (!stdout) {
      throw new Error(`Python script produced no output (${scriptName})`)
    }
    return stdout
  } finally {
    pythonActive = Math.max(0, pythonActive - 1)
    const ms = Date.now() - t0
    // Correlate Railway Memory spikes: log Node RSS right after Python exits
    // (event loop was blocked during spawnSync, so interval logs won't fire mid-run).
    if (ms >= 1000) {
      const m = process.memoryUsage()
      const toMb = (n: number) => (n / (1024 * 1024)).toFixed(1)
      console.log(
        `[mem] reason=after-python script=${scriptName} ms=${ms}` +
          ` rss=${toMb(m.rss)}MB heapUsed=${toMb(m.heapUsed)}MB` +
          ` external=${toMb(m.external)}MB` +
          ` pythonActive=${pythonActive} pythonPeak=${pythonPeak}`,
      )
    }
  }
}

export function isForcingArm64(): boolean {
  return FORCE_ARM64
}

export function pythonCmd(): string {
  return PYTHON_CMD
}
