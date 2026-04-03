// server
import AdminMarketingProductsClient from '@/app/admin/marketing/products/AdminMarketingProductsClient'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BrandDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=brand')
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px 40px', color: '#e9e4f1' }}>
      <div style={{ color: '#7B5EA7', fontSize: 20, marginBottom: 14 }}>브랜드사 대시보드</div>
      <AdminMarketingProductsClient brandOwnerAuthId={user.id} brandOwnerEmail={user.email ?? ''} />
    </div>
  )
}
