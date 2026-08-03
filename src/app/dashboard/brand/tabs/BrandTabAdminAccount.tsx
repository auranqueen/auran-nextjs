'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
const BrandInventoryStaff = dynamic(() => import('./BrandInventoryStaff'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'company', label: '컴퍼니정보' },
  { key: 'admins', label: '관리자관리' },
  { key: 'policy', label: '판매정책 준수 현황' },
] as const
type SubTab = typeof SUBTABS[number]['key']
type Props = {
  brandId: string | null
  companyId: string | null
  currentUserRole?: string
}
export default function BrandTabAdminAccount({ brandId, companyId, currentUserRole = 'ceo' }: Props) {
  const [sub, setSub] = useState<SubTab>('company')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {SUBTABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: sub === t.key ? `2px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.15)',
              background: sub === t.key ? '#c4a7e7' : 'transparent',
              color: sub === t.key ? '#1a1520' : SUB,
              fontSize: 13,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'company' && (
        <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>
          컴퍼니정보 기능은 준비중입니다.
        </div>
      )}
      {sub === 'admins' && (
        <BrandInventoryStaff brandId={brandId} companyId={companyId} currentUserRole={currentUserRole} />
      )}
      {sub === 'policy' && (
        <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>
          판매정책 준수 현황 기능은 준비중입니다.
        </div>
      )}
    </div>
  )
}
