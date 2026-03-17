'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CommissionRow = { role: string; track?: string | null; rate: number }
type ReferralRow = { level: number; rate: number }
type ProductCommissionRow = { product_id: string; base_rate: number; partner_rate: number; owner_rate: number; live_rate: number }
type ProductRow = { id: string; name: string; retail_price?: number | null; status?: string | null }

const DEFAULT_COMMISSION: CommissionRow[] = [
  { role: 'owner', rate: 8 },
  { role: 'partner', track: 'A', rate: 5 },
  { role: 'partner', track: 'B', rate: 3 },
  { role: 'live', rate: 10 },
]

const DEFAULT_REFERRAL: ReferralRow[] = [
  { level: 1, rate: 3 },
  { level: 2, rate: 1 },
]

export default function CommissionSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [commission, setCommission] = useState<CommissionRow[]>(DEFAULT_COMMISSION)
  const [referral, setReferral] = useState<ReferralRow[]>(DEFAULT_REFERRAL)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [pLoading, setPLoading] = useState(true)
  const [pSaving, setPSaving] = useState(false)
  const [pRows, setPRows] = useState<ProductCommissionRow[]>([])
  const [pEditing, setPEditing] = useState<Record<string, boolean>>({})
  const [pDraft, setPDraft] = useState<Record<string, ProductCommissionRow>>({})
  const [pQ, setPQ] = useState('')
  const [toast, setToast] = useState('')

  const cKey = (r: CommissionRow) => `${r.role}:${r.track || '-'}`

  const cMap = useMemo(() => new Map(commission.map(r => [cKey(r), r])), [commission])
  const rMap = useMemo(() => new Map(referral.map(r => [r.level, r])), [referral])
  const pcMap = useMemo(() => new Map(pRows.map(r => [r.product_id, r])), [pRows])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [c, r] = await Promise.all([
          supabase.from('commission_settings').select('role,track,rate').order('role'),
          supabase.from('referral_settings').select('level,rate').order('level'),
        ])
        if (c.data?.length) setCommission(c.data as any)
        if (r.data?.length) setReferral(r.data as any)
      } catch {
        // keep defaults
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [supabase])

  useEffect(() => {
    const run = async () => {
      setPLoading(true)
      try {
        const [prod, pc] = await Promise.all([
          supabase.from('products').select('id,name,retail_price,status').order('created_at', { ascending: false }).limit(300),
          supabase.from('product_commissions').select('product_id,base_rate,partner_rate,owner_rate,live_rate').limit(500),
        ])
        setProducts((prod.data || []) as any)
        setPRows(((pc.data || []) as any[]).map(r => ({
          product_id: r.product_id,
          base_rate: Number(r.base_rate || 0),
          partner_rate: Number(r.partner_rate || 0),
          owner_rate: Number(r.owner_rate || 0),
          live_rate: Number(r.live_rate || 0),
        })))
      } catch {
        setProducts([])
        setPRows([])
      } finally {
        setPLoading(false)
      }
    }
    run()
  }, [supabase])

  const setCommissionRate = (row: CommissionRow, rate: number) => {
    const key = cKey(row)
    setCommission(prev => {
      const next = [...prev]
      const idx = next.findIndex(x => cKey(x) === key)
      if (idx >= 0) next[idx] = { ...next[idx], rate }
      else next.push({ ...row, rate })
      return next
    })
  }

  const setReferralRate = (level: number, rate: number) => {
    setReferral(prev => {
      const next = [...prev]
      const idx = next.findIndex(x => x.level === level)
      if (idx >= 0) next[idx] = { ...next[idx], rate }
      else next.push({ level, rate })
      return next.sort((a, b) => a.level - b.level)
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const cPayload = DEFAULT_COMMISSION.map(r => ({
        role: r.role,
        track: r.track || null,
        rate: Number(cMap.get(cKey(r))?.rate ?? r.rate),
        updated_at: new Date().toISOString(),
      }))
      const rPayload = DEFAULT_REFERRAL.map(r => ({
        level: r.level,
        rate: Number(rMap.get(r.level)?.rate ?? r.rate),
        updated_at: new Date().toISOString(),
      }))

      const [cRes, rRes] = await Promise.all([
        supabase.from('commission_settings').upsert(cPayload, { onConflict: 'role,track' }),
        supabase.from('referral_settings').upsert(rPayload, { onConflict: 'level' }),
      ])
      if (cRes.error) throw cRes.error
      if (rRes.error) throw rRes.error
      setToast('✅ 저장 즉시 반영됨')
      setTimeout(() => setToast(''), 2500)
    } catch (e: any) {
      alert(e?.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = useMemo(() => {
    const s = pQ.trim().toLowerCase()
    if (!s) return products
    return products.filter(p => (p.name || '').toLowerCase().includes(s))
  }, [pQ, products])

  const startEdit = (productId: string) => {
    const existing = pcMap.get(productId)
    setPEditing(prev => ({ ...prev, [productId]: true }))
    setPDraft(prev => ({
      ...prev,
      [productId]: existing || { product_id: productId, base_rate: 0, partner_rate: 0, owner_rate: 0, live_rate: 0 },
    }))
  }

  const cancelEdit = (productId: string) => {
    setPEditing(prev => ({ ...prev, [productId]: false }))
    setPDraft(prev => {
      const n = { ...prev }
      delete n[productId]
      return n
    })
  }

  const setDraft = (productId: string, patch: Partial<ProductCommissionRow>) => {
    setPDraft(prev => ({ ...prev, [productId]: { ...(prev[productId] as ProductCommissionRow), ...patch } }))
  }

  const saveProductCommission = async (productId: string) => {
    const row = pDraft[productId]
    if (!row) return
    setPSaving(true)
    try {
      const payload = {
        product_id: productId,
        base_rate: Number(row.base_rate || 0),
        partner_rate: Number(row.partner_rate || 0),
        owner_rate: Number(row.owner_rate || 0),
        live_rate: Number(row.live_rate || 0),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('product_commissions').upsert(payload, { onConflict: 'product_id' })
      if (error) throw error
      setPRows(prev => {
        const idx = prev.findIndex(x => x.product_id === productId)
        if (idx >= 0) {
          const n = [...prev]
          n[idx] = payload as any
          return n
        }
        return [payload as any, ...prev]
      })
      cancelEdit(productId)
      setToast('✅ 제품별 수수료 저장됨')
      setTimeout(() => setToast(''), 2500)
    } catch (e: any) {
      alert(e?.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setPSaving(false)
    }
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>수수료·추천 설정</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            저장 즉시 반영됩니다. (테이블: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>commission_settings</span>, <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>referral_settings</span>)
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: '#c9a84c',
            border: 'none',
            color: '#111',
            fontWeight: 900,
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 제품별 수수료 */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>제품별 수수료 매핑 (%)</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>table: product_commissions</div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{products.length}개</div>
        </div>

        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            value={pQ}
            onChange={e => setPQ(e.target.value)}
            placeholder="제품 검색"
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: '10px 10px',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.9fr 0.9fr 0.9fr 1.1fr', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
          <div>제품</div>
          <div>기본</div>
          <div>파트너스</div>
          <div>원장님</div>
          <div>라이브</div>
          <div style={{ textAlign: 'right' }}>관리</div>
        </div>

        {pLoading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>검색 결과가 없습니다.</div>
        ) : (
          filteredProducts.slice(0, 80).map(p => {
            const existing = pcMap.get(p.id)
            const editing = !!pEditing[p.id]
            const d = pDraft[p.id] || existing || { product_id: p.id, base_rate: 0, partner_rate: 0, owner_rate: 0, live_rate: 0 }
            const cellInput = (value: number, onChange: (v: number) => void) => (
              <input
                type="number"
                value={value}
                disabled={!editing}
                onChange={e => onChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '8px 8px',
                  color: '#fff',
                  fontSize: 11,
                  outline: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                  opacity: editing ? 1 : 0.7,
                }}
              />
            )

            return (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.9fr 0.9fr 0.9fr 0.9fr 1.1fr', gap: 8, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ marginTop: 3, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {p.retail_price ? `₩${Number(p.retail_price).toLocaleString()}` : ''} {p.status ? `· ${p.status}` : ''}
                  </div>
                </div>
                {cellInput(d.base_rate, v => setDraft(p.id, { base_rate: v }))}
                {cellInput(d.partner_rate, v => setDraft(p.id, { partner_rate: v }))}
                {cellInput(d.owner_rate, v => setDraft(p.id, { owner_rate: v }))}
                {cellInput(d.live_rate, v => setDraft(p.id, { live_rate: v }))}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {!editing ? (
                    <button
                      onClick={() => startEdit(p.id)}
                      disabled={pSaving}
                      style={{ fontSize: 11, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)', cursor: 'pointer' }}
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => saveProductCommission(p.id)}
                        disabled={pSaving}
                        style={{ fontSize: 11, padding: '8px 10px', borderRadius: 10, background: '#c9a84c', border: 'none', color: '#111', fontWeight: 900, cursor: 'pointer', opacity: pSaving ? 0.7 : 1 }}
                      >
                        저장
                      </button>
                      <button
                        onClick={() => cancelEdit(p.id)}
                        disabled={pSaving}
                        style={{ fontSize: 11, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}

        <div style={{ padding: '10px 14px', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
          ※ 목록은 성능을 위해 최대 80개까지만 표시합니다.
        </div>
      </div>

      {/* 수수료 */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 900, color: '#fff' }}>
          포지션별 수수료율 (%)
        </div>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : (
          DEFAULT_COMMISSION.map(r => (
            <div key={cKey(r)} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 10, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                  {r.role === 'owner' ? '원장님' : r.role === 'live' ? '라이브커머스' : '파트너스'} {r.track ? `트랙 ${r.track}` : ''}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  {r.role}{r.track ? `:${r.track}` : ''}
                </div>
              </div>
              <input
                type="number"
                value={cMap.get(cKey(r))?.rate ?? r.rate}
                onChange={e => setCommissionRate(r, Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: '10px 10px',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* 추천 */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 900, color: '#fff' }}>
          추천 단계별 설정 (%)
        </div>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : (
          DEFAULT_REFERRAL.map(r => (
            <div key={r.level} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 10, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{r.level}단계</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>level={r.level}</div>
              </div>
              <input
                type="number"
                value={rMap.get(r.level)?.rate ?? r.rate}
                onChange={e => setReferralRate(r.level, Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: '10px 10px',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          ))
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 18, right: 18, background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 12 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

