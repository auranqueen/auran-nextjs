'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'

export default function CustomerChatNewHelpPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromProduct = searchParams.get('from') === 'product'
  const productId = searchParams.get('product_id') ?? ''
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        await new Promise(r => setTimeout(r, 1000))
        const { data: retry } = await supabase.auth.getUser()
        user = retry.user
      }
      if (!user) {
        if (!cancelled) router.replace('/login?role=customer&redirect=/dashboard/customer/chat/new')
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) {
        if (!cancelled) router.replace('/login?role=customer&redirect=/dashboard/customer/chat/new')
        return
      }
      const uid = String(urow.id)
      const { data: ownerRow } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('user_id', uid)
        .eq('channel_type', 'owner')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      let id: string | undefined
      if (ownerRow?.id) {
        id = ownerRow.id
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('chat_channels')
          .insert({
            user_id: uid,
            channel_type: 'owner',
            title: '원장님 상담',
            system_kind: null,
            preview_text: fromProduct && productId ? `product_id:${productId}` : '',
            unread_count: 0,
            is_online: false,
          } as any)
          .select('id')
          .maybeSingle()
        if (!insErr && inserted?.id) id = inserted.id
      }
      if (cancelled) return
      if (id) {
        router.replace(`/dashboard/customer/chat/${id}`)
        return
      }
      setAuthReady(true)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [fromProduct, productId, router])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: '#fff',
        padding: '24px 16px 32px',
        boxSizing: 'border-box',
      }}
    >
      {!authReady ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: `3px solid rgba(123,94,167,0.25)`,
              borderTopColor: PURPLE,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ minHeight: '60vh' }} />
      )}
    </div>
  )
}
