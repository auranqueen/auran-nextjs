import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'

export default async function AdminLoginLogsPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const { data: logs } = await supabase.from('login_logs').select('*').order('created_at', { ascending: false }).limit(200)

  return (
    <div className="card">
      <div className="card-hdr">
        <div>
          <div className="card-title">📋 로그인 기록</div>
          <div className="card-sub">table: login_logs</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>이메일</th>
            <th>역할</th>
            <th>결과</th>
            <th>IP</th>
            <th>일시</th>
          </tr>
        </thead>
        <tbody>
          {(logs || []).map((l: any) => (
            <tr key={l.id}>
              <td className="mono">{l.email}</td>
              <td><span className="b b-gy">{l.role || '-'}</span></td>
              <td><span className={`b ${l.status === 'success' ? 'b-gr' : 'b-re'}`}>{l.status || '-'}</span></td>
              <td className="mono">{l.ip_address || '-'}</td>
              <td className="mono">{l.created_at ? new Date(l.created_at).toLocaleString('ko-KR') : '-'}</td>
            </tr>
          ))}
          {(logs || []).length === 0 ? (
            <tr><td colSpan={5} style={{ color: 'var(--text3)' }}>로그가 없습니다.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

