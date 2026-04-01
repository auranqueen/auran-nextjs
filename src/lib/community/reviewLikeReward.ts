import type { SupabaseClient } from '@supabase/supabase-js'

/** 커뮤니티 리뷰 글에 좋아요가 추가될 때 작성자에게 토스트 보상 (admin_settings) */
export async function applyReviewLikeReward(supabase: SupabaseClient, postId: string, likerAuthId: string) {
  const { data: post } = await supabase.from('posts').select('user_id, category').eq('id', postId).maybeSingle()
  if (!post || (post as { category?: string }).category !== 'review') return

  const authorRow = post as { user_id: string }
  const { data: author } = await supabase
    .from('users')
    .select('id, auth_id, points')
    .eq('id', authorRow.user_id)
    .maybeSingle()
  if (!author?.auth_id || author.auth_id === likerAuthId) return

  const { data: setRow } = await supabase.from('admin_settings').select('value').eq('category', 'review').eq('key', 'review_share_like_reward').maybeSingle()
  const reward = Math.max(0, Math.floor(Number((setRow as { value?: string } | null)?.value ?? 0)))
  if (!reward) return

  const { data: liker } = await supabase.from('users').select('name').eq('auth_id', likerAuthId).maybeSingle()
  const likerName = (String((liker as { name?: string } | null)?.name || '').trim() || '일촌').slice(0, 40)

  const nextPts = Number(author.points || 0) + reward
  const { error: ptE } = await supabase.from('point_transactions').insert({
    user_id: author.auth_id,
    amount: reward,
    type: 'review_like_reward',
    description: '리뷰 좋아요 보상',
  })
  if (ptE) return
  await supabase.from('users').update({ points: nextPts }).eq('id', author.id)
  await supabase.from('notifications').insert({
    user_id: author.id,
    type: 'promo',
    title: '좋아요를 받았어요 ❤️',
    body: `${likerName}님이 내 리뷰에 좋아요를 눌렀어요! +${reward}T 적립됐어요`,
    icon: '❤️',
    is_read: false,
    link: `/dashboard/customer/community/${postId}`,
  } as any)
}
