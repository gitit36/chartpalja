'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { DashboardData } from '@/lib/admin/dashboard'

const TOOLTIP_STYLE = {
  background: '#1f1e25',
  border: '1px solid #2e2f36',
  borderRadius: 12,
}

const GENDER_COLORS: Record<string, string> = {
  남: '#3182f6',
  여: '#f04452',
  기타: '#8b8b93',
}

const ELEMENT_COLORS: Record<string, string> = {
  木: '#22c55e',
  火: '#f04452',
  土: '#f5a524',
  金: '#e8e8ed',
  水: '#3182f6',
  기타: '#6b6b75',
}

const JU_COLORS: Record<string, string> = {
  fortune: '#c4b5fd',
  period: '#3182f6',
  compat: '#f04452',
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        {hint ? <p className="text-[11px] text-cp-dim mt-0.5">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <div className="h-48 flex items-center justify-center text-sm text-cp-muted">데이터 없음</div>
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  const series = data.charts.dates.map((date, i) => ({
    date: date.slice(5),
    signups: data.charts.signups[i] ?? 0,
    entries: data.charts.entries[i] ?? 0,
    revenue: data.charts.revenue[i] ?? 0,
  }))

  const genderData = data.charts.gender.filter((g) => g.count > 0)
  const elementData = data.charts.dayElement.filter((e) => e.count > 0)
  const juData = data.charts.juUsage.filter((j) => j.count > 0)
  const ageData = data.charts.age
  const hasComposition = data.charts.compositionTotal > 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="가입 · 사주 입력">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e8e8ed' }} />
                <Area type="monotone" dataKey="entries" name="사주" stroke="#f04452" fill="rgba(240,68,82,0.18)" strokeWidth={2} />
                <Area type="monotone" dataKey="signups" name="가입" stroke="#3182f6" fill="rgba(49,130,246,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="매출 (KRW)">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#e8e8ed' }}
                  formatter={(v: number) => [`${v.toLocaleString('ko-KR')}원`, '매출']}
                />
                <Bar dataKey="revenue" name="매출" fill="#3182f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="남녀 성비" hint="기간 내 등록 사주 기준 (유저 성비 ≠ 사주 성비)">
          {!hasComposition || genderData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {genderData.map((g) => (
                      <Cell key={g.key} fill={GENDER_COLORS[g.key] ?? '#8b8b93'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, item) => {
                      const p = (item?.payload as { pct?: number } | undefined)?.pct
                      return [`${v}건 (${p ?? 0}%)`, '']
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center -mt-1">
                  <p className="text-lg font-bold tabular-nums">{data.charts.compositionTotal}</p>
                  <p className="text-[10px] text-cp-dim">사주</p>
                </div>
              </div>
              <div className="flex justify-center gap-4 -mt-1">
                {genderData.map((g) => (
                  <span key={g.key} className="text-xs text-cp-muted flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: GENDER_COLORS[g.key] ?? '#8b8b93' }}
                    />
                    {g.label} {g.pct}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="연령대" hint="생년월일 → 만 나이 추정">
          {!hasComposition ? (
            <EmptyChart />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8b8b93', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, item) => {
                      const p = (item?.payload as { pct?: number } | undefined)?.pct
                      return [`${v}건 (${p ?? 0}%)`, '사주']
                    }}
                  />
                  <Bar dataKey="count" name="사주" fill="#3182f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="일간 오행" hint="dayElement 분포">
          {!hasComposition || elementData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={elementData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, item) => {
                      const p = (item?.payload as { pct?: number } | undefined)?.pct
                      return [`${v}건 (${p ?? 0}%)`, '일간']
                    }}
                  />
                  <Bar dataKey="count" name="일간" radius={[6, 6, 0, 0]}>
                    {elementData.map((e) => (
                      <Cell key={e.key} fill={ELEMENT_COLORS[e.key] ?? '#8b8b93'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="주 사용처" hint="use:fortune / period / compat">
          {juData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={juData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => [`${v}주`, '사용']}
                  />
                  <Bar dataKey="count" name="주" radius={[6, 6, 0, 0]}>
                    {juData.map((j) => (
                      <Cell key={j.key} fill={JU_COLORS[j.key] ?? '#8b8b93'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="유저당 사주 수" hint="전체 누적 · 회원만">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.entriesPerUser} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, _n, item) => {
                    const p = (item?.payload as { pct?: number } | undefined)?.pct
                    return [`${v}명 (${p ?? 0}%)`, '유저']
                  }}
                />
                <Bar dataKey="count" name="유저" fill="#c4b5fd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="잔액 분포" hint="전체 회원 UserBalance">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.balance} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, _n, item) => {
                    const p = (item?.payload as { pct?: number } | undefined)?.pct
                    return [`${v}명 (${p ?? 0}%)`, '유저']
                  }}
                />
                <Bar dataKey="count" name="유저" fill="#f5a524" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

export function FunnelStrip({ data }: { data: DashboardData }) {
  const f = data.funnel
  const steps = [
    { label: '가입', value: f.signups, sub: null as string | null },
    { label: '사주 보유', value: f.usersWithEntry, sub: `${f.entryRate}%` },
    { label: '결제 유저', value: f.payingUsers, sub: `가입 대비 ${f.payRate}% · 엔트리 대비 ${f.payGivenEntry}%` },
  ]

  return (
    <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
      <p className="text-sm font-semibold mb-1">전환 퍼널</p>
      <p className="text-[11px] text-cp-dim mb-4">기간 내 신규 가입 → 사주 생성 유저 → 결제 유저</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.label} className="relative rounded-xl border border-cp-border bg-cp-surface/50 px-4 py-3">
            {i > 0 ? (
              <span className="hidden sm:block absolute -left-2.5 top-1/2 -translate-y-1/2 text-cp-dim text-xs">→</span>
            ) : null}
            <p className="text-xs text-cp-muted">{step.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{step.value.toLocaleString('ko-KR')}</p>
            {step.sub ? <p className="mt-1 text-[11px] text-cp-dim">{step.sub}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
