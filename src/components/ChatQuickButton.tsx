'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChatQuickButton() {
  const router = useRouter()
  const pathname = usePathname() || ''
  const supabase = createClient()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user)
    })
  }, [])

  if (!loggedIn) return null

  return (
    <button
      type="button"
      onClick={() => router.push('/dashboard/customer/chat/new')}
      style={{
        position: 'fixed',
        right: 16,
        bottom: pathname.startsWith('/products/') ? 280 : 208,
        zIndex: 999,
        width: 52,
        height: 52,
        borderRadius: 12,
        background: '#7B5EA7',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(123,94,167,0.35)',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>💬</span>
      <span style={{ fontSize: 8, color: 'white', lineHeight: 1.2 }}>상담톡</span>
    </button>
  )
}
