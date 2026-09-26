'use client'

import CartHeaderButton from '@/components/CartHeaderButton'

export default function CustomerHeaderRight() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <CartHeaderButton />
    </div>
  )
}
