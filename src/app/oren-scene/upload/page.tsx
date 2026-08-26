'use client'

import { Suspense } from 'react'
import OrenSceneUploadInner from './UploadClient'

export default function OrenSceneUploadPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0D0B09', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>불러오는 중…</div>}>
      <OrenSceneUploadInner />
    </Suspense>
  )
}
