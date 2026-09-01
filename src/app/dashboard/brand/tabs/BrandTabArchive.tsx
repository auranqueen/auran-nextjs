'use client'

import { useState, type CSSProperties } from 'react'
import BrandArchiveManage from '@/components/brand/BrandArchiveManage'
import BrandArchiveEducationManage from '@/components/brand/BrandArchiveEducationManage'
import BrandLiveSection from '@/components/brand/BrandLiveSection'

type SubTab = 'treatment' | 'material' | 'education' | 'live'

interface Props {
  brandId: string | null
  companyId: string | null
  staffId: string | null
  myBrands: { id: string; name: string }[]
  initialSub?: string
}

const PURPLE = '#7B5EA7'
const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
}
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

const TABS: { key: SubTab; label: string }[] = [
  { key: 'treatment', label: '트리트먼트 프로그램' },
  { key: 'material', label: '제품교육자료' },
  { key: 'education', label: '에듀케이션 관리' },
  { key: 'live', label: '라이브' },
]

export default function BrandTabArchive({ brandId, companyId, staffId, myBrands, initialSub }: Props) {
  const [sub, setSub] = useState<SubTab>((initialSub as SubTab) || 'treatment')

  if (!companyId) {
    return <div style={{ ...CARD, color: SUB, fontSize: 13 }}>회사 정보를 불러오는 중…</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSub(t.key)}
            style={{
              fontSize: 11,
              padding: '7px 12px',
              borderRadius: 8,
              border: sub === t.key ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.08)',
              background: sub === t.key ? 'rgba(123,94,167,0.2)' : 'transparent',
              color: sub === t.key ? '#C9A96E' : TEXT,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {(sub === 'treatment' || sub === 'material') && (
        <BrandArchiveManage companyId={companyId} staffId={staffId} category={sub} fixedSource="general" />
      )}
      {sub === 'education' && (
        <BrandArchiveEducationManage companyId={companyId} staffId={staffId} />
      )}
      {sub === 'live' && (
        <BrandLiveSection myBrands={myBrands} brandId={brandId} />
      )}
    </div>
  )
}
