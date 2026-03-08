'use client'

import React, { useState, useEffect, useRef, useCallback } from "react"
import type { SajuReportJson } from "@/types/saju-report"
import {
  STEM_HANGUL, BRANCH_HANGUL, elementToHangul,
  STEM_ELEMENT, BRANCH_ELEMENT, pillarToHangul,
} from "@/lib/saju/hanja-hangul"

function InfoTip({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <span ref={ref} className="relative inline-block ml-1">
      <button onClick={() => setOpen(!open)} className="w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[8px] leading-none hover:bg-gray-300 focus:outline-none inline-flex items-center justify-center font-normal" aria-label="정보">i</button>
      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-5 z-50 w-56 p-2.5 rounded-lg bg-white shadow-lg border border-gray-100 text-[10px] text-gray-600 leading-relaxed font-normal`}>
          {text}
        </div>
      )}
    </span>
  )
}

const PILLAR_KEYS = ["시주", "일주", "월주", "연주"] as const
const PILLAR_LABELS: Record<string, string> = { "시주": "시주", "일주": "일주(나)", "월주": "월주", "연주": "년주" }
const PILLAR_DATA_IDX: Record<string, number> = { "연주": 0, "월주": 1, "일주": 2, "시주": 3 }

const ELEMENT_BAR_COLORS: Record<string, string> = {
  "목": "bg-green-400", "화": "bg-red-400", "토": "bg-yellow-400", "금": "bg-gray-300", "수": "bg-blue-400",
  "木": "bg-green-400", "火": "bg-red-400", "土": "bg-yellow-400", "金": "bg-gray-300", "水": "bg-blue-400",
}

const ELEMENT_CELL_STYLES: Record<string, { bg: string; ring: string; text: string; badge: string }> = {
  "木": { bg: "bg-green-50",  ring: "ring-green-300", text: "text-green-800", badge: "bg-green-100 text-green-700" },
  "火": { bg: "bg-red-50",    ring: "ring-red-300",   text: "text-red-800",   badge: "bg-red-100 text-red-700" },
  "土": { bg: "bg-amber-50",  ring: "ring-amber-300", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  "金": { bg: "bg-gray-50",   ring: "ring-gray-300",  text: "text-gray-700",  badge: "bg-gray-200 text-gray-600" },
  "水": { bg: "bg-blue-50",   ring: "ring-blue-300",  text: "text-blue-800",  badge: "bg-blue-100 text-blue-700" },
}

const TEN_GOD_KR: Record<string, string> = {
  "比肩": "비견", "劫財": "겁재", "食神": "식신", "傷官": "상관",
  "偏財": "편재", "正財": "정재", "七殺": "칠살", "偏官": "편관",
  "正官": "정관", "偏印": "편인", "正印": "정인", "일원": "일원",
}

const UNSUNG_KR: Record<string, string> = {
  "長生": "장생", "沐浴": "목욕", "冠帶": "관대", "建祿": "건록",
  "帝旺": "제왕", "衰": "쇠", "病": "병", "死": "사",
  "墓": "묘", "絶": "절", "胎": "태", "養": "양",
}

const REL_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  "충": { icon: "\u26A1", color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  "극": { icon: "\uD83D\uDD25", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  "형": { icon: "\u26A0\uFE0F", color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  "합": { icon: "\uD83E\uDD1D", color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  "파": { icon: "\uD83D\uDCA2", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  "해": { icon: "\uD83C\uDF0A", color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
}

const PILLAR_DOT_COLORS: { key: string; label: string; color: string }[] = [
  { key: "시주", label: "시", color: "bg-gray-800" },
  { key: "일주", label: "일", color: "bg-teal-400" },
  { key: "월주", label: "월", color: "bg-orange-400" },
  { key: "년주", label: "년", color: "bg-purple-500" },
]
const BRANCH_KEY_MAP: Record<string, string> = { "연주": "년주", "월주": "월주", "일주": "일주", "시주": "시주" }

function getElementForChar(ch: string): string {
  return STEM_ELEMENT[ch] || BRANCH_ELEMENT[ch] || ""
}

function sh(c: string) { return STEM_HANGUL[c] ?? "" }
function bh(c: string) { return BRANCH_HANGUL[c] ?? "" }
function tgKr(tg: string): string { return TEN_GOD_KR[tg] ?? tg }
function unsungKr(u: string): string { return UNSUNG_KR[u] ?? hanjaToHangul(u) }

const EXTRA_HANJA: Record<string, string> = {
  '桃':'도', '花':'화', '驛':'역', '馬':'마', '羊':'양', '刃':'인',
  '華':'화', '蓋':'개', '將':'장', '星':'성', '攀':'반', '鞍':'안',
  '旺':'왕', '劫':'겁', '煞':'살', '災':'재', '天':'천', '乙':'을',
  '貴':'귀', '人':'인', '文':'문', '昌':'창', '祿':'록', '太':'태',
  '極':'극', '國':'국', '印':'인', '月':'월', '德':'덕', '福':'복',
  '紅':'홍', '艶':'염', '鸞':'란', '喜':'희', '孤':'고', '辰':'진',
  '寡':'과', '宿':'숙', '空':'공', '亡':'망', '六':'육', '害':'해',
  '暗':'암', '學':'학', '堂':'당', '官':'관', '符':'부',
  '白':'백', '虎':'호', '龍':'용', '青':'청', '朱':'주', '雀':'작',
  '玄':'현', '武':'무', '年':'연', '殺':'살', '懸':'현', '光':'광',
  '恩':'은', '赦':'사', '時':'시', '休':'휴', '息':'식', '名':'명',
  '譽':'예', '木':'목', '金':'금', '神':'신', '陰':'음', '陽':'양',
  '差':'차', '錯':'착', '五':'오', '行':'행', '三':'삼', '合':'합',
  '方':'방', '半':'반', '沖':'충', '刑':'형', '破':'파',
}

function hanjaToHangul(text: string): string {
  let result = text
  for (const [hanja, hangul] of Object.entries(STEM_HANGUL)) {
    result = result.replaceAll(hanja, hangul)
  }
  for (const [hanja, hangul] of Object.entries(BRANCH_HANGUL)) {
    result = result.replaceAll(hanja, hangul)
  }
  for (const [hanja, hangul] of Object.entries(EXTRA_HANJA)) {
    result = result.replaceAll(hanja, hangul)
  }
  return result
}

function stripHanja(name: string): string {
  return name.replace(/[\(（][^)）]*[\)）]/g, "").trim()
}

function cleanDisplayValue(val: unknown): string {
  if (val === null || val === undefined) return "-"
  if (typeof val === "string") {
    if (!val.trim()) return "-"
    return val
  }
  if (typeof val === "number") return String(val)
  if (typeof val === "boolean") return val ? "예" : "아니오"
  if (Array.isArray(val)) {
    if (!val.length) return "-"
    return val.map(v => cleanDisplayValue(v)).join(", ")
  }
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
    if (!entries.length) return "-"
    return entries.map(([k, v]) => `${k}: ${cleanDisplayValue(v)}`).join(" / ")
  }
  return String(val)
}

function classifyRelation(text: string): string {
  if (text.includes("충")) return "충"
  if (text.includes("극")) return "극"
  if (text.includes("형")) return "형"
  if (text.includes("합")) return "합"
  if (text.includes("파")) return "파"
  if (text.includes("해")) return "해"
  return ""
}

interface InfoTabProps {
  report: SajuReportJson | null
}

export function InfoTab({ report }: InfoTabProps) {
  if (!report) return <div className="py-12 text-center text-gray-400 text-sm">사주 정보가 없습니다.</div>

  return (
    <div className="px-4 py-4 space-y-5">
      <PillarGrid report={report}/>
      <CoreInfoCard report={report}/>
      <OhangInlineBar report={report}/>
      <RelationsVisual report={report}/>
      <ShinsalBadges report={report}/>
      <DaewoonCarousel report={report}/>
      <SewoonCarousel report={report}/>
    </div>
  )
}

/* ── 사주원국: 4-column grid with detail rows ── */
function PillarGrid({ report }: { report: SajuReportJson }) {
  const wonkuk = report.만세력_사주원국
  if (!wonkuk) return null

  const detail = report.오행십성_상세
  const cheonganArr = detail?.천간 ?? []
  const jijiArr = detail?.["지지(지장간포함)"] ?? detail?.지지_지장간포함 ?? []
  const gm = report.공망
  const gmHit = (gm?.원국_적중 ?? []) as string[]

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-3">사주원국</h3>
      <div className="grid grid-cols-4 gap-2">
        {PILLAR_KEYS.map(p => {
          const pillar = wonkuk[p]
          const stemHanja = pillar?.[0] ?? ""
          const branchHanja = pillar?.[1] ?? ""
          const stemHangul = sh(stemHanja) || stemHanja
          const branchHangul = bh(branchHanja) || branchHanja
          const stemEl = getElementForChar(stemHanja)
          const branchEl = getElementForChar(branchHanja)
          const stemStyle = ELEMENT_CELL_STYLES[stemEl]
          const branchStyle = ELEMENT_CELL_STYLES[branchEl]
          const isMe = p === "일주"
          const idx = PILLAR_DATA_IDX[p] ?? 0
          const stemTG = cheonganArr[idx]?.ten_god ?? ""
          const jiji = jijiArr[idx]
          const branchTG = jiji?.hidden_stems?.[0]?.ten_god ?? ""
          const hidden = jiji?.hidden_stems ?? []
          const unsung = jiji?.["12운성"] ?? ""
          const isGongmang = gmHit.includes(branchHanja)

          return (
            <div key={p} className="flex flex-col items-center gap-1.5">
              {/* Header */}
              <div className={`text-[11px] font-semibold ${isMe ? "text-purple-600" : "text-gray-500"}`}>
                {PILLAR_LABELS[p]}
              </div>
              {/* 천간 cell */}
              <div className={`w-full aspect-square rounded-xl ring-1 flex flex-col items-center justify-center gap-0.5 ${
                stemStyle ? `${stemStyle.bg} ${stemStyle.ring}` : "bg-gray-50 ring-gray-200"
              } ${isMe ? "ring-2 ring-purple-400" : ""}`}>
                <span className={`text-2xl font-bold leading-none ${stemStyle?.text ?? "text-gray-800"}`}>
                  {stemHangul}
                </span>
                {stemEl && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${stemStyle?.badge ?? "bg-gray-100 text-gray-500"}`}>
                    {stemEl}
                  </span>
                )}
                {stemTG && (
                  <span className="text-[9px] text-gray-400 leading-none">{tgKr(stemTG)}</span>
                )}
              </div>
              {/* 지지 cell */}
              <div className={`w-full aspect-square rounded-xl ring-1 flex flex-col items-center justify-center gap-0.5 relative ${
                branchStyle ? `${branchStyle.bg} ${branchStyle.ring}` : "bg-gray-50 ring-gray-200"
              } ${isMe ? "ring-2 ring-purple-400" : ""}`}>
                {isGongmang && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-400 border-2 border-white" title="공망" />}
                <span className={`text-2xl font-bold leading-none ${branchStyle?.text ?? "text-gray-800"}`}>
                  {branchHangul}
                </span>
                {branchEl && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${branchStyle?.badge ?? "bg-gray-100 text-gray-500"}`}>
                    {branchEl}
                  </span>
                )}
                {branchTG && (
                  <span className="text-[9px] text-gray-400 leading-none">{tgKr(branchTG)}</span>
                )}
              </div>
              {/* Detail rows below cells */}
              <div className="w-full space-y-0.5 mt-0.5">
                {/* 지장간 */}
                <div className="text-center">
                  <span className="text-[9px] text-gray-400">
                    {hidden.length
                      ? hidden.map((h: { stem?: string; ten_god?: string }) => sh(h.stem ?? "") || h.stem || "").join(" ")
                      : "-"}
                  </span>
                </div>
                {/* 12운성 */}
                <div className="text-center">
                  <span className="text-[9px] font-medium text-teal-600">{unsung ? unsungKr(unsung) : "-"}</span>
                </div>
                {/* 공망 */}
                {isGongmang && (
                  <div className="text-center">
                    <span className="text-[8px] text-rose-500 font-semibold">공망</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

/* ── 핵심 정보 (공망 제거) ── */
function CoreInfoCard({ report }: { report: SajuReportJson }) {
  const yh = report.용신희신
  const ss = report.신강신약
  const gk = report.격국

  const geokguk = gk
    ? (typeof gk === "string" ? gk : (gk as Record<string, string>).격국 ?? (gk as Record<string, string>).격국명 ?? cleanDisplayValue(gk))
    : "-"
  const ssVal = ss?.판정 ?? "-"
  const yongRaw = yh?.용신
  const yongStr = yongRaw
    ? (typeof yongRaw === "string" && yongRaw.length === 1 ? elementToHangul(yongRaw) : hanjaToHangul(String(yongRaw)))
    : "-"
  const heuiRaw = yh?.희신
  const heuiStr = !heuiRaw || (Array.isArray(heuiRaw) && !heuiRaw.length)
    ? "-"
    : Array.isArray(heuiRaw) ? heuiRaw.map(h => elementToHangul(h)).join(", ") : elementToHangul(String(heuiRaw))
  const gisinRaw = yh?.기신
  const gisinStr = !gisinRaw || (Array.isArray(gisinRaw) && !gisinRaw.length)
    ? "-"
    : Array.isArray(gisinRaw) ? gisinRaw.map(g => elementToHangul(g)).join(", ") : elementToHangul(String(gisinRaw))

  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: "격국", value: geokguk },
    { label: "신강/신약", value: ssVal },
    { label: "용신", value: yongStr, highlight: yongStr !== "-" },
    { label: "희신", value: heuiStr },
    { label: "기신", value: gisinStr },
  ]

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">핵심 정보</h3>
      <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-xs text-gray-500">{r.label}</span>
            <span className={`text-sm font-medium ${r.highlight ? "text-purple-700" : "text-gray-800"}`}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 오행 분포 ── */
function OhangInlineBar({ report }: { report: SajuReportJson }) {
  const ohang = report.오행분포
  if (!ohang) return null

  const entries = Object.entries(ohang).filter(([, v]) => typeof v === "number") as [string, number][]
  const maxVal = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">오행 분포<InfoTip text="사주원국의 8글자(천간4+지지4)에 포함된 오행의 개수예요. 지지 안에 숨어있는 지장간의 가중치까지 포함하기 때문에, 단순히 글자 수를 세는 것과 숫자가 다를 수 있어요." /></h3>
      <div className="space-y-1.5">
        {entries.map(([el, count]) => {
          const pct = Math.round((count / maxVal) * 100)
          const hg = elementToHangul(el)
          return (
            <div key={el} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-600 w-8 shrink-0">{hg}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                {count > 0 && <div className={`h-full rounded-full ${ELEMENT_BAR_COLORS[el] ?? "bg-gray-400"} transition-all`}
                  style={{ width: `${Math.max(pct, 8)}%` }}/>}
              </div>
              <span className="text-[11px] text-gray-500 w-6 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatRelationLabel(hangulRel: string): string {
  const m = hangulRel.match(/^(.+?)\((.+)\)$/)
  if (!m) return hangulRel
  let [, type, rawDetail] = m
  type = type!.replace(/^(지지|천간)/, '')
  const parts = rawDetail!.split(':')
  const branches = (parts.length > 1 ? parts[1] : parts[0])!.replace(/[↯↦×刑克↔]/g, '').trim()
  if (!branches || branches === type) return type!
  return `${branches}${type}`
}

/* ── 사주 관계 (tabbed) ── */
function RelationsVisual({ report }: { report: SajuReportJson }) {
  const rel = report.사주관계
  const [activeTab, setActiveTab] = useState(0)
  if (!rel) return null

  interface PairRel { between: string; label: string; shortLabel: string; relations: string[] }
  const pairs: PairRel[] = []
  const raw = rel as Record<string, unknown>

  const LABEL_MAP: Record<string, string> = {
    "연-월": "년↔월", "연-일": "년↔일", "연-시": "년↔시",
    "월-일": "월↔일", "월-시": "월↔시", "일-시": "일↔시",
  }
  const SHORT_MAP: Record<string, string> = {
    "연-월": "년월", "연-일": "년일", "연-시": "년시",
    "월-일": "월일", "월-시": "월시", "일-시": "일시",
  }

  if (Array.isArray(raw.쌍별관계)) {
    for (const item of raw.쌍별관계) {
      if (typeof item === "object" && item) {
        const obj = item as Record<string, unknown>
        const between = String(obj.between ?? "")
        const rels = Array.isArray(obj.relations) ? obj.relations.map(String) : []
        if (between && rels.length) pairs.push({
          between,
          label: LABEL_MAP[between] ?? hanjaToHangul(between),
          shortLabel: SHORT_MAP[between] ?? hanjaToHangul(between),
          relations: rels,
        })
      }
    }
  }
  if (Array.isArray(raw.다지지관계)) {
    const multiRels: string[] = []
    for (const item of raw.다지지관계) {
      if (typeof item === 'string') {
        multiRels.push(item)
      } else if (typeof item === "object" && item) {
        const obj = item as Record<string, unknown>
        const name = String(obj.name ?? obj.type ?? "")
        const desc = String(obj.description ?? obj.설명 ?? "")
        if (desc || name) multiRels.push(desc || name)
      }
    }
    if (multiRels.length) pairs.push({ between: "다자", label: "다자", shortLabel: "다자", relations: multiRels })
  }

  if (!pairs.length) return null

  const safeIdx = activeTab < pairs.length ? activeTab : 0
  const active = pairs[safeIdx]

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">사주 관계</h3>
      <div className="flex gap-1 mb-2 overflow-x-auto">
        {pairs.map((pair, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
              safeIdx === i ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            {pair.shortLabel}
            <span className="ml-0.5 text-[9px] opacity-70">{pair.relations.length}</span>
          </button>
        ))}
      </div>
      {active && (
        <div className="bg-gray-50 rounded-xl px-3.5 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {active.relations.map((r, j) => {
              const type = classifyRelation(r)
              const style = REL_STYLE[type]
              const converted = hanjaToHangul(r)
              const label = formatRelationLabel(converted)
              return (
                <span key={j} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border ${
                  style?.bg ?? "bg-gray-100 border-gray-200"
                }`}>
                  {style && <span className="text-sm leading-none">{style.icon}</span>}
                  <span className={style?.color ?? "text-gray-700"}>{label}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 신살 · 길성 with pillar-location dots ── */
function ShinsalBadges({ report }: { report: SajuReportJson }) {
  const shinsal = report.신살길성
  const wonkuk = report.만세력_사주원국
  if (!shinsal || typeof shinsal !== "object") return null

  const branchToPillars: Record<string, string[]> = {}
  if (wonkuk) {
    for (const pk of (["연주", "월주", "일주", "시주"] as const)) {
      const pillar = wonkuk[pk]
      const branch = pillar?.[1]
      if (branch) {
        if (!branchToPillars[branch]) branchToPillars[branch] = []
        branchToPillars[branch]!.push(BRANCH_KEY_MAP[pk] ?? pk)
      }
    }
  }

  interface ShinsalItem { name: string; pillars: Set<string> }
  const items: ShinsalItem[] = []

  for (const [rawName, targets] of Object.entries(shinsal)) {
    const name = hanjaToHangul(stripHanja(rawName))
    if (!name) continue
    const pset = new Set<string>()
    if (Array.isArray(targets)) {
      for (const t of targets) {
        const branch = String(t)
        const mapped = branchToPillars[branch]
        if (mapped) mapped.forEach(p => pset.add(p))
      }
    }
    items.push({ name, pillars: pset })
  }

  if (!items.length) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 text-sm">신살 · 길성</h3>
        <div className="flex items-center gap-2">
          {PILLAR_DOT_COLORS.map(d => (
            <div key={d.key} className="flex items-center gap-0.5">
              <span className={`w-[6px] h-[6px] rounded-full ${d.color}`}/>
              <span className="text-[9px] text-gray-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg px-2.5 py-1 font-medium">
            {item.name}
            {item.pillars.size > 0 && (
              <span className="flex flex-col gap-[2px] ml-0.5">
                {PILLAR_DOT_COLORS.map(d =>
                  item.pillars.has(d.key) ? (
                    <span key={d.key} className={`w-[5px] h-[5px] rounded-full ${d.color}`}/>
                  ) : null
                )}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── 대운 타임라인 ── */
function DaewoonCarousel({ report }: { report: SajuReportJson }) {
  const blocks = report.대운?.대운기둥10
  if (!blocks?.length) return null

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">대운 타임라인</h3>
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-2 snap-x snap-mandatory" style={{ minWidth: "max-content" }}>
          {blocks.map((b, i) => {
            const pillar = b.daewoon_pillar ?? ""
            const hangul = pillarToHangul(pillar)
            return (
              <div key={i} className="snap-start shrink-0 w-[100px] bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-center">
                <div className="text-base font-bold text-gray-800">{hangul || pillar}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {b.start_age_years ?? 0}~{b.end_age_years ?? 0}세
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── 세운 (연운) ── */
function SewoonCarousel({ report }: { report: SajuReportJson }) {
  const raw = report.세운
  if (!raw) return null

  let entries: [string, string][] = []
  if (raw.연도별 && typeof raw.연도별 === "object") {
    entries = Object.entries(raw.연도별).sort(([a], [b]) => Number(a) - Number(b))
  } else if (typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (/^\d{4}$/.test(k) && typeof v === "string") entries.push([k, v])
    }
    entries.sort(([a], [b]) => Number(a) - Number(b))
  }
  if (!entries.length) return null

  const currentYear = new Date().getFullYear()

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">세운 (연운)</h3>
      <div className="overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-2 snap-x snap-mandatory" style={{ minWidth: "max-content" }}>
          {entries.map(([year, pillar]) => {
            const isCurrent = Number(year) === currentYear
            const hangul = pillarToHangul(pillar)
            return (
              <div key={year} className={`snap-start shrink-0 w-[80px] border rounded-xl p-2.5 text-center ${
                isCurrent ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-gray-100"
              }`}>
                <div className="text-[11px] text-gray-500">{year}</div>
                <div className={`text-base font-bold ${isCurrent ? "text-purple-700" : "text-gray-800"}`}>{hangul || pillar}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
