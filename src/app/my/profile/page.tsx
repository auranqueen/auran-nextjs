'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'

export default function MyProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [authId, setAuthId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [skinType, setSkinType] = useState('')
  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [grade, setGrade] = useState('PETAL')
  const [avatarUrl, setAvatarUrl] = useState('')

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username, email, phone, birth_date, skin_type, skin_concerns, grade, avatar_url')
        .eq('auth_id', user.id)
        .single()
      setFullName(String(profile?.full_name ?? ''))
      setUsername(String(profile?.username ?? ''))
      setEmail(String(profile?.email ?? user.email ?? ''))
      setPhone(String(profile?.phone ?? ''))
      setBirthDate(String(profile?.birth_date ?? ''))
      setSkinType(String(profile?.skin_type ?? ''))
      setSkinConcerns(Array.isArray(profile?.skin_concerns) ? profile?.skin_concerns : [])
      setGrade(String(profile?.grade ?? 'PETAL'))
      setAvatarUrl(String(profile?.avatar_url ?? ''))
      setLoading(false)
    }
    void run()
  }, [supabase])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", color: '#fff', paddingBottom: 24 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.96)', borderBottom: CARD_BORDER }}>
        <button type="button" className="btn btn-gy" onClick={() => router.back()}>
          ←
        </button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>프로필 편집</div>
        <button
          type="button"
          className="btn"
          disabled={saving || !authId}
          onClick={async () => {
            if (!authId) return
            setSaving(true)
            const { error } = await supabase
              .from('profiles')
              .update({
                full_name: fullName,
                username,
                phone,
                birth_date: birthDate || null,
                skin_type: skinType || null,
                skin_concerns: skinConcerns,
              } as any)
              .eq('auth_id', authId)
            setSaving(false)
            if (error) {
              alert(error.message)
              return
            }
            setToast('저장됐습니다')
            window.setTimeout(() => {
              setToast('')
              router.back()
            }, 800)
          }}
          style={{
            border: '1px solid rgba(201,169,110,0.35)',
            color: GOLD,
            background: 'rgba(201,169,110,0.08)',
            opacity: saving ? 0.7 : 1,
          }}
        >
          저장
        </button>
      </header>

      <div style={{ padding: '18px 16px 0' }}>
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', border: '2px solid rgba(201,169,110,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>👩</span>}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-gy" style={{ fontSize: 10 }}>
              사진 변경
            </button>
          </div>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>이름</div>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '9px 10px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>닉네임</div>
              <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '9px 10px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>이메일</div>
              <input value={email} readOnly style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#9a9a9a', fontSize: 12, padding: '9px 10px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>전화번호</div>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '9px 10px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>생년월일</div>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '9px 10px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부타입</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['지성', '건성', '복합성', '민감성', '중성'].map((x) => (
                  <button
                    key={x}
                    type="button"
                    className="btn"
                    onClick={() => setSkinType(x)}
                    style={{
                      border: skinType === x ? '1px solid #7B5EA7' : '1px solid var(--border)',
                      color: skinType === x ? '#B79CE7' : 'var(--text2)',
                      background: skinType === x ? 'rgba(123,94,167,0.2)' : 'var(--bg3)',
                      fontSize: 11,
                    }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>피부 고민</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['수분부족', '모공', '트러블', '색소침착', '탄력', '민감', '미백', '주름'].map((x) => {
                  const on = skinConcerns.includes(x)
                  return (
                    <button
                      key={x}
                      type="button"
                      className="btn"
                      onClick={() => setSkinConcerns((prev) => (prev.includes(x) ? prev.filter((v) => v !== x) : [...prev, x]))}
                      style={{
                        border: on ? '1px solid #7B5EA7' : '1px solid var(--border)',
                        color: on ? '#B79CE7' : 'var(--text2)',
                        background: on ? 'rgba(123,94,167,0.2)' : 'var(--bg3)',
                        fontSize: 11,
                      }}
                    >
                      {x}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginTop: 4, paddingTop: 10, borderTop: CARD_BORDER }}>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>현재 등급 (읽기전용)</div>
              <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(201,169,110,0.3)', background: 'rgba(201,169,110,0.12)', color: GOLD, fontSize: 11, fontFamily: 'monospace' }}>
                {grade || 'PETAL'}
              </div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6 }}>등급은 구매 실적에 따라 자동 변경됩니다</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: 10 }}>불러오는 중...</div> : null}
      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, zIndex: 100, background: 'rgba(201,169,110,0.95)', color: BG, borderRadius: 10, padding: '10px 14px', fontSize: 12, fontWeight: 700 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
