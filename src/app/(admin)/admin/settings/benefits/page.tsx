'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

type BenefitSetting = { setting_key: string; setting_value: number | string | null }
type GradeRow = {
  id: string
  grade_order: number
  min_amount: number
  discount_rate: number | null
  invite_only?: boolean | null
  grade_name?: string | null
  name?: string | null
  charge_bonus_rate?: number | null
  purchase_bonus_rate?: number | null
  [key: string]: unknown
}
type BrandRow = { id: string; name: string }
type ProductRow = { id: string; name: string }
type OverrideBatch = {
  purchase_point_rate: number
  review_photo_rate: number
  review_video_rate: number
  share_point_rate: number
  discount_rate: number
  exclude_purchase_point: boolean
  exclude_share_point: boolean
  is_sale_item: boolean
}
type CommissionRow = {
  id: string
  profile_id?: string | null
  owner_id?: string | null
  commission_rate: number
  [key: string]: unknown
}

const TAB_LABELS = ['기본 혜택', '등급별 혜택', '제품/브랜드 개별', '원장님 수수료'] as const

const BENEFIT_KEY_LABEL: Record<string, string> = {
  charge_point_rate: '충전 적립률 (%)',
  purchase_point_rate: '구매 적립률 (%)',
  review_photo_rate: '포토 리뷰 (%)',
  review_video_rate: '영상 리뷰 (%)',
  share_point_rate: '공유 적립률 (%)',
}

const DEFAULT_SALON_COMMISSION_KEY = 'default_salon_commission_rate'

export default function AdminBenefitsSettingsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [benefitRows, setBenefitRows] = useState<BenefitSetting[]>([])
  const [savingBenefits, setSavingBenefits] = useState(false)

  const [grades, setGrades] = useState<GradeRow[]>([])
  const [savingGrades, setSavingGrades] = useState(false)

  const [scope, setScope] = useState<'all' | 'brand' | 'product'>('product')
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [allProductIds, setAllProductIds] = useState<string[]>([])
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<string>>(new Set())
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [batch, setBatch] = useState<OverrideBatch>({
    purchase_point_rate: 0,
    review_photo_rate: 0,
    review_video_rate: 0,
    share_point_rate: 0,
    discount_rate: 0,
    exclude_purchase_point: false,
    exclude_share_point: false,
    is_sale_item: false,
  })
  const [overrideBusy, setOverrideBusy] = useState(false)

  const [defaultSalonCommission, setDefaultSalonCommission] = useState<number>(8)
  const [commissionRows, setCommissionRows] = useState<CommissionRow[]>([])
  const [ownerLabel, setOwnerLabel] = useState<Record<string, string>>({})
  const [salonLabel, setSalonLabel] = useState<Record<string, string>>({})
  const [savingCommission, setSavingCommission] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  const loadBenefitSettings = useCallback(async () => {
    const { data } = await supabase
      .from('benefit_settings')
      .select('setting_key, setting_value')
      .order('setting_key')
    setBenefitRows((data as BenefitSetting[]) || [])
  }, [supabase])

  const loadGrades = useCallback(async () => {
    const { data } = await supabase
      .from('grade_settings')
      .select('*')
      .order('grade_order', { ascending: true })
    setGrades((data as GradeRow[]) || [])
  }, [supabase])

  const loadBrandsProducts = useCallback(async () => {
    const [b, p] = await Promise.all([
      supabase.from('brands').select('id, name').order('name'),
      supabase.from('products').select('id, name').order('name').limit(3000),
    ])
    setBrands((b.data as BrandRow[]) || [])
    const plist = (p.data as ProductRow[]) || []
    setProducts(plist)
    setAllProductIds(plist.map(x => x.id))
  }, [supabase])

  const loadSalonCommission = useCallback(async () => {
    const { data: rows } = await supabase.from('salon_commission_settings').select('*')
    const list = (rows as CommissionRow[]) || []
    setCommissionRows(list)

    const oLabel: Record<string, string> = {}
    const sLabel: Record<string, string> = {}

    const profileIds = list.map(r => r.profile_id).filter(Boolean) as string[]
    const ownerIds = list.map(r => r.owner_id).filter(Boolean) as string[]

    if (profileIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email, auth_id')
        .in('id', profileIds)
      const authIds = (profs || []).map((p: any) => p.auth_id).filter(Boolean)
      const { data: us } =
        authIds.length > 0
          ? await supabase.from('users').select('id, auth_id, name').in('auth_id', authIds)
          : { data: [] as any[] }
      const uids = (us || []).map((u: any) => u.id)
      const { data: salons } =
        uids.length > 0
          ? await supabase.from('salons').select('owner_id, name').in('owner_id', uids)
          : { data: [] as any[] }
      const salonByUserId = new Map<string, string>()
      ;(salons || []).forEach((s: any) => salonByUserId.set(s.owner_id, s.name || '—'))
      for (const row of list) {
        if (!row.profile_id) continue
        const p = (profs || []).find((x: any) => x.id === row.profile_id)
        if (!p) {
          oLabel[row.id] = '—'
          sLabel[row.id] = '—'
          continue
        }
        const u = (us || []).find((x: any) => x.auth_id === p.auth_id)
        oLabel[row.id] = p.full_name || p.email || u?.name || '—'
        sLabel[row.id] = u ? salonByUserId.get(u.id) || '—' : '—'
      }
    }

    if (ownerIds.length) {
      const { data: us } = await supabase.from('users').select('id, name').in('id', ownerIds)
      const { data: salons } = await supabase.from('salons').select('owner_id, name').in('owner_id', ownerIds)
      const salonByOwner = new Map<string, string>()
      ;(salons || []).forEach((s: any) => salonByOwner.set(s.owner_id, s.name || '—'))
      for (const row of list) {
        if (!row.owner_id) continue
        const u = (us || []).find((x: any) => x.id === row.owner_id)
        oLabel[row.id] = u?.name || row.owner_id
        sLabel[row.id] = salonByOwner.get(row.owner_id) || '—'
      }
    }

    setOwnerLabel(oLabel)
    setSalonLabel(sLabel)

    const { data: defRow } = await supabase
      .from('benefit_settings')
      .select('setting_value')
      .eq('setting_key', DEFAULT_SALON_COMMISSION_KEY)
      .maybeSingle()
    if (defRow && (defRow as { setting_value?: unknown }).setting_value != null) {
      const n = Number((defRow as { setting_value?: unknown }).setting_value)
      if (!Number.isNaN(n)) setDefaultSalonCommission(n)
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        await Promise.all([loadBenefitSettings(), loadGrades(), loadBrandsProducts(), loadSalonCommission()])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [loadBenefitSettings, loadGrades, loadBrandsProducts, loadSalonCommission])

  const benefitDisplayRows = useMemo(() => {
    const keys = Object.keys(BENEFIT_KEY_LABEL)
    const map = new Map(benefitRows.map(r => [r.setting_key, r]))
    return keys.map(k => map.get(k) || { setting_key: k, setting_value: null })
  }, [benefitRows])

  const setBenefitValue = (key: string, value: string) => {
    const num = value === '' ? null : Number(value)
    setBenefitRows(prev => {
      const map = new Map(prev.map(r => [r.setting_key, r]))
      map.set(key, {
        setting_key: key,
        setting_value: num === null || Number.isNaN(Number(num)) ? null : Number(num),
      })
      return Array.from(map.values())
    })
  }

  const saveBenefits = async () => {
    setSavingBenefits(true)
    try {
      const payload = benefitDisplayRows.map(r => ({
        setting_key: r.setting_key,
        setting_value: r.setting_value === null || r.setting_value === '' ? 0 : Number(r.setting_value),
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('benefit_settings').upsert(payload, { onConflict: 'setting_key' })
      if (error) throw error
      await loadBenefitSettings()
      showToast('✅ 기본 혜택이 저장됐어요')
    } catch (e: any) {
      alert(e?.message || '저장 실패')
    } finally {
      setSavingBenefits(false)
    }
  }

  const updateGrade = (id: string, patch: Partial<GradeRow>) => {
    setGrades(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)))
  }

  const saveGrades = async () => {
    setSavingGrades(true)
    try {
      for (const g of grades) {
        const payload: Record<string, unknown> = {
          grade_order: Number(g.grade_order),
          min_amount: Number(g.min_amount),
          discount_rate: g.discount_rate === null ? null : Number(g.discount_rate),
          charge_bonus_rate:
            g.charge_bonus_rate === null || g.charge_bonus_rate === undefined
              ? null
              : Number(g.charge_bonus_rate),
          purchase_bonus_rate:
            g.purchase_bonus_rate === null || g.purchase_bonus_rate === undefined
              ? null
              : Number(g.purchase_bonus_rate),
          invite_only: !!g.invite_only,
          updated_at: new Date().toISOString(),
        }
        const gn = g.grade_name ?? g.name
        if (gn !== undefined && gn !== null) payload.grade_name = gn
        const { error } = await supabase.from('grade_settings').update(payload).eq('id', g.id)
        if (error) throw error
      }
      await loadGrades()
      showToast('✅ 등급 혜택이 저장됐어요')
    } catch (e: any) {
      alert(e?.message || '저장 실패')
    } finally {
      setSavingGrades(false)
    }
  }

  const toggleBrand = (id: string, on: boolean) => {
    setSelectedBrandIds(prev => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }
  const toggleProduct = (id: string, on: boolean) => {
    setSelectedProductIds(prev => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }

  const selectAllBrands = (on: boolean) => {
    setSelectedBrandIds(on ? new Set(brands.map(b => b.id)) : new Set())
  }
  const selectAllProducts = (on: boolean) => {
    setSelectedProductIds(on ? new Set(products.map(p => p.id)) : new Set())
  }

  const buildOverridePayload = (targetType: 'product' | 'brand', targetId: string) => {
    const p = batch.exclude_purchase_point ? 0 : Number(batch.purchase_point_rate)
    return {
      target_type: targetType,
      target_id: targetId,
      purchase_point_rate: p,
      review_photo_rate: Number(batch.review_photo_rate),
      review_video_rate: Number(batch.review_video_rate),
      share_point_rate: batch.exclude_share_point ? 0 : Number(batch.share_point_rate),
      discount_rate: Number(batch.discount_rate),
      exclude_share_point: batch.exclude_share_point,
      is_sale_item: batch.is_sale_item,
      exclude_purchase_point: batch.exclude_purchase_point,
      updated_at: new Date().toISOString(),
    }
  }

  const applyOverrides = async () => {
    setOverrideBusy(true)
    try {
      const chunks: { target_type: 'product' | 'brand'; target_id: string }[] = []
      if (scope === 'all') {
        allProductIds.forEach(id => chunks.push({ target_type: 'product', target_id: id }))
      } else if (scope === 'brand') {
        selectedBrandIds.forEach(id => chunks.push({ target_type: 'brand', target_id: id }))
      } else {
        selectedProductIds.forEach(id => chunks.push({ target_type: 'product', target_id: id }))
      }
      if (chunks.length === 0) {
        alert('적용할 대상을 선택해 주세요.')
        return
      }
      const batchSize = 40
      for (let i = 0; i < chunks.length; i += batchSize) {
        const slice = chunks.slice(i, i + batchSize)
        const payload = slice.map(c => buildOverridePayload(c.target_type, c.target_id))
        const { error } = await supabase
          .from('product_benefit_overrides')
          .upsert(payload, { onConflict: 'target_type,target_id' })
        if (error) throw error
      }
      showToast('✅ 선택 항목에 적용됐어요')
    } catch (e: any) {
      alert(e?.message || '적용 실패')
    } finally {
      setOverrideBusy(false)
    }
  }

  const resetOverrides = async () => {
    if (!confirm('선택한 범위의 개별 설정을 삭제할까요?')) return
    setOverrideBusy(true)
    try {
      if (scope === 'all') {
        const { error } = await supabase.from('product_benefit_overrides').delete().eq('target_type', 'product')
        if (error) throw error
      } else if (scope === 'brand') {
        const ids = Array.from(selectedBrandIds)
        if (!ids.length) {
          alert('브랜드를 선택해 주세요.')
          return
        }
        for (const id of ids) {
          const { error } = await supabase
            .from('product_benefit_overrides')
            .delete()
            .eq('target_type', 'brand')
            .eq('target_id', id)
          if (error) throw error
        }
      } else {
        const ids = Array.from(selectedProductIds)
        if (!ids.length) {
          alert('제품을 선택해 주세요.')
          return
        }
        for (const id of ids) {
          const { error } = await supabase
            .from('product_benefit_overrides')
            .delete()
            .eq('target_type', 'product')
            .eq('target_id', id)
          if (error) throw error
        }
      }
      showToast('✅ 초기화됐어요')
    } catch (e: any) {
      alert(e?.message || '삭제 실패')
    } finally {
      setOverrideBusy(false)
    }
  }

  const saveDefaultCommission = async () => {
    setSavingCommission(true)
    try {
      const { error } = await supabase.from('benefit_settings').upsert(
        {
          setting_key: DEFAULT_SALON_COMMISSION_KEY,
          setting_value: Number(defaultSalonCommission),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'setting_key' }
      )
      if (error) throw error
      showToast('✅ 기본 수수료율이 저장됐어요')
    } catch (e: any) {
      alert(e?.message || '저장 실패')
    } finally {
      setSavingCommission(false)
    }
  }

  const applyCommissionBulk = async () => {
    setSavingCommission(true)
    try {
      const rate = Number(defaultSalonCommission)
      for (const row of commissionRows) {
        const { error } = await supabase
          .from('salon_commission_settings')
          .update({ commission_rate: rate, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        if (error) throw error
      }
      await loadSalonCommission()
      showToast('✅ 일괄 적용 완료')
    } catch (e: any) {
      alert(e?.message || '일괄 적용 실패')
    } finally {
      setSavingCommission(false)
    }
  }

  const saveCommissionRow = async (row: CommissionRow) => {
    setSavingCommission(true)
    try {
      const { error } = await supabase
        .from('salon_commission_settings')
        .update({
          commission_rate: Number(row.commission_rate),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (error) throw error
      await loadSalonCommission()
      showToast('✅ 저장됐어요')
    } catch (e: any) {
      alert(e?.message || '저장 실패')
    } finally {
      setSavingCommission(false)
    }
  }

  const updateCommissionLocal = (id: string, rate: number) => {
    setCommissionRows(prev => prev.map(r => (r.id === id ? { ...r, commission_rate: rate } : r)))
  }

  const displayOwnerName = (row: CommissionRow) => ownerLabel[row.id] ?? '—'
  const displaySalonName = (row: CommissionRow) => salonLabel[row.id] ?? '—'

  const card: CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 20,
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 13,
  }

  return (
    <div style={{ padding: 24, background: '#0D0B09', minHeight: '100vh', color: '#fff' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#C9A96E', fontSize: 20, marginBottom: 8 }}>혜택 · 수수료 설정</h1>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          benefit_settings · grade_settings · product_benefit_overrides · salon_commission_settings
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i)}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: tab === i ? 'none' : '1px solid rgba(255,255,255,0.12)',
              background: tab === i ? '#C9A96E' : 'rgba(255,255,255,0.05)',
              color: tab === i ? '#0D0B09' : 'rgba(255,255,255,0.75)',
              fontWeight: tab === i ? 800 : 500,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {toast ? (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(201,169,110,0.15)',
            border: '1px solid rgba(201,169,110,0.35)',
            color: '#C9A96E',
            fontSize: 13,
          }}
        >
          {toast}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>불러오는 중…</div>
      ) : (
        <>
          {tab === 0 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A96E' }}>기본 혜택 설정</div>
                <button
                  type="button"
                  disabled={savingBenefits}
                  onClick={saveBenefits}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    background: '#C9A96E',
                    border: 'none',
                    color: '#0D0B09',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {savingBenefits ? '저장 중…' : '저장'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {benefitDisplayRows.map(row => (
                  <div key={row.setting_key}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
                      {BENEFIT_KEY_LABEL[row.setting_key] || row.setting_key}
                    </div>
                    <input
                      type="number"
                      value={row.setting_value === null || row.setting_value === undefined ? '' : String(row.setting_value)}
                      onChange={e => setBenefitValue(row.setting_key, e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 1 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A96E' }}>등급별 혜택</div>
                <button
                  type="button"
                  disabled={savingGrades}
                  onClick={saveGrades}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 10,
                    background: '#C9A96E',
                    border: 'none',
                    color: '#0D0B09',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {savingGrades ? '저장 중…' : '전체 저장'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>등급명</th>
                      <th style={{ padding: 8 }}>기준금액</th>
                      <th style={{ padding: 8 }}>할인율(%)</th>
                      <th style={{ padding: 8 }}>충전보너스(%)</th>
                      <th style={{ padding: 8 }}>구매보너스(%)</th>
                      <th style={{ padding: 8 }}>초대전용</th>
                      <th style={{ padding: 8 }}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map(g => {
                      const invite = !!g.invite_only
                      const name = String(g.grade_name ?? g.name ?? '')
                      const showInvite = invite || /NOIR|CÉLESTE|CELESTE/i.test(name)
                      return (
                        <tr key={g.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: 8, verticalAlign: 'middle' }}>
                            <input
                              value={name}
                              onChange={e => updateGrade(g.id, { grade_name: e.target.value, name: e.target.value })}
                              style={{ ...inputStyle, width: 120 }}
                            />
                            {showInvite ? (
                              <div style={{ marginTop: 4, fontSize: 10, color: '#C9A96E' }}>NOIR / CÉLESTE</div>
                            ) : null}
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              value={g.min_amount}
                              onChange={e => updateGrade(g.id, { min_amount: Number(e.target.value) })}
                              style={{ ...inputStyle, width: 100 }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              value={g.discount_rate === null ? '' : g.discount_rate}
                              onChange={e =>
                                updateGrade(g.id, { discount_rate: e.target.value === '' ? null : Number(e.target.value) })
                              }
                              style={{ ...inputStyle, width: 72 }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              value={g.charge_bonus_rate === null || g.charge_bonus_rate === undefined ? '' : g.charge_bonus_rate}
                              onChange={e =>
                                updateGrade(g.id, {
                                  charge_bonus_rate: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              style={{ ...inputStyle, width: 72 }}
                            />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input
                              type="number"
                              value={
                                g.purchase_bonus_rate === null || g.purchase_bonus_rate === undefined
                                  ? ''
                                  : g.purchase_bonus_rate
                              }
                              onChange={e =>
                                updateGrade(g.id, {
                                  purchase_bonus_rate: e.target.value === '' ? null : Number(e.target.value),
                                })
                              }
                              style={{ ...inputStyle, width: 72 }}
                            />
                          </td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={invite}
                              title="invite_only"
                              onChange={e => updateGrade(g.id, { invite_only: e.target.checked })}
                            />
                          </td>
                          <td style={{ padding: 8, color: 'rgba(255,255,255,0.45)' }}>
                            order {g.grade_order}
                            {invite ? ' · 초대 전용' : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 2 && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A96E' }}>제품 / 브랜드 개별 설정</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {(
                  [
                    ['all', '전체 (모든 제품)'],
                    ['brand', '브랜드별'],
                    ['product', '제품별'],
                  ] as const
                ).map(([k, lab]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" name="scope" checked={scope === k} onChange={() => setScope(k)} />
                    {lab}
                  </label>
                ))}
              </div>

              {scope === 'brand' && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={selectedBrandIds.size > 0 && selectedBrandIds.size === brands.length}
                      onChange={e => selectAllBrands(e.target.checked)}
                    />
                    전체 선택
                  </label>
                  <div
                    style={{
                      maxHeight: 220,
                      overflow: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {brands.map(b => (
                      <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={selectedBrandIds.has(b.id)}
                          onChange={e => toggleBrand(b.id, e.target.checked)}
                        />
                        {b.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {(scope === 'product' || scope === 'all') && (
                <div>
                  {scope === 'product' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedProductIds.size === products.length}
                        onChange={e => selectAllProducts(e.target.checked)}
                      />
                      전체 선택
                    </label>
                  ) : (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                      등록된 모든 제품({allProductIds.length}개)에 일괄 적용됩니다.
                    </div>
                  )}
                  {scope === 'product' && (
                    <div
                      style={{
                        maxHeight: 220,
                        overflow: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {products.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(p.id)}
                            onChange={e => toggleProduct(p.id, e.target.checked)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#C9A96E' }}>일괄 설정</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {[
                    ['purchase_point_rate', '구매 적립률(%)', batch.purchase_point_rate],
                    ['review_photo_rate', '포토 리뷰(%)', batch.review_photo_rate],
                    ['review_video_rate', '영상 리뷰(%)', batch.review_video_rate],
                    ['share_point_rate', '공유 적립률(%)', batch.share_point_rate],
                    ['discount_rate', '할인율(%)', batch.discount_rate],
                  ].map(([key, lab, val]) => (
                    <div key={key as string}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{lab}</div>
                      <input
                        type="number"
                        value={val as number}
                        onChange={e => setBatch(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={batch.exclude_purchase_point}
                      onChange={e => setBatch(prev => ({ ...prev, exclude_purchase_point: e.target.checked }))}
                    />
                    구매적립 제외 (세일상품)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={batch.exclude_share_point}
                      onChange={e => setBatch(prev => ({ ...prev, exclude_share_point: e.target.checked }))}
                    />
                    공유포인트 제외
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={batch.is_sale_item}
                      onChange={e => setBatch(prev => ({ ...prev, is_sale_item: e.target.checked }))}
                    />
                    세일상품 지정
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    disabled={overrideBusy}
                    onClick={applyOverrides}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 10,
                      background: '#C9A96E',
                      border: 'none',
                      color: '#0D0B09',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    선택항목에 적용
                  </button>
                  <button
                    type="button"
                    disabled={overrideBusy}
                    onClick={resetOverrides}
                    style={{
                      padding: '12px 18px',
                      borderRadius: 10,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'rgba(255,255,255,0.85)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    전체초기화
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 3 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A96E', marginBottom: 8 }}>원장님 수수료</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    기본 수수료율은 benefit_settings · {DEFAULT_SALON_COMMISSION_KEY} 에 저장됩니다.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>기본 수수료율 (%)</div>
                    <input
                      type="number"
                      value={defaultSalonCommission}
                      onChange={e => setDefaultSalonCommission(Number(e.target.value))}
                      style={{ ...inputStyle, width: 100 }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingCommission}
                    onClick={saveDefaultCommission}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    기본값 저장
                  </button>
                  <button
                    type="button"
                    disabled={savingCommission}
                    onClick={applyCommissionBulk}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: '#C9A96E',
                      border: 'none',
                      color: '#0D0B09',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    일괄적용
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginTop: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>원장님</th>
                      <th style={{ padding: 8 }}>살롱명</th>
                      <th style={{ padding: 8 }}>수수료율(%)</th>
                      <th style={{ padding: 8 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {commissionRows.map(row => (
                      <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: 8 }}>{displayOwnerName(row)}</td>
                        <td style={{ padding: 8 }}>{displaySalonName(row)}</td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            value={row.commission_rate}
                            onChange={e => updateCommissionLocal(row.id, Number(e.target.value))}
                            style={{ ...inputStyle, width: 88 }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <button
                            type="button"
                            disabled={savingCommission}
                            onClick={() => saveCommissionRow(row)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(201,169,110,0.2)',
                              border: '1px solid rgba(201,169,110,0.35)',
                              color: '#C9A96E',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                          >
                            저장
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {commissionRows.length === 0 ? (
                  <div style={{ padding: 16, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                    salon_commission_settings 에 데이터가 없습니다. DB에 행을 추가하면 여기에 표시됩니다.
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
