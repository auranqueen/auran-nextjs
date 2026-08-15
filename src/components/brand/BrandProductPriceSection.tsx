'use client'

import type { CSSProperties } from 'react'
import TabBrandSelector from '@/app/dashboard/brand/components/TabBrandSelector'

type BrandOption = { id: string; name: string }

type Props = {
  editId: string | null
  name: string
  setName: (value: string) => void
  shortDesc: string
  setShortDesc: (value: string) => void
  keywords: string
  setKeywords: (value: string) => void
  brandId: string
  setBrandId: (value: string) => void
  brandOptions: BrandOption[]
  selectedBrandName: string
  supplyPrice: string
  setSupplyPrice: (value: string) => void
  consumerPrice: string
  setConsumerPrice: (value: string) => void
  categoryBreadcrumb: string
  onOpenCategory: () => void
  manufacturer: string
  setManufacturer: (value: string) => void
  isExclusive: boolean
  setIsExclusive: (value: boolean) => void
  isSamplePouch: boolean
  setIsSamplePouch: (value: boolean) => void
}

const S = {
  sec: { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 } as CSSProperties,
  secTitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  lbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' } as CSSProperties,
  inp: { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e8e4dc', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const } as CSSProperties,
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 } as CSSProperties,
  f: { marginBottom: 10 } as CSSProperties,
}

export default function BrandProductPriceSection({
  editId,
  name,
  setName,
  shortDesc,
  setShortDesc,
  keywords,
  setKeywords,
  brandId: _brandId,
  setBrandId,
  brandOptions,
  selectedBrandName,
  supplyPrice,
  setSupplyPrice,
  consumerPrice,
  setConsumerPrice,
  categoryBreadcrumb,
  onOpenCategory,
  manufacturer,
  setManufacturer,
  isExclusive,
  setIsExclusive,
  isSamplePouch,
  setIsSamplePouch,
}: Props) {
  return (
    <div style={S.sec}>
      <div style={S.secTitle}>기본 정보</div>
      <div style={S.f}><span style={S.lbl}>상품명 (최대 100자)</span><input style={S.inp} value={name} onChange={e => setName(e.target.value)} placeholder="상품명" /></div>
      <div style={S.f}><span style={S.lbl}>짧은 설명</span><input style={S.inp} value={shortDesc} onChange={e => setShortDesc(e.target.value)} placeholder="한 줄 설명" /></div>
      <div style={S.f}><span style={S.lbl}>검색 키워드</span><input style={S.inp} value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="보습, 진정, 마스크팩" /></div>
      {editId ? (
        <div style={S.f}>
          <span style={S.lbl}>브랜드</span>
          <div style={S.inp}>{selectedBrandName}</div>
        </div>
      ) : (
        <div style={S.f}>
          <TabBrandSelector
            myBrands={brandOptions}
            storageKey="product-form-brand"
            onSelect={setBrandId}
          />
        </div>
      )}
      <div style={S.row2}>
        <div>
          <span style={S.lbl}>공급가 (원)</span>
          <input style={S.inp} type="number" min={0} value={supplyPrice} onChange={(e) => setSupplyPrice(e.target.value)} placeholder="0" />
        </div>
        <div>
          <span style={S.lbl}>소비자가 (원)</span>
          <input style={S.inp} type="number" min={0} value={consumerPrice} onChange={(e) => setConsumerPrice(e.target.value)} placeholder="0" />
        </div>
      </div>
      {!editId && <div style={{ fontSize: 11, color: '#c4a7e7', marginBottom: 8 }}>선택한 브랜드에 제품이 등록됩니다.</div>}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>원산지는 브랜드별로 서버에서 자동 설정됩니다.</div>
      <div style={S.row2}>
        <div>
          <span style={S.lbl}>카테고리</span>
          <button type="button" onClick={onOpenCategory} style={{ ...S.inp, textAlign: 'left', cursor: 'pointer', background: '#1a1714' }}>
            {categoryBreadcrumb || '카테고리 선택'}
          </button>
          {categoryBreadcrumb && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{categoryBreadcrumb}</div>}
        </div>
        <div><span style={S.lbl}>제조사</span><input style={S.inp} value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="제조사명" /></div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <input type="checkbox" checked={isExclusive} onChange={e => setIsExclusive(e.target.checked)} style={{ accentColor: '#7b5ea7' }} />AURAN 독점
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <input type="checkbox" checked={isSamplePouch} onChange={e => setIsSamplePouch(e.target.checked)} style={{ accentColor: '#7b5ea7' }} />샘플파우치 (파우치등급 산정 제외)
        </label>
      </div>
    </div>
  )
}
