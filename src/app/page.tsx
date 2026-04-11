'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useCart } from '@/context/CartContext'
import { TOOLTIP_FALLBACKS, calcHormoneBriefing, isPeriodTrack } from '@/lib/hormoneUtils'
import { logUserBehavior, upsertSkinCycleDaily } from '@/lib/skinAnalytics'
import NoticePanel from '@/components/NoticePanel'
import Loading from './loading'
import SkinDiarySheet from '@/components/skin-diary/SkinDiarySheet'

const getSeoulToday = () => {
  const s = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return s
}

/** 서버·클라이언트 첫 페인트를 맞춰 getSeoulToday() 기반 렌더로 인한 hydration mismatch를 막음 */
const HYDRATION_PLACEHOLDER_SEOUL = new Date('2026-01-01T12:00:00+09:00')

/** 로컬 TZ와 무관하게 Asia/Seoul 기준 연·월(0~11)·일 */
function seoulYmdFromDate(d: Date): { y: number; m0: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  let y = 2026
  let m0 = 0
  let day = 1
  for (const p of parts) {
    if (p.type === 'year') y = Number(p.value)
    if (p.type === 'month') m0 = Number(p.value) - 1
    if (p.type === 'day') day = Number(p.value)
  }
  return { y, m0, d: day }
}

/** seoulClient 없는 첫 페인트에서는 Intl을 쓰지 않아 서버·브라우저 ICU 차이로 인한 hydration mismatch 방지 */
function seoulYmdForHydrationSafeCalendar(seoulClient: Date | null): { y: number; m0: number; d: number } {
  if (seoulClient == null) return { y: 2026, m0: 0, d: 1 }
  return seoulYmdFromDate(seoulClient)
}

/** 해당 서울 달력일 정오(+09:00) 시각의 UTC ms — 요일·일수 계산을 TZ 일치시키기 위함 */
function seoulNoonUtcMs(y: number, m0: number, day: number): number {
  return Date.parse(`${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+09:00`)
}

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

const SKIN_TOOLTIP_MSGS = [
  '오늘 내 피부 날씨 알아볼까요? 💜',
  '오늘 하늘이 내 피부에 뭐라고 하는지 볼게요 🌸',
  '오늘 피부가 뭘 원하는지 살짝 들여다볼까요? ✨',
  '날씨가 내 피부한테 하고 싶은 말이 있대요 💌',
  '오늘 피부 비서가 준비한 케어 정보예요 👑',
  '눌러보세요, 오늘 피부가 좋아하는 날씨인지 알려드릴게요 🌿',
]

const CARE_CHEER_MSGS = [
  '오늘 피부 관리 잊지 않으셨죠? 💜',
  '세안하고 크림 발랐어요? 피부가 기다려요 🌸',
  '오늘 내 피부한테 5분만 써줄래요? 💎',
  '크림 한 번이 주름 하나를 늦춰요 👑',
  '오늘도 피부 밥 챙겨줬어요? 🍱',
  '세럼 안 바르면 피부가 섭섭해해요 🥺',
  '선크림은 오늘의 피부 보험이에요 ☂️',
  '잠들기 전 크림 한 번, 내일이 달라져요 🌙',
]

// 폴백 데이터 (Supabase 연동 전)
const FALLBACK_CONCERNS = [
  { id: 1, name: '수분부족', icon: '💧' },
  { id: 2, name: '미백·톤업', icon: '✨' },
  { id: 3, name: '모공·각질', icon: '🔍' },
  { id: 4, name: '민감·진정', icon: '🌿' },
  { id: 5, name: '안티에이징', icon: '⏰' },
  { id: 6, name: '자외선차단', icon: '☀️' },
  { id: 7, name: '탄력·리프팅', icon: '💆' },
]

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'MESS CREAM 50ml', brand: 'CIVASAN', price: 58000, badge: 'AI추천', icon: '🧴' },
  { id: 2, name: '바이오 에센스 세럼', brand: 'GERNETIC', price: 94000, badge: '인기', icon: '🌿' },
  { id: 3, name: '딥클렌징 폼', brand: 'SHOPBELLE', price: 32000, badge: '', icon: '🫧' },
  { id: 4, name: '크리스토 바스솔트', brand: 'THALAC', price: 45000, badge: '', icon: '🌊' },
]

const FALLBACK_SALES = [
  { id: 1, name: 'MESS CREAM 50ml', brand: 'CIVASAN', orig: 58000, sale: 40600, disc: 30, icon: '🧴' },
  { id: 2, name: '바이오 에센스 세럼', brand: 'GERNETIC', orig: 94000, sale: 70500, disc: 25, icon: '🌿' },
  { id: 3, name: '크리스토 마린 바스솔트', brand: 'THALAC', orig: 45000, sale: 36000, disc: 20, icon: '🌊' },
]

const FALLBACK_SALONS = [
  { id: 1, name: '더하노이 풋앤바디', rating: 4.9, reviews: 127, area: '대구 달서구', dist: '0.3km', open: true, tags: ['페이셜', '바디', '아로마'] },
  { id: 2, name: '뷰티클리닉 대구점', rating: 4.7, reviews: 89, area: '대구 수성구', dist: '1.2km', open: true, tags: ['리프팅', '클리닉'] },
  { id: 3, name: '스킨에스테틱', rating: 4.5, reviews: 54, area: '대구 중구', dist: '2.1km', open: false, tags: ['피부관리', '민감성'] },
]

const FALLBACK_NEW = [
  { id: 1, name: '퍼펙트 나이트 크림', brand: 'CIVASAN', price: 68000, icon: '💜' },
  { id: 2, name: '칼밍 에센스 미스트', brand: 'GERNETIC', price: 52000, icon: '🩵' },
  { id: 3, name: '로즈 토닝 패드', brand: 'SHOPBELLE', price: 38000, icon: '🌸' },
  { id: 4, name: '마린 리페어 앰플', brand: 'THALAC', price: 84000, icon: '🌊' },
]

const FALLBACK_BRANDS = [
  { id: 1, name: 'CIVASAN', label: '시바산', color: '#C9A96E', bg: 'rgba(201,169,110,0.1)', border: 'rgba(201,169,110,0.3)' },
  { id: 2, name: 'GERNETIC', label: '제르네틱', color: 'rgba(120,180,240,0.9)', bg: 'rgba(100,160,220,0.1)', border: 'rgba(100,160,220,0.25)' },
  { id: 3, name: 'SHOPBELLE', label: '샵벨르', color: 'rgba(200,150,220,0.9)', bg: 'rgba(180,120,200,0.1)', border: 'rgba(180,120,200,0.25)' },
  { id: 4, name: 'THALAC', label: '탈락', color: 'rgba(80,190,210,0.9)', bg: 'rgba(60,160,180,0.1)', border: 'rgba(60,160,180,0.25)' },
  { id: 5, name: 'SOTHYS', label: '소티스', color: 'rgba(240,180,100,0.9)', bg: 'rgba(220,160,80,0.1)', border: 'rgba(220,160,80,0.25)' },
  { id: 6, name: 'PHYTO', label: '피토머', color: 'rgba(180,220,140,0.9)', bg: 'rgba(160,200,120,0.1)', border: 'rgba(160,200,120,0.25)' },
  { id: 7, name: 'ESTER', label: '에스터', color: 'rgba(240,120,140,0.9)', bg: 'rgba(220,100,120,0.1)', border: 'rgba(220,100,120,0.25)' },
]

const FALLBACK_HISTORY = [
  { icon: '🧴', date: '03.01', brand: 'CIVASAN', name: 'MESS CREAM' },
  { icon: '🌿', date: '02.15', brand: 'GERNETIC', name: '바이오 세럼' },
  { icon: '🫧', date: '02.01', brand: 'SHOPBELLE', name: '딥클렌징 폼' },
  { icon: '🌊', date: '01.20', brand: 'THALAC', name: '바스솔트' },
]

const HORMONE_PHASE_TIP_ROWS: [string, string][] = [
  ['황금기', '피부 컨디션이 최고인 시기예요! 영양 케어하기 딱 좋아요'],
  ['민감기', '피부가 예민해지는 시기예요. 자극 없는 진정 케어가 필요해요'],
  ['배란기', '호르몬이 최고조예요! 피부가 가장 빛나는 황금기예요 🌟'],
  ['여포기', '생리 끝나고 회복되는 시기예요. 피부가 서서히 맑아져요'],
  ['황체기', '생리 전 시기예요. 트러블이 생기기 쉽고 피부가 칙칙해질 수 있어요'],
  ['생리기', '생리 중인 시기예요. 피부가 예민하고 붓기 쉬워요'],
]

const CHECKIN_CYCLE_MENOPAUSE = [
  { id: 'cycle-type-m-0', emoji: '', label: '열감', sort_order: 0, is_active: true },
  { id: 'cycle-type-m-1', emoji: '', label: '수면', sort_order: 1, is_active: true },
  { id: 'cycle-type-m-2', emoji: '', label: '감정기복', sort_order: 2, is_active: true },
  { id: 'cycle-type-m-3', emoji: '', label: '관절', sort_order: 3, is_active: true },
  { id: 'cycle-type-m-4', emoji: '', label: '컨디션', sort_order: 4, is_active: true },
]
const CHECKIN_CYCLE_PREGNANCY = [
  { id: 'cycle-type-p-0', emoji: '', label: '트러블', sort_order: 0, is_active: true },
  { id: 'cycle-type-p-1', emoji: '', label: '붓기', sort_order: 1, is_active: true },
  { id: 'cycle-type-p-2', emoji: '', label: '건조', sort_order: 2, is_active: true },
  { id: 'cycle-type-p-3', emoji: '', label: '민감', sort_order: 3, is_active: true },
  { id: 'cycle-type-p-4', emoji: '', label: '컨디션', sort_order: 4, is_active: true },
]

export default function CustomerHomePage() {
  const router = useRouter()
  const supabase = createClient()
  const cart = useCart()
  const routineMoreRef = useRef<HTMLDivElement | null>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [userName, setUserName] = useState('')
  const [selectedConcern, setSelectedConcern] = useState(0)
  const [saleTab, setSaleTab] = useState<'sale' | 'group'>('group')
  const [timers, setTimers] = useState([
    { h: 2, m: 34, s: 21 },
    { h: 0, m: 47, s: 55 },
    { h: 5, m: 12, s: 8 },
  ])
  const [groupTimers, setGroupTimers] = useState<{ h: number; m: number; s: number }[]>([])

  // Supabase 데이터
  const [concerns, setConcerns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [seasonRecs, setSeasonRecs] = useState<any[]>([])
  const [weather, setWeather] = useState<any>(null)
  const [showWeatherDetail, setShowWeatherDetail] = useState(false)
  const [showSkinDiary, setShowSkinDiary] = useState(false)
  const [showWeatherRec, setShowWeatherRec] = useState(false)
  const [cardExpanded, setCardExpanded] = useState(false)
  const [consultType, setConsultType] = useState<string | null>(null)
  const [skinTooltipMsg, setSkinTooltipMsg] = useState('')
  const [timeSales, setTimeSales] = useState<any[]>([])
  const [groupBuys, setGroupBuys] = useState<any[]>([])
  const [salons, setSalons] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])
  const [dataReady, setDataReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [motivationProfile, setMotivationProfile] = useState<any>(null)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [profileCycleType, setProfileCycleType] = useState<string | null>(null)
  const [profileCreatedAt, setProfileCreatedAt] = useState<string | null>(null)
  const [myRoles, setMyRoles] = useState<string[]>(['customer'])
  const [activeRole, setActiveRole] = useState<string>('customer')
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false)
  const [motivationIdx, setMotivationIdx] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [homeContestBanner, setHomeContestBanner] = useState<any>(null)
  const [checkInTab, setCheckInTab] = useState<string | null>(null)
  const [checkinOptions, setCheckinOptions] = useState<any[]>([])
  const [routineSteps, setRoutineSteps] = useState<any[]>([])
  const [hormoneMainLine, setHormoneMainLine] = useState('')
  const [hormoneSubLine, setHormoneSubLine] = useState('오늘의 피부 사이클')
  const [hormonePhaseTipOpen, setHormonePhaseTipOpen] = useState(false)
  const [careBannerLine, setCareBannerLine] = useState('오늘은 미백앰플 집중투입 타이밍이에요 →')
  const [hormoneTrack, setHormoneTrack] = useState<string>('general')
  const [hormoneCycle, setHormoneCycle] = useState<any>(null)
  const [periodTipText, setPeriodTipText] = useState(TOOLTIP_FALLBACKS.period_start)
  const [periodTipTitle, setPeriodTipTitle] = useState('생리 시작 안내')
  const [periodTipEnabled, setPeriodTipEnabled] = useState(true)
  const [periodQuietNotice, setPeriodQuietNotice] = useState('')
  const [categoryBanners, setCategoryBanners] = useState<any[]>([])
  const [dailyQuestion, setDailyQuestion] = useState<any>(null)
  const [questionPopup, setQuestionPopup] = useState<any | null>(null)
  const [questionAnswer, setQuestionAnswer] = useState('')
  const [questionOptions, setQuestionOptions] = useState<string[]>([])
  const [routineExpanded, setRoutineExpanded] = useState(false)
  const [routineMentorOpen, setRoutineMentorOpen] = useState(false)
  const [routineStepPick, setRoutineStepPick] = useState<Record<string, boolean>>({})
  const [homeToast, setHomeToast] = useState('')
  const [seoulClient, setSeoulClient] = useState<Date | null>(() => {
    if (typeof window === 'undefined') return null
    return getSeoulToday()
  })
  const [todayLocaleLabel, setTodayLocaleLabel] = useState('')
  const [routineTimeSlot, setRoutineTimeSlot] = useState<'am' | 'midday' | 'pm'>(() => {
    if (typeof window === 'undefined') return 'am'
    const h = new Date().getHours()
    return h < 11 ? 'am' : h < 15 ? 'midday' : 'pm'
  })
  useEffect(() => {
    const s = getSeoulToday()
    setSeoulClient(s)
    setTodayLocaleLabel(
      s.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    )
    const seoulHour = s.getHours()
    setRoutineTimeSlot(seoulHour < 11 ? 'am' : seoulHour < 15 ? 'midday' : 'pm')
  }, [])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [homeEditMode, setHomeEditMode] = useState(false)
  const [homeEditSheet, setHomeEditSheet] = useState<{
    kind: 'checkin' | 'routine' | 'hormone_main' | 'hormone_sub' | 'care_banner' | 'product_card' | 'timesale' | 'notice_row'
    id?: string
    label: string
    draft: string
    draft2?: string
    draft3?: string
    draft4?: string
    draftNum?: number
    draftBool?: boolean
    extra?: any
  } | null>(null)
  const [homeEditSaving, setHomeEditSaving] = useState(false)
  const [sheetFields, setSheetFields] = useState({ d: '', d2: '', d3: '', d4: '', n: 0, b: true })

  useEffect(() => {
    if (!homeEditSheet) return
    setSheetFields({
      d: homeEditSheet.draft,
      d2: homeEditSheet.draft2 ?? '',
      d3: homeEditSheet.draft3 ?? '',
      d4: homeEditSheet.draft4 ?? '',
      n: homeEditSheet.draftNum ?? 0,
      b: homeEditSheet.draftBool !== false,
    })
  }, [homeEditSheet])

  useEffect(() => {
    if (!mounted) return
    const supabase = createClient()
    const loadMotivationProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, hcRes, tipRes] = await Promise.all([
        supabase.from('profiles').select('skin_type, skin_concerns, menstrual_cycle, body_status, stress_level, exercise_frequency, full_name, grade, cycle_type, created_at, roles, active_role, onboarding_done, onboarding_step').eq('auth_id', user.id).maybeSingle(),
        supabase.from('hormone_cycle').select('*').eq('auth_id', user.id).maybeSingle(),
        supabase.from('help_tooltips').select('title,content,is_active').eq('key', 'period_start').maybeSingle(),
      ])

      const profile = profileRes.data
      let nameForHormoneLine = userName || '고객'
      if (profile) {
        setMotivationProfile(profile)
        setOnboardingDone((profile as any).onboarding_done === true)
        const displayName = (profile as { full_name?: string | null }).full_name || '고객'
        nameForHormoneLine = displayName
        setUserName(displayName)
        setProfileCycleType((profile as any).cycle_type != null ? String((profile as any).cycle_type) : null)
        setProfileCreatedAt((profile as any).created_at != null ? String((profile as any).created_at) : null)
        if ((profile as any)?.roles) setMyRoles((profile as any).roles)
        if ((profile as any)?.active_role) setActiveRole((profile as any).active_role)
      } else {
        setProfileCycleType(null)
        setProfileCreatedAt(null)
      }

      const hc = hcRes.data
      if (hc) {
        setHormoneCycle(hc)
        setHormoneTrack(String((hc as any).track || 'general'))
        const calc = calcHormoneBriefing(hc)
        setHormoneMainLine(`${nameForHormoneLine}님, 지금 ${calc.phase} ${calc.cycleDay > 0 ? `${calc.cycleDay}일차` : ''}예요 🌿`)
        setHormoneSubLine(`오늘의 피부 이야기 · ${calc.focus}`)
        if (isPeriodTrack(String((hc as any).track || 'general'))) {
          const lp = (hc as any).last_period_date ? new Date((hc as any).last_period_date) : null
          if (lp && !Number.isNaN(lp.getTime())) {
            const gap = Math.floor((Date.now() - lp.getTime()) / 86400000)
            if (gap >= 45) setPeriodQuietNotice('생리 기록을 확인해보세요')
          }
        }
      }

      const tip = tipRes.data
      if (tip) {
        const isOn = (tip as any)?.is_active !== false
        const t = String((tip as any)?.content || (tip as any)?.text || (tip as any)?.value || '').trim()
        setPeriodTipEnabled(isOn && !!t)
        if (t) {
          setPeriodTipText(t)
          setPeriodTipTitle(String((tip as any)?.title || '생리 시작 안내'))
        }
      }
    }
    void loadMotivationProfile()

    supabase.from('skin_concerns').select('*').order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setConcerns(data)
    })
    supabase
      .from('categories')
      .select('id,name,level,sort_order,banner_image_url,banner_text,banner_link')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const rows = (data || []).filter((r: any) => !!(r.banner_image_url || r.banner_text))
        setCategoryBanners(rows)
      })

    void (async () => {
      let restrictExclusiveCatalog = true
      try {
        const { data: { session: _rex } } = await supabase.auth.getSession()
        const _raid = _rex?.user?.id
        if (_raid) {
          const { data: _ruser } = await supabase.from('users').select('id,role').eq('auth_id', _raid).maybeSingle()
          if (_ruser?.id) {
            if ((_ruser as { role?: string }).role === 'admin') {
              restrictExclusiveCatalog = false
            } else {
              const { count: _rcp } = await supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('customer_id', _ruser.id)
                .eq('payment_applied', true)
              if ((_rcp ?? 0) > 0) restrictExclusiveCatalog = false
            }
          }
        }
      } catch {
        restrictExclusiveCatalog = true
      }
      try {
        const [{ data: chk }, { data: rst }, { data: skinUi }] = await Promise.all([
          supabase.from('checkin_options').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase.from('routine_steps').select('*').eq('is_active', true).order('step_order', { ascending: true }),
          supabase.from('admin_settings').select('key,value,label').eq('category', 'home_skin_ui'),
        ])
        if (chk && chk.length > 0) setCheckinOptions(chk)
        if (rst && rst.length > 0) setRoutineSteps(rst)
        ;(skinUi || []).forEach((row: any) => {
          if (row.key === 'hormone_main' && (row.label || row.value)) setHormoneMainLine(String(row.label || row.value))
          if (row.key === 'hormone_sub' && (row.label || row.value)) setHormoneSubLine(String(row.label || row.value))
          if (row.key === 'care_banner' && (row.label || row.value)) setCareBannerLine(String(row.label || row.value))
        })
      } catch { /* 테이블 없음 등 */ }
      const selFull =
        'id, name, retail_price, sale_price, is_timesale, thumb_img, storage_thumb_url, tag, category_id, quiz_match, routine_category, brands(name), is_exclusive'
      const selNoCat =
        'id, name, retail_price, sale_price, is_timesale, thumb_img, storage_thumb_url, tag, category_id, quiz_match, routine_category, brands(name), is_exclusive'
      let res: { error: unknown; data: any[] | null } = await supabase.from('products').select(selFull).eq('is_active', true).limit(80)
      console.log('products fetch 1:', res.error, res.data?.length)
      if (res.error) {
        res = await supabase.from('products').select(selNoCat).eq('is_active', true).limit(80)
        console.log('products fetch 2:', res.error, res.data?.length)
      }
      if (res.error || !res.data?.length) {
        res = await supabase.from('products').select(selFull).limit(80)
      }
      if (res.error) res = await supabase.from('products').select(selNoCat).limit(80)
      if (res.error || !res.data?.length) {
        const fb = await supabase
          .from('products')
          .select('id, name, retail_price, sale_price, is_timesale, thumb_img, tag, category_id, quiz_match, brands(name), is_exclusive')
          .eq('status', 'active')
          .limit(80)
        console.log('products fetch fb:', fb.error, fb.data?.length)
        if (fb.data && fb.data.length > 0) {
          setProducts(
            restrictExclusiveCatalog ? fb.data.filter((p: any) => p.is_exclusive !== true) : fb.data
          )
        }
      } else if (res.data && res.data.length > 0) {
        setProducts(
          restrictExclusiveCatalog ? res.data.filter((p: any) => p.is_exclusive !== true) : res.data
        )
      }

      const { data: npData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)
      if (npData && npData.length > 0) {
        setNewProducts(
          restrictExclusiveCatalog ? npData.filter((p: any) => p.is_exclusive !== true) : npData
        )
      }

      const { data: tsRaw } = await supabase
        .from('products')
        .select('id, name, brand_id, retail_price, sale_price, thumb_img, storage_thumb_url, timesale_ends_at, brands(name), is_exclusive')
        .eq('is_timesale', true)
        .gt('timesale_ends_at', new Date().toISOString())
        .order('timesale_ends_at', { ascending: true })
        .limit(3)
      const tsData =
        restrictExclusiveCatalog && tsRaw
          ? tsRaw.filter((p: any) => p.is_exclusive !== true)
          : tsRaw || []
      if (tsData.length > 0) {
        const mapped = tsData.map((p: any) => {
          const orig = Number(p.retail_price ?? 0)
          const sale = Number(p.sale_price ?? 0)
          const disc = orig > 0 && sale >= 0 ? Math.round(((orig - sale) / orig) * 100) : 0
          return {
            id: p.id,
            disc,
            orig,
            timesale_ends_at: p.timesale_ends_at,
            sale_price: sale,
            brand: p.brands?.name || null,
            product: {
              id: p.id,
              name: p.name,
              retail_price: sale,
              thumb_img: p.storage_thumb_url || p.thumb_img || null,
              brand: p.brands?.name || null,
            },
          }
        })
        setTimeSales(mapped)
        setTimers(
          mapped.map((it: any) => {
            const rawEnd = tsData.find((x: any) => x.id === it.id)?.timesale_ends_at
            const endMs = rawEnd ? new Date(rawEnd).getTime() : 0
            const diffMs = Math.max(0, endMs - Date.now())
            const h = Math.floor(diffMs / 3600000)
            const m = Math.floor((diffMs % 3600000) / 60000)
            const s = Math.floor((diffMs % 60000) / 1000)
            return { h, m, s }
          })
        )
      }

      const { data: seaData } = await supabase
        .from('season_product_mapping')
        .select('*, products(*)')
        .eq('month', new Date().getMonth() + 1)
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(6)
      if (seaData && seaData.length > 0) {
        const sea2 = restrictExclusiveCatalog
          ? seaData.filter((row: any) => row.products?.is_exclusive !== true)
          : seaData
        if (sea2.length > 0) setSeasonRecs(sea2)
      }

      const { data: gbData } = await supabase
        .from('group_buys')
        .select('*, product:products(id, name, retail_price, thumb_img, is_exclusive)')
        .eq('is_active', true)
        .limit(3)
      if (gbData && gbData.length > 0) {
        const gb2 = restrictExclusiveCatalog
          ? gbData.filter((row: any) => row.product?.is_exclusive !== true)
          : gbData
        if (gb2.length > 0) {
          setGroupBuys(gb2)
          setGroupTimers(
            gb2.map((row: any) => {
              const rawEnd = row.ends_at
              const endMs = rawEnd ? new Date(rawEnd).getTime() : 0
              const diffMs = Math.max(0, endMs - Date.now())
              const h = Math.floor(diffMs / 3600000)
              const m = Math.floor((diffMs % 3600000) / 60000)
              const s = Math.floor((diffMs % 60000) / 1000)
              return { h, m, s }
            })
          )
        }
      }
    })()

    supabase.from('brands').select('*').limit(7).then(({ data }) => {
      if (data && data.length > 0) setBrands(data)
    })

    supabase.from('salons').select('*').limit(3).then(({ data }) => {
      if (data && data.length > 0) setSalons(data)
    })

    const iso = new Date().toISOString()
    supabase
      .from('contests')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'active')
      .lte('starts_at', iso)
      .gte('ends_at', iso)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setHomeContestBanner(data || null))

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
            .then(r => r.json())
            .then(d => { if (!d.error) setWeather(d) })
            .catch(() => {})
        },
        () => {
          fetch('/api/weather')
            .then(r => r.json())
            .then(d => { if (!d.error) setWeather(d) })
            .catch(() => {})
        }
      )
    }

    setDataReady(true)
    setLoading(false)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const keyword = searchKeyword.trim()
    if (keyword.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setSearchLoading(true)
      let restrictExclusiveCatalog = true
      try {
        const { data: { session: _rex } } = await supabase.auth.getSession()
        const _raid = _rex?.user?.id
        if (_raid) {
          const { data: _ruser } = await supabase.from('users').select('id,role').eq('auth_id', _raid).maybeSingle()
          if (_ruser?.id) {
            if ((_ruser as { role?: string }).role === 'admin') {
              restrictExclusiveCatalog = false
            } else {
              const { count: _rcp } = await supabase
                .from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('customer_id', _ruser.id)
                .eq('payment_applied', true)
              if ((_rcp ?? 0) > 0) restrictExclusiveCatalog = false
            }
          }
        }
      } catch {
        restrictExclusiveCatalog = true
      }
      try {
        const kw = keyword.slice(0, 100)
        const { data: one } = await supabase
          .from('customer_search_logs')
          .select('id,count')
          .eq('search_keyword', kw)
          .eq('source', '검색')
          .limit(1)
          .maybeSingle()
        if (one?.id) {
          await supabase
            .from('customer_search_logs')
            .update({ count: Number(one.count || 0) + 1 })
            .eq('id', one.id)
        } else {
          await supabase.from('customer_search_logs').insert({ search_keyword: kw, source: '검색', count: 1 } as any)
        }
      } catch {
        // 테이블 미생성 등은 검색 UX에 영향 주지 않음
      }
      let searchQ = supabase
        .from('products')
        .select('id, name, storage_thumb_url, thumb_img, retail_price, sale_price, is_timesale, brand_id')
        .or(`name.ilike.%${keyword}%, description.ilike.%${keyword}%`)
        .eq('is_active', true)
      if (restrictExclusiveCatalog) searchQ = searchQ.eq('is_exclusive', false)
      const { data } = await searchQ.limit(10)
      if (cancelled) return
      setSearchResults(data || [])
      setSearchLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [searchKeyword, mounted])

  useEffect(() => {
    if (!mounted) return
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id || ''
      setMyUserId(uid)
      if (!uid) {
        setUnreadCount(0)
        return
      }
      const { data: unreadRows } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', uid)
        .eq('is_read', false)
      setUnreadCount((unreadRows || []).length)
    }
    void run()
  }, [notificationOpen, mounted])

  // 실시간 타이머
  useEffect(() => {
    const id = setInterval(() => {
      setTimers(prev =>
        prev.map(t => {
          if (t.s > 0) return { ...t, s: t.s - 1 }
          if (t.m > 0) return { ...t, m: t.m - 1, s: 59 }
          if (t.h > 0) return { ...t, h: t.h - 1, m: 59, s: 59 }
          return t
        })
      )
      setGroupTimers(prev =>
        prev.map(t => {
          if (t.s > 0) return { ...t, s: t.s - 1 }
          if (t.m > 0) return { ...t, m: t.m - 1, s: 59 }
          if (t.h > 0) return { ...t, h: t.h - 1, m: 59, s: 59 }
          return t
        })
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  // 폴백 적용
  const concernList = concerns.length > 0 ? concerns : []
  const productList = products.length > 0 ? products : []
  const saleList = timeSales.length > 0 ? timeSales : []
  const groupBuyList = groupBuys.length > 0 ? groupBuys : []
  const salonList = salons.length > 0 ? salons : []
  const newList = newProducts.length > 0 ? newProducts : []
  const brandList = brands.length > 0 ? brands : []

  const motivationMsgs: { icon: string; text: string }[] = []
  if (motivationProfile?.body_status?.includes('갱년기')) motivationMsgs.push({ icon: '💜', text: '갱년기 피부 이길 수 있어요\n오늘 루틴이 방패예요' })
  if (motivationProfile?.body_status?.includes('임신중')) motivationMsgs.push({ icon: '🤱', text: '소중한 시기, 피부도 함께 지켜요\n순한 성분으로 안전하게' })
  if (motivationProfile?.skin_concerns?.includes('트러블')) motivationMsgs.push({ icon: '✨', text: '트러블 없는 피부까지\n오늘 루틴 하나가 쌓여요' })
  if (motivationProfile?.skin_concerns?.includes('탄력')) motivationMsgs.push({ icon: '🌟', text: '10년 전 피부로 돌아가는 중\n오늘도 한 걸음' })
  if (motivationProfile?.skin_concerns?.includes('색소침착')) motivationMsgs.push({ icon: '☀️', text: '맑고 균일한 피부톤까지\n꾸준함이 답이에요' })
  if (motivationProfile?.skin_concerns?.includes('주름')) motivationMsgs.push({ icon: '💎', text: '나이보다 어려 보이는 피부\n오늘 루틴이 만들어요' })
  if (motivationProfile?.stress_level === '높음' || motivationProfile?.stress_level === '매우높음') motivationMsgs.push({ icon: '🧘', text: '스트레스받은 날일수록\n루틴이 피부 지켜줘요' })
  if (motivationProfile?.exercise_frequency === '매일') motivationMsgs.push({ icon: '💪', text: '운동하는 몸처럼\n피부도 단련되고 있어요' })
  if (motivationProfile?.skin_type === '건성') motivationMsgs.push({ icon: '💧', text: '건성 피부의 핵심은 수분\n오늘도 촉촉하게' })
  if (motivationProfile?.skin_type === '지성') motivationMsgs.push({ icon: '🌿', text: '피지 조절의 비결은 꾸준함\n오늘 루틴 빠지지 마요' })
  motivationMsgs.push({ icon: '💜', text: '오늘의 루틴이\n내일의 자신감이에요' })
  motivationMsgs.push({ icon: '✨', text: '빛나는 피부는\n매일의 선택으로 만들어져요' })
  motivationMsgs.push({ icon: '🌙', text: '관리하는 사람은 달라요\n오늘도 함께해요' })
  const motivationCarousel = motivationMsgs.slice(0, 3)
  const motivationMsg = motivationCarousel[motivationIdx % Math.max(1, motivationCarousel.length)] || motivationCarousel[0]

  useEffect(() => {
    if (motivationCarousel.length <= 1) return
    const id = setInterval(() => {
      setMotivationIdx((prev) => (prev + 1) % motivationCarousel.length)
    }, 5000)
    return () => clearInterval(id)
  }, [motivationCarousel.length])

  useEffect(() => {
    if (motivationIdx >= motivationCarousel.length) setMotivationIdx(0)
  }, [motivationCarousel.length, motivationIdx])

  useEffect(() => {
    if (!mounted) return
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user as any
      const role = user?.app_metadata?.role ?? user?.raw_app_meta_data?.role ?? ''
      setIsSuperAdmin(role === 'super_admin')
    })
  }, [mounted])

  useEffect(() => {
    if (checkinOptions.length > 0) {
      const ids = checkinOptions.map((c: any) => String(c.id))
      if (checkInTab == null || !ids.includes(String(checkInTab))) {
        // 오늘 요일 기준 weekday 매칭 탭 자동 선택
        const seoulNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
        const todayWeekday = seoulNow.getDay() // 0=일 1=월 2=화 3=수 4=목 5=금 6=토
        const weekdayMatch = checkinOptions.find((c: any) => Number(c.weekday) === todayWeekday)
        const fallback = checkinOptions[0]
        setCheckInTab(String((weekdayMatch || fallback).id))
      }
    }
  }, [checkinOptions, checkInTab])

  useEffect(() => {
    if (!hormoneCycle) return
    const c = calcHormoneBriefing(hormoneCycle)
    setHormoneMainLine(`${userName}님, 지금 ${c.phase} ${c.cycleDay > 0 ? `${c.cycleDay}일차` : ''}예요 ✨`)
    setHormoneSubLine(`오늘의 피부 사이클 · ${c.focus}`)
  }, [hormoneCycle, userName])

  useEffect(() => {
    if (!homeToast) return
    const t = setTimeout(() => setHomeToast(''), 2400)
    return () => clearTimeout(t)
  }, [homeToast])

  useEffect(() => {
    if (!mounted) return
    if (!myUserId) return
    const run = async () => {
      const { data: qs } = await supabase
        .from('customer_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      const list = (qs || []).filter((q: any) => {
        const tracks = Array.isArray(q.target_tracks) ? q.target_tracks.map((x: any) => String(x)) : ['all']
        return tracks.includes('all') || tracks.includes(hormoneTrack)
      })
      const daily = list.find((q: any) => String(q.question_type) === 'daily')
      setDailyQuestion(daily || null)
      if (daily) {
        const raw = daily.options
        const opts = Array.isArray(raw)
          ? raw.map((x: any) => String(x))
          : String(raw || '')
              .split(/[,\n]/)
              .map((x: string) => x.trim())
              .filter(Boolean)
        setQuestionOptions(opts)
      }
      const m = new Date()
      const monthStart = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().slice(0, 10)
      const monthly = list.find((q: any) => String(q.question_type) === 'monthly')
      if (monthly && m.getDate() === 1) {
        const { data: exists } = await supabase
          .from('customer_question_answers')
          .select('id')
          .eq('auth_id', myUserId)
          .eq('question_id', monthly.id)
          .gte('answer_date', monthStart)
          .limit(1)
        if (!exists || exists.length === 0) setQuestionPopup(monthly)
      }
      const post = list.find((q: any) => String(q.question_type) === 'post_purchase')
      if (post) {
        const n = Math.max(0, Number(post.post_purchase_days || 0))
        const { data: od } = await supabase
          .from('orders')
          .select('id, delivered_at, status')
          .eq('customer_id', myUserId)
          .order('delivered_at', { ascending: false })
          .limit(10)
        const hit = (od || []).find((o: any) => {
          if (!o?.delivered_at) return false
          const d = Math.floor((Date.now() - new Date(o.delivered_at).getTime()) / 86400000)
          return d === n
        })
        if (hit) {
          await supabase.from('notifications').insert({
            user_id: myUserId,
            title: '사용 질문이 도착했어요',
            body: String(post.question_text || ''),
            type: 'question',
            is_read: false,
          } as any)
          setQuestionPopup(post)
        }
      }
    }
    void run()
  }, [myUserId, hormoneTrack, mounted])

  useEffect(() => {
    if (!mounted) return
    if (!myUserId) return
    const ch = supabase
      .channel(`home-hormone-cycle-${myUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hormone_cycle', filter: `auth_id=eq.${myUserId}` },
        (payload: any) => {
          const row = payload?.new
          if (!row) return
          setHormoneCycle(row)
          setHormoneTrack(String(row.track || 'general'))
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [myUserId, mounted])

  useEffect(() => {
    const next: Record<string, boolean> = {}
    routineSteps.forEach((s: any) => {
      if (s?.id != null) next[String(s.id)] = true
    })
    setRoutineStepPick(next)
  }, [routineSteps])

  const checkinSorted = checkinOptions
    .filter((r: any) => r.is_active !== false)
    .sort((a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  const homeCheckinSorted =
    profileCycleType === 'menopause'
      ? CHECKIN_CYCLE_MENOPAUSE
      : profileCycleType === 'pregnancy' || profileCycleType === 'postpartum'
        ? CHECKIN_CYCLE_PREGNANCY
        : checkinSorted
  const displayCheckinTabs = homeCheckinSorted
  const selectedCheckinOpt =
    homeCheckinSorted.length > 0
      ? homeCheckinSorted.find((c: any) => String(c.id) === String(checkInTab)) || homeCheckinSorted[0]
      : null
  const skinRecList = useMemo(() => {
    let skinRecPool: any[] = products.length > 0 ? [...products] : []
    const sel =
      homeCheckinSorted.length > 0
        ? homeCheckinSorted.find((c: any) => String(c.id) === String(checkInTab)) || homeCheckinSorted[0]
        : null
    if (sel && skinRecPool.length > 0) {
      const idsRaw = sel.recommend_product_ids ?? sel.product_ids ?? sel.recommended_product_ids
      let idList: string[] = []
      if (Array.isArray(idsRaw)) idList = idsRaw.map((x: any) => String(x)).filter(Boolean)
      else if (typeof idsRaw === 'string' && idsRaw.trim()) {
        try {
          const p = JSON.parse(idsRaw)
          if (Array.isArray(p)) idList = p.map((x: any) => String(x)).filter(Boolean)
        } catch { /* ignore */ }
      }
      if (idList.length > 0) {
        const set = new Set(idList)
        const filtered = skinRecPool.filter((p: any) => set.has(String(p.id)))
        if (filtered.length > 0) skinRecPool = filtered
      } else {
        const tagsRaw = (sel as any).skin_tags ?? sel.linked_tag ?? sel.connection_tag ?? sel.tag_link ?? ''
        const tagList = Array.isArray(tagsRaw)
          ? tagsRaw.map((x: any) => String(x).toLowerCase().trim()).filter(Boolean)
          : String(tagsRaw)
              .split(/[,\n]/)
              .map((x: string) => x.trim().toLowerCase())
              .filter(Boolean)
        if (tagList.length > 0) {
          const filtered = skinRecPool.filter((p: any) => {
            const tag = String(p.tag || '').toLowerCase()
            const skinTags = Array.isArray((p as any).skin_tags) ? (p as any).skin_tags.map((x: any) => String(x).toLowerCase()) : []
            const qm = Array.isArray(p.quiz_match) ? p.quiz_match.map((x: any) => String(x).toLowerCase()).join(' ') : ''
            return tagList.some((t: string) => tag.includes(t) || qm.includes(t) || skinTags.some((st: string) => st.includes(t)))
          })
          if (filtered.length > 0) skinRecPool = filtered
        }
      }
    }
    if (hormoneTrack && skinRecPool.length > 0) {
      const filteredByTrack = skinRecPool.filter((p: any) => {
        const arr = Array.isArray(p?.categories?.target_tracks) ? p.categories.target_tracks.map((x: any) => String(x)) : []
        if (arr.length === 0) return true
        return arr.includes('all') || arr.includes(hormoneTrack)
      })
      if (filteredByTrack.length > 0) skinRecPool = filteredByTrack
    }
    const pl = products.length > 0 ? products : []
    // 선호브랜드 우선 정렬
    const prefBrands: string[] = Array.isArray((motivationProfile as any)?.preferred_brands)
      ? (motivationProfile as any).preferred_brands.map((x: any) => String(x).toLowerCase())
      : []

    // 체크인 없을 때 프로필 기본값으로 필터
    const hasCheckin = checkInTab && homeCheckinSorted.length > 0
    if (!hasCheckin && skinRecPool.length > 0) {
      const skinType = String((motivationProfile as any)?.skin_type || '').toLowerCase()
      const skinConcerns: string[] = Array.isArray((motivationProfile as any)?.skin_concerns)
        ? (motivationProfile as any).skin_concerns.map((x: any) => String(x).toLowerCase())
        : []
      if (skinType || skinConcerns.length > 0) {
        const filtered = skinRecPool.filter((p: any) => {
          const tag = String(p.tag || '').toLowerCase()
          const qm = Array.isArray(p.quiz_match)
            ? p.quiz_match.map((x: any) => String(x).toLowerCase()).join(' ')
            : ''
          const matchType = skinType ? (tag.includes(skinType) || qm.includes(skinType)) : false
          const matchConcern = skinConcerns.some((c: string) => tag.includes(c) || qm.includes(c))
          return matchType || matchConcern
        })
        if (filtered.length > 0) skinRecPool = filtered
      }
    }

    // 선호브랜드 있으면 상단 정렬
    if (prefBrands.length > 0) {
      const preferred = skinRecPool.filter((p: any) => {
        const bn = String(p.brands?.name || p.brand || '').toLowerCase()
        return prefBrands.some((b: string) => bn.includes(b))
      })
      const others = skinRecPool.filter((p: any) => {
        const bn = String(p.brands?.name || p.brand || '').toLowerCase()
        return !prefBrands.some((b: string) => bn.includes(b))
      })
      if (preferred.length > 0) skinRecPool = [...preferred, ...others]
    }

    return skinRecPool.length > 0 ? skinRecPool : pl
  }, [checkInTab, homeCheckinSorted, products, hormoneTrack, motivationProfile])

  useEffect(() => {
    if (!myUserId || !checkInTab) return
    const opt =
      homeCheckinSorted.find((c: any) => String(c.id) === String(checkInTab)) ||
      displayCheckinTabs.find((c: any) => String(c.id) === String(checkInTab))
    const condition =
      `${(opt as any)?.emoji || ''}${(opt as any)?.label || ''}`.trim() ||
      String((opt as any)?.linked_tag || (opt as any)?.connection_tag || (opt as any)?.tag_link || checkInTab)
    const hcRow = hormoneCycle || { track: hormoneTrack, cycle_length: 28, last_period_date: null }
    const calc = calcHormoneBriefing(hcRow)
    const seoulD = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const today = `${seoulD.getFullYear()}-${String(seoulD.getMonth() + 1).padStart(2, '0')}-${String(seoulD.getDate()).padStart(2, '0')}`
    const ids = skinRecList.slice(0, 16).map((p: any) => String(p.id)).filter(Boolean)
    void upsertSkinCycleDaily(supabase, myUserId, {
      record_date: today,
      cycle_day: calc.cycleDay,
      hormone_stage: calc.phase,
      checkin_condition: condition,
      recommended_products: ids,
    })
  }, [checkInTab, myUserId])

  const logProductNav = (p: any) => {
    if (!myUserId || !p?.id) return
    void logUserBehavior(supabase, myUserId, 'product_click', String(p.id), {
      category_id: p.category_id ?? p.categories?.id ?? null,
      price: Number(p.is_timesale ? (p.sale_price ?? p.retail_price) : (p.retail_price ?? p.price)) || 0,
    })
  }
  const logRoutineView = (source: string) => {
    if (!myUserId) return
    void logUserBehavior(supabase, myUserId, 'routine_view', null, { source })
  }
  const productById: Record<string, any> = {}
  products.forEach((p: any) => {
    if (p?.id) productById[String(p.id)] = p
  })
  const selectedCheckinTags = useMemo(() => {
    const raw = (selectedCheckinOpt as any)?.skin_tags ?? (selectedCheckinOpt as any)?.linked_tag ?? ''
    if (Array.isArray(raw)) return raw.map((x: any) => String(x).toLowerCase().trim()).filter(Boolean)
    return String(raw)
      .split(/[,\n]/)
      .map((x: string) => x.trim().toLowerCase())
      .filter(Boolean)
  }, [selectedCheckinOpt])
  const careActionLine =
    String(
      (selectedCheckinOpt as any)?.recommendation_message ||
        (selectedCheckinOpt as any)?.recommend_copy ||
        (selectedCheckinOpt as any)?.recommendation_ment ||
        (selectedCheckinOpt as any)?.recommend_ment ||
        ''
    ).trim() || careBannerLine
  const hormonePhaseTipDesc = useMemo(() => {
    const s = `${hormoneMainLine}\n${hormoneSubLine}`
    for (const row of HORMONE_PHASE_TIP_ROWS) {
      if (s.includes(row[0])) return row[1]
    }
    return ''
  }, [hormoneMainLine, hormoneSubLine])
  useEffect(() => {
    setHormonePhaseTipOpen(false)
  }, [hormoneMainLine, hormoneSubLine])

  const homeCalendarKind =
    profileCycleType === 'menopause'
      ? 'menopause'
      : profileCycleType === 'pregnancy' || profileCycleType === 'postpartum'
        ? 'pregnancy'
        : 'menstrual'
  const showHomeEditChrome = isSuperAdmin && homeEditMode
  const cycleType = profileCycleType

  if (!mounted) return <Loading />
  if (!dataReady) return <Loading />

  if (onboardingDone === false) {
    return (
      <div style={{
        background: '#0D0B09',
        minHeight: '100vh',
        maxWidth: '390px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "'Noto Sans KR', sans-serif",
        color: '#fff',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>💜</div>
        <div style={{ fontSize: 22, color: '#C9A96E', letterSpacing: 4, marginBottom: 8, fontFamily: 'Georgia, serif' }}>AURAN</div>
        <div style={{ fontSize: 15, color: '#fff', marginBottom: 8, fontWeight: 300 }}>
          {(motivationProfile as any)?.full_name || ''}님 환영해요
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 40, textAlign: 'center', lineHeight: 1.7, fontWeight: 300 }}>
          피부 정보를 입력하면<br/>나만을 위한 케어가 시작돼요
        </div>
        <button
          onClick={() => router.push('/my/profile')}
          style={{
            width: '100%',
            padding: '14px',
            background: '#7B5EA7',
            border: 'none',
            borderRadius: 13,
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: 300,
            marginBottom: 12,
          }}
        >
          내 피부 정보 입력하기
        </button>
        <button
          onClick={async () => {
            await supabase.from('profiles').update({ onboarding_done: true }).eq('auth_id', myUserId)
            setOnboardingDone(true)
          }}
          style={{
            width: '100%',
            padding: '14px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 13,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: 300,
          }}
        >
          나중에 할게요
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: BG,
      minHeight: '100vh',
      maxWidth: '390px',
      margin: '0 auto',
      fontFamily: "'Noto Sans KR', -apple-system, sans-serif",
      fontWeight: 300,
      color: '#fff',
      paddingBottom: '0',
    }}>
      <style>{`@keyframes pulse{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}.home-cal-yearly-month-btn{position:relative;isolation:isolate}.home-cal-yearly-month-btn::before,.home-cal-yearly-month-btn::after{pointer-events:none!important}`}</style>

      {/* ── 탑바 ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(13,11,9,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}>
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: '22px', fontWeight: 400,
          color: GOLD, letterSpacing: '6px',
        }}>AURAN</span>
        <button
          onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20,
            padding: '4px 10px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {activeRole === 'customer' ? '✦ 고객' :
           activeRole === 'partner' ? '◈ 파트너스' :
           activeRole === 'owner' ? '◉ 원장' :
           activeRole === 'brand' ? '◇ 브랜드사' : '✦ 고객'}
          <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
        </button>
        {showRoleSwitcher && (
          <div style={{
            position: 'absolute', top: 52, left: 20,
            background: 'rgba(20,15,30,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: 12,
            display: 'flex', gap: 8, zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {[
              { id: 'customer', label: '고객', icon: '✦' },
              { id: 'partner', label: '파트너스', icon: '◈' },
              { id: 'owner', label: '원장', icon: '◉' },
              { id: 'brand', label: '브랜드사', icon: '◇' },
            ].map(pos => {
              const hasRole = myRoles.includes(pos.id)
              const isActive = pos.id === activeRole
              return (
                <button
                  key={pos.id}
                  onClick={async () => {
                    if (!hasRole) return
                    setShowRoleSwitcher(false)
                    const res = await fetch('/api/profile/active-role', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ role: pos.id }),
                    })
                    if (res.ok) {
                      setActiveRole(pos.id)
                      if (pos.id === 'owner') window.location.href = '/dashboard/owner'
                      else if (pos.id === 'partner') window.location.href = '/dashboard/partner'
                      else if (pos.id === 'brand') window.location.href = '/dashboard/brand'
                      else window.location.href = '/'
                    }
                  }}
                  style={{
                    padding: '10px 8px', borderRadius: 12, minWidth: 60,
                    border: isActive ? '1.5px solid rgba(255,255,255,0.5)' : '1.5px solid transparent',
                    background: isActive ? 'rgba(255,255,255,0.15)' : hasRole ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
                    color: hasRole ? 'white' : 'rgba(255,255,255,0.25)',
                    fontSize: 10, cursor: hasRole ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{pos.icon}</div>
                  <div>{pos.label}</div>
                  <div style={{ fontSize: 8, marginTop: 3, opacity: 0.6 }}>
                    {isActive ? '현재' : hasRole ? '전환' : '신청'}
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', cursor: 'pointer',
            }}
          >
            🔍
          </button>
          <button
            onClick={() => setNotificationOpen(true)}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', cursor: 'pointer',
              position: 'relative',
            }}
          >
            🔔
            {unreadCount > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#E04030',
                  color: '#fff',
                  fontSize: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>
      <NotificationPanel isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />
      <div
        style={{
          maxHeight: searchOpen ? 420 : 0,
          opacity: searchOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 260ms ease, opacity 220ms ease',
          padding: searchOpen ? '10px 16px 0' : '0 16px',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            placeholder="제품명, 브랜드 검색"
            style={{
              flex: 1,
              height: 40,
              padding: '0 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 20,
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false)
              setSearchKeyword('')
              setSearchResults([])
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            X
          </button>
        </div>
        {searchOpen ? (
          <div
            style={{
              marginTop: 8,
              background: '#1a1a1a',
              borderRadius: 12,
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {searchLoading ? (
              <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>검색중...</div>
            ) : searchKeyword.trim().length >= 2 && searchResults.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>검색 결과가 없어요</div>
            ) : (
              searchResults.map((p: any) => {
                const price = Number((p?.is_timesale ? p?.sale_price : p?.retail_price) ?? 0)
                const thumb = p?.storage_thumb_url || p?.thumb_img || ''
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      logProductNav(p)
                      router.push(`/products/${p.id}`)
                      setSearchOpen(false)
                      setSearchKeyword('')
                      setSearchResults([])
                    }}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {thumb ? (
                        <img src={thumb} alt={p.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', maxWidth: '100%', overflow: 'hidden' }} />
                      ) : (
                        <div style={{ fontSize: 18 }}>🧴</div>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#7B5EA7', marginTop: 2 }}>{price.toLocaleString()}원</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : null}
      </div>
      <NoticePanel supabase={supabase} myUserId={myUserId} />

      {/* ── 인사말 ── */}
      <div style={{
        padding: '14px 20px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_MUTED, marginBottom: '4px' }}>
            {todayLocaleLabel}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 400, marginBottom: '3px' }}>
            안녕하세요, <span style={{ color: GOLD }}>{userName}님</span> 👋
          </div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED }}>
            오늘 피부 케어 75%
            {weather && (
              <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.5)' }}>
                {weather.city} {weather.temp}° {weather.condition} · 🌫 {weather.dust?.level} · 💨 {weather.fineDust?.level} · 🔆 {weather.uv?.level}
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px',
        }}>👩</div>
      </div>

      {/* 원장님 대화카드 */}
      <div style={{ margin: '12px 16px 0' }}>
        {!cardExpanded ? (
          <div
            onClick={() => setCardExpanded(true)}
            style={{
              background: 'rgba(123,94,167,0.08)',
              border: '1px solid rgba(123,94,167,0.25)',
              borderRadius: 14, padding: '11px 14px',
              display: 'flex', alignItems: 'center',
              gap: 10, cursor: 'pointer'
            }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(123,94,167,0.3)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 15
              }}>👩</div>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: '#4cad7e', border: '2px solid #0D0B09'
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#fff' }}>맑원장님</div>
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.45)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>오늘 어떤 도움이 필요하세요?</div>
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>▼</div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(123,94,167,0.08)',
            border: '1px solid rgba(123,94,167,0.25)',
            borderRadius: 14, overflow: 'hidden'
          }}>
            <div
              onClick={(e) => { e.stopPropagation(); setCardExpanded(false); setConsultType(null); }}
              style={{
                padding: '11px 14px', display: 'flex',
                alignItems: 'center', gap: 10, cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(123,94,167,0.3)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 15
                }}>👩</div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#4cad7e', border: '2px solid #0D0B09'
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#fff' }}>맑원장님</div>
                <div style={{ fontSize: 10, color: '#4cad7e' }}>● 온라인 · 스킨파우더룸</div>
              </div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>▲</div>
            </div>

            {!consultType ? (
              <div
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  void (async () => {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser()
                    if (!user) {
                      router.push('/login?role=customer')
                      return
                    }
                    const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
                    if (!urow?.id) return
                    const { data: ownerRow } = await supabase
                      .from('chat_channels')
                      .select('id')
                      .eq('user_id', urow.id)
                      .eq('channel_type', 'owner')
                            .eq('owner_id', '46ec32d1-0f25-4944-a6dc-8100acc68abf')
                      .maybeSingle()
                    if (ownerRow?.id) {
                      router.push('/dashboard/customer/chat/' + ownerRow.id)
                      return
                    }
                    const { data: inserted, error: insErr } = await supabase
                      .from('chat_channels')
                      .insert({
                        user_id: urow.id,
                              owner_id: '46ec32d1-0f25-4944-a6dc-8100acc68abf',
                        channel_type: 'owner',
                        title: '원장님 상담',
                        system_kind: null,
                        preview_text: '',
                        unread_count: 0,
                        is_online: false,
                      } as any)
                      .select('id')
                      .maybeSingle()
                    if (!insErr && inserted?.id) {
                      router.push('/dashboard/customer/chat/' + inserted.id)
                    }
                  })()
                }}
                style={{ padding: '10px 14px 12px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 11, color: '#7B5EA7', textAlign: 'right' }}>상담하기</div>
              </div>
            ) : (
              <div style={{ padding: '10px 14px 12px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '12px 12px 12px 3px',
                  padding: '10px 12px', fontSize: 12,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.6, marginBottom: 10
                }}>
                  {consultType === 'skin' && '어떤 피부 고민이 있으세요?'}
                  {consultType === 'routine' && '보유 제품으로 루틴 정리해드릴게요! 어떤 시간대가 필요하세요?'}
                  {consultType === 'recommend' && '어떤 고민을 해결하고 싶으세요?'}
                  {consultType === 'photo' && '사진 1장만 올려주세요. 원장님이 확인 후 답변드려요!'}
                  {consultType === 'sample' && '어떤 샘플이 필요하세요? 원장님 승인 후 다음 주문에 동봉해드려요'}
                  {consultType === 'sos' && '어떤 상황이에요? 즉시 도와드릴게요!'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => router.push('/dashboard/customer/chat')}
                    style={{
                      flex: 1, padding: '8px',
                      borderRadius: 9,
                      border: '1px solid rgba(123,94,167,0.4)',
                      background: 'rgba(123,94,167,0.1)',
                      color: '#c4a7e7', fontSize: 12, cursor: 'pointer'
                    }}
                  >오랜상담 전체보기 →</button>
                  <button
                    onClick={() => setConsultType(null)}
                    style={{
                      padding: '8px 12px', borderRadius: 9,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: 12, cursor: 'pointer'
                    }}
                  >← 뒤로</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TODAY'S SKIN ── */}
      <div
        onClick={() => setShowWeatherDetail(prev => !prev)}
        style={{
          margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER,
          borderRadius: '16px', padding: '12px 16px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '30px' }}>💧</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1px', color: TEXT_MUTED, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: 4 }}>
              TODAY&apos;S SKIN
              <span
                onClick={e => {
                  e.stopPropagation()
                  const msg = SKIN_TOOLTIP_MSGS[Math.floor(Math.random() * SKIN_TOOLTIP_MSGS.length)]
                  setSkinTooltipMsg(msg)
                  setTimeout(() => setSkinTooltipMsg(''), 3000)
                }}
                style={{ cursor: 'pointer' }}
              >?</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 400, marginBottom: '4px' }}>건성 · 민감 복합</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ label: '수분', pct: 62, color: '#6ab0e0' }, { label: '유분', pct: 38, color: GOLD }].map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{b.label}</span>
                  <div style={{ width: '44px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: '2px' }} />
                  </div>
                  <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{b.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <span style={{
            fontSize: '13px', color: TEXT_MUTED,
            display: 'inline-block', transition: 'transform 0.2s',
            transform: showWeatherDetail ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>›</span>
        </div>

        {showWeatherDetail && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:10, lineHeight:1.6, textAlign:'center' }}>
              {CARE_CHEER_MSGS[Math.floor(Math.random() * CARE_CHEER_MSGS.length)]}
            </div>
            {weather && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                {[
                  { label: '날씨', value: `${weather.temp}° ${weather.condition}` },
                  { label: '미세먼지', value: weather.dust?.level, color: weather.dust?.level === '좋음' ? '#4CAF50' : weather.dust?.level === '보통' ? '#F5A623' : '#E53935' },
                  { label: '초미세먼지', value: weather.fineDust?.level, color: weather.fineDust?.level === '좋음' ? '#4CAF50' : weather.fineDust?.level === '보통' ? '#F5A623' : '#E53935' },
                  { label: '자외선', value: weather.uv?.level, color: weather.uv?.level === '낮음' ? '#4CAF50' : weather.uv?.level === '보통' ? '#8BC34A' : weather.uv?.level === '높음' ? '#FF9800' : '#E53935' },
                  { label: '습도', value: `${weather.humidity}%` },
                ].map((item, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: (item as any).color || 'rgba(255,255,255,0.7)', fontWeight: 300 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
            {weather && (() => {
              const warnings: string[] = []
              if (weather.dust?.level === '나쁨' || weather.dust?.level === '매우나쁨')
                warnings.push('미세먼지 ' + weather.dust.level + ' — 외출 후 이중 세안 필수')
              if (weather.fineDust?.level === '나쁨' || weather.fineDust?.level === '매우나쁨')
                warnings.push('초미세먼지 ' + weather.fineDust.level + ' · 외출 후 딥클렌징 추천')
              if (weather.uv?.level === '높음')
                warnings.push('자외선 높음 · SPF30+ 자외선차단제 바르세요')
              if (weather.uv?.level === '매우높음')
                warnings.push('자외선 매우 높음 — 선크림 2시간마다 덧바르기')
              if (weather.humidity < 40)
                warnings.push('건조한 날씨 — 보습 크림 추가 도포 권장')
              return warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4, lineHeight: 1.5 }}>⚠ {w}</div>
              ))
            })()}
            <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:6 }}>
              <button
                onClick={e => { e.stopPropagation(); setShowWeatherRec(true) }}
                style={{ flex:1, background:'rgba(201,169,110,0.08)', border:'1px solid rgba(201,169,110,0.25)', borderRadius:20, padding:'6px 10px', fontSize:11, color:GOLD, cursor:'pointer' }}
              >
                ✦ 날씨 맞춤 추천
              </button>
              <button
                onClick={e => { e.stopPropagation(); setShowSkinDiary(true) }}
                style={{ flex:1, background:'rgba(123,94,167,0.08)', border:'1px solid rgba(123,94,167,0.25)', borderRadius:20, padding:'6px 10px', fontSize:11, color:'#c4a7e7', cursor:'pointer' }}
              >
                💜 오늘 기록하기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 호르몬 브리핑 · 오늘 체크인 · 케어 액션 (TODAY&apos;S SKIN 바로 아래) ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div
          onClick={
            showHomeEditChrome
              ? e => {
                  e.stopPropagation()
                  setHomeEditSheet({ kind: 'hormone_main', label: '호르몬 브리핑 (메인)', draft: hormoneMainLine, draft2: hormoneSubLine })
                }
              : () => router.push('/skin-analysis/q')
          }
          style={{
            borderRadius: 16,
            padding: '16px 16px 14px',
            background: 'linear-gradient(145deg, #1a0f28 0%, #251538 45%, #1e1430 100%)',
            border: showHomeEditChrome ? '1px dashed rgba(168, 130, 220, 0.55)' : '1px solid rgba(123, 94, 167, 0.35)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {showHomeEditChrome ? (
            <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 6px' }}>✏️</span>
          ) : null}
          <div
            onClick={
              showHomeEditChrome
                ? e => {
                    e.stopPropagation()
                    setHomeEditSheet({
                      kind: 'hormone_sub',
                      label: '호르몬 브리핑 (서브)',
                      draft: hormoneSubLine,
                    })
                  }
                : undefined
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              fontSize: 9,
              color: 'rgba(196, 170, 230, 0.75)',
              marginBottom: 8,
              letterSpacing: '0.02em',
            }}
          >
            <span>{hormoneSubLine}</span>
            {hormonePhaseTipDesc ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setHormonePhaseTipOpen(o => !o)
                }}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: 'rgba(123,94,167,0.3)',
                  border: '1px solid rgba(123,94,167,0.5)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 8,
                  cursor: 'pointer',
                  marginLeft: 4,
                  padding: 0,
                  lineHeight: 1,
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 400,
                }}
              >
                ?
              </button>
            ) : null}
          </div>
          <div style={{ fontSize: 13, fontWeight: 300, color: '#f3ecff', lineHeight: 1.55 }}>{hormoneMainLine}</div>
          {hormonePhaseTipDesc && hormonePhaseTipOpen ? (
            <div
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.55)',
                background: 'rgba(123,94,167,0.1)',
                border: '1px solid rgba(123,94,167,0.2)',
                borderRadius: 8,
                padding: '6px 10px',
                marginTop: 6,
                lineHeight: 1.6,
              }}
            >
              {hormonePhaseTipDesc}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 8,
            marginTop: 12,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 4,
            scrollbarWidth: 'none',
          }}
        >
          {displayCheckinTabs.map((t: any) => {
            const tid = String(t.id)
            const on = checkInTab === tid
            const tabLabel = `${t.emoji ?? ''}${t.label ?? ''}`
            return (
              <div key={tid} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = on ? null : tid
                    setCheckInTab(nextId)
                    if (myUserId && nextId) {
                      const condition =
                        `${t.emoji ?? ''}${t.label ?? ''}`.trim() ||
                        String(t.linked_tag ?? t.connection_tag ?? t.tag_link ?? tid)
                      void logUserBehavior(supabase, myUserId, 'checkin', tid, { condition })
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: on ? '1px solid rgba(168, 130, 220, 0.65)' : '1px solid rgba(255,255,255,0.1)',
                    background: on ? 'rgba(123, 94, 167, 0.35)' : 'rgba(255,255,255,0.04)',
                    color: on ? '#e8d9ff' : 'rgba(255,255,255,0.75)',
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    outline: showHomeEditChrome && checkinSorted.length > 0 && homeCalendarKind === 'menstrual' ? '1px dashed rgba(123,94,167,0.4)' : undefined,
                    fontFamily: 'inherit',
                  }}
                >
                  {tabLabel}
                </button>
                {showHomeEditChrome && checkinSorted.length > 0 && homeCalendarKind === 'menstrual' ? (
                  <button
                    type="button"
                    aria-label="체크인 편집"
                    onClick={e => {
                      e.stopPropagation()
                      setHomeEditSheet({
                        kind: 'checkin',
                        id: String(t.id),
                        label: '체크인 항목 편집',
                        draft: String(t.emoji ?? ''),
                        draft2: String(t.label ?? ''),
                        draft3: String(t.linked_tag ?? t.connection_tag ?? t.tag_link ?? ''),
                        draft4: String(t.recommendation_message ?? t.recommend_copy ?? t.recommendation_ment ?? t.recommend_ment ?? ''),
                        draftNum: Number(t.sort_order ?? 0),
                        draftBool: t.is_active !== false,
                        extra: t,
                      })
                    }}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#7B5EA7',
                      color: '#fff',
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    ✏️
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        {dailyQuestion ? (
          <div style={{ marginTop: 8, padding: '11px 12px', borderRadius: 12, border: '1px solid rgba(123,94,167,0.25)', background: 'rgba(123,94,167,0.08)' }}>
            <div style={{ fontSize: 10, color: 'rgba(196,170,230,0.8)', marginBottom: 6 }}>오늘의 질문</div>
            <div style={{ fontSize: 12, color: '#fff', marginBottom: 8 }}>{String(dailyQuestion.question_text || '')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(dailyQuestion.answer_type === 'yesno' ? ['예', '아니오'] : questionOptions).slice(0, 6).map((op: string) => (
                <button
                  key={op}
                  type="button"
                  onClick={async () => {
                    const today = new Date().toISOString().slice(0, 10)
                    if (!myUserId || !dailyQuestion?.id) return
                    const { data: dup } = await supabase
                      .from('customer_question_answers')
                      .select('id')
                      .eq('auth_id', myUserId)
                      .eq('question_id', dailyQuestion.id)
                      .eq('answer_date', today)
                      .limit(1)
                    if (dup && dup.length > 0) {
                      setHomeToast('오늘은 이미 답변했어요')
                      return
                    }
                    await supabase.from('customer_question_answers').insert({ auth_id: myUserId, question_id: dailyQuestion.id, answer_value: op, answer_date: today } as any)
                    void logUserBehavior(supabase, myUserId, 'question_answer', String(dailyQuestion.id), { answer: op })
                    setHomeToast('답변 저장 완료')
                  }}
                  style={{ padding: '6px 9px', borderRadius: 999, border: '1px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.2)', color: '#e8d9ff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {op}
                </button>
              ))}
              {dailyQuestion.answer_type === 'text' ? (
                <input
                  value={questionAnswer}
                  onChange={e => setQuestionAnswer(e.target.value)}
                  placeholder="답변 입력"
                  style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12 }}
                />
              ) : null}
              {dailyQuestion.answer_type === 'text' ? (
                <button
                  type="button"
                  onClick={async () => {
                    const today = new Date().toISOString().slice(0, 10)
                    if (!myUserId || !dailyQuestion?.id || !questionAnswer.trim()) return
                    const { data: dup } = await supabase
                      .from('customer_question_answers')
                      .select('id')
                      .eq('auth_id', myUserId)
                      .eq('question_id', dailyQuestion.id)
                      .eq('answer_date', today)
                      .limit(1)
                    if (dup && dup.length > 0) {
                      setHomeToast('오늘은 이미 답변했어요')
                      return
                    }
                    await supabase.from('customer_question_answers').insert({ auth_id: myUserId, question_id: dailyQuestion.id, answer_value: questionAnswer.trim(), answer_date: today } as any)
                    void logUserBehavior(supabase, myUserId, 'question_answer', String(dailyQuestion.id), { answer: questionAnswer.trim() })
                    setHomeToast('답변 저장 완료')
                  }}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.2)', color: '#e8d4a8', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  저장
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

      </div>

      {seasonRecs.length > 0 && (
        <section style={{ padding: '0 20px', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 300, color: '#fff' }}>
                🌸 {new Date().getMonth() + 1}월 시즌 추천
              </span>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                내 피부 점수 기반 이달 맞춤
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {seasonRecs.slice(0, 4).map((r: any) => {
              const p = r.products
              if (!p) return null
              return (
                <div key={r.id} style={{ flexShrink: 0, width: 140, cursor: 'pointer' }}
                  onClick={() => router.push(`/products/${p.id}`)}>
                  <div style={{ width: 140, height: 140, borderRadius: 14, overflow: 'hidden', background: 'var(--bg2)', marginBottom: 8 }}>
                    {p.storage_thumb_url || p.thumb_img ? (
                      <img src={p.storage_thumb_url || p.thumb_img} alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🧴</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{r.concern_tag}</div>
                  <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.4, marginBottom: 4 }}
                    className="line-clamp-2">{p.name}</div>
                  <div style={{ fontSize: 13, color: GOLD }}>₩{(p.retail_price || 0).toLocaleString()}</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 내 피부 맞춤 추천 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>내 피부 맞춤 추천</span>
          <span
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                logRoutineView('routine_more')
                setRoutineExpanded(true)
                setRoutineMentorOpen(true)
                setTimeout(() => routineMoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
              }
            }}
            onClick={() => {
              logRoutineView('routine_more')
              setRoutineExpanded(true)
              setRoutineMentorOpen(true)
              setTimeout(() => routineMoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
            }}
            style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}
          >
            더보기 ›
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ minWidth: '130px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, height: '200px', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
        )) : skinRecList.slice(0, 4).map((p: any, i: number) => {
          const thumb = p.storage_thumb_url || p.thumb_img
          const brandName = p.brands?.name || p.brand
          const catName = p.categories?.name || ''
          const priceShow = p.is_timesale ? (p.sale_price ?? p.retail_price) : p.retail_price
          return (
            <div
              key={p.id ?? i}
              onClick={() => {
                logProductNav(p)
                router.push(`/products/${p.id}`)
              }}
              style={{
                width: 140, background: CARD_BG, border: CARD_BORDER,
                borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                width: 140,
                height: 140,
                borderRadius: 14,
                overflow: 'hidden',
                background: 'var(--bg2)',
                marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '34px', position: 'relative',
              }}>
                {thumb ? <img src={thumb} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.icon || '🧴')}
                {p.badge && (
                  <div style={{
                    position: 'absolute', top: '5px', left: '5px',
                    background: 'rgba(201,169,110,0.85)', color: BG,
                    fontSize: '8px', padding: '2px 5px', borderRadius: '4px',
                  }}>{p.badge}</div>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>
                  {catName || p.tag || '맞춤'}
                </div>
                {null}
                <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div
                  onClick={e => {
                    if (!showHomeEditChrome || !p.id) return
                    e.stopPropagation()
                    setHomeEditSheet({
                      kind: 'product_card',
                      id: String(p.id),
                      label: '상품 가격·재고',
                      draft: String(priceShow ?? ''),
                      draft2: String(p.stock ?? ''),
                      extra: p,
                    })
                  }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 400,
                    outline: showHomeEditChrome ? '1px dashed rgba(123,94,167,0.45)' : undefined,
                    borderRadius: 4,
                  }}
                >
                  {(priceShow != null ? Number(priceShow).toLocaleString() : (p.price?.toLocaleString?.() ?? '0'))}원
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div ref={routineMoreRef} id="home-routine-more" style={{ padding: routineExpanded ? '12px 16px 0' : '0 16px', marginTop: routineExpanded ? 4 : 0 }}>
        {routineExpanded ? (
          <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '14px 14px 16px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>오늘의 루틴</span>
              {(['am', 'midday', 'pm'] as const).map((slot) => {
                const label = slot === 'am' ? '☀️ 아침' : slot === 'midday' ? '🌤️ 점심' : '🌙 저녁'
                const on = routineTimeSlot === slot
                return (
                  <span key={slot} onClick={() => setRoutineTimeSlot(slot)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, cursor: 'pointer', background: on ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.06)', color: on ? '#C9A96E' : 'rgba(255,255,255,0.4)', border: on ? '1px solid rgba(201,169,110,0.4)' : '1px solid transparent' }}>
                    {label}
                  </span>
                )
              })}
            </div>
            {routineSteps.length === 0 ? (
              <div style={{ fontSize: 11, color: TEXT_MUTED }}>등록된 루틴 단계가 없어요</div>
            ) : (
              routineSteps
                .filter((step: any) => {
                  const t = String(step.routine_time || 'both')
                  if (routineTimeSlot === 'am') return t === 'am' || t === 'both'
                  if (routineTimeSlot === 'pm') return t === 'pm' || t === 'both'
                  if (routineTimeSlot === 'midday') return t === 'midday'
                  return true
                })
                .map((step: any) => {
                const sid = String(step.id ?? '')
                const pid = step.product_id || step.representative_product_id
                let rp = pid ? productById[String(pid)] : null
                if (!rp && step.routine_category) {
                  const byCat = products.filter((x: any) =>
                    String((x as any).routine_category || '').toLowerCase() ===
                    String(step.routine_category).toLowerCase()
                  )
                  const byTrackCat = byCat.filter((x: any) => {
                    const arr = Array.isArray(x?.categories?.target_tracks)
                      ? x.categories.target_tracks.map((y: any) => String(y))
                      : []
                    if (arr.length === 0) return true
                    return arr.includes('all') || arr.includes(hormoneTrack)
                  })
                  const byPref = byTrackCat.filter((x: any) => {
                    const bn = String(x.brands?.name || x.brand || '').toLowerCase()
                    const prefs: string[] = Array.isArray((motivationProfile as any)?.preferred_brands)
                      ? (motivationProfile as any).preferred_brands.map((b: any) => String(b).toLowerCase())
                      : []
                    if (prefs.length === 0) return true
                    return prefs.some((b: string) => bn.includes(b))
                  })
                  rp = byPref[0] || byTrackCat[0] || byCat[0] || null
                }
                if (!rp && step.category_id) {
                  const byCategory = products.filter((x: any) => String(x.category_id) === String(step.category_id))
                  const byTrack = byCategory.filter((x: any) => {
                    const arr = Array.isArray(x?.categories?.target_tracks) ? x.categories.target_tracks.map((y: any) => String(y)) : []
                    if (arr.length === 0) return true
                    return arr.includes('all') || arr.includes(hormoneTrack)
                  })
                  const byCheckin =
                    selectedCheckinTags.length === 0
                      ? byTrack
                      : byTrack.filter((x: any) => {
                          const t = String(x.tag || '').toLowerCase()
                          const qm = Array.isArray(x.quiz_match) ? x.quiz_match.map((y: any) => String(y).toLowerCase()).join(' ') : ''
                          const st = Array.isArray((x as any).skin_tags) ? (x as any).skin_tags.map((y: any) => String(y).toLowerCase()).join(' ') : ''
                          return selectedCheckinTags.some((k: string) => t.includes(k) || qm.includes(k) || st.includes(k))
                        })
                  rp = byCheckin[0] || byTrack[0] || byCategory[0] || null
                }
                const stepTitle = step.step_name || step.title || step.name || '단계'
                const thumb = rp ? (rp.storage_thumb_url || rp.thumb_img) : ''
                const priceNum = rp ? Number(rp.is_timesale ? (rp.sale_price ?? rp.retail_price) : rp.retail_price) || 0 : 0
                return (
                  <div
                    key={sid || stepTitle}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      padding: '12px 0',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', paddingTop: 16, flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={routineStepPick[sid] !== false}
                        onChange={() =>
                          setRoutineStepPick(prev => {
                            const cur = prev[sid] !== false
                            return { ...prev, [sid]: !cur }
                          })
                        }
                      />
                    </label>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.05)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                      }}
                    >
                      {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🧴'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>{stepTitle}</div>
                      {rp ? (
                        <>
                          <div style={{ fontSize: 12, color: '#fff', marginBottom: 4 }}>{rp.name}</div>
                          <div style={{ fontSize: 11, color: TEXT_MUTED }}>{priceNum.toLocaleString()}원</div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: TEXT_MUTED }}>준비중</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {rp ? (
                        <button
                          type="button"
                          onClick={() => {
                            cart.addToCart({
                              product_id: String(rp.id),
                              name: String(rp.name || ''),
                              price: priceNum,
                              thumb_img: String(thumb || ''),
                              quantity: 1,
                            })
                            setHomeToast('장바구니에 담았어요')
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(123,94,167,0.35)',
                            background: 'rgba(123,94,167,0.2)',
                            color: '#e8d9ff',
                            fontSize: 10,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          담기
                        </button>
                      ) : null}
                      {showHomeEditChrome ? (
                        <button
                          type="button"
                          onClick={() =>
                            setHomeEditSheet({
                              kind: 'routine',
                              id: sid,
                              label: '루틴 단계',
                              draft: String(stepTitle),
                              draft2: String(step.description ?? ''),
                              draft3: String(step.category_id ?? ''),
                              draftBool: step.is_active !== false,
                              extra: step,
                            })
                          }
                          style={{
                            padding: '4px 8px',
                            fontSize: 9,
                            borderRadius: 6,
                            border: '1px dashed #7B5EA7',
                            background: 'transparent',
                            color: '#B09AD0',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          ✏️
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => {
                  const lines: { rp: any; priceNum: number; thumb: string }[] = []
                  routineSteps.forEach((step: any) => {
                    if (!routineStepPick[String(step.id)]) return
                    const pid = step.product_id || step.representative_product_id
                    let rp = pid ? productById[String(pid)] : null
                    if (!rp && step.category_id) {
                      rp = products.find((x: any) => String(x.category_id) === String(step.category_id)) || null
                    }
                    if (!rp) return
                    const thumb = rp.storage_thumb_url || rp.thumb_img || ''
                    const priceNum = Number(rp.is_timesale ? (rp.sale_price ?? rp.retail_price) : rp.retail_price) || 0
                    lines.push({ rp, priceNum, thumb: String(thumb) })
                  })
                  lines.forEach(({ rp, priceNum, thumb }) => {
                    cart.addToCart({
                      product_id: String(rp.id),
                      name: String(rp.name || ''),
                      price: priceNum,
                      thumb_img: thumb,
                      quantity: 1,
                    })
                  })
                  setHomeToast(lines.length ? `선택 ${lines.length}개를 담았어요` : '담을 제품이 없어요')
                }}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  border: `1px solid ${GOLD}`,
                  background: 'rgba(201,169,110,0.12)',
                  color: GOLD,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                선택 담기
              </button>
              <button
                type="button"
                onClick={() => {
                  routineSteps.forEach((step: any) => {
                    const pid = step.product_id || step.representative_product_id
                    let rp = pid ? productById[String(pid)] : null
                    if (!rp && step.category_id) {
                      rp = products.find((x: any) => String(x.category_id) === String(step.category_id)) || null
                    }
                    if (!rp) return
                    const thumb = rp.storage_thumb_url || rp.thumb_img || ''
                    const priceNum = Number(rp.is_timesale ? (rp.sale_price ?? rp.retail_price) : rp.retail_price) || 0
                    cart.addToCart({
                      product_id: String(rp.id),
                      name: String(rp.name || ''),
                      price: priceNum,
                      thumb_img: String(thumb || ''),
                      quantity: 1,
                    })
                  })
                  setHomeToast('루틴 제품을 한번에 담았어요')
                }}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#7B5EA7',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                한번에 담기
              </button>
              <button
                type="button"
                onClick={() => {
                  const first = routineSteps[0]
                  if (!first) return
                  const pid = first.product_id || first.representative_product_id
                  let rp = pid ? productById[String(pid)] : null
                  if (!rp && first.category_id) {
                    rp = products.find((x: any) => String(x.category_id) === String(first.category_id)) || null
                  }
                  if (rp?.id) {
                    logProductNav(rp)
                    router.push(`/products/${rp.id}`)
                  }
                  else setHomeToast('바로구매할 제품이 없어요')
                }}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  border: `1px solid rgba(255,255,255,0.12)`,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                바로구매
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 피부 고민별 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>피부 고민별 솔루션</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
        {categoryBanners.length > 0 ? (
          <div
            onClick={() => {
              const b = categoryBanners[selectedConcern % categoryBanners.length]
              if (b?.banner_link) router.push(String(b.banner_link))
            }}
            style={{
              marginBottom: 10,
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              cursor: categoryBanners[selectedConcern % categoryBanners.length]?.banner_link ? 'pointer' : 'default',
            }}
          >
            {categoryBanners[selectedConcern % categoryBanners.length]?.banner_image_url ? (
              <img
                src={String(categoryBanners[selectedConcern % categoryBanners.length].banner_image_url)}
                alt=""
                style={{ width: '100%', height: 98, objectFit: 'cover' }}
              />
            ) : null}
            {categoryBanners[selectedConcern % categoryBanners.length]?.banner_text ? (
              <div style={{ padding: '9px 10px', fontSize: 12, color: '#fff' }}>
                {String(categoryBanners[selectedConcern % categoryBanners.length].banner_text)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {loading ? Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ minWidth: '58px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, height: '200px', animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
        )) : concernList.map((c: any, i: number) => (
          <div
            key={i}
            onClick={() => setSelectedConcern(i)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '58px', cursor: 'pointer' }}
          >
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
              background: i === selectedConcern ? 'rgba(201,169,110,0.12)' : CARD_BG,
              border: i === selectedConcern ? '1px solid rgba(201,169,110,0.3)' : CARD_BORDER,
            }}>{c.icon || '💧'}</div>
            <span style={{
              fontSize: '9px', fontWeight: 300, textAlign: 'center', whiteSpace: 'nowrap',
              color: i === selectedConcern ? GOLD : TEXT_MUTED,
            }}>{c.name}</span>
          </div>
        ))}
      </div>

      {/* ── BEST 랭킹 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
            🏆 {concernList[selectedConcern]?.name} BEST
          </span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>더보기 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {productList.slice(0, 4).map((p: any, i: number) => {
          const rankColors = ['#C9A96E', 'rgba(180,180,180,0.8)', 'rgba(180,120,60,0.8)']
          return (
            <div key={i} style={{
              width: 140, background: CARD_BG, border: CARD_BORDER,
              borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            }}>
              <div style={{
                width: 140,
                height: 140,
                borderRadius: 14,
                overflow: 'hidden',
                background: 'var(--bg2)',
                marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '38px', position: 'relative',
              }}>
                {p.storage_thumb_url || p.thumb_img ? <img src={p.storage_thumb_url || p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.icon || '🧴')}
                <div style={{
                  position: 'absolute', top: '7px', left: '7px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: rankColors[i] || 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 400,
                  color: i === 0 ? BG : '#fff',
                }}>{i + 1}</div>
                {i === 0 && (
                  <div style={{
                    position: 'absolute', top: '7px', right: '7px',
                    background: 'rgba(201,169,110,0.85)', color: BG,
                    fontSize: '8px', padding: '2px 5px', borderRadius: '4px',
                  }}>AI추천</div>
                )}
              </div>
              <div style={{ padding: '9px 11px' }}>
                {null}
                <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 400 }}>{(p.retail_price?.toLocaleString() ?? p.price?.toLocaleString())}원</span>
                  <span style={{ fontSize: '14px', cursor: 'pointer' }}>🤍</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ flex: 1, padding: '7px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.55)', textAlign: 'center', cursor: 'pointer' }}>🛍️ 담기</div>
                  <div style={{ flex: 1, padding: '7px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '9px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>🎁 선물</div>
                  <div style={{ flex: 1.3, padding: '7px 0', background: GOLD, borderRadius: '8px', fontSize: '9px', fontWeight: 400, color: BG, textAlign: 'center', cursor: 'pointer' }}>바로구매</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>


      {/* ── 타임세일·공구 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>⚡ 타임세일 · 공구</span>
          <span
            onClick={() => router.push(saleTab === 'sale' ? '/time-sales' : '/group-buys')}
            style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}
          >
            더보기 →
          </span>
        </div>
        {/* 탭 */}
        <div style={{ display: 'flex', border: CARD_BORDER, borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
          {(['group', 'sale'] as const).map((tab) => (
            <div
              key={tab}
              onClick={() => setSaleTab(tab)}
              style={{
                flex: 1, padding: '9px 0', textAlign: 'center', fontSize: '12px',
                fontWeight: saleTab === tab ? 400 : 300,
                background: saleTab === tab
                  ? (tab === 'sale' ? 'rgba(200,60,40,0.15)' : 'rgba(60,80,200,0.15)')
                  : 'transparent',
                color: saleTab === tab
                  ? (tab === 'sale' ? '#E07060' : 'rgba(120,160,255,0.9)')
                  : TEXT_MUTED,
                cursor: 'pointer',
              }}
            >
              {tab === 'sale' ? '🔥 타임세일' : '👥 공동구매'}
            </div>
          ))}
        </div>

        {/* 타임세일 */}
        {saleTab === 'sale' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {saleList.map((item: any, i: number) => (
              <div key={i} onClick={() => { logProductNav({ ...(item.product || {}), id: item.id, retail_price: item.product?.retail_price, sale_price: item.product?.sale_price, is_timesale: item.product?.is_timesale, categories: item.product?.categories }); router.push(`/products/${item.id}`) }} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    overflow: 'hidden',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg,#1a1510,#2a2015)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', flexShrink: 0, position: 'relative',
                  }}>
                    {(item.product?.thumb_img ? <img src={item.product.thumb_img} alt={item.product?.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', maxWidth: '100%', overflow: 'hidden' }} /> : (item.icon || '🧴'))}
                    <div
                      onClick={e => {
                        if (!showHomeEditChrome) return
                        e.stopPropagation()
                        const raw = item.timesale_ends_at
                        const iso =
                          raw && !Number.isNaN(new Date(raw).getTime())
                            ? new Date(raw).toISOString().slice(0, 16)
                            : new Date(Date.now() + 86400000).toISOString().slice(0, 16)
                        setHomeEditSheet({
                          kind: 'timesale',
                          id: String(item.id),
                          label: '타임세일 (할인율·마감)',
                          draft: String(item.disc ?? 0),
                          draft2: iso,
                          draftNum: i,
                          extra: item,
                        })
                      }}
                      style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        background: '#E04030', borderRadius: '20px', padding: '2px 6px',
                        fontSize: '9px', color: '#fff', border: `1.5px solid ${BG}`,
                        cursor: showHomeEditChrome ? 'pointer' : undefined,
                        outline: showHomeEditChrome ? '1px dashed rgba(255,255,255,0.5)' : undefined,
                      }}
                    >-{item.disc}%</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>
                      {item.brand || item.product?.brand}
                    </div>
                    <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                      {item.product?.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', color: TEXT_DIM, textDecoration: 'line-through' }}>
                        {(item.orig ?? item.original_price)?.toLocaleString()}원
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 400, color: '#E07060' }}>
                        {item.product?.retail_price?.toLocaleString()}원
                      </span>
                    </div>
                    {/* 개별 타이머 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '9px', color: TEXT_DIM }}>⏱ 마감</span>
                      {[timers[i]?.h, timers[i]?.m, timers[i]?.s].map((v, ti) => (
                        <span key={ti} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {ti > 0 && <span style={{ color: 'rgba(220,60,40,0.4)', fontSize: '11px' }}>:</span>}
                          <span style={{
                            background: 'rgba(220,60,40,0.15)',
                            border: '1px solid rgba(220,60,40,0.28)',
                            borderRadius: '5px', padding: '2px 6px',
                            fontSize: '11px', color: '#E07060', fontFamily: 'monospace',
                          }}>{pad(v || 0)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
                  <div style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', cursor: 'pointer' }}>🛍️ 담기</div>
                  <div style={{ flex: 1, padding: '8px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>🎁 선물</div>
                  <div onClick={async (e) => {
                    e.stopPropagation()
                    logProductNav({ ...(item.product || {}), id: item.id, retail_price: item.product?.retail_price })
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session) {
                      router.push(`/products/${item.id}`)
                      return
                    }
                    router.push(`/products/${item.id}`)
                  }} style={{ flex: 1.3, padding: '8px 0', background: '#C04030', borderRadius: '8px', fontSize: '11px', fontWeight: 400, color: '#fff', textAlign: 'center', cursor: 'pointer' }}>지금 구매</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 공동구매 */}
        {saleTab === 'group' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {groupBuyList.slice(0, 3).map((item: any, i: number) => {
              const current = Number(item.current_count ?? item.joined_count ?? item.participants ?? 127)
              const target = Number(item.target_count ?? item.goal_count ?? item.max_participants ?? 200)
              const pct = target > 0 ? Math.min(100, Math.max(0, Math.round((current / target) * 100))) : 0
              const remaining = Math.max(0, target - current)
              const origPrice = item.orig ?? item.original_price ?? item.product?.retail_price
              const salePrice = item.group_price ?? item.sale ?? item.sale_price ?? item.product?.retail_price
              const discPct = Number(item.disc ?? item.discount_rate ?? (origPrice && salePrice ? Math.round(((Number(origPrice) - Number(salePrice)) / Number(origPrice)) * 100) : 0))
              return (
              <div key={i} onClick={() => { const pid = item.product_id || item.id; logProductNav({ ...(item.product || {}), id: pid }); router.push(`/products/${pid}`) }} style={{ background: CARD_BG, border: '1px solid rgba(80,120,220,0.2)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg,rgba(60,80,200,0.15),rgba(80,120,240,0.1))', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(120,160,255,0.9)', fontFamily: 'monospace' }}>👥 공동구매 · </span>
                  <span style={{ fontSize: '10px', color: TEXT_MUTED }}>{current}/{target}명</span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#4060C0,#8090E0)' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
                  <div style={{ width: '120px', height: '120px', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>
                    {(item.product?.thumb_img ? <img src={item.product.thumb_img} alt={item.product?.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', maxWidth: '100%', overflow: 'hidden' }} /> : (item.icon || '🧴'))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{item.product?.brand_name || item.brand || item.product?.brand}</div>
                    <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>{item.product?.name}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(120,160,255,0.8)', marginBottom: '4px' }}>
                      {String(item.gift_title || '').trim()
                        ? String(item.gift_title).trim()
                        : `🎯 ${target}명 달성 시 발송 · ${remaining}명 더 필요`}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: TEXT_DIM, textDecoration: 'line-through' }}>
                        {(origPrice as any)?.toLocaleString?.() ?? origPrice}원
                      </span>
                      <span style={{ fontSize: '15px', color: 'rgba(120,160,255,0.9)' }}>{(salePrice as any)?.toLocaleString?.() ?? salePrice}원 {discPct ? `(-${discPct}%)` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
                      <span style={{ fontSize: '9px', color: TEXT_DIM }}>⏱ 마감</span>
                      {[groupTimers[i]?.h, groupTimers[i]?.m, groupTimers[i]?.s].map((v, ti) => (
                        <span key={ti} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {ti > 0 && <span style={{ color: 'rgba(220,60,40,0.4)', fontSize: '11px' }}>:</span>}
                          <span style={{
                            background: 'rgba(220,60,40,0.15)',
                            border: '1px solid rgba(220,60,40,0.28)',
                            borderRadius: '5px', padding: '2px 6px',
                            fontSize: '11px', color: '#E07060', fontFamily: 'monospace',
                          }}>{pad(v || 0)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
                  <div onClick={(e) => {
                    e.stopPropagation()
                    const pid = item.product_id || item.id
                    logProductNav({ ...(item.product || {}), id: pid })
                    router.push(`/products/${pid}`)
                  }} style={{ flex: 2, padding: '9px 0', background: 'linear-gradient(135deg,#4060C0,#6080E0)', borderRadius: '8px', fontSize: '11px', color: '#fff', textAlign: 'center', cursor: 'pointer' }}>👥 공구 참여하기</div>
                  <div style={{ flex: 1, padding: '9px 0', background: 'rgba(80,120,220,0.1)', border: '1px solid rgba(80,120,220,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(120,160,255,0.8)', textAlign: 'center', cursor: 'pointer' }}>📤 친구 초대</div>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 포토·영상 리뷰 ── */}
      {/* TODO: reviews 테이블 photo_url, video_url 있는 것만 조회 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>📸 포토·영상 리뷰</span>
          <span onClick={() => router.push('/reviews')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>127개 ›</span>
        </div>
        {/* 일촌 추천 스트립 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '10px', marginBottom: '8px' }}>
          <div style={{ display: 'flex' }}>
            {['🌸','🌺','💜'].map((a, i) => (
              <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', border: `1.5px solid ${BG}`, marginLeft: i > 0 ? '-6px' : '0' }}>{a}</div>
            ))}
          </div>
          <span style={{ fontSize: '10px', color: TEXT_MUTED, flex: 1 }}>일촌 <span style={{ color: GOLD }}>소미님 외 2명</span>이 포토 리뷰를 남겼어요</span>
          <span onClick={() => router.push('/reviews')} style={{ fontSize: '10px', color: GOLD, cursor: 'pointer' }}>보기</span>
        </div>
        {/* 포토 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px', borderRadius: '14px', overflow: 'hidden' }}>
          {[
            { emoji: '🧴', bg: 'linear-gradient(135deg,#2a1a30,#1a1020)', badge: '일촌', isVid: false },
            { emoji: '✨', bg: 'linear-gradient(135deg,#0a1a2a,#1a2a3a)', badge: '영상', isVid: true, dur: '0:24' },
            { emoji: '🌿', bg: 'linear-gradient(135deg,#0a1a0a,#1a2a1a)', badge: '', isVid: false },
            { emoji: '💧', bg: 'linear-gradient(135deg,#1a1020,#2a1830)', badge: '', isVid: false },
            { emoji: '🎬', bg: 'linear-gradient(135deg,#1a0a2a,#2a1540)', badge: '영상', isVid: true, dur: '0:18' },
            { emoji: '+122', bg: 'rgba(255,255,255,0.04)', badge: '', isVid: false, isMore: true },
          ].map((item: any, i: number) => (
            <div key={i} onClick={() => router.push('/reviews')} style={{ aspectRatio: '1', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: item.isMore ? '14px' : '28px', position: 'relative', cursor: 'pointer', flexDirection: item.isMore ? 'column' : 'row', gap: item.isMore ? '2px' : '0' }}>
              {item.isMore ? (
                <>
                  <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>{item.emoji}</span>
                  <span style={{ fontSize: '9px', color: TEXT_DIM }}>더보기</span>
                </>
              ) : (
                <>
                  {item.emoji}
                  {item.badge === '일촌' && <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(201,169,110,0.85)', borderRadius: '4px', padding: '1px 5px', fontSize: '7px', color: BG }}>일촌</div>}
                  {item.isVid && (
                    <>
                      <div style={{ position: 'absolute', top: '5px', left: '5px', background: 'rgba(60,120,220,0.9)', borderRadius: '4px', padding: '1px 5px', fontSize: '7px', color: '#fff' }}>영상</div>
                      <div style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '1px 4px', fontSize: '8px', color: '#fff', fontFamily: 'monospace' }}>{item.dur}</div>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 롤링 리뷰 ── */}
      <div style={{ margin: '16px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_DIM }}>⭐ 실시간 리뷰</span>
          <span onClick={() => router.push('/reviews')} style={{ fontSize: '10px', color: GOLD, cursor: 'pointer' }}>전체보기 →</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🧴</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', marginBottom: '3px' }}>⭐⭐⭐⭐⭐</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
              &quot;환절기에 이 크림 덕분에 피부 안 땅겼어요. 민감한 피부에도 자극 없이 쓸 수 있어요 💧&quot;
            </div>
            <div style={{ fontSize: '9px', color: TEXT_DIM, marginTop: '3px' }}>
              {'건성피부 · ' + (motivationProfile?.full_name || '고객') + '님 · CIVASAN MESS CREAM'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', gap: '6px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '3px 8px', background: 'rgba(255,255,255,0.04)',
                border: CARD_BORDER, borderRadius: '6px',
                fontSize: '10px', color: TEXT_MUTED, cursor: 'pointer',
              }}>👍 도움돼요 24</div>
              <span style={{ fontSize: '9px', color: 'rgba(201,169,110,0.6)' }}>+5P 적립</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 살롱 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>📍 내 주변 관리샵</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>지도보기 ›</span>
        </div>
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
          {['📍 거리순', '🔥 인기순', '⭐ 리뷰순', '💆 페이셜', '🌿 바디', '✨ 클리닉'].map((f, i) => (
            <div key={i} style={{
              padding: '5px 12px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '10px',
              background: i === 0 ? 'rgba(201,169,110,0.15)' : CARD_BG,
              border: i === 0 ? '1px solid rgba(201,169,110,0.4)' : CARD_BORDER,
              borderRadius: '20px',
              color: i === 0 ? GOLD : TEXT_MUTED,
            }}>{f}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {salonList.map((salon: any, i: number) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', padding: '13px 14px', display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a1520,#2a1a30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>💆</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '2px' }}>{salon.name}</div>
                <div style={{ fontSize: '10px', color: TEXT_MUTED, marginBottom: '4px' }}>
                  {salon.open && (
                    <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#3ab870', marginRight: '4px' }} />
                  )}
                  ⭐ {salon.rating} · 리뷰 {salon.reviews} · {salon.area}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(salon.tags || []).map((tag: string, ti: number) => (
                    <span key={ti} style={{ fontSize: '8px', background: 'rgba(255,255,255,0.05)', color: TEXT_MUTED, borderRadius: '5px', padding: '2px 6px' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                <div style={{
                  fontSize: '9px', padding: '3px 8px', borderRadius: '10px',
                  background: salon.open ? 'rgba(74,200,120,0.15)' : 'rgba(200,80,80,0.1)',
                  color: salon.open ? '#3ab870' : '#c05050',
                }}>{salon.open ? '영업중' : '영업종료'}</div>
                <div style={{ fontSize: '9px', color: TEXT_DIM }}>{salon.dist}</div>
                <div style={{ padding: '6px 10px', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', fontSize: '10px', color: GOLD, cursor: 'pointer' }}>예약하기</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 신제품 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>🆕 새로 나왔어요</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {newList.map((item: any, i: number) => (
          <div key={i} onClick={() => { logProductNav(item); router.push(`/products/${item.id}`) }} style={{ width: 140, background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{
              width: 140,
              height: 140,
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--bg2)',
              marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', position: 'relative'
            }}>
              {(item.storage_thumb_url || item.thumb_img ? <img src={item.storage_thumb_url || item.thumb_img} alt={item.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (item.icon || '💜'))}
              <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'linear-gradient(90deg,#6040E0,#A040E0)', borderRadius: '5px', padding: '2px 6px', fontSize: '8px', color: '#fff' }}>NEW</div>
            </div>
            <div style={{ padding: '9px 10px' }}>
              {null}
              <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ fontSize: '12px', fontWeight: 400 }}>{(item.retail_price?.toLocaleString() ?? item.price?.toLocaleString())}원</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 브랜드 원형 그리드 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>🏷 브랜드별 보기</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 브랜드 ›</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
          {['전체', '🇪🇺 유럽', '🇰🇷 국내', '🇯🇵 일본', '클리닉', '바디'].map((tab, i) => (
            <div key={i} style={{
              padding: '4px 12px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '10px',
              background: i === 0 ? GOLD : CARD_BG,
              border: i === 0 ? 'none' : CARD_BORDER,
              borderRadius: '20px',
              color: i === 0 ? BG : TEXT_MUTED,
              fontWeight: i === 0 ? 400 : 300,
            }}>{tab}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          {brandList.map((brand: any, i: number) => {
            const raw = `${brand.label || ''} ${brand.name || ''}`.toUpperCase()
            const genericBg = !brand.bg || brand.bg === 'rgba(201,169,110,0.1)'
            let circleBg = brand.bg || 'rgba(201,169,110,0.1)'
            let circleBorder = brand.border || 'rgba(201,169,110,0.3)'
            let circleColor = brand.color || GOLD
            if (genericBg) {
              if (/GERNETIC|제네틱|제르/.test(raw)) { circleBg = 'rgba(28,52,38,0.55)'; circleBorder = 'rgba(56,110,76,0.5)'; circleColor = '#6fc49a' }
              else if (/CIVASAN|시바산|프리미엄/.test(raw)) { circleBg = 'rgba(22,48,52,0.55)'; circleBorder = 'rgba(44,100,108,0.45)'; circleColor = '#5eb3bc' }
              else if (/ANNA|안나|로자/.test(raw)) { circleBg = 'rgba(62,28,38,0.5)'; circleBorder = 'rgba(120,48,68,0.45)'; circleColor = '#c97d8f' }
              else if (/ETR|ESTER|에뜨|에스터|레벨/.test(raw)) { circleBg = 'rgba(22,32,56,0.55)'; circleBorder = 'rgba(44,58,108,0.5)'; circleColor = '#7a90d4' }
              else if (/SELVERT|셀버트|더말/.test(raw)) { circleBg = 'rgba(48,44,22,0.55)'; circleBorder = 'rgba(110,98,42,0.45)'; circleColor = '#b8a45a' }
              else if (/SANTE|상떼/.test(raw)) { circleBg = 'rgba(58,36,22,0.5)'; circleBorder = 'rgba(130,72,42,0.45)'; circleColor = '#c4865c' }
              else if (/보떼|떼덤|BEAUTE|BIOD/.test(raw)) { circleBg = 'rgba(48,28,52,0.5)'; circleBorder = 'rgba(88,44,98,0.45)'; circleColor = '#b892c4' }
              else if (/SHOPBELLE|샵벨/.test(raw)) { circleBg = 'rgba(52,32,58,0.48)'; circleBorder = 'rgba(95,58,108,0.42)'; circleColor = '#c999d4' }
              else if (/THALAC|탈락/.test(raw)) { circleBg = 'rgba(22,48,58,0.5)'; circleBorder = 'rgba(42,88,108,0.45)'; circleColor = '#5eb0c9' }
              else if (/SOTHYS|소티스/.test(raw)) { circleBg = 'rgba(58,38,18,0.52)'; circleBorder = 'rgba(130,82,36,0.45)'; circleColor = '#d4a060' }
              else if (/PHYTO|피토/.test(raw)) { circleBg = 'rgba(32,48,28,0.5)'; circleBorder = 'rgba(58,88,48,0.42)'; circleColor = '#8fbc7a' }
            }
            return (
            <div key={i} onClick={() => router.push(`/brands/${brand.id}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <div style={{
                width: '58px', height: '58px', borderRadius: '50%',
                background: circleBg,
                border: `1.5px solid ${circleBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 400,
                color: circleColor,
                fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.3,
              }}>
                {brand.name?.slice(0, 4)}<br />{brand.name?.slice(4, 8)}
              </div>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>
                {brand.label || brand.name}
              </span>
            </div>
            )
          })}
          {/* 더보기 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <div style={{
              width: '58px', height: '58px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px dashed rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '2px',
            }}>
              <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>+</span>
              <span style={{ fontSize: '8px', color: TEXT_DIM }}>23개</span>
            </div>
            <span style={{ fontSize: '9px', color: TEXT_DIM }}>전체보기</span>
          </div>
        </div>
      </div>

      {homeContestBanner ? (
        <div
          style={{
            margin: '12px 16px 0',
            borderRadius: 18,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(123,94,167,0.2), rgba(201,169,110,0.1))',
            border: '1px solid rgba(123,94,167,0.3)',
            padding: '16px 18px',
            position: 'relative',
          }}
        >
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>🏆 이달의 케어룸 컨테스트</div>
          <div style={{ fontSize: 15, fontWeight: 300, color: '#fff', lineHeight: 1.45, marginBottom: 6 }}>{homeContestBanner.title}</div>
          <div style={{ fontSize: 12, color: '#c4a7e7', marginBottom: 10 }}>투표하면 반값 혜택!</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(123,94,167,0.25)',
                border: '1px solid rgba(123,94,167,0.45)',
                color: '#e8d6ff',
                fontFamily: 'monospace',
              }}
            >
              {(() => {
                const endRaw = String(homeContestBanner.ends_at ?? '')
                const endSlice = endRaw.slice(0, 10)
                let endDay: number
                if (/^\d{4}-\d{2}-\d{2}$/.test(endSlice)) {
                  const [ey, em, ed] = endSlice.split('-').map(Number)
                  endDay = seoulNoonUtcMs(ey, em - 1, ed)
                } else {
                  const e = new Date(homeContestBanner.ends_at)
                  endDay = seoulNoonUtcMs(e.getFullYear(), e.getMonth(), e.getDate())
                }
                const { y: ty, m0: tm, d: td } = seoulYmdForHydrationSafeCalendar(seoulClient)
                const today = seoulNoonUtcMs(ty, tm, td)
                const n = Math.ceil((endDay - today) / 86400000)
                return n <= 0 ? 'D-DAY' : `D-${n}일`
              })()}
            </span>
            <button
              type="button"
              onClick={() => router.push('/community?tab=contest')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '8px 16px',
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 12,
                fontWeight: 300,
                cursor: 'pointer',
              }}
            >
              지금 투표하기
            </button>
          </div>
        </div>
      ) : null}

      {/* ── 히어로 배너 ── */}
      <div style={{
        margin: '12px 16px 0', height: '148px',
        borderRadius: '20px', overflow: 'hidden',
        background: 'linear-gradient(135deg,#1a0a2a,#2d1545)',
        position: 'relative', display: 'flex',
      }}>
        <div style={{
          position: 'relative', zIndex: 2, padding: '18px 20px',
          height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', flex: 1,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.1)', borderRadius: '20px',
              padding: '3px 10px', fontSize: '10px', fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.7)', marginBottom: '7px',
            }}>✦ 3월 · SPRING SKIN</div>
            <div style={{ fontSize: '17px', fontWeight: 300, lineHeight: 1.5 }}>
              봄 피부 변화,<br />
              <em style={{ color: GOLD, fontStyle: 'normal' }}>AI가 먼저</em> 알아챕니다
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '14px', height: '4px', borderRadius: '2px', background: GOLD }} />
            <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
          </div>
        </div>
        <div style={{
          position: 'absolute', right: '16px', top: '50%',
          transform: 'translateY(-50%)', fontSize: '56px', opacity: 0.85,
        }}>🌸</div>
      </div>
      <div
        onClick={() => router.push('/my/skin-analysis')}
        onTouchStart={(e) => setTouchStartX(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchStartX === null || motivationCarousel.length <= 1) return
          const endX = e.changedTouches[0]?.clientX ?? touchStartX
          const diff = touchStartX - endX
          if (Math.abs(diff) < 40) return
          if (diff > 0) setMotivationIdx((prev) => (prev + 1) % motivationCarousel.length)
          else setMotivationIdx((prev) => (prev - 1 + motivationCarousel.length) % motivationCarousel.length)
        }}
        style={{
          margin: '12px 16px 0',
          background: 'rgba(123,94,167,0.08)',
          border: '1px solid rgba(123,94,167,0.2)',
          borderRadius: '14px',
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <span style={{ fontSize: '28px' }}>{motivationMsg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {motivationMsg.text}
          </div>
          <div style={{ fontSize: '10px', color: '#7B5EA7', marginTop: '4px' }}>
            오늘 루틴 체크하기 →
          </div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
            {motivationCarousel.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMotivationIdx(i)
                }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === (motivationIdx % Math.max(1, motivationCarousel.length)) ? '#7B5EA7' : 'rgba(123,94,167,0.25)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 브랜드 영상 ── */}
      {/* TODO: brand_videos 테이블에서 is_active=true, order by sort_order */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>🎬 브랜드 영상</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {[
          { brand: 'CIVASAN', title: 'MESS CREAM 신제품 출시', duration: '2:34', isLive: true, bg: 'linear-gradient(135deg,#1a1510,#2a2015)', icon: '🧴' },
          { brand: 'GERNETIC', title: '바이오 세럼 사용법', duration: '1:45', isLive: false, bg: 'linear-gradient(135deg,#0a1a10,#1a2a15)', icon: '🌿' },
          { brand: 'AURAN', title: '살롱 케어 브이로그', duration: '3:12', isLive: false, bg: 'linear-gradient(135deg,#1a0a2a,#2a1540)', icon: '💆' },
          { brand: 'THALAC', title: '마린 라인 소개', duration: '2:10', isLive: false, bg: 'linear-gradient(135deg,#0a1a2a,#1a2a3a)', icon: '🌊' },
        ].map((v: any, i: number) => (
          <div key={i} style={{ minWidth: i === 0 ? '230px' : '150px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ height: i === 0 ? '130px' : '96px', background: v.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i === 0 ? '48px' : '36px', position: 'relative' }}>
              {v.icon}
              <div style={{ position: 'absolute', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>▶</div>
              {v.isLive && (
                <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'rgba(220,60,60,0.85)', borderRadius: '5px', padding: '2px 7px', fontSize: '9px', color: '#fff' }}>LIVE</div>
              )}
              <div style={{ position: 'absolute', bottom: '7px', right: '7px', background: 'rgba(0,0,0,0.55)', borderRadius: '4px', padding: '2px 5px', fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>{v.duration}</div>
            </div>
            <div style={{ padding: '9px 11px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{v.brand}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{v.title}</div>
            </div>
          </div>
        ))}
      </div>

      {routineMentorOpen ? (
        <>
          <div
            onClick={() => setRoutineMentorOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120 }}
          />
          <div
            style={{
              position: 'fixed',
              left: 20,
              right: 20,
              top: '20%',
              maxWidth: 350,
              margin: '0 auto',
              background: '#1f1a26',
              border: '1px solid rgba(123,94,167,0.35)',
              borderRadius: 16,
              padding: 18,
              zIndex: 121,
              maxHeight: '56vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>오늘의 루틴 추천</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
              {routineSteps.map((s: any) => String(s.description || '').trim()).filter(Boolean).join('\n\n') ||
                '루틴 단계에 설명을 등록하면 이곳에 멘트가 모여요.'}
            </div>
            <button
              type="button"
              onClick={() => setRoutineMentorOpen(false)}
              style={{
                marginTop: 14,
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: '#7B5EA7',
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              확인
            </button>
          </div>
        </>
      ) : null}
      {questionPopup ? (
        <>
          <div onClick={() => setQuestionPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 124 }} />
          <div style={{ position: 'fixed', left: 18, right: 18, top: '20%', maxWidth: 360, margin: '0 auto', background: '#1f1a26', border: '1px solid rgba(123,94,167,0.35)', borderRadius: 14, padding: 14, zIndex: 125 }}>
            <div style={{ fontSize: 12, color: 'rgba(196,170,230,0.85)', marginBottom: 8 }}>질문</div>
            <div style={{ fontSize: 13, color: '#fff', marginBottom: 10 }}>{String(questionPopup.question_text || '')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {((questionPopup.answer_type === 'yesno'
                ? ['예', '아니오']
                : Array.isArray(questionPopup.options)
                  ? questionPopup.options
                  : String(questionPopup.options || '').split(/[,\n]/).map((x: string) => x.trim()).filter(Boolean)) as string[]).slice(0, 8).map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={async () => {
                    const d = new Date().toISOString().slice(0, 10)
                    if (!myUserId || !questionPopup?.id) return
                    const { data: dup } = await supabase
                      .from('customer_question_answers')
                      .select('id')
                      .eq('auth_id', myUserId)
                      .eq('question_id', questionPopup.id)
                      .eq('answer_date', d)
                      .limit(1)
                    if (dup && dup.length > 0) {
                      setQuestionPopup(null)
                      return
                    }
                    await supabase.from('customer_question_answers').insert({ auth_id: myUserId, question_id: questionPopup.id, answer_value: op, answer_date: d } as any)
                    void logUserBehavior(supabase, myUserId, 'question_answer', String(questionPopup.id), { answer: op })
                    setQuestionPopup(null)
                    setHomeToast('답변 저장 완료')
                  }}
                  style={{ padding: '6px 9px', borderRadius: 999, border: '1px solid rgba(123,94,167,0.42)', background: 'rgba(123,94,167,0.2)', color: '#e8d9ff', fontSize: 11, cursor: 'pointer' }}
                >
                  {op}
                </button>
              ))}
            </div>
            {String(questionPopup.answer_type) === 'text' ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={questionAnswer} onChange={e => setQuestionAnswer(e.target.value)} placeholder="답변 입력" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 12 }} />
                <button
                  type="button"
                  onClick={async () => {
                    const d = new Date().toISOString().slice(0, 10)
                    if (!myUserId || !questionPopup?.id || !questionAnswer.trim()) return
                    const { data: dup } = await supabase
                      .from('customer_question_answers')
                      .select('id')
                      .eq('auth_id', myUserId)
                      .eq('question_id', questionPopup.id)
                      .eq('answer_date', d)
                      .limit(1)
                    if (dup && dup.length > 0) {
                      setQuestionPopup(null)
                      return
                    }
                    await supabase.from('customer_question_answers').insert({ auth_id: myUserId, question_id: questionPopup.id, answer_value: questionAnswer.trim(), answer_date: d } as any)
                    void logUserBehavior(supabase, myUserId, 'question_answer', String(questionPopup.id), { answer: questionAnswer.trim() })
                    setQuestionPopup(null)
                    setHomeToast('답변 저장 완료')
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.2)', color: '#e8d4a8', fontSize: 11, cursor: 'pointer' }}
                >
                  저장
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {homeEditSheet ? (
        <>
          <div
            onClick={() => !homeEditSaving && setHomeEditSheet(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 130 }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxWidth: 390,
              margin: '0 auto',
              background: '#1a1610',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              zIndex: 131,
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, color: '#fff' }}>{homeEditSheet.label}</div>
              <button
                type="button"
                disabled={homeEditSaving}
                onClick={() => setHomeEditSheet(null)}
                style={{ border: 'none', background: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            {homeEditSheet.kind === 'checkin' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>이모지</label>
                <input
                  value={sheetFields.d}
                  onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>라벨</label>
                <input
                  value={sheetFields.d2}
                  onChange={e => setSheetFields(s => ({ ...s, d2: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>연결 태그</label>
                <input
                  value={sheetFields.d3}
                  onChange={e => setSheetFields(s => ({ ...s, d3: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>추천 멘트</label>
                <textarea
                  value={sheetFields.d4}
                  onChange={e => setSheetFields(s => ({ ...s, d4: e.target.value }))}
                  rows={3}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff', resize: 'vertical' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>순서</label>
                <input
                  type="number"
                  value={sheetFields.n}
                  onChange={e => setSheetFields(s => ({ ...s, n: Number(e.target.value) }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ccc' }}>
                  <input
                    type="checkbox"
                    checked={sheetFields.b}
                    onChange={e => setSheetFields(s => ({ ...s, b: e.target.checked }))}
                  />
                  활성
                </label>
              </div>
            ) : null}
            {homeEditSheet.kind === 'routine' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>단계명</label>
                <input
                  value={sheetFields.d}
                  onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>설명</label>
                <textarea
                  value={sheetFields.d2}
                  onChange={e => setSheetFields(s => ({ ...s, d2: e.target.value }))}
                  rows={3}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff', resize: 'vertical' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>연결 카테고리 UUID</label>
                <input
                  value={sheetFields.d3}
                  onChange={e => setSheetFields(s => ({ ...s, d3: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ccc' }}>
                  <input
                    type="checkbox"
                    checked={sheetFields.b}
                    onChange={e => setSheetFields(s => ({ ...s, b: e.target.checked }))}
                  />
                  활성
                </label>
              </div>
            ) : null}
            {(homeEditSheet.kind === 'hormone_main' || homeEditSheet.kind === 'hormone_sub') ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {homeEditSheet.kind === 'hormone_main' ? (
                  <>
                    <label style={{ fontSize: 11, color: TEXT_MUTED }}>메인 문구</label>
                    <textarea
                      value={sheetFields.d}
                      onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                      rows={3}
                      style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff', resize: 'vertical' }}
                    />
                    <label style={{ fontSize: 11, color: TEXT_MUTED }}>서브 (오늘의 피부 사이클)</label>
                    <input
                      value={sheetFields.d2}
                      onChange={e => setSheetFields(s => ({ ...s, d2: e.target.value }))}
                      style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                    />
                  </>
                ) : (
                  <>
                    <label style={{ fontSize: 11, color: TEXT_MUTED }}>서브 문구</label>
                    <input
                      value={sheetFields.d}
                      onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                      style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                    />
                  </>
                )}
              </div>
            ) : null}
            {homeEditSheet.kind === 'care_banner' ? (
              <textarea
                value={sheetFields.d}
                onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff', resize: 'vertical' }}
              />
            ) : null}
            {homeEditSheet.kind === 'product_card' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>판매가(원)</label>
                <input
                  type="number"
                  value={sheetFields.d}
                  onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>재고</label>
                <input
                  type="number"
                  value={sheetFields.d2}
                  onChange={e => setSheetFields(s => ({ ...s, d2: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
              </div>
            ) : null}
            {homeEditSheet.kind === 'timesale' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>할인율 (%)</label>
                <input
                  type="number"
                  value={sheetFields.d}
                  onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>마감 (현지시간)</label>
                <input
                  type="datetime-local"
                  value={sheetFields.d2}
                  onChange={e => setSheetFields(s => ({ ...s, d2: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>노출 순서 (0=먼저)</label>
                <input
                  type="number"
                  value={sheetFields.n}
                  onChange={e => setSheetFields(s => ({ ...s, n: Number(e.target.value) }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
              </div>
            ) : null}
            {homeEditSheet.kind === 'notice_row' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>제목</label>
                <input
                  value={sheetFields.d}
                  onChange={e => setSheetFields(s => ({ ...s, d: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>본문</label>
                <textarea
                  value={sheetFields.d2}
                  onChange={e => setSheetFields(s => ({ ...s, d2: e.target.value }))}
                  rows={4}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff', resize: 'vertical' }}
                />
                <label style={{ fontSize: 11, color: TEXT_MUTED }}>링크 URL</label>
                <input
                  value={sheetFields.d3}
                  onChange={e => setSheetFields(s => ({ ...s, d3: e.target.value }))}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#0d0b09', color: '#fff' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ccc' }}>
                  <input
                    type="checkbox"
                    checked={sheetFields.b}
                    onChange={e => setSheetFields(s => ({ ...s, b: e.target.checked }))}
                  />
                  중요 공지
                </label>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                disabled={homeEditSaving}
                onClick={() => setHomeEditSheet(null)}
                style={{
                  flex: 1,
                  padding: 13,
                  borderRadius: 10,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={homeEditSaving}
                onClick={() => {
                  void (async () => {
                    if (!homeEditSheet) return
                    setHomeEditSaving(true)
                    try {
                      const k = homeEditSheet.kind
                      if (k === 'checkin' && homeEditSheet.id) {
                        let err = (
                          await supabase
                            .from('checkin_options')
                            .update({
                              emoji: sheetFields.d,
                              label: sheetFields.d2,
                              linked_tag: sheetFields.d3,
                              recommendation_message: sheetFields.d4,
                              recommend_copy: sheetFields.d4,
                              sort_order: sheetFields.n,
                              is_active: sheetFields.b,
                            })
                            .eq('id', homeEditSheet.id)
                        ).error
                        if (err) {
                          err = (
                            await supabase
                              .from('checkin_options')
                              .update({
                                emoji: sheetFields.d,
                                label: sheetFields.d2,
                                linked_tag: sheetFields.d3,
                                recommendation_ment: sheetFields.d4,
                                sort_order: sheetFields.n,
                                is_active: sheetFields.b,
                              })
                              .eq('id', homeEditSheet.id)
                          ).error
                        }
                        if (err) throw err
                        const { data: chk } = await supabase
                          .from('checkin_options')
                          .select('*')
                          .eq('is_active', true)
                          .order('sort_order', { ascending: true })
                        setCheckinOptions(chk || [])
                      } else if (k === 'routine' && homeEditSheet.id) {
                        let err = (
                          await supabase
                            .from('routine_steps')
                            .update({
                              step_name: sheetFields.d,
                              description: sheetFields.d2,
                              category_id: sheetFields.d3.trim() || null,
                              is_active: sheetFields.b,
                            })
                            .eq('id', homeEditSheet.id)
                        ).error
                        if (err) {
                          err = (
                            await supabase
                              .from('routine_steps')
                              .update({
                                title: sheetFields.d,
                                description: sheetFields.d2,
                                category_id: sheetFields.d3.trim() || null,
                                is_active: sheetFields.b,
                              })
                              .eq('id', homeEditSheet.id)
                          ).error
                        }
                        if (err) throw err
                        const { data: rst } = await supabase
                          .from('routine_steps')
                          .select('*')
                          .eq('is_active', true)
                          .order('step_order', { ascending: true })
                        setRoutineSteps(rst || [])
                      } else if (k === 'hormone_main') {
                        const up = async (key: string, val: string) =>
                          supabase.from('admin_settings').upsert(
                            { category: 'home_skin_ui', key, value: val, label: val, is_active: true, sort_order: 0 },
                            { onConflict: 'category,key' }
                          )
                        let e = (await up('hormone_main', sheetFields.d)).error
                        if (e) throw e
                        e = (await up('hormone_sub', sheetFields.d2)).error
                        if (e) throw e
                        setHormoneMainLine(sheetFields.d)
                        setHormoneSubLine(sheetFields.d2)
                      } else if (k === 'hormone_sub') {
                        const { error: e } = await supabase.from('admin_settings').upsert(
                          { category: 'home_skin_ui', key: 'hormone_sub', value: sheetFields.d, label: sheetFields.d, is_active: true, sort_order: 0 },
                          { onConflict: 'category,key' }
                        )
                        if (e) throw e
                        setHormoneSubLine(sheetFields.d)
                      } else if (k === 'care_banner') {
                        const { error: e } = await supabase.from('admin_settings').upsert(
                          { category: 'home_skin_ui', key: 'care_banner', value: sheetFields.d, label: sheetFields.d, is_active: true, sort_order: 1 },
                          { onConflict: 'category,key' }
                        )
                        if (e) throw e
                        setCareBannerLine(sheetFields.d)
                      } else if (k === 'product_card' && homeEditSheet.id) {
                        const { error: e } = await supabase
                          .from('products')
                          .update({
                            retail_price: Math.max(0, Math.floor(Number(sheetFields.d) || 0)),
                            stock: Math.max(0, Math.floor(Number(sheetFields.d2) || 0)),
                          })
                          .eq('id', homeEditSheet.id)
                        if (e) throw e
                        const sel =
                          'id, name, retail_price, sale_price, is_timesale, thumb_img, storage_thumb_url, tag, category_id, quiz_match, brands(name), categories(name,target_tracks)'
                        const selNoCat =
                          'id, name, retail_price, sale_price, is_timesale, thumb_img, storage_thumb_url, tag, category_id, quiz_match, brands(name)'
                        let res: { error: unknown; data: any[] | null } = await supabase.from('products').select(sel).eq('is_active', true).limit(80)
                        if (res.error) res = await supabase.from('products').select(selNoCat).eq('is_active', true).limit(80)
                        if (res.error || !res.data?.length) {
                          res = await supabase.from('products').select(sel).limit(80)
                        }
                        if (res.error) res = await supabase.from('products').select(selNoCat).limit(80)
                        if (res.data) setProducts(res.data)
                      } else if (k === 'timesale' && homeEditSheet.id) {
                        const orig = Number(homeEditSheet.extra?.orig ?? 0)
                        const discPct = Math.min(95, Math.max(0, Math.floor(Number(sheetFields.d) || 0)))
                        const sale = orig > 0 ? Math.max(0, Math.round(orig * (1 - discPct / 100))) : 0
                        const endMs = new Date(sheetFields.d2).getTime()
                        const endsIso = Number.isFinite(endMs) ? new Date(endMs).toISOString() : new Date(Date.now() + 86400000).toISOString()
                        const { error: e } = await supabase
                          .from('products')
                          .update({
                            sale_price: sale,
                            timesale_ends_at: endsIso,
                            is_timesale: true,
                          })
                          .eq('id', homeEditSheet.id)
                        if (e) throw e
                        supabase
                          .from('products')
                          .select('id, name, brand_id, retail_price, sale_price, thumb_img, storage_thumb_url, timesale_ends_at, brands(name)')
                          .eq('is_timesale', true)
                          .gt('timesale_ends_at', new Date().toISOString())
                          .order('timesale_ends_at', { ascending: true })
                          .limit(3)
                          .then(({ data }) => {
                            if (!data || data.length === 0) return
                            const mapped = data.map((p: any) => {
                              const o = Number(p.retail_price ?? 0)
                              const s = Number(p.sale_price ?? 0)
                              const d = o > 0 && s >= 0 ? Math.round(((o - s) / o) * 100) : 0
                              return {
                                id: p.id,
                                disc: d,
                                orig: o,
                                timesale_ends_at: p.timesale_ends_at,
                                sale_price: s,
                                brand: p.brands?.name || null,
                                product: {
                                  id: p.id,
                                  name: p.name,
                                  retail_price: s,
                                  thumb_img: p.storage_thumb_url || p.thumb_img || null,
                                  brand: p.brands?.name || null,
                                },
                              }
                            })
                            setTimeSales(mapped)
                            setTimers(
                              mapped.map((it: any) => {
                                const rawEnd = data.find((x: any) => x.id === it.id)?.timesale_ends_at
                                const em = rawEnd ? new Date(rawEnd).getTime() : 0
                                const diffMs = Math.max(0, em - Date.now())
                                const h = Math.floor(diffMs / 3600000)
                                const m = Math.floor((diffMs % 3600000) / 60000)
                                const s = Math.floor((diffMs % 60000) / 1000)
                                return { h, m, s }
                              })
                            )
                          })
                      } else if (k === 'notice_row' && homeEditSheet.id) {
                        const { error: e } = await supabase
                          .from('notices')
                          .update({
                            title: sheetFields.d,
                            body: sheetFields.d2,
                            link_url: sheetFields.d3.trim() || null,
                            is_important: sheetFields.b,
                          })
                          .eq('id', homeEditSheet.id)
                        if (e) {
                          const e2 = await supabase
                            .from('notices')
                            .update({
                              title: sheetFields.d,
                              content: sheetFields.d2,
                              url: sheetFields.d3.trim() || null,
                              is_important: sheetFields.b,
                            })
                            .eq('id', homeEditSheet.id)
                          if (e2.error) throw e2.error
                        }
                      }
                      setHomeEditSheet(null)
                      setHomeToast('저장했어요')
                    } catch (err: any) {
                      setHomeToast(err?.message || '저장에 실패했어요')
                    } finally {
                      setHomeEditSaving(false)
                    }
                  })()
                }}
                style={{
                  flex: 1,
                  padding: 13,
                  borderRadius: 10,
                  border: 'none',
                  background: '#7B5EA7',
                  color: '#fff',
                  cursor: homeEditSaving ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: homeEditSaving ? 0.75 : 1,
                }}
              >
                {homeEditSaving ? '저장 중...' : '적용 · 저장'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {homeToast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 96,
            left: 16,
            right: 16,
            maxWidth: 360,
            margin: '0 auto',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(30,26,20,0.96)',
            border: '1px solid rgba(201,169,110,0.35)',
            color: GOLD,
            fontSize: 13,
            textAlign: 'center',
            zIndex: 140,
          }}
        >
          {homeToast}
        </div>
      ) : null}

      {isSuperAdmin ? (
        <button
          type="button"
          onClick={() => setHomeEditMode(v => !v)}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 88,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#7B5EA7',
            border: 'none',
            color: '#fff',
            fontSize: 20,
            cursor: 'pointer',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            padding: 0,
            lineHeight: 1,
          }}
        >
          {homeEditMode ? '✕' : '✏️'}
        </button>
      ) : null}

      {/* ── 푸터 ── */}
      <div style={{ margin: '20px 16px 0', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 400, color: GOLD, letterSpacing: '4px' }}>AURAN</span>
          <span style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace', marginLeft: '8px' }}>· DUCHESS.KR</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {['공지사항', 'FAQ', '1:1문의', '개인정보처리방침', '이용약관'].map((item, i) => (
            <span key={i} style={{ fontSize: '10px', color: TEXT_DIM, cursor: 'pointer' }}>{item}</span>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.2)', lineHeight: 2 }}>
          <div>상호 : 주식회사 티엔씨 · 사업자등록번호 : 197-87-01357</div>
          <div>경기도 양주시 은현면 화합로610번길30-183 1F · support@auran.kr</div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>
            © 2026 AURAN. All rights reserved.
          </div>
        </div>
      </div>

      {skinTooltipMsg && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#2D1B4E,#1A0A2E)',
          border: '1px solid rgba(123,94,167,0.4)',
          borderRadius: 20, padding: '12px 20px',
          fontSize: 13, color: 'white', zIndex: 300,
          whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.3s ease',
        }}>
          {skinTooltipMsg}
        </div>
      )}

      {/* 날씨 맞춤 추천 모달 */}
      {showWeatherRec && (
        <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'flex-end',justifyContent:'center',backdropFilter:'blur(6px)' }}
          onClick={() => setShowWeatherRec(false)}>
          <div style={{ width:'100%',maxWidth:480,background:'#0D0B09',borderRadius:'28px 28px 0 0',maxHeight:'85vh',overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex',justifyContent:'center',padding:'12px 0' }}>
              <div style={{ width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)' }} />
            </div>
            <div style={{ padding:'0 20px 40px' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16,color:'white',marginBottom:4 }}>
                    {weather?.condition || '☀️'} 오늘 날씨 맞춤 케어
                  </div>
                  <div style={{ fontSize:11,color:'rgba(255,255,255,0.4)',lineHeight:1.6 }}>
                    건성·민감 복합 · 자외선 {weather?.uv?.level} · 미세먼지 {weather?.dust?.level}
                  </div>
                </div>
                <button onClick={() => setShowWeatherRec(false)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.4)',fontSize:20,cursor:'pointer' }}>×</button>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {seasonRecs.slice(0,4).map((r:any) => {
                  const p = r.products
                  if (!p) return null
                  return (
                    <div key={r.id} style={{ background:CARD_BG,border:CARD_BORDER,borderRadius:16,padding:'14px',display:'flex',gap:12,alignItems:'center' }}
                      onClick={() => router.push(`/products/${p.id}`)}>
                      <div style={{ width:60,height:60,borderRadius:12,overflow:'hidden',background:'rgba(255,255,255,0.04)',flexShrink:0 }}>
                        {p.storage_thumb_url||p.thumb_img
                          ? <img src={p.storage_thumb_url||p.thumb_img} alt={p.name} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                          : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24 }}>🧴</div>
                        }
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:3 }}>{r.concern_tag}</div>
                        <div style={{ fontSize:13,color:'white',lineHeight:1.4,marginBottom:4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' }}>{p.name}</div>
                        <div style={{ fontSize:13,color:GOLD }}>₩{(p.retail_price||0).toLocaleString()}</div>
                      </div>
                    </div>
                  )
                })}
                {seasonRecs.length === 0 && (
                  <div style={{ textAlign:'center',color:'rgba(255,255,255,0.3)',fontSize:13,padding:'40px 0' }}>
                    날씨 맞춤 제품을 준비 중이에요
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <SkinDiarySheet
        open={showSkinDiary}
        onClose={() => setShowSkinDiary(false)}
        supabase={supabase}
        userId={myUserId}
        hormoneCycle={hormoneCycle}
        hormoneTrack={hormoneTrack}
        skinRecList={skinRecList}
        cycleType={cycleType}
      />

    </div>
  )
}
