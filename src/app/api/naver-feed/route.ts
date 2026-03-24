import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('products')
    .select('id,name,retail_price,thumb_img')
    .eq('status', 'active')
    .gt('retail_price', 0)
    .order('sales_count', { ascending: false })
    .limit(2000)

  const rows = (data || [])
    .map((p: any) => `<product>
  <id>${p.id}</id>
  <title><![CDATA[${p.name || ''}]]></title>
  <price>${Number(p.retail_price || 0)}</price>
  <image><![CDATA[${p.thumb_img || ''}]]></image>
  <link>https://auran.kr/products/${p.id}</link>
  <category><![CDATA[화장품/스킨케어]]></category>
  <brand><![CDATA[${p.brands?.name || ''}]]></brand>
</product>`)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<products>
${rows}
</products>`
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
