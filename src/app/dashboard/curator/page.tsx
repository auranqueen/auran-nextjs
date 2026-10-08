// ── CURATOR
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CuratorDashClient from './client'

export default async function CuratorDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: profilesRow } = await supabase.from('profiles').select('active_role, role').eq('auth_id', user.id).maybeSingle()
  const pr = profilesRow as { active_role?: string | null; role?: string | null } | null
  const role = String(pr?.active_role || pr?.role || (profile as { role?: string }).role || '')
  if (role !== 'curator' && role !== 'admin') {
    redirect('/login')
  }

  return <CuratorDashClient profile={profile} />
}
