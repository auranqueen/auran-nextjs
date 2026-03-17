'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = {
  action: string
  points: number
  updated_at?: string
}

const DEFAULT_ACTIONS: { action: string; label: string }[] = [
  { action: 'signup', label: '회원가입' },
  { action: 'purchase', label: '구매' },
  { action: 'review', label: '리뷰' },
  { action: 'attendance', label: '출석' },
  { action: 'referral', label: '추천' },
]

export default function PointSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [toast, setToast] = useState('')

  const map = useMemo(() => {
    const m = new Map<string, Row>()
    rows.forEach(r => m.set(r.action, r))
    return m
  }, [rows])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('point_settings')
          .select('action,points,updated_at')
          .order('action')
        setRows((data || []) as Row[])
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [supabase])

  const setValue = (action: string, points: number) => {
    setRows(prev => {
      const next = [...prev]
      const idx = next.findIndex(r => r.action === action)
      if (idx >= 0) next[idx] = { ...next[idx], points }
      else next.push({ action, points })
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = DEFAULT_ACTIONS.map(a => ({
        action: a.action,
        points: Number(map.get(a.action)?.points ?? 0),
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('point_settings').upsert(payload, { onConflict: 'action' })
      if (error) throw error
      setToast('✅ 저장 완료')
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
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>포인트 설정</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            행동별 적립 수치를 관리합니다. (테이블: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>point_settings</span>)
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

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 800 }}>
          <div>행동</div>
          <div>포인트</div>
        </div>

        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : (
          DEFAULT_ACTIONS.map(a => (
            <div key={a.action} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{a.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{a.action}</div>
              </div>
              <input
                type="number"
                value={map.get(a.action)?.points ?? 0}
                onChange={e => setValue(a.action, Number(e.target.value))}
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

