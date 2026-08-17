'use client'

import { useMemo, useState } from 'react'
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
  Legend,
  LineChart,
  Line,
} from 'recharts'
import type { DashboardData } from '@/lib/admin/dashboard'
import { SegmentedControl } from '@/components/admin/AdminUi'

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

type TrendMode = 'daily' | 'periodCum' | 'totalCum'
type FunnelMode = 'cohort' | 'active'

function ChartCard({
  title,
  hint,
  stat,
  action,
  children,
}: {
  title: string
  hint?: string
  stat?: string | null
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {hint ? <p className="text-[11px] text-cp-dim mt-0.5">{hint}</p> : null}
          {stat ? <p className="text-[11px] text-cp-secondary mt-1 tabular-nums">{stat}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return <div className="h-48 flex items-center justify-center text-sm text-cp-muted">데이터 없음</div>
}

function formatStat(avg: number | null, median: number | null, unit = '') {
  if (avg == null && median == null) return null
  const a = avg != null ? `평균 ${avg}${unit}` : null
  const m = median != null ? `중앙값 ${median}${unit}` : null
  return [a, m].filter(Boolean).join(' · ')
}

export function DashboardCharts({ data }: { data: DashboardData }) {
  const [trendMode, setTrendMode] = useState<TrendMode>('daily')
  const [revenueMode, setRevenueMode] = useState<'daily' | 'periodCum'>('daily')

  const series = useMemo(() => {
    return data.charts.dates.map((date, i) => {
      const signups =
        trendMode === 'daily'
          ? data.charts.signups[i] ?? 0
          : trendMode === 'periodCum'
            ? data.charts.signupsPeriodCum[i] ?? 0
            : data.charts.signupsTotalCum[i] ?? 0
      const entries =
        trendMode === 'daily'
          ? data.charts.entries[i] ?? 0
          : trendMode === 'periodCum'
            ? data.charts.entriesPeriodCum[i] ?? 0
            : data.charts.entriesTotalCum[i] ?? 0
      const revenue =
        revenueMode === 'daily'
          ? data.charts.revenue[i] ?? 0
          : data.charts.revenuePeriodCum[i] ?? 0
      return { date: date.slice(5), signups, entries, revenue }
    })
  }, [data, trendMode, revenueMode])

  const genderData = data.charts.gender.filter((g) => g.count > 0)
  const elementData = data.charts.dayElement.filter((e) => e.count > 0)
  const juData = data.charts.juUsage.filter((j) => j.count > 0)
  const hasComposition = data.charts.compositionTotal > 0
  const trendHint =
    trendMode === 'daily'
      ? '일별 신규'
      : trendMode === 'periodCum'
        ? '선택 기간 내 누적'
        : '전체 누적 (기간 이전 포함)'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="가입 · 사주 입력"
          hint={trendHint}
          action={
            <SegmentedControl<TrendMode>
              value={trendMode}
              onChange={setTrendMode}
              options={[
                { value: 'daily', label: '신규' },
                { value: 'periodCum', label: '기간누적' },
                { value: 'totalCum', label: '전체누적' },
              ]}
            />
          }
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e8e8ed' }} />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#8b8b93' }}
                />
                <Area type="monotone" dataKey="entries" name="사주" stroke="#f04452" fill="rgba(240,68,82,0.18)" strokeWidth={2} />
                <Area type="monotone" dataKey="signups" name="가입" stroke="#3182f6" fill="rgba(49,130,246,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="매출 (KRW)"
          hint={revenueMode === 'daily' ? '일별 신규' : '선택 기간 내 누적'}
          action={
            <SegmentedControl<'daily' | 'periodCum'>
              value={revenueMode}
              onChange={setRevenueMode}
              options={[
                { value: 'daily', label: '신규' },
                { value: 'periodCum', label: '기간누적' },
              ]}
            />
          }
        >
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
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#8b8b93' }}
                />
                <Bar dataKey="revenue" name="매출" fill="#3182f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="남녀 성비" hint="기간 내 등록 사주 기준">
          {!hasComposition || genderData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
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
                    <span className="w-2 h-2 rounded-full" style={{ background: GENDER_COLORS[g.key] ?? '#8b8b93' }} />
                    {g.label} {g.pct}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="연령대"
          hint="기간 내 사주 · 생년 추정"
          stat={formatStat(data.stats.age.avg, data.stats.age.median, '세')}
        >
          {!hasComposition ? (
            <EmptyChart />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.age} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
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

        <ChartCard title="일간 오행" hint="기간 내 사주 dayElement">
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

        <ChartCard title="주 사용처" hint="기간 내 use:fortune / period / compat">
          {juData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={juData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}주`, '사용']} />
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

        <ChartCard
          title="유저당 사주 수"
          hint="기간 내 엔트리 생성 유저 · 기간 내 건수"
          stat={formatStat(data.stats.entriesPerUser.avg, data.stats.entriesPerUser.median, '개')}
        >
          {data.stats.entriesPerUser.n === 0 ? (
            <EmptyChart />
          ) : (
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
          )}
        </ChartCard>

        <ChartCard
          title="잔액 분포"
          hint="기간 활성 유저(가입·엔트리·결제) 현재 잔액"
          stat={formatStat(data.stats.balance.avg, data.stats.balance.median, '주')}
        >
          {data.stats.balance.n === 0 ? (
            <EmptyChart />
          ) : (
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
          )}
        </ChartCard>
      </div>
    </div>
  )
}

type RetentionMode = 'classic' | 'rolling'

export function GrowthCharts({ data }: { data: DashboardData }) {
  const [retentionMode, setRetentionMode] = useState<RetentionMode>('classic')
  const [stickinessMode, setStickinessMode] = useState<'wau' | 'mau'>('wau')

  const dauRows = useMemo(
    () =>
      data.growth.dauSeries.map((row) => ({
        ...row,
        date: row.date.slice(5),
      })),
    [data.growth.dauSeries],
  )
  const hasDau = dauRows.some((r) => r.dau > 0)
  const retentionRows = data.growth.retention
  const hasRetention = retentionRows.some((r) => r.cohortN > 0)
  const latest = data.growth.latest

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="DAU 구성"
          hint="NAU 신규 가입 · EAU 전날 연속 · RAU 복귀 · 활성=가입/사주/주사용/결제"
          stat={
            latest
              ? `최근일 DAU ${latest.dau} · NAU ${latest.nau} · EAU ${latest.eau} · RAU ${latest.rau}`
              : null
          }
        >
          {!hasDau ? (
            <EmptyChart />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dauRows}>
                  <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e8e8ed' }} />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, color: '#8b8b93' }}
                  />
                  <Area
                    type="monotone"
                    stackId="dau"
                    dataKey="nau"
                    name="NAU"
                    stroke="#22c55e"
                    fill="rgba(34,197,94,0.35)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    stackId="dau"
                    dataKey="eau"
                    name="EAU"
                    stroke="#3182f6"
                    fill="rgba(49,130,246,0.32)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    stackId="dau"
                    dataKey="rau"
                    name="RAU"
                    stroke="#f5a524"
                    fill="rgba(245,165,36,0.32)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Retention"
          hint={
            retentionMode === 'classic'
              ? 'Classic · 가입 코호트가 D+n 당일에 활성인 비율'
              : 'Rolling · 가입 코호트가 D+n 이후 한 번이라도 활성인 비율'
          }
          stat={
            hasRetention
              ? `성숙 코호트 ${retentionRows.find((r) => r.offset === 1)?.cohortN ?? 0}명 기준`
              : null
          }
          action={
            <SegmentedControl<RetentionMode>
              value={retentionMode}
              onChange={setRetentionMode}
              options={[
                { value: 'classic', label: 'Classic' },
                { value: 'rolling', label: 'Rolling' },
              ]}
            />
          }
        >
          {!hasRetention ? (
            <EmptyChart />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={retentionRows}>
                  <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#8b8b93', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: '#e8e8ed' }}
                    formatter={(v: number) => [`${v}%`, retentionMode === 'classic' ? 'Classic' : 'Rolling']}
                  />
                  <Line
                    type="monotone"
                    dataKey={retentionMode}
                    name={retentionMode === 'classic' ? 'Classic' : 'Rolling'}
                    stroke={retentionMode === 'classic' ? '#3182f6' : '#f04452'}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="고착도"
        hint={stickinessMode === 'wau' ? 'DAU / WAU (최근 7일 활성 대비)' : 'DAU / MAU (최근 30일 활성 대비)'}
        stat={
          latest
            ? `최근일 DAU/WAU ${latest.stickinessWau}% · DAU/MAU ${latest.stickinessMau}%`
            : null
        }
        action={
          <SegmentedControl<'wau' | 'mau'>
            value={stickinessMode}
            onChange={setStickinessMode}
            options={[
              { value: 'wau', label: 'DAU/WAU' },
              { value: 'mau', label: 'DAU/MAU' },
            ]}
          />
        }
      >
        {!hasDau ? (
          <EmptyChart />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dauRows}>
                <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#8b8b93', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: '#e8e8ed' }}
                  formatter={(v: number) => [`${v}%`, stickinessMode === 'wau' ? 'DAU/WAU' : 'DAU/MAU']}
                />
                <Line
                  type="monotone"
                  dataKey={stickinessMode === 'wau' ? 'stickinessWau' : 'stickinessMau'}
                  name={stickinessMode === 'wau' ? 'DAU/WAU' : 'DAU/MAU'}
                  stroke="#c4b5fd"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  )
}

export function FunnelStrip({ data }: { data: DashboardData }) {
  const [mode, setMode] = useState<FunnelMode>('cohort')
  const f = mode === 'cohort' ? data.funnel.cohort : data.funnel.active
  const steps = [
    { label: f.labels[0]!, value: f.step1, sub: null as string | null },
    {
      label: f.labels[1]!,
      value: f.step2,
      sub: `${f.rate12}%`,
    },
    {
      label: f.labels[2]!,
      value: f.step3,
      sub:
        mode === 'cohort'
          ? `가입 대비 ${f.rate13}% · 엔트리 대비 ${f.rate23}%`
          : `엔트리 대비 결제 ${f.rate12}% · 기간 결제 유저 ${f.step3}명`,
    },
  ]

  return (
    <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold">전환 퍼널</p>
          <p className="text-[11px] text-cp-dim mt-0.5 max-w-xl">{f.description}</p>
        </div>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'cohort', label: '코호트' },
            { value: 'active', label: '활성' },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={`${mode}-${step.label}`} className="relative rounded-xl border border-cp-border bg-cp-surface/50 px-4 py-3">
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
