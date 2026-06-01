'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/hooks/useUserProfile'
import { compressImage } from '@/lib/imageUpload'
import Avatar from '@/components/ui/Avatar'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'

function toKoreanSkinType(raw: string | null | undefined) {
  const v = String(raw || '').trim()
  if (v === 'dry') return '건성'
  if (v === 'oily') return '지성'
  if (v === 'combination') return '복합성'
  if (v === 'sensitive') return '민감성'
  if (v === 'normal') return '정상'
  return v
}

export default function MyWorldPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile: userProfile } = useUserProfile()
  const [toast, setToast] = useState('')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([])
  const [vanityItems, setVanityItems] = useState<any[]>([])
  const [routineLogs, setRoutineLogs] = useState<any[]>([])
  const [skinDiary, setSkinDiary] = useState<any[]>([])
  // ===== [멤버 번호] =====
  const [memberNo, setMemberNo] = useState<number | null>(null)
  const [guestbook, setGuestbook] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'room' | 'diary' | 'routine' | 'guestbook' | 'skin_record'>('room')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedSkinStatuses, setSelectedSkinStatuses] = useState<string[]>([])
  const [diaryMemo, setDiaryMemo] = useState('')
  const [videoFeedText, setVideoFeedText] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaPreview, setMediaPreview] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [selectedPhase, setSelectedPhase] = useState('')
  const [phaseSkinState, setPhaseSkinState] = useState<string[]>([])
  const [phaseMood, setPhaseMood] = useState('')
  const [phaseSleep, setPhaseSleep] = useState('')
  const [phaseAppetite, setPhaseAppetite] = useState('')
  const [phaseMemo, setPhaseMemo] = useState('')
  const [now, setNow] = useState(new Date())
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({})
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({})
  const [commentCountMap, setCommentCountMap] = useState<Record<string, number>>({})
  const [shareOpenId, setShareOpenId] = useState<string>('')
  const [commentOpenId, setCommentOpenId] = useState<string>('')
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({})
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({})
  const [guestbookInput, setGuestbookInput] = useState('')
  const [bgmTab, setBgmTab] = useState<'auran' | 'balance'>('auran')
  const [routineChecked, setRoutineChecked] = useState<Record<string, boolean>>({})
  const mediaInputRef = useRef<HTMLInputElement | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [myworldNickname, setMyworldNickname] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('💜 보라빛 드림')
  const [myworldBio, setMyworldBio] = useState('')
  const [minimiSrc, setMinimiSrc] = useState('')
  const [minimiSpeechIndex, setMinimiSpeechIndex] = useState(0)
  const [roomContest, setRoomContest] = useState<any>(null)
  const [mwShopItems, setMwShopItems] = useState<any[]>([])
  const [mwVotedActive, setMwVotedActive] = useState(false)
  const [mwVoterDiscountPct, setMwVoterDiscountPct] = useState(50)
  const [mwShopBusy, setMwShopBusy] = useState<string | null>(null)
  const [hideSkinTypeGuide, setHideSkinTypeGuide] = useState(false)

  useEffect(() => {
    const run = async () => {
      const iso = new Date().toISOString()
      const { data: c } = await supabase
        .from('contests')
        .select('*')
        .eq('is_public', true)
        .eq('status', 'active')
        .lte('starts_at', iso)
        .gte('ends_at', iso)
        .limit(1)
        .maybeSingle()
      setRoomContest(c || null)
      const { data: discRow } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('category', 'contest')
        .eq('key', 'contest_voter_discount')
        .maybeSingle()
      const d = Number((discRow as { value?: string } | null)?.value ?? '50')
      setMwVoterDiscountPct(Number.isFinite(d) && d >= 0 && d <= 100 ? d : 50)
      const { data: prods } = await supabase.from('products').select('*').eq('category', 'myworld_item').eq('status', 'active').limit(24)
      setMwShopItems(prods || [])
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user && c?.id) {
        const { data: ur } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
        if (ur?.id) {
          const { data: v } = await supabase.from('contest_votes').select('id').eq('contest_id', c.id).eq('voter_user_id', ur.id).limit(1)
          setMwVotedActive(!!(v && v.length > 0))
        } else setMwVotedActive(false)
      } else setMwVotedActive(false)
    }
    void run()
    const iv = setInterval(() => void run(), 15000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setMinimiSpeechIndex((p) => p + 1)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const auth = { user: session?.user ?? null }
      if (!auth.user) return
      setUser(auth.user)

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url, grade, skin_type, myworld_nickname, myworld_theme, myworld_bio, member_no')
        .eq('auth_id', auth.user.id)
        .maybeSingle()
      setProfile(p || null)
      // ===== [멤버 번호 세팅] =====
      if ((p as any)?.member_no) setMemberNo((p as any).member_no)
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
      const diaryList = Array.isArray(diaryRows) ? diaryRows : []
      setSkinDiary(diaryList)
      if (diaryList.length > 0) {
        const ids = diaryList.map((d: any) => d.id).filter(Boolean)
        const { data: likes } = await supabase.from('skin_diary_likes').select('diary_id,user_id').in('diary_id', ids)
        const { data: comments } = await supabase.from('skin_diary_comments').select('id,diary_id').in('diary_id', ids)
        const nextLiked: Record<string, boolean> = {}
        const nextLikeCount: Record<string, number> = {}
        const nextCommentCount: Record<string, number> = {}
        ;(likes || []).forEach((l: any) => {
          const did = String(l.diary_id)
          nextLikeCount[did] = (nextLikeCount[did] || 0) + 1
          if (String(l.user_id) === String(auth.user.id)) nextLiked[did] = true
        })
        ;(comments || []).forEach((c: any) => {
          const did = String(c.diary_id)
          nextCommentCount[did] = (nextCommentCount[did] || 0) + 1
        })
        setLikedMap(nextLiked)
        setLikeCountMap(nextLikeCount)
        setCommentCountMap(nextCommentCount)
      }

      const { data: guestRows } = await supabase
        .from('guestbook')
        .select('*')
        .eq('host_user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setGuestbook(Array.isArray(guestRows) ? guestRows : [])
    }
    run()
  }, [])

  const roomLevel = deliveredOrders.length === 0 ? 1 : deliveredOrders.length <= 2 ? 2 : deliveredOrders.length <= 5 ? 3 : deliveredOrders.length <= 10 ? 4 : 5
  const toNext = roomLevel >= 5 ? 0 : [0, 3, 6, 11, 999][roomLevel] - deliveredOrders.length

  const latestRoutineDate = routineLogs[0]?.completed_at ? new Date(routineLogs[0].completed_at) : null
  const daysSinceRoutine = latestRoutineDate ? Math.floor((Date.now() - latestRoutineDate.getTime()) / 86400000) : 999
  const todayDone = latestRoutineDate ? latestRoutineDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) : false
  const minimiTalkLevel = daysSinceRoutine >= 5 ? 1 : roomLevel >= 4 ? 3 : 2
  const minimiMentGroups: Record<number, string[]> = {
    1: ['루틴 해줘요~ 🥺', '낙엽이 쌓여요 🍂', '저 좀 추워요...'],
    2: ['오늘도 루틴 완료! ✨', '피부 좋아지고 있어요 💜', '같이 빛나요~'],
    3: ['궁전이 됐어요 👑', '오늘 피부 최고예요 ✨', '어머 손님이다~ 💜'],
  }
  const minimiMent = minimiMentGroups[minimiTalkLevel][minimiSpeechIndex % minimiMentGroups[minimiTalkLevel].length]

  const moodGroups = [
    { label: '신체/호르몬', items: ['🩸 생리중', '😣 생리전 예민', '😪 수면부족', '🍺 어젯밤 음주', '💊 약 복용중', '🏃 운동후'] },
    { label: '감정/멘탈', items: ['😤 스트레스MAX', '😢 울었어요', '😊 설레는날', '🎉 특별한날', '😴 너무피곤해', '🧘 마음평온'] },
    { label: '환경', items: ['☀️ 야외활동많음', '✈️ 여행중', '🏢 에어컨오래씀', '😷 마스크오래씀', '🌫️ 미세먼지심함'] },
  ]
  const skinStatusGroups = [
    { label: '좋은 상태', items: ['✨ 오늘빛남', '💧 촉촉', '🌟 맑음'] },
    { label: '안좋은 상태', items: ['😤 화장뜸', '🌫️ 칙칙함', '🔵 붓기', '😴 다크서클', '🍎 홍조', '🕳️ 모공넓어짐', '💥 블랙헤드', '🤕 각질', '😓 번들거림', '🔴 트러블', '💨 당김'] },
  ]
  const morningItems = ['세안', '토너', '세럼', '크림', '선크림']
  const eveningItems = ['클렌징', '세안', '토너', '세럼', '크림']
  const totalRoutine = morningItems.length + eveningItems.length
  const doneRoutine = Object.values(routineChecked).filter(Boolean).length
  const routinePct = Math.round((doneRoutine / totalRoutine) * 100)
  // ===== [루틴 고도화] 제품 등록 state =====
  // routines 테이블 연동 — 베타 후 DB 연동, 지금은 로컬 state
  const [myRoutines, setMyRoutines] = useState<any[]>([])
  const [routineSearch, setRoutineSearch] = useState('')
  const [routineProducts, setRoutineProducts] = useState<any[]>([])
  const [showRoutineSearch, setShowRoutineSearch] = useState(false)
  const [editingSlot, setEditingSlot] = useState<'morning'|'evening'|'weekly'|null>(null)

  const contestRoomDDay = (endAt: string) => {
    const e = new Date(endAt)
    const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()
    const t = new Date()
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
    const n = Math.ceil((endDay - today) / 86400000)
    return n <= 0 ? 'D-DAY' : `D-${n}`
  }

  const buyMyworldItem = async (p: any) => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      router.push('/login?role=customer')
      return
    }
    const { data: urow } = await supabase.from('users').select('id, points').eq('auth_id', auth.user.id).maybeSingle()
    if (!urow?.id) {
      setToast('회원 정보를 확인할 수 없어요')
      return
    }
    const base = Number(p.retail_price || 0)
    const factor = 1 - mwVoterDiscountPct / 100
    const pay = mwVotedActive ? Math.max(1, Math.ceil(base * factor)) : base
    if (pay <= 0) {
      setToast('가격 정보가 없어요')
      return
    }
    if (Number(urow.points || 0) < pay) {
      setToast('토스트가 부족해요 💜')
      return
    }
    setMwShopBusy(String(p.id))
    try {
      const nextPts = Number(urow.points || 0) - pay
      const { error: ptE } = await supabase.from('point_transactions').insert({
        user_id: auth.user.id,
        amount: -pay,
        type: 'myworld_item',
        description: String(p.name || '마이월드 아이템'),
      })
      if (ptE) {
        setToast(ptE.message)
        return
      }
      await supabase.from('users').update({ points: nextPts }).eq('id', urow.id)
      await supabase.from('profiles').update({ myworld_theme: String(p.name || '') }).eq('auth_id', auth.user.id)
      setSelectedTheme(String(p.name || ''))
      setToast('구매 완료! 테마가 적용됐어요 💜')
    } finally {
      setMwShopBusy(null)
    }
  }

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

  const onPickMedia = (files: FileList | null) => {
    if (!files) return
    const picked = Array.from(files).slice(0, 5)
    setMediaFiles(picked)
    setMediaPreview(picked.map((f) => URL.createObjectURL(f)))
  }

  const removeMedia = (idx: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx))
    setMediaPreview((prev) => prev.filter((_, i) => i !== idx))
  }

  const toggleMood = (value: string) => {
    setSelectedMoods((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  const toggleSkinStatus = (value: string) => {
    setSelectedSkinStatuses((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  const onSaveDiary = async () => {
    const nowIso = new Date().toISOString()
    let mediaUrls: string[] = []
    const hasVideo = mediaFiles.some((f) => f?.type?.startsWith('video'))
    if (user?.id && mediaFiles.length > 0) {
      try {
        const uploads = await Promise.all(
          mediaFiles.map(async (file, index) => {
            const path = `diary/${user.id}/${Date.now()}_${index}`
            if (file.type.startsWith('image/')) file = await compressImage(file, 'diary')
            const { error } = await supabase.storage.from('skin-diary').upload(path, file, { upsert: true })
            if (error) return ''
            const { data } = supabase.storage.from('skin-diary').getPublicUrl(path)
            return data?.publicUrl || ''
          })
        )
        mediaUrls = uploads.filter(Boolean)
      } catch {
        mediaUrls = []
      }
    }
    if (user?.id) {
      const memoToSave = hasVideo ? videoFeedText : diaryMemo
      const { data: inserted } = await supabase
        .from('skin_diary')
        .insert({
          user_id: user.id,
          skin_type: userProfile?.skin_type || null,
          mood: selectedMoods.join(','),
          skin_status: selectedSkinStatuses.join(','),
          memo: memoToSave,
          media_urls: mediaUrls,
          is_public: isPublic,
          recorded_at: nowIso,
        })
        .select('*')
        .maybeSingle()
      const newEntry =
        inserted || {
          id: `${Date.now()}`,
          user_id: user.id,
          skin_type: userProfile?.skin_type || null,
          mood: selectedMoods.join(','),
          skin_status: selectedSkinStatuses.join(','),
          memo: memoToSave,
          media_urls: mediaUrls,
          is_public: isPublic,
          recorded_at: nowIso,
        }
      setSkinDiary((prev) => [newEntry, ...prev].slice(0, 7))
    }
    setSelectedMoods([])
    setSelectedSkinStatuses([])
    setDiaryMemo('')
    setVideoFeedText('')
    setMediaFiles([])
    setMediaPreview([])
    setIsPublic(true)
    setToast('기록됐어요 💜')
  }

  const toggleLike = async (diaryId: string) => {
    if (!user?.id) return
    const liked = !!likedMap[diaryId]
    if (liked) {
      await supabase.from('skin_diary_likes').delete().eq('diary_id', diaryId).eq('user_id', user.id)
      setLikedMap((p) => ({ ...p, [diaryId]: false }))
      setLikeCountMap((p) => ({ ...p, [diaryId]: Math.max((p[diaryId] || 1) - 1, 0) }))
    } else {
      await supabase.from('skin_diary_likes').insert({ diary_id: diaryId, user_id: user.id, created_at: new Date().toISOString() })
      setLikedMap((p) => ({ ...p, [diaryId]: true }))
      setLikeCountMap((p) => ({ ...p, [diaryId]: (p[diaryId] || 0) + 1 }))
    }
  }

  const toggleComments = async (diaryId: string) => {
    if (commentOpenId === diaryId) {
      setCommentOpenId('')
      return
    }
    setCommentOpenId(diaryId)
    if (!commentsMap[diaryId]) {
      const { data } = await supabase
        .from('skin_diary_comments')
        .select('*')
        .eq('diary_id', diaryId)
        .order('created_at', { ascending: true })
      setCommentsMap((p) => ({ ...p, [diaryId]: data || [] }))
    }
  }

  const addComment = async (diaryId: string) => {
    const msg = String(commentInputMap[diaryId] || '').trim()
    if (!msg || !user?.id) return
    const row = { diary_id: diaryId, user_id: user.id, message: msg, created_at: new Date().toISOString() }
    await supabase.from('skin_diary_comments').insert(row)
    setCommentsMap((p) => ({ ...p, [diaryId]: [...(p[diaryId] || []), row] }))
    setCommentInputMap((p) => ({ ...p, [diaryId]: '' }))
    setCommentCountMap((p) => ({ ...p, [diaryId]: (p[diaryId] || 0) + 1 }))
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
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 0, fontWeight: 400 }}>
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
        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes walkFlip {
          0% { transform: translate(100px, 192px) scaleX(1); }
          44% { transform: translate(195px, 182px) scaleX(1); }
          50% { transform: translate(195px, 182px) scaleX(-1); }
          94% { transform: translate(100px, 192px) scaleX(-1); }
          100% { transform: translate(100px, 192px) scaleX(1); }
        }
        @keyframes walkFlipReverse {
          0% { transform: translate(100px, 192px) scaleX(1); }
          44% { transform: translate(195px, 182px) scaleX(1); }
          50% { transform: translate(195px, 182px) scaleX(1); }
          94% { transform: translate(100px, 192px) scaleX(1); }
          100% { transform: translate(100px, 192px) scaleX(1); }
        }
        .myworld-skincare-room .mini-body {
          position: absolute;
          left: 0;
          top: 0;
          z-index: 4;
          transform-origin: center bottom;
          animation: walkFlip 11s linear infinite;
        }
        .myworld-skincare-room .bubble-fix {
          position: absolute;
          left: 0;
          top: 0;
          z-index: 5;
          transform-origin: center bottom;
          animation: walkFlipReverse 11s linear infinite;
        }
        .myworld-skincare-room .myworld-room-floor {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 36%;
          background-color: #e8e0f5;
          background-image: repeating-conic-gradient(#ddd5ee 0% 25%, #e8e0f5 0% 50%);
          background-size: 22px 22px;
          border-top: 2px solid #9b7ec8;
        }
      `}</style>

      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.96)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => router.push('/my')} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontFamily: 'Georgia, serif', color: '#c4a7e7', letterSpacing: '6px', fontSize: 18 }}>MY WORLD</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>👁 127</div>
      </header>

      <div style={{ background: 'linear-gradient(135deg, rgba(123,94,167,0.2), rgba(80,50,120,0.1))', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 18, padding: 16, margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Avatar url={profile?.avatar_url ?? null} name={myworldNickname || profile?.username || profile?.full_name} size={60} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, color: '#e8e0f5' }}>{myworldNickname || profile?.username || profile?.full_name || '나의 공간'}</div>
          <div style={{ display: 'inline-block', marginTop: 2, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#c4a7e7', fontSize: 10 }}>{profile?.grade || 'PETAL'}</div>
          {/* ===== [멤버십 카드] ===== */}
          {(() => {
            const grade = profile?.grade || 'AUBE'
            const gradeMap: Record<string, {en:string, color:string, bg:string, border:string}> = {
              'AUBE':    {en:'새벽 AUBE',    color:'#9090B8', bg:'#0d0d1a', border:'rgba(144,144,184,0.4)'},
              'AURORE':  {en:'여명 AURORE',  color:'#9B7FCC', bg:'#120d20', border:'rgba(155,127,204,0.45)'},
              'DOUCEUR': {en:'온기 DOUCEUR', color:'#AFA9EC', bg:'#150f2a', border:'rgba(175,169,236,0.5)'},
              'LUMIÈRE': {en:'빛결 LUMIÈRE', color:'#C9A96E', bg:'#1a1208', border:'rgba(201,169,110,0.55)'},
              'ESSENCE': {en:'향기 ESSENCE', color:'#E2C070', bg:'#1a1005', border:'rgba(226,192,112,0.6)'},
              'LÉGENDE': {en:'전설 LÉGENDE', color:'#F0D080', bg:'#150d00', border:'rgba(240,208,128,0.65)'},
              'CÉLESTE': {en:'천상 CÉLESTE', color:'#FFE090', bg:'#080808', border:'rgba(255,224,144,0.7)'},
            }
            const g = gradeMap[grade] || gradeMap['AUBE']
            return (
              <div style={{
                background: g.bg,
                border: `1.5px solid ${g.border}`,
                borderRadius: 14,
                padding: '14px 16px',
                margin: '10px 16px 0',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: g.color, opacity: 0.3 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: g.color, opacity: 0.3 }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: g.color, opacity: 0.5, marginBottom: 3 }}>AURAN</div>
                    <div style={{ fontSize: 13, color: g.color, letterSpacing: 1 }}>{g.en}</div>
                  </div>
                  {memberNo && (
                    <div style={{ fontSize: 11, color: g.color, opacity: 0.6 }}>
                      #{String(memberNo).padStart(5, '0')}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 17, color: g.color, marginBottom: 2 }}>
                  {profile?.full_name || user?.email?.split('@')[0] || '오랜아미'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: g.color, opacity: 0.4 }}>피부도 처방받는 시대</div>
                  <div style={{ fontSize: 10, color: g.color, opacity: 0.4 }}>auran.kr</div>
                </div>
              </div>
            )
          })()}
          <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.5)', marginTop: 4 }}>일촌 0명 · 방명록 {guestbook.length}개</div>
        </div>
        <button onClick={() => setShowCustomize(true)} style={{ border: '1px solid rgba(123,94,167,0.4)', color: '#9b7ec8', fontSize: 11, background: 'transparent', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>꾸미기 ✏️</button>
      </div>

      <div style={{ display: 'flex', margin: '14px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          ['room', '스킨케어룸'],
          ['diary', '피부일기'],
          ['routine', '루틴'],
          ['guestbook', '방명록'],
          ['skin_record', '피부기록'],
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
          <div
            className="myworld-skincare-room"
            style={{
              border: '1px solid rgba(155,126,200,0.45)',
              borderRadius: 16,
              margin: '0 16px',
              minHeight: 260,
              position: 'relative',
              overflow: 'hidden',
              padding: 20,
              filter: daysSinceRoutine >= 14 ? 'grayscale(60%)' : daysSinceRoutine >= 7 ? 'grayscale(30%)' : 'none',
              background: '#f5f0ff',
            }}
          >
            <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: '#6b4f9e', zIndex: 2 }}>오늘 피부점수 78 ✨</div>
          </div>

          {roomContest ? (
            <div
              style={{
                margin: '12px 16px 0',
                background: 'rgba(123,94,167,0.08)',
                border: '1px solid rgba(123,94,167,0.2)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#c4a7e7', marginBottom: 4 }}>✨ 새 배경 투표 중이에요</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35 }}>{roomContest.title}</div>
                <div style={{ marginTop: 6, display: 'inline-block', fontSize: 9, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#e8d6ff' }}>
                  {contestRoomDDay(roomContest.ends_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/community?tab=contest')}
                style={{
                  flexShrink: 0,
                  border: 'none',
                  borderRadius: 999,
                  padding: '8px 14px',
                  background: '#7B5EA7',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                투표하기
              </button>
            </div>
          ) : null}

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
            <button onClick={() => setIsDrawerOpen((p) => !p)} style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'rgba(123,94,167,0.08)', color: '#c4a7e7', borderRadius: 10, padding: '8px 12px', fontSize: 11, cursor: 'pointer' }}>🗄️ 서랍 열기</button>
          </div>
          <div style={{ margin: '10px 16px 0', maxHeight: isDrawerOpen ? 900 : 0, transition: 'max-height 0.4s ease', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>🛍️ 당선 배경 아이템 (토스트)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {mwShopItems.map((p: any) => {
                const base = Number(p.retail_price || 0)
                const factor = 1 - mwVoterDiscountPct / 100
                const pay = mwVotedActive ? Math.max(1, Math.ceil(base * factor)) : base
                const thumb = p.storage_thumb_url || p.thumb_img || ''
                return (
                  <div key={`mwshop-${p.id}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 8 }}>
                    <div style={{ height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🖼️</span>}
                    </div>
                    <div style={{ fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.75)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                    <div style={{ fontSize: 9, marginTop: 2, color: mwVotedActive ? '#9b7ec8' : 'rgba(255,255,255,0.5)' }}>
                      {pay.toLocaleString()}T{mwVotedActive && base !== pay ? <span style={{ textDecoration: 'line-through', marginLeft: 4, opacity: 0.6 }}>{base}T</span> : null}
                    </div>
                    <button
                      type="button"
                      disabled={mwShopBusy === String(p.id)}
                      onClick={() => buyMyworldItem(p)}
                      style={{
                        marginTop: 4,
                        border: '1px solid rgba(123,94,167,0.35)',
                        background: 'rgba(123,94,167,0.12)',
                        color: '#c4a7e7',
                        borderRadius: 8,
                        padding: '4px 0',
                        width: '100%',
                        fontSize: 9,
                        cursor: 'pointer',
                      }}
                    >
                      {mwShopBusy === String(p.id) ? '…' : '구매하기'}
                    </button>
                  </div>
                )
              })}
              {mwShopItems.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 8 }}>등록된 아이템이 없어요</div>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {vanityItems.map((v: any) => (
                <div key={`drawer-${v.id}`} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 8 }}>
                  <div style={{ height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {v.thumb ? <img src={v.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🧴</span>}
                  </div>
                  <div style={{ fontSize: 9, marginTop: 4, color: 'rgba(255,255,255,0.75)' }}>{v.name}</div>
                  <button
                    onClick={() => {
                      setDiaryMemo((prev) => `${prev}${prev ? ' ' : ''}#${v.name}`)
                      setActiveTab('diary')
                      setToast(`#${v.name} 추가됐어요 💜`)
                    }}
                    style={{ marginTop: 4, border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '4px 0', width: '100%', fontSize: 9, cursor: 'pointer' }}
                  >
                    써요 💜
                  </button>
                </div>
              ))}
              {vanityItems.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', padding: 10 }}>
                  구매한 제품이 없어요 🧴
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'diary' ? (
        <div style={{ margin: '12px 16px 0' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginBottom: 8 }}>
            <div>{now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>
            <div>{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          </div>
          <div style={{ background: 'rgba(123,94,167,0.06)', border: '1px solid rgba(123,94,167,0.18)', borderRadius: 14, padding: 14 }}>
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => onPickMedia(e.target.files)}
              style={{ display: 'none' }}
            />
            <div
              onClick={() => mediaInputRef.current?.click()}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(123,94,167,0.4)', borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}
            >
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>📸 사진/영상 추가</div>
            </div>
            {mediaPreview.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                {mediaPreview.map((url, idx) => (
                  <div key={idx} style={{ width: '100%', aspectRatio: '1', position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                    {mediaFiles[idx]?.type?.startsWith('video') ? (
                      <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                    ) : (
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeMedia(idx) }} style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            ) : null}
            {mediaFiles.some((f) => f?.type?.startsWith('video')) ? (
              <textarea
                value={videoFeedText}
                onChange={(e) => setVideoFeedText(e.target.value)}
                placeholder={'영상에 대한 이야기를 남겨보세요...\n루틴 설명, 제품 후기, 오늘의 피부 이야기 💜'}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, marginBottom: 8 }}
              />
            ) : null}
            {userProfile?.skin_type ? (
              <div
                style={{
                  marginBottom: 8,
                  background: 'rgba(123,94,167,0.06)',
                  border: '1px solid rgba(123,94,167,0.2)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 14, lineHeight: 1 }}>✨</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#c4a7e7' }}>{toKoreanSkinType(userProfile.skin_type)} 피부로 작성돼요</div>
                  <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.5)', marginTop: 2 }}>내 피부타입이 자동 적용돼요</div>
                  {Array.isArray(userProfile.skin_concerns) && userProfile.skin_concerns.length > 0 ? (
                    <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.4)', marginTop: 2 }}>고민: {userProfile.skin_concerns.join(' · ')}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/my/profile')}
                  style={{ fontSize: 10, color: 'rgba(196,167,231,0.4)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 20, padding: '3px 8px', background: 'transparent', cursor: 'pointer' }}
                >
                  변경
                </button>
              </div>
            ) : !hideSkinTypeGuide ? (
              <div
                style={{
                  marginBottom: 8,
                  background: 'rgba(123,94,167,0.08)',
                  border: '1px solid rgba(123,94,167,0.2)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 11, color: '#c4a7e7', lineHeight: 1.4 }}>피부타입 설정하면 더 정확한 추천 받아요 💜</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => router.push('/my/profile')}
                    style={{ border: '1px solid rgba(123,94,167,0.4)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '5px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 500 }}
                  >
                    설정하기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('hide_skintype_banner', 'true')
                      setHideSkinTypeGuide(true)
                    }}
                    style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : null}
            <div style={{ fontSize: 12, color: 'rgba(196,167,231,0.8)', marginBottom: 4 }}>오늘 기분이 어때요? 💜</div>
            {moodGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, marginTop: 10 }}>{group.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {group.items.map((m) => {
                    const selected = selectedMoods.includes(m)
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMood(m)}
                        style={{
                          fontSize: 11,
                          padding: '5px 10px',
                          borderRadius: 20,
                          border: selected ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.2)',
                          background: selected ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.03)',
                          color: selected ? '#c4a7e7' : 'rgba(255,255,255,0.5)',
                          margin: 3,
                          cursor: 'pointer',
                        }}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: 'rgba(196,167,231,0.8)', marginTop: 8, marginBottom: 4 }}>오늘 피부는 어때요? 🧴</div>
            {skinStatusGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, marginTop: 10 }}>{group.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {group.items.map((s) => {
                    const selected = selectedSkinStatuses.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSkinStatus(s)}
                        style={{
                          fontSize: 11,
                          padding: '5px 10px',
                          borderRadius: 20,
                          border: selected ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.2)',
                          background: selected ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.03)',
                          color: selected ? '#c4a7e7' : 'rgba(255,255,255,0.5)',
                          margin: 3,
                          cursor: 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {/* ===== [제품 태그] ===== */}
            {vanityItems.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                  오늘 쓴 제품 태그
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {vanityItems.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        const tag = `#${v.name} `
                        setDiaryMemo((prev: string) => prev.includes(tag) ? prev.replace(tag, '') : prev + tag)
                      }}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 20,
                        border: diaryMemo.includes(`#${v.name}`)
                          ? '1px solid rgba(201,169,110,0.6)'
                          : '1px solid rgba(255,255,255,0.1)',
                        background: diaryMemo.includes(`#${v.name}`)
                          ? 'rgba(201,169,110,0.1)'
                          : 'transparent',
                        color: diaryMemo.includes(`#${v.name}`)
                          ? '#C9A96E'
                          : 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                      }}
                    >
                      #{v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea value={diaryMemo} onChange={(e) => setDiaryMemo(e.target.value)} placeholder="오늘 피부 한줄 기록..." rows={3} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, marginBottom: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setIsPublic((p) => !p)}
                style={{ border: '1px solid rgba(123,94,167,0.25)', background: 'transparent', color: isPublic ? '#7B5EA7' : 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '10px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {isPublic ? '🌍 공개' : '🔒 비공개'}
              </button>
              <button onClick={onSaveDiary} style={{ background: '#7B5EA7', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, width: '100%', cursor: 'pointer' }}>기록하기 💜</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {skinDiary.length > 0 ? skinDiary.map((d: any, i: number) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👩</div>
                    <div>
                      <div style={{ fontSize: 12 }}>{myworldNickname || profile?.username || profile?.full_name || '나의 공간'}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                        {new Date(d?.recorded_at || '').toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })}{' '}
                        {new Date(d?.recorded_at || '').toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{d?.is_public === false ? '🔒' : '🌍'}</div>
                </div>
                {Array.isArray(d?.media_urls) && d.media_urls.length > 0 ? (
                  (() => {
                    const urls = d.media_urls as string[]
                    const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)
                    if (urls.length === 1) {
                      const url = urls[0]
                      if (isVideoUrl(url)) {
                        return (
                          <div style={{ padding: '0 0 10px' }}>
                            <video src={url} controls playsInline muted style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: '12px 12px 0 0', display: 'block' }} />
                          </div>
                        )
                      }
                      return (
                        <div style={{ padding: '0 0 10px' }}>
                          <img src={url} alt="" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: '12px 12px 0 0', display: 'block' }} />
                        </div>
                      )
                    }
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, padding: '0 0 10px' }}>
                        {urls.map((url, idx) => (
                          isVideoUrl(url) ? (
                            <video key={idx} src={url} controls playsInline muted style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <img key={idx} src={url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                          )
                        ))}
                      </div>
                    )
                  })()
                ) : null}
                <div style={{ padding: '0 12px 10px' }}>
                  <div style={{ fontSize: 12 }}>{String(d?.mood || '').split(',').filter(Boolean).join(' ') || ''}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{String(d?.skin_status || '').split(',').filter(Boolean).join(' ') || ''}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{d?.memo || ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px 12px', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  <button onClick={() => toggleLike(String(d.id))} style={{ border: 'none', background: 'transparent', color: likedMap[String(d.id)] ? '#ff6b7a' : '#fff', cursor: 'pointer', fontSize: 11, padding: 0, animation: likedMap[String(d.id)] ? 'heartPop 0.24s ease-in-out' : 'none' }}>
                    {likedMap[String(d.id)] ? '❤️' : '🤍'} 좋아요 {likeCountMap[String(d.id)] || 0}
                  </button>
                  <button onClick={() => toggleComments(String(d.id))} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 11, padding: 0 }}>
                    💬 댓글 {commentCountMap[String(d.id)] || 0}
                  </button>
                  <button onClick={() => setShareOpenId((p) => (p === String(d.id) ? '' : String(d.id)))} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 11, padding: 0 }}>
                    🔗 공유
                  </button>
                  <span>🔖 저장</span>
                </div>
                {shareOpenId === String(d.id) ? (
                  <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px' }}>
                    <button
                      onClick={async () => {
                        const link = `https://auran.kr/myworld/${user?.id || ''}/diary/${d.id}`
                        try {
                          await navigator.clipboard.writeText(link)
                          setToast('링크가 복사됐어요 💜')
                        } catch {
                          setToast('링크 복사 실패')
                        }
                      }}
                      style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '6px 8px', fontSize: 10, cursor: 'pointer' }}
                    >
                      📋 링크 복사
                    </button>
                    <button style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '6px 8px', fontSize: 10, cursor: 'pointer' }}>💬 카카오</button>
                    <button style={{ border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '6px 8px', fontSize: 10, cursor: 'pointer' }}>📷 인스타</button>
                  </div>
                ) : null}
                {commentOpenId === String(d.id) ? (
                  <div style={{ padding: '0 12px 12px' }}>
                    <div style={{ display: 'grid', gap: 6, marginBottom: 6 }}>
                      {(commentsMap[String(d.id)] || []).map((c: any, ci: number) => (
                        <div key={ci} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>• {String(c?.message || '')}</div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={commentInputMap[String(d.id)] || ''}
                        onChange={(e) => setCommentInputMap((p) => ({ ...p, [String(d.id)]: e.target.value }))}
                        placeholder="댓글을 입력하세요"
                        style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 11 }}
                      />
                      <button onClick={() => addComment(String(d.id))} style={{ border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 11, cursor: 'pointer' }}>등록</button>
                    </div>
                  </div>
                ) : null}
              </div>
            )) : (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'pre-line', textAlign: 'center' }}>
                {'아직 기록이 없어요\n매일 기록하면 피부 변화를 볼 수 있어요 ✨'}
              </div>
            )}
          </div>

          {/* ===== [피부 연대기] DB 연동 ===== */}
          {skinDiary.length >= 2 && (
            <div style={{
              marginTop: 12,
              background: 'rgba(123,94,167,0.08)',
              border: '1px solid rgba(123,94,167,0.2)',
              borderRadius: 14,
              padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 12,
              }}>
                <div style={{ fontSize: 13, color: '#c4a7e7' }}>💜 피부 연대기</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  총 {skinDiary.length}개 기록
                </div>
              </div>
              {skinDiary.slice(0, 3).map((d: any, i: number) => (
                <div key={d.id} style={{
                  display: 'flex', gap: 10, marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{
                    width: 2, background: 'rgba(123,94,167,0.4)',
                    borderRadius: 1, flexShrink: 0, alignSelf: 'stretch',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 3,
                    }}>
                      {new Date(d.recorded_at).toLocaleDateString('ko-KR', {
                        month: 'long', day: 'numeric',
                      })}
                    </div>
                    {d.media_urls?.[0] && (
                      <img
                        src={d.media_urls[0]}
                        alt=""
                        style={{
                          width: '100%', maxHeight: 120,
                          objectFit: 'cover', borderRadius: 8,
                          marginBottom: 5,
                        }}
                      />
                    )}
                    <div style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.6,
                    }}>
                      {d.memo?.slice(0, 60)}{(d.memo?.length || 0) > 60 ? '...' : ''}
                    </div>
                    {d.skin_status && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                        {d.skin_status.split(',').filter(Boolean).map((s: string) => (
                          <span key={s} style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 20,
                            background: 'rgba(123,94,167,0.2)',
                            color: '#c4a7e7',
                            border: '1px solid rgba(123,94,167,0.3)',
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {skinDiary.length > 3 && (
                <div style={{
                  textAlign: 'center', fontSize: 11,
                  color: 'rgba(255,255,255,0.3)', marginTop: 4,
                  cursor: 'pointer',
                }}>
                  더보기 ({skinDiary.length - 3}개 더)
                </div>
              )}
            </div>
          )}

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
                ['auran', 'AURAN 루틴'],
                ['balance', 'Keep Balance'],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setBgmTab(k as any)} style={{ flex: 1, border: bgmTab === k ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.2)', background: bgmTab === k ? 'rgba(123,94,167,0.2)' : 'transparent', color: '#fff', borderRadius: 8, padding: '6px 0', fontSize: 11, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <audio
              key={bgmTab}
              src={
                bgmTab === 'auran'
                  ? 'https://bhpcqgedhfawlehobphq.supabase.co/storage/v1/object/public/bgm/auran-routine.mp3'
                  : 'https://bhpcqgedhfawlehobphq.supabase.co/storage/v1/object/public/bgm/keep-the-balance.mp3'
              }
              controls
              style={{ width: '100%', marginTop: 4, borderRadius: 8, accentColor: '#7B5EA7' }}
            />
          </div>

          {/* ===== [루틴 고도화] 제품 등록 카드 ===== */}
          <div style={{
            margin: '12px 16px 0',
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#C9A96E', marginBottom: 6 }}>내 루틴 등록</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['morning','evening','weekly'] as const).map(slot => (
                <button
                  key={slot}
                  onClick={() => setEditingSlot(editingSlot === slot ? null : slot)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 20, fontSize: 11,
                    border: editingSlot === slot ? 'none' : '0.5px solid var(--color-border-secondary)',
                    background: editingSlot === slot ? '#7B5EA7' : 'transparent',
                    color: editingSlot === slot ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {slot === 'morning' ? '아침' : slot === 'evening' ? '저녁' : '주간'}
                </button>
              ))}
            </div>
            {editingSlot && (
              <div style={{ position: 'relative' }}>
                <input
                  value={routineSearch}
                  onChange={e => {
                    setRoutineSearch(e.target.value)
                    setShowRoutineSearch(true)
                    if (e.target.value.length > 0) {
                      supabase
                        .from('products')
                        .select('id, name, thumb_img')
                        .ilike('name', `%${e.target.value}%`)
                        .eq('is_active', true)
                        .limit(10)
                        .then(({ data }) => setRoutineProducts(data || []))
                    }
                  }}
                  placeholder="제품 검색해서 추가..."
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10,
                    border: '0.5px solid var(--color-border-secondary)',
                    fontSize: 12, fontFamily: 'inherit',
                    background: '#fff', color: '#111',
                  }}
                />
                {showRoutineSearch && routineProducts.length > 0 && (
                  <div style={{
                    background: '#fff', border: '0.5px solid #ddd',
                    borderRadius: 10, marginTop: 4, overflow: 'hidden',
                  }}>
                    {routineProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setMyRoutines(prev => [...prev, {
                            slot: editingSlot,
                            product_id: p.id,
                            name: p.name,
                          }])
                          setRoutineSearch('')
                          setShowRoutineSearch(false)
                        }}
                        style={{
                          padding: '9px 12px', fontSize: 12, color: '#111',
                          cursor: 'pointer', borderBottom: '0.5px solid #f5f5f5',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f5f0ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
                {showRoutineSearch && routineProducts.length > 0 && (
                  <div
                    onClick={() => setShowRoutineSearch(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  />
                )}
              </div>
            )}
            {myRoutines.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {myRoutines.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', background: 'var(--color-background-secondary)',
                    borderRadius: 8,
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#7B5EA7', color: '#fff',
                      fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>
                      {r.slot === 'morning' ? '아침' : r.slot === 'evening' ? '저녁' : '주간'}
                    </div>
                    <button
                      onClick={() => setMyRoutines(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ fontSize: 11, color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >삭제</button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    if (!user?.id || myRoutines.length === 0) return
                    // routines 테이블에 저장
                    const { data: routine } = await supabase
                      .from('routines')
                      .insert({
                        user_id: user.id,
                        title: editingSlot === 'morning' ? '아침 루틴' : editingSlot === 'evening' ? '저녁 루틴' : '주간 루틴',
                        time_slot: editingSlot,
                      })
                      .select('id')
                      .single()
                    if (routine) {
                      // routine_steps에 제품 순서 저장
                      await supabase.from('routine_steps').insert(
                        myRoutines.map((r, i) => ({
                          routine_id: routine.id,
                          product_id: r.product_id,
                          product_name: r.name,
                          step_order: i,
                        }))
                      )
                    }
                    setMyRoutines([])
                    setEditingSlot(null)
                  }}
                  style={{
                    width: '100%', padding: 11, borderRadius: 10,
                    border: 'none', background: '#7B5EA7', color: '#fff',
                    fontSize: 13, cursor: 'pointer', marginTop: 4,
                  }}
                >
                  루틴 저장하기 💜
                </button>
              </div>
            )}
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


{/* ===== [피부 기록 탭] ===== */}
{activeTab === 'skin_record' ? (
  <div style={{ padding: '16px 16px 0' }}>
    <div style={{ fontSize: 10, letterSpacing: 2, color: '#C9A96E', marginBottom: 6 }}>AURAN</div>
    <div style={{ fontSize: 17, color: 'var(--color-text-primary)', marginBottom: 4, letterSpacing: -0.3 }}>
      피부 기록 💜
    </div>
    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
      매달 체크인하면 피부 변화가 보여요
    </div>

    {/* 이번달 체크인 */}
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 12 }}>
        이번달 피부 체크인
      </div>
      {[
        { key: 'moisture', label: '수분' },
        { key: 'elasticity', label: '탄력' },
        { key: 'trouble', label: '트러블' },
      ].map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={async () => {
                  if (!user?.id) return
                  const month = new Date().toISOString().slice(0, 7)
                  await supabase.from('skin_records').upsert({
                    user_id: user.id,
                    record_month: month,
                    [key]: n,
                  }, { onConflict: 'user_id,record_month' })
                }}
                style={{
                  flex: 1, height: 32, borderRadius: 8,
                  border: '0.5px solid var(--color-border-secondary)',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        style={{
          width: '100%', padding: 11, borderRadius: 10,
          border: 'none', background: '#7B5EA7', color: '#fff',
          fontSize: 13, cursor: 'pointer', marginTop: 4,
        }}
      >
        이번달 기록 저장 💜
      </button>
    </div>

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        기록할수록 오랜이 나를 더 잘 알아가요 💜<br />
        페이즈마다 기록하면 딱 맞는 제품을 추천해드려요
      </div>

    {/* 호르몬 페이즈 기록 */}
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 12, marginTop: 12,
    }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 12 }}>
        🌙 지금 어떤 페이즈예요?
      </div>

      {/* 페이즈 선택 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['달빛기', '황금기', '만개기', '물들기'].map(p => (
          <button key={p} onClick={() => setSelectedPhase(p)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11,
              border: selectedPhase === p ? '1px solid #7B5EA7' : '0.5px solid var(--color-border-secondary)',
              background: selectedPhase === p ? '#7B5EA7' : 'var(--color-background-secondary)',
              color: selectedPhase === p ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >{p}</button>
        ))}
      </div>

      {/* 피부 상태 */}
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>피부가 어때요? (복수선택)</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['맑아요', '예민해요', '건조해요', '트러블'].map(s => (
          <button key={s} onClick={() => setPhaseSkinState(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
          )}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11,
              border: phaseSkinState.includes(s) ? '1px solid #7B5EA7' : '0.5px solid var(--color-border-secondary)',
              background: phaseSkinState.includes(s) ? '#7B5EA7' : 'var(--color-background-secondary)',
              color: phaseSkinState.includes(s) ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >{s}</button>
        ))}
      </div>

      {/* 기분 */}
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>기분은요?</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['안정적', '활기차요', '예민해요', '우울해요'].map(m => (
          <button key={m} onClick={() => setPhaseMood(m)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11,
              border: phaseMood === m ? '1px solid #7B5EA7' : '0.5px solid var(--color-border-secondary)',
              background: phaseMood === m ? '#7B5EA7' : 'var(--color-background-secondary)',
              color: phaseMood === m ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >{m}</button>
        ))}
      </div>

      {/* 수면 */}
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>수면은요?</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['잘 잤어요', '뒤척였어요', '너무 많이 잠'].map(s => (
          <button key={s} onClick={() => setPhaseSleep(s)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11,
              border: phaseSleep === s ? '1px solid #7B5EA7' : '0.5px solid var(--color-border-secondary)',
              background: phaseSleep === s ? '#7B5EA7' : 'var(--color-background-secondary)',
              color: phaseSleep === s ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >{s}</button>
        ))}
      </div>

      {/* 식욕 */}
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>식욕은요?</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['평소같아요', '폭발했어요', '없어요'].map(a => (
          <button key={a} onClick={() => setPhaseAppetite(a)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11,
              border: phaseAppetite === a ? '1px solid #7B5EA7' : '0.5px solid var(--color-border-secondary)',
              background: phaseAppetite === a ? '#7B5EA7' : 'var(--color-background-secondary)',
              color: phaseAppetite === a ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >{a}</button>
        ))}
      </div>

      {/* 한줄 메모 */}
      <input
        value={phaseMemo}
        onChange={e => setPhaseMemo(e.target.value)}
        placeholder="이번 페이즈 한줄 메모 (선택)"
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 12,
          border: '0.5px solid var(--color-border-secondary)',
          background: 'var(--color-background-secondary)',
          color: 'var(--color-text-primary)', marginBottom: 12,
          boxSizing: 'border-box',
        }}
      />

      {/* 저장 버튼 */}
      <button
        onClick={async () => {
          if (!user?.id || !selectedPhase) return
          await supabase.from('phase_experience_logs').insert({
            customer_id: user.id,
            phase: selectedPhase,
            skin_state: phaseSkinState,
            mood: phaseMood,
            sleep: phaseSleep,
            appetite: phaseAppetite,
            memo: phaseMemo,
          })
          setSelectedPhase('')
          setPhaseSkinState([])
          setPhaseMood('')
          setPhaseSleep('')
          setPhaseAppetite('')
          setPhaseMemo('')
        }}
        style={{
          width: '100%', padding: 11, borderRadius: 10,
          border: 'none', background: '#7B5EA7', color: '#fff',
          fontSize: 13, cursor: 'pointer',
        }}
      >
        기록하기 💜
      </button>
    </div>

    {/* 공유 카드 */}
    <div style={{
      background: '#2D1B5E',
      border: '0.5px solid rgba(201,169,110,0.3)',
      borderRadius: 14, padding: '16px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(201,169,110,0.5)', marginBottom: 6 }}>AURAN · 피부 기록</div>
      <div style={{ fontSize: 15, color: '#C9A96E', marginBottom: 4, letterSpacing: -0.2 }}>
        오랜과 함께한 기록 💜
      </div>
      <div style={{ fontSize: 11, color: 'rgba(201,169,110,0.5)', marginBottom: 12 }}>
        피부가 이렇게 달라졌어요
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { val: '-2살', lbl: '피부나이' },
          { val: '+30%', lbl: '수분' },
          { val: `${streakDays}일`, lbl: '루틴 스트릭' },
        ].map(({ val, lbl }) => (
          <div key={lbl} style={{
            flex: 1, background: 'rgba(201,169,110,0.08)',
            borderRadius: 8, padding: '8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, color: '#C9A96E' }}>{val}</div>
            <div style={{ fontSize: 9, color: 'rgba(201,169,110,0.5)', marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>
    </div>
    <button
      onClick={() => {
        navigator.clipboard?.writeText('https://auran.kr/myworld/' + user?.id)
        setToast('링크가 복사됐어요 💜')
      }}
      style={{
        width: '100%', padding: 12, borderRadius: 10,
        border: 'none', background: '#7B5EA7', color: '#fff',
        fontSize: 13, cursor: 'pointer', marginBottom: 16,
        letterSpacing: -0.2,
      }}
    >
      공유 카드 만들기 💜
    </button>
  </div>
) : null}

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
