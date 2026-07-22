'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TabBrandSelector from '../components/TabBrandSelector'
interface InvoiceSettings {
  logo_name: string
  brand_sub: string
  address: string
  manager: string
  tel: string
  email: string
  greeting: string
  stamp_text: string
}
interface OrderRow {
  id: string
  owner_name: string | null
  salon_name: string | null
  grade: string | null
  status: string
  items: Array<{ name: string; qty: number; bonus?: number; promo?: string }>
  promo_applied: string | null
  points_earned: number
  created_at: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}
interface Props {
  myBrands: { id: string; name: string }[]
}
const DEFAULT_SETTINGS: InvoiceSettings = {
  logo_name: '',
  brand_sub: '',
  address: '',
  manager: '',
  tel: '',
  email: '',
  greeting: '항상 저희 제품을 이용해 주셔서 감사합니다.\n제품 수령 후 수량을 확인해 주시고,\n문의사항은 언제든지 연락 주세요.',
  stamp_text: '확인',
}
const PURPLE = '#7B5EA7'
export default function BrandTabInvoice({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [tab, setTab] = useState<'preview' | 'settings' | 'select'>('select')
  const [settings, setSettings] = useState<InvoiceSettings>({ ...DEFAULT_SETTINGS, logo_name: brandName })
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadSettings = useCallback(async () => {
    if (!brandId) return
    const { data } = await supabase
      .from('brands')
      .select('invoice_settings, name')
      .eq('id', brandId)
      .maybeSingle()
    if (data) {
      const s = (data.invoice_settings as Partial<InvoiceSettings>) || {}
      setSettings({
        logo_name: s.logo_name || data.name || brandName,
        brand_sub: s.brand_sub || '',
        address: s.address || '',
        manager: s.manager || '',
        tel: s.tel || '',
        email: s.email || '',
        greeting: s.greeting || DEFAULT_SETTINGS.greeting,
        stamp_text: s.stamp_text || data.name || brandName,
      })
    }
  }, [brandId, brandName])
  const loadOrders = useCallback(async () => {
    if (!brandId) return
    const { data } = await supabase
      .from('brand_orders')
      .select('id, owner_name, salon_name, grade, status, items, promo_applied, points_earned, created_at, courier, tracking_no, shipped_at')
      .eq('brand_id', brandId)
      .in('status', ['approved', 'shipping', 'done'])
      .order('created_at', { ascending: false })
      .limit(30)
    setOrders((data || []) as OrderRow[])
  }, [brandId])
  useEffect(() => {
    void loadSettings()
    void loadOrders()
  }, [loadSettings, loadOrders])
  const saveSettings = async () => {
    if (!brandId) return
    setSaving(true)
    const { error } = await supabase
      .from('brands')
      .update({ invoice_settings: settings })
      .eq('id', brandId)
    if (!error) showToast('설정 저장 완료! 모든 주문내역서에 자동 반영됩니다')
    else showToast('저장 실패: ' + error.message)
    setSaving(false)
  }
  const printInvoice = (order: OrderRow) => {
    const items = Array.isArray(order.items) ? order.items : []
    const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0)
    const totalBonus = items.reduce((s, it) => s + (it.bonus || 0), 0)
    const orderNum = `ORD-${order.id.slice(0, 8).toUpperCase()}`
    const orderDate = new Date(order.created_at).toLocaleDateString('ko-KR')
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>주문내역서 - ${order.owner_name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Malgun Gothic','나눔고딕',sans-serif;font-size:11px;color:#1a1a2e}
.a4{width:210mm;min-height:297mm;padding:20mm;margin:0 auto}
.header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid ${PURPLE}}
.logo{font-size:20px;font-weight:700;color:${PURPLE}}
.logo-sub{font-size:9px;color:#888;margin-top:3px}
.logo-contact{font-size:9px;color:#888;margin-top:2px}
.title-area{text-align:right}
.title-area h1{font-size:18px;font-weight:700;margin-bottom:4px;letter-spacing:4px}
.title-area p{font-size:10px;color:#666;margin-bottom:2px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.info-box{background:#f8f7fc;border-radius:6px;padding:10px 12px}
.info-label{font-size:9px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.info-row{display:flex;justify-content:space-between;margin-bottom:3px;font-size:10px}
.info-key{color:#666}
.info-val{color:#1a1a2e;font-weight:500}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:${PURPLE}}
th{color:#fff;padding:8px 10px;font-size:10px;font-weight:500;text-align:left}
td{padding:7px 10px;font-size:10px;border-bottom:0.5px solid #ede9f7}
tr:nth-child(even) td{background:#f8f7fc}
.total-box{background:#f8f7fc;border-radius:6px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.track-box{background:#EDE9F7;border-radius:6px;padding:10px 12px;margin-bottom:16px;display:flex;align-items:center;gap:12px}
.qr-box{width:54px;height:54px;border:2px solid ${PURPLE};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:${PURPLE};text-align:center;flex-shrink:0}
.footer{border-top:0.5px solid #ede9f7;padding-top:14px;display:flex;align-items:flex-end;justify-content:space-between;margin-top:auto}
.greeting{font-size:10px;color:#666;line-height:1.8;flex:1}
.stamp{width:64px;height:64px;border:2px solid ${PURPLE};border-radius:50%;display:flex;align-items:center;justify-content:center;color:${PURPLE};font-size:9px;font-weight:700;text-align:center;flex-shrink:0}
@media print{body{margin:0}.a4{padding:15mm}}
</style></head>
<body><div class="a4">
<div class="header">
  <div>
    <div class="logo">${settings.logo_name}</div>
    ${settings.brand_sub ? `<div class="logo-sub">${settings.brand_sub}</div>` : ''}
    <div class="logo-contact">${settings.tel}${settings.email ? ` · ${settings.email}` : ''}</div>
  </div>
  <div class="title-area">
    <h1>주 문 내 역 서</h1>
    <p>발주번호: ${orderNum}</p>
    <p>발행일: ${orderDate}</p>
  </div>
</div>
<div class="info-grid">
  <div class="info-box">
    <div class="info-label">수신 (원장님)</div>
    <div class="info-row"><span class="info-key">원장님</span><span class="info-val">${order.owner_name || '-'}</span></div>
    <div class="info-row"><span class="info-key">살롱명</span><span class="info-val">${order.salon_name || '-'}</span></div>
    <div class="info-row"><span class="info-key">등급</span><span class="info-val">${order.grade || '-'}</span></div>
  </div>
  <div class="info-box">
    <div class="info-label">발신 (브랜드사)</div>
    <div class="info-row"><span class="info-key">브랜드</span><span class="info-val">${settings.logo_name}</span></div>
    ${settings.address ? `<div class="info-row"><span class="info-key">주소</span><span class="info-val">${settings.address}</span></div>` : ''}
    ${settings.manager ? `<div class="info-row"><span class="info-key">담당자</span><span class="info-val">${settings.manager}</span></div>` : ''}
    ${settings.tel ? `<div class="info-row"><span class="info-key">연락처</span><span class="info-val">${settings.tel}</span></div>` : ''}
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:38%">제품명</th>
    <th style="width:15%;text-align:center">주문수량</th>
    <th style="width:15%;text-align:center">증정수량</th>
    <th style="width:15%;text-align:center">실수령</th>
    <th style="width:17%;text-align:right">프로모션</th>
  </tr></thead>
  <tbody>
    ${items.map(it => `<tr>
      <td>${it.name}</td>
      <td style="text-align:center">${it.qty}ea</td>
      <td style="text-align:center;color:${PURPLE}">${it.bonus ? `+${it.bonus}ea` : '-'}</td>
      <td style="text-align:center;font-weight:500">${(it.qty || 0) + (it.bonus || 0)}ea</td>
      <td style="text-align:right;color:${PURPLE}">${it.promo || order.promo_applied || '-'}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="total-box">
  <div>
    <div style="font-size:10px;color:#666;margin-bottom:4px">총 주문수량</div>
    <div style="font-size:14px;font-weight:700;color:${PURPLE}">${totalQty}ea${totalBonus > 0 ? ` + 증정 ${totalBonus}ea = 실수령 ${totalQty + totalBonus}ea` : ''}</div>
  </div>
  ${order.points_earned > 0 ? `<div style="text-align:right">
    <div style="font-size:9px;color:#666;margin-bottom:2px">적립 예정 포인트</div>
    <div style="font-size:13px;font-weight:700;color:#1E8449">+${order.points_earned}T</div>
  </div>` : ''}
</div>
${order.tracking_no ? `<div class="track-box">
  <div class="qr-box">QR<br>추적</div>
  <div>
    <div style="font-size:10px;color:${PURPLE};font-weight:600;margin-bottom:4px">배송 정보</div>
    <div style="font-size:10px;margin-bottom:2px">택배사: <strong>${order.courier}</strong></div>
    <div style="font-size:10px;margin-bottom:2px">운송장: <strong>${order.tracking_no}</strong></div>
    <div style="font-size:9px;color:#888">${order.shipped_at ? new Date(order.shipped_at).toLocaleDateString('ko-KR') + ' 발송' : ''}</div>
  </div>
</div>` : ''}
<div class="footer">
  <div class="greeting">${(settings.greeting || '').replace(/\n/g, '<br>')}</div>
  <div style="text-align:center;margin-left:16px">
    <div class="stamp">${settings.stamp_text || settings.logo_name}<br>확인</div>
    <div style="font-size:9px;color:#888;margin-top:4px">발송 담당자</div>
  </div>
</div>
</div></body></html>`
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      setTimeout(() => w.print(), 400)
    }
  }
  const SUB_COLOR = 'rgba(255,255,255,0.3)'
  const TEXT_COLOR = 'rgba(255,255,255,0.65)'
  const CARD_STYLE = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
  const INPUT_STYLE = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT_COLOR, outline: 'none' }
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    approved: { label: '승인됨', color: 'rgba(76,175,80,0.8)' },
    shipping: { label: '배송중', color: 'rgba(41,182,246,0.8)' },
    done:     { label: '완료',   color: 'rgba(255,255,255,0.3)' },
  }
  return (
    <div>
      <TabBrandSelector myBrands={myBrands} storageKey="invoice-brand" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
      ) : (
      <>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
      )}
      {/* 탭 네비 */}
      <div style={{ display: 'flex', gap: 0, border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
        {([
          { key: 'select', label: '📋 발주 선택' },
          { key: 'settings', label: '⚙️ 브랜드 설정' },
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '8px', fontSize: 12, border: 'none', background: tab === t.key ? 'rgba(123,94,167,0.2)' : 'transparent', color: tab === t.key ? '#c4a7e7' : SUB_COLOR, cursor: 'pointer', borderRight: t.key === 'select' ? '0.5px solid rgba(255,255,255,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>
      {/* 발주 선택 */}
      {tab === 'select' && (
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: SUB_COLOR, marginBottom: 12 }}>출력할 발주 선택 (승인됨·배송중·완료)</div>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: SUB_COLOR, fontSize: 12 }}>출력 가능한 발주가 없어요</div>
          ) : (
            orders.map((o, i) => {
              const st = STATUS_MAP[o.status]
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: i < orders.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}
                  onClick={() => { setSelectedOrder(o); showToast('주문내역서 출력 중...'); setTimeout(() => printInvoice(o), 100) }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: TEXT_COLOR }}>{o.owner_name || '원장님'}</span>
                      {st && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${st.color}22`, color: st.color, border: `0.5px solid ${st.color}55` }}>{st.label}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 2 }}>
                      {o.salon_name || '-'} · {o.grade || '-'}
                    </div>
                    <div style={{ fontSize: 11, color: SUB_COLOR }}>
                      {Array.isArray(o.items) ? o.items.map(it => `${it.name} ${it.qty}ea`).join(' · ') : ''}
                    </div>
                    {o.tracking_no && (
                      <div style={{ fontSize: 11, color: 'rgba(41,182,246,0.7)', marginTop: 2 }}>
                        📦 {o.courier} {o.tracking_no}
                      </div>
                    )}
                  </div>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); printInvoice(o); showToast('주문내역서 출력!') }}
                    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer', flexShrink: 0 }}>
                    🖨️ 출력
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
      {/* 브랜드 설정 */}
      {tab === 'settings' && (
        <div style={CARD_STYLE}>
          <div style={{ fontSize: 12, color: SUB_COLOR, marginBottom: 14 }}>주문내역서에 표시될 브랜드 정보</div>
          {([
            { label: '로고 표시명', key: 'logo_name', placeholder: '예: CIVASAN' },
            { label: '브랜드 소개', key: 'brand_sub', placeholder: '예: 시바산 코리아 · 에스테틱 전문 브랜드' },
            { label: '주소', key: 'address', placeholder: '서울시 강남구 ...' },
            { label: '담당자', key: 'manager', placeholder: '홍길동' },
            { label: '연락처', key: 'tel', placeholder: '02-0000-0000' },
            { label: '이메일', key: 'email', placeholder: 'brand@example.com' },
            { label: '도장 문구', key: 'stamp_text', placeholder: '브랜드명 확인' },
          ] as const).map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 4 }}>{f.label}</div>
              <input
                value={settings[f.key]}
                onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={INPUT_STYLE}
              />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: SUB_COLOR, marginBottom: 4 }}>인사말</div>
            <textarea
              value={settings.greeting}
              onChange={e => setSettings(prev => ({ ...prev, greeting: e.target.value }))}
              placeholder="원장님께 전할 인사말"
              rows={4}
              style={{ ...INPUT_STYLE, resize: 'none' as const }}
            />
          </div>
          <button type="button" onClick={saveSettings} disabled={saving}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      )}
      </>
      )}
    </div>
  )
}
