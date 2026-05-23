import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'

export default async function AdminAnalysisLogsPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: logs },
    { count: monthCount },
    { data: monthLogs },
  ] = await Promise.all([
    supabase
      .from('skin_analysis_logs')
      .select('*, profiles(full_name, username, email)')
      .order('analyzed_at', { ascending: false })
      .limit(500),
    supabase
      .from('skin_analysis_logs')
      .select('*', { count: 'exact', head: true })
      .gte('analyzed_at', monthStart),
    supabase
      .from('skin_analysis_logs')
      .select('toast_used')
      .gte('analyzed_at', monthStart),
  ])

  const monthToastSum = (monthLogs || []).reduce((s, r: any) => s + (Number(r.toast_used) || 0), 0)
  const monthAnalysisCount = monthCount || 0
  const monthApiCost = monthAnalysisCount * 2

  const profileName = (row: any) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return p?.full_name || p?.username || p?.email || '-'
  }

  return (
    <div>
      <div className="sg" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
        <div className="sc">
          <div className="lbl">이번 달 총 분석 횟수</div>
          <div className="val" style={{ color: 'var(--gold)' }}>{monthAnalysisCount.toLocaleString()}</div>
        </div>
        <div className="sc">
          <div className="lbl">이번 달 토스트 차감 합계</div>
          <div className="val" style={{ color: 'var(--pink)' }}>{monthToastSum.toLocaleString()}T</div>
        </div>
        <div className="sc">
          <div className="lbl">이번 달 API 비용 추정</div>
          <div className="val mono" style={{ color: 'var(--blue)' }}>₩{monthApiCost.toLocaleString()}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">🔬 AI 피부분석 내역</div>
            <div className="card-sub">table: skin_analysis_logs</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>고객명</th>
              <th>등급</th>
              <th>토스트 차감</th>
              <th>API 비용</th>
              <th>분석일시</th>
            </tr>
          </thead>
          <tbody>
            {(logs || []).map((l: any) => {
              const toast = Number(l.toast_used || 0)
              return (
                <tr key={l.id}>
                  <td>{profileName(l)}</td>
                  <td><span className="b b-gy">{l.grade || '-'}</span></td>
                  <td className="mono">{toast > 0 ? `${toast}T` : '무료'}</td>
                  <td className="mono">₩2</td>
                  <td className="mono">{l.analyzed_at ? new Date(l.analyzed_at).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              )
            })}
            {(logs || []).length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--text3)' }}>분석 내역이 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
