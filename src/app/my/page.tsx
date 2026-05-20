'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TOOLTIP_FALLBACKS, isPeriodTrack } from '@/lib/hormoneUtils'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [grade, setGrade] = useState('')
  const [point, setPoint] = useState(0)
  const [chargeBalance, setChargeBalance] = useState(0)
  const [pointHistory, setPointHistory] = useState<any[]>([])
  const [expiringPoint, setExpiringPoint] = useState(0)
  const [friendFeed, setFriendFeed] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [refills, setRefills] = useState<any[]>([])
  const [recentOrdersForRefill, setRecentOrdersForRefill] = useState<any[]>([])
  const [tracker, setTracker] = useState({ water: 6, uv: 3, sleep: 7.5, routine: 75 })
  const [completion, setCompletion] = useState(0)
  const [profileData, setProfileData] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [hormoneTrack, setHormoneTrack] = useState('general')
  const [gender, setGender] = useState('')
  const [hormoneCycle, setHormoneCycle] = useState<any>(null)
  const [periodTipOpen, setPeriodTipOpen] = useState(false)
  const [notifSound, setNotifSound] = useState('violet')
  const [soundSheetOpen, setSoundSheetOpen] = useState(false)
  const [periodTipText, setPeriodTipText] = useState(TOOLTIP_FALLBACKS.period_start)
  const [periodTipTitle, setPeriodTipTitle] = useState('생리 시작 안내')
  const [periodTipEnabled, setPeriodTipEnabled] = useState(true)
  const [periodQuietNotice, setPeriodQuietNotice] = useState('')
  const [skinMonthlyReport, setSkinMonthlyReport] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user)
        const name = data.user.user_metadata?.full_name || data.user.user_metadata?.name
        if (name) setUserName(name)
        supabase
          .from('hormone_cycle')
          .select('*')
          .eq('auth_id', data.user.id)
          .maybeSingle()
          .then(({ data: hc }) => {
            if (!hc) return
            setHormoneCycle(hc)
            setHormoneTrack(String((hc as any).track || 'general'))
            if (isPeriodTrack(String((hc as any).track || 'general'))) {
              const lp = (hc as any).last_period_date ? new Date((hc as any).last_period_date) : null
              if (lp && !Number.isNaN(lp.getTime())) {
                const gap = Math.floor((Date.now() - lp.getTime()) / 86400000)
                if (gap >= 45) setPeriodQuietNotice('혹시 건너뛰셨나요?')
              }
            }
          })
        supabase
          .from('help_tooltips')
          .select('title,content,text,value,is_active')
          .eq('key', 'period_start')
          .maybeSingle()
          .then(({ data: tip }) => {
            const t = String((tip as any)?.content || (tip as any)?.text || (tip as any)?.value || '').trim()
            const isOn = (tip as any)?.is_active !== false
            setPeriodTipEnabled(isOn && !!t)
            if (t) {
              setPeriodTipText(t)
              setPeriodTipTitle(String((tip as any)?.title || '생리 시작 안내'))
            }
          })
        supabase.from('users').select('id, points, charge_balance').eq('auth_id', data.user.id).single().then(({ data: meRow }) => {
          if (!meRow) return
          setPoint(meRow.points || 0)
          setChargeBalance(meRow.charge_balance || 0)
          supabase
            .from('orders')
            .select('*, order_items(*, products(*, brands(name)))')
            .eq('customer_id', meRow.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data: ord }) => {
              if (ord) setOrders(ord)
            })
          supabase
            .from('orders')
            .select('id, items, status, tracking_no, courier, ordered_at, delivered_at')
            .eq('customer_id', meRow.id)
            .order('ordered_at', { ascending: false })
            .limit(3)
            .then(async ({ data: recentOrders }) => {
              const rows = recentOrders || []
              setRecentOrdersForRefill(rows)
              const parsed: { order_id: string; product_id: string; delivered_at: string; fallback_name: string }[] = []
              const uniqueIds = new Set<string>()
              rows.forEach((o: any) => {
                const items = Array.isArray(o.items) ? o.items : []
                items.forEach((it: any) => {
                  const pid = String(it?.product_id || it?.id || it?.productId || '').trim()
                  if (!pid) return
                  parsed.push({
                    order_id: String(o.id),
                    product_id: pid,
                    delivered_at: String(o.delivered_at || ''),
                    fallback_name: String(it?.product_name || it?.name || '제품'),
                  })
                  uniqueIds.add(pid)
                })
              })
              if (parsed.length === 0) {
                setRefills([])
                return
              }
              const ids = Array.from(uniqueIds)
              const { data: productRows } = await supabase
                .from('products')
                .select('id, name, avg_usage_days')
                .in('id', ids)
              const { data: trackingRows } = await supabase
                .from('product_usage_tracking')
                .select('product_id, order_id, started_at, avg_usage_days')
                .eq('user_id', data.user.id)
                .in('product_id', ids)
              const productMap = new Map((productRows || []).map((p: any) => [String(p.id), p]))
              const trackingMap = new Map((trackingRows || []).map((t: any) => [`${String(t.order_id)}:${String(t.product_id)}`, t]))
              const merged = parsed.map((row) => {
                const product = productMap.get(row.product_id)
                const tracking = trackingMap.get(`${row.order_id}:${row.product_id}`)
                const avgDays = Number(tracking?.avg_usage_days || product?.avg_usage_days || 60)
                return {
                  order_id: row.order_id,
                  product_id: row.product_id,
                  name: String(product?.name || row.fallback_name || '제품'),
                  avg_usage_days: avgDays > 0 ? avgDays : 60,
                  started_at: tracking?.started_at ? String(tracking.started_at) : '',
                  delivered_at: row.delivered_at,
                  status: String((rows.find((r: any) => String(r.id) === row.order_id)?.status as string) || ''),
                }
              })
              setRefills(merged)
            })
        })
        supabase
          .from('point_transactions')
          .select('amount, type, description, created_at')
          .eq('user_id', data.user.id)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data }) => {
            setPointHistory(data || [])
          })
        supabase
          .from('point_transactions')
          .select('amount')
          .eq('user_id', data.user.id)
          .eq('type', 'expire')
          .then(({ data }) => {
            const total = (data || []).reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount || 0)), 0)
            setExpiringPoint(total)
          })
        supabase
          .from('profiles')
          .select('grade, full_name, username, avatar_url, phone, birth_date, skin_type, skin_concerns, menstrual_cycle, drink_frequency, exercise_frequency, preferred_brands, special_dates, gender, notification_sound')
          .eq('auth_id', data.user.id)
          .maybeSingle()
          .then(async ({ data: profile }) => {
            setGrade(profile?.grade || 'PETAL')
            const pName = profile?.full_name || profile?.username
            if (pName) setUserName(pName)
            setProfileData(profile || null)
            if ((profile as any)?.notification_sound) {
              setNotifSound(String((profile as any).notification_sound))
            }
            if ((profile as any)?.gender) setGender(String((profile as any).gender))
            setAvatarUrl(profile?.avatar_url ? String(profile.avatar_url) : '')
            const checks = [
              !!profile?.full_name,
              !!profile?.phone,
              !!profile?.birth_date,
              !!profile?.skin_type,
              profile?.skin_concerns?.length > 0,
              !!profile?.menstrual_cycle,
              !!profile?.drink_frequency,
              !!profile?.exercise_frequency,
              profile?.preferred_brands?.length > 0,
              profile?.special_dates?.length > 0,
            ]
            const done = Math.round((checks.filter(Boolean).length / checks.length) * 100)
            setCompletion(done)
          })
        supabase
          .from('monthly_skin_reports')
          .select('*')
          .eq('auth_id', data.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data: reps }) => {
            setSkinMonthlyReport(reps?.[0] || null)
          })
        supabase
          .from('friend_activities')
          .select('*')
          .eq('user_id', data.user.id)
          .limit(3)
          .then(({ data: activities, error: activitiesError }) => {
            if (!activitiesError && Array.isArray(activities) && activities.length > 0) {
              setFriendFeed(activities)
              return
            }
            supabase
              .from('friendships')
              .select('*')
              .eq('user_id', data.user.id)
              .limit(3)
              .then(({ data: friendships, error: friendshipsError }) => {
                if (!friendshipsError && Array.isArray(friendships)) setFriendFeed(friendships)
                else setFriendFeed([])
              })
          })
      } else {
        setOrders([])
        setGrade('PETAL')
        setCompletion(0)
        setProfileData(null)
        setAvatarUrl('')
        setPoint(0)
        setChargeBalance(0)
        setPointHistory([])
        setExpiringPoint(0)
        setFriendFeed([])
        setRecentOrdersForRefill([])
        setSkinMonthlyReport(null)
      }
    })
    // TODO: coupons 테이블에서 사용 가능한 쿠폰 조회
    supabase.from('user_coupons').select('*, coupons(*)').eq('is_used', false).then(({ data }) => {
      if (data) setCoupons(data)
    })
    // TODO: user_daily_tracker 테이블
  }, [])

  const menuItems = [
    { icon: '📦', label: '주문내역', path: '/my/orders', badge: orders.length > 0 ? orders.filter((o: any) => o.status === '배송중').length : 0 },
    { icon: '🎫', label: '쿠폰함', path: '/my/coupons', badge: coupons.length },
    { icon: '❤️', label: '찜 목록', path: '/my/wishlist', badge: 0 },
    { icon: '⭐', label: '리뷰 관리', path: '/my/reviews', badge: 0 },
    { icon: '🔔', label: '알림 설정', path: '/my/notifications', badge: 0 },
    { icon: '🔔', label: '채팅 알림음', action: () => setSoundSheetOpen(true), badge: 0 },
    { icon: '🏠', label: '배송지 관리', path: '/my/addresses' },
    { icon: '👤', label: '개인정보', path: '/my/profile', badge: 0 },
    { icon: '🔒', label: '보안 설정', path: '/my/security', badge: 0 },
    { icon: '📞', label: '고객센터', path: '/my/support', badge: 0 },
  ]

  const gradeOrder = ['PETAL', 'BLOOM', 'VELVET', 'LUMIÈRE', 'REINE', 'NOIR', 'CÉLESTE']
  const gradeThreshold = [0, 300000, 1000000, 3000000, 6000000, 10000000, 20000000]
  const g = gradeOrder.includes(grade) ? grade : 'PETAL'
  const gi = gradeOrder.indexOf(g)
  const nextG = gi >= 0 && gi < gradeOrder.length - 1 ? gradeOrder[gi + 1] : ''
  const curBase = gi >= 0 ? gradeThreshold[gi] : 0
  const nextBase = gi >= 0 && gi < gradeThreshold.length - 1 ? gradeThreshold[gi + 1] : gradeThreshold[gradeThreshold.length - 1]
  const remain = nextG ? Math.max(0, nextBase - point) : 0
  const prog = nextG ? Math.max(0, Math.min(100, ((point - curBase) / Math.max(1, nextBase - curBase)) * 100)) : 100
  const completionGuide =
    completion < 30
      ? '💜 프로필을 채우면 나만의 피부 주치의가 시작돼요'
      : completion < 60
        ? '🧴 피부타입과 라이프스타일을 알면 딱 맞는 제품을 추천해드려요'
        : completion < 80
          ? '🎁 생일·기념일을 등록하면 깜짝 선물과 특별 쿠폰이 준비돼요'
          : completion < 100
            ? '프로필을 완성할수록 맑원장의 추천이 나만을 위한 처방이 돼요 💜'
            : ''
  const incompleteHints = [
    !profileData?.skin_type ? '· 피부타입을 선택해주세요' : '',
    !profileData?.birth_date ? '· 생년월일을 입력해주세요' : '',
    !profileData?.phone ? '· 전화번호를 입력해주세요' : '',
    !profileData?.menstrual_cycle ? '· 생리 주기 정보를 입력해주세요' : '',
    !(profileData?.preferred_brands?.length > 0) ? '· 선호 브랜드를 선택해주세요' : '',
    !(profileData?.special_dates?.length > 0) ? '· 기념일을 1개 이상 등록해주세요' : '',
  ].filter(Boolean).slice(0, 2)
  const trackLabelMap: Record<string, string> = {
    general: '일반 주기',
    menopause_peri: '갱년기 진입',
    menopause_post: '폐경',
    pregnant: '임신',
    postpartum: '출산 후',
    male: '남성',
    male_menopause: '남성 갱년기',
  }
  const savePeriodStartedToday = async () => {
    if (!user?.id) return false
    const today = new Date().toISOString().slice(0, 10)
    const cycleLen = Math.max(21, Math.min(60, Number(hormoneCycle?.cycle_length || 28)))
    const next = new Date(today)
    next.setDate(next.getDate() + cycleLen)
    await supabase
      .from('hormone_cycle')
      .upsert(
        {
          auth_id: user.id,
          track: hormoneTrack,
          last_period_date: today,
          period_started_at: today,
          expected_period_date: next.toISOString().slice(0, 10),
          cycle_length: cycleLen,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'auth_id' }
      )
    const { error: dcErr } = await supabase
      .from('daily_checkin')
      .insert({ auth_id: user.id, checkin_date: today, period_started: true } as any)
    if (dcErr) {
      console.warn('[daily_checkin]', dcErr)
    } else {
      try {
        const { data: psRow } = await supabase.from('point_settings').select('points').eq('action', 'attendance').maybeSingle()
        const attPts = Math.max(0, Math.floor(Number((psRow as { points?: unknown } | null)?.points ?? 100)))
        const { data: uRow } = await supabase.from('users').select('id,points').eq('auth_id', user.id).maybeSingle()
        if (uRow?.id) {
          const nextPoints = (Number(uRow.points) || 0) + attPts
          const { error: upErr } = await supabase.from('users').update({ points: nextPoints }).eq('id', uRow.id)
          if (upErr) {
            console.warn('[users attendance points]', upErr)
          } else {
            const { error: ttErr } = await supabase.from('toast_transactions').insert({
              user_id: uRow.id,
              amount: attPts,
              transaction_type: 'attendance',
              source_type: 'checkin',
            } as any)
            if (ttErr) console.warn('[toast_transactions attendance]', ttErr)
          }
        }
      } catch (e) {
        console.warn('[attendance reward]', e)
      }
    }
    setPeriodQuietNotice('')
    setHormoneCycle((prev: any) => ({
      ...(prev || {}),
      auth_id: user.id,
      last_period_date: today,
      period_started_at: today,
      expected_period_date: next.toISOString().slice(0, 10),
      cycle_length: cycleLen,
      track: hormoneTrack,
    }))
    return true
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '0' }}>

      {/* 탑바 */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER, backdropFilter: 'blur(12px)' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 400, color: GOLD, letterSpacing: '6px' }}>AURAN</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/my/profile')} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', cursor: 'pointer' }}>⚙️</button>
        </div>
      </header>

      {/* 프로필 */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: `2px solid rgba(201,169,110,0.3)`, flexShrink: 0, overflow: 'hidden' }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="프로필"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid rgba(123,94,167,0.3)'
              }}
            />
          ) : (
            <span style={{ fontSize: '28px' }}>{gender === 'male' ? '👨' : '👩'}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: 400, marginBottom: '3px' }}>{userName}님</div>
          <div
            style={{
              display: 'inline-block',
              marginBottom: '4px',
              padding: '2px 9px',
              borderRadius: '999px',
              fontSize: '10px',
              fontFamily: 'monospace',
              background:
                g === 'CÉLESTE'
                  ? 'rgba(201,169,110,0.25)'
                  : g === 'NOIR'
                    ? 'rgba(255,255,255,0.08)'
                    : g === 'REINE'
                      ? 'rgba(201,169,110,0.15)'
                      : g === 'LUMIÈRE'
                        ? 'rgba(123,94,167,0.2)'
                        : g === 'VELVET'
                          ? 'rgba(80,120,220,0.15)'
                          : g === 'BLOOM'
                            ? 'rgba(80,180,80,0.15)'
                            : 'rgba(180,180,180,0.15)',
              color:
                g === 'CÉLESTE'
                  ? '#C9A96E'
                  : g === 'NOIR'
                    ? '#fff'
                    : g === 'REINE'
                      ? '#C9A96E'
                      : g === 'LUMIÈRE'
                        ? '#9b7ec8'
                        : g === 'VELVET'
                          ? '#7090dd'
                          : g === 'BLOOM'
                            ? '#6dba6d'
                            : '#aaa',
              border:
                g === 'CÉLESTE'
                  ? '1px solid rgba(201,169,110,0.4)'
                  : g === 'NOIR'
                    ? '1px solid rgba(255,255,255,0.2)'
                    : 'none',
            }}
          >
            {g}
          </div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, fontFamily: 'monospace' }}>{user?.email}</div>
          <div onClick={() => router.push('/myworld')} style={{ display: 'inline-block', marginTop: '6px', padding: '3px 10px', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '20px', fontSize: '10px', color: GOLD, cursor: 'pointer' }}>🌍 MY WORLD 보기 ›</div>
        </div>
        <div onClick={() => router.push('/my/profile')} style={{ fontSize: '11px', color: TEXT_DIM, cursor: 'pointer' }}>편집 ›</div>
      </div>
      {isPeriodTrack(hormoneTrack) && gender !== 'male' ? (
        <div style={{ margin: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={async () => {
              await savePeriodStartedToday()
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid rgba(123,94,167,0.42)',
              background: 'rgba(123,94,167,0.2)',
              color: '#e8d9ff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            생리 시작했어요
          </button>
          {periodTipEnabled ? (
          <button
            type="button"
            onClick={() => setPeriodTipOpen(true)}
            style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
          >
            ?
          </button>
          ) : null}
          {periodQuietNotice ? <span style={{ fontSize: 11, color: 'rgba(255,220,180,0.9)' }}>{periodQuietNotice}</span> : null}
        </div>
      ) : null}

      <div style={{ margin: '10px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: '12px 14px' }}>
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>내 피부 트랙</div>
        <div style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>{trackLabelMap[hormoneTrack] || hormoneTrack || '미설정'}</div>
        <button
          type="button"
          onClick={() => router.push('/signup?mode=track')}
          style={{ border: '1px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.2)', color: '#e8d9ff', borderRadius: 999, padding: '6px 11px', fontSize: 11, cursor: 'pointer' }}
        >
          변경하기
        </button>
      </div>

      {completion < 100 ? (
        <div onClick={() => router.push('/my/profile')} style={{ margin: '10px 16px 0', background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.25)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>프로필 완성도 {completion}%</div>
            <div style={{ fontSize: 11, color: GOLD }}>{completion <= 30
                ? '아직 맑원장이 나를 잘 몰라요 🌱 조금만 알려주세요'
                : completion <= 59
                  ? '절반 왔어요! 입력할수록 추천이 정교해져요 ✨'
                  : completion <= 79
                    ? '거의 다 왔어요 💜 조금만 더하면 맞춤 케어 시작돼요'
                    : '포기하지 마요! 완성하면 호르몬 주기까지 분석해드려요 🌙'}</div>
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ width: `${completion}%`, height: 6, borderRadius: 3, background: '#7B5EA7' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#b79ce8' }}>{completionGuide}</div>
          {incompleteHints.map((hint, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 6 : 2, fontSize: 10, color: 'rgba(123,94,167,0.8)' }}>
              {hint}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ margin: '10px 16px 0', background: 'rgba(123,94,167,0.12)', border: '1px solid #7B5EA7', borderRadius: 14, padding: '14px 16px', fontSize: 12, color: '#c7b0ea' }}>
          ✅ 프로필 완성! 맞춤 추천이 활성화됐어요 💜
        </div>
      )}

      {skinMonthlyReport ? (
        <div style={{ margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>이번 달 피부 리포트</div>
          <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.55 }}>
            {(() => {
              const golden = Number(skinMonthlyReport.hormone_pattern?.['여포기'] || 0)
              const cs = skinMonthlyReport.checkin_summary || {}
              const top = Object.entries(cs).sort((a, b) => Number(b[1]) - Number(a[1]))[0] as [string, number] | undefined
              if (top && top[0])
                return `지난달 황금기에 ${userName}님은 ${top[0]} 체크인을 ${top[1]}번 기록했어요 (여포기 ${golden}일)`
              return `지난달 피부 리포트가 준비됐어요 (${String(skinMonthlyReport.report_month || '')})`
            })()}
          </div>
          <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 8 }}>
            구매 합계 ₩{Number(skinMonthlyReport.purchase_summary?.total_amount || 0).toLocaleString()} · 피부사진 기록{' '}
            {Number(skinMonthlyReport.skin_changes?.photo_count ?? 0)}건
          </div>
        </div>
      ) : null}

      {/* AURAN POINT */}
      <div style={{ margin: '14px 16px 0', background: 'rgba(123,94,167,0.12)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: '18px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(196,167,231,0.7)' }}>🍞 토스트 P</div>
            <div style={{ fontSize: '22px', color: '#c4a7e7' }}>{point.toLocaleString()}T</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(196,167,231,0.7)' }}>💳 AURAN PAY</div>
            <div style={{ fontSize: '22px', color: '#9b7ec8' }}>₩{chargeBalance.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 12 }}>
          <button
            onClick={() => router.push('/wallet')}
            style={{ background: 'rgba(123,94,167,0.3)', border: '1px solid rgba(123,94,167,0.5)', color: '#c4a7e7', borderRadius: '10px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', flex: 1, textAlign: 'center', justifyContent: 'center' }}
          >
            충전하기
          </button>
          <button
            onClick={() => router.push('/my/point')}
            style={{ background: 'transparent', border: '1px solid rgba(196,167,231,0.2)', color: 'rgba(196,167,231,0.6)', borderRadius: '10px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', flex: 1, textAlign: 'center', justifyContent: 'center' }}
          >
            사용내역
          </button>
        </div>
        {expiringPoint > 0 ? (
          <div style={{ marginTop: 8, fontSize: '10px', color: 'rgba(255,180,80,0.8)' }}>
            ⚠️ {expiringPoint.toLocaleString()} P 12월 31일 소멸 예정
          </div>
        ) : null}
      </div>

      {pointHistory.length > 0 ? (
        <div style={{ margin: '10px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
          {pointHistory.map((h, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: i === 0 ? '0 0 8px' : '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: '12px' }}>{h.description || '내역'}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                  {h.created_at ? `${String(new Date(h.created_at).getMonth() + 1).padStart(2, '0')}.${String(new Date(h.created_at).getDate()).padStart(2, '0')}` : ''}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: Number(h.amount) > 0 ? '#6dba6d' : 'rgba(220,80,80,0.8)' }}>
                {Number(h.amount) > 0 ? `+${Number(h.amount).toLocaleString()}P` : `${Number(h.amount).toLocaleString()}P`}
              </div>
            </div>
          ))}
          <div onClick={() => router.push('/my/point')} style={{ marginTop: 8, fontSize: '11px', color: '#7B5EA7', cursor: 'pointer' }}>
            전체 내역 보기 →
          </div>
        </div>
      ) : null}

      {/* 소진 알림 */}
      <div style={{ margin: '12px 16px 0', background: 'rgba(220,100,40,0.08)', border: '1px solid rgba(220,120,60,0.2)', borderRadius: '16px', padding: '14px 16px' }}>
        {recentOrdersForRefill.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🛍️</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>아직 구매한 제품이 없어요</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>나에게 맞는 제품을 찾아보세요</div>
            <div onClick={() => router.push('/products')} style={{ color: '#7B5EA7', fontSize: 11, marginTop: 10, cursor: 'pointer' }}>[제품 보러가기 →]</div>
          </div>
        ) : (
          <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(220,150,80,0.9)' }}>🔔 이 제품들 곧 떨어져요!</span>
            <span onClick={() => router.push('/my/profile#notify')} style={{ fontSize: '10px', color: 'rgba(201,169,110,0.7)', cursor: 'pointer' }}>자동알림 설정 ›</span>
          </div>
          {refills.map((item, i) => (
            <div key={`${item.order_id}-${item.product_id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i < refills.length - 1 ? '10px' : 0 }}>
              <span style={{ fontSize: '22px' }}>{item.status === '배송중' ? '🚚' : item.status === '주문확인' || item.status === '발송준비' ? '📦' : '🧴'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 400, marginBottom: '3px' }}>{item.name}</div>
                {item.status === '주문확인' || item.status === '발송준비' ? (
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>제품을 준비 중이에요</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.name}</div>
                  </div>
                ) : item.status === '배송중' ? (
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>곧 도착해요!</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>도착하면 사용 시작 버튼이 생겨요</div>
                  </div>
                ) : !item.started_at ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>배송완료</span>
                    <button
                      onClick={async () => {
                        if (!user?.id) return
                        const startedAt = new Date().toISOString()
                        await supabase.from('product_usage_tracking').insert({
                          user_id: user.id,
                          product_id: item.product_id,
                          order_id: item.order_id,
                          started_at: startedAt,
                          avg_usage_days: item.avg_usage_days,
                        })
                        setRefills((prev) => prev.map((r) => (r.order_id === item.order_id && r.product_id === item.product_id ? { ...r, started_at: startedAt } : r)))
                      }}
                      style={{ padding: '5px 10px', background: 'rgba(123,94,167,0.16)', border: '1px solid rgba(123,94,167,0.35)', borderRadius: '8px', fontSize: '10px', color: '#b79ce8', cursor: 'pointer' }}
                    >
                      사용 시작 🧴
                    </button>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const start = new Date(item.started_at)
                      const now = new Date()
                      const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                      const pct = Math.min(Math.round((elapsed / Math.max(1, Number(item.avg_usage_days || 60))) * 100), 100)
                      const remaining = Math.max(Number(item.avg_usage_days || 60) - elapsed, 0)
                      const barColor = pct < 50 ? '#7B5EA7' : pct < 80 ? '#C9A96E' : pct < 100 ? '#E07830' : '#C9A96E'
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{pct}%</span>
                          </div>
                          {pct < 50 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>D-{remaining}일 남았어요</div> : null}
                          {pct >= 50 && pct < 80 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>절반 넘게 사용하셨어요</div> : null}
                          {pct >= 50 && pct < 80 ? <div style={{ fontSize: 10, color: 'rgba(201,169,110,0.9)', marginTop: 2 }}>슬슬 다음 {item.name} 준비할 때예요 💜</div> : null}
                          {pct >= 80 && pct < 100 ? <div style={{ fontSize: 11, color: '#E07830', marginTop: 4 }}>거의 다 쓰셨어요! D-{remaining}일</div> : null}
                          {pct >= 80 && pct < 100 ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>오늘 주문하면 딱 맞게 도착해요</div> : null}
                          {pct >= 100 ? <div style={{ fontSize: 11, color: '#C9A96E', marginTop: 4 }}>다 쓰셨나요? 피부가 기다리고 있어요 🧴</div> : null}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              {item.started_at && item.status !== '주문확인' && item.status !== '발송준비' && item.status !== '배송중' ? (
                <div
                  onClick={() => router.push(`/products/${item.product_id}`)}
                  style={{
                    padding: '5px 10px',
                    background: 'rgba(220,150,60,0.15)',
                    border:
                      (() => {
                        const start = new Date(item.started_at)
                        const now = new Date()
                        const elapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                        const pct = Math.min(Math.round((elapsed / Math.max(1, Number(item.avg_usage_days || 60))) * 100), 100)
                        if (pct >= 100) return '1px solid #C9A96E'
                        if (pct >= 80) return '1px solid #E07830'
                        return '1px solid rgba(220,150,60,0.3)'
                      })(),
                    borderRadius: '8px',
                    fontSize: '10px',
                    color: '#E09040',
                    cursor: 'pointer',
                  }}
                >
                  재구매
                </div>
              ) : null}
            </div>
          ))}
          </>
        )}
      </div>

      {/* 구매 히스토리 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>📋 구매 히스토리</span>
          <span onClick={() => router.push('/my/orders')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체보기 ›</span>
        </div>
        {orders.some((o: any) => o.status === '배송중') ? (
          <div style={{ marginBottom: 10 }}>
            {orders
              .filter((o: any) => o.status === '배송중')
              .map((order: any) => {
                const trk = String(order.tracking_no || '').trim()
                const cr = String(order.courier || '').trim()
                let href = ''
                if (trk) {
                  if (cr.includes('CJ') || cr.includes('대한통운')) href = `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trk)}`
                  else if (cr.includes('한진')) href = `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trk)}`
                  else if (cr.includes('롯데')) href = `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trk)}`
                  else if (cr.includes('우체국')) href = `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trk)}`
                  else if (cr.includes('로젠')) href = `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trk)}`
                  else href = `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trk)}`
                }
                return (
                  <div key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, padding: '8px 10px', background: CARD_BG, border: CARD_BORDER, borderRadius: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          let names: string[] = []
                          const itemsRaw = order.items
                          if (Array.isArray(itemsRaw)) {
                            names = itemsRaw
                              .map((it: any) => String(it?.name || it?.product_name || '').trim())
                              .filter(Boolean)
                          } else if (typeof itemsRaw === 'string') {
                            try {
                              const parsed = JSON.parse(itemsRaw)
                              if (Array.isArray(parsed)) {
                                names = parsed
                                  .map((it: any) => String(it?.name || it?.product_name || '').trim())
                                  .filter(Boolean)
                              }
                            } catch {
                              names = []
                            }
                          }
                          if (names.length === 0 && Array.isArray(order.order_items)) {
                            names = order.order_items
                              .map((oi: any) => String(oi?.products?.name || '').trim())
                              .filter(Boolean)
                          }
                          if (names.length === 0) return order.order_no || '주문'
                          return names.length > 1 ? `${names[0]} 외 ${names.length - 1}개` : names[0]
                        })()}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 2 }}>
                        {order.order_no || '-'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                          {order.created_at ? new Date(order.created_at).toLocaleDateString('ko-KR') : '-'}
                        </span>
                        <span style={{ fontSize: 9, color: '#7B5EA7', border: '1px solid rgba(123,94,167,0.35)', borderRadius: 999, padding: '1px 6px' }}>
                          {order.status || '주문확인'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#C9A96E' }}>
                        {(Number(order.final_amount || order.total_amount || 0)).toLocaleString()}원
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!trk}
                      onClick={() => {
                        if (!trk) return
                        window.open(href, '_blank', 'noopener,noreferrer')
                      }}
                      style={{
                        padding: '6px 10px',
                        fontSize: 9,
                        borderRadius: 8,
                        border: '1px solid #7B5EA7',
                        color: '#7B5EA7',
                        background: 'transparent',
                        cursor: trk ? 'pointer' : 'not-allowed',
                        opacity: trk ? 1 : 0.5,
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      🚚 배송조회
                    </button>
                  </div>
                )
              })}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
          {(() => {
            const historyItems: { productId: string; name: string; thumb: string; brand: string; date: string }[] = []
            const seen = new Set<string>()
            for (const order of orders) {
              const dateStr = order.created_at ? String(order.created_at).slice(5, 10).replace('-', '.') : ''
              for (const oi of order.order_items || []) {
                const p = oi.products
                if (!p?.id || seen.has(String(p.id))) continue
                seen.add(String(p.id))
                historyItems.push({
                  productId: String(p.id),
                  name: p.name || '제품',
                  thumb: p.storage_thumb_url || p.thumb_img || '',
                  brand: (p.brands as { name?: string } | null)?.name || '',
                  date: dateStr,
                })
                if (historyItems.length >= 4) break
              }
              if (historyItems.length >= 4) break
            }
            if (historyItems.length === 0) {
              return <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '8px 0' }}>최근 구매 내역이 없어요</div>
            }
            return historyItems.map((item) => (
              <div key={item.productId} style={{ minWidth: '110px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ height: '70px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', position: 'relative', overflow: 'hidden' }}>
                  {item.thumb ? (
                    <img src={item.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>🧴</span>
                  )}
                  <span style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '8px', fontFamily: 'monospace', color: TEXT_DIM }}>{item.date}</span>
                </div>
                <div style={{ padding: '7px 8px' }}>
                  <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '1px' }}>{item.brand || '—'}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>{item.name}</div>
                  <div onClick={() => router.push(`/products/${item.productId}`)} style={{ width: '100%', padding: '4px 0', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '6px', fontSize: '9px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>🔄 재구매</div>
                </div>
              </div>
            ))
          })()}
        </div>
      </div>

      {/* BEAUTY TRACKER */}
      <div style={{ margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '18px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_MUTED }}>BEAUTY TRACKER</span>
          <span style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace' }}>
            {new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { icon: '💧', val: `${tracker.water}`, unit: '/8', label: '수분 섭취', pct: (tracker.water / 8) * 100, color: '#6ab0e0' },
            { icon: '🌞', val: `UV`, unit: `${tracker.uv}`, label: '자외선', pct: tracker.uv * 20, color: '#f0c040' },
            { icon: '😴', val: `${tracker.sleep}`, unit: 'h', label: '수면', pct: (tracker.sleep / 10) * 100, color: '#a080e0' },
            { icon: '🧴', val: `${tracker.routine}`, unit: '%', label: '루틴', pct: tracker.routine, color: GOLD },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 400 }}>{item.val}<span style={{ fontSize: '9px', fontWeight: 300 }}>{item.unit}</span></span>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>{item.label}</span>
              <div style={{ width: '100%', height: '2px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', fontSize: '9px', color: TEXT_DIM, textAlign: 'center' }}>
          {/* TODO: user_daily_tracker 테이블 연동 */}
          탭하여 오늘 기록 업데이트
        </div>
      </div>

      {/* 일촌 피드 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>👥 일촌들의 추천</span>
          <span onClick={() => router.push('/myworld')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>MY WORLD ›</span>
        </div>
        {friendFeed.length > 0 ? (
          <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🌺</div>
              <div style={{ flex: 1, fontSize: '11px', fontWeight: 400 }}>{String(friendFeed[0]?.friend_name || friendFeed[0]?.name || '일촌')}</div>
              <span style={{ fontSize: '9px', color: TEXT_DIM }}>방금</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🧴</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, flex: 1 }}>
                {String(friendFeed[0]?.message || friendFeed[0]?.content || '일촌 추천이 도착했어요 💜')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1, padding: '6px 0', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', borderRadius: '8px', fontSize: '10px', color: 'rgba(255,120,120,0.8)', textAlign: 'center', cursor: 'pointer' }}>❤️ 공감</div>
              <div onClick={() => router.push('/products')} style={{ flex: 1, padding: '6px 0', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px', fontSize: '10px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>나도 구매</div>
              <div style={{ flex: 1, padding: '6px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '8px', fontSize: '10px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>공유</div>
            </div>
          </div>
        ) : (
          <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💜</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>아직 일촌이 없어요</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-line', marginTop: 6 }}>
              {'마이월드에서 일촌을 맺으면\n친구들의 추천이 여기에 떠요 ✨'}
            </div>
            <button
              onClick={() => router.push('/myworld')}
              style={{ background: 'transparent', border: '1px solid rgba(123,94,167,0.3)', color: '#7B5EA7', borderRadius: 10, padding: '8px 20px', fontSize: 11, marginTop: 12, cursor: 'pointer' }}
            >
              마이월드 가기 →
            </button>
          </div>
        )}
      </div>

      {/* 메뉴 리스트 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', overflow: 'hidden' }}>
          {menuItems.map((item, i) => (
            <div
              key={i}
              onClick={() => {
                const it = item as { path?: string; action?: () => void }
                if (typeof it.action === 'function') {
                  it.action()
                  return
                }
                if (it.path) router.push(it.path)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: i < menuItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{item.label}</span>
              {(item.badge ?? 0) > 0 && (
                <div style={{ background: GOLD, borderRadius: '10px', padding: '2px 7px', fontSize: '10px', color: BG, fontWeight: 400 }}>{item.badge}</div>
              )}
              <span style={{ fontSize: '14px', color: TEXT_DIM }}>›</span>
            </div>
          ))}
        </div>
      </div>

      {/* 로그아웃 */}
      <div style={{ padding: '12px 16px 0' }}>
        <div onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ padding: '13px', background: 'rgba(220,60,60,0.06)', border: '1px solid rgba(220,60,60,0.15)', borderRadius: '12px', fontSize: '13px', color: 'rgba(220,100,100,0.8)', textAlign: 'center', cursor: 'pointer' }}>
          로그아웃
        </div>
      </div>
      {periodTipOpen ? (
        <>
          <div onClick={() => setPeriodTipOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 120 }} />
          <div style={{ position: 'fixed', left: 16, right: 16, bottom: 96, maxWidth: 360, margin: '0 auto', background: '#1f1a26', border: '1px solid rgba(123,94,167,0.35)', borderRadius: 14, padding: 14, zIndex: 121 }}>
            <div style={{ fontSize: 12, color: '#e8d9ff', marginBottom: 6 }}>생리 시작 기록</div>
            <div style={{ fontSize: 12, color: '#e8d9ff', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              오늘 생리가 시작됐다면 아래 버튼을 눌러주세요.
              {'\n'}피부는 생리 주기에 따라 매주 달라져요.
              {'\n'}기록하면 AURAN이 오늘 딱 맞는 케어를 먼저 알려드려요 💜
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await savePeriodStartedToday()
                if (ok) setPeriodTipOpen(false)
              }}
              style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(201,169,110,0.45)', background: 'rgba(201,169,110,0.2)', color: '#f1e0b7', fontSize: 12, cursor: 'pointer' }}
            >
              ✓ 오늘 생리 시작했어요
            </button>
            <button type="button" onClick={() => setPeriodTipOpen(false)} style={{ marginTop: 10, width: '100%', padding: 10, borderRadius: 10, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 12, cursor: 'pointer' }}>확인</button>
          </div>
        </>
      ) : null}

      {soundSheetOpen && (
        <>
          <div
            onClick={() => setSoundSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#1a1625',
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px 40px',
              zIndex: 101,
            }}
          >
            <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 3, fontFamily: 'monospace', marginBottom: 16 }}>채팅 알림음 선택</div>
            {[
              { id: 'violet', emoji: '💜', label: 'Violet Chime', desc: '부드럽고 신비로운' },
              { id: 'toast', emoji: '🍞', label: 'Toast Pop', desc: '밝고 경쾌한' },
              { id: 'luxury', emoji: '✨', label: 'Gold Tone', desc: '고급스러운 단음' },
              { id: 'magic', emoji: '🌸', label: 'Magic Sparkle', desc: '반짝이는 톤' },
              { id: 'aube', emoji: '🌙', label: 'Aube Whisper', desc: '은은한 새벽 느낌' },
            ].map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setNotifSound(s.id)
                  setSoundSheetOpen(false)
                  if (user?.id) {
                    supabase.from('profiles').update({ notification_sound: s.id } as any).eq('auth_id', user.id)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  marginBottom: 8,
                  cursor: 'pointer',
                  background: notifSound === s.id ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${notifSound === s.id ? '#7B5EA7' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#fff' }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.desc}</div>
                </div>
                {notifSound === s.id ? <span style={{ fontSize: 10, color: '#7B5EA7' }}>선택됨 ✓</span> : null}
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  )
}
