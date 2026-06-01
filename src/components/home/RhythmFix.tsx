'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const P = '#7B5EA7'
export default function RhythmFix() {
  const [open, setOpen] = useState(false)
  const [showMenoReason, setShowMenoReason] = useState(false)
  const [busy, setBusy] = useState(false)
  const apply = async (track: string, cycleType: string, reason: string | null) => {
    setBusy(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setBusy(false); return }
    const today = new Date().toISOString().slice(0, 10)
    const hc: any = { track, cycle_type: cycleType, menopause_reason: reason, updated_at: new Date().toISOString() }
    if (track === 'general') hc.last_period_date = today
    await sb.from('hormone_cycle').update(hc).eq('auth_id', user.id)
    await sb.from('profiles').update({ cycle_type: cycleType }).eq('auth_id', user.id)
    window.location.reload()
  }
  const btn: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', width: '100%' }
  const sub: React.CSSProperties = { fontSize: 12, color: '#8A7E92', cursor: 'pointer', textAlign: 'center', marginTop: 4 }
  if (!open) {
    return (
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <span onClick={() => setOpen(true)} style={{ fontSize: 12, color: '#8A7E92', cursor: 'pointer', textDecoration: 'underline' }}>내 리듬이 안 맞아요?</span>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg2, #fff)' }}>
      <div style={{ fontSize: 13, color: P, marginBottom: 10 }}>내 리듬 다시 고르기</div>
      {!showMenoReason ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <button style={btn} disabled={busy} onClick={() => apply('general', 'menstrual', null)}>여성 · 생리 주기가 있어요</button>
          <button style={btn} disabled={busy} onClick={() => setShowMenoReason(true)}>여성 · 생리 주기가 없어요</button>
          <button style={btn} disabled={busy} onClick={() => apply('male', 'male', null)}>남성</button>
          <span onClick={() => setOpen(false)} style={sub}>닫기</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#8A7E92' }}>괜찮으시면 알려주세요</div>
          <button style={btn} disabled={busy} onClick={() => apply('menopause_peri', 'menopause', 'natural')}>자연스럽게 멈췄어요</button>
          <button style={btn} disabled={busy} onClick={() => apply('menopause_peri', 'menopause', 'surgical')}>수술·치료 후예요</button>
          <button style={btn} disabled={busy} onClick={() => apply('menopause_peri', 'menopause', 'unknown')}>잘 모르겠어요</button>
          <span onClick={() => setShowMenoReason(false)} style={sub}>뒤로</span>
        </div>
      )}
    </div>
  )
}
