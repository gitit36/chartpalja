/**
 * 공개 공유 엔트리 로더.
 *
 * 공유 페이지 / 공개 API / OG 이미지가 공통으로 쓰는 단일 소스다.
 * `isShared === true` 인 엔트리만 비로그인 수신자에게 노출하며,
 * 정확한 생년월일·생시 등 민감 정보는 제외하고 결과 표시에 필요한 값만 돌려준다.
 */
import { prisma } from '@/lib/db/prisma'
import type { SajuReportJson } from '@/types/saju-report'

export interface PublicShareEntry {
  id: string
  name: string
  gender: string
  /** 차트 계산에 필요한 출생연도만 노출 (월/일/시는 비공개) */
  birthYear: number
  dayElement: string | null
  sajuReportJson: SajuReportJson | null
  fortuneJson: unknown | null
}

/** 공유 공개된 엔트리만 반환. 비공개거나 없으면 null. */
export async function getPublicShareEntry(id: string): Promise<PublicShareEntry | null> {
  const entry = await prisma.sajuEntry.findUnique({ where: { id } }).catch(() => null)
  if (!entry || !entry.isShared) return null

  const birthYear = parseInt(String(entry.birthDate).slice(0, 4), 10)
  return {
    id: entry.id,
    name: entry.name,
    gender: entry.gender,
    birthYear: Number.isFinite(birthYear) ? birthYear : new Date().getFullYear(),
    dayElement: entry.dayElement ?? null,
    sajuReportJson: (entry.sajuReportJson as SajuReportJson | null) ?? null,
    fortuneJson: entry.fortuneJson ?? null,
  }
}
