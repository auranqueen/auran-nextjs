'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/context/CartContext'

const btnStyle: React.CSSProperties = {
  width: '2.125rem',
  height: '2.125rem',
  borderRadius: '0.5625rem',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  fontSize: '1rem',
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
      <img src="/icons/cart.svg" alt="장바구니" width={24} height={24} style={{display:'block'}} />
      {totalQty > 0 ? (
        <span
          className={bounceClass ? 'auran-cart-badge-bounce' : undefined}
          style={{
            position: 'absolute',
            top: '-0.25rem',
            right: '-0.25rem',
            minWidth: '1rem',
            height: '1rem',
            padding: '0 0.25rem',
            background: '#d94f4f',
            borderRadius: 999,
            fontSize: '0.5625rem',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            lineHeight: '1rem',
          }}
        >
          {totalQty > 99 ? '99+' : totalQty}
        </span>
      ) : null}
    </Link>
  )
}
