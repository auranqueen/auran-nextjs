'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const P = '#7B5EA7'
export default function RhythmFix() {
  const [open, setOpen] = useState(false)
  const [showMenoReason, setShowMenoReason] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reported, setReported] = useState(false)
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
  const report = async () => {
    setBusy(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setBusy(false); return }
    let snap = ''
    try {
      const { data: hc } = await sb.from('hormone_cycle').select('track, cycle_type, menopause_reason, last_period_date').eq('auth_id', user.id).maybeSingle()
      const { data: pr } = await sb.from('profiles').select('gender, birth_date, cycle_type').eq('auth_id', user.id).maybeSingle()
      snap = 'track=' + ((hc as any)?.track ?? '-') + ' cycle_type=' + ((hc as any)?.cycle_type ?? '-') + ' reason=' + ((hc as any)?.menopause_reason ?? '-') + ' last_period=' + ((hc as any)?.last_period_date ?? '-') + ' | gender=' + ((pr as any)?.gender ?? '-') + ' birth=' + ((pr as any)?.birth_date ?? '-') + ' pcycle=' + ((pr as any)?.cycle_type ?? '-')
    } catch {}
    await sb.from('voice_box').insert({ user_id: user.id, type: 'bug', content: '[리듬 안 맞아요] ' + snap, page_url: typeof window !== 'undefined' ? window.location.pathname : '/my' } as any)
    setBusy(false)
    setReported(true)
  }
  const btn: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', width: '100%' }
  const sub: React.CSSProperties = { fontSize: 12, color: '#8A7E92', cursor: 'pointer', textAlign: 'center', marginTop: 4 }
  if (!open) {
    return (
      <div style={{ margin: '10px 16px 0', textAlign: 'center' }}>
        <span onClick={() => setOpen(true)} style={{ fontSize: 12, color: '#8A7E92', cursor: 'pointer', textDecoration: 'underline' }}>내 리듬이 안 맞아요?</span>
      </div>
    )
  }
  return (
    <div style={{ margin: '10px 16px 0', padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg3)' }}>
      {reported ? (
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          전달했어요. 본사가 확인하고 맞춰드릴게요 💜
          <div onClick={() => { setReported(false); setOpen(false) }} style={sub}>닫기</div>
        </div>
      ) : !showMenoReason ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: P, marginBottom: 2 }}>내 리듬 다시 고르기</div>
          <button style={btn} disabled={busy} onClick={() => apply('general', 'menstrual', null)}>여성 · 생리 주기가 있어요</button>
          <button style={btn} disabled={busy} onClick={() => setShowMenoReason(true)}>여성 · 생리 주기가 없어요</button>
          <button style={btn} disabled={busy} onClick={() => apply('male', 'male', null)}>남성</button>
          <span onClick={() => { if (!busy) report() }} style={{ fontSize: 12, color: P, cursor: 'pointer', textAlign: 'center', marginTop: 8 }}>그래도 안 맞으면 · 본사에 알리기</span>
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
