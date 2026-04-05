import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'
import SkinNoticesClient from './client'

export default async function SkinNoticesPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)
  const { data: notices } = await supabase
    .from('today_skin_notices')
    .select('*')
    .order('created_at', { ascending: false })
  return <SkinNoticesClient notices={notices || []} />
}
