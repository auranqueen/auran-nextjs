import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomerDashboardClient from './client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CustomerDashboard() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=customer')

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()

  if (!profile) redirect('/login?role=customer')

  const [notificationsRes, recentOrdersRes, pointHistoryRes, featuredRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_id', profile.id)
      .order('ordered_at', { ascending: false })
      .limit(3),
    supabase
      .from('point_history')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('products')
      .select('id,name,thumb_img,retail_price,brands(name)')
      .eq('status', 'active')
      .gt('retail_price', 0)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  return (
    <CustomerDashboardClient
      profile={profile}
      notifications={notificationsRes.data || []}
      recentOrders={recentOrdersRes.data || []}
      pointHistory={pointHistoryRes.data || []}
      featuredProducts={featuredRes.data || []}
    />
  )
}
