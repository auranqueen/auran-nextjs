import { NextRequest, NextResponse } from 'next/server'

/**
 * PayApp 결제 완료 후 사용자가 돌아오는 URL.
 * PayApp이 GET 또는 POST로 호출할 수 있어서 둘 다 허용하고 /wallet 로 리다이렉트.
 * (POST만 허용된 URL로 오면 405 Method Not Allowed 발생)
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id')
  const bookingFlag = req.nextUrl.searchParams.get('booking')
  const bookingSalonId = req.nextUrl.searchParams.get('salon_id')
  if (bookingFlag === 'true' && bookingSalonId) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/salons/${bookingSalonId}?booking_paid=true`,
      302,
    )
  }
  if (orderId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/orders/complete?order_id=${orderId}`, 302)
  }
  return NextResponse.redirect(`${req.nextUrl.origin}/wallet?payment=done`, 302)
}

export async function POST(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id')
  const bookingFlag = req.nextUrl.searchParams.get('booking')
  const bookingSalonId = req.nextUrl.searchParams.get('salon_id')
  if (bookingFlag === 'true' && bookingSalonId) {
    return NextResponse.redirect(
      `${req.nextUrl.origin}/salons/${bookingSalonId}?booking_paid=true`,
      302,
    )
  }
  if (orderId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/orders/complete?order_id=${orderId}`, 302)
  }
  return NextResponse.redirect(`${req.nextUrl.origin}/wallet?payment=done`, 302)
}
