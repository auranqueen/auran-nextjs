import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const orderId = formData.get('order_id') 
    || formData.get('orderId')
    || formData.get('OID')
    || ''
  
  return NextResponse.redirect(
    new URL(`/orders/complete?order_id=${orderId}`, req.url)
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('order_id') || ''
  
  return NextResponse.redirect(
    new URL(`/orders/complete?order_id=${orderId}`, req.url)
  )
}
