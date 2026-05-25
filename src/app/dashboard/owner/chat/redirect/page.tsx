'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OwnerChatRedirect() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace('/super-console/login')
        return
      }
      const appRole = data.user.app_metadata?.role || ''
      const isAdmin = appRole === 'admin' || appRole === 'super_admin'
      if (!isAdmin) {
        const { data: uRow } = await supabase.from('users').select('role').eq('auth_id', data.user.id).maybeSingle()
        if (!uRow || uRow.role !== 'owner') {
          router.replace('/super-console/login')
          return
        }
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

  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
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
