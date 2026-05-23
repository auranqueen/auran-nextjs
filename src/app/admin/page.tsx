import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireAdmin } from './_auth'

export default async function AdminPage({ searchParams }: { searchParams?: { insight?: string } }) {
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
    { data: recentAnalysisLogs },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('id,order_no,status,total_amount,earn_points,points_awarded,tracking_no,courier,ordered_at,customer_id').in('status', ['주문확인', '발송준비']).order('ordered_at').limit(10),
    supabase.from('settlements').select('id,target_name,amount,net_amount,status,target_role,period_start,period_end').eq('status', '정산대기').order('created_at', { ascending: false }).limit(10),
    supabase.from('login_logs').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('users').select('id,name,email,role,status,points,created_at,last_login_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('skin_analysis_logs').select('*, profiles(full_name, username, email)').order('analyzed_at', { ascending: false }).limit(5),
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

  const kstYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const dayStartIso = new Date(`${kstYmd}T00:00:00+09:00`).toISOString()

  const { data: skinToday } = await supabase
    .from('skin_cycle_analysis')
    .select('auth_id, checkin_condition, hormone_stage')
    .eq('record_date', kstYmd)
  const checkinTodayUsers = new Set((skinToday || []).map((r: any) => String(r.auth_id || '')).filter(Boolean)).size
  const goldenTodayUsers = new Set(
    (skinToday || [])
      .filter((r: any) => String(r.hormone_stage || '').includes('여포'))
      .map((r: any) => String(r.auth_id || ''))
      .filter(Boolean)
  ).size

  const { data: behClicks } = await supabase.from('user_behavior_logs').select('id').eq('action_type', 'product_click').gte('created_at', dayStartIso)
  const { data: behPurch } = await supabase.from('user_behavior_logs').select('id, metadata').eq('action_type', 'purchase').gte('created_at', dayStartIso)
  const clickCnt = (behClicks || []).length
  const purchaseCompleteCnt = (behPurch || []).filter((r: any) => String((r.metadata as any)?.flow || '') === 'order_complete').length
  const conversionPct = clickCnt > 0 ? Math.round((purchaseCompleteCnt / clickCnt) * 1000) / 10 : 0

  const { data: hcAll } = await supabase.from('hormone_cycle').select('track')
  const trackDist: Record<string, number> = {}
  for (const r of hcAll || []) {
    const t = String((r as { track?: string }).track || 'general')
    trackDist[t] = (trackDist[t] || 0) + 1
  }
  const trackTotal = Object.values(trackDist).reduce((a, b) => a + b, 0) || 1
  const pieColors = ['#c9a84c', '#7B5EA7', '#4cad7e', '#5b8def', '#e08080', '#9ca3af', '#38bdf8']
  let pieAcc = 0
  const pieStops = Object.entries(trackDist)
    .map(([_, v], i) => {
      const pct = (v / trackTotal) * 100
      const from = pieAcc
      pieAcc += pct
      return `${pieColors[i % pieColors.length]} ${from}% ${pieAcc}%`
    })
    .join(', ')

  const { data: searchRaw } = await supabase
    .from('customer_search_logs')
    .select('search_keyword, count, source, created_at')
    .eq('source', '검색')
    .gte('created_at', monthStart)
  const kwAgg: Record<string, number> = {}
  for (const r of searchRaw || []) {
    const k = String((r as { search_keyword?: string }).search_keyword || '').trim()
    if (!k) continue
    kwAgg[k] = (kwAgg[k] || 0) + Math.max(1, Number((r as { count?: number }).count || 1))
  }
  const searchTop10 = Object.entries(kwAgg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const { count: pendingPromote } = await supabase
    .from('customer_search_logs')
    .select('*', { count: 'exact', head: true })
    .eq('source', '검색')
    .eq('is_promoted', false)

  const insight = searchParams?.insight || ''
  let insightRows: { title: string; rows: any[] } | null = null
  if (insight === 'checkin_today') insightRows = { title: '오늘 체크인 기록', rows: skinToday || [] }
  else if (insight === 'golden_today')
    insightRows = {
      title: '오늘 황금기 기록',
      rows: (skinToday || []).filter((r: any) => String(r.hormone_stage || '').includes('여포')),
    }
  else if (insight === 'product_clicks') {
    const { data } = await supabase
      .from('user_behavior_logs')
      .select('*')
      .eq('action_type', 'product_click')
      .gte('created_at', dayStartIso)
      .order('created_at', { ascending: false })
      .limit(100)
    insightRows = { title: '오늘 상품 클릭 로그', rows: data || [] }
  } else if (insight === 'purchases_today') {
    const { data } = await supabase
      .from('user_behavior_logs')
      .select('*')
      .eq('action_type', 'purchase')
      .gte('created_at', dayStartIso)
      .order('created_at', { ascending: false })
      .limit(100)
    insightRows = { title: '오늘 구매 관련 로그', rows: data || [] }
  } else if (insight === 'tracks') insightRows = { title: '호르몬 트랙 (원본)', rows: hcAll || [] }
  else if (insight === 'search_top') insightRows = { title: '이번 달 검색어 TOP', rows: searchTop10.map(([keyword, total]) => ({ keyword, total })) }
  else if (insight === 'pending_tags') {
    const { data } = await supabase
      .from('customer_search_logs')
      .select('*')
      .eq('source', '검색')
      .eq('is_promoted', false)
      .order('created_at', { ascending: false })
      .limit(80)
    insightRows = { title: '승격 대기 자연어 로그', rows: data || [] }
  }

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

      <div style={{ margin: '18px 0 12px', fontSize: 11, color: 'var(--text3)', letterSpacing: '.08em' }}>오늘 · 고객 행동 / 피부 사이클 (실시간)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 18 }}>
        <a href="/admin?insight=checkin_today" className="card" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
          <div className="lbl">오늘 체크인 고객</div>
          <div className="val" style={{ color: 'var(--gold)' }}>
            {checkinTodayUsers}
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>명</span>
          </div>
          <div className="sub dim">skin_cycle_analysis · KST {kstYmd}</div>
        </a>
        <a href="/admin?insight=golden_today" className="card" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
          <div className="lbl">오늘 황금기 고객</div>
          <div className="val" style={{ color: 'var(--pink)' }}>
            {goldenTodayUsers}
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>명</span>
          </div>
          <div className="sub dim">황금기 단계 기록</div>
        </a>
        <div className="card" style={{ padding: 12 }}>
          <a href="/admin?insight=purchases_today" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="lbl">오늘 구매전환</div>
            <div className="val" style={{ color: 'var(--blue)' }}>
              {conversionPct}
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>%</span>
            </div>
            <div className="sub dim">구매확정 {purchaseCompleteCnt} / 클릭 {clickCnt}</div>
          </a>
          <a className="btn btn-gy" href="/admin?insight=product_clicks" style={{ fontSize: 9, padding: '4px 8px', marginTop: 8, display: 'inline-block' }}>
            클릭 로그 보기
          </a>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="lbl">트랙 분포</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
            <a href="/admin?insight=tracks" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: pieStops ? `conic-gradient(${pieStops})` : 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border)',
                }}
              />
            </a>
            <div style={{ flex: 1, fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
              {Object.entries(trackDist)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([k, v], i) => (
                  <div key={k}>
                    <span style={{ color: pieColors[i % pieColors.length] }}>●</span> {k} {v}
                  </div>
                ))}
            </div>
          </div>
        </div>
        <a href="/admin?insight=search_top" className="card" style={{ padding: 12, textDecoration: 'none', color: 'inherit' }}>
          <div className="lbl">이번 달 검색 TOP10</div>
          <div className="val" style={{ fontSize: 13, color: 'var(--text)' }}>
            {searchTop10[0] ? `${searchTop10[0][0]} (${searchTop10[0][1]})` : '—'}
          </div>
          <div className="sub dim">customer_search_logs</div>
        </a>
        <div className="card" style={{ padding: 12 }}>
          <a href="/admin?insight=pending_tags" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="lbl">승격 대기 자연어</div>
            <div className="val" style={{ color: 'var(--gold)' }}>{pendingPromote ?? 0}</div>
          </a>
          <a className="btn btn-gy" href="/admin/settings/categories" style={{ fontSize: 9, padding: '4px 8px', marginTop: 8, display: 'inline-block' }}>
            태그 관리 →
          </a>
        </div>
      </div>

      {insightRows ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-hdr">
            <div className="card-title">{insightRows.title}</div>
            <a className="btn btn-gy" href="/admin">
              닫기
            </a>
          </div>
          <table>
            <thead>
              <tr>
                {(insightRows.rows[0] && typeof insightRows.rows[0] === 'object'
                  ? Object.keys(insightRows.rows[0])
                  : ['value']
                ).map(k => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insightRows.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text3)' }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                insightRows.rows.map((r, i) => (
                  <tr key={i}>
                    {typeof r === 'object' && r !== null ? (
                      Object.keys(insightRows.rows[0] as object).map(k => (
                        <td key={k} className="mono" style={{ fontSize: 10, maxWidth: 220, wordBreak: 'break-all' }}>
                          {String((r as any)[k] ?? '')}
                        </td>
                      ))
                    ) : (
                      <td className="mono">{String(r)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

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
              <div className="card-title">AI 피부분석 내역</div>
              <a className="btn btn-gy" href="/admin/analysis-logs">전체 →</a>
            </div>
            <table>
              <thead>
                <tr>
                  <th>고객명</th>
                  <th>등급</th>
                  <th>토스트차감</th>
                  <th>분석일시</th>
                </tr>
              </thead>
              <tbody>
                {(recentAnalysisLogs || []).map((l: any) => {
                  const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
                  const name = p?.full_name || p?.username || p?.email || '-'
                  const toast = Number(l.toast_used || 0)
                  return (
                    <tr key={l.id}>
                      <td>{name}</td>
                      <td><span className="b b-gy">{l.grade || '-'}</span></td>
                      <td className="mono">{toast > 0 ? `${toast}T` : '무료'}</td>
                      <td className="mono">{l.analyzed_at ? new Date(l.analyzed_at).toLocaleString('ko-KR') : '-'}</td>
                    </tr>
                  )
                })}
                {(recentAnalysisLogs || []).length === 0 ? (
                  <tr><td colSpan={4} style={{ color: 'var(--text3)' }}>분석 내역이 없습니다.</td></tr>
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
