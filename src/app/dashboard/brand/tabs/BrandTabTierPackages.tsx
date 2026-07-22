'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TabBrandSelector from '../components/TabBrandSelector'

const PURPLE = '#7B5EA7'

type TierPackage = {
  id: string
  tier_name: string
  price: number
  is_active: boolean | null
}

type Draft = {
  tier_name: string
  price: string
}

type Props = {
  myBrands: { id: string; name: string }[]
}

export default function BrandTabTierPackages({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [rows, setRows] = useState<TierPackage[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('brand_tier_packages')
        .select('id, tier_name, price, is_active')
        .eq('brand_id', brandId)
        .order('price', { ascending: true })

      if (error) {
        showToast('등급 패키지를 불러오지 못했어요')
        return
      }

      const list = (data || []) as TierPackage[]
      setRows(list)
      const next: Record<string, Draft> = {}
      for (const r of list) {
        next[r.id] = {
          tier_name: String(r.tier_name || ''),
          price: String(Math.trunc(Number(r.price) || 0)),
        }
      }
      setDrafts(next)
    } finally {
      setLoading(false)
    }
  }, [brandId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const saveRow = async (pkg: TierPackage) => {
    if (!brandId) return
    const draft = drafts[pkg.id]
    if (!draft) return

    const tierName = draft.tier_name.trim()
    const price = Math.trunc(Number(draft.price.replace(/,/g, '')))
    if (!tierName) {
      showToast('등급명을 입력해 주세요')
      return
    }
    if (!Number.isFinite(price) || price < 1000) {
      showToast('가격은 1,000원 이상이어야 해요')
      return
    }

    setSavingId(pkg.id)
    try {
      const res = await fetch('/api/brand/tier-packages/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          brand_id: brandId,
          id: pkg.id,
          tier_name: tierName,
          price,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast(json?.error === 'invalid_price' ? '가격이 올바르지 않아요' : '저장에 실패했어요')
        return
      }
      showToast('저장했어요')
      await load()
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <TabBrandSelector myBrands={myBrands} storageKey="tier-packages-brand" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
      ) : (
      <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>등급 패키지 관리</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {brandName} · 등급명과 가격만 수정할 수 있어요
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>등록된 등급 패키지가 없어요</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((pkg) => {
            const draft = drafts[pkg.id] || { tier_name: '', price: '0' }
            const dirty =
              draft.tier_name.trim() !== String(pkg.tier_name || '') ||
              Math.trunc(Number(draft.price.replace(/,/g, ''))) !== Math.trunc(Number(pkg.price) || 0)

            return (
              <div
                key={pkg.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <label style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>등급명</div>
                    <input
                      type="text"
                      value={draft.tier_name}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, tier_name: e.target.value },
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(0,0,0,0.25)',
                        color: '#fff',
                        fontSize: 13,
                      }}
                    />
                  </label>
                  <label style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>가격 (원)</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.price}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [pkg.id]: { ...draft, price: e.target.value.replace(/[^\d]/g, '') },
                        }))
                      }
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(0,0,0,0.25)',
                        color: '#fff',
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!dirty || savingId === pkg.id}
                    onClick={() => void saveRow(pkg)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: dirty ? PURPLE : 'rgba(255,255,255,0.08)',
                      color: dirty ? '#fff' : 'rgba(255,255,255,0.3)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: !dirty || savingId === pkg.id ? 'not-allowed' : 'pointer',
                      opacity: savingId === pkg.id ? 0.7 : 1,
                    }}
                  >
                    {savingId === pkg.id ? '저장 중…' : '저장'}
                  </button>
                </div>
                {!pkg.is_active ? (
                  <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 8 }}>비활성 패키지</div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {toast ? (
        <div style={{ marginTop: 12, fontSize: 12, color: '#c4a8f0' }}>{toast}</div>
      ) : null}
      </>
      )}
    </div>
  )
}
