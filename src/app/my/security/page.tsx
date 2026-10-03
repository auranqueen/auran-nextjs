'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = 'var(--bg)'
const GOLD = 'var(--gold)'
const CARD_BG = 'rgba(var(--fg-rgb),0.03)'
const CARD_BORDER = '1px solid rgba(var(--fg-rgb),0.07)'
const TEXT_MUTED = 'rgba(var(--fg-rgb),0.55)'

export default function MySecurityPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [isKakao, setIsKakao] = useState(false)
  const [lastSignIn, setLastSignIn] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email || '')
      setLastSignIn(user.last_sign_in_at || '')
      const providers = (user.identities || []).map((i: any) => String(i.provider || '').toLowerCase())
      setIsKakao(providers.includes('kakao'))
      setLoading(false)
    }
    run()
  }, [router])

  const lastLoginText = useMemo(() => {
    if (!lastSignIn) return '-'
    return new Date(lastSignIn).toLocaleString('ko-KR')
  }, [lastSignIn])

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('새 비밀번호를 6자 이상 입력해주세요.')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('새 비밀번호와 확인이 일치하지 않습니다.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) alert(error.message)
    else {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      alert('비밀번호가 변경되었습니다.')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const withdraw = async () => {
    setWithdrawing(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await supabase.auth.signOut()
        router.push('/login')
      } else {
        alert('탈퇴 처리 중 오류가 발생했습니다.')
      }
    } catch {
      alert('탈퇴 처리 중 오류가 발생했습니다.')
    } finally {
      setWithdrawing(false)
      setShowWithdrawModal(false)
    }
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: 'var(--text)', paddingBottom: 20 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--bg)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>보안 설정</div>
      </header>

      <div style={{ padding: 16 }}>
        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>로그인 정보</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 6 }}>이메일</div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>{email || '-'}</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>카카오 로그인 연동</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{isKakao ? '연동됨' : '미연동'}</div>
        </section>

        {!loading && !isKakao ? (
          <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>비밀번호 변경</div>
            <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" placeholder="현재 비밀번호" style={{ width: '100%', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.04)', border: CARD_BORDER, color: 'var(--text)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }} />
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="새 비밀번호" style={{ width: '100%', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.04)', border: CARD_BORDER, color: 'var(--text)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }} />
            <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="새 비밀번호 확인" style={{ width: '100%', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.04)', border: CARD_BORDER, color: 'var(--text)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }} />
            <button onClick={changePassword} style={{ width: '100%', border: '1px solid rgba(201,169,110,0.3)', color: GOLD, background: 'rgba(201,169,110,0.1)', borderRadius: 10, padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>
              변경하기
            </button>
          </section>
        ) : null}

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14 }}>
          <div style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>계정 보안</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>마지막 로그인 일시</div>
          <div style={{ fontSize: 13, marginTop: 4, marginBottom: 12 }}>{lastLoginText}</div>
          <button onClick={signOut} style={{ width: '100%', border: '1px solid rgba(220,100,100,0.4)', color: '#ef9a9a', background: 'rgba(220,80,80,0.1)', borderRadius: 10, padding: '10px 0', fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
            로그아웃
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              border: '0.5px solid rgba(var(--fg-rgb),0.1)',
              borderRadius: 10,
              color: 'rgba(var(--fg-rgb),0.3)',
              fontSize: 13,
              cursor: 'pointer',
              marginTop: 8
            }}
          >
            회원 탈퇴
          </button>
        </section>
      </div>

      {showWithdrawModal ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ position: 'relative', background: 'var(--bg3)', borderRadius: 16, padding: '28px 24px', width: 'calc(100% - 48px)', maxWidth: 340 }}>
            <button
              type="button"
              onClick={() => setShowWithdrawModal(false)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'transparent',
                border: 'none',
                color: 'rgba(var(--fg-rgb),0.4)',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>잠깐, 정말 떠나실 건가요? 😢</div>
            <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-line' }}>
              {`지금 만개기잖아요.
피부가 가장 빛나는 이 시기에
AURAN이 없어도 괜찮을까요?
탈퇴하면 내 피부나이 기록,
호르몬 맞춤 루틴,
쌓아온 토스트가 전부 사라져요.
다음 달빛기엔 누가 챙겨줄까요... 🥺`}
            </div>
            <button
              type="button"
              onClick={() => setShowWithdrawModal(false)}
              style={{ width: '100%', padding: '13px', background: 'var(--purple)', color: '#FFF', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}
            >
              조금 더 있을게요 💜
            </button>
            <button
              type="button"
              onClick={withdraw}
              disabled={withdrawing}
              style={{ width: '100%', padding: '13px', marginTop: 8, background: 'transparent', border: '0.5px solid rgba(var(--fg-rgb),0.15)', color: 'rgba(var(--fg-rgb),0.4)', borderRadius: 10, fontSize: 13, cursor: withdrawing ? 'not-allowed' : 'pointer' }}
            >
              그래도 떠날게요
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
