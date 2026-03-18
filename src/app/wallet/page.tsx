'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import PaymentAuthGuard from '@/components/PaymentAuthGuard'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WalletPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any | null>(null)
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [charging, setCharging] = useState(false)
  const [chargeMode, setChargeMode] = useState<'preset' | 'custom'>('preset')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(30000)
  const [customAmount, setCustomAmount] = useState<string>('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      // getUser()가 일시적으로 null을 반환하는 경우(세션 갱신 지연 등)가 있어서
      // session을 먼저 확인하고, 한 번 재시도 후에만 로그인 페이지로 이동
      const { data: session1 } = await supabase.auth.getSession()
      let authUser = session1.session?.user || null
      if (!authUser) {
        await new Promise(r => setTimeout(r, 250))
        const { data: session2 } = await supabase.auth.getSession()
        authUser = session2.session?.user || null
      }
      if (!authUser) {
        setLoading(false)
        router.replace('/login?role=customer')
        return
      }

      const { data: p } = await supabase.from('users').select('id,points,charge_balance').eq('auth_id', authUser.id).single()
      setProfile(p || null)
      try {
        const res = await fetch('/api/auth/pin/status', { credentials: 'same-origin' })
        const data = await res.json()
        setHasPin(!!data.hasPin)
      } catch {
        setHasPin(null)
      }
      setLoading(false)
    }
    run()
  }, [router, supabase])

  // 모바일 전체화면 고정 (다른 페이지 배경이 비치지 않게)
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  return (
    <div style={{ height: '100dvh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <DashboardHeader title="내 지갑" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0', flex: 1, overflowY: 'auto', paddingBottom: 220, scrollPaddingBottom: 220 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : !profile ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>지갑 정보를 불러올 수 없습니다.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.65)', marginBottom: 6 }}>보유 포인트</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{(profile.points || 0).toLocaleString()}P</div>
              </div>
              <div style={{ background: 'rgba(76,173,126,0.10)', border: '1px solid rgba(76,173,126,0.25)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.65)', marginBottom: 6 }}>충전 잔액</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: '#4cad7e' }}>₩{(profile.charge_balance || 0).toLocaleString()}</div>
              </div>
            </div>
            {hasPin === false && (
              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 8 }}>🔐 충전·정산을 위해 결제 PIN을 설정해주세요.</p>
                <button onClick={() => router.push('/auth/set-pin')} style={{ padding: '8px 14px', background: '#c9a84c', border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 600, fontSize: 13 }}>PIN 설정하기</button>
              </div>
            )}
            {hasPin === true && (
              <div style={{ marginBottom: 24, position: 'relative', zIndex: 40 }}>
                {/* 충전 방식 탭 */}
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.03)',
                    padding: 4,
                    marginBottom: 12,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {[
                    { key: 'preset', label: '고정 금액' },
                    { key: 'custom', label: '자유 입력' },
                  ].map(t => {
                    const active = chargeMode === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setChargeMode(t.key as 'preset' | 'custom')}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 999,
                          border: 'none',
                          background: active ? 'rgba(201,168,76,0.22)' : 'transparent',
                          color: active ? 'var(--gold)' : 'var(--text3)',
                          fontSize: 11,
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'background 0.2s ease, color 0.2s ease',
                        }}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>

                {/* 방식 A: 고정 금액 버튼 */}
                {chargeMode === 'preset' && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[30000, 50000, 100000].map(amt => {
                      const active = selectedAmount === amt
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSelectedAmount(amt)}
                          style={{
                            flex: 1,
                            padding: '10px 0',
                            borderRadius: 12,
                            border: active ? '1px solid rgba(201,168,76,0.9)' : '1px solid rgba(255,255,255,0.09)',
                            background: active ? 'rgba(201,168,76,0.16)' : 'rgba(255,255,255,0.02)',
                            color: active ? 'var(--gold)' : 'var(--text2)',
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          ₩{amt.toLocaleString()}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* 방식 B: 자유 입력 */}
                {chargeMode === 'custom' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>충전 금액을 직접 입력하세요.</div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.09)',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customAmount}
                        onChange={e => {
                          const onlyDigits = e.target.value.replace(/[^0-9]/g, '')
                          setCustomAmount(onlyDigits)
                        }}
                        placeholder="최소 1,000원"
                        style={{
                          flex: 1,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: 'var(--text)',
                          fontSize: 14,
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>원</span>
                    </div>
                  </div>
                )}

                {/* 선택 금액 표시 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>충전 예정 금액</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>
                    ₩
                    {(() => {
                      const amt =
                        chargeMode === 'preset'
                          ? selectedAmount || 0
                          : customAmount
                          ? Number(customAmount)
                          : 0
                      return amt.toLocaleString()
                    })()}
                  </span>
                </div>

                <PaymentAuthGuard
                  title="결제 PIN 확인"
                  requirePin
                  onSuccess={async () => {
                    // 세션이 끊긴 경우 바로 로그인으로 튕기지 않고 안내
                    const { data: s } = await supabase.auth.getSession()
                    if (!s.session?.user) {
                      alert('로그인이 필요합니다. 다시 로그인해주세요.')
                      router.replace('/login?role=customer')
                      return
                    }

                    let amt: number | null = null
                    if (chargeMode === 'preset') {
                      amt = selectedAmount
                    } else {
                      const n = Number(customAmount || '0')
                      amt = Number.isFinite(n) ? n : null
                    }

                    if (!amt || amt < 1000) {
                      alert('최소 1,000원 이상 선택 또는 입력해주세요.')
                      return
                    }

                    const ok = window.confirm(`${amt.toLocaleString()}원을 충전하시겠습니까?`)
                    if (!ok) return

                    setCharging(true)
                    try {
                      const res = await fetch('/api/payments/payapp/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({ kind: 'charge', amount: amt }),
                      })
                      const json = await res.json().catch(() => ({}))
                      if (!json?.ok || !json?.pay_url) throw new Error(json?.error || json?.reason || 'payapp_create_failed')
                      // 페이앱 실결제창으로 이동
                      window.location.href = json.pay_url
                    } catch (e: any) {
                      alert(e?.message || '결제 요청 중 오류가 발생했습니다.')
                    } finally {
                      setCharging(false)
                    }
                  }}
                >
                  <button
                    type="button"
                    disabled={charging}
                    style={{
                      width: '100%',
                      padding: 14,
                      background: 'rgba(76,173,126,0.2)',
                      border: '1px solid rgba(76,173,126,0.4)',
                      borderRadius: 12,
                      color: '#4cad7e',
                      fontWeight: 700,
                      opacity: charging ? 0.7 : 1,
                    }}
                  >
                    {charging ? '결제창 여는 중...' : '충전하기'}
                  </button>
                </PaymentAuthGuard>
              </div>
            )}
          </>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

