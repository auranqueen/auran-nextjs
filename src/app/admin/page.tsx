import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireAdmin } from './_auth'

export default async function AdminPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const fmtMoney = (n: number) => `₩${Math.round(n).toLocaleString()}`

  // 통계 병렬 조회 (실데이터)
  const [
    { count: totalUsers },
    { count: totalOrders },
    { data: pendingOrders },
    { data: pendingSettlements },
    { data: recentLogs },
    { data: recentMembers },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('id,order_no,status,total_amount,earn_points,points_awarded,tracking_no,courier,ordered_at,customer_id').in('status', ['주문확인', '발송준비']).order('ordered_at').limit(10),
    supabase.from('settlements').select('id,target_name,amount,net_amount,status,target_role,period_start,period_end').eq('status', '정산대기').order('created_at', { ascending: false }).limit(10),
    supabase.from('login_logs').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('users').select('id,name,email,role,status,points,created_at,last_login_at').order('created_at', { ascending: false }).limit(8),
  ])

  const [{ count: customerCount }, { count: partnerCount }, { count: ownerCount }, { count: brandCount }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'partner'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'brand'),
  ])

  // 이달 매출
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: monthlyOrders } = await supabase.from('orders').select('final_amount').gte('ordered_at', monthStart).not('status', 'in', '("취소","환불")')
  const monthlyRevenue = (monthlyOrders || []).reduce((s, o) => s + (o.final_amount || 0), 0)

  const pendingShip = (pendingOrders || []).length
  const pendingSettle = (pendingSettlements || []).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text3)', letterSpacing: '.12em', marginBottom: 4 }}>
            THIS MONTH · REVENUE OVERVIEW
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: 'var(--gold2)' }}>
            {fmtMoney(monthlyRevenue).replace('₩', '₩')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 15px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{totalOrders || 0}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)' }}>전체 주문</div>
          </div>
          <div style={{ background: 'rgba(217,79,79,.08)', border: '1px solid rgba(217,79,79,.2)', borderRadius: 9, padding: '9px 15px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{pendingShip}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)' }}>발송 대기</div>
          </div>
          <div style={{ background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 9, padding: '9px 15px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{pendingSettle}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)' }}>정산 대기</div>
          </div>
        </div>
      </div>

      <div className="sg sg-4">
        <div className="sc">
          <div className="lbl">💧 고객</div>
          <div className="val" style={{ color: 'var(--gold)' }}>
            {(customerCount || 0).toLocaleString()}
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>명</span>
          </div>
          <div className="sub dim">role=customer</div>
        </div>
        <div className="sc">
          <div className="lbl">💼 파트너스</div>
          <div className="val" style={{ color: 'var(--blue)' }}>
            {(partnerCount || 0).toLocaleString()}
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>명</span>
          </div>
          <div className="sub dim">role=partner</div>
        </div>
        <div className="sc">
          <div className="lbl">🏥 원장님</div>
          <div className="val" style={{ color: 'var(--pink)' }}>
            {(ownerCount || 0).toLocaleString()}
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>개</span>
          </div>
          <div className="sub dim">role=owner</div>
        </div>
        <div className="sc">
          <div className="lbl">🏭 브랜드사</div>
          <div className="val" style={{ color: 'var(--green)' }}>
            {(brandCount || 0).toLocaleString()}
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>개</span>
          </div>
          <div className="sub dim">role=brand</div>
        </div>
      </div>

      <div className="split s32">
        <div className="card">
          <div className="card-hdr">
            <div>
              <div className="card-title">🚚 발송 대기 주문</div>
              <div className="card-sub">즉시 처리 필요</div>
            </div>
            <div className="card-acts">
              <a className="btn btn-gy" href="/admin/shipping">전체 보기 →</a>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>상태</th>
                <th>금액</th>
                <th>주문일</th>
              </tr>
            </thead>
            <tbody>
              {(pendingOrders || []).map(o => (
                <tr key={o.id}>
                  <td className="mono">{o.order_no}</td>
                  <td><span className="b b-gd">{o.status}</span></td>
                  <td className="mono">{fmtMoney(o.total_amount || 0)}</td>
                  <td className="mono">{o.ordered_at ? new Date(o.ordered_at).toLocaleDateString('ko-KR') : '-'}</td>
                </tr>
              ))}
              {(pendingOrders || []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text3)' }}>발송 대기 주문이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">💰 정산 대기</div>
              <a className="btn btn-gy" href="/admin/settlement">전체 →</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>대상</th>
                  <th>역할</th>
                  <th>정산액</th>
                </tr>
              </thead>
              <tbody>
                {(pendingSettlements || []).map(s => (
                  <tr key={s.id}>
                    <td>{s.target_name || '-'}</td>
                    <td><span className="b b-gy">{s.target_role}</span></td>
                    <td className="mono" style={{ color: 'var(--gold)' }}>{fmtMoney(s.net_amount || s.amount || 0)}</td>
                  </tr>
                ))}
                {(pendingSettlements || []).length === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--text3)' }}>정산 대기 건이 없습니다.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title">📋 최근 로그인</div>
              <a className="btn btn-gy" href="/admin/logs">전체 →</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>IP</th>
                  <th>일시</th>
                </tr>
              </thead>
              <tbody>
                {(recentLogs || []).map(l => (
                  <tr key={l.id}>
                    <td className="mono">{l.email}</td>
                    <td className="mono">{l.ip_address}</td>
                    <td className="mono">{l.created_at ? new Date(l.created_at).toLocaleString('ko-KR') : '-'}</td>
                  </tr>
                ))}
                {(recentLogs || []).length === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--text3)' }}>로그가 없습니다.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title">🆕 최근 가입</div>
              <a className="btn btn-gy" href="/admin/members">전체 →</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>역할</th>
                </tr>
              </thead>
              <tbody>
                {(recentMembers || []).map(m => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text)' }}>{m.name}</td>
                    <td className="mono">{m.email}</td>
                    <td><span className="b b-gy">{m.role}</span></td>
                  </tr>
                ))}
                {(recentMembers || []).length === 0 ? (
                  <tr><td colSpan={3} style={{ color: 'var(--text3)' }}>회원이 없습니다.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
