'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/context/CartContext'

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
  const { count: totalQty, bump } = useCart()
  const prevBump = useRef(-1)
  const skipFirstBump = useRef(true)
  const [bounceClass, setBounceClass] = useState(false)

  useEffect(() => {
    if (skipFirstBump.current) {
      skipFirstBump.current = false
      prevBump.current = bump
      return
    }
    if (bump <= prevBump.current) {
      prevBump.current = bump
      return
    }
    prevBump.current = bump
    setBounceClass(true)
    const t = window.setTimeout(() => setBounceClass(false), 500)
    return () => clearTimeout(t)
  }, [bump])

  return (
    <Link href="/cart" aria-label="장바구니" style={btnStyle}>
      🛒
      {totalQty > 0 ? (
        <span
          className={bounceClass ? 'auran-cart-badge-bounce' : undefined}
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
          {totalQty > 99 ? '99+' : totalQty}
        </span>
      ) : null}
    </Link>
  )
}
