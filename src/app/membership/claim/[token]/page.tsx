'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const C = {
  purple: '#7B5EA7', gold: '#C9A96E', goldDark: '#A07F4A', cream: '#FAF6F0',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5', line: 'rgba(123,94,167,0.18)',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"

export default function ClaimPage() {
  const params = useParams()
  const router = useRouter()
  const token = Array.isArray((params as any).token) ? (params as any).token[0] : ((params as any).token as string)
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<any>(null)
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/membership/claim?token=' + encodeURIComponent(token))
        const j = await res.json()
        if (!j.ok) { setErr('선물을 찾을 수 없어요'); setLoading(false); return }
        setInfo(j)
      } catch { setErr('불러오지 못했어요') }
      setLoading(false)
    }
    if (token) load()
    else { setErr('잘못된 링크예요'); setLoading(false) }
  }, [token])

  const claim = async () => {
    setClaiming(true); setErr(null)
    const res = await fetch('/api/membership/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    const j = await res.json().catch(() => ({}))
    setClaiming(false)
    if (j.ok) { setDone(true); return }
    if (j.error === 'not_logged_in') {
      router.push('/login?role=customer&redirect=' + encodeURIComponent('/membership/claim/' + token))
      return
    }
    if (j.error === 'already_claimed') { setErr('이미 받은 선물이에요'); return }
    setErr('받기에 실패했어요. 잠시 후 다시 시도해주세요.')
  }

  const wrap = (children: React.ReactNode) => (
    <div style={{ background: C.cream, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum, padding: 18 }}>
      <div style={{ maxWidth: 420, width: '100%' }}>{children}</div>
    </div>
  )

  if (loading) return wrap(<div style={{ textAlign: 'center', color: C.muted, fontFamily: SERIF }}>불러오는 중...</div>)
  if (err && !info) return wrap(<div style={{ textAlign: 'center', color: C.muted }}>{err}</div>)

  if (done) return wrap(
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: 4, color: C.goldDark }}>ORÆN PRIVÉ</div>
      <div style={{ fontSize: 15, color: C.purple, marginTop: 18 }}>멤버십이 시작됐어요 💜</div>
      <div style={{ fontSize: 13, color: C.ink, marginTop: 10, lineHeight: 1.7 }}>두 달마다, 오랜이 직접 고른 리추얼이 도착해요.</div>
      <button onClick={() => router.push('/')} style={{ marginTop: 22, background: C.purple, border: 'none', color: '#fff', borderRadius: 9, padding: '12px 22px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>오랜으로 가기</button>
    </div>
  )

  const claimed = info?.status === 'claimed'
  const notPaid = info?.status && info.status !== 'paid' && info.status !== 'claimed'

  return wrap(
    <div style={{ background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 16, padding: '28px 22px', textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: C.goldDark, letterSpacing: 2 }}>선물이 도착했어요 🎁</div>
      <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: 4, color: C.goldDark, marginTop: 10 }}>ORÆN PRIVÉ</div>
      <div style={{ fontSize: 14, color: C.purple, marginTop: 6 }}>{info?.plan_name}</div>
      {info?.sender_name && <div style={{ fontSize: 12, color: C.muted, marginTop: 14 }}>{info.sender_name} 님이 보냈어요</div>}
      {info?.message && <div style={{ fontSize: 13, color: C.ink, marginTop: 8, lineHeight: 1.7, fontStyle: 'italic' }}>“{info.message}”</div>}
      {err && <div style={{ fontSize: 12, color: '#A33', marginTop: 14 }}>{err}</div>}
      {claimed ? (
        <div style={{ fontSize: 13, color: C.muted, marginTop: 20 }}>이미 받은 선물이에요</div>
      ) : notPaid ? (
        <div style={{ fontSize: 13, color: C.muted, marginTop: 20 }}>아직 결제 확인 전이에요. 잠시 후 다시 열어주세요.</div>
      ) : (
        <button onClick={claim} disabled={claiming} style={{ width: '100%', marginTop: 22, background: claiming ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, padding: 14, fontSize: 14, fontFamily: 'inherit', cursor: claiming ? 'default' : 'pointer' }}>
          {claiming ? '받는 중...' : '선물 받기'}
        </button>
      )}
      <div style={{ fontSize: 11, color: C.faint, marginTop: 14, lineHeight: 1.6 }}>로그인 후 받을 수 있어요</div>
    </div>
  )
}
