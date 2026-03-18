import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'

export default async function AdminMappingPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const candidates = ['recommend_rules', 'mapping_rules', 'recommend_mapping'] as const
  let used: string | null = null
  let rows: any[] = []
  for (const t of candidates) {
    const res = await supabase.from(t).select('*').order('created_at', { ascending: false }).limit(200)
    if (!res.error) {
      used = t
      rows = res.data || []
      break
    }
  }

  return (
    <div>
      {!used ? (
        <div className="alert alert-warn">
          ⚠️ 추천 매핑 테이블이 없습니다. (시도: <span className="mono">recommend_rules / mapping_rules / recommend_mapping</span>)<br />
          테이블을 만들면 이 페이지가 실데이터로 표시됩니다.
        </div>
      ) : (
        <div className="alert alert-info">ℹ️ table: <span className="mono">{used}</span></div>
      )}

      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">🧩 추천 매핑</div>
            <div className="card-sub">AI 분석 응답 → 추천 제품 우선순위</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>조건</th>
              <th>타겟</th>
              <th>우선도</th>
              <th>활성</th>
              <th>생성일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>{r.condition || r.rule || r.q || '-'}</td>
                <td>{r.product_name || r.product_id || r.target || '-'}</td>
                <td><span className="b b-gd">+{r.priority ?? r.rank ?? 1}</span></td>
                <td><span className={`b ${r.is_active ?? true ? 'b-gr' : 'b-re'}`}>{(r.is_active ?? true) ? 'on' : 'off'}</span></td>
                <td className="mono">{r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--text3)' }}>룰이 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

