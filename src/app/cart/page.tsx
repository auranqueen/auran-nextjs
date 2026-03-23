'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import CartPageView from '@/components/ui/CartPageView'
import CustomerDashboardShell from '@/components/views/CustomerDashboardShell'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/context/CartContext'

type SearchHit = { id: string; name: string; email: string }

export default function CartPage() {
  const router = useRouter()
  const supabase = createClient()
  const {
    items,
    selectedIds,
    setSelected,
    setAllSelected,
    setQuantity,
    removeLine,
  } = useCart()
  const selectedLines = useMemo(() => items.filter((i) => selectedIds[i.id] !== false), [items, selectedIds])

  const [toast, setToast] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftQ, setGiftQ] = useState('')
  const [giftHits, setGiftHits] = useState<SearchHit[]>([])
  const [giftPick, setGiftPick] = useState('')
  const [giftLoading, setGiftLoading] = useState(false)

  const selectedCount = selectedLines.length
  const selectedSubtotal = useMemo(
    () => selectedLines.reduce((s, i) => s + i.price * i.quantity, 0),
    [selectedLines]
  )

  const allSelected = useMemo(() => {
    if (items.length === 0) return false
    return items.every((i) => selectedIds[i.id] !== false)
  }, [items, selectedIds])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const goCheckout = useCallback(
    (giftTo?: string) => {
      const lines = selectedLines
      if (!lines.length) {
        setToast('선택한 상품이 없어요')
        return
      }
      const params = new URLSearchParams()
      params.set('products', lines.map((r) => r.product_id).join(','))
      params.set('qty', lines.map((r) => r.quantity).join(','))
      if (giftTo) params.set('gift_to', giftTo)
      router.push(`/checkout?${params.toString()}`)
    },
    [router, selectedLines]
  )

  const onBuyClick = () => router.push('/checkout')

  const searchGiftUsers = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length < 2) {
      setGiftHits([])
      return
    }
    setGiftLoading(true)
    try {
      const res = await fetch(`/api/customer/search-users?q=${encodeURIComponent(t)}`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) {
        setGiftHits([])
        return
      }
      setGiftHits((j.users || []) as SearchHit[])
    } finally {
      setGiftLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!giftOpen) return
    const t = window.setTimeout(() => void searchGiftUsers(giftQ), 320)
    return () => clearTimeout(t)
  }, [giftQ, giftOpen, searchGiftUsers])

  const openGiftModal = async () => {
    if (!selectedLines.length) {
      setToast('선물할 상품을 선택해 주세요')
      return
    }
    setGiftQ('')
    setGiftHits([])
    setGiftPick('')
    setGiftOpen(true)
  }

  return (
    <CustomerDashboardShell paddingBottom={200}>
      <DashboardHeader title="장바구니" right={<CustomerHeaderRight />} />
      <CartPageView
        toast={toast}
        items={items}
        selectedIds={selectedIds}
        allSelected={allSelected}
        selectedCount={selectedCount}
        selectedSubtotal={selectedSubtotal}
        giftOpen={giftOpen}
        giftQ={giftQ}
        giftHits={giftHits}
        giftPick={giftPick}
        giftLoading={giftLoading}
        onGiftQChange={setGiftQ}
        onCloseGift={() => setGiftOpen(false)}
        onGiftPick={setGiftPick}
        onConfirmGift={() => {
          setGiftOpen(false)
          goCheckout(giftPick)
        }}
        onSetAllSelected={setAllSelected}
        onSetSelected={setSelected}
        onQuantity={setQuantity}
        onRemove={removeLine}
        onBuy={onBuyClick}
        onOpenGift={openGiftModal}
      />
      <DashboardBottomNav role="customer" />
    </CustomerDashboardShell>
  )
}
