'use client'

import { useRouter } from 'next/navigation'
import ChartsSection from './ChartsSection'

const BG = '#ffffff'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'

export default function OwnerChartsV2Page() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 1024, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 20, minWidth: 44, minHeight: 44, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>시술 차트 V2</div>
      </div>
      <ChartsSection />
    </div>
  )
}
