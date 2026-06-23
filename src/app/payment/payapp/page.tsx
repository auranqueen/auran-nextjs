
'use client'
import { useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function PayAppInner() {
  const router = useRouter()
  const params = useSearchParams()
  const didRun = useRef(false)

  useEffect(() => {
    const productIdsRaw = params.get('products') || params.get('product_id') || ''
    const productIdList = productIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
    const qtyListRaw = (params.get('qty') || '1').split(',').map(s => Math.max(1, Number(s) || 1))
    const lockKey = `payapp_lock_${productIdsRaw}_${params.get('amount')}`
    if (sessionStorage.getItem(lockKey)) return
    sessionStorage.setItem(lockKey, '1')
    setTimeout(() => sessionStorage.removeItem(lockKey), 5000)
    if (!params.get('amount')) return

    if (!productIdList.length) {
      router.push('/')
      return
    }

    const doPayment = async () => {
      const supabase = createClient()
      const { data: productRows } = await supabase
        .from('products')
        .select('id, name, retail_price, sale_price')
        .in('id', productIdList)

      if (!productRows?.length) {
        alert('제품 정보를 찾을 수 없어요')
        router.push('/')
        return
      }
      const product = productRows[0]
      const representName = productRows.length > 1
        ? `${product.name} 외 ${productRows.length - 1}개`
        : product.name

      const rawAmount = params.get('amount')
      const amount = Number(rawAmount)
      if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
        router.replace('/?error=invalid_amount')
        return
      }

      const { data: { user: _u } } = await supabase.auth.getUser()
      if (_u) {
        const duplicateOrderPromise = supabase
          .from('orders')
          .select('id, order_no, users!orders_customer_id_fkey!inner(auth_id)')
          .eq('users.auth_id', _u.id)
          .eq('payment_applied', false)
          .eq('final_amount', amount)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const [{ data: _urow }, { data: _existing }] = await Promise.all([
          supabase.from('users').select('id').eq('auth_id', _u.id).maybeSingle(),
          duplicateOrderPromise,
        ])
        if (_urow?.id && _existing?.id) {
          await supabase.from('orders')
            .update({ status: '취소' })
            .eq('id', _existing.id)
        }
      }

      const shippingFee = Math.max(0, Math.floor(Number(params.get('shipping_fee') ?? 0)))
      const gradeDiscount = Math.max(0, Math.floor(Number(params.get('grade_discount') ?? 0)))
      const subtotalParam = Math.max(0, Math.floor(Number(params.get('subtotal') ?? 0)))
      const couponDiscount = Math.max(0, Math.floor(Number(params.get('coupon_discount') ?? 0)))
      const addressDetailParam = (() => { try { return decodeURIComponent(params.get('address_detail') || '') || null } catch { return null } })()

      const orderRes = await fetch('/api/payment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          product_id: productIdList[0],
          quantity: qtyListRaw[0],
          products: productIdList.map((id, i) => ({
            product_id: id,
            quantity: qtyListRaw[i] ?? 1,
          })),
          represent_name: representName,
          payment_method: 'payapp',
          total_amount: amount,
          final_amount: amount,
          shipping_fee: shippingFee,
          grade_discount: gradeDiscount,
          subtotal: subtotalParam,
          recipient_name: decodeURIComponent(params.get('recipient_name') || '') || null,
          recipient_phone: decodeURIComponent(params.get('recipient_phone') || '') || null,
          address: (decodeURIComponent(params.get('address') || '') || '') + (addressDetailParam ? ' ' + addressDetailParam : '') || null,
          coupon_discount: couponDiscount,
          user_coupon_id: (() => { const id = params.get('user_coupon_id'); return (id && !id.startsWith('virtual_')) ? id : null })(),
        }),
      })
      const orderData = await orderRes.json()
      if (!orderData.orderId) {
        router.replace('/?error=order_fail')
        return
      }

      const res = await fetch('/api/payments/payapp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          kind: 'order',
          amount,
          target_id: orderData.orderId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok && json?.pay_url) {
        window.location.href = json.pay_url
      } else {
        alert('결제 요청 실패: ' + (json?.error || '알 수 없는 오류'))
        router.push('/')
      }
    }

    doPayment()
  }, [])

  return (
    <div style={{
      background: '#0d0b09', color: '#e8e4dc',
      minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16,
      fontFamily: '"Apple SD Gothic Neo", sans-serif'
    }}>
      <div style={{ fontSize: 32 }}>🔄</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>결제창으로 이동 중...</div>
      <div style={{ fontSize: 13, color: '#888' }}>잠시만 기다려주세요</div>
    </div>
  )
}

export default function PayAppPage() {
  return (
    <Suspense fallback={
      <div style={{
        background: '#0d0b09', color: '#e8e4dc',
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ color: '#e8e4dc' }}>로딩 중...</div>
      </div>
    }>
      <PayAppInner />
    </Suspense>
  )
}