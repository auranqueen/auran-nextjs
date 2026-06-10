/** 8트랙 × 3배송 = 24 선물 상담톡 메시지 조합 */

export const GIFT_TRACK_TIPS: Record<string, string> = {
  general: '호르몬 주기에 맞춘 케어가 중요합니다',
  menopause_peri: '피부 변화 시기, 보습과 진정이 우선입니다',
  menopause_post: '안정된 루틴으로 피부 재생을 돕습니다',
  pregnant: '자극 없는 순한 제품으로 안전하게 관리하세요',
  postpartum: '호르몬 변화로 예민한 피부, 진정 케어를 우선으로',
  male: '남성 피부 특성에 맞춘 빠른 흡수 케어',
  male_menopause: '호르몬 변화에 따른 피부 톤 관리가 필요합니다',
  irregular: '생리 불규칙할 때는 진정과 보습 케어를 함께 챙기세요',
}

const GIFT_TRACKS = [
  'general',
  'menopause_peri',
  'menopause_post',
  'pregnant',
  'postpartum',
  'male',
  'male_menopause',
  'irregular',
] as const

type GiftTrack = (typeof GIFT_TRACKS)[number]
type GiftDelivery = 'direct' | 'quick' | 'courier'

function normalizeTrack(track: string): GiftTrack {
  return (GIFT_TRACKS as readonly string[]).includes(track) ? (track as GiftTrack) : 'general'
}

function normalizeDelivery(deliveryType: string): GiftDelivery {
  if (deliveryType === 'direct' || deliveryType === 'quick') return deliveryType
  return 'courier'
}

function deliveryIntro(delivery: GiftDelivery, giftTypeName: string, shipName: string): string {
  const gift = giftTypeName || '선물'
  if (delivery === 'direct') {
    return `${shipName}님, ${gift} 선물이 직접 전달됐어요 💜\n소중히 사용해주세요!`
  }
  if (delivery === 'quick') {
    return `${shipName}님, ${gift} 선물이 퀵으로 출발했어요 🛵\n곧 도착할 예정이에요 💜`
  }
  return `${shipName}님, ${gift} 선물이 출발했어요 📦\n배송 조회 후 수령해주세요 💜`
}

function formatProductBlock(products: Array<{ name: string }>): string {
  const names = products.map((p) => String(p?.name || '').trim()).filter(Boolean)
  if (!names.length) return ''
  const shown = names.slice(0, 3)
  let block = '🎁 선물에 담긴 제품\n' + shown.map((n) => `· ${n}`).join('\n')
  if (names.length > 3) block += `\n· 외 ${names.length - 3}개`
  return block
}

/** 8트랙 × 3배송 전체 조합 (24개) */
export const GIFT_SHIPMENT_MESSAGES: Record<GiftTrack, Record<GiftDelivery, (giftTypeName: string, shipName: string) => string>> =
  Object.fromEntries(
    GIFT_TRACKS.map((track) => [
      track,
      Object.fromEntries(
        (['direct', 'quick', 'courier'] as GiftDelivery[]).map((delivery) => [
          delivery,
          (giftTypeName: string, shipName: string) => {
            const parts = [
              deliveryIntro(delivery, giftTypeName, shipName),
              `💡 ${GIFT_TRACK_TIPS[track]}`,
              '📱 앱에서 더 자세히 보기',
            ]
            return parts.join('\n\n')
          },
        ]),
      ),
    ]),
  ) as Record<GiftTrack, Record<GiftDelivery, (giftTypeName: string, shipName: string) => string>>

export function getGiftShipmentMessage(
  track: string,
  deliveryType: string,
  giftTypeName: string,
  shipName: string,
  products: Array<{ name: string }>,
): string {
  const t = normalizeTrack(track)
  const d = normalizeDelivery(deliveryType)
  const parts = [deliveryIntro(d, giftTypeName, shipName)]
  const productBlock = formatProductBlock(products)
  if (productBlock) parts.push(productBlock)
  parts.push(`💡 ${GIFT_TRACK_TIPS[t]}`)
  parts.push('📱 앱에서 더 자세히 보기')
  return parts.join('\n\n')
}
