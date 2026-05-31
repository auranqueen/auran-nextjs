import { requireAdmin } from '@/app/admin/_auth'
import { createClient } from '@/lib/supabase/server'
import SegmentCareClient from './SegmentCareClient'

export const dynamic = 'force-dynamic'

export default async function SegmentCarePage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)
  return <SegmentCareClient />
}
