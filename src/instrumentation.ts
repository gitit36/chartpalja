/**
 * Next.js instrumentation — runs once when the Node server starts.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startMemoryUsageLogger } = await import('@/lib/observability/memory-logger')
  startMemoryUsageLogger()
}
