// ===== [인서트 카드 PDF API] =====
// QR URL: https://auran.kr/store-review?utm_source=insert_card
// 어드민에서 호출 → PDF 스트림 반환
import { NextResponse } from 'next/server'

export async function GET() {
  // QR URL 확정
  const QR_URL = 'https://auran.kr/store-review?utm_source=insert_card'
  return NextResponse.json({ qr_url: QR_URL })
}
