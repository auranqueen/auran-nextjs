import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PartnerDashboardClient from './PartnerDashboardClient'

export default async function PartnerDashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=partner')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const role = String((profile as { role?: string } | null)?.role || '')
  if (role !== 'partner' && role !== 'admin') {
    redirect('/')
  }

  return <PartnerDashboardClient />
}
