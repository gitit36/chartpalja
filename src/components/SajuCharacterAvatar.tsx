'use client'

type Gender = 'male' | 'female'
type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water']

const HANJA_TO_ELEMENT: Record<string, Element> = {
  '木': 'wood', '火': 'fire', '土': 'earth', '金': 'metal', '水': 'water',
  '목': 'wood', '화': 'fire', '토': 'earth', '금': 'metal', '수': 'water',
}

export function normalizeElement(raw?: string): Element {
  if (!raw) return 'earth'
  const mapped = HANJA_TO_ELEMENT[raw]
  if (mapped) return mapped
  const lower = raw.toLowerCase()
  if (ELEMENT_ORDER.includes(lower as Element)) return lower as Element
  return 'earth'
}

const MALE_EMOJIS = ['👨‍🦰','👨🏾‍🦰','👨🏻‍🦰','🧑‍🦰','👦🏼','🧑🏻‍🦰','🧔🏻‍♂️','🧔🏼‍♂️','🧔‍♂️','👦🏻']
const FEMALE_EMOJIS = ['👩','👩🏻','👩🏼','👩🏽','👩🏼‍🦳','👧🏻','👧🏼','👧🏽','👩🏻‍🦱','👩‍🦱']

const ELEMENT_EMOJI: Record<Element, string> = {
  wood: '🌿', fire: '🔥', earth: '⛰️', metal: '💎', water: '🌊',
}

const ELEMENT_STYLE: Record<Element, { bg: string; ring: string }> = {
  wood:  { bg: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  fire:  { bg: 'bg-rose-50',     ring: 'ring-rose-200'    },
  earth: { bg: 'bg-amber-50',    ring: 'ring-amber-200'   },
  metal: { bg: 'bg-slate-100',   ring: 'ring-slate-200'   },
  water: { bg: 'bg-blue-50',     ring: 'ring-blue-200'    },
}

function pickPersonEmoji(gender: Gender, id: string): string {
  const pool = gender === 'male' ? MALE_EMOJIS : FEMALE_EMOJIS
  let hash = 0
  for (const ch of id) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  return pool[Math.abs(hash) % pool.length]!
}

interface Props {
  gender: Gender
  element: Element
  /** Stable ID for consistent emoji assignment */
  personId?: string
  size?: number
}

export function SajuCharacterAvatar({ gender, element, personId = '', size = 48 }: Props) {
  const personEmoji = pickPersonEmoji(gender, personId || gender)
  const elemEmoji = ELEMENT_EMOJI[element]
  const style = ELEMENT_STYLE[element]
  const personFontSize = Math.round(size * 0.48)
  const badgeSize = Math.round(size * 0.38)
  const badgeFontSize = Math.round(badgeSize * 0.6)

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full flex items-center justify-center ring-2 ${style.bg} ${style.ring}`}
        role="img"
        aria-label={`${gender === 'male' ? '남성' : '여성'} ${element}`}
      >
        <span style={{ fontSize: personFontSize, lineHeight: 1 }}>{personEmoji}</span>
      </div>
      <span
        className="absolute flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100"
        style={{
          width: badgeSize,
          height: badgeSize,
          fontSize: badgeFontSize,
          lineHeight: 1,
          bottom: -2,
          right: -2,
        }}
      >
        {elemEmoji}
      </span>
    </div>
  )
}
