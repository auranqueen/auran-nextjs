import { NextRequest, NextResponse } from 'next/server'

/**
 * PayApp 결제 완료 후 사용자가 돌아오는 URL.
 * PayApp이 GET 또는 POST로 호출할 수 있어서 둘 다 허용하고 /wallet 로 리다이렉트.
 * (POST만 허용된 URL로 오면 405 Method Not Allowed 발생)
 */
const WALLET_PATH = '/wallet'

function redirectToWallet(req: NextRequest, success = true) {
  const origin = req.nextUrl.origin
  const url = `${origin}${WALLET_PATH}${success ? '?payment=done' : ''}`
  return NextResponse.redirect(url, 302)
}

export async function GET(req: NextRequest) {
  return redirectToWallet(req, true)
}

export async function POST(req: NextRequest) {
  return redirectToWallet(req, true)
}
