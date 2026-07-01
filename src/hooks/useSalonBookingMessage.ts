'use client'

import { useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSalonBookingMessage() {
  const sbRef = useRef(createClient())

  const sendSalonBookingMessage = async (
    ownerId: string,
    customerAuranUserId: string | null,
    externalCustomerId: string | null,
    message: string,
  ) => {
    if (!ownerId || !message.trim()) return
    if (!customerAuranUserId && !externalCustomerId) return

    const sb = sbRef.current
    const now = new Date().toISOString()
    const body = message.trim()

    let channelId: string | null = null
    if (customerAuranUserId) {
      const { data } = await sb
        .from('chat_channels')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('channel_type', 'salon')
        .eq('user_id', customerAuranUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      channelId = data?.id ?? null
    }
    if (!channelId && externalCustomerId) {
      const { data } = await sb
        .from('chat_channels')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('channel_type', 'salon')
        .eq('external_customer_id', externalCustomerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      channelId = data?.id ?? null
    }

    if (!channelId) {
      let title = '고객님 상담'
      if (customerAuranUserId) {
        const { data: u } = await sb.from('users').select('name').eq('id', customerAuranUserId).maybeSingle()
        if (u?.name) title = `${String(u.name)}님 상담`
      } else if (externalCustomerId) {
        const { data: ext } = await sb.from('external_customers').select('name').eq('id', externalCustomerId).maybeSingle()
        if (ext?.name) title = `${String(ext.name)}님 상담`
      }
      const { data: ch, error: chErr } = await sb
        .from('chat_channels')
        .insert({
          owner_id: ownerId,
          user_id: customerAuranUserId || null,
          external_customer_id: externalCustomerId || null,
          channel_type: 'salon',
          title,
          last_message: body,
          last_message_at: now,
          unread_count: 1,
        } as any)
        .select('id')
        .single()
      if (chErr || !ch?.id) return
      channelId = ch.id
    }

    await sb.from('salon_messages').insert({
      channel_id: channelId,
      sender_id: ownerId,
      sender_type: 'owner',
      body,
      is_from_customer: false,
      message_kind: 'text',
    } as any)

    await sb
      .from('chat_channels')
      .update({
        last_message: body,
        last_message_at: now,
        unread_count: 1,
      })
      .eq('id', channelId)
  }

  return sendSalonBookingMessage
}
