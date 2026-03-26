/** 알림 카드 하단 날짜·시간 (예: 2026. 03. 21. 16:35:42) */
export function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (!Number.isFinite(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  const secs = String(d.getSeconds()).padStart(2, '0')
  return `${year}. ${month}. ${day}. ${hours}:${mins}:${secs}`
}

export function getNotificationIcon(type: string | null | undefined) {
  switch (String(type || '').toLowerCase()) {
    case 'point':
      return '✨'
    case 'coupon':
      return '🎫'
    case 'order':
      return '📦'
    case 'gift':
      return '🎁'
    case 'welcome':
      return '🎉'
    case 'system':
      return '📢'
    case 'birthday':
      return '🎂'
    case 'social':
      return '🤝'
    case 'promo':
      return '🎫'
    case 'coupon_issued':
      return '🎁'
    default:
      return '🔔'
  }
}

/** DB에 link 없을 때 타입별 기본 이동 경로 */
export function getDefaultLinkForType(type: string | null | undefined): string | null {
  switch (String(type || '').toLowerCase()) {
    case 'point':
      return '/wallet'
    case 'coupon':
    case 'coupon_issued':
    case 'birthday':
    case 'promo':
      return '/my/coupons'
    case 'order':
      return '/orders'
    case 'gift':
      return '/my/gifts'
    case 'welcome':
      return '/'
    case 'social':
      return '/myworld'
    default:
      return null
  }
}

function startOfLocalDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 섹션 헤더 라벨 (오늘 / 어제 / N일 전 / YYYY. MM. DD.) */
export function getNotificationGroupLabel(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const today = startOfLocalDay(Date.now())
  const day = startOfLocalDay(d.getTime())
  const diffDays = Math.round((today - day) / 86400000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays >= 2 && diffDays < 7) return `${diffDays}일 전`
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}. ${m}. ${dd}.`
}
