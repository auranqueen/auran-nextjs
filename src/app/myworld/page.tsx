'use client'

import { useRouter } from 'next/navigation'

export default function MyWorldPage() {
  const router = useRouter()
  return (
    <div style={{ padding: 40 }}>
      <button
        onClick={() => router.push('/my/reviews')}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 12,
          border: 'none',
          background: '#7B5EA7',
          color: '#fff',
          fontSize: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 16,
        }}
      >
        ✍️ 오랜 스토리 작성
      </button>
      <h1>마이월드</h1>
    </div>
  )
}
