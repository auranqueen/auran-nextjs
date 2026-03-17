import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomerDashboardClient from './client'

export default async function CustomerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=customer')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login?role=customer')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', profile.id)
    .order('ordered_at', { ascending: false })
    .limit(3)

  const { data: pointHistory } = await supabase
    .from('point_history')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <CustomerDashboardClient
      profile={profile}
      notifications={notifications || []}
      recentOrders={recentOrders || []}
      pointHistory={pointHistory || []}
    />
  )
}
