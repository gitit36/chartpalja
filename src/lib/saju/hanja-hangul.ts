/**
 * 한자(천간·지지·오행) → 한글 읽기 및 오행별 색상 (점신 스타일)
 */
export const STEM_HANGUL: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
}

export const BRANCH_HANGUL: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진',
  '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유',
  '戌': '술', '亥': '해',
}

export const ELEMENT_HANGUL: Record<string, string> = {
  '木': '목', '火': '화', '土': '토', '金': '금', '水': '수',
}

/** 천간 → 오행 (사주 표준) */
export const STEM_ELEMENT: Record<string, string> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土',
  '庚': '金', '辛': '金', '壬': '水', '癸': '水',
}

/** 지지 → 오행 */
export const BRANCH_ELEMENT: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
  '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
}

/** 오행 한자 → 연한 배경 + 진한 테두리/글자 (스크린샷 벤치마크: 항상 잘 보이게) */
export const ELEMENT_BG: Record<string, string> = {
  '木': 'bg-green-50 border-2 border-green-500 text-green-800',
  '火': 'bg-red-50 border-2 border-red-500 text-red-800',
  '土': 'bg-amber-50 border-2 border-amber-500 text-amber-900',
  '金': 'bg-gray-100 border-2 border-gray-500 text-gray-800',
  '水': 'bg-blue-50 border-2 border-blue-600 text-blue-900',
}

export function stemToHangul(hanja: string): string {
  return STEM_HANGUL[hanja] ?? hanja
}

export function branchToHangul(hanja: string): string {
  return BRANCH_HANGUL[hanja] ?? hanja
}

export function elementToHangul(hanja: string): string {
  return ELEMENT_HANGUL[hanja] ?? hanja
}

/** 천간 한자 → "한글,오행한글" (예: 辛 → "신,쇠金") - 점신 스타일 */
export function stemLabel(hanja: string, elementHanja: string): string {
  const h = stemToHangul(hanja)
  const e = elementToHangul(elementHanja)
  return `${h},${e}${elementHanja}`
}

/** 지지 한자 → "한글,오행한글" (예: 丑 → "축,흙土") */
export function branchLabel(hanja: string, elementHanja: string): string {
  const h = branchToHangul(hanja)
  const e = elementToHangul(elementHanja)
  const earth = elementHanja === '土' ? '흙' : e
  return `${h},${earth}${elementHanja}`
}

/** 기둥 한자 2글자 → 한글 읽기 (예: 甲子 → 갑자) */
export function pillarToHangul(pillar: string): string {
  if (!pillar || pillar.length < 2) return pillar
  const s = stemToHangul(pillar[0]!)
  const b = branchToHangul(pillar[1]!)
  return `${s}${b}`
}
