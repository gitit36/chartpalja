'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'
import { SajuCharacterAvatar, normalizeElement } from '@/components/SajuCharacterAvatar'
import { HamburgerMenu } from '@/components/HamburgerMenu'

interface SajuCard {
  id: string
  name: string
  gender: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  isLunar: boolean
  createdAt: string
  dayElement?: string | null
}

function getGuestId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('saju_guest_id')
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const gid = getGuestId()
  if (gid) h['x-guest-id'] = gid
  return h
}

export default function SajuListPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<SajuCard[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SajuCard | null>(null)
  const [deleting, setDeleting] = useState(false)


  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/saju', { headers: getHeaders(), cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/saju/${deleteTarget.id}`, { method: 'DELETE', headers: getHeaders() })
    setDeleteTarget(null)
    setMenuOpen(null)
    setDeleting(false)
    fetchList()
  }

  const formatDate = (d: string) => d.replace(/-/g, '.')

  return (
    <MobileContainer>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <div className="w-8" />
          <div className="flex-1 flex items-center justify-center gap-2.5">
            <Image src="/svc_logo.png" alt="차트8자" width={32} height={29} />
            <h1 className="text-xl font-bold text-gray-900">내 사주 목록</h1>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="px-4 pt-4 pb-24 min-h-screen">
        {loading ? (
          <div className="text-center text-gray-400 py-16">불러오는 중...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#x1F52E;</div>
            <p className="text-gray-500 text-sm mb-1">아직 등록된 사주가 없어요</p>
            <p className="text-gray-400 text-xs">아래 버튼을 눌러 사주를 추가해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <div
                key={e.id}
                className="relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/app/saju/${e.id}`}
                  prefetch={true}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <SajuCharacterAvatar
                    gender={e.gender === 'female' ? 'female' : 'male'}
                    element={normalizeElement(e.dayElement ?? undefined)}
                    personId={e.id}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-gray-900">{e.name}</span>
                      <span className="text-xs text-gray-400">&middot;</span>
                      <span className="text-sm text-gray-500">{e.gender === 'female' ? '여성' : '남성'}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {e.isLunar ? '음력' : '양력'} {formatDate(e.birthDate)}
                      {e.timeUnknown ? ' · 시간 모름' : e.birthTime ? ` ${e.birthTime}` : ''}
                    </div>
                  </div>
                </Link>

                <button
                  onClick={(ev) => { ev.stopPropagation(); setMenuOpen(menuOpen === e.id ? null : e.id) }}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
                >
                  &#x22EE;
                </button>

                {menuOpen === e.id && (
                  <>
                    <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(null)}/>
                    <div className="absolute top-4 right-12 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                      <button
                        onClick={() => { setMenuOpen(null); router.push(`/app/input?edit=${e.id}`) }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); setDeleteTarget(e) }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-[446px] p-4 bg-white border-t border-gray-100">
          <Link
            href="/app/input"
            prefetch={true}
            className="flex w-full items-center justify-center py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
          >
            + 사주 추가하기
          </Link>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={ev => ev.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">사주 삭제</h3>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{deleteTarget.name}</span>의 사주 정보를 정말 삭제하시겠어요?
              </p>
              <p className="text-xs text-gray-400 mt-1">삭제된 데이터는 복구할 수 없습니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-100">
              <button disabled={deleting} onClick={() => setDeleteTarget(null)}
                className="py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100">
                취소
              </button>
              <button disabled={deleting} onClick={handleDeleteConfirm}
                className="py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileContainer>
  )
}
