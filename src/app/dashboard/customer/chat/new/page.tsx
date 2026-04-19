'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

const HELP_ITEMS: { key: string; label: string; sub: string; icon: string }[] = [
  { key: 'skin', label: '오늘 피부 고민', sub: 'AI 즉시 답변', icon: '🔬' },
  { key: 'routine', label: '루틴 재배치', sub: '보유 제품 기반', icon: '🔄' },
  { key: 'recommend', label: '제품 추천', sub: '피부타입 매핑', icon: '✨' },
  { key: 'photo', label: '사진 상담', sub: '조심한 상담', icon: '📷' },
  { key: 'sample', label: '샘플 받기', sub: '원장님 승인', icon: '🎁' },
  { key: 'sos', label: '피부 SOS', sub: '즉시 원장님 연결', icon: '🚨' },
]

export default function CustomerChatNewHelpPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromProduct = searchParams.get('from') === 'product'
  const productId = searchParams.get('product_id') ?? ''
  const [selecting, setSelecting] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setAuthReady(true)
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!cancelled) {
        if (urow?.id) setUserId(String(urow.id))
        setAuthReady(true)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelect = async (key: string) => {
    if (!authReady) return
    if (!userId) {
      router.replace('/login?role=customer')
      return
    }
    if (selecting) return
    setSelecting(true)
    try {
      const { data: ownerRow } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('user_id', userId)
        .eq('channel_type', 'owner')
        .maybeSingle()

      let id: string | undefined
      if (ownerRow?.id) {
        id = ownerRow.id
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('chat_channels')
          .insert({
            user_id: userId,
            channel_type: 'owner',
            title: '원장님 상담',
            system_kind: null,
            preview_text:
              fromProduct && productId ? `product_id:${productId}` : '',
            unread_count: 0,
            is_online: false,
          } as any)
          .select('id')
          .maybeSingle()
        if (!insErr && inserted?.id) id = inserted.id
      }
      if (id) {
        router.replace(`/dashboard/customer/chat/${id}?type=${encodeURIComponent(key)}`)
      }
    } finally {
      setSelecting(false)
    }
  }

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
        <>
          {fromProduct ? (
            <p
              style={{
                fontSize: 13,
                color: '#e8dff5',
                textAlign: 'center',
                margin: '0 0 16px',
                lineHeight: 1.55,
              }}
            >
              르노벨아로마 BLACK PINK 제품 상담을 신청해요 💜
            </p>
          ) : null}
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 20px', textAlign: 'center', color: '#e8dff5' }}>
            어떤 도움이 필요하세요?
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 480, margin: '0 auto' }}>
            {HELP_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={selecting}
                onClick={() => void handleSelect(item.key)}
                style={{
                  border:
                    item.key === 'sos' ? '1px solid rgba(217,79,79,0.35)' : `1px solid rgba(123,94,167,0.35)`,
                  background: item.key === 'sos' ? 'rgba(217,79,79,0.08)' : 'rgba(123,94,167,0.12)',
                  borderRadius: 14,
                  padding: '14px 12px',
                  cursor: selecting ? 'wait' : 'pointer',
                  textAlign: 'left',
                  opacity: selecting ? 0.75 : 1,
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontSize: 13, color: item.key === 'sos' ? '#e8a0a0' : '#fff', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{item.sub}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
