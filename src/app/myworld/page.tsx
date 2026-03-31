'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'

export default function MyWorldPage() {
  const router = useRouter()
  const supabase = createClient()
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([])
  const [vanityItems, setVanityItems] = useState<any[]>([])
  const [routineLogs, setRoutineLogs] = useState<any[]>([])
  const [skinDiary, setSkinDiary] = useState<any[]>([])
  const [guestbook, setGuestbook] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'room' | 'diary' | 'routine' | 'guestbook'>('room')
  const [isPlaying, setIsPlaying] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mood, setMood] = useState('😊 좋음')
  const [skinStatus, setSkinStatus] = useState('💧 촉촉')
  const [diaryMemo, setDiaryMemo] = useState('')
  const [guestbookInput, setGuestbookInput] = useState('')
  const [bgmTab, setBgmTab] = useState<'morning' | 'night' | 'pack'>('morning')
  const [routineChecked, setRoutineChecked] = useState<Record<string, boolean>>({})
  const [showCustomize, setShowCustomize] = useState(false)
  const [myworldNickname, setMyworldNickname] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('💜 보라빛 드림')
  const [myworldBio, setMyworldBio] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      setUser(auth.user)

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url, grade, skin_type, myworld_nickname, myworld_theme, myworld_bio')
        .eq('auth_id', auth.user.id)
        .maybeSingle()
      setProfile(p || null)
      if ((p as any)?.myworld_nickname) setMyworldNickname(String((p as any).myworld_nickname))
      if ((p as any)?.myworld_theme) setSelectedTheme(String((p as any).myworld_theme))
      setMyworldBio(String((p as any)?.myworld_bio || ''))

      let deliveredRows: any[] = []
      const { data: dOrders } = await supabase
        .from('orders')
        .select('id, items, status, delivered_at, created_at')
        .eq('customer_id', auth.user.id)
        .eq('status', '배송완료')
        .order('delivered_at', { ascending: false })
      if (Array.isArray(dOrders)) deliveredRows = dOrders
      setDeliveredOrders(deliveredRows)

      const unique = new Map<string, any>()
      deliveredRows.forEach((o: any) => {
        const items = Array.isArray(o.items) ? o.items : []
        items.forEach((it: any) => {
          const pid = String(it?.product_id || it?.id || '').trim()
          if (!pid) return
          if (!unique.has(pid)) {
            unique.set(pid, {
              id: pid,
              name: String(it?.name || it?.product_name || '제품'),
              thumb: String(it?.storage_thumb_url || it?.thumb_img || ''),
              purchasedAt: String(o.delivered_at || o.created_at || ''),
            })
          }
        })
      })
      setVanityItems(Array.from(unique.values()))

      const { data: routines } = await supabase
        .from('routine_logs')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('completed_at', { ascending: false })
        .limit(200)
      const routineRows = Array.isArray(routines) ? routines : []
      setRoutineLogs(routineRows)

      const todayKey = new Date().toISOString().slice(0, 10)
      const checked: Record<string, boolean> = {}
      routineRows.forEach((r: any) => {
        const day = String(r?.completed_at || '').slice(0, 10)
        if (day !== todayKey) return
        const key = `${String(r?.routine_type || '')}:${String(r?.item || '')}`
        checked[key] = true
      })
      setRoutineChecked(checked)

      const { data: diaryRows } = await supabase
        .from('skin_diary')
        .select('*')
        .eq('user_id', auth.user.id)
        .order('recorded_at', { ascending: false })
        .limit(7)
      setSkinDiary(Array.isArray(diaryRows) ? diaryRows : [])

      const { data: guestRows } = await supabase
        .from('guestbook')
        .select('*')
        .eq('host_user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setGuestbook(Array.isArray(guestRows) ? guestRows : [])
    }
    run()
  }, [supabase])

  const roomLevel = deliveredOrders.length === 0 ? 1 : deliveredOrders.length <= 2 ? 2 : deliveredOrders.length <= 5 ? 3 : deliveredOrders.length <= 10 ? 4 : 5
  const toNext = roomLevel >= 5 ? 0 : [0, 3, 6, 11, 999][roomLevel] - deliveredOrders.length

  const latestRoutineDate = routineLogs[0]?.completed_at ? new Date(routineLogs[0].completed_at) : null
  const daysSinceRoutine = latestRoutineDate ? Math.floor((Date.now() - latestRoutineDate.getTime()) / 86400000) : 999
  const todayDone = latestRoutineDate ? latestRoutineDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) : false

  const moodOptions = ['😊 좋음', '😐 보통', '😔 별로', '😣 힘듦']
  const skinOptions = ['💧 촉촉', '🌟 맑음', '😓 번들', '🔴 트러블', '💨 당김']
  const morningItems = ['세안', '토너', '세럼', '크림', '선크림']
  const eveningItems = ['클렌징', '세안', '토너', '세럼', '크림']
  const totalRoutine = morningItems.length + eveningItems.length
  const doneRoutine = Object.values(routineChecked).filter(Boolean).length
  const routinePct = Math.round((doneRoutine / totalRoutine) * 100)

  const streakDays = useMemo(() => {
    const set = new Set<string>()
    routineLogs.forEach((r: any) => {
      const d = String(r?.completed_at || '').slice(0, 10)
      if (d) set.add(d)
    })
    let s = 0
    const d = new Date()
    while (true) {
      const key = d.toISOString().slice(0, 10)
      if (!set.has(key)) break
      s += 1
      d.setDate(d.getDate() - 1)
    }
    return s
  }, [routineLogs])

  const toggleRoutine = async (type: 'morning' | 'evening', item: string) => {
    const key = `${type}:${item}`
    const next = !routineChecked[key]
    setRoutineChecked((p) => ({ ...p, [key]: next }))
    if (next && user?.id) {
      await supabase.from('routine_logs').insert({
        user_id: user.id,
        routine_type: type,
        item,
        completed_at: new Date().toISOString(),
      })
    }
  }

  const onSaveDiary = async () => {
    if (user?.id) {
      await supabase.from('skin_diary').insert({
        user_id: user.id,
        mood,
        skin_status: skinStatus,
        memo: diaryMemo,
        recorded_at: new Date().toISOString(),
      })
    }
    setToast('기록됐어요 💜')
    setDiaryMemo('')
  }

  const onWriteGuestbook = async () => {
    if (!guestbookInput.trim()) return
    if (user?.id) {
      await supabase.from('guestbook').insert({
        host_user_id: user.id,
        visitor_user_id: user.id,
        message: guestbookInput.trim(),
        created_at: new Date().toISOString(),
      })
    }
    setGuestbook((prev) => [
      { id: `${Date.now()}`, message: guestbookInput.trim(), created_at: new Date().toISOString() },
      ...prev,
    ])
    setGuestbookInput('')
    setToast('방명록이 남겨졌어요 💜')
  }

  const bgmQuery =
    bgmTab === 'morning'
      ? 'morning+skincare+routine+music'
      : bgmTab === 'night'
        ? 'night+skincare+routine+relaxing+music'
        : 'face+mask+relaxing+music+15min'
  const particles = useMemo(() => {
    if (daysSinceRoutine < 1) return []
    const count = daysSinceRoutine < 3 ? 5 : daysSinceRoutine < 5 ? 8 : daysSinceRoutine < 7 ? 12 : 16
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji: daysSinceRoutine < 3 ? '·' : daysSinceRoutine < 5 ? '🌸' : daysSinceRoutine < 7 ? '🍂' : '❄️',
      size: [10, 12, 14, 16, 18, 20][Math.floor(Math.random() * 6)],
      left: Math.random() * 90 + 5,
      delay: Math.random() * 8,
      duration: 10 + Math.random() * 8,
      opacity: 0.4 + Math.random() * 0.5,
      swayAmount: Math.random() * 20 - 10,
    }))
  }, [daysSinceRoutine])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 96, fontWeight: 400 }}>
      <style>{`
        @keyframes snowfall {
          0% { transform: translateY(-20px) translateX(0px); opacity: 0; }
          10% { opacity: var(--opacity); }
          50% { transform: translateY(50%) translateX(var(--sway)); }
          90% { opacity: var(--opacity); }
          100% { transform: translateY(110%) translateX(0px); opacity: 0; }
        }
        @keyframes twinkle {
          0% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.2; transform: scale(0.9); }
        }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => router.push('/my')} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontFamily: 'Georgia, serif', color: '#c4a7e7', letterSpacing: '6px', fontSize: 18 }}>MY WORLD</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>👁 127</div>
      </header>

      <div style={{ background: 'linear-gradient(135deg, rgba(123,94,167,0.2), rgba(80,50,120,0.1))', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 18, padding: 16, margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 60, height: 60, objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 28 }}>👩</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: '#e8e0f5' }}>{myworldNickname || profile?.username || profile?.full_name || '나의 공간'}</div>
          <div style={{ display: 'inline-block', marginTop: 2, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#c4a7e7', fontSize: 10 }}>{profile?.grade || 'PETAL'}</div>
          <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.5)', marginTop: 4 }}>일촌 0명 · 방명록 {guestbook.length}개</div>
        </div>
        <button onClick={() => setShowCustomize(true)} style={{ border: '1px solid rgba(123,94,167,0.4)', color: '#9b7ec8', fontSize: 11, background: 'transparent', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>꾸미기 ✏️</button>
      </div>

      <div style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.15)', borderRadius: 12, padding: '10px 14px', margin: '10px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9b7ec8' }}>
          <span>🎵</span>
          <span>AURAN Morning Routine</span>
        </div>
        <button
          onClick={() => {
            setIsPlaying((p) => !p)
            window.open('https://www.youtube.com/results?search_query=AURAN+morning+routine+bgm', '_blank')
          }}
          style={{ fontSize: 10, border: '1px solid rgba(123,94,167,0.3)', color: '#c4a7e7', borderRadius: 8, background: 'transparent', padding: '6px 10px', cursor: 'pointer' }}
        >
          {isPlaying ? '⏸ 정지' : '▶ 재생'}
        </button>
      </div>

      <div style={{ display: 'flex', margin: '14px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          ['room', '스킨케어룸'],
          ['diary', '피부일기'],
          ['routine', '루틴'],
          ['guestbook', '방명록'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: activeTab === key ? '#c4a7e7' : 'rgba(255,255,255,0.5)',
              borderBottom: activeTab === key ? '2px solid #7B5EA7' : '2px solid transparent',
              fontSize: 12,
              padding: '10px 0',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'room' ? (
        <>
          <div style={{ background: todayDone ? 'rgba(123,94,167,0.09)' : 'rgba(123,94,167,0.05)', border: '1px solid rgba(123,94,167,0.15)', borderRadius: 16, margin: '0 16px', minHeight: 220, position: 'relative', overflow: 'hidden', padding: 20, filter: daysSinceRoutine >= 14 ? 'grayscale(60%)' : daysSinceRoutine >= 7 ? 'grayscale(30%)' : 'none' }}>
            <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 9, color: 'rgba(123,94,167,0.6)' }}>Lv.{roomLevel} · 다음 레벨까지 제품 {Math.max(0, toNext)}개</div>
            {!todayDone
              ? particles.map((particle) => (
                  <div
                    key={`particle-${particle.id}`}
                    style={{
                      position: 'absolute',
                      left: `${particle.left}%`,
                      top: -20,
                      fontSize: `${particle.size}px`,
                      opacity: particle.opacity,
                      animation: `snowfall ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
                      pointerEvents: 'none',
                      zIndex: 2,
                      ['--opacity' as any]: particle.opacity,
                      ['--sway' as any]: `${particle.swayAmount}px`,
                    }}
                  >
                    {particle.emoji}
                  </div>
                ))
              : null}
            {daysSinceRoutine >= 7 ? <div style={{ position: 'absolute', top: 40, left: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>오래됐네요 😢</div> : null}
            {daysSinceRoutine >= 14 ? <div style={{ position: 'absolute', top: 58, left: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>피부가 그리워하고 있어요</div> : null}
            {todayDone ? [0, 1, 2].map((i) => <div key={`star-${i}`} style={{ position: 'absolute', left: `${35 + i * 15}%`, top: `${35 + i * 9}px`, fontSize: 12, animation: 'twinkle 1.2s ease-in-out infinite' }}>✨</div>) : null}

            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 36 }}>🛏️</div>
            {roomLevel >= 2 ? <div style={{ position: 'absolute', bottom: 20, right: 20, fontSize: 32 }}>🪞</div> : null}
            {roomLevel >= 3 ? <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 24 }}>💡</div> : null}
            {roomLevel >= 4 ? <div style={{ position: 'absolute', bottom: 20, left: 20, fontSize: 28 }}>🌿</div> : null}
            {roomLevel >= 5 ? <div style={{ position: 'absolute', bottom: 20, left: 30, fontSize: 36 }}>🛋️</div> : null}
            <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: '#c4a7e7' }}>오늘 피부점수 78 ✨</div>
          </div>

          <div style={{ margin: '14px 16px 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>🪞 내 화장대</div>
          <div style={{ margin: '8px 16px 0', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {vanityItems.length > 0 ? vanityItems.map((v: any) => (
              <div key={v.id} onClick={() => router.push(`/products/${v.id}`)} style={{ minWidth: 80, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 6, cursor: 'pointer' }}>
                <div style={{ height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {v.thumb ? <img src={v.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🧴</span>}
                </div>
                <div style={{ fontSize: 9, marginTop: 6, color: 'rgba(255,255,255,0.75)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.name}</div>
              </div>
            )) : (
              <div style={{ width: '100%', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
                아직 구매한 제품이 없어요{'\n'}제품을 구매하면 화장대에 올라가요 💜
              </div>
            )}
          </div>

          <div style={{ margin: '12px 16px 0' }}>
            <button onClick={() => setDrawerOpen((p) => !p)} style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'rgba(123,94,167,0.08)', color: '#c4a7e7', borderRadius: 10, padding: '8px 12px', fontSize: 11, cursor: 'pointer' }}>🗄️ 서랍 열기</button>
          </div>
          {drawerOpen ? (
            <div style={{ margin: '10px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {vanityItems.map((v: any) => (
                <div key={`drawer-${v.id}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 8 }}>
                  <div style={{ height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {v.thumb ? <img src={v.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🧴</span>}
                  </div>
                  <div style={{ fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.75)' }}>{v.name}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{v.purchasedAt ? String(v.purchasedAt).slice(0, 10) : ''}</div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === 'diary' ? (
        <div style={{ margin: '12px 16px 0' }}>
          <div style={{ background: 'rgba(123,94,167,0.06)', border: '1px solid rgba(123,94,167,0.18)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{new Date().toLocaleDateString('ko-KR')}</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
              {moodOptions.map((m) => (
                <button key={m} onClick={() => setMood(m)} style={{ border: mood === m ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', background: mood === m ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: 8, padding: '6px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{m}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
              {skinOptions.map((s) => (
                <button key={s} onClick={() => setSkinStatus(s)} style={{ border: skinStatus === s ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', background: skinStatus === s ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.03)', color: '#fff', borderRadius: 8, padding: '6px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>{s}</button>
              ))}
            </div>
            <textarea value={diaryMemo} onChange={(e) => setDiaryMemo(e.target.value)} placeholder="오늘 피부 한줄 기록..." rows={3} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, marginBottom: 8 }} />
            <button onClick={onSaveDiary} style={{ background: '#7B5EA7', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, width: '100%', cursor: 'pointer' }}>기록하기 💜</button>
          </div>

          <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 12 }}>
            {skinDiary.length > 0 ? skinDiary.map((d: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{String(d?.recorded_at || '').slice(0, 10)}</div>
                <div style={{ fontSize: 12 }}>{d?.mood || ''} · {d?.skin_status || ''}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{d?.memo || ''}</div>
              </div>
            )) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'pre-line', textAlign: 'center' }}>
                {'아직 기록이 없어요\n매일 기록하면 피부 변화를 볼 수 있어요 ✨'}
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#c4a7e7', marginBottom: 8 }}>💜 피부 타임라인</div>
            {[
              ['2026.01', 62],
              ['2026.02', 71],
              ['2026.03', 78],
            ].map(([m, p], i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{m} → 수분 {p}%{i === 2 ? ' ✨' : ''}</div>
                <div style={{ width: '100%', height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.1)' }}>
                  <div style={{ width: `${p}%`, height: 5, borderRadius: 999, background: '#7B5EA7' }} />
                </div>
              </div>
            ))}
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href)
                  setToast('링크가 복사됐어요 💜')
                } catch {
                  setToast('공유 링크를 복사하지 못했어요')
                }
              }}
              style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              SNS 공유
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'routine' ? (
        <div style={{ margin: '12px 16px 0' }}>
          <div style={{ background: 'rgba(123,94,167,0.06)', border: '1px solid rgba(123,94,167,0.18)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}>아침 루틴</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {morningItems.map((item) => {
                const key = `morning:${item}`
                const checked = !!routineChecked[key]
                return (
                  <button key={key} onClick={() => toggleRoutine('morning', item)} style={{ border: checked ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.3)', background: checked ? '#7B5EA7' : 'transparent', color: '#fff', borderRadius: 8, padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}>
                    {checked ? '✓ ' : '☐ '}{item}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 12, marginBottom: 6 }}>저녁 루틴</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {eveningItems.map((item) => {
                const key = `evening:${item}`
                const checked = !!routineChecked[key]
                return (
                  <button key={key} onClick={() => toggleRoutine('evening', item)} style={{ border: checked ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.3)', background: checked ? '#7B5EA7' : 'transparent', color: '#fff', borderRadius: 8, padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}>
                    {checked ? '✓ ' : '☐ '}{item}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>오늘 루틴 {routinePct}%</div>
            <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', marginBottom: 8 }}>
              <div style={{ width: `${routinePct}%`, height: 6, borderRadius: 999, background: '#7B5EA7' }} />
            </div>
            {routinePct === 100 ? (
              <div style={{ background: 'rgba(201,169,110,0.14)', border: '1px solid rgba(201,169,110,0.35)', borderRadius: 10, padding: 10, fontSize: 11, color: GOLD }}>
                오늘 루틴 완성! ✨ +10T 적립
              </div>
            ) : null}
            <div style={{ marginTop: 10, fontSize: 12, color: GOLD }}>🔥 {streakDays}일 연속 루틴 중</div>
          </div>

          <div style={{ marginTop: 12, background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#c4a7e7', marginBottom: 8 }}>🎵 루틴 BGM 추천</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                ['morning', '모닝'],
                ['night', '나이트'],
                ['pack', '팩타임'],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setBgmTab(k as any)} style={{ flex: 1, border: bgmTab === k ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.2)', background: bgmTab === k ? 'rgba(123,94,167,0.2)' : 'transparent', color: '#fff', borderRadius: 8, padding: '6px 0', fontSize: 11, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => window.open(`https://youtube.com/results?search_query=${bgmQuery}`, '_blank')} style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '8px 10px', fontSize: 11, cursor: 'pointer' }}>
              ▶ 유튜브에서 듣기
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'guestbook' ? (
        <div style={{ margin: '12px 16px 0' }}>
          <textarea value={guestbookInput} onChange={(e) => setGuestbookInput(e.target.value)} placeholder="방명록을 남겨보세요 💜" rows={3} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13 }} />
          <button onClick={onWriteGuestbook} style={{ marginTop: 8, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 13, width: '100%', cursor: 'pointer' }}>남기기</button>

          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {guestbook.length > 0 ? guestbook.map((g: any, i: number) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11 }}>👤 {String(g?.message || '')}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{String(g?.created_at || '').slice(0, 10)}</div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'pre-line', padding: '12px 0' }}>
                {'💜 아직 방명록이 없어요\n마이월드 링크를 공유해서\n친구들을 초대해보세요 ✨'}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href)
                setToast('링크가 복사됐어요 💜')
              } catch {
                setToast('링크 복사에 실패했어요')
              }
            }}
            style={{ marginTop: 10, border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#7B5EA7', borderRadius: 10, padding: '8px 14px', fontSize: 11, cursor: 'pointer' }}
          >
            링크 복사
          </button>
        </div>
      ) : null}

      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '390px', height: '80px', background: 'rgba(13,11,9,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px 16px', zIndex: 50 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🏠</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>HOME</span>
        </div>
        <div onClick={() => router.push('/products')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🛍</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>SHOP</span>
        </div>
        <div onClick={() => router.push('/skin-analysis')} style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'linear-gradient(135deg,#C9A96E,#E8C88A)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: '0 4px 24px rgba(201,169,110,0.5)', marginTop: '-22px', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: '22px' }}>🔬</span>
          <span style={{ fontSize: '8px', color: BG, fontFamily: 'monospace' }}>AI</span>
        </div>
        <div onClick={() => router.push('/salon')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>📅</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>BOOK</span>
        </div>
        <div onClick={() => router.push('/my')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>👤</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: GOLD, letterSpacing: '1px' }}>MY</span>
        </div>
      </nav>

      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 100, background: 'rgba(123,94,167,0.9)', color: '#fff', borderRadius: 20, padding: '10px 20px', fontSize: 12, zIndex: 60 }}>
          {toast}
        </div>
      ) : null}
      {showCustomize ? (
        <div
          onClick={() => setShowCustomize(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderTop: '2px solid #7B5EA7', borderRadius: 16, padding: 24, width: '90%', maxWidth: 380, position: 'relative' }}
          >
            <button onClick={() => setShowCustomize(false)} style={{ position: 'absolute', top: 10, right: 10, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer' }}>×</button>
            <div style={{ fontSize: 15, color: '#c4a7e7', marginBottom: 12 }}>✏️ 마이월드 꾸미기</div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>마이월드 닉네임</div>
            <input
              value={myworldNickname}
              onChange={(e) => setMyworldNickname(e.target.value)}
              placeholder="달빛언니, 피부요정..."
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, marginBottom: 10 }}>마이페이지 이름과 다르게 설정할 수 있어요</div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>방 테마</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {['💜 보라빛 드림', '🤍 미니멀 모던', '🌸 로맨틱 봄', '🗼 파리지앵'].map((theme) => {
                const selected = selectedTheme === theme
                return (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    style={{
                      border: selected ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)',
                      background: selected ? 'rgba(123,94,167,0.2)' : 'transparent',
                      color: selected ? '#c4a7e7' : 'rgba(255,255,255,0.4)',
                      borderRadius: 10,
                      padding: '8px 6px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {theme}
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>나의 스킨케어 철학</div>
            <textarea
              rows={2}
              value={myworldBio}
              onChange={(e) => setMyworldBio(e.target.value)}
              placeholder="예) 매일 루틴으로 빛나는 피부 💜"
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, marginBottom: 12, resize: 'none' }}
            />

            <button
              onClick={async () => {
                if (!user?.id) return
                const payload = { myworld_nickname: myworldNickname.trim() || null, myworld_theme: selectedTheme, myworld_bio: myworldBio.trim() || null }
                const { error } = await supabase.from('profiles').update(payload).eq('auth_id', user.id)
                if (error) {
                  await supabase.from('profiles').update({ myworld_nickname: myworldNickname.trim() || null }).eq('auth_id', user.id)
                }
                setToast('저장됐어요 💜')
                setShowCustomize(false)
              }}
              style={{ background: '#7B5EA7', color: '#fff', border: 'none', borderRadius: 12, padding: 12, width: '100%', fontSize: 13, cursor: 'pointer' }}
            >
              저장
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
