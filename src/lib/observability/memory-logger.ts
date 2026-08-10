/**
 * Lightweight periodic process.memoryUsage() logs for Railway.
 * Helps tell Node RSS growth apart from short-lived Python subprocess peaks.
 */

import {
  getPythonRunnerStats,
  PYTHON_MAX_CONCURRENCY,
} from '@/lib/saju/python-runner'

const INTERVAL_MS = Math.max(
  15_000,
  parseInt(process.env.MEMORY_LOG_INTERVAL_MS || '60000', 10) || 60_000,
)

let started = false
let interval: ReturnType<typeof setInterval> | null = null

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function logMemoryUsage(reason = 'interval'): void {
  const m = process.memoryUsage()
  const py = getPythonRunnerStats()
  console.log(
    `[mem] reason=${reason}` +
      ` rss=${mb(m.rss)}MB` +
      ` heapUsed=${mb(m.heapUsed)}MB` +
      ` heapTotal=${mb(m.heapTotal)}MB` +
      ` external=${mb(m.external)}MB` +
      ` arrayBuffers=${mb(m.arrayBuffers)}MB` +
      ` pythonActive=${py.active}` +
      ` pythonPeak=${py.peak}` +
      ` pythonMax=${PYTHON_MAX_CONCURRENCY}` +
      ` pythonTotal=${py.total}`,
  )
}

export function startMemoryUsageLogger(): void {
  if (started) return
  if (process.env.MEMORY_LOG_DISABLED === '1') return
  started = true
  logMemoryUsage('startup')
  interval = setInterval(() => logMemoryUsage('interval'), INTERVAL_MS)
  // Don't keep the process alive solely for logging
  if (typeof interval.unref === 'function') interval.unref()
}

export function stopMemoryUsageLogger(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
  started = false
}
