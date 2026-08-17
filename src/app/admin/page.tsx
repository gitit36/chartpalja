import { getDashboardData } from '@/lib/admin/dashboard'
import { formatKstDate, parseAdminRange, startOfKstDay } from '@/lib/admin/dates'
import { MetricCard, MetricGroup, StatusBadge } from '@/components/admin/AdminUi'
import { AdminRangePicker } from '@/components/admin/AdminRangePicker'
import { DashboardCharts, FunnelStrip, GrowthCharts } from '@/components/admin/DashboardCharts'

export const dynamic = 'force-dynamic'

function formatWon(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const range = parseAdminRange(sp)
  const data = await getDashboardData(range)
  const s = data.summary
  const todayKey = formatKstDate(startOfKstDay())

  const topGender = [...data.charts.gender].sort((a, b) => b.count - a.count)[0]
  const topAge = [...data.charts.age].sort((a, b) => b.count - a.count)[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">대시보드</h1>
          <p className="mt-1 text-sm text-cp-muted">
            {data.rangeLabel} 기준 · 상단 기간을 바꾸면 아래 수치가 함께 갱신됩니다
          </p>
        </div>
        <AdminRangePicker
          preset={range.preset}
          fromKey={range.fromKey}
          toKey={range.toKey}
          todayKey={todayKey}
        />
      </div>

      <div className="space-y-3">
        <MetricGroup title="성장">
          <MetricCard label="신규 가입" value={s.signups} hint={`오늘 ${s.today.signups}`} />
          <MetricCard
            label="사주 생성"
            value={s.entries}
            hint={`게스트 ${s.guestEntries} · 오늘 ${s.today.entries}`}
          />
          <MetricCard
            label="코호트 전환"
            value={`${s.payConvertRate}%`}
            hint={`가입→결제 · 엔트리 ${s.entryConvertRate}%`}
          />
          <MetricCard
            label="공유 사주"
            value={s.sharedEntries}
            hint={`기간 내 생성 · ${s.shareRate}%`}
          />
        </MetricGroup>

        <GrowthCharts data={data} />

        <MetricGroup title="매출">
          <MetricCard label="결제 건수" value={s.paidOrders} hint={`오늘 ${s.today.paidOrders}`} />
          <MetricCard
            label="매출 (KRW)"
            value={formatWon(s.revenueKrw)}
            hint={`오늘 ${formatWon(s.today.revenueKrw)}`}
          />
          <MetricCard
            label="결제 유저"
            value={s.payingUsers}
            hint={`ARPU ${formatWon(s.arpu)} · 기간 활성`}
          />
          <MetricCard label="쿠폰 사용" value={s.couponRedeems} hint="기간 내 redemption" />
        </MetricGroup>

        <MetricGroup title="이용 · 리스크">
          <MetricCard label="주 사용량" value={`${s.juUsed}주`} hint="기간 내 use:*" />
          <MetricCard
            label="잔액 0주 비율"
            value={`${s.zeroBalanceRate}%`}
            hint="기간 활성 유저 기준"
          />
          <MetricCard
            label="미처리 문의"
            value={s.openInquiries}
            hint={s.openInquiries > 0 ? '현재 open 전체' : '없음'}
          />
          <MetricCard
            label="구성 TOP"
            value={
              topGender && topGender.count > 0
                ? `${topGender.label} ${topGender.pct}%`
                : '-'
            }
            hint={
              topAge && topAge.count > 0
                ? `연령 ${topAge.label} ${topAge.pct}%`
                : '기간 내 사주 없음'
            }
          />
        </MetricGroup>
      </div>

      <FunnelStrip data={data} />

      <DashboardCharts data={data} />

      {(data.charts.productMix.length > 0 ||
        data.charts.paymentMethods.length > 0 ||
        data.charts.ownership.some((o) => o.count > 0)) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.charts.productMix.length > 0 ? (
            <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
              <p className="text-[11px] font-semibold tracking-wide text-cp-dim uppercase mb-3">상품별 판매</p>
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
              <p className="text-[11px] font-semibold tracking-wide text-cp-dim uppercase mb-3">결제수단</p>
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
            <p className="text-[11px] font-semibold tracking-wide text-cp-dim uppercase mb-3">회원 · 게스트 사주</p>
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
      )}

      <section className="rounded-2xl border border-cp-border bg-cp-raised overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cp-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">최근 사주 조회</p>
            <p className="text-[11px] text-cp-dim mt-0.5">
              {data.rangeLabel} 내 갱신분 · updatedAt 기준
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
                    해당 기간에 표시할 조회 기록이 없습니다.
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
