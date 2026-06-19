import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { review_id, product_id } = await req.json()
    if (!review_id || !product_id) {
      return NextResponse.json({ error: 'review_id, product_id 필요' }, { status: 400 })
    }
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인 필요', needLogin: true }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('id').eq('auth_id', user.id).single()
    if (!userData) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

    const { data: existing } = await supabase
      .from('review_also_buys')
      .select('id')
      .eq('review_id', review_id)
      .eq('user_id', userData.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: false, already: true, message: '이미 장바구니에 담았어요' })
    }

    await supabase.from('review_also_buys').insert({
      review_id,
      user_id: userData.id,
      product_id,
    })

    const { data: cartItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userData.id)
      .eq('product_id', product_id)
      .maybeSingle()

    if (cartItem) {
      await supabase.from('cart_items')
        .update({ quantity: cartItem.quantity + 1 })
        .eq('id', cartItem.id)
    } else {
      await supabase.from('cart_items').insert({
        user_id: userData.id,
        product_id,
        quantity: 1,
      })
    }

    return NextResponse.json({ ok: true, message: '장바구니에 담겼어요' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const review_id = searchParams.get('review_id')
    if (!review_id) return NextResponse.json({ already: false })

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ already: false })

    const { data: userData } = await supabase
      .from('users').select('id').eq('auth_id', user.id).single()

    const { data } = await supabase
      .from('review_also_buys')
      .select('id')
      .eq('review_id', review_id)
      .eq('user_id', userData?.id ?? '')
      .maybeSingle()

    return NextResponse.json({ already: !!data })
  } catch (e: any) {
    return NextResponse.json({ already: false })
  }
}
