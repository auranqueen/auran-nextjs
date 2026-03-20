import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RankingClient from './ranking-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RankingPage() {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) redirect('/login?role=customer')

  const { data: me } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!me?.id) redirect('/login?role=customer')

  const { data: likeTop } = await supabase
    .from('users')
    .select('id,name,avatar_url,star_level,total_likes,total_followers,purchase_leads')
    .order('total_likes', { ascending: false })
    .order('total_followers', { ascending: false })
    .limit(20)

  // 급상승: 최근 7일 follows 증가 기준
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentFollows } = await supabase
    .from('follows')
    .select('following_id')
    .gte('created_at', since)
    .limit(5000)

  const riseMap: Record<string, number> = {}
  for (const r of (recentFollows || []) as any[]) {
    const id = String(r.following_id || '')
    if (!id) continue
    riseMap[id] = (riseMap[id] || 0) + 1
  }
  const riseIds = Object.keys(riseMap)
  const { data: riseUsers } = riseIds.length
    ? await supabase
      .from('users')
      .select('id,name,avatar_url,star_level,total_likes,total_followers,purchase_leads')
      .in('id', riseIds)
    : { data: [] as any[] }
  const risingTop = (riseUsers || [])
    .map((u: any) => ({ ...u, rise_count: riseMap[String(u.id)] || 0 }))
    .sort((a: any, b: any) => (b.rise_count || 0) - (a.rise_count || 0))
    .slice(0, 20)

  const { data: leadTop } = await supabase
    .from('users')
    .select('id,name,avatar_url,star_level,total_likes,total_followers,purchase_leads')
    .order('purchase_leads', { ascending: false })
    .order('total_followers', { ascending: false })
    .limit(20)

  return (
    <RankingClient
      likeTop={(likeTop || []) as any[]}
      risingTop={risingTop as any[]}
      leadTop={(leadTop || []) as any[]}
    />
  )
}

