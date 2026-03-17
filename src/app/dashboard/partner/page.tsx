// ── PARTNER
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PartnerDashClient from './client'

export default async function PartnerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=partner')
  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile) redirect('/login?role=partner')
  return <PartnerDashClient profile={profile} />
}
