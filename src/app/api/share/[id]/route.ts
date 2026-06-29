import { NextResponse } from 'next/server'
import { getPublicShareEntry } from '@/lib/share/get-share-entry'

/**
 * 공개 공유 조회 API. 인증 불필요.
 * isShared 된 엔트리만 결과를 돌려주고, 그 외에는 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await getPublicShareEntry(id)
    if (!entry) {
      return NextResponse.json({ error: 'Not shared' }, { status: 404 })
    }
    return NextResponse.json(entry, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('GET /api/share/[id] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
