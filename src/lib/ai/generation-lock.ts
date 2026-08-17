/**
 * In-process generation lock.
 * Same key → concurrent callers share one promise (no double Gemini / double charge).
 * Railway multi-replica 에서는 프로세스마다 별도라 완벽하진 않지만, 더블탭·재시도에는 효과적.
 */

type LockRecord = {
  promise: Promise<unknown>
  startedAt: number
}

const locks = new Map<string, LockRecord>()

/** 오래된 락이 Map에 남는 경우 대비 (비정상 abort) */
const LOCK_TTL_MS = 5 * 60 * 1000

function sweepStale(now = Date.now()) {
  for (const [k, v] of locks) {
    if (now - v.startedAt > LOCK_TTL_MS) locks.delete(k)
  }
}

/**
 * Run `fn` under an exclusive lock for `key`.
 * If another call is already running the same key, await its result instead of starting a new job.
 */
export async function withGenerationLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  sweepStale()
  const existing = locks.get(key)
  if (existing) {
    return existing.promise as Promise<T>
  }

  let release!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    release = res
    reject = rej
  })
  locks.set(key, { promise, startedAt: Date.now() })

  try {
    const value = await fn()
    release(value)
    return value
  } catch (err) {
    reject(err)
    throw err
  } finally {
    const cur = locks.get(key)
    if (cur?.promise === promise) locks.delete(key)
  }
}

export function generationLockKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((p) => (p == null || p === '' ? '_' : String(p))).join(':')
}
