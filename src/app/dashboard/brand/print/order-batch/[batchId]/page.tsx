'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OrderItem = {
  name: string
  qty: number
  unit_price?: number
  line_amount?: number
  bonus?: number
  promo?: string
}

type OrderRow = {
  id: string
  brand_id: string
  brand_name: string
  items: OrderItem[]
  promo_applied: string | null
  total_amount: number
}

type BatchRow = {
  id: string
  order_no: string
  owner_name: string | null
  salon_name: string | null
  total_amount: number
  created_at: string
}

type ChecklistRow = { id: string; label: string }

function money(n: number) {
  return Math.trunc(Number(n) || 0).toLocaleString('ko-KR')
}

function itemAmount(it: OrderItem) {
  if (typeof it.line_amount === 'number') return Math.trunc(it.line_amount)
  return Math.trunc((Number(it.unit_price) || 0) * (Number(it.qty) || 0))
}

export default function OrderBatchPrintPage() {
  const params = useParams()
  const batchId = String(params?.batchId || '')
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batch, setBatch] = useState<BatchRow | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [checklist, setChecklist] = useState<ChecklistRow[]>([])
  const [contact, setContact] = useState('고객센터로 문의해 주세요')

  const load = useCallback(async () => {
    if (!batchId) return
    setLoading(true)
    setError('')

    const [{ data: batchData, error: batchErr }, { data: orderData }, { data: checkData }] = await Promise.all([
      supabase
        .from('brand_order_batches')
        .select('id, order_no, owner_name, salon_name, total_amount, created_at')
        .eq('id', batchId)
        .maybeSingle(),
      supabase
        .from('brand_orders')
        .select('id, batch_id, brand_id, items, promo_applied, total_amount, brands(name, manager_phone, contact)')
        .eq('batch_id', batchId),
      supabase
        .from('brand_order_batch_checklist_items')
        .select('id, label')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true }),
    ])

    if (batchErr || !batchData) {
      setError(batchErr?.message || '주문서 배치를 찾을 수 없습니다')
      setLoading(false)
      return
    }

    const mapped: OrderRow[] = ((orderData || []) as Array<Record<string, unknown>>).map((o) => {
      const brandRel = Array.isArray(o.brands) ? o.brands[0] : o.brands
      const brandObj = (brandRel || {}) as { name?: string | null; manager_phone?: string | null; contact?: string | null }
      return {
        id: String(o.id),
        brand_id: String(o.brand_id),
        brand_name: brandObj.name || '브랜드',
        items: Array.isArray(o.items) ? (o.items as OrderItem[]) : [],
        promo_applied: (o.promo_applied as string | null) || null,
        total_amount: Math.trunc(Number(o.total_amount) || 0),
      }
    })

    const firstBrand = ((orderData || []) as Array<Record<string, unknown>>)[0]
    const brandRel0 = firstBrand
      ? (Array.isArray(firstBrand.brands) ? firstBrand.brands[0] : firstBrand.brands)
      : null
    const brand0 = (brandRel0 || {}) as { manager_phone?: string | null; contact?: string | null; name?: string | null }
    const phone = (brand0.manager_phone || brand0.contact || '').trim()
    setContact(phone ? `${brand0.name || '브랜드'} 문의: ${phone}` : '브랜드 고객센터로 문의해 주세요')

    setBatch(batchData as BatchRow)
    setOrders(mapped)
    setChecklist((checkData || []) as ChecklistRow[])
    setLoading(false)
  }, [batchId])

  useEffect(() => { void load() }, [load])

  const totalAmount = useMemo(() => {
    if (batch?.total_amount) return Math.trunc(Number(batch.total_amount) || 0)
    return orders.reduce((s, o) => s + o.total_amount, 0)
  }, [batch, orders])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>불러오는 중…</div>
  }
  if (error || !batch) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#c62828' }}>{error || '데이터 없음'}</div>
  }

  const receivedAt = new Date(batch.created_at).toLocaleString('ko-KR')
  const receiver = `${batch.owner_name || '원장님'} / ${batch.salon_name || '-'}`

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .sheet {
          width: 210mm;
          min-height: 277mm;
          margin: 0 auto;
          background: #fff;
          color: #111;
          font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .half {
          flex: 1;
          padding: 8mm 6mm;
          box-sizing: border-box;
        }
        .tear {
          border-top: 1.5px dashed #888;
          margin: 0 4mm;
          text-align: center;
          font-size: 10px;
          color: #888;
          letter-spacing: 1px;
          padding: 2mm 0;
        }
        .title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .meta { font-size: 11px; line-height: 1.55; margin-bottom: 8px; }
        .brand-block { margin-bottom: 8px; }
        .brand-name {
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 3px;
          padding: 2px 6px;
          background: #f3f0f8;
          display: inline-block;
          border-radius: 3px;
        }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        th, td { border-bottom: 0.5px solid #ddd; padding: 3px 2px; text-align: left; vertical-align: top; }
        th { color: #666; font-weight: 600; }
        .right { text-align: right; }
        .badge {
          display: inline-block;
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 8px;
          background: #f5ecd9;
          color: #8a6a2f;
          margin-left: 4px;
        }
        .bonus { color: #666; font-size: 10px; }
        .total {
          margin-top: 8px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          border-top: 1.5px solid #222;
          padding-top: 6px;
        }
        .sign { margin-top: 14px; font-size: 12px; }
        .notes { margin-top: 8px; font-size: 11px; }
        .notes li { margin-bottom: 2px; }
      `}</style>

      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 10, background: '#1a1520',
        padding: '12px 16px', display: 'flex', justifyContent: 'center', gap: 10,
      }}>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '10px 22px', borderRadius: 8, border: 'none',
            background: '#7B5EA7', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          인쇄하기
        </button>
      </div>

      <div className="sheet">
        {/* 회사보관용 */}
        <section className="half">
          <div className="title">발주명세서 (회사보관용)</div>
          <div className="meta">
            <div>주문번호: <strong>{batch.order_no}</strong></div>
            <div>접수일: {receivedAt}</div>
            <div>받는이: {receiver}</div>
          </div>

          {orders.map((ord) => (
            <div key={ord.id} className="brand-block">
              <div className="brand-name">{ord.brand_name}</div>
              <table>
                <thead>
                  <tr>
                    <th>상품명</th>
                    <th className="right">수량</th>
                    <th className="right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {ord.items.map((it, idx) => {
                    const bonus = Math.trunc(Number(it.bonus) || 0)
                    const promo = (it.promo || '').trim() || (ord.promo_applied || '')
                    return (
                      <tr key={`${ord.id}-${idx}`}>
                        <td>
                          {it.name}
                          {promo ? <span className="badge">{promo}</span> : null}
                          {bonus > 0 ? <div className="bonus">증정: {it.name} × {bonus}개</div> : null}
                        </td>
                        <td className="right">{it.qty}</td>
                        <td className="right">{money(itemAmount(it))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {checklist.length > 0 && (
            <div className="notes">
              <strong>물류전달사항</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                {checklist.map((c) => (
                  <li key={c.id}>{c.label}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="total">
            <span>합계금액</span>
            <span>₩{money(totalAmount)}</span>
          </div>
          <div className="sign">출고담당자 서명: ______________</div>
        </section>

        <div className="tear">✂ ——— 절취선 (위: 회사보관 / 아래: 원장님용) ———</div>

        {/* 원장님용 */}
        <section className="half">
          <div className="title">발주명세서 (원장님용)</div>
          <div className="meta">
            <div>주문번호: <strong>{batch.order_no}</strong></div>
            <div>접수일: {receivedAt}</div>
            <div>받는이: {receiver}</div>
          </div>

          {orders.map((ord) => (
            <div key={`c-${ord.id}`} className="brand-block">
              <div className="brand-name">{ord.brand_name}</div>
              <table>
                <thead>
                  <tr>
                    <th>상품명</th>
                    <th className="right">수량</th>
                    <th className="right">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {ord.items.map((it, idx) => (
                    <tr key={`c-${ord.id}-${idx}`}>
                      <td>{it.name}</td>
                      <td className="right">{it.qty}</td>
                      <td className="right">{money(itemAmount(it))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="total">
            <span>합계금액</span>
            <span>₩{money(totalAmount)}</span>
          </div>
          <div className="notes" style={{ marginTop: 12 }}>문의처: {contact}</div>
        </section>
      </div>
    </>
  )
}