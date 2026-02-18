'use client'

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  BarChart,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Cell,
  Customized,
} from 'recharts'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import type { ChartDatum, SeasonBand } from '@/lib/saju/life-chart-data'

interface LifeFortuneChartProps {
  report: SajuReportJson | null
  birthYear: number | null
  displayName?: string
  userName?: string
}

const SEASON_COLORS: Record<string, string> = {
  '확장기': 'rgba(46,204,113,0.12)',
  '안정기': 'rgba(52,152,219,0.08)',
  '전환기': 'rgba(241,196,15,0.12)',
  '인내기': 'rgba(149,165,166,0.12)',
  '격변기': 'rgba(231,76,60,0.12)',
  '평온기': 'rgba(255,255,255,0.04)',
}

const PANELS = [
  { key: 'yongshin' as const, label: '유리한 흐름', color: '#9b59b6', desc: '나에게 도움 되는 기운이 얼마나 강한지 보여줘요' },
  { key: 'energy' as const, label: '변화의 파도', color: '#95a5a6', desc: '인생에서 큰 변화가 밀려오는 시기를 보여줘요' },
  { key: 'noble' as const, label: '귀인의 도움', color: '#f39c12', desc: '누군가의 도움이 큰 시기 vs 혼자 헤쳐나가는 시기' },
  { key: 'unseong' as const, label: '에너지 사이클', color: '#e67e22', desc: '생명력이 상승하고 하강하는 자연스러운 리듬' },
  { key: 'ohang' as const, label: '오행 균형', color: '#3498db', desc: '목·화·토·금·수 다섯 기운의 밸런스 상태' },
  { key: 'tengo' as const, label: '역할 분포', color: '#1abc9c', desc: '자아·표현·재물·직업·학업 에너지 비율' },
  { key: 'event' as const, label: '주요 이벤트', color: '#e74c3c', desc: '이직, 연애, 건강 등 주요 생애 이벤트 발생 가능성' },
]

type PanelKey = (typeof PANELS)[number]['key']

const THIS_YEAR = new Date().getFullYear()

const CHART_MARGIN = { top: 18, right: 12, bottom: 24, left: 6 }
const SUB_MARGIN  = { top: 4,  right: 12, bottom: 0,  left: 6 }
const YAXIS_W = 30
const CURSOR_STYLE = { stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 2' }

function CandleShape(props: Record<string, unknown>) {
  const {
    x: rawX, y: barY, width: rawW, height: barHeight, payload,
  } = props as {
    x: number; y: number; width: number; height: number; payload: ChartDatum
  }
  const { open, close, high, low } = payload
  if (!barHeight || !close) return null
  const isYang = close >= open
  const color = isYang ? '#e74c3c' : '#3498db'
  const pixelBottom = barY + barHeight
  const pxPerUnit = barHeight / close
  const toY = (v: number) => pixelBottom - v * pxPerUnit
  const yHigh = toY(high), yLow = toY(low), yOpen = toY(open), yClose = toY(close)
  const bodyTop = Math.min(yOpen, yClose)
  const bodyHeight = Math.max(2, Math.abs(yOpen - yClose))
  const cx = rawX + rawW / 2
  const barW = Math.max(rawW * 0.6, 3)
  const barX = rawX + (rawW - barW) / 2
  return (
    <g>
      <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
      <rect x={barX} y={bodyTop} width={barW} height={bodyHeight}
            fill={color} fillOpacity={isYang ? 0.9 : 0.65} rx={1} />
    </g>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ThisYearMarker(props: any) {
  const { formattedGraphicalItems, xAxisMap } = props
  if (!formattedGraphicalItems?.length || !xAxisMap) return null
  const xAxis = Object.values(xAxisMap)[0] as { scale?: (v: number) => number } | undefined
  if (!xAxis?.scale) return null
  const barItems = formattedGraphicalItems.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => item?.item?.props?.dataKey === 'close'
  )
  if (!barItems?.props?.points) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pt = barItems.props.points.find((p: any) => p?.payload?.year === THIS_YEAR)
  if (!pt) return null
  const d = pt.payload as ChartDatum
  const cx = xAxis.scale(THIS_YEAR)
  if (typeof cx !== 'number' || isNaN(cx)) return null
  if (!pt.height || !d.close) return null
  const pxPerUnit = pt.height / d.close
  const yHigh = (pt.y + pt.height) - d.high * pxPerUnit
  const tipY = yHigh - 6
  return (
    <g>
      <polygon points={`${cx-4},${tipY-2} ${cx+4},${tipY-2} ${cx},${tipY+4}`} fill="#9ca3af"/>
      <text x={cx} y={tipY-6} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#6b7280">올해</text>
    </g>
  )
}

function InfoPanel({ d }: { d: ChartDatum | null }) {
  if (!d) return (<div className="text-gray-400 text-xs text-center py-4">차트 위에 마우스를 올려보세요</div>)
  const cc = d.close >= d.open ? 'text-red-500' : 'text-blue-500'
  return (
    <div className="text-xs space-y-2">
      <div className="text-center">
        <div className="text-sm font-bold text-gray-800">{d.year}년</div>
        <div className="text-gray-500">만 {d.age}세</div>
      </div>
      {d.seasonTag && (
        <div className="text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
            d.seasonTag === '확장기' ? 'bg-green-100 text-green-700' :
            d.seasonTag === '격변기' ? 'bg-red-100 text-red-700' :
            d.seasonTag === '인내기' ? 'bg-gray-100 text-gray-700' :
            d.seasonTag === '전환기' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-50 text-blue-600'
          }`}>{d.seasonEmoji} {d.seasonTag}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-100">
        <div className="text-gray-500">기본운</div><div className="text-right">{d.open}</div>
        <div className="text-gray-500">실제운</div><div className={`text-right font-bold ${cc}`}>{d.close}</div>
        <div className="text-gray-500">최고</div><div className="text-right">{d.high}</div>
        <div className="text-gray-500">최저</div><div className="text-right">{d.low}</div>
      </div>
      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-100">
        <div className="text-gray-500">유리한 흐름</div><div className="text-right">{d.yongshinPower > 0 ? '+' : ''}{d.yongshinPower.toFixed(2)}</div>
        <div className="text-gray-500">변화 강도</div><div className="text-right">{d.energyTotal.toFixed(1)}</div>
        <div className="text-gray-500">귀인 도움</div><div className="text-right">{d.noblePower > 0 ? '+' : ''}{d.noblePower}</div>
        <div className="text-gray-500">오행 균형</div><div className="text-right">{(d.ohangBalance * 100).toFixed(0)}%</div>
      </div>
      <div className="grid grid-cols-5 gap-0.5 pt-1 border-t border-gray-100 text-[10px] text-center">
        <div><div className="text-gray-400">직업</div><div className="font-bold">{d.domainJob.toFixed(1)}</div></div>
        <div><div className="text-gray-400">재물</div><div className="font-bold">{d.domainWealth.toFixed(1)}</div></div>
        <div><div className="text-gray-400">건강</div><div className="font-bold">{d.domainHealth.toFixed(1)}</div></div>
        <div><div className="text-gray-400">연애</div><div className="font-bold">{d.domainLove.toFixed(1)}</div></div>
        <div><div className="text-gray-400">결혼</div><div className="font-bold">{d.domainMarriage.toFixed(1)}</div></div>
      </div>
    </div>
  )
}

function EmptyTooltip() { return null }

function SubLabel({ text }: { text: string }) {
  return <div className="text-[10px] text-gray-500 mb-0.5 text-right pr-3">{text}</div>
}

export function LifeFortuneChart({
  report, birthYear, displayName = '인생 총운', userName,
}: LifeFortuneChartProps) {
  const [panels, setPanels] = useState<Record<PanelKey, boolean>>({
    yongshin: false, energy: false, noble: false, unseong: false,
    ohang: false, tengo: false, event: false,
  })
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [hoveredData, setHoveredData] = useState<ChartDatum | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chartPayload: ChartPayload | null | undefined = report?.chartData
  const chartData = useMemo(() => {
    if (birthYear == null) return null
    return buildLifeChartData(chartPayload, report, birthYear)
  }, [chartPayload, report, birthYear])
  const hasEngineData = !!(chartPayload?.['연도별_타임라인']?.length)

  const togglePanel = useCallback((key: PanelKey) => {
    setPanels(prev => ({ ...prev, [key]: !prev[key] }))
    const panel = PANELS.find(p => p.key === key)
    if (panel) {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      setToastMsg(panel.desc)
      toastTimer.current = setTimeout(() => setToastMsg(null), 4000)
    }
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = useCallback((state: any) => {
    if (state?.activeTooltipIndex != null) setSelectedIdx(state.activeTooltipIndex)
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseMove = useCallback((state: any) => {
    if (state?.activePayload?.length) setHoveredData(state.activePayload[0]?.payload ?? null)
  }, [])
  const handleMouseLeave = useCallback(() => setHoveredData(null), [])

  const currentYearData = useMemo(() => {
    if (!chartData) return null
    return chartData.data.find(d => d.year === THIS_YEAR) ?? null
  }, [chartData])
  const displayData = hoveredData ?? currentYearData
  const titleText = userName ? `${userName}님의 ${displayName}` : displayName

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  if (!chartData) {
    return (
      <div className="w-full min-h-[360px] flex items-center justify-center rounded-xl bg-gray-50 border border-gray-100 p-8">
        <p className="text-gray-500 text-sm">
          {report == null || birthYear == null
            ? '사주 분석 결과와 생년이 필요합니다.'
            : '대운 데이터가 없어 차트를 그릴 수 없습니다.'}
        </p>
      </div>
    )
  }

  const { data, years, boundaryYears, seasonBands } = chartData
  const xDomain = [years[0]!, years[years.length - 1]!] as [number, number]
  const boundaries = boundaryYears.slice(1)
  const selectedData = selectedIdx != null ? data[selectedIdx] : null

  return (
    <div className="w-full rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
      <h2 className="text-xl font-bold text-gray-800 mb-2">{titleText}</h2>

      {/* ===== 2칸 flex: 왼쪽(차트열) + 오른쪽(패널) ===== */}
      <div className="flex gap-3 items-start">

        {/* ── 왼쪽 칸: 메인 차트 + 보조지표 전부 ── */}
        <div className="flex-1 min-w-0">

          {/* Legend: 우측 상단 */}
          <div className="flex justify-end items-center gap-3 text-[10px] text-gray-500 mb-1 pr-3">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-red-500 rounded-sm"/> 상승(양봉)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-blue-500 rounded-sm"/> 하락(음봉)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-yellow-400"/> 대운 흐름</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-400"/> 연간 운세</span>
          </div>

          {/* 메인 차트 */}
          <div className="w-full h-[420px] min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} syncId="lifeChart"
                margin={CHART_MARGIN}
                onClick={handleChartClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb"/>
                <XAxis dataKey="year" type="number" domain={xDomain}
                  tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={56} tickCount={20}/>
                <YAxis domain={[0, 110]} tick={{ fontSize: 10 }} width={YAXIS_W}/>
                <Tooltip content={<EmptyTooltip/>} cursor={CURSOR_STYLE}/>

                {hasEngineData && seasonBands.map((band: SeasonBand, i: number) => (
                  <ReferenceArea key={i} x1={band.startYear} x2={band.endYear}
                    fill={SEASON_COLORS[band.tag] ?? 'rgba(0,0,0,0.03)'} fillOpacity={1}/>
                ))}
                {boundaries.map(yr => (
                  <ReferenceLine key={yr} x={yr} stroke="#ff7300" strokeDasharray="3 3" strokeOpacity={0.7}/>
                ))}

                <Bar dataKey="close" name="운세 캔들" shape={<CandleShape/>} isAnimationActive={false}/>
                <Line type="stepAfter" dataKey="trend" stroke="#ffd700" strokeWidth={2.5}
                  dot={false} name="대운 흐름" strokeOpacity={0.8}/>
                <Line type="monotone" dataKey="score" stroke="#82ca9d" strokeWidth={1.2}
                  dot={false} name="연간 운세"/>
                <Customized component={ThisYearMarker} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 모바일: 보조지표 토글 */}
          {hasEngineData && (
            <div className="md:hidden flex flex-wrap gap-1.5 mt-3 mb-2">
              {PANELS.map(opt => (
                <button key={opt.key} onClick={() => togglePanel(opt.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    panels[opt.key] ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`} style={panels[opt.key] ? { backgroundColor: opt.color } : undefined}
                >{opt.label}</button>
              ))}
            </div>
          )}
          {/* 모바일: 정보 패널 */}
          <div className="md:hidden mt-2 bg-gray-50 rounded-xl border border-gray-100 p-3">
            <div className="text-[10px] text-gray-400 mb-1 text-center">
              {hoveredData ? `${hoveredData.year}년 정보` : '올해 정보'}
            </div>
            <InfoPanel d={displayData}/>
          </div>

          {/* 토스트 */}
          {toastMsg && (
            <div className="mt-2 text-center animate-pulse">
              <span className="inline-block bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg">{toastMsg}</span>
            </div>
          )}

          {/* ── 보조지표 그래프들 (메인 차트와 동일한 컨테이너 내부) ── */}
          {hasEngineData && (
            <>
              {panels.yongshin && (
                <div className="h-[120px] mt-4">
                  <SubLabel text="유리한 흐름 (-1 ~ 1)" />
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} syncId="lifeChart" margin={SUB_MARGIN}>
                      <XAxis dataKey="year" type="number" domain={xDomain} hide/>
                      <YAxis domain={[-1, 1]} ticks={[-1,-0.5,0,0.5,1]} tick={{ fontSize: 9 }} width={YAXIS_W}/>
                      <Tooltip content={<EmptyTooltip/>} cursor={CURSOR_STYLE}/>
                      <ReferenceLine y={0} stroke="#666"/>
                      <Area dataKey="yongshinPower" stroke="#9b59b6" fill="#9b59b6" fillOpacity={0.2} dot={false} name="유리한 흐름"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {panels.energy && (
                <div className="h-[100px] mt-4">
                  <SubLabel text="변화의 파도 (녹색=조화, 빨간=충돌)" />
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} syncId="lifeChart" margin={SUB_MARGIN}>
                      <XAxis dataKey="year" type="number" domain={xDomain} hide/>
                      <YAxis domain={[0, 8]} tick={{ fontSize: 9 }} width={YAXIS_W}/>
                      <Tooltip content={<EmptyTooltip/>} cursor={CURSOR_STYLE}/>
                      <Bar dataKey="energyTotal" name="변화 강도" isAnimationActive={false}>
                        {data.map((d, i) => (
                          <Cell key={i} fill={d.energyDirection >= 0 ? '#27ae60' : '#e74c3c'} fillOpacity={0.7}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {panels.noble && (
                <div className="h-[100px] mt-4">
                  <SubLabel text="귀인의 도움 (양수=도움, 음수=혼자 극복)" />
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} syncId="lifeChart" margin={SUB_MARGIN}>
                      <XAxis dataKey="year" type="number" domain={xDomain} hide/>
                      <YAxis domain={[-15, 15]} tick={{ fontSize: 9 }} width={YAXIS_W}/>
                      <Tooltip content={<EmptyTooltip/>} cursor={CURSOR_STYLE}/>
                      <ReferenceLine y={0} stroke="#666"/>
                      <Bar dataKey="noblePower" name="귀인 도움" isAnimationActive={false}>
                        {data.map((d, i) => (
                          <Cell key={i} fill={d.noblePower >= 0 ? '#f39c12' : '#8e44ad'} fillOpacity={0.7}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {panels.unseong && (
                <div className="h-[120px] mt-4">
                  <SubLabel text="에너지 사이클 (상승 → 절정 → 하강 → 소멸 반복)" />
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} syncId="lifeChart" margin={SUB_MARGIN}>
                      <XAxis dataKey="year" type="number" domain={xDomain} hide/>
                      <YAxis domain={[-12, 12]} tick={{ fontSize: 9 }} width={YAXIS_W}/>
                      <Tooltip content={<EmptyTooltip/>} cursor={CURSOR_STYLE}/>
                      <ReferenceLine y={0} stroke="#666"/>
                      <Line dataKey="unseongCurve" stroke="#e67e22" strokeWidth={2} dot={false} name="에너지 사이클"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {panels.ohang && (
                <div className="h-[100px] mt-4">
                  <SubLabel text="오행 균형도 (0=편중, 1=완전균형)" />
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} syncId="lifeChart" margin={SUB_MARGIN}>
                      <XAxis dataKey="year" type="number" domain={xDomain} hide/>
                      <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} width={YAXIS_W}/>
                      <Tooltip content={<EmptyTooltip/>} cursor={CURSOR_STYLE}/>
                      <ReferenceLine y={0.5} stroke="#999" strokeDasharray="3 3"/>
                      <Line dataKey="ohangBalance" stroke="#3498db" dot={false} name="오행 균형" strokeWidth={1.5}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {panels.tengo && (
                <div className="mt-4">
                  <SubLabel text={`역할 분포 ${selectedData ? `(${selectedData.year}년)` : '— 차트에서 연도를 클릭하세요'}`} />
                  {selectedData ? (
                    <div className="flex justify-center">
                      <div className="w-[280px] h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={[
                            { axis: '자아', value: selectedData['tengo비겁'] },
                            { axis: '표현', value: selectedData['tengo식상'] },
                            { axis: '재물', value: selectedData['tengo재성'] },
                            { axis: '직업', value: selectedData['tengo관살'] },
                            { axis: '학업', value: selectedData['tengo인성'] },
                          ]}>
                            <PolarGrid/><PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }}/>
                            <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 8 }}/>
                            <Radar dataKey="value" stroke="#1abc9c" fill="#1abc9c" fillOpacity={0.3}/>
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-xs py-4">
                      메인 차트에서 연도를 클릭하면 해당 연도의 역할 분포를 확인할 수 있어요
                    </div>
                  )}
                </div>
              )}
              {panels.event && (
                <div className="mt-4">
                  <SubLabel text={`주요 이벤트 ${selectedData ? `(${selectedData.year}년)` : '— 차트에서 연도를 클릭하세요'}`} />
                  {selectedData ? (
                    <div className="h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: '이직/전환', prob: selectedData.eventCareer },
                          { name: '연애/결혼', prob: selectedData.eventLove },
                          { name: '건강 주의', prob: selectedData.eventHealth },
                          { name: '재물 기회', prob: selectedData.eventWealth },
                          { name: '학업/시험', prob: selectedData.eventStudy },
                          { name: '대인 관계', prob: selectedData.eventConflict },
                        ]} layout="vertical" margin={{ left: 6, right: 12, top: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3"/>
                          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }}/>
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60}/>
                          <Bar dataKey="prob" name="확률" isAnimationActive={false}>
                            {['#e74c3c','#e91e63','#ff9800','#4caf50','#2196f3','#9c27b0'].map((c, i) => (
                              <Cell key={i} fill={c} fillOpacity={0.8}/>
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-xs py-4">
                      메인 차트에서 연도를 클릭하면 해당 연도의 이벤트 확률을 확인할 수 있어요
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>{/* end 왼쪽 칸 */}

        {/* ── 오른쪽 패널 ── */}
        <div className="w-[200px] shrink-0 hidden md:flex flex-col gap-3 sticky top-4 self-start">
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
            <div className="text-[10px] text-gray-400 mb-1 text-center">
              {hoveredData ? `${hoveredData.year}년 정보` : '올해 정보'}
            </div>
            <InfoPanel d={displayData}/>
          </div>
          {hasEngineData && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-2 space-y-1">
              <div className="text-[10px] text-gray-400 mb-1 text-center">보조지표</div>
              {PANELS.map(opt => (
                <button key={opt.key} onClick={() => togglePanel(opt.key)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-2 ${
                    panels[opt.key] ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`} style={panels[opt.key] ? { backgroundColor: opt.color } : undefined}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${panels[opt.key] ? 'bg-white/60' : ''}`}
                    style={!panels[opt.key] ? { backgroundColor: opt.color } : undefined}/>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>{/* end flex */}
    </div>
  )
}
