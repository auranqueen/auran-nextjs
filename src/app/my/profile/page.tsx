'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'

const selBtn = (on: boolean) =>
  ({
    border: on ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)',
    color: on ? '#9b7ec8' : 'rgba(255,255,255,0.65)',
    background: on ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.04)',
    fontSize: 11,
    padding: '7px 10px',
    borderRadius: 8,
    cursor: 'pointer',
  }) as const

export default function MyProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [authId, setAuthId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const [skinType, setSkinType] = useState('')
  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [allergyIngredients, setAllergyIngredients] = useState<string[]>([])

  const [menstrualCycle, setMenstrualCycle] = useState('')
  const [bodyStatus, setBodyStatus] = useState<string[]>([])
  const [procedureHistory, setProcedureHistory] = useState<string[]>([])

  const [sleepHours, setSleepHours] = useState(7)
  const [drinkFrequency, setDrinkFrequency] = useState('')
  const [exerciseFrequency, setExerciseFrequency] = useState('')
  const [smoke, setSmoke] = useState(false)
  const [stressLevel, setStressLevel] = useState('')

  const [preferredBrands, setPreferredBrands] = useState<string[]>([])
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [brandEditMode, setBrandEditMode] = useState(false)
  const [brandEditSnapshot, setBrandEditSnapshot] = useState<string[]>([])
  const [brandSaving, setBrandSaving] = useState(false)

  const [kakaoNotify, setKakaoNotify] = useState(true)
  const [emailNotify, setEmailNotify] = useState(true)
  const [notifyRestock, setNotifyRestock] = useState(true)
  const [notifySale, setNotifySale] = useState(true)
  const [notifyBirthday, setNotifyBirthday] = useState(true)
  const [notificationSound, setNotificationSound] = useState<string>('violet')
  const [specialDates, setSpecialDates] = useState<{ label: string; date: string; notify_days: number }[]>([])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        setLoading(false)
        return
      }
      setAuthId(user.id)
      const { data: profile } = await supabase.from('profiles').select('*, avatar_url').eq('auth_id', user.id).maybeSingle()
      setFullName(String(profile?.full_name ?? ''))
      setUsername(String(profile?.username ?? ''))
      setEmail(String(profile?.email ?? user.email ?? ''))
      setPhone(String(profile?.phone ?? ''))
      setBirthDate(String(profile?.birth_date ?? '').slice(0, 10))
      if (profile?.birth_date) {
        const bd = String(profile.birth_date).slice(0, 10)
        const [y, m, d] = bd.split('-')
        setBirthYear(y || '')
        setBirthMonth(String(Number(m || '0')) || '')
        setBirthDay(String(Number(d || '0')) || '')
      } else {
        setBirthYear('')
        setBirthMonth('')
        setBirthDay('')
      }
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url)
      } else {
        setAvatarUrl('')
      }
      setSkinType(String(profile?.skin_type ?? ''))
      setSkinConcerns(Array.isArray(profile?.skin_concerns) ? (profile?.skin_concerns as string[]) : [])
      setAllergyIngredients(Array.isArray(profile?.allergy_ingredients) ? (profile?.allergy_ingredients as string[]) : [])
      setMenstrualCycle(String(profile?.menstrual_cycle ?? ''))
      const bs = profile?.body_status
      if (Array.isArray(bs)) setBodyStatus(bs as string[])
      else if (typeof bs === 'string' && bs.trim()) setBodyStatus(bs.split(',').map((s) => s.trim()).filter(Boolean))
      else setBodyStatus([])
      setProcedureHistory(Array.isArray(profile?.procedure_history) ? (profile?.procedure_history as string[]) : [])
      const sh = profile?.sleep_hours
      setSleepHours(typeof sh === 'number' && !Number.isNaN(sh) ? sh : 7)
      setDrinkFrequency(String(profile?.drink_frequency ?? ''))
      setExerciseFrequency(String(profile?.exercise_frequency ?? ''))
      setSmoke(!!profile?.smoke)
      setStressLevel(String(profile?.stress_level ?? ''))
      setPreferredBrands(Array.isArray(profile?.preferred_brands) ? (profile?.preferred_brands as string[]) : [])
      setKakaoNotify(profile?.kakao_notify !== false)
      setEmailNotify(profile?.email_notify !== false)
      setNotifyRestock(profile?.notify_restock !== false)
      setNotifySale(profile?.notify_sale !== false)
      setNotifyBirthday(profile?.notify_birthday !== false)
      setNotificationSound(String((profile as { notification_sound?: string | null } | null)?.notification_sound ?? 'violet'))
      setSpecialDates(Array.isArray(profile?.special_dates) ? (profile?.special_dates as { label: string; date: string; notify_days: number }[]) : [])
      const { data: brandData, error: brandError } = await supabase.from('brands').select('id, name').eq('status', 'active').order('name')
      if (brandData) setBrands(brandData as { id: string; name: string }[])
      if (brandError) {
        const { data: fallbackBrandData } = await supabase.from('brands').select('id, name').order('name')
        if (fallbackBrandData) setBrands(fallbackBrandData as { id: string; name: string }[])
      }
      setBrandsLoading(false)
      setLoading(false)
    }
    void run()
  }, [])

  useEffect(() => {
    if (birthYear && birthMonth && birthDay) {
      setBirthDate(`${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`)
    }
  }, [birthYear, birthMonth, birthDay])

  const persist = async () => {
    if (!authId) return
    setSaving(true)
    const bodyStatusVal = bodyStatus.length ? bodyStatus.join(',') : null
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username,
        phone,
        birth_date: birthDate || null,
        skin_type: skinType || null,
        skin_concerns: skinConcerns,
        allergy_ingredients: allergyIngredients,
        onboarding_done: true,
        menstrual_cycle: menstrualCycle || null,
        body_status: bodyStatusVal,
        procedure_history: procedureHistory,
        sleep_hours: sleepHours,
        drink_frequency: drinkFrequency || null,
        exercise_frequency: exerciseFrequency || null,
        smoke,
        stress_level: stressLevel || null,
        preferred_brands: preferredBrands,
        kakao_notify: kakaoNotify,
        email_notify: emailNotify,
        notify_restock: notifyRestock,
        notify_sale: notifySale,
        notify_birthday: notifyBirthday,
        notification_sound: notificationSound,
        special_dates: specialDates,
      } as any)
      .eq('auth_id', authId)
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    router.push('/my')
    setToast(profileCompletion === 100 ? '완성! 이제 오랜의 모든 기능을 누릴 수 있어요 💜' : '프로필이 저장됐습니다 💜')
    window.setTimeout(() => {
      setToast('')
    }, 900)
  }

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !authId) return
    setUploading(true)
    // Supabase 대시보드에서 avatars 버킷 생성 필요
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
    const filePath = `avatars/${authId}_${Date.now()}.${ext}`
    file = await compressImage(file, 'avatar')
    const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true, cacheControl: '3600' })
    if (upErr) {
      setUploading(false)
      alert('사진 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl
    if (publicUrl) {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        setUploading(false)
        alert('사진 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('auth_id', user.id)
      if (dbErr) {
        setUploading(false)
        alert('사진 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
      setUploading(false)
    }
    setUploading(false)
  }

  const toggleRow = (label: string, value: boolean, set: (v: boolean) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
      <button
        type="button"
        onClick={() => set(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 999,
          border: 'none',
          background: value ? '#7B5EA7' : 'rgba(255,255,255,0.15)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: value ? 22 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  )
  const yearOptions = Array.from({ length: 2010 - 1940 + 1 }, (_, i) => String(2010 - i))
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const selectedYear = Number(birthYear || '0')
  const selectedMonth = Number(birthMonth || '0')
  const isLeap = selectedYear > 0 && ((selectedYear % 4 === 0 && selectedYear % 100 !== 0) || selectedYear % 400 === 0)
  const daysInMonth = selectedMonth === 2 ? (isLeap ? 29 : 28) : [4, 6, 9, 11].includes(selectedMonth) ? 30 : 31
  const dayOptions = selectedMonth ? Array.from({ length: daysInMonth }, (_, i) => String(i + 1)) : []
  const profileCompletion = useMemo(() => {
    let score = 0
    if (skinType.trim()) score += 20
    if (skinConcerns.length > 0) score += 15
    if (menstrualCycle.trim()) score += 10
    if (bodyStatus.length > 0) score += 10
    if (Number.isFinite(sleepHours)) score += 10
    if (drinkFrequency.trim()) score += 10
    if (exerciseFrequency.trim()) score += 10
    if (allergyIngredients.length > 0) score += 10
    if (preferredBrands.length > 0) score += 5
    return Math.min(100, score)
  }, [skinType, skinConcerns, menstrualCycle, bodyStatus, sleepHours, drinkFrequency, exerciseFrequency, allergyIngredients, preferredBrands])
  const profileGuideText =
    profileCompletion <= 30
      ? '아직 피부가 낯선가요? 🥺\n조금만 알려주면\n딱 맞는 제품 찾아드려요 💜'
      : profileCompletion <= 60
        ? '절반 왔어요! 🌱\n조금만 더 알려주면\n추천이 2배 정확해져요 ✨'
        : profileCompletion <= 80
          ? '거의 다 왔어요! 💜\n세밀한 정보가 쌓일수록\n피부 주치의가 더 똑똑해져요'
          : profileCompletion < 100
            ? '피부 주치의 완성 직전이에요 👑\n마지막 정보만 채워주세요!'
            : '완벽한 피부 프로파일이에요 ✨\nAURAN이 누구보다\n내 피부를 잘 알아요 💜'
  const scrollToMissing = () => {
    if (!skinType.trim() || skinConcerns.length === 0 || allergyIngredients.length === 0) {
      document.getElementById('profile-skin-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!menstrualCycle.trim() || bodyStatus.length === 0) {
      document.getElementById('profile-detail-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!drinkFrequency.trim() || !exerciseFrequency.trim()) {
      document.getElementById('profile-lifestyle-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (preferredBrands.length === 0) {
      document.getElementById('profile-brand-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", color: '#fff', paddingBottom: 100 }}>
      <style>{`
        .profile-date::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.9; cursor: pointer; }
      `}</style>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '12px 12px',
          background: 'rgba(13,11,9,0.96)',
          borderBottom: CARD_BORDER,
        }}
      >
        <button type="button" className="btn btn-gy" style={{ justifySelf: 'start' }} onClick={() => router.back()}>
          ←
        </button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>프로필 편집</div>
        <button
          type="button"
          disabled={saving || !authId}
          onClick={() => void persist()}
          style={{
            justifySelf: 'end',
            background: 'none',
            border: 'none',
            color: GOLD,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          저장
        </button>
      </header>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void onAvatarFile(e)} />

      <div style={{ padding: '16px 14px 0' }}>
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 4 }}>사진 변경</div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  border: '2px solid rgba(201,169,110,0.3)',
                  overflow: 'hidden',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)',
                }}
              >
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
                      border: '2px solid rgba(123,94,167,0.4)',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '28px' }}>👩</span>
                )}
              </button>
            </div>
          </div>
          {uploading ? <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#9b7ec8' }}>업로드 중...</div> : null}
        </div>

        <section style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>내 피부 프로파일 완성도</div>
          <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
            <div style={{ width: `${profileCompletion}%`, height: 8, borderRadius: 999, background: '#7B5EA7' }} />
          </div>
          <div style={{ fontSize: 11, color: '#c4a7e7', marginTop: 8, fontWeight: 700 }}>{profileCompletion}%</div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{profileGuideText}</div>
          {profileCompletion < 100 ? (
            <button
              type="button"
              onClick={scrollToMissing}
              style={{ marginTop: 10, border: '1px solid rgba(123,94,167,0.4)', background: 'transparent', color: '#c4a7e7', borderRadius: 10, padding: '8px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
            >
              지금 채우기 →
            </button>
          ) : null}
        </section>

        <section id="profile-skin-section" style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: GOLD }}>기본 정보</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>이름</div>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '10px 12px', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>닉네임</div>
              <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '10px 12px', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>이메일</div>
              <input value={email} readOnly style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#888', fontSize: 13, padding: '10px 12px', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>전화번호</div>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, padding: '10px 12px', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>생년월일</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: birthYear ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.3)',
                    borderRadius: 10,
                    padding: '12px 10px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="" style={{ color: '#111' }}>년도</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y} style={{ color: '#111' }}>{y}년</option>
                  ))}
                </select>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: birthMonth ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.3)',
                    borderRadius: 10,
                    padding: '12px 10px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="" style={{ color: '#111' }}>월</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m} style={{ color: '#111' }}>{m}월</option>
                  ))}
                </select>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: birthDay ? '1px solid #7B5EA7' : '1px solid rgba(123,94,167,0.3)',
                    borderRadius: 10,
                    padding: '12px 10px',
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="" style={{ color: '#111' }}>일</option>
                  {dayOptions.map((d) => (
                    <option key={d} value={d} style={{ color: '#111' }}>{d}일</option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#7B5EA7' }}>🎁 생일을 입력하면 생일 쿠폰 + 특별 선물 + 생일 테마가 자동으로 준비돼요</div>
            </div>
          </div>
        </section>

        <section id="profile-detail-section" style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: GOLD }}>🗓 특별한 날 (D-day 관리)</div>
          <div style={{ fontSize: 11, color: '#b79ce8', marginBottom: 10 }}>중요한 날 N일 전에 미리 알려드려요 💜</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {['결혼기념일', '자녀생일', '부모님생일', '시술예약일', '여행출발일'].map((label) => (
              <button
                key={label}
                type="button"
                className="btn"
                style={selBtn(false)}
                onClick={() => {
                  setSpecialDates((prev) => {
                    if (!prev.length) return [{ label, date: '', notify_days: 7 }]
                    const emptyIdx = prev.findIndex((x) => !x.label.trim())
                    if (emptyIdx >= 0) return prev.map((x, i) => (i === emptyIdx ? { ...x, label } : x))
                    return prev.map((x, i) => (i === 0 ? { ...x, label } : x))
                  })
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {specialDates.map((item, i) => (
              <div key={i} style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input
                    value={item.label}
                    placeholder="예: 결혼기념일, 딸 생일"
                    onChange={(e) => setSpecialDates((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '9px 10px', outline: 'none' }}
                  />
                  <input
                    type="date"
                    className="profile-date"
                    value={item.date ? `${new Date().getFullYear()}-${item.date}` : ''}
                    onChange={(e) => {
                      const mmdd = e.target.value ? e.target.value.slice(5, 10) : ''
                      setSpecialDates((prev) => prev.map((x, idx) => (idx === i ? { ...x, date: mmdd } : x)))
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid #7B5EA7', borderRadius: 8, colorScheme: 'dark', fontSize: 12, padding: '9px 10px', outline: 'none' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                    <select
                      value={item.notify_days}
                      onChange={(e) => setSpecialDates((prev) => prev.map((x, idx) => (idx === i ? { ...x, notify_days: Number(e.target.value) } : x)))}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, padding: '9px 10px', outline: 'none' }}
                    >
                      {[1, 3, 7, 14, 30].map((d) => (
                        <option key={d} value={d} style={{ color: '#111' }}>
                          {d}일 전
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setSpecialDates((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ border: '1px solid rgba(255,80,80,0.5)', color: '#ff7b7b', background: 'rgba(255,80,80,0.08)', fontSize: 12 }}
                    >
                      X
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn"
            disabled={specialDates.length >= 10}
            onClick={() => {
              if (specialDates.length >= 10) return
              setSpecialDates((prev) => [...prev, { label: '', date: '', notify_days: 7 }])
            }}
            style={{ marginTop: 10, width: '100%', border: '1px dashed #7B5EA7', color: '#9b7ec8', background: 'rgba(123,94,167,0.08)' }}
          >
            + 기념일 추가
          </button>
        </section>

        <section id="profile-lifestyle-section" style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: GOLD }}>피부 정보</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부타입</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <div style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: skinType ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.04)',
              border: skinType ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.08)',
              color: skinType ? '#9b7ec8' : 'rgba(255,255,255,0.3)',
              fontSize: 12,
            }}>
              {skinType || 'AI 분석 후 자동으로 채워져요 💜'}
            </div>
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부 고민</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {skinConcerns.length > 0 ? skinConcerns.map((x) => (
              <div key={x} style={{ ...selBtn(true), cursor: 'default' }}>
                {x}
              </div>
            )) : (
              <div style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.3)',
                fontSize: 12,
                cursor: 'default',
              }}>
                AI 분석 후 자동으로 채워져요 💜
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>알레르기 성분</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['파라벤', '알코올', '향료', '실리콘', '없음'].map((x) => {
              const on = allergyIngredients.includes(x)
              return (
                <button key={x} type="button" className="btn" onClick={() => setAllergyIngredients((p) => (p.includes(x) ? p.filter((v) => v !== x) : [...p, x]))} style={selBtn(on)}>
                  {x}
                </button>
              )
            })}
          </div>
        </section>

        <section id="profile-brand-section" style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#b79ce8', marginBottom: 10, lineHeight: 1.5 }}>피부 케어 기준을 알려주세요 💜</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부 케어 사이클</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['사이클 있어요', '불규칙해요', '폐경 이후예요', '해당없어요'].map((x) => (
              <button key={x} type="button" className="btn" onClick={() => setMenstrualCycle(x)} style={selBtn(menstrualCycle === x)}>
                {x}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>케어 스타일</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['임신/수유 중이에요', '갱년기 케어 중이에요', '일반 케어로 할게요', '해당없어요'].map((x) => {
              const on = bodyStatus.includes(x)
              return (
                <button key={x} type="button" className="btn" onClick={() => setBodyStatus((p) => (p.includes(x) ? p.filter((v) => v !== x) : [...p, x]))} style={selBtn(on)}>
                  {x}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>시술 이력</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['보톡스/필러', '레이저', '실리프팅', '없음'].map((x) => {
              const on = procedureHistory.includes(x)
              return (
                <button key={x} type="button" className="btn" onClick={() => setProcedureHistory((p) => (p.includes(x) ? p.filter((v) => v !== x) : [...p, x]))} style={selBtn(on)}>
                  {x}
                </button>
              )
            })}
          </div>
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: GOLD }}>라이프스타일</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>수면 평균 ({sleepHours}시간)</div>
          <input type="range" min={4} max={10} step={0.5} value={sleepHours} onChange={(e) => setSleepHours(Number(e.target.value))} style={{ width: '100%', accentColor: '#7B5EA7', marginBottom: 12 }} />
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>음주 빈도</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['거의안함', '월1~2회', '주1~2회', '거의매일'].map((x) => (
              <button key={x} type="button" className="btn" onClick={() => setDrinkFrequency(x)} style={selBtn(drinkFrequency === x)}>
                {x}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>운동 빈도</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['거의안함', '주1~2회', '주3~4회', '매일'].map((x) => (
              <button key={x} type="button" className="btn" onClick={() => setExerciseFrequency(x)} style={selBtn(exerciseFrequency === x)}>
                {x}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>{toggleRow('흡연', smoke, setSmoke)}</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>스트레스</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['낮음', '보통', '높음', '매우높음'].map((x) => (
              <button key={x} type="button" className="btn" onClick={() => setStressLevel(x)} style={selBtn(stressLevel === x)}>
                {x}
              </button>
            ))}
          </div>
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 300, marginBottom: 10, color: GOLD, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>선호 브랜드</span>
            {!brandEditMode && (
              <span
                onClick={() => { setBrandEditSnapshot([...preferredBrands]); setBrandEditMode(true) }}
                style={{ fontSize: 11, color: '#9b7ec8', cursor: 'pointer' }}
              >
                편집
              </span>
            )}
          </div>

          {!brandEditMode && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {preferredBrands.length === 0 ? (
                <div
                  onClick={() => { setBrandEditSnapshot([]); setBrandEditMode(true) }}
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                >
                  + 브랜드 추가
                </div>
              ) : (
                <>
                  {preferredBrands.map((name) => (
                    <div
                      key={name}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px 6px 14px', borderRadius: 20, border: '1px solid #7B5EA7', background: 'rgba(123,94,167,0.15)', color: '#9b7ec8', fontSize: 12 }}
                    >
                      {name}
                      <span
                        onClick={() => setPreferredBrands((p) => p.filter((v) => v !== name))}
                        style={{ fontSize: 13, color: 'rgba(155,126,200,0.6)', cursor: 'pointer', lineHeight: 1 }}
                      >×</span>
                    </div>
                  ))}
                  <div
                    onClick={() => { setBrandEditSnapshot([...preferredBrands]); setBrandEditMode(true) }}
                    style={{ padding: '6px 14px', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer' }}
                  >
                    + 추가
                  </div>
                </>
              )}
            </div>
          )}

          {brandEditMode && (
            <>
              {brandsLoading ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>불러오는 중...</div>
              ) : null}
              {!!brands.length && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {brands.map((brand) => {
                    const on = preferredBrands.includes(brand.name)
                    return (
                      <div
                        key={brand.id}
                        onClick={() => setPreferredBrands((p) => p.includes(brand.name) ? p.filter((v) => v !== brand.name) : [...p, brand.name])}
                        style={{ padding: '6px 14px', borderRadius: 20, border: on ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', background: on ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.03)', color: on ? '#9b7ec8' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {on ? '✓ ' : ''}{brand.name}
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setPreferredBrands(brandEditSnapshot); setBrandEditMode(false) }}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 300 }}
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    setBrandSaving(true)
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                      await supabase.from('profiles').update({ preferred_brands: preferredBrands } as any).eq('auth_id', user.id)
                    }
                    setBrandSaving(false)
                    setBrandEditMode(false)
                  }}
                  style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 300 }}
                >
                  {brandSaving ? '저장 중...' : '적용'}
                </button>
              </div>
            </>
          )}
        </section>

        <section id="notify" style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '10px 14px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: GOLD }}>알림 설정</div>
          {toggleRow('카카오 알림톡 수신', kakaoNotify, setKakaoNotify)}
          {toggleRow('이메일 수신', emailNotify, setEmailNotify)}
          {toggleRow('재고알림', notifyRestock, setNotifyRestock)}
          {toggleRow('세일알림', notifySale, setNotifySale)}
          {toggleRow('생일쿠폰 알림', notifyBirthday, setNotifyBirthday)}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>채팅 알림음</div>
            {[
              { id: 'violet', emoji: '💜', label: 'Violet Chime' },
              { id: 'toast', emoji: '🍞', label: 'Toast Pop' },
              { id: 'luxury', emoji: '✨', label: 'Gold Tone' },
              { id: 'magic', emoji: '🌸', label: 'Magic Sparkle' },
              { id: 'aube', emoji: '🌙', label: 'Aube Whisper' },
            ].map((s) => (
              <div
                key={s.id}
                onClick={() => setNotificationSound(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 10,
                  marginBottom: 6,
                  cursor: 'pointer',
                  background: notificationSound === s.id ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${notificationSound === s.id ? '#7B5EA7' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <span style={{ fontSize: 16 }}>{s.emoji}</span>
                <span style={{ fontSize: 12, color: '#fff' }}>{s.label}</span>
                {notificationSound === s.id ? (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#7B5EA7' }}>선택됨 ✓</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 390,
          margin: '0 auto',
          padding: '12px 14px 16px',
          background: 'linear-gradient(180deg, transparent, rgba(13,11,9,0.95) 18%)',
          zIndex: 30,
        }}
      >
        <button
          type="button"
          disabled={saving || !authId}
          onClick={() => void persist()}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background: '#7B5EA7',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.75 : 1,
          }}
        >
          저장하기
        </button>
      </div>

      {loading ? <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', padding: 12 }}>불러오는 중...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 88, zIndex: 100, background: 'rgba(123,94,167,0.95)', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
