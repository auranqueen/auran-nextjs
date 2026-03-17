// server
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrandDashClient from './client'
export default async function BrandDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=brand')
  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile) redirect('/login?role=brand')
  const { data: brand } = await supabase.from('brands').select('*').eq('user_id', profile.id).single()
  const { data: products } = brand ? await supabase.from('products').select('*').eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(5) : { data: [] }
  return <BrandDashClient profile={profile} brand={brand} products={products || []} />
}
