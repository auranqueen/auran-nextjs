// server
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrandDashClient from './client'
export default async function BrandDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=brand')
  const userId = user.id
  const { data: linkedProducts } = await supabase
    .from('products')
    .select('id,name,retail_price,is_active,status,stock')
    .eq('brand_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px 40px', color: '#e9e4f1' }}>
      <div style={{ color: '#7B5EA7', fontSize: 20, marginBottom: 14 }}>브랜드사 대시보드</div>
      {(!linkedProducts || linkedProducts.length === 0) ? (
        <div style={{ border: '1px solid rgba(123,94,167,0.35)', borderRadius: 12, padding: 14, color: '#cfc5e0' }}>
          연결된 제품이 없습니다. 관리자에게 문의하세요.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {(linkedProducts || []).map((p: any) => (
            <div key={p.id} style={{ border: '1px solid rgba(123,94,167,0.35)', borderRadius: 12, padding: 12, background: 'rgba(123,94,167,0.08)' }}>
              <div style={{ fontSize: 14, color: '#ece6f6', marginBottom: 6 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#d9d0e7', marginBottom: 6 }}>가격: ₩{Number(p.retail_price || 0).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#d9d0e7', marginBottom: 6 }}>상태: {p.is_active === false || String(p.status || '') === 'discontinued' ? '비노출' : '노출중'}</div>
              <div style={{ fontSize: 12, color: '#d9d0e7', marginBottom: 8 }}>재고: {Number(p.stock || 0)}</div>
              <a href={`/products/${p.id}`} style={{ color: '#7B5EA7', fontSize: 12, textDecoration: 'none' }}>상세보기</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', userId).single()
  if (!profile) redirect('/login?role=brand')
  const { data: brand } = await supabase.from('brands').select('*').eq('user_id', profile.id).single()
  const { data: products } = brand ? await supabase.from('products').select('*').eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(5) : { data: [] }
  return <BrandDashClient profile={profile} brand={brand} products={products || []} />
}
