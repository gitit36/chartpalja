'use client'

import React, { useState, useEffect, useRef } from "react"
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
  "長生": "장생", "沐浴": "목욕", "冠帶": "관대", "建祿": "건록", "臨官": "건록",
  "帝旺": "제왕", "衰": "쇠", "病": "병", "死": "사",
  "墓": "묘", "絶": "절", "胎": "태", "養": "양",
  "장생": "장생", "목욕": "목욕", "관대": "관대", "건록": "건록",
  "제왕": "제왕", "쇠": "쇠", "병": "병", "사": "사",
  "묘": "묘", "절": "절", "태": "태", "양": "양",
}

const REL_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  "충": { icon: "\u26A1", color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  "극": { icon: "\uD83D\uDD25", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  "형": { icon: "\u26A0\uFE0F", color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  "합": { icon: "\uD83E\uDD1D", color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  "파": { icon: "\uD83D\uDCA2", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  "해": { icon: "\uD83C\uDF0A", color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
  "원진": { icon: "\uD83D\uDE24", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
}

const REL_TOOLTIP_BY_POS: Record<string, Record<string, string>> = {
  "천간합": {
    "연-월": "집안 환경과 사회생활이 자연스럽게 이어져 적성에 맞는 일을 하기 좋아요",
    "연-일": "가문의 기운이 본인을 직접 도와서 집안 배경이 큰 자산이 돼요",
    "연-시": "집안의 복이 자녀에게까지 이어지는 좋은 흐름이에요",
    "월-일": "하는 일과 내 성향이 잘 맞아서 직업 만족도가 높아요",
    "월-시": "커리어가 말년까지 안정적으로 이어질 가능성이 높아요",
    "일-시": "배우자와 자녀 모두 나와 잘 통하는 편안한 가정이에요",
    "기본": "서로 끌리는 기운이라 협력·인연이 잘 맺어져요",
  },
  "천간충": {
    "연-월": "집안 기대와 직업 방향이 달라서 진로 갈등이 생기기 쉬워요",
    "연-일": "부모님과 본인의 가치관이 충돌하기 쉬운 구조예요",
    "연-시": "조상 대의 기운과 자녀 운이 부딪혀 세대 갈등이 있어요",
    "월-일": "직장에서 내 뜻대로 안 되는 느낌이 자주 들어요",
    "월-시": "커리어와 노후 계획이 따로 놀기 쉬워요",
    "일-시": "본인 생각과 자녀·말년의 방향이 달라 고민이 생겨요",
    "기본": "생각이나 방향이 부딪혀 갈등이 생기기 쉬워요",
  },
  "천간정극": {
    "연-월": "집안의 기대가 사회생활을 강하게 압박하는 구조예요",
    "월-일": "직장 환경이 본인을 강하게 조이는 느낌이에요",
    "일-시": "본인이 자녀에게 엄격하거나, 말년에 자기 통제가 강해요",
    "기본": "한쪽 기둥이 다른 쪽을 강하게 눌러서 내적 긴장이 있어요",
  },
  "천간편극": {
    "연-월": "집안 환경이 예측 못한 방식으로 직업에 영향을 줘요",
    "월-일": "직장에서 갑작스러운 압박이나 변화를 겪기 쉬워요",
    "일-시": "자녀나 말년에 예상 못한 변수가 생기기 쉬워요",
    "기본": "예측 못한 압박이 오기 쉬운 구조예요",
  },
  "지지합": {
    "연-월": "성장 환경과 사회생활이 안정적으로 연결돼요",
    "연-일": "집안 배경이 본인의 삶을 든든하게 받쳐줘요",
    "연-시": "조상 복이 자녀에게까지 이어져요",
    "월-일": "직업과 나의 본질이 잘 맞아서 일이 잘 풀려요",
    "월-시": "직장 생활이 말년까지 안정적으로 이어져요",
    "일-시": "배우자·가정과 자녀 운이 조화로워요",
    "기본": "안정적인 결합으로 좋은 인연이나 기회가 생겨요",
  },
  "지지충": {
    "연-월": "어린 시절과 사회 진출 시기에 큰 변화가 있었을 거예요",
    "연-일": "집안과 본인 사이에 이별·독립이 이르게 올 수 있어요",
    "연-시": "집안 일과 자녀 문제가 자주 부딪혀요",
    "월-일": "직장에서 갑작스러운 이동이나 변화가 생기기 쉬워요",
    "월-시": "커리어 방향이 말년에 크게 바뀔 수 있어요",
    "일-시": "배우자궁과 자녀궁이 충돌해서 가정 내 갈등이 잦아요",
    "기본": "급격한 변화나 이별·이동이 생기기 쉬워요",
  },
  "지지형": {
    "연-월": "성장 환경에서 받은 상처가 사회생활에 영향을 줘요",
    "연-일": "가족 관계에서 오는 심리적 압박이 커요",
    "월-일": "직장에서 법적 문제나 건강 이슈를 주의해야 해요",
    "일-시": "가정 내 긴장이 건강에 영향을 줄 수 있어요",
    "기본": "참기 어려운 시련이나 법적·건강 문제를 암시해요",
  },
  "지지파": {
    "연-월": "순조롭던 진로가 갑자기 틀어지는 경험을 해요",
    "월-일": "직장에서 잘 되던 일이 예고 없이 깨질 수 있어요",
    "일-시": "가정에서 기대했던 일이 어긋나기 쉬워요",
    "기본": "잘 되던 일이 갑자기 틀어지거나 깨질 수 있어요",
  },
  "지지해": {
    "연-월": "가족이나 어른 쪽에서 배신감을 느끼기 쉬워요",
    "월-일": "직장 동료나 가까운 사람에게서 뒤통수를 맞을 수 있어요",
    "일-시": "배우자나 자녀와의 사이에서 서운함이 쌓이기 쉬워요",
    "기본": "가까운 사이에서 오해나 배신이 생길 수 있어요",
  },
  "반합": {
    "기본": "완전한 결합은 아니지만 부분적으로 좋은 기운이 도와줘요",
  },
  "삼합완성": {
    "기본": "세 기둥의 기운이 하나로 모여 일이 크게 성사되기 좋아요",
  },
  "방합완성": {
    "기본": "같은 방향의 기운이 모여 추진력이 강해져요",
  },
  "원진": {
    "연-월": "집안 기대와 사회적 역할 사이에서 겉은 맞추지만 속은 불편해요",
    "연-일": "부모님과 표면적으론 괜찮은데, 깊이 들어가면 안 맞아요",
    "월-일": "직장에서 좋은 척 하지만 속으로는 계속 불만이 쌓여요",
    "일-시": "가정에서 티는 안 나지만 내심 서로 답답해하는 관계예요",
    "기본": "겉으로는 괜찮아 보이지만 속으로 불편함이 쌓이는 관계예요",
  },
  "무은지형": {
    "기본": "은혜를 베풀었는데 되돌아오는 건 상처인 관계예요",
  },
  "지세지형": {
    "기본": "서로 고집이 세서 양보 없는 충돌이 반복돼요",
  },
  "자형": {
    "기본": "스스로에게 엄격해서 자기 자신을 힘들게 만들어요",
  },
}

function getRelTooltipByPos(text: string, between: string): string | null {
  for (const key of Object.keys(REL_TOOLTIP_BY_POS)) {
    if (text.includes(key)) {
      const posMap = REL_TOOLTIP_BY_POS[key]!
      return posMap[between] ?? posMap['기본'] ?? null
    }
  }
  return null
}

type PillarTip = { 년주?: string; 월주?: string; 일주?: string; 시주?: string; 기본: string }
const SHINSAL_PILLAR_TIP: Record<string, PillarTip> = {
  "도화": { 년주: "어릴 때부터 외모가 출중하고 인기가 많아요", 월주: "직장·사회에서 이성의 관심을 많이 받아요", 일주: "본인이 매력적이고 배우자도 외모가 좋아요", 시주: "말년에 이성 인연이 활발하거나 자녀가 매력적이에요", 기본: "이성에게 매력적으로 보여 인기가 많아요" },
  "역마": { 년주: "어릴 때부터 이사·이동이 잦은 환경이에요", 월주: "직장에서 출장이나 부서 이동이 잦아요", 일주: "본인이 변화를 좋아하고 활동적이에요", 시주: "말년에 이동이 잦거나 자녀가 멀리 살아요", 기본: "이동·변화가 잦고 해외 인연도 있어요" },
  "양인": { 년주: "집안 대대로 강한 기질을 물려받았어요", 월주: "직업에서 결단력이 강하고 경쟁에 강해요", 일주: "성격이 강하고 추진력이 남다르지만 과하면 충돌해요", 시주: "말년에 과감한 결정을 하거나 자녀가 강한 성격이에요", 기본: "결단력과 추진력이 강하지만 과하면 충돌해요" },
  "화개": { 년주: "어릴 때부터 예술적 감성이 있어요", 월주: "예술·종교·학문 분야에서 활동하기 좋아요", 일주: "내면이 깊고 영적 감수성이 뛰어나요", 시주: "말년에 종교나 학문에 몰두하기 쉬워요", 기본: "예술적 감각이 뛰어나고 영적 감수성이 있어요" },
  "장성": { 년주: "집안에서 리더 역할을 맡기 쉬워요", 월주: "직장에서 높은 위치에 오르기 좋아요", 일주: "타고난 리더십으로 사람들을 이끌어요", 시주: "말년에 권위가 높아지거나 자녀가 리더형이에요", 기본: "리더십이 있고 조직에서 중심 역할을 해요" },
  "겁살": { 년주: "어린 시절 예상치 못한 재물 손실을 겪을 수 있어요", 월주: "직장이나 사업에서 갑작스러운 손해를 조심해요", 일주: "본인이 직접 재물 관련 피해를 입기 쉬워요", 시주: "말년에 재산 손실이나 자녀 문제를 주의해요", 기본: "재물 손실이나 도난을 경계해야 해요" },
  "재살": { 년주: "어린 시절 건강이나 안전에 주의가 필요해요", 월주: "직업 환경에서 안전사고를 주의해야 해요", 일주: "본인의 건강·안전에 각별히 주의해요", 시주: "말년 건강이나 자녀 안전을 신경 써야 해요", 기본: "뜻밖의 사고나 자연재해를 주의해야 해요" },
  "천살": { 년주: "어린 시절 예측 못한 변수가 많았어요", 월주: "사회생활에서 갑작스러운 변화를 주의해요", 일주: "예기치 못한 상황에 자주 놓이기 쉬워요", 시주: "말년에 갑작스러운 변동을 조심해요", 기본: "예기치 못한 사고나 재앙을 조심해야 해요" },
  "지살": { 년주: "어린 시절 자유가 제한된 환경이었어요", 월주: "직장에서 속박감을 느끼기 쉬워요", 일주: "스스로 제약을 만들거나 갇힌 느낌을 받아요", 시주: "말년에 움직임이 제한되기 쉬워요", 기본: "속박당하거나 자유가 제한될 수 있어요" },
  "홍염": { 년주: "어릴 때부터 이성에게 관심이 많아요", 월주: "사회에서 강렬한 매력을 발산해요", 일주: "본인의 연애운이 뜨겁고 강렬해요", 시주: "말년에도 이성 인연이 활발해요", 기본: "강렬한 이성 매력으로 연애운이 활발해요" },
  "함지": { 년주: "어릴 때부터 이성에게 쉽게 끌려요", 월주: "직장에서 이성 관련 구설이 생길 수 있어요", 일주: "이성 관계에서 매력이 넘치지만 주의가 필요해요", 시주: "말년에 이성 문제로 고민할 수 있어요", 기본: "이성 관계에서 매력이 넘치지만 주의도 필요해요" },
  "백호": { 년주: "어린 시절 갑작스러운 건강 문제를 겪을 수 있어요", 월주: "직업 활동 중 사고나 수술을 주의해요", 일주: "본인의 건강에 각별히 신경 써야 해요", 시주: "말년 건강이나 자녀의 안전을 주의해요", 기본: "급작스러운 사고나 건강 이상을 주의해요" },
  "원진": { 년주: "집안 어른과 갈등이 반복되기 쉬워요", 월주: "직장 동료나 상사와 관계가 꼬이기 쉬워요", 일주: "배우자나 가까운 사람과 밀당이 반복돼요", 시주: "말년에 자녀나 후배와 갈등이 생길 수 있어요", 기본: "관계에서 밀당이 반복되기 쉬워요" },
  "망신": { 년주: "어린 시절 집안 체면이 손상될 수 있어요", 월주: "직장에서 명예가 실추되지 않도록 조심해요", 일주: "본인의 체면이나 평판에 타격이 올 수 있어요", 시주: "말년에 명예 손상을 주의해요", 기본: "체면이나 명예가 손상될 수 있어요" },
  "격각": { 년주: "어릴 때부터 고집이 세고 독립적이에요", 월주: "직장에서 타협보다 자기 방식을 고수해요", 일주: "성격이 외골수이고 자기 주장이 강해요", 시주: "말년에 고집이 더 세지거나 자녀와 충돌해요", 기본: "성격이 외골수이고 고집이 세요" },
  "천을귀인": { 년주: "어릴 때부터 어른들의 도움을 많이 받아요", 월주: "직장에서 상사나 선배가 도와줘요", 일주: "본인에게 직접적으로 귀인이 찾아와요", 시주: "말년에 좋은 사람을 만나 도움을 받아요", 기본: "어려울 때 귀인이 나타나 도와줘요" },
  "천덕귀인": { 년주: "어릴 때부터 위기에서 보호받는 복이 있어요", 월주: "사회생활에서 위험을 자연스럽게 피해요", 일주: "본인에게 타고난 보호막이 있어요", 시주: "말년에 안전하고 편안하게 보내요", 기본: "위기 상황에서 자연스럽게 보호받아요" },
  "월덕귀인": { 년주: "집안이 덕이 있고 유복한 환경이에요", 월주: "직장에서 신뢰를 받고 인정받아요", 일주: "성품이 온화하고 주변의 신망이 두터워요", 시주: "말년이 평안하고 자녀가 착해요", 기본: "성품이 온화하고 주변의 신뢰를 받아요" },
  "문창귀인": { 년주: "어릴 때부터 학업에서 두각을 나타내요", 월주: "시험이나 자격증에서 좋은 성적을 거둬요", 일주: "본인의 학문적 재능이 뛰어나요", 시주: "말년에 배움의 즐거움이 있거나 자녀가 공부를 잘해요", 기본: "시험·학업에서 좋은 결과를 얻기 쉬워요" },
  "학당귀인": { 년주: "어릴 때부터 배움에 남다른 재질이 있어요", 월주: "전문 분야에서 깊이 있는 능력을 발휘해요", 일주: "학문적 탐구심이 강하고 연구에 재능이 있어요", 시주: "말년에도 공부를 계속하거나 후학을 양성해요", 기본: "학문적 재질이 있어 배움에 유리해요" },
  "반안": { 년주: "어릴 때부터 안정된 환경에서 자랐어요", 월주: "직장에서 안정적인 수입과 위치를 얻어요", 일주: "생활이 편안하고 마음이 안정돼요", 시주: "말년이 편안하고 자녀 덕이 있어요", 기본: "생활이 안정되고 편안한 수입이 있어요" },
  "홍란": { 년주: "어릴 때 가정에 경사가 많았어요", 월주: "사회생활에서 좋은 인연을 만나요", 일주: "결혼·약혼 등 경사스러운 인연이 들어와요", 시주: "말년에 경사가 있거나 자녀가 좋은 인연을 만나요", 기본: "결혼·약혼 등 경사스러운 인연이 들어와요" },
  "천희": { 년주: "어릴 때부터 기쁜 일이 많은 환경이에요", 월주: "직장에서 좋은 소식이나 기회가 찾아와요", 일주: "본인에게 기쁜 일과 경사가 따라요", 시주: "말년에 경사가 있거나 자녀에게 기쁜 일이 생겨요", 기본: "기쁜 일이 생기고 경사가 따라요" },
  "태극귀인": { 년주: "집안 배경이 다양하고 넓어요", 월주: "여러 분야에서 성공할 기회가 있어요", 일주: "처세술이 뛰어나고 적응력이 강해요", 시주: "말년에 다방면으로 인정받아요", 기본: "처세술이 뛰어나 여러 분야에서 성공해요" },
  "천관귀인": { 년주: "어릴 때부터 공부나 대회에서 두각을 보여요", 월주: "승진이나 시험에서 좋은 기회가 와요", 일주: "본인의 사회적 지위가 높아져요", 시주: "말년에 명예로운 위치를 얻어요", 기본: "시험·승진에서 좋은 기회가 찾아와요" },
  "천복귀인": { 년주: "어릴 때부터 큰 사고 없이 무탈하게 자라요", 월주: "사회생활에서 위기를 무사히 넘겨요", 일주: "타고난 복이 있어 큰 위험을 피해요", 시주: "말년이 평안하고 건강해요", 기본: "타고난 복이 있어 큰 위험을 피해요" },
  "국인귀인": { 년주: "집안에 공직자나 관직 인연이 있어요", 월주: "공공기관이나 국가 관련 직업에 유리해요", 일주: "본인이 공적 분야에서 인정받아요", 시주: "말년에 국가적 혜택을 받기 쉬워요", 기본: "국가·공공기관과 인연이 있어요" },
  "복성귀인": { 년주: "어릴 때부터 복이 많아 어려움을 잘 넘겨요", 월주: "사회에서 어려울 때 도움이 찾아와요", 일주: "본인에게 복이 많아 위기를 잘 극복해요", 시주: "말년에도 도움을 받을 수 있어요", 기본: "복이 많아 어려울 때마다 도움을 받아요" },
  "금덕귀인": { 년주: "집안의 재물 기반이 안정돼요", 월주: "직업에서 금전적 성과를 거두기 좋아요", 일주: "본인의 재물운이 안정적이에요", 시주: "말년에 재물이 모여요", 기본: "금전적으로 안정되고 재물운이 좋아요" },
  "목덕귀인": { 년주: "어릴 때부터 성장 환경이 좋아요", 월주: "직장에서 꾸준히 발전해요", 일주: "인덕이 있고 성장하는 기운이 강해요", 시주: "말년에도 계속 발전하는 삶이에요", 기본: "인덕이 있고 성장·발전의 기운이 있어요" },
  "화덕귀인": { 년주: "밝고 활기찬 집안 환경이에요", 월주: "직장에서 활력 넘치는 분위기를 만들어요", 일주: "밝은 에너지로 주변을 환하게 해요", 시주: "말년이 활기차고 즐거워요", 기본: "밝은 에너지로 주변을 환하게 해요" },
  "수덕귀인": { 년주: "어릴 때부터 지적 호기심이 강해요", 월주: "학문·연구 분야에서 능력을 발휘해요", 일주: "지혜가 깊고 통찰력이 뛰어나요", 시주: "말년에 지식을 쌓거나 자녀가 학문에 뛰어나요", 기본: "지혜와 학문에서 빛나는 능력이 있어요" },
  "토덕귀인": { 년주: "집안 기반이 안정적이에요", 월주: "직장에서 신뢰받는 위치를 얻어요", 일주: "신뢰감이 있고 안정적인 재물운이 있어요", 시주: "말년에 안정적인 자산을 가져요", 기본: "신뢰감이 있고 안정적인 재물운이 있어요" },
  "용덕귀인": { 년주: "집안에 큰 변화 속 행운이 있었어요", 월주: "직장에서 변화 속에서도 기회를 잡아요", 일주: "큰 변화 속에서도 행운이 따라요", 시주: "말년에 뜻밖의 좋은 일이 생겨요", 기본: "큰 변화 속에서도 행운이 따라요" },
  "봉덕귀인": { 년주: "조상의 덕이 후손에게 전해져요", 월주: "사회에서 덕을 쌓아 좋은 평판을 얻어요", 일주: "본인이 덕을 쌓아 좋은 결과를 얻어요", 시주: "말년에 덕의 과보가 돌아와요", 기본: "덕을 쌓아 좋은 결과가 돌아와요" },
  "천은": { 년주: "집안에 하늘의 은혜가 있어요", 월주: "사회에서 뜻밖의 좋은 기회가 와요", 일주: "본인에게 하늘의 은혜로 기회가 찾아와요", 시주: "말년에 좋은 일이 생겨요", 기본: "하늘의 은혜로 좋은 기회가 찾아와요" },
  "천시귀인": { 년주: "어릴 때 좋은 때를 만나요", 월주: "직장에서 타이밍 좋게 기회를 잡아요", 일주: "때를 잘 만나 기회를 잡기 유리해요", 시주: "말년에 좋은 때를 만나요", 기본: "때를 잘 만나 기회를 잡기 유리해요" },
  "천계귀인": { 년주: "어릴 때부터 직관이 발달해요", 월주: "직장에서 영감으로 성과를 내요", 일주: "직관력이 뛰어나고 영적 감수성이 있어요", 시주: "말년에 영적 깨달음이 깊어져요", 기본: "하늘과 연결된 직관력이 있어요" },
  "천문성": { 년주: "어릴 때부터 학구적이에요", 월주: "학문·연구 분야에서 인정받아요", 일주: "학문적 재능이 돋보이고 연구에 강해요", 시주: "말년에 학문에 전념하기 좋아요", 기본: "학문·연구 분야에서 재능이 돋보여요" },
  "천관성": { 년주: "집안에 관직 인연이 있어요", 월주: "직장에서 높은 지위에 오르기 유리해요", 일주: "사회적 지위가 높아질 운이에요", 시주: "말년에 명예로운 위치를 얻어요", 기본: "관직이나 사회적 지위가 높아질 운이에요" },
  "천수성": { 년주: "어릴 때부터 건강 체질이에요", 월주: "직장생활 중에도 건강을 유지해요", 일주: "장수의 기운이 있어 건강해요", 시주: "말년이 건강하고 오래 살아요", 기본: "건강하고 오래 사는 장수의 기운이에요" },
  "천의성": { 년주: "어릴 때부터 건강 회복이 빨라요", 월주: "의료·건강 분야에서 능력을 발휘해요", 일주: "건강 회복력이 좋고 의료에 인연이 있어요", 시주: "말년에 건강 관리가 잘 돼요", 기본: "건강 회복력이 좋고 의료 분야에 인연이 있어요" },
  "사관귀인": { 년주: "어릴 때부터 말솜씨가 좋아요", 월주: "직장에서 발표·소통 능력이 뛰어나요", 일주: "말과 글에 재능이 있어 표현력이 좋아요", 시주: "말년에 글이나 강연으로 이름을 알려요", 기본: "말과 글에 재능이 있어 표현력이 좋아요" },
  "옥당귀인": { 년주: "어릴 때부터 품위 있는 환경에서 자라요", 월주: "직장에서 격조 높은 위치를 얻어요", 일주: "품위 있고 학식이 높아요", 시주: "말년에 학문적으로 인정받아요", 기본: "품위 있고 학문에서 인정받아요" },
  "태양귀인": { 년주: "어릴 때부터 밝고 활발해요", 월주: "직장에서 리더십을 발휘해요", 일주: "밝고 활발한 기운으로 사람들을 이끌어요", 시주: "말년에도 활기찬 삶을 살아요", 기본: "밝고 활발한 기운으로 리더십이 있어요" },
  "태음귀인": { 년주: "어릴 때부터 내면이 깊고 조용해요", 월주: "직장에서 섬세한 배려로 인정받아요", 일주: "섬세하고 내면의 지혜가 깊어요", 시주: "말년에 내적 평화를 누려요", 기본: "섬세하고 내면의 지혜가 깊어요" },
  "봉각": { 년주: "어릴 때부터 예술적 재능이 보여요", 월주: "문화·예술 분야에서 두각을 나타내요", 일주: "예술·문화적 감각이 뛰어나요", 시주: "말년에 예술 활동을 즐겨요", 기본: "예술·문화적 감각이 뛰어나요" },
  "문곡귀인": { 년주: "어릴 때부터 글쓰기에 재능이 있어요", 월주: "직장에서 문서·기획 능력이 뛰어나요", 일주: "글쓰기·학문에서 뛰어난 재능이 있어요", 시주: "말년에 저술이나 집필 활동을 해요", 기본: "글쓰기·학문에서 뛰어난 재능이 있어요" },
  "천하귀인": { 년주: "집안이 사회적으로 알려져 있어요", 월주: "직장에서 크게 이름을 알려요", 일주: "세상에서 크게 이름을 알릴 수 있어요", 시주: "말년에 명성이 높아져요", 기본: "세상에서 크게 이름을 알릴 수 있어요" },
  "천후귀인": { 년주: "집안에 든든한 후원이 있어요", 월주: "직장에서 큰 뒷배경이 생겨요", 일주: "든든한 후원자나 배경이 있어요", 시주: "말년에 자녀나 후배의 지원을 받아요", 기본: "큰 뒷배경이나 후원자가 있어요" },
  "권세귀인": { 년주: "집안에 권력자 인연이 있어요", 월주: "직장에서 권한과 영향력을 가져요", 일주: "권력과 지위를 얻기 유리한 기운이에요", 시주: "말년에 권위 있는 위치를 얻어요", 기본: "권력과 지위를 얻기 유리한 기운이에요" },
  "관귀": { 년주: "집안에 관직 인연이 있어요", 월주: "공직이나 관직에서 인정받아요", 일주: "관직이나 공적 분야에서 성과를 내요", 시주: "말년에 공적으로 인정받아요", 기본: "관직이나 공직에서 인정받기 쉬워요" },
  "관록": { 년주: "집안이 안정된 직업 기반이 있어요", 월주: "직장에서 안정적인 수입이 보장돼요", 일주: "안정적인 직업과 수입이 있어요", 시주: "말년에 연금 등 안정 수입이 있어요", 기본: "안정적인 직업과 수입이 보장돼요" },
  "금여록": { 년주: "집안의 재물 기반이 탄탄해요", 월주: "직업과 재물이 함께 안정돼요", 일주: "재물과 직업이 함께 안정되는 복이에요", 시주: "말년에 재물이 풍족해요", 기본: "재물과 직업이 함께 안정되는 복이에요" },
  "록신": { 년주: "집안에 안정적인 생활 기반이 있어요", 월주: "직장에서 녹봉이 보장돼요", 일주: "먹고사는 걱정이 적은 복이에요", 시주: "말년에 생활이 안정돼요", 기본: "녹봉이 있어 먹고사는 걱정이 적어요" },
  "암록": { 년주: "집안에 숨겨진 재물이 있어요", 월주: "직장 외 숨은 수입원이 있어요", 일주: "겉으로 드러나지 않는 숨은 재물복이에요", 시주: "말년에 숨겨둔 자산이 빛을 봐요", 기본: "겉으로 드러나지 않는 숨은 재물복이에요" },
  "협록": { 년주: "어릴 때 주변 도움으로 자라요", 월주: "직장에서 동료의 도움이 커요", 일주: "주변의 도움으로 재물이 모여요", 시주: "말년에 주변의 협력이 커요", 기본: "주변의 도움으로 재물이 모여요" },
  "금신": { 년주: "집안에 강한 개혁 성향이 있어요", 월주: "직장에서 개혁적인 역할을 맡아요", 일주: "결단력이 강하고 개혁적인 기질이에요", 시주: "말년에 과감한 변화를 시도해요", 기본: "결단력이 강하고 개혁적인 기질이에요" },
  "괴강": { 년주: "집안 대대로 강직한 성품이에요", 월주: "직장에서 강한 추진력을 보여요", 일주: "성격이 강직하고 추진력이 남달라요", 시주: "말년에도 흔들리지 않는 의지가 있어요", 기본: "성격이 강직하고 추진력이 남달라요" },
  "삼기": { 년주: "어릴 때부터 비범한 재주가 보여요", 월주: "직장에서 특별한 능력을 인정받아요", 일주: "특별한 재주와 비범한 능력이 있어요", 시주: "말년에 재능이 빛을 봐요", 기본: "특별한 재주와 비범한 능력이 있어요" },
  "인삼기": { 년주: "어릴 때부터 지혜로워요", 월주: "직장에서 영감으로 문제를 해결해요", 일주: "지혜와 영감이 뛰어나요", 시주: "말년에 깊은 지혜를 얻어요", 기본: "지혜와 영감이 뛰어나요" },
  "귀문관": { 년주: "어릴 때부터 감수성이 예민해요", 월주: "직장에서 직감으로 판단을 잘해요", 일주: "직감이 예민하고 영적 감수성이 강해요", 시주: "말년에 영적 세계에 관심이 깊어져요", 기본: "직감이 예민하고 영적 감수성이 강해요" },
  "충살": { 년주: "어린 시절 갑작스러운 변동이 있었어요", 월주: "직장에서 돌발 상황이 생기기 쉬워요", 일주: "갑작스러운 변동이나 충돌이 오기 쉬워요", 시주: "말년에 예상치 못한 변화를 주의해요", 기본: "갑작스러운 변동이나 충돌이 오기 쉬워요" },
  "형살": { 년주: "어린 시절 시련을 겪었을 수 있어요", 월주: "직장에서 법적 문제를 주의해요", 일주: "법적 문제나 건강 시련을 주의해야 해요", 시주: "말년에 건강이나 법적 문제를 조심해요", 기본: "법적 문제나 건강 시련을 주의해야 해요" },
  "파살": { 년주: "어린 시절 일이 잘 안 풀렸을 수 있어요", 월주: "직장에서 진행 중인 일이 틀어질 수 있어요", 일주: "잘 되던 일이 갑자기 무너질 수 있어요", 시주: "말년에 계획이 틀어지지 않도록 주의해요", 기본: "잘 되던 일이 갑자기 무너질 수 있어요" },
  "육해": { 년주: "어린 시절 가까운 사이에서 상처를 받았어요", 월주: "직장에서 가까운 동료에게 해를 입을 수 있어요", 일주: "가까운 사람에게서 상처를 받을 수 있어요", 시주: "말년에 가족 갈등을 조심해요", 기본: "가까운 사람에게서 상처를 받을 수 있어요" },
  "연살": { 년주: "어릴 때부터 이성에게 감정적이에요", 월주: "직장에서 이성 관련 얽힘이 생길 수 있어요", 일주: "이성 관계에서 감정적 얽힘이 생겨요", 시주: "말년에 이성 문제를 주의해요", 기본: "이성 관계에서 감정적 얽힘이 생겨요" },
  "월살": { 년주: "어린 시절 가정 내 갈등이 있었어요", 월주: "직장의 가까운 관계에서 갈등이 있어요", 일주: "가정이나 가까운 관계에서 갈등이 있어요", 시주: "말년에 가족 관계를 잘 챙겨야 해요", 기본: "가정이나 가까운 관계에서 갈등이 있어요" },
  "현침": { 년주: "어릴 때부터 눈치가 빠르고 예민해요", 월주: "직장에서 날카로운 분석력이 있어요", 일주: "날카로운 직관력이 있지만 예민해요", 시주: "말년에 예민함이 강해질 수 있어요", 기본: "날카로운 직관력이 있지만 예민해요" },
  "현광": { 년주: "어릴 때부터 재능이 빛나요", 월주: "직장에서 주목받지만 구설을 조심해요", 일주: "빛나는 재능이 있지만 구설에 주의해요", 시주: "말년에 재능으로 인정받아요", 기본: "빛나는 재능이 있지만 구설에 주의해요" },
  "태백": { 년주: "집안에 과감한 기질이 있어요", 월주: "직장에서 결단력 있게 행동해요", 일주: "결단력이 있지만 과감한 행동에 주의해요", 시주: "말년에 과감한 선택을 조심해요", 기본: "결단력이 있지만 과감한 행동에 주의해요" },
  "상문": { 년주: "어린 시절 이별이나 슬픈 일이 있었어요", 월주: "직장에서 안 좋은 소식을 주의해요", 일주: "슬픈 소식이나 이별을 조심해야 해요", 시주: "말년에 이별이나 외로움을 주의해요", 기본: "슬픈 소식이나 이별을 조심해야 해요" },
  "조객": { 년주: "어린 시절 외부 간섭이 많았어요", 월주: "직장에서 외부 갈등이 생길 수 있어요", 일주: "외부로부터 갈등이나 방해가 올 수 있어요", 시주: "말년에 외부 트러블을 조심해요", 기본: "외부로부터 갈등이나 방해가 올 수 있어요" },
  "음양차착": { 년주: "어릴 때부터 이성 관계가 순탄치 않아요", 월주: "직장에서 남녀 관계가 어긋나기 쉬워요", 일주: "남녀 관계에서 어긋남이 생기기 쉬워요", 시주: "말년에 배우자 관계를 잘 챙겨야 해요", 기본: "남녀 관계에서 어긋남이 생기기 쉬워요" },
  "복덕": { 년주: "집안에 타고난 복이 있어요", 월주: "직장생활이 안정적이에요", 일주: "타고난 복으로 생활이 안정돼요", 시주: "말년이 편안하고 안정돼요", 기본: "타고난 복으로 생활이 안정돼요" },
  "휴식": { 년주: "어린 시절 느긋한 환경이에요", 월주: "직장에서 쉬어가는 시기가 와요", 일주: "잠시 쉬어가며 재충전이 필요해요", 시주: "말년에 여유로운 삶을 살아요", 기본: "잠시 쉬어가는 시기, 재충전이 필요해요" },
  "명예": { 년주: "어릴 때부터 이름이 알려져요", 월주: "직장에서 사회적 인정을 받아요", 일주: "본인의 명예와 인지도가 높아져요", 시주: "말년에 명성이 높아져요", 기본: "이름이 알려지고 사회적 인정을 받아요" },
  "공망": { 년주: "조상·집안에서 기대한 만큼 결과가 약해요", 월주: "직장·사회에서 노력 대비 성과가 약할 수 있어요", 일주: "본인의 계획이 기대만큼 실현되지 않을 수 있어요", 시주: "말년이나 자녀 관련해서 성과가 약할 수 있어요", 기본: "기운이 비어 있어 기대한 만큼 결과가 약해요" },
  "천라": { 년주: "어린 시절 답답한 환경이었어요", 월주: "직장에서 막히는 느낌이 들어요", 일주: "답답하고 갑갑한 상황에 놓이기 쉬워요", 시주: "말년에 정체감을 느낄 수 있어요", 기본: "답답하고 갑갑한 상황에 놓이기 쉬워요" },
  "지망": { 년주: "어린 시절 움직임이 제한적이었어요", 월주: "직장에서 정체되는 느낌을 받아요", 일주: "움직임이 제한되고 정체될 수 있어요", 시주: "말년에 자유가 제한될 수 있어요", 기본: "움직임이 제한되고 정체될 수 있어요" },
  "과숙": { 년주: "어릴 때 외로운 환경이었어요", 월주: "직장에서 혼자 일하는 시간이 많아요", 일주: "혼자만의 시간이 많고 외로울 수 있어요", 시주: "말년에 고독함을 느낄 수 있어요", 기본: "혼자만의 시간이 많고 외로울 수 있어요" },
  "고진": { 년주: "어릴 때 부모와 떨어져 지냈을 수 있어요", 월주: "직장에서 독립적으로 활동해요", 일주: "부모·배우자와 떨어지기 쉬운 기운이에요", 시주: "말년에 혼자 지낼 수 있어요", 기본: "부모·배우자와 떨어지기 쉬운 기운이에요" },
  "천덕합": { 년주: "집안에 큰 복이 있어요", 월주: "사회에서 복이 배가 돼요", 일주: "천덕귀인과 만나 복이 배가 돼요", 시주: "말년에 복이 더 강해져요", 기본: "천덕귀인과 만나 복이 배가 돼요" },
  "월덕합": { 년주: "집안에 덕이 더해져요", 월주: "사회에서 덕이 배가 돼요", 일주: "월덕귀인과 만나 복이 더 강해져요", 시주: "말년에 덕이 더해져요", 기본: "월덕귀인과 만나 복이 더 강해져요" },
  "목덕": { 년주: "집안에 성장의 기운이 있어요", 월주: "직장에서 꾸준히 성장해요", 일주: "일간과 월지가 어울려 성장 에너지가 있어요", 시주: "말년에도 발전하는 삶이에요", 기본: "일간과 월지가 어울려 성장 에너지가 있어요" },
  "청룡": { 년주: "집안에 길한 기운이 있어요", 월주: "직장에서 발전과 상승이 있어요", 일주: "길한 방위의 기운으로 발전이 있어요", 시주: "말년에 좋은 기운이 찾아와요", 기본: "길한 방위의 기운으로 발전이 있어요" },
  "주작": { 년주: "어릴 때부터 말이 많고 표현력이 좋아요", 월주: "직장에서 소통·발표에 강해요", 일주: "말과 소통에 관련된 기운이에요", 시주: "말년에 구설이나 소통 관련 일이 생겨요", 기본: "말과 소통에 관련된 기운이에요" },
  "백호살": { 년주: "어린 시절 사고나 수술을 주의해요", 월주: "직업 중 갑작스러운 사고를 조심해요", 일주: "급작스러운 사고나 수술을 주의해야 해요", 시주: "말년 건강이나 수술을 조심해요", 기본: "급작스러운 사고나 수술을 주의해야 해요" },
  "현무": { 년주: "집안에 비밀스러운 일이 있어요", 월주: "직장에서 숨겨진 정보를 다뤄요", 일주: "비밀이나 숨겨진 일과 관련된 기운이에요", 시주: "말년에 드러나지 않는 일을 주의해요", 기본: "비밀이나 숨겨진 일과 관련된 기운이에요" },
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

const ADD_SAL = new Set([
  '도화', '역마', '양인', '화개', '장성', '반안', '홍염', '함지',
  '격각', '괴강', '망신', '과숙',
])

function normalizeShinsal(name: string): string {
  if (name.endsWith('살')) return name
  if (ADD_SAL.has(name)) return name + '살'
  return name
}

function classifyRelation(text: string): string {
  if (text.includes("원진")) return "원진"
  if (text.includes("충")) return "충"
  if (text.includes("극")) return "극"
  if (text.includes("형")) return "형"
  if (text.includes("합")) return "합"
  if (text.includes("파")) return "파"
  if (text.includes("해")) return "해"
  return ""
}

function getRelTooltip(text: string, between?: string): string | null {
  return getRelTooltipByPos(text, between ?? '')
}

function positionTooltip(node: HTMLDivElement | null) {
  if (!node) return
  const btn = node.parentElement?.querySelector('button')
  if (!btn) return
  const vw = window.innerWidth
  const PAD = 8
  const maxW = vw - PAD * 2
  const br = btn.getBoundingClientRect()
  node.style.position = 'fixed'
  node.style.maxWidth = `${maxW}px`
  node.style.top = `${br.bottom + 4}px`
  const nodeW = Math.min(node.scrollWidth, maxW)
  const btnRight = br.right
  if (btnRight + PAD > vw * 0.6) {
    let left = btnRight - nodeW
    if (left < PAD) left = PAD
    node.style.left = `${left}px`
  } else {
    let left = br.left
    if (left + nodeW > vw - PAD) left = vw - PAD - nodeW
    if (left < PAD) left = PAD
    node.style.left = `${left}px`
  }
  node.style.right = 'auto'
}

function getShinsalTooltip(name: string, pillars?: Set<string>): string | null {
  const cleaned = name.replace(/[（(][^）)]*[）)]/g, '').trim()
  const base = cleaned.replace(/살$/, '')

  for (const key of Object.keys(SHINSAL_PILLAR_TIP)) {
    if (cleaned.includes(key) || base.includes(key)) {
      const pt = SHINSAL_PILLAR_TIP[key]!
      if (pillars && pillars.size > 0) {
        const parts: string[] = []
        for (const p of ['년주', '월주', '일주', '시주'] as const) {
          if (pillars.has(p) && pt[p]) parts.push(`${p.charAt(0)}: ${pt[p]}`)
        }
        if (parts.length) return parts.join('\n')
      }
      return pt.기본
    }
  }

  return null
}

interface InfoTabProps {
  report: SajuReportJson | null
}

export function InfoTab({ report }: InfoTabProps) {
  if (!report) return <div className="py-12 text-center text-gray-400 text-sm">사주 정보가 없습니다.</div>

  return (
    <div className="px-4 py-4 space-y-5 overflow-x-hidden">
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
  const gmAllHits = report.공망분류?.all_hits ?? []
  const gmHitBranches = new Set<string>([
    ...((gm?.원국_적중 ?? []) as string[]),
    ...((gm?.년주_원국_적중 ?? []) as string[]),
    ...gmAllHits.map(h => h.branch),
  ])
  const gmHitMap = new Map<string, { type: string; source: string }>(
    gmAllHits.map(h => [h.branch, { type: h.type, source: h.source }])
  )

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
          const hsArr = jiji?.hidden_stems ?? []
          const branchTG = hsArr.length ? (hsArr[hsArr.length - 1]?.ten_god ?? "") : ""
          const hidden = jiji?.hidden_stems ?? []
          const unsung = jiji?.["12운성"] ?? ""
          const isGongmang = gmHitBranches.has(branchHanja) && p !== "일주"
          const gmInfo = gmHitMap.get(branchHanja)

          return (
            <div key={p} className="flex flex-col items-center gap-1.5">
              {/* Header */}
              <div className={`text-[11px] font-semibold ${isMe ? "text-purple-600" : "text-gray-500"}`}>
                {PILLAR_LABELS[p]}
              </div>
              {/* 천간 cell */}
              <div className={`w-full aspect-square rounded-xl ring-1 flex flex-col items-center justify-center gap-0.5 ${
                stemStyle ? `${stemStyle.bg} ${stemStyle.ring}` : "bg-gray-50 ring-gray-200"
              }`}>
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
              }`}>
                {isGongmang && <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${gmInfo?.type === '진공' ? 'bg-rose-400' : 'bg-amber-400'}`} title={gmInfo?.type ? `공망(${gmInfo.type})` : '공망'} />}
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
                    <span className={`text-[8px] font-semibold ${gmInfo?.type === '진공' ? 'text-rose-500' : 'text-amber-500'}`}>
                      {gmInfo?.type === '진공' ? '공망' : gmInfo?.type === '가공(합)' ? '공망(해소)' : gmInfo?.type === '가공(충)' ? '공망(약)' : '공망'}
                    </span>
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
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null)

  useEffect(() => {
    if (tooltipIdx === null) return
    const dismiss = () => setTooltipIdx(null)
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('scroll', dismiss, true) }
  }, [tooltipIdx])

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

  if (!pairs.length) return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">사주 관계</h3>
      <div className="bg-gray-50 rounded-xl px-3.5 py-4 text-center">
        <span className="text-xs text-gray-400">원국 내 특별한 충·합·형·파·해 관계가 없어요</span>
      </div>
    </div>
  )

  const safeIdx = activeTab < pairs.length ? activeTab : 0
  const active = pairs[safeIdx]

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">사주 관계</h3>
      <div className="flex gap-1 mb-2 overflow-x-auto">
        {pairs.map((pair, i) => (
          <button key={i} onClick={() => { setActiveTab(i); setTooltipIdx(null) }}
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
              const tip = getRelTooltip(r, active.between)
              const isOpen = tooltipIdx === j
              return (
                <span key={j} className="relative">
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => setTooltipIdx(isOpen ? null : j)}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      style?.bg ?? "bg-gray-100 border-gray-200"
                    } cursor-pointer active:scale-95`}>
                    {style && <span className="text-sm leading-none">{style.icon}</span>}
                    <span className={style?.color ?? "text-gray-700"}>{label}</span>
                  </button>
                  {isOpen && (
                    <div onPointerDown={e => e.stopPropagation()} ref={positionTooltip}
                      className="fixed z-[9999] w-48 max-w-[calc(100vw-1rem)] px-2.5 py-1.5 rounded-lg bg-gray-800 text-white text-[10px] leading-relaxed shadow-lg">
                      {tip || '해당 관계에 대한 설명이 준비 중이에요'}
                    </div>
                  )}
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
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null)

  useEffect(() => {
    if (tooltipIdx === null) return
    const dismiss = () => setTooltipIdx(null)
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('scroll', dismiss, true) }
  }, [tooltipIdx])

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
    const name = normalizeShinsal(hanjaToHangul(stripHanja(rawName)))
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
        {items.map((item, i) => {
          const tip = getShinsalTooltip(item.name, item.pillars)
          const isOpen = tooltipIdx === i
          return (
            <span key={i} className="relative">
              <button onPointerDown={e => e.stopPropagation()} onClick={() => setTooltipIdx(isOpen ? null : i)}
                className={`inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg px-2.5 py-1 font-medium transition-all cursor-pointer active:scale-95`}>
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
              </button>
              {isOpen && (
                <div onPointerDown={e => e.stopPropagation()} ref={positionTooltip}
                  className="fixed z-[9999] w-52 max-w-[calc(100vw-1rem)] px-2.5 py-1.5 rounded-lg bg-gray-800 text-white text-[10px] leading-relaxed shadow-lg whitespace-pre-line">
                  {tip || '해당 신살에 대한 설명이 준비 중이에요'}
                </div>
              )}
            </span>
          )
        })}
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
      <div className="overflow-x-auto pb-2 -mx-4 px-4 show-scrollbar">
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
