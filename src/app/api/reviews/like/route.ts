import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { review_id } = await req.json()
    if (!review_id) return NextResponse.json({ error: 'review_id 필요' }, { status: 400 })

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('id').eq('auth_id', user.id).single()
    if (!userData) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

    const { data: existing } = await supabase
      .from('review_likes')
      .select('id')
      .eq('review_id', review_id)
      .eq('user_id', userData.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('review_likes').delete().eq('id', existing.id)
      await adminSupabase.from('reviews')
        .update({ helpful_count: adminSupabase.rpc('decrement', { x: 1 }) })
        .eq('id', review_id)
      const { data: review } = await adminSupabase
        .from('reviews').select('helpful_count').eq('id', review_id).single()
      const newCount = Math.max(0, (review?.helpful_count ?? 1) - 1)
      await adminSupabase.from('reviews').update({ helpful_count: newCount }).eq('id', review_id)
      return NextResponse.json({ ok: true, liked: false, count: newCount })
    } else {
      await supabase.from('review_likes').insert({ review_id, user_id: userData.id })
      const { data: review } = await adminSupabase
        .from('reviews').select('helpful_count').eq('id', review_id).single()
      const newCount = (review?.helpful_count ?? 0) + 1
      await adminSupabase.from('reviews').update({ helpful_count: newCount }).eq('id', review_id)
      return NextResponse.json({ ok: true, liked: true, count: newCount })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const review_id = searchParams.get('review_id')
    if (!review_id) return NextResponse.json({ error: 'review_id 필요' }, { status: 400 })

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ liked: false })

    const { data: userData } = await supabase
      .from('users').select('id').eq('auth_id', user.id).single()

    const { data } = await supabase
      .from('review_likes')
      .select('id')
      .eq('review_id', review_id)
      .eq('user_id', userData?.id ?? '')
      .maybeSingle()

    return NextResponse.json({ liked: !!data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
