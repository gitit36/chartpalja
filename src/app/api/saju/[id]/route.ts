import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { buildSajuReportViaPython } from '@/lib/saju/saju-report'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

async function findEntry(id: string, req: NextRequest) {
  const user = await getUserFromSession().catch(() => null)
  const guestId = getGuestId(req)
  const entry = await prisma.sajuEntry.findUnique({ where: { id } })
  if (!entry) return null
  if (user && entry.userId === user.id) return entry
  if (guestId && entry.guestId === guestId) return entry
  if (!entry.userId && !entry.guestId) return entry
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await findEntry(id, request)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(entry)
  } catch (error) {
    console.error('GET /api/saju/[id] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await findEntry(id, request)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.gender !== undefined) updates.gender = body.gender
    if (body.birthDate !== undefined) updates.birthDate = body.birthDate
    if (body.birthTime !== undefined) updates.birthTime = body.birthTime
    if (body.timeUnknown !== undefined) updates.timeUnknown = body.timeUnknown
    if (body.isLunar !== undefined) updates.isLunar = body.isLunar
    if (body.isLeapMonth !== undefined) updates.isLeapMonth = !!(body.isLunar ?? entry.isLunar) && body.isLeapMonth

    const birthChanged =
      (body.birthDate !== undefined && body.birthDate !== entry.birthDate) ||
      (body.birthTime !== undefined && body.birthTime !== entry.birthTime) ||
      (body.timeUnknown !== undefined && body.timeUnknown !== entry.timeUnknown) ||
      (body.isLunar !== undefined && body.isLunar !== entry.isLunar) ||
      (body.isLeapMonth !== undefined && body.isLeapMonth !== (entry as Record<string, unknown>).isLeapMonth) ||
      (body.gender !== undefined && body.gender !== entry.gender)

    if (birthChanged) {
      const newBirthDate = (body.birthDate ?? entry.birthDate) as string
      const newTimeUnknown = (body.timeUnknown ?? entry.timeUnknown) as boolean
      const newBirthTime = newTimeUnknown ? '12:00' : ((body.birthTime ?? entry.birthTime ?? '12:00') as string)
      const newGender = (body.gender ?? entry.gender) as string
      const newIsLunar = (body.isLunar ?? entry.isLunar) as boolean
      const newIsLeapMonth = newIsLunar ? !!(body.isLeapMonth ?? (entry as Record<string, unknown>).isLeapMonth) : false

      const sajuReport = await buildSajuReportViaPython({
        birthDate: newBirthDate,
        birthTime: newBirthTime,
        timeUnknown: newTimeUnknown,
        gender: newGender === 'female' ? 'female' : 'male',
        isLunar: newIsLunar,
        isLeapMonth: newIsLeapMonth,
      })
      updates.sajuReportJson = sajuReport as object
      updates.fortuneJson = null
      updates.fortuneJsonB = null
    }

    const updated = await prisma.sajuEntry.update({
      where: { id },
      data: updates,
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/saju/[id] error:', error)
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await findEntry(id, request)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await prisma.sajuEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/saju/[id] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
