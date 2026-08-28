import type { SupabaseClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notifications/createNotification'

type SceneBookingNotify = {
  kind: 'booking'
  sourceScenePostId: string
  ownerId: string
  serviceName: string
  paymentAmount: number
  salonId: string
}

type SceneBrandOrderNotify = {
  kind: 'brand_product'
  sourceScenePostId: string
  ownerId: string
  itemName: string
  paymentAmount: number
  expectedToastAmount: number
}

export async function notifyScenePaymentComplete(
  client: SupabaseClient,
  ctx: SceneBookingNotify | SceneBrandOrderNotify,
): Promise<void> {
  const { data: scenePost } = await client
    .from('oren_scene_posts')
    .select('id, uploader_user_id')
    .eq('id', ctx.sourceScenePostId)
    .maybeSingle()

  const itemName = ctx.kind === 'booking' ? ctx.serviceName : ctx.itemName
  const amountStr = `₩${ctx.paymentAmount.toLocaleString()}`

  const ownerBody =
    ctx.kind === 'booking'
      ? `새 예약이 들어왔어요! ${itemName} · ${amountStr} · 오렌씬 영상을 통한 예약이에요`
      : `새 주문이 들어왔어요! ${itemName} · ${amountStr} · 오렌씬 영상을 통한 주문이에요`

  await createNotification(
    client,
    ctx.ownerId,
    'payment',
    ctx.kind === 'booking' ? '새 예약' : '새 주문',
    ownerBody,
    ctx.kind === 'booking' ? '/dashboard/owner/bookings' : '/dashboard/owner/brand-orders',
  )

  if (!scenePost?.uploader_user_id) return

  let expectedReward = 0
  if (ctx.kind === 'booking') {
    const { data: salon } = await client
      .from('salons')
      .select('services')
      .eq('id', ctx.salonId)
      .maybeSingle()
    const services = salon?.services ?? []
    const svc = Array.isArray(services)
      ? services.find((s: { name?: string; honey_toast?: number }) => s.name === ctx.serviceName)
      : null
    expectedReward = Number(svc?.honey_toast ?? 1000)
  } else {
    expectedReward = ctx.expectedToastAmount
  }

  const rewardSuffix =
    expectedReward > 0 ? ` (예상 적립 ${expectedReward.toLocaleString()}T)` : ''

  if (ctx.kind === 'booking') {
    await createNotification(
      client,
      scenePost.uploader_user_id,
      'scene',
      '오렌씬 전환',
      `내 오렌씬 영상이 예약을 만들었어요! 지나가던 고객님이 ${itemName}을 예약했어요${rewardSuffix}`,
      `/oren-scene/${ctx.sourceScenePostId}`,
    )
  } else {
    await createNotification(
      client,
      scenePost.uploader_user_id,
      'scene',
      '오렌씬 전환',
      `내 오렌씬 영상이 구매를 만들었어요! 지나가던 고객님이 ${itemName}을 구매했어요${rewardSuffix}`,
      `/oren-scene/${ctx.sourceScenePostId}`,
    )
  }
}

/** 예약/브랜드 구매확정 시 원본업로더 확정적립 알림 (문구만 kind별 분기) */
export async function notifySceneConfirmedReward(
  client: SupabaseClient,
  params: {
    kind: 'booking' | 'brand_product'
    sourceScenePostId: string
    amount: number
    uploaderUserId: string
  },
): Promise<void> {
  const body =
    params.kind === 'booking'
      ? `${params.amount.toLocaleString()}원이 적립됐어요 🎉 내 영상으로 예약한 고객님의 관리가 완료됐어요`
      : `${params.amount.toLocaleString()}원이 적립됐어요 🎉 내 영상으로 구매한 고객님의 주문이 완료됐어요`

  await createNotification(
    client,
    params.uploaderUserId,
    'scene',
    '적립 완료',
    body,
    `/oren-scene/${params.sourceScenePostId}`,
  )
}

/** @deprecated use notifySceneConfirmedReward({ kind: 'booking', ... }) */
export async function notifySceneBookingCompletedReward(
  client: SupabaseClient,
  params: {
    sourceScenePostId: string
    honeyAmount: number
    uploaderUserId: string
  },
): Promise<void> {
  await notifySceneConfirmedReward(client, {
    kind: 'booking',
    sourceScenePostId: params.sourceScenePostId,
    amount: params.honeyAmount,
    uploaderUserId: params.uploaderUserId,
  })
}

const SCENE_BRAND_TOAST_SOURCE = 'oren_scene_brand_order'

/**
 * brand_product_orders → 구매확정 전환 직후 호출.
 * source_scene_post_id가 있으면 업로더에게 customer_toast_amount만큼 적립+알림.
 * (트랙A customer_toast_* 값만 사용, 트랙B 설정 미사용)
 */
export async function handleSceneUploaderOnBrandProductConfirm(
  client: SupabaseClient,
  order: {
    id: string
    source_scene_post_id?: string | null
    customer_toast_amount?: number | null
  },
): Promise<void> {
  const scenePostId =
    typeof order.source_scene_post_id === 'string' && order.source_scene_post_id.trim()
      ? order.source_scene_post_id.trim()
      : null
  if (!scenePostId) return

  const { data: scenePost } = await client
    .from('oren_scene_posts')
    .select('uploader_user_id')
    .eq('id', scenePostId)
    .maybeSingle()
  if (!scenePost?.uploader_user_id) return

  const amount = Math.max(0, Math.floor(Number(order.customer_toast_amount || 0)))

  if (amount > 0) {
    const { data: existing } = await client
      .from('toast_transactions')
      .select('id')
      .eq('source_type', SCENE_BRAND_TOAST_SOURCE)
      .eq('source_id', order.id)
      .maybeSingle()

    // 이미 지급·알림 처리된 주문이면 스킵 (재시도/중복 호출 방지)
    if (existing) return

    await client.from('toast_transactions').insert({
      user_id: scenePost.uploader_user_id,
      amount,
      transaction_type: 'earn',
      source_type: SCENE_BRAND_TOAST_SOURCE,
      source_id: order.id,
      reference_id: order.id,
    })
    await client.rpc('increment_points', {
      user_id: scenePost.uploader_user_id,
      amount,
    })
  }

  await notifySceneConfirmedReward(client, {
    kind: 'brand_product',
    sourceScenePostId: scenePostId,
    amount,
    uploaderUserId: scenePost.uploader_user_id,
  })
}