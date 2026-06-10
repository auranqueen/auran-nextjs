'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GiftTypeOpt = { id: string; name: string; emoji: string }
type GiftTypeRow = GiftTypeOpt & { is_active: boolean; order: number; created_at?: string }
const EMOJI_PRESETS = ['🎂', '🎉', '💝', '🌟', '🎁', '💐', '🎊', '💜', '🌸', '✨', '🎀', '💌']
type GiftRow = {
  id: string; sender_name: string | null; message: string | null; amount: number
  status: string; shipping_status: string | null; shipping_name: string | null
  shipping_phone: string | null; shipping_address: string | null; shipping_detail: string | null
  tracking_no: string | null; courier: string | null; claim_token: string | null
  gift_copy: string | null; created_at: string; shipped_at: string | null
  delivery_type: string | null; gift_type_id: string | null
  gift_types?: { name: string; emoji: string } | null
}
const STATUS_LABEL: Record<string, string> = { pending: '결제대기', paid: '결제완료', claimed: '수령완료' }
const SHIP_LABEL: Record<string, string> = { pending: '배송지 미입력', address_received: '배송지 입력완료', shipped: '발송완료', delivered: '배송완료' }
const SHIP_COLOR: Record<string, string> = { pending: '#888', address_received: '#7B5EA7', shipped: '#1D9E75', delivered: '#C9A96E' }
type DeliveryType = 'courier' | 'quick' | 'direct'

export default function GiftsClient({ initialGifts }: { initialGifts: GiftRow[] }) {
  const supabase = createClient()
  const [rows, setRows] = useState<GiftRow[]>(initialGifts)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'address_received' | 'shipped' | 'all'>('all')
  const [selected, setSelected] = useState<GiftRow | null>(null)
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('courier')
  const [courier, setCourier] = useState('CJ대한통운')
  const [trackingNo, setTrackingNo] = useState('')
  const [quickCompany, setQuickCompany] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [giftTypes, setGiftTypes] = useState<GiftTypeOpt[]>([])
  const [giftTypeId, setGiftTypeId] = useState('')
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [typeItems, setTypeItems] = useState<GiftTypeRow[]>([])
  const [typeLoading, setTypeLoading] = useState(false)
  const [typeMsg, setTypeMsg] = useState('')
  const [typeFormOpen, setTypeFormOpen] = useState(false)
  const [typeEditing, setTypeEditing] = useState<GiftTypeRow | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmoji, setFormEmoji] = useState('🎁')
  const [formActive, setFormActive] = useState(true)
  const [typeSaving, setTypeSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSearch, setCreateSearch] = useState('')
  const [createUsers, setCreateUsers] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [createUserId, setCreateUserId] = useState('')
  const [createGiftTypeId, setCreateGiftTypeId] = useState('')
  const [createMessage, setCreateMessage] = useState('')
  const [createSaving, setCreateSaving] = useState(false)

  const searchCreateUsers = async (q: string) => {
    if (q.length < 2) { setCreateUsers([]); return }
    const res = await fetch('/api/admin/membership/manual?q=' + encodeURIComponent(q))
    const json = await res.json().catch(() => ({}))
    setCreateUsers(json.users || [])
  }

  const openCreateModal = () => {
    setShowCreateModal(true)
    setCreateSearch('')
    setCreateUsers([])
    setCreateUserId('')
    setCreateMessage('')
    void loadGiftTypes().then((active) => {
      if (active?.length) setCreateGiftTypeId(active[0].id)
    })
  }

  const handleCreateGift = async () => {
    if (!createUserId) { setToast('고객을 선택해주세요'); setTimeout(() => setToast(''), 2500); return }
    if (!createGiftTypeId) { setToast('선물 타입을 선택해주세요'); setTimeout(() => setToast(''), 2500); return }
    setCreateSaving(true)
    const res = await fetch('/api/admin/membership/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimed_by: createUserId, gift_type_id: createGiftTypeId, message: createMessage.trim() || undefined }),
    })
    const json = await res.json().catch(() => ({}))
    setCreateSaving(false)
    if (!json.ok) { setToast(json.error || '생성 실패'); setTimeout(() => setToast(''), 2500); return }
    setToast('선물이 생성됐어요'); setTimeout(() => setToast(''), 2500)
    setShowCreateModal(false)
    void load()
  }

  const loadGiftTypes = async () => {
    const res = await fetch('/api/admin/gift-types')
    const json = await res.json().catch(() => ({}))
    const active = ((json.items as (GiftTypeOpt & { is_active?: boolean })[]) || []).filter((t) => t.is_active !== false)
    setGiftTypes(active)
    if (active.length && !giftTypeId) setGiftTypeId(active[0].id)
    return active
  }

  const loadTypeItems = async () => {
    setTypeLoading(true)
    const res = await fetch('/api/admin/gift-types')
    const json = await res.json().catch(() => ({}))
    setTypeItems(json.ok ? (json.items as GiftTypeRow[]) || [] : [])
    setTypeLoading(false)
  }

  const openTypeModal = () => {
    setShowTypeModal(true)
    setTypeMsg('')
    void loadTypeItems()
  }

  const openTypeAdd = () => {
    setTypeEditing(null)
    setFormName('')
    setFormEmoji('🎁')
    setFormActive(true)
    setTypeFormOpen(true)
  }

  const openTypeEdit = (row: GiftTypeRow) => {
    setTypeEditing(row)
    setFormName(row.name)
    setFormEmoji(row.emoji || '🎁')
    setFormActive(row.is_active)
    setTypeFormOpen(true)
  }

  const saveTypeForm = async () => {
    if (!formName.trim()) {
      setTypeMsg('이름을 입력해주세요')
      return
    }
    setTypeSaving(true)
    setTypeMsg('')
    const res = await fetch('/api/admin/gift-types', {
      method: typeEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(typeEditing ? { id: typeEditing.id } : {}),
        name: formName.trim(),
        emoji: formEmoji.trim() || '🎁',
        is_active: formActive,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setTypeSaving(false)
    if (!json.ok) {
      setTypeMsg(json.error || '저장 실패')
      return
    }
    setTypeFormOpen(false)
    void loadTypeItems()
    void loadGiftTypes()
  }

  const removeType = async (row: GiftTypeRow) => {
    if (!confirm(`"${row.name}" 타입을 삭제할까요?`)) return
    const res = await fetch('/api/admin/gift-types', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json.ok) {
      setTypeMsg(json.error || '삭제 실패')
      return
    }
    void loadTypeItems()
    void loadGiftTypes()
  }

  const moveTypeOrder = async (row: GiftTypeRow, dir: -1 | 1) => {
    const sorted = [...typeItems].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((x) => x.id === row.id)
    const swap = sorted[idx + dir]
    if (!swap) return
    await Promise.all([
      fetch('/api/admin/gift-types', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, order: swap.order }) }),
      fetch('/api/admin/gift-types', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swap.id, order: row.order }) }),
    ])
    void loadTypeItems()
    void loadGiftTypes()
  }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('membership_gifts')
      .select('id, sender_name, message, amount, status, shipping_status, shipping_name, shipping_phone, shipping_address, shipping_detail, tracking_no, courier, claim_token, gift_copy, created_at, shipped_at, delivery_type, gift_type_id, gift_types(name, emoji)')
      .order('created_at', { ascending: false })
    setRows((data as unknown as GiftRow[]) || [])
    setLoading(false)
  }
  useEffect(() => { void load(); void loadGiftTypes() }, [])

  const filtered = rows.filter(r =>
    tab === 'all' ? true :
    tab === 'address_received' ? r.shipping_status === 'address_received' :
    r.shipping_status === 'shipped'
  )
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleShip = async () => {
    if (!selected) return
    if (deliveryType === 'courier' && !trackingNo) { showToast('운송장 번호를 입력해주세요'); return }
    if (deliveryType === 'quick' && !quickCompany) { showToast('퀵 업체명을 입력해주세요'); return }
    if (!giftTypeId) { showToast('선물 타입을 선택해주세요'); return }
    setSaving(true)
    const res = await fetch('/api/admin/membership/gifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        delivery_type: deliveryType,
        tracking_no: deliveryType === 'courier' ? trackingNo : null,
        courier: deliveryType === 'courier' ? courier : deliveryType === 'quick' ? quickCompany : '직접전달',
        gift_type_id: giftTypeId,
      }),
    })
    setSaving(false)
    if ((await res.json().catch(() => ({}))).ok ?? res.ok) {
      showToast('발송 처리 완료!')
      setSelected(null); setTrackingNo(''); setQuickCompany(''); setDeliveryType('courier')
      void load()
    } else { showToast('오류가 발생했어요') }
  }

  const s = { card: { background: '#fff', border: '0.5px solid rgba(123,94,167,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 } as React.CSSProperties }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0f', color: '#e8e0f5', padding: '20px 16px 80px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
          <div style={{ fontSize: 16, color: '#C9A96E', letterSpacing: 1 }}>ORÆN PRIVÉ · 선물 배송 관리</div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={openCreateModal}
              style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 12, cursor: 'pointer' }}
            >
              선물 생성
            </button>
            <button
              type="button"
              onClick={openTypeModal}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.15)', color: '#9B7EC8', fontSize: 12, cursor: 'pointer' }}
            >
              선물 타입 관리
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([['address_received','배송지입력완료'],['shipped','발송완료'],['all','전체']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, cursor: 'pointer', background: tab === k ? '#7B5EA7' : 'rgba(123,94,167,0.15)', color: tab === k ? '#fff' : '#9B7EC8' }}>{l}</button>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>항목이 없어요</div>
        ) : filtered.map(r => (
          <div key={r.id} style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 13, color: '#e8e0f5' }}>{r.sender_name || '(이름없음)'}</span>
                <span style={{ fontSize: 11, color: '#555', marginLeft: 8 }}>₩{r.amount?.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(123,94,167,0.15)', color: '#9B7EC8' }}>{STATUS_LABEL[r.status] || r.status}</span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(123,94,167,0.1)', color: SHIP_COLOR[r.shipping_status || 'pending'] }}>{SHIP_LABEL[r.shipping_status || 'pending']}</span>
              </div>
            </div>
            {r.shipping_name && (
              <div style={{ fontSize: 12, color: '#9B7EC8', marginBottom: 6 }}>
                {r.shipping_name} · {r.shipping_phone}<br/>{r.shipping_address} {r.shipping_detail || ''}
              </div>
            )}
            {(() => {
              const gt = Array.isArray(r.gift_types) ? r.gift_types[0] : r.gift_types
              return gt?.name ? (
                <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 6 }}>
                  {gt.emoji || '🎁'} {gt.name}
                </div>
              ) : null
            })()}
            {r.gift_copy && <div style={{ fontSize: 11, color: '#C9A96E', marginBottom: 8 }}>"{r.gift_copy}"</div>}
            {r.tracking_no && (
              <div style={{ fontSize: 11, color: '#1D9E75' }}>
                {r.delivery_type === 'direct' ? '직접전달 완료' : r.delivery_type === 'quick' ? `퀵 · ${r.courier}` : `${r.courier} ${r.tracking_no}`}
              </div>
            )}
            {r.shipping_status === 'address_received' && (
              <button onClick={() => { setSelected(r); setDeliveryType('courier'); setCourier('CJ대한통운'); setTrackingNo(''); setQuickCompany(''); setGiftTypeId(r.gift_type_id || giftTypes[0]?.id || '') }}
                style={{ marginTop: 8, padding: '7px 16px', background: '#7B5EA7', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                발송 처리
              </button>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px 16px' }} onClick={() => setSelected(null)}>
          <div style={{ width: '100%', maxWidth: 480, background: '#1a1a22', borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#C9A96E' }}>발송 처리 — {selected.shipping_name}</div>
              <button onClick={() => setSelected(null)} style={{ padding: '5px 12px', background: '#333', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕ 닫기</button>
            </div>
            <div style={{ fontSize: 12, color: '#9B7EC8', marginBottom: 14 }}>
              {selected.shipping_address} {selected.shipping_detail || ''}
            </div>
            <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 8 }}>선물 타입</div>
            <select
              value={giftTypeId}
              onChange={e => setGiftTypeId(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.3)', background: '#111', color: '#e8e0f5', fontSize: 13, marginBottom: 14 }}
            >
              {giftTypes.length === 0 ? (
                <option value="">타입 없음 — 선물 타입 관리에서 추가하세요</option>
              ) : giftTypes.map(t => (
                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 8 }}>배송 방법</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['courier','quick','direct'] as DeliveryType[]).map(t => (
                <button key={t} onClick={() => setDeliveryType(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 12, cursor: 'pointer', background: deliveryType === t ? '#7B5EA7' : 'rgba(123,94,167,0.15)', color: deliveryType === t ? '#fff' : '#9B7EC8' }}>
                  {t === 'courier' ? '📦 택배' : t === 'quick' ? '🛵 퀵' : '🤝 직접전달'}
                </button>
              ))}
            </div>
            {deliveryType === 'courier' && (
              <>
                <select value={courier} onChange={e => setCourier(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.3)', background: '#111', color: '#e8e0f5', fontSize: 13, marginBottom: 10 }}>
                  {['CJ대한통운','롯데택배','한진택배','우체국택배','로젠택배'].map(c => <option key={c}>{c}</option>)}
                </select>
                <input value={trackingNo} onChange={e => setTrackingNo(e.target.value)} placeholder="운송장 번호"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.3)', background: '#111', color: '#e8e0f5', fontSize: 13, marginBottom: 14, outline: 'none' }}/>
              </>
            )}
            {deliveryType === 'quick' && (
              <input value={quickCompany} onChange={e => setQuickCompany(e.target.value)} placeholder="퀵 업체명 (예: 바로고, 생각대로)"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.3)', background: '#111', color: '#e8e0f5', fontSize: 13, marginBottom: 14, outline: 'none' }}/>
            )}
            {deliveryType === 'direct' && (
              <div style={{ fontSize: 12, color: '#9B7EC8', marginBottom: 14, padding: '10px 12px', background: 'rgba(123,94,167,0.08)', borderRadius: 8 }}>
                직접 전달 후 발송 완료 처리됩니다
              </div>
            )}
            <button onClick={handleShip} disabled={saving} style={{ width: '100%', padding: 13, background: saving ? '#444' : '#7B5EA7', border: 'none', color: '#fff', borderRadius: 9, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '처리 중...' : '발송 완료 처리'}
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#7B5EA7', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 13 }}>{toast}</div>
      )}

      {showTypeModal ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 16 }} onClick={() => setShowTypeModal(false)}>
          <div style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', overflow: 'auto', background: '#1a1a22', borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, color: '#C9A96E' }}>선물 타입 관리</div>
              <button type="button" onClick={() => setShowTypeModal(false)} style={{ padding: '5px 12px', background: '#333', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕ 닫기</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button type="button" onClick={openTypeAdd} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 12, cursor: 'pointer' }}>+ 추가</button>
            </div>
            {typeMsg ? <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(217,79,79,0.12)', color: '#e08080', fontSize: 12 }}>{typeMsg}</div> : null}
            {typeLoading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 32, fontSize: 13 }}>불러오는 중...</div>
            ) : typeItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 32, fontSize: 13 }}>등록된 타입이 없어요</div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={typeTh}>순서</th>
                      <th style={typeTh}>이모지</th>
                      <th style={typeTh}>이름</th>
                      <th style={typeTh}>활성</th>
                      <th style={typeTh}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...typeItems].sort((a, b) => a.order - b.order).map(row => (
                      <tr key={row.id}>
                        <td style={typeTd}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" onClick={() => void moveTypeOrder(row, -1)} style={typeMiniBtn}>↑</button>
                            <button type="button" onClick={() => void moveTypeOrder(row, 1)} style={typeMiniBtn}>↓</button>
                          </div>
                        </td>
                        <td style={{ ...typeTd, fontSize: 18 }}>{row.emoji}</td>
                        <td style={typeTd}>{row.name}</td>
                        <td style={typeTd}>{row.is_active ? '✅' : '—'}</td>
                        <td style={typeTd}>
                          <button type="button" onClick={() => openTypeEdit(row)} style={{ ...typeMiniBtn, marginRight: 6 }}>수정</button>
                          <button type="button" onClick={() => void removeType(row)} style={{ ...typeMiniBtn, color: '#A33' }}>삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 16 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ width: '100%', maxWidth: 420, background: '#1a1a22', borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, color: '#C9A96E' }}>선물 생성</div>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '5px 12px', background: '#333', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕ 닫기</button>
            </div>
            <div style={{ fontSize: 11, color: '#8A7E92', marginBottom: 6 }}>고객 검색</div>
            <input
              value={createSearch}
              onChange={e => { setCreateSearch(e.target.value); void searchCreateUsers(e.target.value) }}
              placeholder="이름 또는 이메일 2자 이상"
              style={typeFieldStyle}
            />
            {createUsers.length > 0 ? (
              <div style={{ border: '1px solid rgba(123,94,167,0.3)', borderRadius: 8, marginTop: 6, overflow: 'hidden', maxHeight: 140, overflowY: 'auto' }}>
                {createUsers.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { setCreateUserId(u.id); setCreateSearch(u.email); setCreateUsers([]) }}
                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid rgba(123,94,167,0.2)', background: createUserId === u.id ? 'rgba(123,94,167,0.2)' : 'transparent', color: '#e8e0f5' }}
                  >
                    {u.name || '(이름없음)'} · {u.email}
                  </div>
                ))}
              </div>
            ) : null}
            {createUserId ? <div style={{ fontSize: 11, color: '#9B7EC8', marginTop: 8 }}>선택됨 · {createSearch}</div> : null}
            <div style={{ fontSize: 11, color: '#8A7E92', margin: '14px 0 6px' }}>선물 타입</div>
            <select value={createGiftTypeId} onChange={e => setCreateGiftTypeId(e.target.value)} style={{ ...typeFieldStyle, cursor: 'pointer' }}>
              {giftTypes.map(t => (
                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#8A7E92', margin: '14px 0 6px' }}>메시지 (선택)</div>
            <input value={createMessage} onChange={e => setCreateMessage(e.target.value)} placeholder="선물 메시지" style={typeFieldStyle} />
            <button type="button" disabled={createSaving} onClick={() => void handleCreateGift()} style={{ width: '100%', marginTop: 18, padding: 13, background: createSaving ? '#444' : '#7B5EA7', border: 'none', color: '#fff', borderRadius: 9, fontSize: 14, cursor: createSaving ? 'default' : 'pointer' }}>
              {createSaving ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>
      ) : null}

      {typeFormOpen ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }} onClick={() => setTypeFormOpen(false)}>
          <div style={{ width: '100%', maxWidth: 400, background: '#1a1a22', borderRadius: 14, padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, color: '#C9A96E', marginBottom: 16 }}>{typeEditing ? '타입 수정' : '타입 추가'}</div>
            <div style={{ fontSize: 11, color: '#8A7E92', marginBottom: 6 }}>이름</div>
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="예: 생일 축하" style={typeFieldStyle} />
            <div style={{ fontSize: 11, color: '#8A7E92', margin: '12px 0 6px' }}>이모지</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {EMOJI_PRESETS.map(em => (
                <button key={em} type="button" onClick={() => setFormEmoji(em)} style={{ width: 36, height: 36, borderRadius: 8, border: formEmoji === em ? '2px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)', background: formEmoji === em ? 'rgba(123,94,167,0.2)' : 'transparent', fontSize: 18, cursor: 'pointer' }}>{em}</button>
              ))}
            </div>
            <input value={formEmoji} onChange={e => setFormEmoji(e.target.value)} maxLength={8} style={typeFieldStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#e8e0f5', cursor: 'pointer' }}>
              <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} />
              활성 (선물 발송 시 선택 가능)
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => setTypeFormOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 9, border: '1px solid #444', background: 'transparent', color: '#aaa', cursor: 'pointer' }}>취소</button>
              <button type="button" disabled={typeSaving} onClick={() => void saveTypeForm()} style={{ flex: 1, padding: 12, borderRadius: 9, border: 'none', background: '#7B5EA7', color: '#fff', cursor: typeSaving ? 'default' : 'pointer' }}>{typeSaving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const typeTh: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: '#8A7E92', padding: '10px 12px', borderBottom: '1px solid rgba(123,94,167,0.2)', fontWeight: 500 }
const typeTd: React.CSSProperties = { fontSize: 13, color: '#2A2433', padding: '12px', borderBottom: '1px solid rgba(123,94,167,0.15)', verticalAlign: 'middle' }
const typeMiniBtn: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#7B5EA7', fontSize: 11, cursor: 'pointer' }
const typeFieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.3)', background: '#111', color: '#e8e0f5', fontSize: 13, outline: 'none' }
