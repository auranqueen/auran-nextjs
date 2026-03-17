import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPrivacyLogsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=admin')
  const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/login?role=admin')

  // table name is not guaranteed in current schema; try a few common audit table names
  const candidates = ['privacy_logs', 'access_logs', 'audit_logs'] as const
  let rows: any[] = []
  let usedTable: string | null = null
  for (const t of candidates) {
    const res = await supabase.from(t).select('*').order('created_at', { ascending: false }).limit(200)
    if (!res.error) {
      rows = res.data || []
      usedTable = t
      break
    }
  }

  return (
    <div>
      {!usedTable ? (
        <div className="alert alert-warn">
          🔒 현재 DB에 개인정보 접근 로그 테이블이 없습니다. (시도: <span className="mono">privacy_logs / access_logs / audit_logs</span>)<br />
          테이블을 생성하면 이 페이지가 즉시 실데이터로 표시됩니다.
        </div>
      ) : (
        <div className="alert alert-info">
          ℹ️ table: <span className="mono">{usedTable}</span>
        </div>
      )}

      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">🔒 개인정보 접근 로그</div>
            <div className="card-sub">접근/조회/수정/삭제 등의 감사 로그</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>유형</th>
              <th>설명</th>
              <th>대상</th>
              <th>일시</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id || `${r.type}-${r.created_at}`}>
                <td><span className="b b-gy">{r.type || r.action || '-'}</span></td>
                <td>{r.description || r.detail || r.message || '-'}</td>
                <td className="mono">{r.target_user_id || r.user_id || r.target_id || '-'}</td>
                <td className="mono">{r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={4} style={{ color: 'var(--text3)' }}>로그가 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

