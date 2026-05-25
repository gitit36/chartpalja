import { redirect } from 'next/navigation'
import { getUserFromSession } from '@/lib/auth/session'
import LandingClient from './LandingClient'

export default async function LandingPage() {
  const user = await getUserFromSession().catch(() => null)
  if (user) redirect('/app/list')
  return <LandingClient />
}
