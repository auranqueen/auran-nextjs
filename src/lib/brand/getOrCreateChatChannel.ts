import type { SupabaseClient } from '@supabase/supabase-js'

/** Lookup or insert brand_chat_channels by company_id + owner_id (users.id). */
export async function getOrCreateChatChannel(
  supabase: SupabaseClient,
  companyId: string,
  ownerId: string,
): Promise<string> {
  const cid = companyId.trim()
  const oid = ownerId.trim()
  if (!cid || !oid) throw new Error('missing_ids')

  const { data: existing } = await supabase
    .from('brand_chat_channels')
    .select('id')
    .eq('company_id', cid)
    .eq('owner_id', oid)
    .maybeSingle()

  if (existing?.id) return String(existing.id)

  const { data: created, error } = await supabase
    .from('brand_chat_channels')
    .insert({
      company_id: cid,
      owner_id: oid,
      last_message: null,
      last_message_at: null,
      unread_by_brand: 0,
      unread_by_owner: 0,
    } as any)
    .select('id')
    .single()

  if (error || !created?.id) {
    const { data: again } = await supabase
      .from('brand_chat_channels')
      .select('id')
      .eq('company_id', cid)
      .eq('owner_id', oid)
      .maybeSingle()
    if (again?.id) return String(again.id)
    throw new Error(error?.message || 'channel_create_failed')
  }

  return String(created.id)
}