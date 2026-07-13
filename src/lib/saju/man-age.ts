/**
 * 만나이 (international age) — 서비스 전역 단일 기준.
 * 달력은 KST(UTC+9) 날짜로 본다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function kstYmd(d: Date): { y: number; m: number; day: number } {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  return {
    y: kst.getUTCFullYear(),
    m: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
  }
}

/** 'YYYY-MM-DD' / 'YYYY.MM.DD' / 앞부분만 잘린 문자열 파싱 */
export function parseBirthYmd(birthDate: string): { y: number; m: number; d: number } | null {
  const s = birthDate.trim().replace(/\./g, '-')
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (full) {
    const y = Number(full[1])
    const m = Number(full[2])
    const d = Number(full[3])
    if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return null
    return { y, m, d }
  }
  return null
}

/**
 * 오늘(KST) 기준 만나이.
 * 생일 월·일이 없으면 null (연도 차만으로는 만나이를 확정할 수 없음).
 */
export function calcManAge(birthDate: string, now: Date = new Date()): number | null {
  const b = parseBirthYmd(birthDate)
  if (!b) return null
  const t = kstYmd(now)
  let age = t.y - b.y
  if (t.m < b.m || (t.m === b.m && t.day < b.d)) age -= 1
  return Math.max(0, age)
}

/**
 * birthDate가 있으면 만나이, 없고 birthYear만 있으면 연도 차(그 해 생일 이후 만나이와 동일).
 * UI/대운 매칭용 fallback — 가능하면 전체 생년월일을 넘길 것.
 */
export function calcManAgeOrYearDiff(
  birthDate: string | null | undefined,
  birthYear: number,
  now: Date = new Date(),
): number {
  if (birthDate) {
    const age = calcManAge(birthDate, now)
    if (age != null) return age
  }
  const t = kstYmd(now)
  return Math.max(0, t.y - birthYear)
}

/**
 * 차트·해설에서 "YYYY년(만 N세)" 표기.
 * 사주 엔진 대운 나이와 같은 스케일: 그 해 생일에 맞는 만 나이 = year - birthYear.
 */
export function manAgeInCalendarYear(year: number, birthYear: number): number {
  return year - birthYear
}
