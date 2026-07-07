import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 원장(owner) + 고객(AURAN user)의 살롱 상담 채널 id를 찾는다.
 * useSalonBookingMessage.ts의 기존 조회 조건(owner_id + channel_type='salon' + user_id)을
 * 서버/클라이언트 양쪽에서 재사용 가능하도록 순수 함수로 이식만 한 것.
 * 채널이 없으면 null 반환 — 임의로 채널을 생성하지 않는다.
 */
export async function findSalonChannel(
  supabase: SupabaseClient,
  ownerId: string,
  customerId: string,
): Promise<string | null> {
  if (!ownerId || !customerId) return null
  const { data } = await supabase
    .from('chat_channels')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('channel_type', 'salon')
    .eq('user_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}
