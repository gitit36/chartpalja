import Link from 'next/link'
import { getDashboardData } from '@/lib/admin/dashboard'
import { parseRangeKey, type AdminRangeKey } from '@/lib/admin/dates'
import { MetricCard, StatusBadge } from '@/components/admin/AdminUi'
import { DashboardCharts, FunnelStrip } from '@/components/admin/DashboardCharts'

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

  const topGender = [...data.charts.gender].sort((a, b) => b.count - a.count)[0]
  const topAge = [...data.charts.age].sort((a, b) => b.count - a.count)[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">대시보드</h1>
          <p className="mt-1 text-sm text-cp-muted">가입 · 사주 · 결제 · 구성 통계 · 최근 조회</p>
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
        <MetricCard
          label="결제 전환율"
          value={`${s.payConvertRate}%`}
          hint={`결제 유저 ${s.payingUsers}명 · ARPU ${formatWon(s.arpu)}`}
        />
        <MetricCard label="쿠폰 사용" value={s.couponRedeems} />
        <MetricCard label="주 사용량" value={`${s.juUsed}주`} hint="use:* 합계" />
        <MetricCard
          label="잔액 0주 비율"
          value={`${s.zeroBalanceRate}%`}
          hint="전체 회원 잔액 기준"
        />
        <MetricCard
          label="공유 사주"
          value={s.sharedEntries}
          hint={`기간 내 생성분 · ${s.shareRate}%`}
        />
        <MetricCard
          label="미처리 문의"
          value={s.openInquiries}
          hint={s.openInquiries > 0 ? '확인 필요' : '없음'}
        />
        <MetricCard
          label="성비 TOP"
          value={topGender && topGender.count > 0 ? `${topGender.label} ${topGender.pct}%` : '-'}
          hint={topGender ? `${topGender.count}건` : '기간 내 사주 없음'}
        />
        <MetricCard
          label="연령 TOP"
          value={topAge && topAge.count > 0 ? topAge.label : '-'}
          hint={topAge && topAge.count > 0 ? `${topAge.count}건 (${topAge.pct}%)` : '기간 내 사주 없음'}
        />
      </div>

      <FunnelStrip data={data} />

      <DashboardCharts data={data} />

      {(data.charts.productMix.length > 0 || data.charts.paymentMethods.length > 0 || data.charts.ownership.some((o) => o.count > 0)) ? (
        <div className="grid gap-4 lg:grid-cols-3">
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

          {data.charts.paymentMethods.length > 0 ? (
            <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
              <p className="text-sm font-semibold mb-3">결제수단</p>
              <div className="flex flex-wrap gap-2">
                {data.charts.paymentMethods.map((p) => (
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

          <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
            <p className="text-sm font-semibold mb-3">회원 · 게스트 사주</p>
            <div className="flex flex-wrap gap-2">
              {data.charts.ownership.map((o) => (
                <span
                  key={o.key}
                  className="rounded-lg border border-cp-border bg-cp-surface px-3 py-1.5 text-xs text-cp-secondary"
                >
                  {o.label} · {o.count}건 ({o.pct}%)
                </span>
              ))}
            </div>
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
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-cp-surface/60 text-xs text-cp-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">고객명</th>
                <th className="px-4 py-2.5 font-medium">이메일</th>
                <th className="px-4 py-2.5 font-medium">조회 인물</th>
                <th className="px-4 py-2.5 font-medium">성별</th>
                <th className="px-4 py-2.5 font-medium">생년월일</th>
                <th className="px-4 py-2.5 font-medium">출생시</th>
                <th className="px-4 py-2.5 font-medium">갱신</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLookups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-cp-muted">
                    표시할 조회 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                data.recentLookups.map((row) => (
                  <tr key={row.entryId} className="border-t border-cp-border/80 hover:bg-cp-hover/40">
                    <td className="px-4 py-2.5 font-medium">{row.customerNickname}</td>
                    <td className="px-4 py-2.5 text-cp-muted text-xs">{row.customerEmail ?? '-'}</td>
                    <td className="px-4 py-2.5">{row.subjectName}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                          row.gender === '남'
                            ? 'bg-cp-down-muted text-cp-down'
                            : row.gender === '여'
                              ? 'bg-cp-up-muted text-cp-up'
                              : 'bg-cp-surface text-cp-muted'
                        }`}
                      >
                        {row.gender}
                      </span>
                    </td>
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
