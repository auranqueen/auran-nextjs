import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './client'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=admin')

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/login?role=admin')

  // 통계 병렬 조회
  const [
    { count: totalUsers },
    { count: totalOrders },
    { data: pendingOrders },
    { data: pendingBrands },
    { data: pendingProducts },
    { data: pendingRefunds },
    { data: pendingSettlements },
    { data: recentLogs },
    { data: members },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('id,order_no,status,total_amount,earn_points,points_awarded,tracking_no,courier,ordered_at,customer_id').in('status', ['주문확인', '발송준비']).order('ordered_at').limit(10),
    supabase.from('brands').select('id,name,status,created_at').eq('status', 'pending').limit(5),
    supabase.from('products').select('id,name,status,retail_price,created_at,brand_id').eq('status', 'pending').limit(5),
    supabase.from('refunds').select('id,amount,status,created_at,order_id').eq('status', '요청').limit(5),
    supabase.from('settlements').select('id,target_name,amount,status,target_role').eq('status', '정산대기').limit(5),
    supabase.from('login_logs').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('users').select('id,name,email,role,status,points,created_at,last_login_at').order('created_at', { ascending: false }).limit(20),
  ])

  // 역할별 카운트
  const roleCounts = {
    customer: (members || []).filter(m => m.role === 'customer').length,
    partner: (members || []).filter(m => m.role === 'partner').length,
    owner: (members || []).filter(m => m.role === 'owner').length,
    brand: (members || []).filter(m => m.role === 'brand').length,
  }

  // 이달 매출
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: monthlyOrders } = await supabase.from('orders').select('final_amount').gte('ordered_at', monthStart).not('status', 'in', '("취소","환불")')
  const monthlyRevenue = (monthlyOrders || []).reduce((s, o) => s + (o.final_amount || 0), 0)

  const stats = {
    totalUsers: totalUsers || 0,
    totalOrders: totalOrders || 0,
    monthlyRevenue,
    pendingShip: (pendingOrders || []).length,
    pendingBrands: (pendingBrands || []).length,
    pendingProducts: (pendingProducts || []).length,
    pendingRefunds: (pendingRefunds || []).length,
    pendingSettlements: (pendingSettlements || []).length,
    roleCounts,
  }

  return (
    <AdminClient
      profile={profile}
      stats={stats}
      pendingOrders={pendingOrders || []}
      pendingBrands={pendingBrands || []}
      pendingProducts={pendingProducts || []}
      pendingRefunds={pendingRefunds || []}
      pendingSettlements={pendingSettlements || []}
      recentLogs={recentLogs || []}
      members={members || []}
    />
  )
}
