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
} from 'recharts'
import type { DashboardData } from '@/lib/admin/dashboard'

export function DashboardCharts({ data }: { data: DashboardData }) {
  const series = data.charts.dates.map((date, i) => ({
    date: date.slice(5),
    signups: data.charts.signups[i] ?? 0,
    entries: data.charts.entries[i] ?? 0,
    revenue: data.charts.revenue[i] ?? 0,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
        <p className="text-sm font-semibold mb-3">가입 · 사주 입력</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1f1e25', border: '1px solid #2e2f36', borderRadius: 12 }}
                labelStyle={{ color: '#e8e8ed' }}
              />
              <Area type="monotone" dataKey="entries" name="사주" stroke="#f04452" fill="rgba(240,68,82,0.18)" strokeWidth={2} />
              <Area type="monotone" dataKey="signups" name="가입" stroke="#3182f6" fill="rgba(49,130,246,0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-cp-border bg-cp-raised p-4">
        <p className="text-sm font-semibold mb-3">매출 (KRW)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid stroke="rgba(78,78,90,0.35)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8b93', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1f1e25', border: '1px solid #2e2f36', borderRadius: 12 }}
                labelStyle={{ color: '#e8e8ed' }}
                formatter={(v: number) => [`${v.toLocaleString('ko-KR')}원`, '매출']}
              />
              <Bar dataKey="revenue" name="매출" fill="#3182f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
