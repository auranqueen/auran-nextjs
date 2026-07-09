'use client'

import { useEffect } from 'react'

const STORE_TYPE_OPTIONS = ['피부관리실', '왁싱샵', '네일샵', '반영구샵', '자유기재'] as const

type Props = {
  hasOfflineStore: boolean | null
  setHasOfflineStore: (v: boolean | null) => void
  storeType: string
  setStoreType: (v: string) => void
  ownerStoreAddress: string
  setOwnerStoreAddress: (v: string) => void
  ownerStoreArea: string
  setOwnerStoreArea: (v: string) => void
  error: string
  loading: boolean
  meta: { label: string; icon: string; color: string; border: string; bg: string }
  onSubmit: () => void
}

export default function OwnerStoreStep({
  hasOfflineStore,
  setHasOfflineStore,
  storeType,
  setStoreType,
  ownerStoreAddress,
  setOwnerStoreAddress,
  setOwnerStoreArea,
  error,
  loading,
  meta,
  onSubmit,
}: Props) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).daum?.Postcode) return
    const existing = document.querySelector('script[data-daum-postcode="true"]')
    if (existing) return
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.setAttribute('data-daum-postcode', 'true')
    document.body.appendChild(script)
  }, [])

  return (
    <div>
      <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>매장 정보를 알려주세요</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>원장님 맞춤 설정에 사용됩니다</div>

      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>오프라인 매장이 있으신가요?</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { label: '있음', value: true },
          { label: '없음', value: false },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => {
              setHasOfflineStore(opt.value)
              if (!opt.value) setStoreType('')
            }}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              background: hasOfflineStore === opt.value ? meta.bg : 'var(--bg3)',
              border: `1px solid ${hasOfflineStore === opt.value ? meta.border : 'var(--border)'}`,
              color: hasOfflineStore === opt.value ? meta.color : 'var(--text3)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {hasOfflineStore === true && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>업종 선택 *</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STORE_TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStoreType(t)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 20,
                  fontSize: 11,
                  cursor: 'pointer',
                  background: storeType === t ? meta.bg : 'var(--bg3)',
                  border: `1px solid ${storeType === t ? meta.border : 'var(--border)'}`,
                  color: storeType === t ? meta.color : 'var(--text3)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasOfflineStore !== null && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
            {hasOfflineStore ? '영업장 주소 *' : '택배 출고지 주소 *'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={ownerStoreAddress}
              onChange={(e) => setOwnerStoreAddress(e.target.value)}
              placeholder="주소"
              readOnly
              style={{
                flex: 1,
                minWidth: 0,
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '13px 14px',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (!(window as any).daum?.Postcode) return
                new (window as any).daum.Postcode({
                  oncomplete: (data: any) => {
                    setOwnerStoreAddress(String(data?.roadAddress || ''))
                    const areaPart = [data?.sido, data?.sigungu].filter(Boolean).join(' ').trim()
                    if (areaPart) setOwnerStoreArea(areaPart)
                  },
                }).open()
              }}
              style={{ width: 72, flexShrink: 0, border: 'none', borderRadius: 8, background: '#bf5f90', color: '#fff', fontSize: 12, cursor: 'pointer' }}
            >
              주소 검색
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>{error}</div>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.color, fontSize: 15, fontWeight: 700, marginTop: 20, opacity: loading ? 0.7 : 1 }}
      >
        가입 완료
      </button>
    </div>
  )
}
