'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const CARD = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GRADE_COLORS: Record<string, string> = {
  '메디슈티컬': '#E53935',
  '프리미엄전문점': '#C9A96E',
  '전문점': '#9C7FD4',
  '취급점': '#64B5F6',
}
interface OwnerRow {
  id: string
  name: string
  salon_name: string
  region: string
  grade: string
  arete: boolean
  last_order: string | null
  monthly: number
}
interface Props {
  brandId: string | null
  brandName: string
  authId: string | null
}
export default function BrandTabOwners({ brandId, brandName, authId }: Props) {
  const supabase = createClient()
  const [owners, setOwners] = useState<OwnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', salon_name: '', phone: '', region: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  useEffect(() => {
    const fetchOwners = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, owner_store_name, region, trade_brands, preferred_brands, grade, arete_member, phone, last_order_at, monthly_order')
        .not('trade_brands', 'is', null)
      if (data) {
        const matched = data.filter((p: any) => {
          const brands = Array.isArray(p.trade_brands) && p.trade_brands.length > 0
            ? p.trade_brands
            : (Array.isArray(p.preferred_brands) ? p.preferred_brands : [])
          return brands.some((b: string) => b === brandName)
        })
        setOwners(matched.map((p: any) => ({
          id: p.id,
          name: p.full_name || p.name || '이름 없음',
          salon_name: p.owner_store_name || '-',
          region: p.region || '-',
          grade: p.grade || '취급점',
          arete: p.arete_member || false,
          last_order: p.last_order_at || null,
          monthly: p.monthly_order || 0,
        })))
      }
      setLoading(false)
    }
    void fetchOwners()
  }, [brandId, brandName])
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const grades = ['all', '메디슈티컬', '프리미엄전문점', '전문점', '취급점']
  const filtered = owners.filter(o => {
    const matchGrade = filter === 'all' || o.grade === filter
    const matchSearch = !search || o.name.includes(search) || o.salon_name.includes(search)
    return matchGrade && matchSearch
  })
  const updateGrade = async (ownerId: string, grade: string) => {
    setSaving(ownerId + '_grade')
    await supabase.from('profiles').update({ grade }).eq('id', ownerId)
    setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, grade } : o))
    setSaving(null)
  }
  const toggleArete = async (ownerId: string, current: boolean) => {
    setSaving(ownerId + '_arete')
    const next = !current
    await supabase.from('profiles').update({ arete_member: next }).eq('id', ownerId)
    if (next && brandId) {
      await supabase.from('brand_arete_members').upsert({
        brand_id: brandId,
        owner_id: ownerId,
        status: 'active',
        started_at: new Date().toISOString(),
      }, { onConflict: 'brand_id,owner_id' })
      await supabase.from('brand_points').upsert({
        brand_id: brandId,
        owner_id: ownerId,
        track: 'B',
        balance: 500000,
        total_earned: 500000,
      }, { onConflict: 'brand_id,owner_id,track' })
    } else if (!next && brandId) {
      await supabase.from('brand_arete_members').update({ status: 'cancelled' })
        .eq('brand_id', brandId).eq('owner_id', ownerId)
    }
    setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, arete: next } : o))
    setSaving(null)
  }
  const addOwner = async () => {
    if (!addForm.name || !addForm.salon_name) return
    setAddSaving(true)
    const { data } = await supabase.from('profiles').insert({
      full_name: addForm.name,
      owner_store_name: addForm.salon_name,
      phone: addForm.phone,
      region: addForm.region,
      role: 'owner',
      trade_brands: [brandName],
    }).select().single()
    if (data) setOwners(prev => [...prev, {
      id: data.id, name: addForm.name, salon_name: addForm.salon_name,
      region: addForm.region, grade: '', arete: false,
      last_order: null, monthly: 0,
    }])
    setAddForm({ name: '', salon_name: '', phone: '', region: '' })
    setShowAddForm(false)
    setAddSaving(false)
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ ...CARD, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {grades.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setFilter(g)}
              style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, border: `0.5px solid ${filter === g ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: filter === g ? 'rgba(123,94,167,0.2)' : 'transparent', color: filter === g ? '#c4a7e7' : SUB, cursor: 'pointer' }}
            >
              {g === 'all' ? `전체 (${owners.length})` : g}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="원장님 이름 또는 살롱명 검색"
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: TEXT, outline: 'none' }}
        />
      </div>
      <div style={CARD}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 13, lineHeight: 1.7 }}>
            아직 연결된 원장님이 없어요.<br />
            레퍼럴 링크를 공유해 원장님을 초대해보세요.
          </div>
        ) : (
          filtered.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < filtered.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(123,94,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                🌸
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{o.name}</span>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${GRADE_COLORS[o.grade] || PURPLE}22`, color: GRADE_COLORS[o.grade] || PURPLE, border: `0.5px solid ${GRADE_COLORS[o.grade] || PURPLE}55` }}>
                    {o.grade}
                  </span>
                  {o.arete && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(201,169,110,0.1)', color: GOLD, border: '0.5px solid rgba(201,169,110,0.3)' }}>
                      아레테
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>{o.salon_name} · {o.region}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, flexShrink: 0, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['메디슈티컬', '프리미엄전문점', '전문점', '취급점'].map(g => (
                    <button key={g} type="button" onClick={() => updateGrade(o.id, g)}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: `0.5px solid ${o.grade === g ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: o.grade === g ? 'rgba(123,94,167,0.25)' : 'transparent', color: o.grade === g ? '#c4a8f0' : SUB, cursor: 'pointer', opacity: saving === o.id + '_grade' ? 0.5 : 1 }}>
                      {g === '메디슈티컬' ? '메디' : g === '프리미엄전문점' ? '프리미엄' : g === '전문점' ? '전문점' : '취급점'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => toggleArete(o.id, o.arete)}
                    style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, border: `0.5px solid ${o.arete ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`, background: o.arete ? 'rgba(201,169,110,0.15)' : 'transparent', color: o.arete ? GOLD : SUB, cursor: 'pointer', opacity: saving === o.id + '_arete' ? 0.5 : 1 }}>
                    {o.arete ? '아레테 ON' : '아레테 OFF'}
                  </button>
                  <button type="button" onClick={() => showToast(`${o.name} 오렌톡 발송!`)}
                    style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', cursor: 'pointer' }}>
                    오렌톡
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => setShowAddForm(!showAddForm)}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a8f0', fontSize: 12, cursor: 'pointer' }}>
          + 수기 원장님 등록
        </button>
        <button type="button" onClick={() => showToast('레퍼럴 링크 복사!')}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
          + 초대 링크
        </button>
      </div>
      {showAddForm && (
        <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>수기 원장님 등록</div>
          {[
            { key: 'name', placeholder: '원장님 이름 *' },
            { key: 'salon_name', placeholder: '살롱명 *' },
            { key: 'phone', placeholder: '연락처' },
            { key: 'region', placeholder: '지역 (예: 서울 강남구)' },
          ].map(f => (
            <input key={f.key} value={addForm[f.key as keyof typeof addForm]} onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={{ width: '100%', marginBottom: 6, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12 }} />
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setShowAddForm(false)}
              style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
              취소
            </button>
            <button type="button" onClick={addOwner} disabled={addSaving}
              style={{ flex: 2, padding: '8px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
              {addSaving ? '등록 중...' : '등록 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
