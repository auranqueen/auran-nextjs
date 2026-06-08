'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GiftRow = {
  id: string; sender_name: string | null; message: string | null; amount: number
  status: string; shipping_status: string | null; shipping_name: string | null
  shipping_phone: string | null; shipping_address: string | null; shipping_detail: string | null
  tracking_no: string | null; courier: string | null; claim_token: string | null
  gift_copy: string | null; created_at: string; shipped_at: string | null
  delivery_type: string | null
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

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('membership_gifts')
      .select('id, sender_name, message, amount, status, shipping_status, shipping_name, shipping_phone, shipping_address, shipping_detail, tracking_no, courier, claim_token, gift_copy, created_at, shipped_at, delivery_type')
      .order('created_at', { ascending: false })
    setRows((data as GiftRow[]) || [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

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
    setSaving(true)
    const res = await fetch('/api/admin/membership/gifts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        delivery_type: deliveryType,
        tracking_no: deliveryType === 'courier' ? trackingNo : null,
        courier: deliveryType === 'courier' ? courier : deliveryType === 'quick' ? quickCompany : '직접전달',
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
        <div style={{ fontSize: 16, color: '#C9A96E', marginBottom: 20, letterSpacing: 1 }}>ORÆN PRIVÉ · 선물 배송 관리</div>
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
            {r.gift_copy && <div style={{ fontSize: 11, color: '#C9A96E', marginBottom: 8 }}>"{r.gift_copy}"</div>}
            {r.tracking_no && (
              <div style={{ fontSize: 11, color: '#1D9E75' }}>
                {r.delivery_type === 'direct' ? '직접전달 완료' : r.delivery_type === 'quick' ? `퀵 · ${r.courier}` : `${r.courier} ${r.tracking_no}`}
              </div>
            )}
            {r.shipping_status === 'address_received' && (
              <button onClick={() => { setSelected(r); setDeliveryType('courier'); setCourier('CJ대한통운'); setTrackingNo(''); setQuickCompany('') }}
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
    </div>
  )
}
