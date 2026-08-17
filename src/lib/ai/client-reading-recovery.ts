/**
 * 해설 요청 실패 시 1회 재시도.
 * 서버 in-flight 락 / 캐시 hit 와 맞물려 "오류인데 이미 생성됨" VoC 를 줄인다.
 */

export async function fetchWithOneRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const res = await fetch(input, init)
    // 5xx·네트워크성만 재시도. 4xx(잔액·인증)는 즉시 반환.
    if (res.status < 500) return res
  } catch {
    // fall through to retry
  }
  await new Promise((r) => setTimeout(r, 800))
  return fetch(input, init)
}
