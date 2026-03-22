/**
 * 공통 사주 데이터 추출 함수 — fortune-prompt.ts / fortune-prompt-b.ts 에서 공유.
 */
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { elementToHangul, pillarToHangul, branchToHangul } from '@/lib/saju/hanja-hangul'

const TEN_GOD_KR: Record<string, string> = {
  "比肩": "비견", "劫財": "겁재", "食神": "식신", "傷官": "상관",
  "偏財": "편재", "正財": "정재", "七殺": "칠살", "偏官": "편관",
  "正官": "정관", "偏印": "편인", "正印": "정인", "일원": "일원",
}

export function tgKr(tg: string): string { return TEN_GOD_KR[tg] ?? tg }

export const PILLAR_NAMES = ['연주', '월주', '일주', '시주'] as const

export function extractPillarStrings(report: SajuReportJson) {
  const wonkuk = report.만세력_사주원국
  const format = (pillar: string | undefined) => {
    if (!pillar || pillar.length < 2) return ''
    return `${pillarToHangul(pillar)}(${pillar})`
  }
  return {
    yearPillar: format(wonkuk?.연주),
    monthPillar: format(wonkuk?.월주),
    dayPillar: format(wonkuk?.일주),
    hourPillar: format(wonkuk?.시주),
  }
}

export function extractGongmang(report: SajuReportJson): string {
  const gm = report.공망
  if (!gm) return '없음'
  const parts: string[] = []

  // 공망분류가 있으면 진공/가공 정보 활용
  const gmClassify = (report as Record<string, unknown>).공망분류 as Record<string, unknown> | undefined
  const allHits = (gmClassify?.all_hits ?? []) as Array<{ branch: string; pillar: string; type: string; 영역: string; source: string }>
  const hitTypeMap = new Map(allHits.map(h => [`${h.source}:${h.branch}`, h.type]))

  const dayBranches = gm.공망지지 as string[] | undefined
  if (dayBranches?.length) {
    const hangul = dayBranches.map(b => `${branchToHangul(b)}(${b})`).join('')
    const hits = (gm.원국_적중 ?? []) as string[]
    const hitParts = hits.map(b => {
      const gType = hitTypeMap.get(`일주공망:${b}`) ?? ''
      return `${branchToHangul(b)}(${b})${gType ? `[${gType}]` : ''}`
    })
    const hitStr = hitParts.length > 0 ? ` [원국 적중: ${hitParts.join(', ')}]` : ''
    parts.push(`[일주공망] ${hangul}${hitStr}`)
  }

  const yearBranches = gm.년주_공망지지 as string[] | undefined
  if (yearBranches?.length) {
    const hangul = yearBranches.map(b => `${branchToHangul(b)}(${b})`).join('')
    const hits = (gm.년주_원국_적중 ?? []) as string[]
    const hitParts = hits.map(b => {
      const gType = hitTypeMap.get(`년주공망:${b}`) ?? ''
      return `${branchToHangul(b)}(${b})${gType ? `[${gType}]` : ''}`
    })
    const hitStr = hitParts.length > 0 ? ` [원국 적중: ${hitParts.join(', ')}]` : ''
    parts.push(`[년주공망] ${hangul}${hitStr}`)
  }

  return parts.length > 0 ? parts.join(' / ') : '없음'
}

export function extractSipseongDetails(report: SajuReportJson): string {
  const detail = report.오행십성_상세
  if (!detail) return ''
  const cheongan = detail.천간 ?? []
  const jiji = detail['지지(지장간포함)'] ?? detail.지지_지장간포함 ?? []
  const parts: string[] = []
  for (let i = 0; i < 4; i++) {
    const name = PILLAR_NAMES[i]
    const stem = cheongan[i]
    const branch = jiji[i]
    const stemTg = stem?.ten_god ? tgKr(stem.ten_god) : ''
    const hsArr = branch?.hidden_stems ?? []
    const lastTg = hsArr.length ? hsArr[hsArr.length - 1]?.ten_god : undefined
    const branchTg = lastTg ? tgKr(lastTg) : ''
    const items = [stemTg, branchTg].filter(Boolean).join('/')
    if (items) parts.push(`${name}: ${items}`)
  }
  return parts.join(', ')
}

export function extractInteractions(report: SajuReportJson): string {
  const rel = report.사주관계 as Record<string, unknown> | undefined
  if (!rel) return '없음'
  const parts: string[] = []
  const pairs = rel.쌍별관계 as Array<{ between?: string; relations?: string[] }> | undefined
  if (Array.isArray(pairs)) {
    for (const pair of pairs) {
      if (!pair.relations?.length) continue
      const simplified = pair.relations.map(r => {
        let s = r.replace(/[\(（][^)）]*[\)）]/g, '').trim()
        for (const [hanja, hangul] of Object.entries(
          { '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무', '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
            '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해' }
        )) { s = s.replaceAll(hanja, hangul) }
        return s
      })
      parts.push(...simplified)
    }
  }
  const multi = rel.다지지관계 as Array<{ name?: string; description?: string }> | undefined
  if (Array.isArray(multi)) {
    for (const item of multi) {
      if (item.name || item.description) parts.push(item.description || item.name || '')
    }
  }
  return parts.length ? parts.join(', ') : '특이 관계 없음'
}

export function extractShinsalWithLocation(report: SajuReportJson): string {
  const shinsal = report.신살길성
  if (!shinsal || typeof shinsal !== 'object') return ''
  const wonkuk = report.만세력_사주원국
  const branchToPillar: Record<string, string[]> = {}
  if (wonkuk) {
    for (const pk of PILLAR_NAMES) {
      const p = wonkuk[pk]
      const branch = p?.[1]
      if (branch) {
        if (!branchToPillar[branch]) branchToPillar[branch] = []
        branchToPillar[branch]!.push(pk)
      }
    }
  }
  const items: string[] = []
  for (const [name, targets] of Object.entries(shinsal)) {
    if (!name) continue
    const hangulName = name.replace(/[\(（][^)）]*[\)）]/g, '').trim()
    const locs: string[] = []
    if (Array.isArray(targets)) {
      for (const t of targets) {
        const branch = typeof t === 'string' ? t : ''
        const pillars = branchToPillar[branch]
        if (pillars) locs.push(...pillars)
      }
    }
    const locStr = locs.length ? `[${locs.join(',')}]` : ''
    items.push(`${hangulName}${locStr}`)
    if (items.length >= 12) break
  }
  return items.join(', ')
}

export function extract12UnseongDetails(report: SajuReportJson): string {
  const detail = report.오행십성_상세
  if (!detail) return ''
  const jiji = detail['지지(지장간포함)'] ?? detail.지지_지장간포함 ?? []
  const parts: string[] = []
  for (let i = 0; i < 4; i++) {
    const name = PILLAR_NAMES[i]
    const branch = jiji[i]
    const unseong = branch?.['12운성']
    if (unseong) parts.push(`${name}: ${unseong}`)
  }
  return parts.join(', ')
}

export function extractJijangganDetails(report: SajuReportJson): string {
  const detail = report.오행십성_상세
  if (!detail) return ''
  const jiji = detail['지지(지장간포함)'] ?? detail.지지_지장간포함 ?? []
  const parts: string[] = []
  for (let i = 0; i < 4; i++) {
    const name = PILLAR_NAMES[i]
    const branch = jiji[i]
    const hidden = branch?.hidden_stems
    if (hidden?.length) {
      const hs = hidden.map(h => {
        const tg = h.ten_god ? tgKr(h.ten_god) : ''
        return tg ? `${h.stem ?? ''}(${tg})` : h.stem ?? ''
      }).join('\u00B7')
      parts.push(`${name}: ${hs}`)
    }
  }
  return parts.join(', ')
}

export function extractGungseongRon(chartPayload: ChartPayload | undefined): string {
  const gs = chartPayload?.궁성론
  if (!Array.isArray(gs) || !gs.length) return ''
  const lines: string[] = []
  for (const g of gs) {
    const gung = g as unknown as Record<string, unknown>
    const pillar = gung['궁'] ?? ''
    const role = gung['궁성'] ?? ''
    const stemTg = gung['천간십성'] ?? ''
    const branchTg = gung['지지십성'] ?? ''
    const unseong = gung['12운성'] ?? ''
    const isGongmang = gung['공망여부'] === true
    const jijanggan = (gung['지장간십성'] as Array<{ 간: string; 십성: string }> | undefined) ?? []
    const jjg = jijanggan.map(j => `${j.간}(${tgKr(j.십성)})`).join('\u00B7')
    const notes = (gung['특이사항'] as string[] | undefined) ?? []
    let line = `- ${pillar}(${role}): 천간 ${stemTg}, 지지 ${branchTg}, 12운성 ${unseong}`
    if (jjg) line += `, 지장간[${jjg}]`
    if (isGongmang) line += ' [공망]'
    if (notes.length) line += `\n  \u2192 ${notes.join(', ')}`
    lines.push(line)
  }
  return lines.join('\n')
}
