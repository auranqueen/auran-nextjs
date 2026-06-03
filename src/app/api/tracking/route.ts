import { NextRequest, NextResponse } from 'next/server'

const CARRIER_MAP: Record<string, string> = {
  'CJ대한통운': 'kr.cjlogistics',
  '한진택배': 'kr.hanjin',
  '롯데택배': 'kr.lotte',
  '우체국택배': 'kr.epost',
  '로젠택배': 'kr.logen',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const courier = searchParams.get('courier') || 'CJ대한통운'
    const trackingNo = searchParams.get('tracking_no') || ''
    if (!trackingNo) return NextResponse.json({ error: 'tracking_no required' }, { status: 400 })
    const carrierId = CARRIER_MAP[courier] || 'kr.cjlogistics'
    const res = await fetch(
      `https://apis.tracker.delivery/carriers/${carrierId}/tracks/${trackingNo}`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 60 } }
    )
    if (!res.ok) return NextResponse.json({ error: 'tracker api error', status: res.status }, { status: 502 })
    const data = await res.json()
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
