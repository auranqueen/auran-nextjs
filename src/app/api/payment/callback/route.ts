import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.formData()
  
  const orderId = body.get('orderid') as string
  const status = body.get('stat') as string
  const payId = body.get('payid') as string

  if (status === 'Y') {
    await supabase
      .from('orders')
      .update({ status: 'paid', pay_id: payId })
      .eq('id', orderId)
  }

  return NextResponse.json({ success: true })
}
