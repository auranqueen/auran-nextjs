'use client'

import CartHeaderButton from '@/components/CartHeaderButton'
import NoticeBell from '@/components/NoticeBell'

export default function CustomerHeaderRight() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <CartHeaderButton />
      <NoticeBell />
    </div>
  )
}
