import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '../_auth'

export default async function AdminChargePlansPage() {
  const supabase = createClient()
  await requireAdmin(supabase as any)

  // Optional table: charge_plans (may not exist yet)
  const res = await supabase.from('charge_plans').select('*').order('sort_order', { ascending: true }).limit(200)
  const hasTable = !res.error
  const plans = (res.data || []) as any[]

  return (
    <div>
      {!hasTable ? (
        <div className="alert alert-warn">
          ⚠️ 현재 DB에 <span className="mono">charge_plans</span> 테이블이 없습니다. 테이블을 생성하면 이 페이지가 실데이터로 표시됩니다.
        </div>
      ) : (
        <div className="alert alert-info">ℹ️ table: <span className="mono">charge_plans</span></div>
      )}

      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">💳 충전 플랜</div>
            <div className="card-sub">목록 조회 (편집 UI는 다음 단계로 확장)</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>라벨</th>
              <th>금액</th>
              <th>보너스</th>
              <th>활성</th>
              <th>정렬</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p: any) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td className="mono">₩{Number(p.amount || 0).toLocaleString()}</td>
                <td className="mono" style={{ color: 'var(--gold)' }}>+{Number(p.bonus || 0).toLocaleString()}P</td>
                <td><span className={`b ${p.is_active ? 'b-gr' : 'b-re'}`}>{p.is_active ? 'on' : 'off'}</span></td>
                <td className="mono">{p.sort_order ?? '-'}</td>
              </tr>
            ))}
            {plans.length === 0 ? (
              <tr><td colSpan={5} style={{ color: 'var(--text3)' }}>플랜이 없습니다.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

