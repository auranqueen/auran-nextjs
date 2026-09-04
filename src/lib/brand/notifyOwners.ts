import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateChatChannel } from '@/lib/brand/getOrCreateChatChannel'
import { resolveOwnersByGrades } from '@/lib/brand/resolveOwnersByGrades'

export type NotifyOwnersTarget =
  | { type: 'one'; ownerId: string }
  | { type: 'many'; ownerIds: string[] }
  | { type: 'all' }
  | { type: 'grades'; grades: string[] }
  | { type: 'arete' }

export type NotifyOwnersParams = {
  companyId: string
  target: NotifyOwnersTarget
  title: string
  body: string
  attachmentUrl?: string
}

/** users.id or profiles.id -> brand_chat_channels.owner_id (=users.id) */
async function resolveToOwnerUserId(
  supabase: SupabaseClient,
  rawId: string,
): Promise<string | null> {
  const id = rawId.trim()
  if (!id) return null

  const { data: byUser } = await supabase.from('users').select('id').eq('id', id).maybeSingle()
  if (byUser?.id) return String(byUser.id)

  const { data: byProfile } = await supabase
    .from('profiles')
    .select('id, auth_id')
    .eq('id', id)
    .maybeSingle()
  const authId = byProfile?.auth_id ? String(byProfile.auth_id).trim() : ''
  if (!authId) return null

  const { data: userByAuth } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle()
  return userByAuth?.id ? String(userByAuth.id) : null
}

async function resolveOwnerUserIds(
  supabase: SupabaseClient,
  companyId: string,
  target: NotifyOwnersTarget,
): Promise<string[]> {
  if (target.type === 'one') {
    const uid = await resolveToOwnerUserId(supabase, target.ownerId)
    return uid ? [uid] : []
  }

  if (target.type === 'many') {
    const out: string[] = []
    const seen = new Set<string>()
    for (const raw of target.ownerIds) {
      const uid = await resolveToOwnerUserId(supabase, String(raw || ''))
      if (uid && !seen.has(uid)) {
        seen.add(uid)
        out.push(uid)
      }
    }
    return out
  }

  if (target.type === 'all') {
    const owners = await resolveOwnersByGrades(supabase, companyId, 'all')
    return owners.map((o) => o.owner_user_id).filter(Boolean)
  }

  if (target.type === 'grades') {
    const grades = (target.grades || []).map((g) => g.trim()).filter(Boolean)
    if (grades.length === 0) return []
    const owners = await resolveOwnersByGrades(supabase, companyId, grades)
    return owners.map((o) => o.owner_user_id).filter(Boolean)
  }

  // arete — brand_arete_members.owner_id = profiles.id
  const { data: areteRows } = await supabase
    .from('brand_arete_members')
    .select('owner_id')
    .eq('company_id', companyId)
    .eq('status', 'active')
  const profileIds = Array.from(
    new Set(
      (areteRows || [])
        .map((r: { owner_id?: string }) => String(r.owner_id || '').trim())
        .filter(Boolean),
    ),
  )
  const out: string[] = []
  const seen = new Set<string>()
  for (const pid of profileIds) {
    const uid = await resolveToOwnerUserId(supabase, pid)
    if (uid && !seen.has(uid)) {
      seen.add(uid)
      out.push(uid)
    }
  }
  return out
}

/**
 * Brand -> owner chat notify helper (for brand_messages migration).
 * Failures are counted only; flow is not aborted.
 */
export async function notifyOwners(
  supabase: SupabaseClient,
  params: NotifyOwnersParams,
): Promise<{ sent_count: number; failed_count: number }> {
  const companyId = String(params.companyId || '').trim()
  const title = String(params.title || '').trim()
  const body = String(params.body || '').trim()
  const attachmentUrl = params.attachmentUrl ? String(params.attachmentUrl).trim() : ''

  if (!companyId || (!title && !body && !attachmentUrl)) {
    return { sent_count: 0, failed_count: 0 }
  }

  let ownerUserIds: string[] = []
  try {
    ownerUserIds = await resolveOwnerUserIds(supabase, companyId, params.target)
  } catch {
    return { sent_count: 0, failed_count: 1 }
  }

  if (ownerUserIds.length === 0) {
    return { sent_count: 0, failed_count: 0 }
  }

  const msgBody = [title, body].filter(Boolean).join('\n')
  const preview = msgBody || (attachmentUrl ? 'attachment' : '')
  const messageType = attachmentUrl ? 'image' : 'text'
  const now = new Date().toISOString()

  let sent_count = 0
  let failed_count = 0

  for (const ownerUserId of ownerUserIds) {
    try {
      const channelId = await getOrCreateChatChannel(supabase, companyId, ownerUserId)
      const { data: ch } = await supabase
        .from('brand_chat_channels')
        .select('unread_by_owner')
        .eq('id', channelId)
        .maybeSingle()

      const { error: msgErr } = await supabase.from('brand_chat_messages').insert({
        channel_id: channelId,
        sender_type: 'brand',
        message_type: messageType,
        body: msgBody || null,
        attachment_url: attachmentUrl || null,
      } as Record<string, unknown>)

      if (msgErr) {
        failed_count += 1
        continue
      }

      await supabase
        .from('brand_chat_channels')
        .update({
          last_message: preview,
          last_message_at: now,
          unread_by_owner: Number(ch?.unread_by_owner || 0) + 1,
        })
        .eq('id', channelId)

      sent_count += 1
    } catch {
      failed_count += 1
    }
  }

  return { sent_count, failed_count }
}