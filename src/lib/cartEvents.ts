/** 클라이언트에서 장바구니 건수 배지를 갱신할 때 브로드캐스트 */
export const CART_COUNT_REFRESH_EVENT = 'auran-cart-count-refresh'

export function broadcastCartCountRefresh() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CART_COUNT_REFRESH_EVENT))
}
