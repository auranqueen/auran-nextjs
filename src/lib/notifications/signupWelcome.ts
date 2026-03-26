import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'

/** 신규 가입 직후 환영 알림 (public.users.id 기준) */
export async function insertSignupWelcomeNotification(supabase: SupabaseClient, authUserId: string) {
  const { data: prof } = await supabase.from('users').select('id,role').eq('auth_id', authUserId).maybeSingle()
  if (!prof?.id || prof.role !== 'customer') return

  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', prof.id)
    .eq('type', 'welcome')
    .limit(1)
    .maybeSingle()
  if (existing) return

  const { data: wp } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('category', 'points_action')
    .eq('key', 'signup_welcome')
    .maybeSingle()
  const pts = Number(wp?.value ?? 8888)

  await createNotification(
    supabase,
    prof.id,
    'welcome',
    'AURAN 가입을 환영해요',
    `${pts.toLocaleString()}P가 즉시 적립됐어요. AI 피부분석으로 시작해보세요!`,
    '/'
  )
}
