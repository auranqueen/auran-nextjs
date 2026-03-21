import type { SupabaseClient } from '@supabase/supabase-js'
import { getDefaultLinkForType, getNotificationIcon } from '@/lib/notifications/format'
import { insertNotificationForProfile } from '@/lib/notifications/notifyProfile'

/**
 * 통합 알림 생성 (public.users.id, DB 컬럼은 body)
 * message → body 저장, link 없으면 타입별 기본 경로
 */
export async function createNotification(
  client: SupabaseClient,
  profileUserId: string,
  type: string,
  title: string,
  message: string,
  link?: string | null
) {
  const resolvedLink = (link != null && String(link).trim() !== '' ? link : getDefaultLinkForType(type)) ?? null
  await insertNotificationForProfile(client, profileUserId, {
    type,
    title,
    body: message,
    icon: getNotificationIcon(type),
    link: resolvedLink,
  })
}

export async function createNotificationForAuthUser(
  client: SupabaseClient,
  authUserId: string,
  type: string,
  title: string,
  message: string,
  link?: string | null
) {
  const { data: p } = await client.from('users').select('id').eq('auth_id', authUserId).maybeSingle()
  if (!p?.id) return
  await createNotification(client, p.id, type, title, message, link)
}
