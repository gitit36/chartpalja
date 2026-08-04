import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

type JsonValue = Prisma.InputJsonValue

export async function writeAdminAudit(params: {
  actorUserId: string
  action: string
  targetType: string
  targetId?: string | null
  before?: JsonValue | null
  after?: JsonValue | null
  note?: string | null
}) {
  await prisma.adminAuditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      before: params.before ?? undefined,
      after: params.after ?? undefined,
      note: params.note ?? null,
    },
  })
}
