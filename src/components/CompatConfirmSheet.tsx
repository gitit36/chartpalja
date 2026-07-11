'use client'

import { useEffect, useState } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import { READING_COST } from '@/lib/payment/products'
import {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  inferDefaultRelationship,
} from '@/lib/compat/relationship'
import type { RelationshipType } from '@/lib/compat/types'

interface CompatConfirmSheetProps {
  open: boolean
  partnerName: string
  myGender: string
  partnerGender: string
  existingRelationships: RelationshipType[]
  onConfirm: (relationship: RelationshipType) => void
  onViewExisting: (relationship: RelationshipType) => void
  onCancel: () => void
}

export function CompatConfirmSheet({
  open,
  partnerName,
  myGender,
  partnerGender,
  existingRelationships,
  onConfirm,
  onViewExisting,
  onCancel,
}: CompatConfirmSheetProps) {
  const [relationship, setRelationship] = useState<RelationshipType>(() =>
    inferDefaultRelationship(myGender, partnerGender),
  )

  useEffect(() => {
    if (open) {
      setRelationship(inferDefaultRelationship(myGender, partnerGender))
    }
  }, [open, myGender, partnerGender])

  if (!open) return null

  const alreadyExists = existingRelationships.includes(relationship)

  return (
    <BottomSheet
      onClose={onCancel}
      header={(
        <div className="pt-1 pb-2 text-center">
          <h3 className="text-base font-bold text-cp-text mb-1">
            {partnerName}님과의 궁합 해설
          </h3>
          <p className="text-sm text-cp-muted">관계 유형을 선택해 주세요</p>
        </div>
      )}
      footer={(
        <div>
          <p className="text-xs text-cp-muted text-center mb-3">
            궁합 해설 · {READING_COST.compat}주 차감
            {alreadyExists && ' (이미 있는 해설은 다시 보기만 가능해요)'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-cp-muted bg-cp-surface hover:bg-cp-border transition-colors min-h-[48px]"
            >
              취소
            </button>
            {alreadyExists ? (
              <button
                type="button"
                onClick={() => onViewExisting(relationship)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-cp-line bg-cp-surface border border-cp-border hover:bg-cp-border transition-colors min-h-[48px]"
              >
                해설 보기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onConfirm(relationship)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-cp-accent hover:shadow-lg transition-all active:scale-[0.98] min-h-[48px]"
              >
                생성하기
              </button>
            )}
          </div>
        </div>
      )}
    >
      <div className="flex gap-2 pb-4">
        {RELATIONSHIP_TYPES.map(rel => (
          <button
            key={rel}
            type="button"
            onClick={() => setRelationship(rel)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              relationship === rel
                ? 'bg-cp-border text-cp-line border-2 border-cp-border'
                : 'bg-cp-bg text-cp-muted border-2 border-transparent hover:bg-cp-surface'
            }`}
          >
            {RELATIONSHIP_LABELS[rel]}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
