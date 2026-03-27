'use client'

import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

interface GuideItem { title: string; icon: string; body: React.ReactNode }

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[13px] text-gray-600 leading-[1.7] flex gap-2">
      <span className="text-gray-300 flex-shrink-0 mt-[3px] text-[10px]">●</span>
      <span>{children}</span>
    </li>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${color}`}>{children}</span>
}

function SectionGroup({ label, items }: { label: string; items: GuideItem[] }) {
  return (
    <div>
      <div className="sticky top-[49px] z-10 px-1 py-2 bg-white/90 backdrop-blur-sm">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</h2>
      </div>
      <div className="space-y-3 mt-1">
        {items.map((item, i) => (
          <details key={i} className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <summary className="flex items-center gap-2.5 px-4 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="flex-1 font-semibold text-[14px] text-gray-900">{item.title}</span>
              <svg className="w-4 h-4 text-gray-300 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <div className="px-4 pb-4 pt-0">
              <div className="border-t border-gray-50 pt-3">
                {item.body}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

const CHART_ITEMS: GuideItem[] = [
  {
    title: '총운 점수',
    icon: '📈',
    body: (
      <ul className="space-y-1">
        <Bullet>세로축 0~100점 총운 점수임.</Bullet>
        <Bullet><Tag color="bg-gray-100 text-gray-600">50점</Tag>이 중립 기준선. 이상이면 좋은 흐름, 이하면 주의 시기.</Bullet>
        <Bullet>용신, 12운성, 합·충·형 관계, 오행 균형, 삼합, 신살 등을 종합 산출함.</Bullet>
      </ul>
    ),
  },
  {
    title: '대운 흐름선',
    icon: '🌊',
    body: (
      <ul className="space-y-1">
        <Bullet>10년 단위로 바뀌는 장기 운의 흐름임.</Bullet>
        <Bullet><Tag color="bg-yellow-50 text-yellow-700">금색 계단선</Tag>으로 표시. 높을수록 해당 10년 기조가 좋음.</Bullet>
        <Bullet>세운은 대운 위에서 등락하므로, 대운이 좋으면 나쁜 해에도 바닥이 높음.</Bullet>
      </ul>
    ),
  },
  {
    title: '캔들스틱',
    icon: '🕯️',
    body: (
      <div className="space-y-2.5">
        <ul className="space-y-1">
          <Bullet>주식 차트의 캔들과 같은 원리. 해당 기간의 변동 범위를 보여줌.</Bullet>
          <Bullet><b>시가(Open)</b> = 기간 시작의 기저 점수</Bullet>
          <Bullet><b>종가(Close)</b> = 실제 종합 점수</Bullet>
          <Bullet><b>고가(High)</b> = 길신·용신의 상승 여력</Bullet>
          <Bullet><b>저가(Low)</b> = 흉살·충의 하락 위험</Bullet>
          <Bullet><Tag color="bg-red-50 text-red-600">빨간 캔들(양봉)</Tag> = 종가 ≥ 시가, 갈수록 좋아진 시기</Bullet>
          <Bullet><Tag color="bg-blue-50 text-blue-600">파란 캔들(음봉)</Tag> = 종가 &lt; 시가, 갈수록 어려워진 시기</Bullet>
          <Bullet>몸통 두껍다 = 시작과 마무리 차이 큼 / 꼬리 길다 = 중간 기복 컸음.</Bullet>
        </ul>
        <div className="bg-gray-50 rounded-xl p-3 text-[12px] text-gray-500 leading-relaxed space-y-1">
          <div><Tag color="bg-gray-200 text-gray-600">세운</Tag> 시가 = 대운 기조 / 종가 = 세운 점수. 대운 대비 올해의 변화폭.</div>
          <div><Tag color="bg-gray-200 text-gray-600">월운</Tag> 시가 = 세운 기조 / 종가 = 월운 점수. 세운 대비 이달의 변화폭.</div>
        </div>
      </div>
    ),
  },
  {
    title: '시즌 배경색',
    icon: '🎨',
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-gray-600 leading-relaxed">차트 배경의 색상 구간. 해당 시기 분위기를 한눈에 보여줌.</p>
        <div className="space-y-1.5">
          {[
            { emoji: '🚀', name: '확장기', bg: 'rgba(46,204,113,0.12)', border: '#2ecc71', text: '#1a9c5a', desc: '용신 + 변화 에너지 모두 강함. 도전과 확장의 시기.' },
            { emoji: '🏠', name: '안정기', bg: 'rgba(52,152,219,0.08)', border: '#3498db', text: '#2176ad', desc: '용신은 좋지만 변화 적음. 안정적으로 유지되는 시기.' },
            { emoji: '🔄', name: '전환기', bg: 'rgba(241,196,15,0.12)', border: '#f1c40f', text: '#b8960b', desc: '용신 중립이나 변화 에너지 큼. 큰 전환 예상.' },
            { emoji: '❄️', name: '인내기', bg: 'rgba(149,165,166,0.12)', border: '#95a5a6', text: '#6b7b7c', desc: '에너지 낮고 운 약함. 내실을 다지는 시기.' },
            { emoji: '⚡', name: '격변기', bg: 'rgba(231,76,60,0.12)', border: '#e74c3c', text: '#c0392b', desc: '기신 강하고 변화도 큼. 위기와 기회 공존.' },
            { emoji: '🌿', name: '평온기', bg: 'rgba(255,255,255,0.04)', border: '#ccc', text: '#888', desc: '특별한 변화 없는 무난한 시기.' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-[12px]" style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}>
              <span className="flex-shrink-0">{s.emoji}</span>
              <div>
                <span className="font-bold" style={{ color: s.text }}>{s.name}</span>
                <span className="text-gray-500 ml-1.5">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

const AUX_ITEMS: GuideItem[] = [
  {
    title: '유리한 흐름',
    icon: '💜',
    body: (
      <ul className="space-y-1">
        <Bullet>용신(가장 필요한 오행 기운)이 들어오는 정도임.</Bullet>
        <Bullet><Tag color="bg-green-50 text-green-700">양수</Tag> 좋은 기운 충분 / <Tag color="bg-red-50 text-red-700">음수</Tag> 기운 부족</Bullet>
        <Bullet>총운 점수에 가장 큰 영향을 미치는 핵심 지표임.</Bullet>
      </ul>
    ),
  },
  {
    title: '변화의 파도',
    icon: '🌀',
    body: (
      <ul className="space-y-1">
        <Bullet>합·충·형·파·해 등 관계에서 발생하는 변화의 강도임.</Bullet>
        <Bullet><Tag color="bg-green-50 text-green-700">초록</Tag> 좋은 방향의 변화 / <Tag color="bg-red-50 text-red-700">빨강</Tag> 도전적 변화</Bullet>
        <Bullet>막대가 클수록 큰 변화가 올 수 있음.</Bullet>
      </ul>
    ),
  },
  {
    title: '귀인의 도움',
    icon: '🤝',
    body: (
      <ul className="space-y-1">
        <Bullet>주변 사람과의 관계에서 오는 에너지임.</Bullet>
        <Bullet><Tag color="bg-green-50 text-green-700">양수</Tag> 도움 인연 활성화 / <Tag color="bg-red-50 text-red-700">음수</Tag> 관계 마찰 시기</Bullet>
        <Bullet>합(合) 들어오면 상승, 충(沖) 들어오면 하락 경향.</Bullet>
      </ul>
    ),
  },
  {
    title: '오행 균형도',
    icon: '⚖️',
    body: (
      <ul className="space-y-1">
        <Bullet>목·화·토·금·수 다섯 기운의 균형 정도임.</Bullet>
        <Bullet><Tag color="bg-blue-50 text-blue-700">0.5</Tag>에 가까울수록 균형 좋음. 0이나 1에 가까우면 치우친 상태.</Bullet>
        <Bullet>균형 좋은 시기일수록 안정적인 판단·행동 가능.</Bullet>
      </ul>
    ),
  },
  {
    title: '십성 밸런스',
    icon: '🔮',
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-gray-600">차트에서 연도 클릭 시 해당 시점 에너지 분포를 레이더 차트로 보여줌.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: '자아', sub: '비겁', desc: '주체성·추진력', color: 'bg-orange-50 text-orange-700 border-orange-100' },
            { name: '표현', sub: '식상', desc: '창의력·소통', color: 'bg-pink-50 text-pink-700 border-pink-100' },
            { name: '재물', sub: '재성', desc: '돈·현실감각', color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
            { name: '직업', sub: '관살', desc: '조직·규율', color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { name: '학업', sub: '인성', desc: '배움·사고력', color: 'bg-green-50 text-green-700 border-green-100' },
          ].map((t, i) => (
            <div key={i} className={`rounded-lg border px-2.5 py-1.5 ${t.color}`}>
              <span className="font-bold text-[12px]">{t.name}</span>
              <span className="text-[10px] opacity-60 ml-1">({t.sub})</span>
              <div className="text-[11px] opacity-75">{t.desc}</div>
            </div>
          ))}
        </div>
        <Bullet>한 방향으로 치우치면 해당 분야에 에너지가 집중된 것임.</Bullet>
      </div>
    ),
  },
  {
    title: '이벤트 확률',
    icon: '🎯',
    body: (
      <ul className="space-y-1">
        <Bullet>총운 점수와 별개로, 특정 영역 사건 발생 가능성임.</Bullet>
        <Bullet>이직·연애·건강·재물·학업·대인 6가지 영역별 확률.</Bullet>
        <Bullet>높다고 반드시 좋은 건 아님. 예) 건강 확률 높음 = 건강 관련 사건이 생길 확률.</Bullet>
        <Bullet>총운 재물 점수 = 재물운의 좋고 나쁨 / 이벤트 재물 = 큰 돈이 오갈 이벤트 확률.</Bullet>
      </ul>
    ),
  },
]

const FEATURE_ITEMS: GuideItem[] = [
  {
    title: '비교 기능',
    icon: '👥',
    body: (
      <ul className="space-y-1">
        <Bullet>다른 사주와 같은 차트 위에 겹쳐서 비교 가능.</Bullet>
        <Bullet>흐름이 겹치는 구간과 벌어지는 구간을 한눈에 파악함.</Bullet>
        <Bullet>부부, 가족, 비즈니스 파트너 등과의 운 궁합 확인에 유용.</Bullet>
      </ul>
    ),
  },
  {
    title: '구간 선택',
    icon: '🗓️',
    body: (
      <ul className="space-y-1">
        <Bullet>특정 연도나 범위 선택 후 AI 해설을 받을 수 있음.</Bullet>
        <Bullet>한 번 클릭 = 단일 연도 / 두 번 클릭 또는 드래그 = 범위 선택.</Bullet>
        <Bullet>선택 후 하단 버튼으로 해당 구간 운세 해설 생성.</Bullet>
      </ul>
    ),
  },
]

const CONCEPT_ITEMS: GuideItem[] = [
  {
    title: '사주 관계',
    icon: '🔗',
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-gray-600">사주 원국의 천간·지지 사이의 상호작용임.</p>
        <div className="space-y-1">
          {[
            { name: '합(合)', desc: '결합 에너지. 협력·인연이 깊음.', color: 'text-blue-600' },
            { name: '충(沖)', desc: '정면 충돌. 변화·갈등 가능.', color: 'text-red-600' },
            { name: '형(刑)', desc: '보이지 않는 스트레스. 내면 갈등.', color: 'text-amber-600' },
            { name: '파(破)', desc: '기존 질서 깨짐. 계획 변경 잦음.', color: 'text-purple-600' },
            { name: '해(害)', desc: '은근한 방해. 뒤에서 발목 잡힘.', color: 'text-teal-600' },
          ].map((r, i) => (
            <div key={i} className="flex gap-2 text-[12px] leading-relaxed">
              <span className={`font-bold flex-shrink-0 ${r.color}`}>{r.name}</span>
              <span className="text-gray-500">{r.desc}</span>
            </div>
          ))}
        </div>
        <Bullet>이 관계들이 운에서 만나면 해당 시기에 관련 작용이 활성화됨.</Bullet>
      </div>
    ),
  },
  {
    title: '신살 / 길성',
    icon: '⭐',
    body: (
      <ul className="space-y-1">
        <Bullet><Tag color="bg-blue-50 text-blue-700">길성</Tag> 천을귀인, 문창성 등 → 능력·도움·행운</Bullet>
        <Bullet><Tag color="bg-red-50 text-red-700">흉살</Tag> 양인살, 도화살 등 → 잘 쓰면 무기, 못 쓰면 위험</Bullet>
        <Bullet>같은 신살이라도 위치(년·월·일·시)에 따라 작용 다름.</Bullet>
        <Bullet>예) 역마살 년주 = 유년기부터 이동 많음 / 일주 = 활동 반경 넓음.</Bullet>
      </ul>
    ),
  },
  {
    title: '용신 / 희신 / 기신',
    icon: '🧭',
    body: (
      <div className="space-y-2">
        <div className="space-y-1.5">
          {[
            { name: '용신(用神)', desc: '가장 필요한 오행. 들어오면 운 상승.', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { name: '희신(喜神)', desc: '용신을 돕는 오행. 다음으로 좋은 기운.', color: 'bg-sky-50 text-sky-700 border-sky-200' },
            { name: '기신(忌神)', desc: '해로운 오행. 들어오면 운 하락.', color: 'bg-rose-50 text-rose-700 border-rose-200' },
            { name: '구신(仇神)', desc: '기신을 돕는 오행. 다음으로 주의할 기운.', color: 'bg-orange-50 text-orange-700 border-orange-200' },
          ].map((g, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${g.color}`}>
              <span className="font-bold text-[12px] flex-shrink-0">{g.name}</span>
              <span className="text-[11px] opacity-80">{g.desc}</span>
            </div>
          ))}
        </div>
        <Bullet>차트 점수 변동은 대부분 용신/기신의 출입에 의해 결정됨.</Bullet>
      </div>
    ),
  },
  {
    title: '신강 / 신약',
    icon: '💪',
    body: (
      <ul className="space-y-1">
        <Bullet>일간(나)의 힘이 강한지 약한지를 8단계로 세분화해 판정.</Bullet>
        <Bullet><Tag color="bg-red-50 text-red-700">극왕</Tag> <Tag color="bg-red-50 text-red-600">태강</Tag> <Tag color="bg-red-50 text-red-500">신강</Tag> 에너지가 넘침 → 설기(표현·재물)가 용신 되는 경우 많음.</Bullet>
        <Bullet><Tag color="bg-gray-50 text-gray-600">중화신강</Tag> <Tag color="bg-gray-50 text-gray-600">중화신약</Tag> 균형에 가까움 → 격국 유지 우선.</Bullet>
        <Bullet><Tag color="bg-blue-50 text-blue-500">신약</Tag> <Tag color="bg-blue-50 text-blue-600">태약</Tag> <Tag color="bg-blue-50 text-blue-700">극약</Tag> 에너지 부족 → 인성·비겁(도움·지지)이 용신 되는 경우 많음.</Bullet>
        <Bullet>판정에 따라 용신이 달라지므로 점수 해석의 기본 틀임.</Bullet>
      </ul>
    ),
  },
  {
    title: '격국',
    icon: '🏛️',
    body: (
      <ul className="space-y-1">
        <Bullet>사주의 구조적 특성을 나타내는 분류임.</Bullet>
        <Bullet>월지의 본기 기준으로 정해지며 성격과 잠재력 방향을 보여줌.</Bullet>
        <Bullet>예) 식신격 = 표현력·창의성 / 정관격 = 안정·규율 / 편재격 = 사업·재물 감각</Bullet>
        <Bullet>격국은 참고 정보. 실제 운세 점수는 용신과 관계 중심으로 산출됨.</Bullet>
      </ul>
    ),
  },
]

export default function GuidePage() {
  const router = useRouter()

  return (
    <MobileContainer>
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-3 pb-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg">&larr;</button>
          <h1 className="font-bold text-gray-900 text-base">차트 해석 가이드</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6 pb-20">

        <SectionGroup label="메인 차트 오버레이" items={CHART_ITEMS} />
        <SectionGroup label="보조 지표" items={AUX_ITEMS} />
        <SectionGroup label="기능" items={FEATURE_ITEMS} />
        <SectionGroup label="사주 개념" items={CONCEPT_ITEMS} />
      </div>
    </MobileContainer>
  )
}
