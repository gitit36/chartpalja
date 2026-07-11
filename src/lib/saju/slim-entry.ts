/**
 * 차트 상세 API 응답 슬림화.
 * DB에는 풀 리포트를 유지하고, 와이어로 나가는 JSON만 차트 UI에 필요한 필드로 줄인다.
 * (연도 해설 LLM은 서버가 DB에서 풀 데이터를 다시 읽으므로 영향 없음)
 */

const REPORT_KEEP = [
  '만세력_사주원국',
  '천간지지',
  '오행분포',
  '신강신약',
  '용신희신',
  '신살길성',
  '공망',
  '공망분류',
  '오행십성_상세',
  '격국',
  '사주관계',
  '패턴점수',
  'DomainScore',
  '대운',
  '세운',
  '월운',
  '입력정보',
  'chartData',
] as const

/** 연도별 타임라인 — life-chart-data / 툴팁에 쓰는 필드만 */
function slimYearlyDatum(yd: Record<string, unknown>): Record<string, unknown> {
  return {
    age: yd.age,
    year: yd.year,
    candle: yd.candle,
    scores: yd.scores,
    indicators: yd.indicators,
    이벤트확률: yd['이벤트확률'],
    시즌태그: yd['시즌태그'],
    대운_pillar: yd['대운_pillar'],
    세운_pillar: yd['세운_pillar'],
    breakdown: yd.breakdown,
    trine_hits: yd.trine_hits,
    gongmang_factors: yd.gongmang_factors,
    haegong: yd.haegong,
    shinsal_context_adj: yd.shinsal_context_adj,
    shinsal_tags: yd.shinsal_tags,
    세운_신살_길신: yd['세운_신살_길신'],
    세운_신살_흉살: yd['세운_신살_흉살'],
    // 궁합 clash 성분 (yearRelationClashScore) — 빠지면 overallScore가 왜곡됨
    세운_관계_with_원국: yd['세운_관계_with_원국'],
    세운_관계_with_대운: yd['세운_관계_with_대운'],
    세운_일주관계: yd['세운_일주관계'],
  }
}

function slimMonthlyDatum(md: Record<string, unknown>): Record<string, unknown> {
  return {
    month: md.month,
    candle: md.candle,
    scores: md.scores,
    indicators: md.indicators,
    이벤트확률: md['이벤트확률'],
    시즌태그: md['시즌태그'],
    대운_pillar: md['대운_pillar'],
    세운_pillar: md['세운_pillar'],
    breakdown: md.breakdown,
    trine_hits: md.trine_hits,
    gongmang_factors: md.gongmang_factors,
    haegong: md.haegong,
    shinsal_context_adj: md.shinsal_context_adj,
    shinsal_tags: md.shinsal_tags,
    간지: md['간지'],
    stemElement: md.stemElement,
    branchElement: md.branchElement,
    관계_with_원국: md['관계_with_원국'],
    관계_with_대운: md['관계_with_대운'],
    관계_with_세운: md['관계_with_세운'],
  }
}

function slimChartData(chartData: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!chartData || typeof chartData !== 'object') return null
  const out: Record<string, unknown> = {
    meta: chartData.meta,
    대운기둥10: chartData['대운기둥10'],
    원국_baseline: chartData['원국_baseline'],
  }
  const tl = chartData['연도별_타임라인']
  if (Array.isArray(tl)) {
    out['연도별_타임라인'] = tl.map((y) => slimYearlyDatum(y as Record<string, unknown>))
  }
  const mt = chartData['월운_타임라인'] as { target_year?: number; data?: unknown[] } | undefined
  if (mt && typeof mt === 'object') {
    out['월운_타임라인'] = {
      target_year: mt.target_year,
      data: Array.isArray(mt.data)
        ? mt.data.map((m) => slimMonthlyDatum(m as Record<string, unknown>))
        : [],
    }
  }
  return out
}

function slimReport(report: unknown): unknown {
  if (!report || typeof report !== 'object') return report
  const src = report as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of REPORT_KEEP) {
    if (src[k] == null) continue
    out[k] = k === 'chartData' ? slimChartData(src[k] as Record<string, unknown>) : src[k]
  }
  return out
}

/** 클라이언트 전달용 — 메타 + 슬림 리포트 + fortuneJson */
export function slimSajuEntryForClient(
  entry: Record<string, unknown>,
  isOwner: boolean,
): Record<string, unknown> {
  const {
    sajuReportJson,
    fortuneJson,
    fortuneJsonB,
    // 내부/불필요 컬럼
    userId: _u,
    guestId: _g,
    ...rest
  } = entry

  const payload: Record<string, unknown> = {
    ...rest,
    sajuReportJson: slimReport(sajuReportJson),
  }

  // 비소유자는 fortune 비공개 (기존 stripSensitive 와 동일)
  if (isOwner) {
    payload.fortuneJson = fortuneJson ?? null
  }

  return payload
}
