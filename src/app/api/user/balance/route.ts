import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getBalance } from '@/lib/payment/entitlement'

export async function GET() {
  try {
    const user = await requireUser()
    const balance = await getBalance(user.id)
    return NextResponse.json({
      chartCredits: balance.chartCredits,
      periodCredits: balance.periodCredits,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
