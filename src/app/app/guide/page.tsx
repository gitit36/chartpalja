'use client'

import { MobileContainer } from '@/components/MobileContainer'
import { AppPageHeader } from '@/components/AppPageHeader'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'

interface GuideItem { title: string; icon: string; body: React.ReactNode }

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[13px] text-cp-muted leading-[1.7] flex gap-2">
      <span className="text-cp-border flex-shrink-0 mt-[3px] text-[10px]">●</span>
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
      <div className="sticky top-[68px] z-10 -mx-4 px-4 pt-3 pb-2 relative bg-cp-raised/95 backdrop-blur-md">
        <h2 className="text-[13px] font-semibold text-cp-secondary flex items-center gap-2">
          <span className="w-[3px] h-3.5 rounded-full bg-cp-borderStrong flex-shrink-0" aria-hidden />
          {label}
        </h2>
        <div className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-cp-raised/90 to-transparent" />
      </div>
      <div className="space-y-2.5 mt-1">
        {items.map((item, i) => (
          <details key={i} className="group bg-cp-surface/70 border border-cp-border rounded-2xl overflow-hidden">
            <summary className="flex items-center gap-2.5 px-4 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-cp-hover/40 transition-colors">
              <span className="text-lg flex-shrink-0 opacity-90">{item.icon}</span>
              <span className="flex-1 font-semibold text-[14px] text-cp-text">{item.title}</span>
              <svg className="w-4 h-4 text-cp-dim transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <div className="px-4 pb-4 pt-0">
              <div className="border-t border-cp-border/80 pt-3">
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
        <Bullet>세로축 0~100점 총운 점수예요.</Bullet>
        <Bullet><Tag color="bg-cp-surface text-cp-muted">50점</Tag>이 중립 기준선. 이상이면 좋은 흐름, 이하면 주의 시기.</Bullet>
        <Bullet>용신, 12운성, 합·충·형 관계, 오행 균형, 삼합, 신살 등을 종합해 산출해요.</Bullet>
      </ul>
    ),
  },
  {
    title: '대운 흐름선',
    icon: '🌊',
    body: (
      <ul className="space-y-1">
        <Bullet>10년 단위로 바뀌는 장기 운의 흐름이에요.</Bullet>
        <Bullet><Tag color="bg-cp-caution/15 text-cp-caution">금색 계단선</Tag>으로 표시해요. 높을수록 해당 10년 기조가 좋아요.</Bullet>
        <Bullet>세운은 대운 위에서 등락하므로, 대운이 좋으면 나쁜 해에도 바닥이 높아요.</Bullet>
      </ul>
    ),
  },
  {
    title: '캔들스틱',
    icon: '🕯️',
    body: (
      <div className="space-y-2.5">
        <ul className="space-y-1">
          <Bullet>주식 차트의 캔들과 같은 원리예요. 해당 기간의 변동 범위를 보여줘요.</Bullet>
          <Bullet><b>시가(Open)</b> = 기간 시작의 기저 점수</Bullet>
          <Bullet><b>종가(Close)</b> = 실제 종합 점수</Bullet>
          <Bullet><b>고가(High)</b> = 길신·용신의 상승 여력</Bullet>
          <Bullet><b>저가(Low)</b> = 흉살·충의 하락 위험</Bullet>
          <Bullet><Tag color="bg-cp-line/10 text-cp-up">빨간 캔들(양봉)</Tag> = 종가 ≥ 시가, 갈수록 좋아진 시기</Bullet>
          <Bullet><Tag color="bg-cp-downMuted text-cp-down">파란 캔들(음봉)</Tag> = 종가 &lt; 시가, 갈수록 어려워진 시기</Bullet>
          <Bullet>몸통이 두꺼우면 시작과 마무리 차이가 커요. 꼬리가 길면 중간 기복이 컸어요.</Bullet>
        </ul>
        <div className="bg-cp-input rounded-xl p-3 text-[12px] text-cp-muted leading-relaxed space-y-1">
          <div><Tag color="bg-cp-border text-cp-muted">세운</Tag> 시가 = 대운 기조 / 종가 = 세운 점수. 대운 대비 올해의 변화폭.</div>
          <div><Tag color="bg-cp-border text-cp-muted">월운</Tag> 시가 = 세운 기조 / 종가 = 월운 점수. 세운 대비 이달의 변화폭.</div>
        </div>
      </div>
    ),
  },
  {
    title: '시즌 배경색',
    icon: '🎨',
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-cp-muted leading-relaxed">차트 배경의 색상 구간이에요. 해당 시기 분위기를 한눈에 보여줘요.</p>
        <div className="space-y-1.5">
          {[
            { emoji: '🚀', name: '확장기', bg: 'rgba(46,204,113,0.12)', border: '#2ecc71', text: '#1a9c5a', desc: '용신과 변화 에너지가 모두 강해요. 도전과 확장의 시기예요.' },
            { emoji: '🏠', name: '안정기', bg: 'rgba(52,152,219,0.08)', border: '#3498db', text: '#2176ad', desc: '용신은 좋지만 변화가 적어요. 안정적으로 유지되는 시기예요.' },
            { emoji: '🔄', name: '전환기', bg: 'rgba(241,196,15,0.12)', border: '#f1c40f', text: '#b8960b', desc: '용신은 중립인데 변화 에너지가 커요. 큰 전환이 예상돼요.' },
            { emoji: '❄️', name: '인내기', bg: 'rgba(149,165,166,0.12)', border: '#95a5a6', text: '#6b7b7c', desc: '에너지가 낮고 운이 약해요. 내실을 다지는 시기예요.' },
            { emoji: '⚡', name: '격변기', bg: 'rgba(231,76,60,0.12)', border: '#e74c3c', text: '#c0392b', desc: '기신이 강하고 변화도 커요. 위기와 기회가 공존해요.' },
            { emoji: '🌿', name: '평온기', bg: 'rgba(255,255,255,0.04)', border: '#ccc', text: '#888', desc: '특별한 변화 없는 무난한 시기예요.' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-[12px]" style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}>
              <span className="flex-shrink-0">{s.emoji}</span>
              <div>
                <span className="font-bold" style={{ color: s.text }}>{s.name}</span>
                <span className="text-cp-muted ml-1.5">{s.desc}</span>
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
    title: '필요한 기운',
    icon: '💜',
    body: (
      <ul className="space-y-1">
        <Bullet>용신(가장 필요한 오행 기운)이 들어오는 정도예요.</Bullet>
        <Bullet><Tag color="bg-emerald-500/15 text-emerald-400">양수</Tag> 좋은 기운 충분 / <Tag color="bg-cp-upMuted text-cp-up">음수</Tag> 기운 부족</Bullet>
        <Bullet>총운 점수에 가장 큰 영향을 미치는 핵심 지표예요.</Bullet>
      </ul>
    ),
  },
  {
    title: '변화의 파도',
    icon: '🌀',
    body: (
      <ul className="space-y-1">
        <Bullet>합·충·형·파·해 등 관계에서 발생하는 변화의 강도예요.</Bullet>
        <Bullet><Tag color="bg-emerald-500/15 text-emerald-400">초록</Tag> 좋은 방향의 변화 / <Tag color="bg-cp-upMuted text-cp-up">빨강</Tag> 도전적 변화</Bullet>
        <Bullet>막대가 클수록 큰 변화가 올 수 있어요.</Bullet>
      </ul>
    ),
  },
  {
    title: '귀인의 도움',
    icon: '🤝',
    body: (
      <ul className="space-y-1">
        <Bullet>주변 사람과의 관계에서 오는 에너지예요.</Bullet>
        <Bullet><Tag color="bg-emerald-500/15 text-emerald-400">양수</Tag> 도움 인연 활성화 / <Tag color="bg-cp-upMuted text-cp-up">음수</Tag> 관계 마찰 시기</Bullet>
        <Bullet>합(合) 들어오면 상승, 충(沖) 들어오면 하락 경향.</Bullet>
      </ul>
    ),
  },
  {
    title: '오행 균형도',
    icon: '⚖️',
    body: (
      <ul className="space-y-1">
        <Bullet>목·화·토·금·수 다섯 기운의 균형 정도예요.</Bullet>
        <Bullet><Tag color="bg-cp-downMuted text-cp-down">0.5</Tag>에 가까울수록 균형이 좋아요. 0이나 1에 가까우면 치우친 상태예요.</Bullet>
        <Bullet>균형이 좋은 시기일수록 안정적인 판단·행동이 가능해요.</Bullet>
      </ul>
    ),
  },
  {
    title: '십성 밸런스',
    icon: '🔮',
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-cp-muted">차트에서 연도를 클릭하면 해당 시점 에너지 분포를 레이더 차트로 보여줘요.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: '자아', sub: '비겁', desc: '주체성·추진력', color: 'bg-cp-surface text-orange-400 border-cp-border' },
            { name: '표현', sub: '식상', desc: '창의력·소통', color: 'bg-cp-surface text-pink-400 border-cp-border' },
            { name: '재물', sub: '재성', desc: '돈·현실감각', color: 'bg-cp-surface text-cp-caution border-cp-border' },
            { name: '직업', sub: '관살', desc: '조직·규율', color: 'bg-cp-surface text-cp-down border-cp-border' },
            { name: '학업', sub: '인성', desc: '배움·사고력', color: 'bg-cp-surface text-emerald-400 border-cp-border' },
          ].map((t, i) => (
            <div key={i} className={`rounded-lg border px-2.5 py-1.5 ${t.color}`}>
              <span className="font-bold text-[12px]">{t.name}</span>
              <span className="text-[10px] opacity-60 ml-1">({t.sub})</span>
              <div className="text-[11px] opacity-75">{t.desc}</div>
            </div>
          ))}
        </div>
        <Bullet>한 방향으로 치우치면 해당 분야에 에너지가 집중된 거예요.</Bullet>
      </div>
    ),
  },
  {
    title: '이벤트 확률',
    icon: '🎯',
    body: (
      <ul className="space-y-1">
        <Bullet>총운 점수와 별개로, 특정 영역 사건 발생 가능성이에요.</Bullet>
        <Bullet>직업·연애·건강·재물·학업·대인 6가지 영역별 확률.</Bullet>
        <Bullet>높다고 반드시 좋은 건 아니에요. 예) 건강 확률 높음 = 건강 관련 사건이 생길 확률이에요.</Bullet>
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
        <Bullet>다른 사주와 같은 차트 위에 겹쳐서 총운 흐름을 비교 가능.</Bullet>
        <Bullet>흐름이 겹치는 구간과 벌어지는 구간을 한눈에 파악해요.</Bullet>
        <Bullet>연인·친구·가족·비즈니스 파트너와의 궁합 확인에 유용 (자세한 지표는 아래 <b>궁합</b> 참고).</Bullet>
      </ul>
    ),
  },
  {
    title: '구간 선택',
    icon: '🗓️',
    body: (
      <ul className="space-y-1">
        <Bullet>차트에서 연도(또는 월·요일)를 누르면 하단에 <b>「n년 해설 보기」</b>가 바로 떠요.</Bullet>
        <Bullet>여러 해가 궁금하면 <Tag color="bg-cp-violetMuted text-cp-violet">🗓️ 구간</Tag>을 켠 뒤, 드래그하거나 시작·끝을 눌러 범위를 고르세요.</Bullet>
        <Bullet>선택 후 버튼으로 해당 시점·구간의 AI 운세 해설을 생성해요.</Bullet>
      </ul>
    ),
  },
]

const COMPAT_ITEMS: GuideItem[] = [
  {
    title: '궁합 점수',
    icon: '💞',
    body: (
      <ul className="space-y-1">
        <Bullet>두 사람 관계의 <b>전반적인 궁합</b>을 0~100점으로 나타낸 대표 점수예요.</Bullet>
        <Bullet>특정 해가 아니라 관계 자체의 종합 점수라, 카드 상단에 한 번만 표시돼요.</Bullet>
        <Bullet>다른 사람들과 비교했을 때의 상대적 위치를 반영해 산출해요.</Bullet>
      </ul>
    ),
  },
  {
    title: '관계 케미 (4가지 결)',
    icon: '🧬',
    body: (
      <div className="space-y-2">
        <p className="text-[13px] text-cp-muted">두 사주를 네 방향으로 나눠, 어느 쪽에 가까운지 막대로 보여줘요. 좋고 나쁨이 아니라 <b>관계의 성격</b>이에요.</p>
        <div className="space-y-1.5">
          {[
            { name: '에너지 궁합', l: '닮은 결', r: '보완의 결', desc: '성향이 비슷한지, 부족한 걸 채우는지' },
            { name: '인생 리듬', l: '따로 리듬', r: '함께 리듬', desc: '좋을 때·힘들 때 타이밍이 겹치는지' },
            { name: '기대는 방향', l: '서로 받쳐줌', r: '한쪽이 이끎', desc: '힘을 주고받는 균형' },
            { name: '관계 온도', l: '편안·안정', r: '자극·긴장', desc: '무난하게 편한지, 부딪히며 끌리는지' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg bg-cp-input px-3 py-2">
              <div className="text-[12px] font-bold text-cp-text">{s.name}</div>
              <div className="text-[11px] text-cp-muted mt-0.5">{s.l} ↔ {s.r}</div>
              <div className="text-[11px] text-cp-muted mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: '좋음 · 보통 · 주의',
    icon: '📅',
    body: (
      <ul className="space-y-1">
        <Bullet>차트 하단 리듬 바·툴팁의 <Tag color="bg-emerald-500/15 text-emerald-400">좋음</Tag> <Tag color="bg-cp-surface text-cp-muted">보통</Tag> <Tag color="bg-cp-caution/15 text-cp-caution">주의</Tag> 는 두 사람 관계 흐름을 3단계로 나눈 표시예요.</Bullet>
        <Bullet><b>절대 점수가 아니라 상대 순위</b>예요. 그 화면의 구간 안에서 상위·중위·하위를 나눠요.</Bullet>
        <Bullet><b>전체</b> 뷰: 인생 전체 해들끼리 비교 → “2026이 좋음”은 <b>다른 해들보다</b> 관계가 나은 해라는 뜻이에요.</Bullet>
        <Bullet><b>올해</b> 뷰: 그해 12개월끼리만 비교 → 같은 해 안에서도 주의 달이 더 많을 수 있어요. 연간이 좋음이어도 모순이 아니에요.</Bullet>
        <Bullet><b>이번 주</b> 뷰: 그주 요일끼리만 비교해요. 역시 주 안 상대 순위예요.</Bullet>
        <Bullet>그래서 “좋은 해인데 주의 달이 많다”처럼 보여도, 비교 범위가 다르기 때문이에요.</Bullet>
      </ul>
    ),
  },
  {
    title: '궁합 흐름',
    icon: '📉',
    body: (
      <ul className="space-y-1">
        <Bullet>해가 지날수록 두 사람의 궁합이 어떻게 오르내리는지 보여주는 선이에요.</Bullet>
        <Bullet>카드를 펼치면 왼쪽에서 오른쪽으로 그려지며, 연도별 관계 수준(좋음/보통/주의)과 함께 확인 가능.</Bullet>
        <Bullet>선이 올라가는 구간 = 서로 맞는 시기, 내려가는 구간 = 신경 써야 할 시기.</Bullet>
        <Bullet>흐름선의 연간 수준과, 올해·이번 주 화면의 월/요일 라벨은 비교 범위가 다를 수 있어요. (위 <b>좋음 · 보통 · 주의</b> 참고)</Bullet>
      </ul>
    ),
  },
  {
    title: '관계 유형 & 궁합 해설',
    icon: '💬',
    body: (
      <ul className="space-y-1">
        <Bullet>궁합을 켜면 카드가 <b>바로</b> 생성되며, 점수·케미·흐름은 관계 유형과 무관하게 고정돼요.</Bullet>
        <Bullet><Tag color="bg-cp-surface text-cp-line">연애</Tag> <Tag color="bg-cp-surface text-cp-line">친구</Tag> <Tag color="bg-cp-surface text-cp-line">비즈니스</Tag> <Tag color="bg-cp-surface text-cp-line">가족</Tag> 중 선택 가능.</Bullet>
        <Bullet>선택한 관계 유형은 <b>유료 「궁합 해설」 텍스트</b>에만 반영되어, 맥락에 맞는 조언을 제공해요.</Bullet>
        <Bullet>출생정보 기반 이론값이며, 실제 사건을 예측하는 것은 아니에요.</Bullet>
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
        <p className="text-[13px] text-cp-muted">사주 원국의 천간·지지 사이의 상호작용이에요.</p>
        <div className="space-y-1">
          {[
            { name: '합(合)', desc: '결합 에너지예요. 협력·인연이 깊어요.', color: 'text-cp-down' },
            { name: '충(沖)', desc: '정면 충돌. 변화·갈등 가능.', color: 'text-cp-up' },
            { name: '형(刑)', desc: '보이지 않는 스트레스. 내면 갈등.', color: 'text-cp-caution' },
            { name: '파(破)', desc: '기존 질서가 깨져요. 계획 변경이 잦아요.', color: 'text-cp-line' },
            { name: '해(害)', desc: '은근한 방해예요. 뒤에서 발목을 잡아요.', color: 'text-teal-400' },
          ].map((r, i) => (
            <div key={i} className="flex gap-2 text-[12px] leading-relaxed">
              <span className={`font-bold flex-shrink-0 ${r.color}`}>{r.name}</span>
              <span className="text-cp-muted">{r.desc}</span>
            </div>
          ))}
        </div>
        <Bullet>이 관계들이 운에서 만나면 해당 시기에 관련 작용이 활성화돼요.</Bullet>
      </div>
    ),
  },
  {
    title: '신살 / 길성',
    icon: '⭐',
    body: (
      <ul className="space-y-1">
        <Bullet><Tag color="bg-cp-downMuted text-cp-down">길성</Tag> 천을귀인, 문창성 등 → 능력·도움·행운</Bullet>
        <Bullet><Tag color="bg-cp-upMuted text-cp-up">흉살</Tag> 양인살, 도화살 등 → 잘 쓰면 무기, 못 쓰면 위험</Bullet>
        <Bullet>같은 신살이라도 위치(년·월·일·시)에 따라 작용이 달라요.</Bullet>
        <Bullet>예) 역마살 년주 = 유년기부터 이동이 많아요 / 일주 = 활동 반경이 넓어요.</Bullet>
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
            { name: '용신(用神)', desc: '가장 필요한 오행. 들어오면 운 상승.', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' },
            { name: '희신(喜神)', desc: '용신을 돕는 오행. 다음으로 좋은 기운.', color: 'bg-cp-downMuted text-cp-down border-cp-down/25' },
            { name: '기신(忌神)', desc: '해로운 오행. 들어오면 운 하락.', color: 'bg-cp-upMuted text-cp-up border-cp-up/25' },
            { name: '구신(仇神)', desc: '기신을 돕는 오행. 다음으로 주의할 기운.', color: 'bg-cp-caution/15 text-cp-caution border-cp-caution/25' },
          ].map((g, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${g.color}`}>
              <span className="font-bold text-[12px] flex-shrink-0">{g.name}</span>
              <span className="text-[11px] opacity-80">{g.desc}</span>
            </div>
          ))}
        </div>
        <Bullet>차트 점수 변동은 대부분 용신/기신의 출입에 의해 결정돼요.</Bullet>
      </div>
    ),
  },
  {
    title: '신강 / 신약',
    icon: '💪',
    body: (
      <ul className="space-y-1">
        <Bullet>일간(나)의 힘이 강한지 약한지를 8단계로 세분화해 판정.</Bullet>
        <Bullet><Tag color="bg-cp-upMuted text-cp-up">극왕</Tag> <Tag color="bg-cp-upMuted text-cp-up">태강</Tag> <Tag color="bg-cp-upMuted text-cp-up">신강</Tag> 에너지가 넘쳐요 → 설기(표현·재물)가 용신이 되는 경우가 많아요.</Bullet>
        <Bullet><Tag color="bg-cp-surface text-cp-muted">중화신강</Tag> <Tag color="bg-cp-surface text-cp-muted">중화신약</Tag> 균형에 가까워요 → 격국 유지를 우선해요.</Bullet>
        <Bullet><Tag color="bg-cp-downMuted text-cp-down">신약</Tag> <Tag color="bg-cp-downMuted text-cp-down">태약</Tag> <Tag color="bg-cp-downMuted text-cp-down">극약</Tag> 에너지가 부족해요 → 인성·비겁(도움·지지)이 용신이 되는 경우가 많아요.</Bullet>
        <Bullet>판정에 따라 용신이 달라지므로 점수 해석의 기본 틀이에요.</Bullet>
      </ul>
    ),
  },
  {
    title: '격국',
    icon: '🏛️',
    body: (
      <ul className="space-y-1">
        <Bullet>사주의 구조적 특성을 나타내는 분류예요.</Bullet>
        <Bullet>월지의 본기 기준으로 정해지며 성격과 잠재력 방향을 보여줘요.</Bullet>
        <Bullet>예) 식신격 = 표현력·창의성 / 정관격 = 안정·규율 / 편재격 = 사업·재물 감각</Bullet>
        <Bullet>격국은 참고 정보예요. 실제 운세 점수는 용신과 관계 중심으로 산출돼요.</Bullet>
      </ul>
    ),
  },
]

export default function GuidePage() {
  return (
    <MobileContainer>
      <div className="min-h-screen pb-8">
        <AppPageHeader title="차트 해석 가이드" />

        <div className="px-4 py-4 space-y-7">
          <SectionGroup label="메인 차트 오버레이" items={CHART_ITEMS} />
          <SectionGroup label="보조 지표" items={AUX_ITEMS} />
          <SectionGroup label="기능" items={FEATURE_ITEMS} />
          <SectionGroup label="궁합" items={COMPAT_ITEMS} />
          <SectionGroup label="사주 개념" items={CONCEPT_ITEMS} />
        </div>

        <MinimalLegalFooter className="mt-8" />
      </div>
    </MobileContainer>
  )
}
