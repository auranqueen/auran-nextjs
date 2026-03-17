'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CommissionRow = { role: string; track?: string | null; rate: number }
type ReferralRow = { level: number; rate: number }

const DEFAULT_COMMISSION: CommissionRow[] = [
  { role: 'owner', rate: 8 },
  { role: 'partner', track: 'A', rate: 5 },
  { role: 'partner', track: 'B', rate: 8 },
]

const DEFAULT_REFERRAL: ReferralRow[] = [
  { level: 1, rate: 3 },
  { level: 2, rate: 1 },
]

export default function CommissionSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [commission, setCommission] = useState<CommissionRow[]>(DEFAULT_COMMISSION)
  const [referral, setReferral] = useState<ReferralRow[]>(DEFAULT_REFERRAL)
  const [toast, setToast] = useState('')

  const cKey = (r: CommissionRow) => `${r.role}:${r.track || '-'}`

  const cMap = useMemo(() => new Map(commission.map(r => [cKey(r), r])), [commission])
  const rMap = useMemo(() => new Map(referral.map(r => [r.level, r])), [referral])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [c, r] = await Promise.all([
          supabase.from('commission_settings').select('role,track,rate').order('role'),
          supabase.from('referral_settings').select('level,rate').order('level'),
        ])
        if (c.data?.length) setCommission(c.data as any)
        if (r.data?.length) setReferral(r.data as any)
      } catch {
        // keep defaults
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [supabase])

  const setCommissionRate = (row: CommissionRow, rate: number) => {
    const key = cKey(row)
    setCommission(prev => {
      const next = [...prev]
      const idx = next.findIndex(x => cKey(x) === key)
      if (idx >= 0) next[idx] = { ...next[idx], rate }
      else next.push({ ...row, rate })
      return next
    })
  }

  const setReferralRate = (level: number, rate: number) => {
    setReferral(prev => {
      const next = [...prev]
      const idx = next.findIndex(x => x.level === level)
      if (idx >= 0) next[idx] = { ...next[idx], rate }
      else next.push({ level, rate })
      return next.sort((a, b) => a.level - b.level)
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const cPayload = DEFAULT_COMMISSION.map(r => ({
        role: r.role,
        track: r.track || null,
        rate: Number(cMap.get(cKey(r))?.rate ?? r.rate),
        updated_at: new Date().toISOString(),
      }))
      const rPayload = DEFAULT_REFERRAL.map(r => ({
        level: r.level,
        rate: Number(rMap.get(r.level)?.rate ?? r.rate),
        updated_at: new Date().toISOString(),
      }))

      const [cRes, rRes] = await Promise.all([
        supabase.from('commission_settings').upsert(cPayload, { onConflict: 'role,track' }),
        supabase.from('referral_settings').upsert(rPayload, { onConflict: 'level' }),
      ])
      if (cRes.error) throw cRes.error
      if (rRes.error) throw rRes.error
      setToast('✅ 저장 즉시 반영됨')
      setTimeout(() => setToast(''), 2500)
    } catch (e: any) {
      alert(e?.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>수수료·추천 설정</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            저장 즉시 반영됩니다. (테이블: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>commission_settings</span>, <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>referral_settings</span>)
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: '#c9a84c',
            border: 'none',
            color: '#111',
            fontWeight: 900,
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 수수료 */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 900, color: '#fff' }}>
          포지션별 수수료율 (%)
        </div>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : (
          DEFAULT_COMMISSION.map(r => (
            <div key={cKey(r)} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 10, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                  {r.role === 'owner' ? '원장님' : '파트너스'} {r.track ? `트랙 ${r.track}` : ''}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  {r.role}{r.track ? `:${r.track}` : ''}
                </div>
              </div>
              <input
                type="number"
                value={cMap.get(cKey(r))?.rate ?? r.rate}
                onChange={e => setCommissionRate(r, Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: '10px 10px',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          ))
        )}
      </div>

      {/* 추천 */}
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 900, color: '#fff' }}>
          추천 단계별 설정 (%)
        </div>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : (
          DEFAULT_REFERRAL.map(r => (
            <div key={r.level} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: 10, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{r.level}단계</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>level={r.level}</div>
              </div>
              <input
                type="number"
                value={rMap.get(r.level)?.rate ?? r.rate}
                onChange={e => setReferralRate(r.level, Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: '10px 10px',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          ))
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 18, right: 18, background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 12 }}>
          {toast}
        </div>
      )}
    </div>
  )
}

