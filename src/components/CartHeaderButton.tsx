'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CART_COUNT_REFRESH_EVENT } from '@/lib/cartEvents'

const btnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  position: 'relative',
}

export default function CartHeaderButton() {
  const supabase = createClient()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) {
        setCount(0)
        try {
          localStorage.setItem('auran_cart_badge_count', '0')
        } catch {}
        return
      }
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!me?.id) {
        setCount(0)
        return
      }
      const { count: c } = await supabase
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', me.id)
      const n = c || 0
      setCount(n)
      try {
        localStorage.setItem('auran_cart_badge_count', String(n))
      } catch {}
    } catch {
      setCount(0)
    }
  }, [supabase])

  useEffect(() => {
    refresh()
    const onRefresh = () => {
      void refresh()
    }
    window.addEventListener(CART_COUNT_REFRESH_EVENT, onRefresh)
    window.addEventListener('storage', onRefresh)
    return () => {
      window.removeEventListener(CART_COUNT_REFRESH_EVENT, onRefresh)
      window.removeEventListener('storage', onRefresh)
    }
  }, [refresh])

  return (
    <Link href="/cart" aria-label="장바구니" style={btnStyle}>
      🛒
      {count > 0 ? (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            background: '#d94f4f',
            borderRadius: 999,
            fontSize: 9,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            lineHeight: '16px',
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}
