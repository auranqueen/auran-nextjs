import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'

export default async function AdminOrdersPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const { data: orders } = await supabase
    .from('orders')
    .select('id,order_no,status,total_amount,final_amount,ordered_at,customer_id,tracking_no,courier')
    .order('ordered_at', { ascending: false })
    .limit(200)

  return (
    <div className="card">
      <div className="card-hdr">
        <div>
          <div className="card-title">📦 주문 내역</div>
          <div className="card-sub">최근 200건</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>주문번호</th>
            <th>상태</th>
            <th>금액</th>
            <th>결제금액</th>
            <th>운송장</th>
            <th>주문일</th>
          </tr>
        </thead>
        <tbody>
          {(orders || []).map((o: any) => (
            <tr key={o.id}>
              <td className="mono">{o.order_no}</td>
              <td><span className="b b-gy">{o.status}</span></td>
              <td className="mono">₩{Number(o.total_amount || 0).toLocaleString()}</td>
              <td className="mono" style={{ color: 'var(--gold)' }}>₩{Number(o.final_amount || 0).toLocaleString()}</td>
              <td className="mono">{o.tracking_no || '-'}</td>
              <td className="mono">{o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : '-'}</td>
            </tr>
          ))}
          {(orders || []).length === 0 ? (
            <tr><td colSpan={6} style={{ color: 'var(--text3)' }}>주문이 없습니다.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

