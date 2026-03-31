'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  const [kakaoNotify, setKakaoNotify] = useState(true)
  const [emailNotify, setEmailNotify] = useState(true)
  const [notifyRestock, setNotifyRestock] = useState(true)
  const [notifySale, setNotifySale] = useState(true)
  const [notifyBirthday, setNotifyBirthday] = useState(true)
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
      const { data: profile } = await supabase.from('profiles').select('*, avatar_url').eq('auth_id', user.id).single()
      setFullName(String(profile?.full_name ?? ''))
      setUsername(String(profile?.username ?? ''))
      setEmail(String(profile?.email ?? user.email ?? ''))
      setPhone(String(profile?.phone ?? ''))
      setBirthDate(String(profile?.birth_date ?? '').slice(0, 10))
      setAvatarUrl(profile?.avatar_url || '')
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
  }, [supabase])

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
        special_dates: specialDates,
      } as any)
      .eq('auth_id', authId)
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    setToast('프로필이 저장됐습니다 💜')
    window.setTimeout(() => {
      setToast('')
      router.back()
    }, 900)
  }

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !authId) return
    setUploading(true)
    // Supabase 대시보드에서 avatars 버킷 생성 필요
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
    const filePath = `avatars/${authId}_${Date.now()}.${ext}`
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
          {uploading ? <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#9b7ec8' }}>업로드 중...</div> : null}
        </div>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
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
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#7B5EA7', pointerEvents: 'none' }}>📅</span>
                <input
                  type="date"
                  className="profile-date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{
                    boxSizing: 'border-box',
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#ffffff',
                    border: '1px solid #7B5EA7',
                    colorScheme: 'dark',
                    padding: '12px 14px 12px 40px',
                    paddingLeft: 40,
                    borderRadius: 10,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#7B5EA7' }}>🎁 생일을 입력하면 생일 쿠폰 + 특별 선물 + 생일 테마가 자동으로 준비돼요</div>
            </div>
          </div>
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
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

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: GOLD }}>피부 정보</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부타입</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['지성', '건성', '복합성', '민감성', '중성'].map((x) => (
              <button key={x} type="button" className="btn" onClick={() => setSkinType(x)} style={selBtn(skinType === x)}>
                {x}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부 고민</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['수분부족', '모공', '트러블', '색소침착', '탄력', '민감', '미백', '주름'].map((x) => {
              const on = skinConcerns.includes(x)
              return (
                <button key={x} type="button" className="btn" onClick={() => setSkinConcerns((p) => (p.includes(x) ? p.filter((v) => v !== x) : [...p, x]))} style={selBtn(on)}>
                  {x}
                </button>
              )
            })}
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

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#b79ce8', marginBottom: 10, lineHeight: 1.5 }}>피부 맞춤 추천을 위한 정보예요 💜</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>생리 주기</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['규칙적', '불규칙', '폐경', '해당없음'].map((x) => (
              <button key={x} type="button" className="btn" onClick={() => setMenstrualCycle(x)} style={selBtn(menstrualCycle === x)}>
                {x}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>현재 상태</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['임신중', '수유중', '갱년기', '해당없음'].map((x) => {
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
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: GOLD }}>선호 브랜드</div>
          {brandsLoading ? <div style={{ fontSize: 11, color: TEXT_MUTED }}>브랜드 불러오는 중...</div> : null}
          {!brandsLoading && !brands.length ? <div style={{ fontSize: 11, color: TEXT_MUTED }}>등록된 브랜드가 없습니다</div> : null}
          {!!brands.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {brands.map((brand) => {
                const on = preferredBrands.includes(brand.name)
                return (
                  <div
                    key={brand.id}
                    onClick={() => setPreferredBrands((p) => (p.includes(brand.name) ? p.filter((v) => v !== brand.name) : [...p, brand.name]))}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: on ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)',
                      background: on ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.03)',
                      color: on ? '#9b7ec8' : 'rgba(255,255,255,0.6)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {brand.name}
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: '10px 14px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: GOLD }}>알림 설정</div>
          {toggleRow('카카오 알림톡 수신', kakaoNotify, setKakaoNotify)}
          {toggleRow('이메일 수신', emailNotify, setEmailNotify)}
          {toggleRow('재고알림', notifyRestock, setNotifyRestock)}
          {toggleRow('세일알림', notifySale, setNotifySale)}
          {toggleRow('생일쿠폰 알림', notifyBirthday, setNotifyBirthday)}
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
