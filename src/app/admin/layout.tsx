import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserFromSession } from '@/lib/auth/session'
import { getAdminOrNull } from '@/lib/admin/auth'
import { AdminShell } from '@/components/admin/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminOrNull()
  if (admin) {
    const name = admin.nickname || admin.email || '운영자'
    return <AdminShell adminName={name}>{children}</AdminShell>
  }

  const user = await getUserFromSession()
  if (!user) {
    redirect('/api/auth/kakao/start?returnTo=/admin')
  }

  return (
    <div className="min-h-screen bg-cp-bg text-cp-text flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-lg font-bold">관리자 권한이 없습니다</p>
        <p className="mt-2 text-sm text-cp-muted leading-relaxed">
          이 계정으로는 관리자 페이지에 접근할 수 없습니다.
          <br />
          운영자 계정으로 로그인하거나 ADMIN 권한을 부여해 주세요.
        </p>
        <Link
          href="/app/list"
          className="mt-6 inline-flex rounded-xl bg-cp-accent px-5 py-2.5 text-sm font-semibold text-white"
        >
          앱으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
