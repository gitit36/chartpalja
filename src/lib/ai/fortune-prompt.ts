import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, YearlyDatum, ScoreBreakdown, TrineHit, GongmangFactors } from '@/types/chart'
import { elementToHangul, pillarToHangul, branchToHangul } from '@/lib/saju/hanja-hangul'
import type { ChartDatum, TransitionYear, ThreeYearContext, LifetimeSummary } from '@/lib/saju/life-chart-data'
import { extractTransitionYears, extract3YearContext, extractLifetimeSummary } from '@/lib/saju/life-chart-data'

const TEN_GOD_KR: Record<string, string> = {
  "比肩": "비견", "劫財": "겁재", "食神": "식신", "傷官": "상관",
  "偏財": "편재", "正財": "정재", "七殺": "칠살", "偏官": "편관",
  "正官": "정관", "偏印": "편인", "正印": "정인", "일원": "일원",
}

function tgKr(tg: string): string { return TEN_GOD_KR[tg] ?? tg }

const PILLAR_NAMES = ['연주', '월주', '일주', '시주'] as const

function extractPillarStrings(report: SajuReportJson) {
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

function extractGongmang(report: SajuReportJson): string {
  const gm = report.공망
  if (!gm?.공망지지) return '없음'
  const branches = gm.공망지지 as string[]
  const hangul = branches.map(b => `${branchToHangul(b)}(${b})`).join('')
  const hits = (gm.원국_적중 ?? []) as string[]
  if (hits.length > 0) {
    const hitStr = hits.map(b => `${branchToHangul(b)}(${b})`).join(', ')
    return `${hangul} [원국 적중: ${hitStr}]`
  }
  return hangul
}

function extractSipseongDetails(report: SajuReportJson): string {
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

function extractInteractions(report: SajuReportJson): string {
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

function extractShinsalWithLocation(report: SajuReportJson): string {
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


function extract12UnseongDetails(report: SajuReportJson): string {
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

function extractJijangganDetails(report: SajuReportJson): string {
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

const BREAKDOWN_LABELS: Record<string, string> = {
  yongshin_fit: '용신부합',
  unseong: '12운성',
  unseong_context: '12운성맥락',
  relations: '관계(합충)',
  trine: '삼합/방합',
  balance: '오행균형',
  shinsal: '신살',
  base: '기본',
}

function formatBreakdownTop3(bd: ScoreBreakdown | undefined): string {
  if (!bd) return ''
  const entries = Object.entries(bd)
    .filter(([k]) => k !== 'base')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
  if (!entries.length) return ''
  return entries.map(([k, v]) => {
    const label = BREAKDOWN_LABELS[k] ?? k
    return `${label} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`
  }).join(', ')
}

function formatTrineHits(hits: TrineHit[] | undefined): string {
  if (!hits?.length) return ''
  return hits.map(h => `${h.type}(${h.name}/${elementToHangul(h.element)})`).join(', ')
}

function formatGongmang(gm: GongmangFactors | undefined): string {
  if (!gm || !gm.is_gongmang) return ''
  const typeStr = gm.gongmang_type ? `(${gm.gongmang_type})` : ''
  return `공망${typeStr} 감쇠 [12운성×${gm.unseong}, 관계×${gm.rel}, 용신지지×${gm.yfit_branch}]`
}

function formatHaegong(haegong: { resolved: Array<{ branch: string; pillar: string; method: string; 영역: string }>; bonus: number } | undefined): string {
  if (!haegong?.resolved?.length) return ''
  const parts = haegong.resolved.map(r => `${r.pillar}(${r.branch}) ${r.method}해공→${r.영역} 활성화`)
  return `해공: ${parts.join(', ')} (보너스 +${haegong.bonus})`
}

function formatShinsalAdj(adj: Record<string, number> | undefined): string {
  if (!adj) return ''
  const entries = Object.entries(adj).filter(([, v]) => v !== 0)
  if (!entries.length) return ''
  return entries.map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')
}

function extractGungseongRon(chartPayload: ChartPayload | undefined): string {
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

function extractDaewoonSummary(chartPayload: ChartPayload | undefined): string {
  const dw = chartPayload?.대운기둥10
  if (!Array.isArray(dw) || !dw.length) return ''
  return dw.map(d => {
    const pillar = d.daewoon_pillar ? `${pillarToHangul(d.daewoon_pillar)}(${d.daewoon_pillar})` : ''
    const season = (d as unknown as Record<string, unknown>)['시즌태그'] as Record<string, string> | undefined
    const seasonStr = season?.tag ?? ''
    const bdStr = formatBreakdownTop3(d.breakdown)
    const trStr = formatTrineHits(d.trine_hits)
    const gmStr = d.gongmang_factors?.is_gongmang ? `[공망${d.gongmang_factors.gongmang_type ? `(${d.gongmang_factors.gongmang_type})` : ''}]` : ''
    const hgStr = formatHaegong((d as unknown as Record<string, unknown>).haegong as Parameters<typeof formatHaegong>[0])
    let line = `- ${d.start_year}~${d.end_year}년(${d.start_age_years}~${d.end_age_years}세): ${pillar} ${d['등급']}등급 ${d['종합운점수']}점 ${seasonStr}`
    if (bdStr) line += ` (${bdStr})`
    if (trStr) line += ` ${trStr}`
    if (gmStr) line += ` ${gmStr}`
    if (hgStr) line += ` ${hgStr}`
    return line
  }).join('\n')
}

interface CurrentYearDetail {
  score: number
  breakdown: ScoreBreakdown
  sewoonPillar: string; sewoonTgStem: string; sewoonTgBranch: string
  sewoonStemElement: string; sewoonBranchElement: string; sewoon12unseong: string
  candleOpen: number; candleClose: number; candleHigh: number; candleLow: number; candleType: string
  domainJob: number; domainWealth: number; domainHealth: number; domainLove: number; domainMarriage: number
  yongshinPower: number; energyTotal: number; energyDirection: number; energyKeys: string[]
  noblePower: number; ohangBalance: number; unseongCurve: number
  tengoBalance: Record<string, number>
  sewoonRelsOrig: string; sewoonRelsDw: string; sewoonIljuRel: string
  gilshin: string; hyungshal: string
  eventCareer: number; eventLove: number; eventHealth: number
  eventWealth: number; eventStudy: number; eventConflict: number
  seasonTag: string; seasonEmoji: string; seasonDesc: string
  daewoonTransition: string
  breakdownStr: string
  trineStr: string
  gongmangStr: string
  haegongStr: string
  shinsalAdjStr: string
}

function extractCurrentYearDetail(chartPayload: ChartPayload | undefined, year: number): CurrentYearDetail | null {
  if (!chartPayload?.연도별_타임라인?.length) return null
  const yd = chartPayload.연도별_타임라인.find(d => d.year === year)
  if (!yd) return null

  const ind = yd.indicators
  const ev = yd['이벤트확률'] ?? {} as Record<string, number>
  const season = yd['시즌태그'] ?? {} as Record<string, string>
  const candle = yd.candle ?? { open: 0, close: 0, high: 0, low: 0, type: '' }
  const energy = ind['에너지장'] ?? { total: 0, direction: 0, keys: [] }
  const tengo = ind['십성밸런스'] ?? { 비겁: 0, 식상: 0, 재성: 0, 관살: 0, 인성: 0 }

  const origRels = (yd['세운_관계_with_원국'] ?? []) as Array<{ with?: string; relations?: string[] }>
  const origStr = origRels.map(r => `${r.with ?? ''}: ${(r.relations ?? []).join(', ')}`).join(' / ')

  const dwRels = (yd['세운_관계_with_대운'] ?? []) as string[]
  const iljuRels = ((yd as unknown as Record<string, unknown>)['세운_일주관계'] ?? []) as string[]
  const dwTransition = (yd as unknown as Record<string, unknown>)['대운전환기'] as Record<string, unknown> | undefined

  let transStr = '해당없음'
  if (dwTransition?.['전환기'] === true) {
    const prevDw = dwTransition['이전대운'] as string | null
    const newDw = dwTransition['신규대운'] as string
    const transYear = dwTransition['전환연도'] as number
    transStr = `${transYear}년 대운교체 (${prevDw ? pillarToHangul(prevDw) : '?'}\u2192${pillarToHangul(newDw)})`
  }

  return {
    score: yd.scores?.['종합'] ?? 50,
    breakdown: (yd.breakdown ?? {}) as ScoreBreakdown,
    sewoonPillar: yd['세운_pillar'] ? `${pillarToHangul(yd['세운_pillar'])}(${yd['세운_pillar']})` : '',
    sewoonTgStem: tgKr(yd['세운_십성_천간'] ?? ''),
    sewoonTgBranch: tgKr(yd['세운_십성_지지'] ?? ''),
    sewoonStemElement: yd['세운_stemElement'] ? elementToHangul(yd['세운_stemElement']) : '',
    sewoonBranchElement: yd['세운_branchElement'] ? elementToHangul(yd['세운_branchElement']) : '',
    sewoon12unseong: yd['세운_12운성'] ?? '',
    candleOpen: candle.open, candleClose: candle.close, candleHigh: candle.high, candleLow: candle.low,
    candleType: candle.type,
    domainJob: yd.scores?.['직업'] ?? 0, domainWealth: yd.scores?.['재물'] ?? 0,
    domainHealth: yd.scores?.['건강'] ?? 0, domainLove: yd.scores?.['연애'] ?? 0,
    domainMarriage: yd.scores?.['결혼'] ?? 0,
    yongshinPower: ind['용신력'] ?? 0,
    energyTotal: energy.total ?? 0, energyDirection: energy.direction ?? 0,
    energyKeys: energy.keys ?? [],
    noblePower: ind['귀인력'] ?? 0, ohangBalance: ind['오행균형도'] ?? 0,
    unseongCurve: ind['12운성곡선'] ?? 0,
    tengoBalance: { ...tengo } as Record<string, number>,
    sewoonRelsOrig: origStr || '없음', sewoonRelsDw: dwRels.join(', ') || '없음',
    sewoonIljuRel: iljuRels.join(', ') || '없음',
    gilshin: (yd['세운_신살_길신'] ?? []).join(', ') || '없음',
    hyungshal: (yd['세운_신살_흉살'] ?? []).join(', ') || '없음',
    eventCareer: ev['이직_전환'] ?? 0, eventLove: ev['연애_결혼'] ?? 0,
    eventHealth: ev['건강_주의'] ?? 0, eventWealth: ev['재물_기회'] ?? 0,
    eventStudy: ev['학업_시험'] ?? 0, eventConflict: ev['대인_갈등'] ?? 0,
    seasonTag: season.tag ?? '', seasonEmoji: season.emoji ?? '', seasonDesc: season.desc ?? '',
    daewoonTransition: transStr,
    breakdownStr: formatBreakdownTop3(yd.breakdown),
    trineStr: formatTrineHits(yd.trine_hits),
    gongmangStr: formatGongmang(yd.gongmang_factors),
    haegongStr: formatHaegong(yd.haegong),
    shinsalAdjStr: formatShinsalAdj(yd.shinsal_context_adj),
  }
}

function extractCoreData(report: SajuReportJson, opts?: { birthYear?: number }) {
  const { yearPillar, monthPillar, dayPillar, hourPillar } = extractPillarStrings(report)

  const geokgukRaw = report.격국
  let geokguk = '', geokgukType = '', geokgukNote = ''
  if (geokgukRaw) {
    if (typeof geokgukRaw === 'string') { geokguk = geokgukRaw }
    else {
      geokguk = (geokgukRaw as Record<string, string>).격국 ?? (geokgukRaw as Record<string, string>).격국명 ?? ''
      geokgukType = (geokgukRaw as Record<string, string>).격국유형 ?? ''
      geokgukNote = (geokgukRaw as Record<string, string>).비고 ?? ''
    }
  }

  const ss = report.신강신약
  const ssScore = ss?.score ?? ''
  const ssVerdict = ss?.판정 ?? ''
  const yh = report.용신희신
  const yongStr = yh?.용신 ? `${elementToHangul(yh.용신)}(${yh.용신})` : ''
  const heuiRaw = yh?.희신
  const heuiStr = heuiRaw
    ? Array.isArray(heuiRaw) ? heuiRaw.map(h => `${elementToHangul(h)}(${h})`).join(', ')
      : `${elementToHangul(heuiRaw as string)}(${heuiRaw})`
    : ''
  const gishinRaw = yh?.기신
  const gishinStr = gishinRaw
    ? Array.isArray(gishinRaw) ? gishinRaw.map(g => `${elementToHangul(g)}(${g})`).join(', ')
      : `${elementToHangul(gishinRaw as string)}(${gishinRaw})`
    : ''

  const gongmang = extractGongmang(report)
  const sipseongDetails = extractSipseongDetails(report)
  const interactions = extractInteractions(report)
  const shinsalNames = extractShinsalWithLocation(report)
  const unseong12Details = extract12UnseongDetails(report)
  const jijangganDetails = extractJijangganDetails(report)

  const ohangRaw = report.오행분포 as Record<string, number> | undefined
  const ohangStr = ohangRaw
    ? Object.entries(ohangRaw).map(([k, v]) => `${elementToHangul(k)}(${k}): ${v}`).join(', ')
    : ''

  const patternRaw = report.패턴점수
  const patternScore = typeof patternRaw === 'number'
    ? patternRaw : (patternRaw as Record<string, unknown> | undefined)?.총점 ?? ''

  const domainRaw = report.DomainScore as Record<string, unknown> | undefined
  const domainScores = domainRaw?.점수 as Record<string, number> | undefined
  const domainStr = domainScores
    ? Object.entries(domainScores).map(([k, v]) => `${k}: ${v}`).join(', ') : ''

  const daewoon = report.대운?.대운기둥10
  const inp = report.입력정보 ?? {}
  const rawBd = (inp as Record<string, unknown>).birth_date
  const bdSlice = typeof rawBd === 'string' ? rawBd.slice(0, 4) : '1990'
  const birthYear = opts?.birthYear ?? parseInt(String((inp as Record<string, unknown>).year ?? bdSlice), 10)
  const currentAge = new Date().getFullYear() - birthYear
  const currentDW = daewoon?.find(b =>
    (b.start_age_years ?? 0) <= currentAge && currentAge <= (b.end_age_years ?? 0)
  )
  const dwStr = currentDW
    ? `${pillarToHangul(currentDW.daewoon_pillar ?? '')}(${currentDW.daewoon_pillar}) ${currentDW.start_age_years}~${currentDW.end_age_years}세`
    : ''

  const currentYear = new Date().getFullYear()
  const sewoon = report.세운
  let swStr = ''
  if (sewoon) {
    const yearly = sewoon.연도별 ?? sewoon
    if (yearly && typeof yearly === 'object') {
      const raw = (yearly as Record<string, string>)[String(currentYear)] ?? ''
      swStr = raw ? `${pillarToHangul(raw)}(${raw})` : ''
    }
  }

  const chartPayload = report.chartData as ChartPayload | undefined

  return {
    yearPillar, monthPillar, dayPillar, hourPillar,
    geokguk, geokgukType, geokgukNote,
    ssScore, ssVerdict, yongStr, heuiStr, gishinStr,
    gongmang, sipseongDetails, interactions, shinsalNames,
    unseong12Details, jijangganDetails,
    ohangStr, patternScore, domainStr,
    dwStr, swStr, currentYear, birthYear, chartPayload,
  }
}

export interface ChartSummary {
  peakYear: number
  peakScore: number
  valleyYear: number
  valleyScore: number
  currentScore: number
  currentSeason: string
  currentSeasonDesc: string
  nextBigShift: string
  scoreRange: string
  topYears: string
  lowYears: string
  trend5y: string
}

export function buildFortunePrompt(
  report: SajuReportJson,
  opts?: { birthYear?: number; chartData?: ChartDatum[]; job?: string | null },
  chart?: ChartSummary
): string {
  const d = extractCoreData(report, opts)
  const chartData = opts?.chartData
  const currentYear = d.currentYear

  // ── 원국 raw data block (토큰 압축: 핵심만) ──
  const meta = d.chartPayload?.meta
  let johuBlock = ''
  if (meta?.johu) {
    const j = meta.johu as Record<string, string>
    if (j['조후_주용신']) {
      johuBlock = `\n- 조후용신: ${elementToHangul(j['조후_주용신'])}(${j['조후_주용신']})${j['조후_보조용신'] ? ` / 보조: ${elementToHangul(j['조후_보조용신'])}(${j['조후_보조용신']})` : ''}`
    }
  }
  if (meta?.tonggwan) {
    const t = meta.tonggwan as Record<string, string>
    if (t['통관_오행']) johuBlock += `\n- 통관용신: ${elementToHangul(t['통관_오행'])}(${t['통관_오행']})`
  }
  const confidenceStr = meta?.confidence ? ` / 확신도: ${meta.confidence}` : ''

  const gungseongBlock = extractGungseongRon(d.chartPayload)
  const daewoonSummary = extractDaewoonSummary(d.chartPayload)
  const cy = extractCurrentYearDetail(d.chartPayload, currentYear)

  // ── 3년 맥락 (작년/올해/내년) ──
  const threeYear = chartData ? extract3YearContext(chartData, currentYear) : null
  const transitions = chartData ? extractTransitionYears(chartData) : []
  const lifetime = chartData ? extractLifetimeSummary(chartData) : null

  let threeYearBlock = ''
  if (threeYear) {
    const fmt = (label: string, cd: ChartDatum | null) => {
      if (!cd) return ''
      const bd = formatBreakdownTop3(cd.breakdown)
      return `- ${label} ${cd.year}년: ${Math.round(cd.score)}점, 시즌 ${cd.seasonTag}${bd ? ` [${bd}]` : ''}`
    }
    threeYearBlock = `
## 3년 흐름 (${threeYear.trendLabel})
${fmt('작년', threeYear.prev)}
${fmt('올해', threeYear.current)}
${fmt('내년', threeYear.next)}`
  }

  let transitionBlock = ''
  if (transitions.length) {
    const top = transitions.slice(0, 8)
    transitionBlock = `
## 인생 전환점 (대운교체/최고점/최저점)
${top.map(t => `- ${t.year}년(만 ${t.age}세): ${t.reason}`).join('\n')}`
  }

  let lifetimeBlock = ''
  if (lifetime) {
    lifetimeBlock = `
## 인생 전반 통계
- 평균 점수: ${lifetime.avgScore}점 / 최고: ${lifetime.peakYear}년(${lifetime.peakScore}점) / 최저: ${lifetime.valleyYear}년(${lifetime.valleyScore}점)
- 주요 시즌: ${lifetime.topSeasons.join(', ')}
- 대운 ${lifetime.daewoonCount}개 블록`
  }

  // ── 올해 상세 (토큰 압축: top 지표만) ──
  let currentYearBlock = ''
  if (cy) {
    const tengoStr = Object.entries(cy.tengoBalance)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, v]) => `${k} ${v}`).join(', ')
    const evtParts = [
      cy.eventCareer > 40 ? `이직 ${cy.eventCareer}%` : '',
      cy.eventLove > 40 ? `연애 ${cy.eventLove}%` : '',
      cy.eventHealth > 40 ? `건강위험 ${cy.eventHealth}%` : '',
      cy.eventWealth > 40 ? `재물기회 ${cy.eventWealth}%` : '',
      cy.eventConflict > 40 ? `갈등 ${cy.eventConflict}%` : '',
    ].filter(Boolean).join(', ')
    const bdEntries = Object.entries(cy.breakdown ?? {}).filter(([k]) => k !== 'base').sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    const topUp = bdEntries.find(([, v]) => v > 0)
    const topDown = bdEntries.find(([, v]) => v < 0)
    const scoreFraming = `올해 종합 ${cy.score}점${topUp ? ` (가장 큰 상승 요인: ${topUp[0]})` : ''}${topDown ? ` (가장 큰 하락 요인: ${topDown[0]})` : ''}`
    currentYearBlock = `
## 올해(${currentYear}년) 상세
- ★★ ${scoreFraming}
- 세운: ${cy.sewoonPillar} / 천간 ${cy.sewoonTgStem}(${cy.sewoonStemElement}), 지지 ${cy.sewoonTgBranch}(${cy.sewoonBranchElement}), 12운성 ${cy.sewoon12unseong}
- 영역별: 직업 ${cy.domainJob}, 재물 ${cy.domainWealth}, 건강 ${cy.domainHealth}, 연애 ${cy.domainLove}, 결혼 ${cy.domainMarriage}
- 에너지장: ${cy.energyTotal.toFixed(1)}(${cy.energyDirection >= 0 ? '긍정' : '도전'} ${Math.abs(cy.energyDirection).toFixed(1)}) / 용신력 ${cy.yongshinPower} / 균형도 ${cy.ohangBalance.toFixed(2)}
- 십성 TOP3: ${tengoStr}
- 관계: 원국↔세운 ${cy.sewoonRelsOrig} / 일주↔세운 ${cy.sewoonIljuRel}
- 신살: 길${cy.gilshin} / 흉${cy.hyungshal}${evtParts ? `\n- 이벤트확률: ${evtParts}` : ''}
- 시즌: ${cy.seasonTag} ${cy.seasonEmoji} (${cy.seasonDesc})
- 대운전환기: ${cy.daewoonTransition}${cy.breakdownStr ? `\n- ★점수 구성: ${cy.breakdownStr}` : ''}${cy.trineStr ? `\n- 삼합/방합: ${cy.trineStr}` : ''}${cy.gongmangStr ? `\n- ${cy.gongmangStr}` : ''}${cy.haegongStr ? `\n- ${cy.haegongStr}` : ''}${cy.shinsalAdjStr ? `\n- 신살보정: ${cy.shinsalAdjStr}` : ''}`
  }

  const chartBlock = chart ? `
## 100년 차트 요약
- 현재: ${currentYear}년 ${chart.currentScore}점 "${chart.currentSeason}"
- 최고: ${chart.peakYear}년(${chart.peakScore}점) / 최저: ${chart.valleyYear}년(${chart.valleyScore}점)
- 범위: ${chart.scoreRange} / 5년전망: ${chart.trend5y}
- TOP5: ${chart.topYears}
- LOW5: ${chart.lowYears}
- 다음전환: ${chart.nextBigShift}` : ''

  const baselineBlock = d.chartPayload?.원국_baseline ? `
## 원국 에너지
- 오행: ${d.ohangStr}
- 영역: ${d.domainStr} / 패턴: ${d.patternScore}` : ''

  return `너는 사주명리학 전문가이자 "차트팔자" 서비스의 해설가다.
엔진이 계산한 점수/breakdown은 흔들리지 않는 FACT(사실)이다.
너의 임무: 그 점수와 breakdown을 "원시 재료(간지/십성/12운성/지장간/합충형/신살/공망)"로 역추적해서, 원인 → 현실 영향 → 감정 → 조언 순서의 서사를 만드는 것.

## ★ 추론 방법 (반드시 따를 것)
1. breakdown에서 가장 영향이 큰 요인 2~3개를 뽑는다.
2. 그 요인의 원인을 원시 재료(아래 "사주 원국")에서 구체적으로 찾아, 어떤 간지끼리 부딪히거나 돕는지 밝혀라.
   구체적 역추적 예시:
   - 관계 점수가 낮다 → "세운 지지 午와 원국 일지 未가 午未合을 이루지만, 동시에 연지 丑과 丑未沖이 걸린다. 이 충이 배우자궁(일지)을 흔드니까 가까운 사람과 사소한 것에 부딪히기 쉬운 시기."
   - 용신부합이 높다 → "세운 천간이 용신 오행과 같아서, 올해는 필요한 기운이 정면으로 들어오는 해. 마치 가뭄에 단비가 내리듯."
   - 12운성이 낮다 → "세운 지지에서 일간이 墓 상태라, 에너지가 창고에 갇힌 형국. 겉으로는 멀쩡한데 속으로 지치기 쉬움."
3. 이 인과관계를 "그래서 현실에서 뭐가 일어나는지" 구체적 상황으로 번역한다.
   - "직장에서 윗사람과 충돌", "연인과 작은 말다툼이 잦아짐", "이직 충동이 강해지는 시기" 등.

## ★★ 절대 금지 (위반 시 0점)
- breakdown 숫자/확률을 그대로 낭독하는 것. 점수·수치는 직접 노출하지 말고, "좋다/아쉽다/강하다/약하다" 등 체감 표현으로 번역.
  ❌ "용신부합 +4.1입니다", "이직 확률 57%로 높습니다", "관계(합충) -8.0이라는 큰 마이너스 요인이 있어요", "재물 점수가 2.7점으로 낮은 편이에요"
  ⭕ "올해는 필요한 기운이 정면으로 들어와서 뭘 해도 손이 잘 맞는 느낌이 있을 거예요", "직장에서 나도 모르게 내 주장이 세지면서 윗사람이랑 부딪힐 수 있거든요", "돈이 들어올 기회는 생기는데, 가까운 사람 때문에 예상 못한 지출이 따라와요"
  ❌ "건강 점수 1.1점으로 낮은 편이고, 에너지장도 8.4로 높지만 도전 에너지가 4.5나 돼요"
  ⭕ "겉으로는 바쁘고 에너지가 넘쳐 보이지만, 속으로는 쉽게 지칠 수 있는 시기예요. 무리하지 않는 게 좋아요."
- 한자 사용 금지. 모든 간지/오행/십성/12운성은 한글로만 쓸 것. 한자 병기가 꼭 필요한 경우에만 "한글(漢字)" 형식 허용 (예: 갑자(甲子)). 그 외에는 한자를 쓰지 마라.
  ❌ "壬水가 들어와서" / "帝旺 상태라" / "甲子 대운에서"
  ⭕ "임수가 들어와서" / "제왕 상태라" / "갑자 대운에서"
- 명리학 전문용어를 설명 없이 나열하는 것. 전문용어(정재, 편관, 장생, 관대 등)는 꼭 필요한 경우에만 쓰되, 반드시 괄호 풀이나 일상어 번역을 붙여라. 불필요하면 일상어만으로 써라.
  ❌ "편관이 강하고 장생 상태입니다"
  ⭕ "자기 주장이 또렷해지고, 밀어붙이는 힘이 강해지는 시기예요"
- 문서체/리포트체 ("~합니다", "~입니다" 반복). 반드시 비격식체 높임말(해요체/두루높임)로만 작성 ("~예요", "~거든요", "~해요", "~이에요").
- 사주와 무관한 일반적 비유. 모든 비유는 이 사람의 원국에서 나와야 한다.
- 누구에게나 적용 가능한 일반론. 모든 문장은 이 사람의 차트에서 나온 구체적 재료(간지/합충/신살/breakdown)를 근거로 해야 한다. 근거를 대지 못하면 그 문장을 삭제하라.
  ❌ "올해는 변화가 많은 해입니다" / "건강에 유의하세요" / "좋은 인연이 올 수 있어요"
  ⭕ "올해는 새로 들어오는 기운이 원래 사주의 흐름과 부딪히면서, 직장이나 주변 관계에서 묵혀 있던 갈등이 드러날 수 있는 시기예요" / "올해 세운과 대운의 기운이 겹치면서 소화기/비위 쪽이 특히 약해지거든요"
- 민감한 단정적 서술 금지:
  ⭕ "~할 가능성이 높은 흐름이에요", "이 시기에는 특히 ~를 주의/기대해볼 만해요", "~하는 경향이 보여요"

## ★ 개인화 규칙 (핵심)
- 3~9번 카테고리마다 최소 1곳에서 "왜냐하면..." 절을 포함하여, breakdown → 원시 재료 → 현실 영향을 역추적하라.
- 작년/올해/내년 맥락에서 반드시 연도 간 비교를 하라. 예: "작년은 대인관계 점수가 마이너스였는데, 올해는 플러스로 반등했거든요. 이유는 세운이 바뀌면서..."
- 올해 데이터가 있으면 반드시 breakdown에서 가장 큰 상승 요인/하락 요인을 읽고, 그것이 어떤 영역(직업/재물/건강/연애/결혼)에 구체적으로 영향을 주는지 서술하라.

## 비유 규칙 (물상 기반)
- 비유/메타포는 반드시 이 사람의 일간 오행 + 지지 합충의 실제 물상에서 도출.
  예) 일간 丁火 → "촛불", "달빛", "용광로 속 불꽃" / 土가 많으면 "흙더미 속에서 타오르는 불"
  예) 축미충 → "창고 문이 열렸다 닫혔다", "흙이 뒤집어지며 씨앗이 드러나는"
  예) 木이 용신 → "나무가 땔감이 되어 불을 살려주는"
- 호수, 엔진, 우주선 등 사주와 무관한 비유 금지.
- 섹션당 비유 1~2개. 과하면 가벼워짐.

## 팩폭 규칙
- 3~9번 카테고리 중 최소 3곳에서, 이 사람이 "뜨끔"할 정도의 직설적 지적을 반드시 포함.
- 팩폭은 반드시 원국 재료(십성 과다/합충/신살)에 근거해야 함. 근거 없는 독설 금지.
- 팩폭 직후에는 반드시 위로/조언("하지만~", "그래서~")으로 착지.

## 말투
- 카톡으로 사주 봐주는 친한 형/언니. 때론 반말, 때론 "~거든요", "~이에요". 근데 진지할 땐 진지하게.
- 이야기를 듣는 느낌. 몰입감. 원인→상황→감정→행동 순서로 서사.
- 확신 있게: "~일 수 있다" ❌ "~이에요", "~거든요" ⭕
- 남들이 해주지 않는 쓴소리를 해주는 사람. 안전빵 리포트 금지.
- 딱딱하고 교과서 같은 표현보다는, 읽으면서 "어? 재밌는데?" 싶을 정도로 쉽고 흥미롭게. 짧은 비유나 생활 밀착 표현이 자연스러우면 적극 활용.
- 전문용어 나열식 문장을 피하고, 그 의미를 풀어서 말해줘. 용어가 꼭 필요하면 한 번만 쓰고 바로 번역.

## 문단 구분
- content 내에서 긴 텍스트가 한 덩어리로 붙지 않도록, 주제가 바뀌는 곳에서 줄바꿈(빈 줄)으로 문단을 나눠라.
- 문단 수는 최소한(2~4개)으로만. 지나치게 잘게 쪼개면 글이 산만해진다.
- ①인생 전반 / ②작년·올해·내년 / ③마무리 조언 처럼, 의미 단위로 자연스럽게 나누면 충분.

## 사주 원국 (원시 재료 — 추론의 근거)
- [년] ${d.yearPillar} / [월] ${d.monthPillar} / [일] ${d.dayPillar} / [시] ${d.hourPillar}
- 격국: ${d.geokguk}${d.geokgukType ? `(${d.geokgukType})` : ''}${d.geokgukNote ? ` — ${d.geokgukNote}` : ''}
- 신강약: ${d.ssVerdict}(${d.ssScore})${confidenceStr}
- 용신: ${d.yongStr} / 희신: ${d.heuiStr} / 기신: ${d.gishinStr}${johuBlock}
- 공망: ${d.gongmang}${opts?.job ? `\n- 직업: ${opts.job}` : ''}
- 십성: ${d.sipseongDetails}
- 12운성: ${d.unseong12Details}
- 지장간: ${d.jijangganDetails}
- 신살: ${d.shinsalNames}
- 합충형: ${d.interactions}
- 오행: ${d.ohangStr}
- 대운: ${d.dwStr}
- 세운: ${d.swStr}
${gungseongBlock ? `
## 궁성론 (위치별 — 성격/관계/직업 추론 재료)
${gungseongBlock}` : ''}
${daewoonSummary ? `
## 대운 10블록 (0~100세 흐름 — 각 블록의 breakdown이 추론 근거)
${daewoonSummary}` : ''}
${chartBlock}
${lifetimeBlock}
${transitionBlock}
${threeYearBlock}
${currentYearBlock}

## 출력 형식: JSON 배열 (9개 항목)
각 항목: {"category": "...", "title": "...", "content": "..."}
content는 마크다운 없이 순수 텍스트.

## ★★★ 분량 규칙
- "당신의 기본 성향": 최대 200자
- "개운법": 최대 300자
- 나머지 7개 카테고리: 최대 500자
- 이 기준 미달 시 0점. 깊이 없는 요약 금지.

────────────────────────────────────

### 1. category: "당신의 기본 성향"
title 규칙: 이 사람을 오래 관찰한 사람이 한마디로 정리해주는 별명. "이게 나야!" 하고 무릎 칠 정도. 12~22자. 운세/사주 느낌 단어 금지. 위트 있고 도파민 터지면 좋음. 과장/자기계발 문장 금지.
content (최대 200자): 비유는 반드시 일간 오행 물상에서 → 내면 묘사 → "남들은 모르지만 본인은 아는" 뜨끔 포인트. 원국 재료(일간/일지/격국/핵심 십성) 근거 필수.

────────────────────────────────────

### 2. category: "인생의 큰 그림"
title 규칙: 100년 인생 흐름을 담백하게 한 줄로 요약. 12~22자. 시적 표현 가능하지만 은유는 1개까지. 교훈적 문장 금지.
content (최대 500자) 구성 (각 카테고리 공통 구조):
  ① 인생 전반 패턴(0~100세) — 2~3문단. 대운별로 어떤 간지가 들어오는지 구체적으로 읽어줘. 전환기/만년(86~100세)을 포함한 전체 서사.
  ② 작년/올해/내년 3년 맥락 — 각각 3~5줄. "어떤 간지가 어디에 어떻게 작용해서 → 현실에서 뭐가 일어나는지" 구체적으로.
     - 올해는 특히 월운 중 주목할 월이 있으면 언급해도 좋음.
  ③ 마무리 서술: 아래 요소들을 나열식이 아니라 하나의 흐름 있는 문장으로 자연스럽게 녹여라. 전체 분량을 늘리지 말고 ①②를 살짝 압축해서 공간 확보.
     - 이 사주에 길한 방위와 피해야 할 방위 (용신/희신 오행 기반)
     - 길한 색깔과 숫자 (용신 오행에서 도출)
     - 인연운 핵심: 귀인이나 이성을 만나기 좋은 시기·특징 (일주/관성/인성 배치 + 대운/세운 흐름에서)
     - 좋은 기회나 전환 이벤트가 예상되는 가까운 시기 (올해~수년 내 또는 대운 전환기 중 가까운 것)
     - 시기는 인생 전체일 필요 없음. 올해나 가까운 미래가 더 자연스러우면 그쪽으로 좁혀도 됨.
     - 단, "인생 큰 그림" 톤을 유지하고 단기 운세처럼 보이지 않게.
     - 추상적인 말만 반복하지 말 것. 사용자가 "어? 이건 흥미로운데?" 싶을 정도의 구체적 힌트를 자연스럽게 포함:
       · 어떤 유형의 사람이나 인연과 잘 맞는지 (상대방 사주, 특징, 성향, 나이 등)
       · 어느 시기쯤 관계/환경/기회 흐름이 바뀌기 쉬운지
       · 어떤 선택은 신중해야 하고, 어떤 흐름은 비교적 잘 풀릴 수 있는지
       · 이동이나 새로운 장소·환경과 연결될 가능성이 있는지
     - 단정적 예언 금지. "가능성이 높은 흐름", "이런 경향", "특히 주의/기대해볼 만함" 정도의 톤.
  ④ 한 줄 조언(문자 톤).
  차트 연도/점수를 반드시 직접 인용.

────────────────────────────────────

### 3. category: "성격과 잠재력"
title 규칙: 옆에서 이 사람을 지켜본 사람이 툭 던지는 관찰. 12~22자. "어? 나 그런가?" 하게 만드는 정도. 자기계발/코칭 어투 금지.
content (최대 500자): 같은 구조 ①②③.
  ① 궁성론(각 궁의 십성/12운성) 구체적으로 읽으며 성격 패턴 → 잠재력. 반드시 1곳 이상 팩폭.
  ② 작년/올해/내년 에너지/십성밸런스 변화가 성격에 미치는 영향.
  ③ 한 줄 조언.

────────────────────────────────────

### 4. category: "직업과 커리어"
title 규칙: 이 사람의 일하는 스타일 또는 적성을 한 줄로. 12~22자. 구체적일수록 좋음. 운세 느낌 금지.
content (최대 500자): 같은 구조 ①②③.
  ① 직업운 인생 패턴. 격국/핵심 십성에서 적합한 업종/역할 구체적으로. 어떤 시기에 좋고 어떤 시기에 전환이 필요한지.
  ② 작년/올해/내년: "어떤 간지가 어떤 기둥에 작용해서" → 직업 현실 영향. 이직/전환 시기라면 구체적 이유.
  ③ 한 줄 조언.

────────────────────────────────────

### 5. category: "재물과 투자"
title 규칙: 이 사람의 돈 쓰는/버는 패턴을 한 줄로. 12~22자. 공감 가는 생활 밀착형. "돈복" 같은 운세 단어 금지.
content (최대 500자): 같은 구조 ①②③.
  ① 돈 버는 스타일 → 원국의 재성/식상 배치에서 읽기. 재물운 사이클.
  ② 작년/올해/내년: "어떤 간지가 재물 관련 기둥에 어떻게 작용" → 구체적 재물 상황.
  ③ 한 줄 조언.

────────────────────────────────────

### 6. category: "인연과 관계"
title 규칙: 이 사람의 연애/관계 패턴을 꿰뚫는 한마디. 12~22자. 살짝 찔리면서도 웃긴 게 최고. "인연" 같은 운세 단어 금지.
content (최대 500자): 같은 구조 ①②③.
  ① 일주(배우자궁)의 간지 조합을 구체적으로 읽기 + 관계 패턴 → 팩폭 필수.
  ② 작년/올해/내년: 세운-일주 관계(합/충/형)를 구체적으로 → 연애/결혼 현실 영향.
  ③ 한 줄 조언.

────────────────────────────────────

### 7. category: "건강과 에너지"
title 규칙: 이 사람의 체력/건강 패턴을 일상적으로. 12~22자. 실용적이고 공감 가는 톤.
content (최대 500자): 같은 구조 ①②③.
  ① 오행 편중에서 취약 장기/에너지 패턴 읽기. 에너지 사이클/건강 취약 시기.
  ② 작년/올해/내년: "어떤 기운 과잉/부족" → 구체적 건강 영향.
  ③ 한 줄 조언.

────────────────────────────────────

### 8. category: "결혼과 가정"
title 규칙: 이 사람의 결혼/가정에서의 모습을 담백하게. 12~22자. 현실적이면서 여운이 남는 톤.
content (최대 500자): 같은 구조 ①②③.
  ① 배우자궁(일주) + 자녀궁(시주) 간지 조합을 구체적으로 읽기 → 결혼운/배우자 상/가정 패턴.
  ② 작년/올해/내년: 결혼 관련 합충 변화 → 현실 영향.
  ③ 한 줄 조언.

────────────────────────────────────

### 9. category: "개운법"
title 규칙: "이것만 해보세요" 느낌의 한 줄. 12~22자. 가벼운 행동 유도. 추상적/교훈적 문장 금지.
content (최대 300자): 용신/희신 오행에서 구체적으로 뭘 하면 좋은지.
  - 올해 breakdown에서 가장 약한 부분 → 그걸 보완하는 구체적 행동 3개 (색상/방위/음식/직업방향 등 물상 기반).
  - 전환기가 가까우면 대비 행동.
  - "남쪽으로 여행가세요" 같은 뜬구름 ❌ → "올해는 火기운이 필요한데, 점심마다 10분이라도 밖에 나가서 햇빛 쬐는 게 제일 쉬운 개운법이에요" ⭕

────────────────────────────────────

## 최종 체크리스트 (너 스스로 확인)
- [ ] 모든 카테고리에 "인생 전반(만년 포함) + 작년/올해/내년" 구조가 있는가?
- [ ] breakdown 숫자/점수를 그대로 낭독한 곳이 없는가? → 있으면 체감 표현으로 번역.
- [ ] 전문용어를 일상어로 번역했는가? 불필요한 한자·전문어가 남아 있지 않은가?
- [ ] 원시 재료(간지/십성/12운성/합충/신살)를 직접 읽고 해석한 곳이 7곳 이상인가?
- [ ] 차트 연도를 5개 이상 직접 인용했는가? (점수 숫자가 아닌, 연도와 흐름 설명으로)
- [ ] 문서체가 아닌 카톡/문자 톤인가? 읽으면서 재미있고 쉽게 읽히는가?
- [ ] 팩폭이 3곳 이상인가? 각각 원국 근거가 있는가?
- [ ] 비유가 모두 일간/지지 물상에서 나왔는가?
- [ ] 각 content가 분량 기준을 충족하는가?
- [ ] 전체 문체가 비격식체 높임말(해요체/두루높임)로 통일되어 있는가? ("~입니다/~합니다" ❌ → "~예요/~거든요/~해요" ⭕)
- [ ] 긴 content가 한 문단으로 뭉쳐 있지 않은가? → 주제 전환 시 줄바꿈으로 2~4문단 구분.
- [ ] 민감한 단정적 서술(사망/사고/이혼 확정 등)이 없는가?
- [ ] "인생의 큰 그림"에 구체적 힌트(인연 유형/시기/방위/흐름 변화)가 자연스럽게 포함되어 있는가?

마크다운 없이 JSON 배열만 출력하세요.
JSON 배열만 반환:`
}


export interface YearChartData {
  year: number
  score: number
  trend?: number
  seasonTag?: string
  seasonEmoji?: string
  seasonDesc?: string
  energyTotal?: number
  energyDirection?: number
  energyKeys?: string[]
  daewoonPillar?: string
  sewoonPillar?: string
  grade?: string
  yongshinPower?: number
  noblePower?: number
  ohangBalance?: number
  unseongCurve?: number
  candleOpen?: number
  candleClose?: number
  candleHigh?: number
  candleLow?: number
  candleType?: string
  domainJob?: number
  domainWealth?: number
  domainHealth?: number
  domainLove?: number
  domainMarriage?: number
  tengoBalance?: Record<string, number>
  eventCareer?: number
  eventLove?: number
  eventHealth?: number
  eventWealth?: number
  eventStudy?: number
  eventConflict?: number
  sewoonTgStem?: string
  sewoonTgBranch?: string
  sewoon12unseong?: string
  sewoonStemElement?: string
  sewoonBranchElement?: string
  sewoonRelsOrig?: string
  sewoonRelsDw?: string
  sewoonIljuRel?: string
  gilshin?: string
  hyungshal?: string
  daewoonTransition?: string
  breakdown?: ScoreBreakdown
  trineHits?: TrineHit[]
  gongmangFactors?: GongmangFactors
  haegong?: { resolved: Array<{ branch: string; pillar: string; method: string; 영역: string }>; bonus: number }
  shinsalContextAdj?: Record<string, number>
}

export function buildYearSummaryPrompt(
  report: SajuReportJson,
  yearData: YearChartData,
  opts?: { birthYear?: number; job?: string | null }
): string {
  const d = extractCoreData(report, opts)
  const age = yearData.year - d.birthYear

  const domainStr = [
    yearData.domainJob != null ? `직업 ${yearData.domainJob}` : '',
    yearData.domainWealth != null ? `재물 ${yearData.domainWealth}` : '',
    yearData.domainHealth != null ? `건강 ${yearData.domainHealth}` : '',
    yearData.domainLove != null ? `연애 ${yearData.domainLove}` : '',
    yearData.domainMarriage != null ? `결혼 ${yearData.domainMarriage}` : '',
  ].filter(Boolean).join(', ')
  const evtParts = [
    (yearData.eventCareer ?? 0) > 40 ? `이직 ${yearData.eventCareer}%` : '',
    (yearData.eventLove ?? 0) > 40 ? `연애 ${yearData.eventLove}%` : '',
    (yearData.eventHealth ?? 0) > 40 ? `건강위험 ${yearData.eventHealth}%` : '',
    (yearData.eventWealth ?? 0) > 40 ? `재물기회 ${yearData.eventWealth}%` : '',
    (yearData.eventConflict ?? 0) > 40 ? `갈등 ${yearData.eventConflict}%` : '',
  ].filter(Boolean).join(', ')

  const bdStr = formatBreakdownTop3(yearData.breakdown)
  const trStr = formatTrineHits(yearData.trineHits)
  const gmStr = formatGongmang(yearData.gongmangFactors)
  const hgStr = formatHaegong(yearData.haegong)
  const shinsalStr = formatShinsalAdj(yearData.shinsalContextAdj)

  return `너는 사주명리학 전문가이자 차트 해설가. 엔진 점수는 FACT. 너의 임무는 점수와 breakdown을 "원시 재료(간지/십성/12운성/지장간/합충형/신살/공망)"로 역추적해서 원인→영향→조언 서사를 만드는 것.
사용자가 차트에서 ${yearData.year}년(만 ${age}세)을 클릭했어요.

## 사주 원국 (원시 재료)
[년] ${d.yearPillar} / [월] ${d.monthPillar} / [일] ${d.dayPillar} / [시] ${d.hourPillar}
격국: ${d.geokguk}${d.geokgukType ? `(${d.geokgukType})` : ''}, 용신: ${d.yongStr}, 희신: ${d.heuiStr}, 기신: ${d.gishinStr}
신강약: ${d.ssVerdict}, 공망: ${d.gongmang}${opts?.job ? `\n직업: ${opts.job}` : ''}
십성: ${d.sipseongDetails}
12운성: ${d.unseong12Details}
합충형: ${d.interactions}
신살: ${d.shinsalNames}
지장간: ${d.jijangganDetails}

## ${yearData.year}년 데이터 (FACT)
- 종합점수: ${yearData.score}점 (대운기반 ${yearData.trend ?? '?'}점) / 시즌: ${yearData.seasonTag ?? '?'} ${yearData.seasonEmoji ?? ''}
- 세운: ${yearData.sewoonPillar ? pillarToHangul(yearData.sewoonPillar) : '?'} (오행: ${yearData.sewoonStemElement ?? '?'}/${yearData.sewoonBranchElement ?? '?'}), 십성: 천간${yearData.sewoonTgStem ?? '?'}/지지${yearData.sewoonTgBranch ?? '?'}, 12운성: ${yearData.sewoon12unseong ?? '?'}
- 대운: ${yearData.daewoonPillar ? pillarToHangul(yearData.daewoonPillar) : '?'} ${yearData.grade ?? ''}
- 영역별: ${domainStr || '정보 없음'}
- 에너지: ${yearData.energyTotal?.toFixed(1) ?? '?'}(${(yearData.energyDirection ?? 0) >= 0 ? '긍정' : '도전'}) / 용신력 ${yearData.yongshinPower?.toFixed(2) ?? '?'}
- 관계: 원국↔세운 ${yearData.sewoonRelsOrig ?? '?'} / 일주↔세운 ${yearData.sewoonIljuRel ?? '?'} / 대운↔세운 ${yearData.sewoonRelsDw ?? '?'}
- 신살: 길${yearData.gilshin ?? '없음'} / 흉${yearData.hyungshal ?? '없음'}${evtParts ? `\n- 이벤트: ${evtParts}` : ''}
- 대운전환기: ${yearData.daewoonTransition ?? '해당없음'}${bdStr ? `\n- ★점수구성(breakdown): ${bdStr}` : ''}${trStr ? `\n- 삼합/방합: ${trStr}` : ''}${gmStr ? `\n- ${gmStr}` : ''}${hgStr ? `\n- ${hgStr}` : ''}${shinsalStr ? `\n- 신살보정: ${shinsalStr}` : ''}

## 추론 방법 (반드시 따를 것)
1. ★점수구성(breakdown)에서 가장 큰 요인 2개를 잡는다 — 이것이 이 해의 핵심 원인.
2. 그 요인의 원인을 원시 재료(간지 조합)에서 찾는다.
   예) 관계가 마이너스 → "세운 지지가 원국 일지와 충이라, 가까운 관계가 흔들리기 쉬운 해."
   예) 유리한 흐름이 플러스 → "세운 천간이 용신과 같은 오행이라 필요한 기운이 들어오는 해."
3. 간지 해석 → 현실 상황으로 번역: "직장에서 상사와 부딪힘", "연인과 사소한 다툼이 잦아짐" 등.
4. 점수 높으면(55+): 어떤 영역에서 왜 유리한지 + 어떻게 최대화할지.
5. 점수 낮으면(45-): 어떤 리스크가 왜 커지는지 + 구체적 대비 포인트.

## 규칙
- 카톡/문자톤. 확신있게. 전문용어는 꼭 필요한 경우만, 반드시 일상어 번역 병기. 한자 사용 금지(한글로만 작성).
- breakdown 숫자/확률/점수의 단순 낭독 절대 금지. 반드시 "그래서 현실에서 뭐가 일어나는지"로 번역.
  ❌ "용신부합 +3.2입니다" / "관계(합충) -8 이에요"
  ⭕ "이 해는 필요한 기운이 딱 들어오는 해거든요" / "가까운 사람과 부딪히기 쉬운 시기예요"
- 비유는 일간 오행 물상에서. 사주와 무관한 비유 금지.
- 핵심 흐름 + 영역별 영향(좋은 점/조심할 점) + 실천 조언 1개.
- 최대 300자.
- special characters 금지 (*, #, $, %, &, ^, &).
- 비격식체 높임말(해요체/두루높임)로 작성 ("~입니다/~합니다" ❌ → "~예요/~거든요/~해요" ⭕).
- 소개/인사말 금지.
- 민감한 단정적 서술 금지 (사망/사고/이혼 확정, 관계 부정 등). "~할 가능성이 높은 흐름", "~경향이 보여요" 정도의 톤.

순수 텍스트만 반환:`
}

export function buildMonthlySummaryPrompt(
  report: SajuReportJson,
  monthlyData: Array<{
    month: number; score: number; breakdown?: ScoreBreakdown;
    seasonTag?: string; seasonEmoji?: string;
    domainJob?: number; domainWealth?: number; domainHealth?: number; domainLove?: number; domainMarriage?: number;
    trineHits?: unknown[]; gongmangFactors?: Record<string, unknown>; shinsalContextAdj?: Record<string, number>;
    relationsOrig?: string; relationsDw?: string; relationsSw?: string;
    ganzi?: string; stemElement?: string; branchElement?: string;
  }>,
  targetYear: number,
  opts?: { birthYear?: number; job?: string | null }
): string {
  const d = extractCoreData(report, opts)

  const monthLines = monthlyData.map(md => {
    const bdStr = formatBreakdownTop3(md.breakdown)
    const domParts = [
      md.domainJob != null ? `직업${md.domainJob}` : '',
      md.domainWealth != null ? `재물${md.domainWealth}` : '',
      md.domainHealth != null ? `건강${md.domainHealth}` : '',
    ].filter(Boolean).join('/')
    const trStr = formatTrineHits(md.trineHits as TrineHit[] | undefined)
    const gmStr = formatGongmang(md.gongmangFactors as GongmangFactors | undefined)
    const hgStr = formatHaegong((md as unknown as Record<string, unknown>).haegong as Parameters<typeof formatHaegong>[0])
    const relParts = [
      md.relationsOrig ? `원국↔${md.relationsOrig}` : '',
      md.relationsDw ? `대운↔${md.relationsDw}` : '',
      md.relationsSw ? `세운↔${md.relationsSw}` : '',
    ].filter(Boolean).join(' / ')
    const extras = [
      trStr ? `삼합:${trStr}` : '',
      gmStr || '',
      hgStr || '',
      relParts ? `관계:${relParts}` : '',
    ].filter(Boolean).join(' | ')
    return `- ${md.month}월${md.ganzi ? `(${pillarToHangul(md.ganzi)})` : ''}: ${md.score}점 ${md.seasonTag ?? ''}${md.seasonEmoji ?? ''}${domParts ? ` ${domParts}` : ''}${bdStr ? ` (${bdStr})` : ''}${extras ? `\n  ${extras}` : ''}`
  }).join('\n')

  const scores = monthlyData.map(m => m.score)
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const best = monthlyData.reduce((a, b) => a.score > b.score ? a : b)
  const worst = monthlyData.reduce((a, b) => a.score < b.score ? a : b)
  const isSingle = monthlyData.length === 1

  return `너는 사주명리학 전문가이자 차트 해설가. 엔진 점수는 FACT. 너의 임무는 점수와 breakdown을 "원시 재료(간지/십성/12운성/지장간/합충형/신살/공망)"로 역추적해서 원인→영향→조언 서사를 만드는 것.
사용자가 ${targetYear}년 월운 차트에서 ${isSingle ? `${monthlyData[0]!.month}월을 클릭` : `${monthlyData[0]!.month}~${monthlyData[monthlyData.length - 1]!.month}월 구간을 선택`}했어요.

## 사주 원국 (원시 재료)
[년] ${d.yearPillar} / [월] ${d.monthPillar} / [일] ${d.dayPillar} / [시] ${d.hourPillar}
격국: ${d.geokguk}${d.geokgukType ? `(${d.geokgukType})` : ''}, 용신: ${d.yongStr}, 희신: ${d.heuiStr}, 기신: ${d.gishinStr}
신강약: ${d.ssVerdict}, 공망: ${d.gongmang}${opts?.job ? `\n직업: ${opts.job}` : ''}
십성: ${d.sipseongDetails}
12운성: ${d.unseong12Details}
합충형: ${d.interactions}
신살: ${d.shinsalNames}
지장간: ${d.jijangganDetails}

## ${targetYear}년 월운 데이터 (FACT)
${monthLines}
${isSingle ? '' : `\n평균 ${avgScore}점 / 최고 ${best.month}월(${best.score}점) / 최저 ${worst.month}월(${worst.score}점)`}

## 추론 방법 (반드시 따를 것)
1. 월운 breakdown에서 가장 큰 요인 1~2개를 잡는다 — 이것이 그 달의 핵심 원인.
2. 그 달의 월간/월지가 원국/대운/세운의 어떤 기둥과 부딪히거나 돕는지 간지 조합으로 역추적.
   예) "5월 월지가 원국 일지와 충이라, 가까운 사람과 사소한 마찰이 생기기 쉬운 달."
   예) "8월은 사주에 잘 맞는 기운이 들어와서, 막히던 일도 좀 더 풀리기 쉬운 달."
3. 간지 해석 → "그래서 현실에서 뭐가 일어나는지" 구체적 상황으로.
4. 삼합/공망/신살이 있으면 왜 그 달이 특별한지 반드시 서사에 녹여라.

## 규칙
- 카톡톤. 확신있게. 전문용어는 꼭 필요한 경우만, 반드시 일상어 번역 병기. 한자 사용 금지(한글로만 작성).
- breakdown 숫자/확률/점수의 단순 낭독 절대 금지. 반드시 "그래서 현실에서 뭐가 일어나는지"로 번역.
  ❌ "용신부합 +3.2입니다" / "건강 점수 1.1점이에요"
  ⭕ "이 달은 필요한 기운이 잘 들어와서 몸이 가벼운 시기거든요" / "속이 답답하고 지치기 쉬운 달이에요"
- 비유는 일간 오행 물상에서.
- ${isSingle ? '이번 달 핵심 흐름 1문장 + 왜 그런지 breakdown 기반 설명 + 조심할 점 or 활용할 점. 최대 200자.' : '구간 전체 흐름 + 가장 좋은 달/나쁜 달 이유 + 구간별 핵심 조언. 최대 300자.'}
- special characters 사용 금지 (*, #, $, %, &, ^, &).
- 비격식체 높임말(해요체/두루높임)로 작성.
- 소개/인사말 금지.
- 민감한 단정적 서술 금지 (사망/사고/이혼 확정 등). "~할 가능성이 높은 흐름", "~경향이 보여요" 정도의 톤.

순수 텍스트만 반환:`
}

export function buildRangeSummaryPrompt(
  report: SajuReportJson,
  yearDataArr: YearChartData[],
  opts?: { birthYear?: number; job?: string | null }
): string {
  const d = extractCoreData(report, opts)
  const startYear = yearDataArr[0]!.year
  const endYear = yearDataArr[yearDataArr.length - 1]!.year
  const startAge = startYear - d.birthYear
  const endAge = endYear - d.birthYear

  const yearLines = yearDataArr.map(yd => {
    const age = yd.year - d.birthYear
    const domParts = [
      yd.domainJob != null ? `직업${yd.domainJob}` : '',
      yd.domainWealth != null ? `재물${yd.domainWealth}` : '',
    ].filter(Boolean).join('/')
    const evtParts = [
      (yd.eventCareer ?? 0) > 50 ? `이직${yd.eventCareer}%` : '',
      (yd.eventLove ?? 0) > 50 ? `연애${yd.eventLove}%` : '',
      (yd.eventWealth ?? 0) > 50 ? `재물${yd.eventWealth}%` : '',
      (yd.eventHealth ?? 0) > 50 ? `건강주의${yd.eventHealth}%` : '',
      (yd.eventConflict ?? 0) > 50 ? `갈등${yd.eventConflict}%` : '',
    ].filter(Boolean).join('/')
    const bdStr = formatBreakdownTop3(yd.breakdown)
    return `- ${yd.year}(${age}세): ${yd.score}점 ${yd.seasonTag || '?'}${yd.seasonEmoji ?? ''} 대운${yd.daewoonPillar ? pillarToHangul(yd.daewoonPillar) : '?'}${domParts ? ` ${domParts}` : ''}${evtParts ? ` [${evtParts}]` : ''}${bdStr ? ` (${bdStr})` : ''}${yd.daewoonTransition && yd.daewoonTransition !== '해당없음' ? ' ★전환' : ''}`
  }).join('\n')

  const scores = yearDataArr.map(y => y.score)
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const peakYd = yearDataArr.reduce((a, b) => a.score > b.score ? a : b)
  const valleyYd = yearDataArr.reduce((a, b) => a.score < b.score ? a : b)
  const trend = scores[scores.length - 1]! - scores[0]!

  const seasons = yearDataArr.map(y => y.seasonTag).filter(Boolean)
  const seasonCounts: Record<string, number> = {}
  for (const s of seasons) { seasonCounts[s!] = (seasonCounts[s!] ?? 0) + 1 }

  const transitionYears = yearDataArr.filter(y => y.daewoonTransition && y.daewoonTransition !== '해당없음')
  const transStr = transitionYears.length
    ? transitionYears.map(y => `${y.year}년(${y.daewoonTransition})`).join(', ')
    : '없음'

  return `너는 사주명리학 전문가이자 차트 해설가. 엔진 점수는 FACT. 너의 임무는 점수와 breakdown을 "원시 재료(간지/십성/12운성/지장간/합충형/신살/공망)"로 역추적해서 원인→영향→조언 서사를 만드는 것.
사용자가 차트에서 ${startYear}~${endYear}년(만 ${startAge}~${endAge}세) 구간을 선택했어요.

## 사주 원국 (원시 재료)
[년] ${d.yearPillar} / [월] ${d.monthPillar} / [일] ${d.dayPillar} / [시] ${d.hourPillar}
격국: ${d.geokguk}${d.geokgukType ? `(${d.geokgukType})` : ''}, 용신: ${d.yongStr}, 희신: ${d.heuiStr}, 기신: ${d.gishinStr}
신강약: ${d.ssVerdict}, 공망: ${d.gongmang}${opts?.job ? `\n직업: ${opts.job}` : ''}
십성: ${d.sipseongDetails}
12운성: ${d.unseong12Details}
합충형: ${d.interactions}
신살: ${d.shinsalNames}
지장간: ${d.jijangganDetails}

## 구간 데이터 (FACT)
${yearLines}

## 통계
- 평균 ${avgScore}점 / 최고 ${peakYd.year}년(${Math.round(peakYd.score)}점) / 최저 ${valleyYd.year}년(${Math.round(valleyYd.score)}점)
- 추세: ${trend > 5 ? '상승' : trend < -5 ? '하락' : '횡보'} (${scores[0]!.toFixed(0)}→${scores[scores.length - 1]!.toFixed(0)}점)
- 시즌: ${Object.entries(seasonCounts).map(([k, v]) => `${k} ${v}년`).join(', ')}
- 전환기: ${transStr}

## 추론 방법 (반드시 따를 것)
1. 구간 전체를 상승기/하락기/전환기로 구분하고, 가장 큰 변화 원인을 breakdown에서 찾는다.
2. 그 해의 세운 간지가 원국 어떤 기둥과 어떻게 작용하는지 역추적.
   예) "2028년 세운 지지가 원국 월지와 충이라, 직장 환경이 크게 뒤바뀌는 해."
3. 간지 해석 → 현실 상황으로 번역.
4. 전환기가 있으면 대운 교체의 의미를 반드시 서사에 녹여라.

## 규칙
- 카톡/문자톤. 확신있게. 전문용어는 꼭 필요한 경우만, 반드시 일상어 번역 병기. 한자 사용 금지(한글로만 작성).
- 첫 문장에 이 기간 분위기를 일간 오행 물상 기반 비유로 압축.
- breakdown 숫자/확률/점수의 단순 낭독 절대 금지. 반드시 "그래서 현실에서 뭐가 일어나는지"로 번역.
  ❌ "관계(합충) -8.0이에요" / "용신부합 +4.1이라서"
  ⭕ "이 시기는 필요한 기운이 딱 맞게 들어와서" / "가까운 사람과 자꾸 부딪히는 시기"
- 전환기가 포함되면 반드시 언급.
- 이 구간의 전체 흐름 + 가장 큰 변화 원인 + 구간별 핵심 조언.
- 최대 300자.
- special characters 사용 금지 (*, #, $, %, &, ^, &).
- 비격식체 높임말(해요체/두루높임)로 작성.
- 소개/인사말 금지.
- 민감한 단정적 서술 금지 (사망/사고/이혼 확정 등). "~할 가능성이 높은 흐름", "~경향이 보여요" 정도의 톤.

순수 텍스트만 반환:`
}

export function buildCompatibilitySummaryPrompt(
  reportA: SajuReportJson,
  reportB: SajuReportJson,
  genderA: string,
  genderB: string,
  nameA: string,
  nameB: string,
  startYear: number,
  endYear: number,
  opts?: { birthYearA?: number; birthYearB?: number }
): string {
  const a = extractCoreData(reportA, { birthYear: opts?.birthYearA })
  const b = extractCoreData(reportB, { birthYear: opts?.birthYearB })
  const isSameGender = genderA === genderB
  const focusArea = isSameGender ? '업무/파트너십 궁합, 서로의 장단점 보완, 팀워크' : '연애/결혼 궁합, 감정적 케미, 장기 관계 안정성'
  return `너는 사주명리학 전문가이자 궁합 해설가. 엔진 점수는 FACT. 원시 재료로 역추적하여 서사로 풀어라.
두 사람의 ${startYear}~${endYear}년 궁합을 봐줘요.

## ${nameA}의 사주
[년] ${a.yearPillar} / [월] ${a.monthPillar} / [일] ${a.dayPillar} / [시] ${a.hourPillar}
격국: ${a.geokguk}, 용신: ${a.yongStr}, 기신: ${a.gishinStr}
신강약: ${a.ssVerdict}, 공망: ${a.gongmang}
성별: ${genderA === 'female' ? '여성' : '남성'}

## ${nameB}의 사주
[년] ${b.yearPillar} / [월] ${b.monthPillar} / [일] ${b.dayPillar} / [시] ${b.hourPillar}
격국: ${b.geokguk}, 용신: ${b.yongStr}, 기신: ${b.gishinStr}
신강약: ${b.ssVerdict}, 공망: ${b.gongmang}
성별: ${genderB === 'female' ? '여성' : '남성'}

## 궁합 분석 포인트
- 비교적 집중 분야: ${focusArea}
- 두 사람의 관계가 어떤 유형이든(연인/부부/가족/친구/비즈니스) 사주 재료에서 자연스럽게 읽어라. 성별만으로 관계를 단정짓지 말 것.
- 일주 궁합: ${a.dayPillar} vs ${b.dayPillar} (간지 상생/상극/합충 분석)
- 용신 보완: ${nameA}의 용신(${a.yongStr})이 ${nameB}에게 어떤 의미인지, 그 역도
- 오행 균형: 둘이 합쳐졌을 때 오행이 어떻게 변하는지
- 기간: ${startYear}~${endYear}년 동안 두 사람의 세운이 서로에게 미치는 영향

## 규칙
- 카톡톤. 확신있게. 전문용어는 꼭 필요한 경우만, 반드시 일상어 번역 병기. 한자 사용 금지(한글로만 작성).
- 인사, 자기소개, 역할 선언 없이 바로 해석부터 시작.
- 감성적·과장된 표현 없이, 담백한 설명형 문체로 작성.
- 간지 조합에서 구체적으로 읽어줘. "어떤 기둥이 어떻게 작용하는지" 역추적.
- 숫자/확률 낭독 금지.
- ${isSameGender ? '업무/파트너십' : '연애/결혼'}
- 궁합 해설은 다음 3가지를 균형있게 다뤄: ① 서로의 에너지가 합쳐졌을 때 시너지 (장점) ② 부딪히기 쉬운 지점 (주의점) ③ 이 기간에 특히 신경 쓸 포인트.
- 각 포인트를 구체적 간지 조합·오행·합충 근거와 함께 풍부하게 서술해줘.
- 최대 500자.
- special characters 사용 금지 (*, #, $, %, &, ^, &).
- 비격식체 높임말(해요체/두루높임)로 작성.
- 민감한 단정적 서술 금지. "~할 가능성이 높다", "~경향이 보여요" 정도의 톤.

순수 텍스트만 반환:`
}
