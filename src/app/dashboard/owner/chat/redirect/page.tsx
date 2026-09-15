'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0a0a0a'
const PURPLE = '#7B5EA7'

export default function OwnerChatRedirect() {
  const router = useRouter()
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/super-console/login')
        return
      }
      const { data: uRow } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', data.user.id)
        .maybeSingle()
      // channel_type='owner' 인박스는 HQ(admin) 전용 — 일반 원장은 진입 차단
      if (uRow?.role !== 'admin') {
        setDenied(true)
        return
      }
      supabase
        .from('chat_channels')
        .select('id')
        .eq('channel_type', 'owner')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: ch }) => {
          if (ch?.id) {
            router.replace('/dashboard/owner/chat/' + ch.id)
          } else {
            router.replace('/dashboard/owner')
          }
        })
    })
  }, [router])

  if (denied) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontSize: 13 }}>
        <p style={{ marginBottom: 16 }}>이 인박스는 이용할 수 없습니다</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner')}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: `1px solid ${PURPLE}`,
            background: 'rgba(123,94,167,0.15)',
            color: '#e8dff5',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          대시보드로
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid #7B5EA7',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
