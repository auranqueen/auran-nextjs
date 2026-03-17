import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminChrome from '@/components/admin/AdminChrome'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=admin')
  const { data: profile } = await supabase.from('users').select('role,name').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/login?role=admin')

  const [
    { count: customerCount },
    { count: partnerCount },
    { count: ownerCount },
    { count: brandCount },
    { count: pendingShipCount },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'partner'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'brand'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['주문확인', '발송준비']),
  ])

  return (
    <AdminChrome
      adminName={profile.name || 'AURAN Admin'}
      roleCounts={{
        customer: customerCount || 0,
        partner: partnerCount || 0,
        owner: ownerCount || 0,
        brand: brandCount || 0,
      }}
      pendingShipCount={pendingShipCount || 0}
    >
      {children}
    </AdminChrome>
  )
}

