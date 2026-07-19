'use client'
import { useState } from 'react'
import ReviewWriteForm from './ReviewWriteForm'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
interface Props {
  eligibleOrderId: string | null
  brandProductId: string
}
export default function ReviewSection({ eligibleOrderId, brandProductId }: Props) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  if (!eligibleOrderId || done) return null
  return (
    <div style={{ marginBottom: 16 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ width: '100%', border: `1px solid ${BORDER}`, background: 'transparent', color: PURPLE, borderRadius: 10, padding: 11, fontSize: 13 }}
        >
          이 제품 리뷰 작성하기
        </button>
      ) : (
        <ReviewWriteForm
          orderId={eligibleOrderId}
          brandProductId={brandProductId}
          onDone={() => { setOpen(false); setDone(true) }}
        />
      )}
    </div>
  )
}
