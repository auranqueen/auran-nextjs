import type { SupabaseClient } from '@supabase/supabase-js'

type Row = {
  type: string
  title: string
  body: string
  icon?: string
  link?: string | null
}

/** public.users.id 기준 알림 (RLS: notif_own) */
export async function insertNotificationForProfile(
  client: SupabaseClient,
  profileUserId: string,
  row: Row
) {
  await client.from('notifications').insert({
    user_id: profileUserId,
    type: row.type,
    title: row.title,
    body: row.body,
    icon: row.icon ?? '🔔',
    is_read: false,
    link: row.link ?? null,
  } as any)
}

export async function insertNotificationForAuthUser(
  client: SupabaseClient,
  authUserId: string,
  row: Row
) {
  const { data: p } = await client.from('users').select('id').eq('auth_id', authUserId).maybeSingle()
  if (!p?.id) return
  await insertNotificationForProfile(client, p.id, row)
}
