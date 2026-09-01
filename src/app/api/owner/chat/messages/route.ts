import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const channelId = (req.nextUrl.searchParams.get('channel_id') || '').trim()
  if (!channelId) {
    return NextResponse.json({ ok: false, error: 'missing_channel' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  const db = tryCreateServiceClient() ?? supabase
  const { data: ch } = await db
    .from('brand_chat_channels')
    .select('id, owner_id')
    .eq('id', channelId)
    .maybeSingle()
  if (!ch?.id || ch.owner_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  await db.from('brand_chat_channels').update({ unread_by_owner: 0 }).eq('id', channelId)

  const { data: messages, error } = await db
    .from('brand_chat_messages')
    .select('id, channel_id, sender_type, sender_staff_id, message_type, body, attachment_url, campaign_id, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, messages: messages || [] })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const channelId = typeof body?.channel_id === 'string' ? body.channel_id.trim() : ''
  const messageType = typeof body?.message_type === 'string' ? body.message_type.trim() : 'text'
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  const attachmentUrl = typeof body?.attachment_url === 'string' ? body.attachment_url.trim() : null

  if (!channelId) {
    return NextResponse.json({ ok: false, error: 'missing_channel' }, { status: 400 })
  }
  if (!text && !attachmentUrl) {
    return NextResponse.json({ ok: false, error: 'empty_message' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  const db = tryCreateServiceClient() ?? supabase
  const { data: ch } = await db
    .from('brand_chat_channels')
    .select('id, owner_id, unread_by_brand')
    .eq('id', channelId)
    .maybeSingle()
  if (!ch?.id || ch.owner_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const preview = text || (attachmentUrl ? '📎 첨부파일' : '')
  const now = new Date().toISOString()

  const { data: msg, error } = await db
    .from('brand_chat_messages')
    .insert({
      channel_id: channelId,
      sender_type: 'owner',
      sender_staff_id: null,
      message_type: messageType || 'text',
      body: text || null,
      attachment_url: attachmentUrl,
    } as any)
    .select('id, channel_id, sender_type, sender_staff_id, message_type, body, attachment_url, campaign_id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await db
    .from('brand_chat_channels')
    .update({
      last_message: preview,
      last_message_at: now,
      unread_by_brand: Number(ch.unread_by_brand || 0) + 1,
    })
    .eq('id', channelId)

  return NextResponse.json({ ok: true, message: msg })
}