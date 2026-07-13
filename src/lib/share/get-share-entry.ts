/**
 * 공개 공유 엔트리 로더.
 *
 * 공유 페이지 / 공개 API / OG 이미지가 공통으로 쓰는 단일 소스다.
 * `isShared === true` 인 엔트리만 비로그인 수신자에게 노출하며,
 * 정확한 생년월일·생시 등 민감 정보는 제외하고 결과 표시에 필요한 값만 돌려준다.
 */
import { prisma } from '@/lib/db/prisma'
import type { SajuReportJson } from '@/types/saju-report'
import { hydrateWeekSeries, type WeekSeriesPayload } from '@/lib/saju/hydrate-week-series'

export interface PublicShareEntry {
  id: string
  name: string
  gender: string
  /** 차트 계산에 필요한 출생연도만 노출 (월/일/시는 비공개) */
  birthYear: number
  dayElement: string | null
  sajuReportJson: SajuReportJson | null
  fortuneJson: unknown | null
  /** 이번 주 일운 — 공유 페이지 ChartTab용 (생시 등 민감정보는 포함하지 않음) */
  weekSeries: WeekSeriesPayload | null
}

/** 공유 페이지에서 "비교" 대상으로 노출할 공개 예시 인물(차트팔자에 저장된 공인). */
const SAMPLE_NAMES = ['리오넬 메시', '전소연', '강호동']

export interface ShareSample {
  id: string
  name: string
  gender: string
  birthDate: string
  dayElement: string | null
}

/**
 * 공개 비교용 예시 인물 목록. isShared 이고 sajuReportJson 이 있는 항목만,
 * 이름당 1건씩 SAMPLE_NAMES 순서로 반환한다.
 */
export async function getShareSamples(excludeId?: string): Promise<ShareSample[]> {
  const rows = await prisma.sajuEntry
    .findMany({
      where: { name: { in: SAMPLE_NAMES }, isShared: true },
      select: { id: true, name: true, gender: true, birthDate: true, dayElement: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => [] as { id: string; name: string; gender: string; birthDate: string; dayElement: string | null; createdAt: Date }[])

  const seen = new Set<string>()
  const out: ShareSample[] = []
  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue
    if (seen.has(r.name)) continue
    seen.add(r.name)
    out.push({ id: r.id, name: r.name, gender: r.gender, birthDate: r.birthDate, dayElement: r.dayElement ?? null })
  }
  return out.sort((a, b) => SAMPLE_NAMES.indexOf(a.name) - SAMPLE_NAMES.indexOf(b.name))
}

/** 공유 공개된 엔트리만 반환. 비공개거나 없으면 null. */
export async function getPublicShareEntry(id: string): Promise<PublicShareEntry | null> {
  const entry = await prisma.sajuEntry.findUnique({ where: { id } }).catch(() => null)
  if (!entry || !entry.isShared) return null

  const birthYear = parseInt(String(entry.birthDate).slice(0, 4), 10)
  let weekSeries: WeekSeriesPayload | null = null
  try {
    weekSeries = await hydrateWeekSeries(entry)
  } catch (e) {
    console.error('getPublicShareEntry weekSeries hydrate failed:', e)
  }

  return {
    id: entry.id,
    name: entry.name,
    gender: entry.gender,
    birthYear: Number.isFinite(birthYear) ? birthYear : new Date().getFullYear(),
    dayElement: entry.dayElement ?? null,
    sajuReportJson: (entry.sajuReportJson as SajuReportJson | null) ?? null,
    fortuneJson: entry.fortuneJson ?? null,
    weekSeries,
  }
}
