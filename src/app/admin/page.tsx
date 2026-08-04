import Link from 'next/link'
import { getDashboardData } from '@/lib/admin/dashboard'
import { parseRangeKey, type AdminRangeKey } from '@/lib/admin/dates'
import { MetricCard, StatusBadge } from '@/components/admin/AdminUi'
import { DashboardCharts } from '@/components/admin/DashboardCharts'

export const dynamic = 'force-dynamic'

function formatWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

const RANGES: { key: AdminRangeKey; label: string }[] = [
  { key: '1d', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
]

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const range = parseRangeKey(sp.range)
  const data = await getDashboardData(range)
  const s = data.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">대시보드</h1>
          <p className="mt-1 text-sm text-cp-muted">가입 · 사주 · 결제 · 쿠폰 · 최근 조회</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-cp-border bg-cp-raised p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin?range=${r.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                range === r.key ? 'bg-cp-surface text-cp-text' : 'text-cp-muted hover:text-cp-secondary'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="신규 가입" value={s.signups} hint={`오늘 ${s.today.signups}`} />
        <MetricCard
          label="사주 생성"
          value={s.entries}
          hint={`게스트 ${s.guestEntries} · 오늘 ${s.today.entries}`}
        />
        <MetricCard
          label="결제 건수"
          value={s.paidOrders}
          hint={`오늘 ${s.today.paidOrders}`}
        />
        <MetricCard
          label="매출 (KRW)"
          value={formatWon(s.revenueKrw)}
          hint={`오늘 ${formatWon(s.today.revenueKrw)}`}
        />
        <MetricCard label="쿠폰 사용" value={s.couponRedeems} />
        <MetricCard label="주 사용량" value={`${s.juUsed}주`} hint="use:* 합계" />
        <MetricCard
          label="미처리 문의"
          value={s.openInquiries}
          hint={s.openInquiries > 0 ? '확인 필요' : '없음'}
        />
        <MetricCard
          label="상품 TOP"
          value={data.charts.productMix[0]?.code ?? '-'}
          hint={
            data.charts.productMix[0]
              ? `${data.charts.productMix[0].count}건`
              : '기간 내 결제 없음'
          }
        />
      </div>

      <DashboardCharts data={data} />

      {data.charts.productMix.length > 0 ? (
        <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
          <p className="text-sm font-semibold mb-3">상품별 판매</p>
          <div className="flex flex-wrap gap-2">
            {data.charts.productMix.map((p) => (
              <span
                key={p.code}
                className="rounded-lg border border-cp-border bg-cp-surface px-3 py-1.5 text-xs text-cp-secondary"
              >
                {p.code} · {p.count}건
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-cp-border bg-cp-raised overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cp-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">최근 사주 조회</p>
            <p className="text-[11px] text-cp-dim mt-0.5">
              누가(고객) 누구(조회 인물)를 등록·갱신했는지 · updatedAt 기준
            </p>
          </div>
          <StatusBadge tone="muted">최신 40건</StatusBadge>
        </div>
        <div className="overflow-x-auto show-scrollbar">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-cp-surface/60 text-xs text-cp-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">고객명</th>
                <th className="px-4 py-2.5 font-medium">이메일</th>
                <th className="px-4 py-2.5 font-medium">조회 인물</th>
                <th className="px-4 py-2.5 font-medium">생년월일</th>
                <th className="px-4 py-2.5 font-medium">출생시</th>
                <th className="px-4 py-2.5 font-medium">갱신</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLookups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-cp-muted">
                    표시할 조회 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                data.recentLookups.map((row) => (
                  <tr key={row.entryId} className="border-t border-cp-border/80 hover:bg-cp-hover/40">
                    <td className="px-4 py-2.5 font-medium">{row.customerNickname}</td>
                    <td className="px-4 py-2.5 text-cp-muted text-xs">{row.customerEmail ?? '-'}</td>
                    <td className="px-4 py-2.5">{row.subjectName}</td>
                    <td className="px-4 py-2.5 tabular-nums text-cp-secondary">{row.birthDate}</td>
                    <td className="px-4 py-2.5 tabular-nums text-cp-secondary">{row.birthTime ?? '-'}</td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-cp-muted">{row.updatedAtLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
