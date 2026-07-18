'use client'
import { useState, useEffect } from 'react'
import { useBrandCart } from '@/context/BrandCartContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
export default function BrandCheckoutPage() {
  const { items, removeItem } = useBrandCart()
  const router = useRouter()
  const supabase = createClient()
  const [checkoutItems, setCheckoutItems] = useState<typeof items>([])
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddr, setSelectedAddr] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    const raw = sessionStorage.getItem('auran_brand_checkout_selection')
    const ids: string[] = raw ? JSON.parse(raw) : items.map(i => i.brand_product_id)
    setCheckoutItems(items.filter(i => ids.includes(i.brand_product_id)))
  }, [items])
  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?role=customer'); return }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) return
      const { data: addrs } = await supabase
        .from('shipping_addresses')
        .select('*')
        .eq('user_id', urow.id)
        .order('is_default', { ascending: false })
      setAddresses(addrs || [])
      setSelectedAddr((addrs || []).find(a => a.is_default) || (addrs || [])[0] || null)
    }
    run()
  }, [])
  const subtotal = checkoutItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const handlePayment = async () => {
    if (!selectedAddr || checkoutItems.length === 0) return
    setSubmitting(true)
    const checkoutBatchId = crypto.randomUUID()
    const bySalonBrand = checkoutItems.reduce((acc: Record<string, { salon_id: string; items: typeof items }>, item) => {
      const key = `${item.salon_id}__${item.brand_id}`
      if (!acc[key]) acc[key] = { salon_id: item.salon_id, items: [] }
      acc[key].items.push(item)
      return acc
    }, {})
    let totalAmount = 0
    const createdOrderIds: string[] = []
    for (const key of Object.keys(bySalonBrand)) {
      const group = bySalonBrand[key]
      const orderRes = await fetch('/api/brand-product-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salon_id: group.salon_id,
          checkout_batch_id: checkoutBatchId,
          items: group.items.map(i => ({ brand_product_id: i.brand_product_id, quantity: i.quantity })),
          recipient_name: selectedAddr.recipient_name,
          recipient_phone: selectedAddr.phone,
          address: selectedAddr.address,
          address_detail: selectedAddr.address_detail,
        }),
      }).then(r => r.json())
      if (!orderRes.ok) {
        alert('주문 생성에 실패했어요. 다시 시도해주세요.')
        setSubmitting(false)
        return
      }
      totalAmount += orderRes.final_amount
      createdOrderIds.push(orderRes.order_id)
    }
    const payRes = await fetch('/api/payments/payapp/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'brand_product_order',
        amount: totalAmount,
        target_id: checkoutBatchId,
      }),
    }).then(r => r.json())
    if (payRes.ok && payRes.pay_url) {
      checkoutItems.forEach(i => removeItem(i.brand_product_id))
      sessionStorage.removeItem('auran_brand_checkout_selection')
      window.location.href = payRes.pay_url
    } else {
      alert('결제 생성에 실패했어요.')
      setSubmitting(false)
    }
  }
  return (
    <div>
      {checkoutItems.map(item => (
        <div key={item.brand_product_id}>
          <span>{item.salon_name} · {item.name} × {item.quantity}</span>
        </div>
      ))}
      {selectedAddr && (
        <div>
          <p>{selectedAddr.recipient_name} · {selectedAddr.phone}</p>
          <p>{selectedAddr.address} {selectedAddr.address_detail}</p>
        </div>
      )}
      <div>총 결제금액 {subtotal.toLocaleString()}원</div>
      <button onClick={handlePayment} disabled={submitting || !selectedAddr}>
        {subtotal.toLocaleString()}원 결제하기
      </button>
    </div>
  )
}
