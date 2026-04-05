import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'

export default async function AdminMappingPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  const { data: rows } = await supabase
    .from('season_product_mapping')
    .select('*, products(name, category)')
    .order('month', { ascending: true })
    .order('priority', { ascending: true })

  const months = [1,2,3,4,5,6,7,8,9,10,11,12]
  const concerns = ['수분','장벽','탄력','미백','기미/색소','모공','민감성']

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">🌸 시즌 제품 매핑</div>
            <div className="card-sub">월별 피부 고민 기준 추천 제품 관리 · 점수 범위 매핑</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>고민 태그</th>
              <th>점수 범위</th>
              <th>제품명</th>
              <th>카테고리</th>
              <th>우선순위</th>
              <th>활성</th>
              <th>생성일</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: any) => (
              <tr key={r.id}>
                <td><span className="b b-pu">{r.month}월</span></td>
                <td>{r.concern_tag}</td>
                <td className="mono">{r.score_range_min}~{r.score_range_max}</td>
                <td>{r.products?.name || r.product_id}</td>
                <td>{r.products?.category || '-'}</td>
                <td><span className="b b-gd">P{r.priority}</span></td>
                <td><span className={`b ${r.is_active ? 'b-gr' : 'b-re'}`}>{r.is_active ? 'on' : 'off'}</span></td>
                <td className="mono">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={8} style={{ color: 'var(--text3)' }}>매핑 데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
