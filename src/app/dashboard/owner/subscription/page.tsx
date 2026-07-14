'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
const BG = '#0D0B09'

type OwnerMode = 'auran' | 'independent' | 'integrated'

type SubPlanRow = {
  id: string
  slug?: string | null
  code?: string | null
  name?: string | null
  mode?: string | null
  owner_mode?: string | null
  price?: number | null
  billing_period?: string | null
  features?: string[] | null
  sort_order?: number | null
  is_recommended?: boolean | null
}

const MODE_META: Record<
  OwnerMode,
  { label: string; hint: string }
> = {
  auran: {
    label: 'AURAN 연동',
    hint: 'AURAN 고객 연동 · 처방전 커미션 · 케어룸 노출',
  },
  independent: {
    label: '독립 모드',
    hint: '자체 스토어 운영 · 본인 제품 판매 · AURAN 미노출',
  },
  integrated: {
    label: '통합 모드',
    hint: '두 가지 모두 · 최대 기능 · 할인 적용',
  },
}

function planMode(p: SubPlanRow): string | null {
  return String(p.mode ?? p.owner_mode ?? '').trim() || null
}

function pricePeriodLabel(p: SubPlanRow): '/년' | '/월' {
  return String(p.billing_period || '').toLowerCase() === 'annual' ? '/년' : '/월'
}

export default function OwnerSubscriptionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [originTrack, setOriginTrack] = useState<'A' | 'B' | null>(null)
  const [profile, setProfile] = useState<{
    id: string
    owner_mode: OwnerMode | null
    owner_subscription_plan: string | null
  } | null>(null)
  const [activeSub, setActiveSub] = useState<any | null>(null)
  const [planRows, setPlanRows] = useState<SubPlanRow[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<OwnerMode>('auran')
  const [toast, setToast] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<SubPlanRow | null>(null)

  const getSetting = useCallback(
    (key: string, fallback: string) => {
      const v = settings[key]
      return v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : fallback
    },
    [settings]
  )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=owner')
      setLoading(false)
      return false
    }

    const { data: prof } = await supabase.from('profiles').select('*').eq('auth_id', user.id).maybeSingle()

    const { data: urow } = await supabase
      .from('users')
      .select('id, origin_track')
      .eq('auth_id', user.id)
      .maybeSingle()
    const oid = urow?.id ? String(urow.id) : null
    setOwnerUserId(oid)
    const rawTrack = String((urow as { origin_track?: string | null } | null)?.origin_track || '')
      .trim()
      .toUpperCase()
    setOriginTrack(rawTrack === 'A' || rawTrack === 'B' ? rawTrack : null)
    const rawMode = (prof as any)?.owner_mode as string | undefined
    const om: OwnerMode | null =
      rawMode === 'auran' || rawMode === 'independent' || rawMode === 'integrated' ? rawMode : null
    setProfile(
      prof
        ? {
            id: String((prof as any).id),
            owner_mode: om,
            owner_subscription_plan: (prof as any).owner_subscription_plan ?? null,
          }
        : null
    )

    let hasActive = false
    if (oid) {
      const { data: subs } = await supabase
        .from('owner_subscriptions')
        .select('*')
        .eq('owner_id', oid)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
      const list = (subs as any[]) || []
      const row = list[0] || null
      setActiveSub(row)
      hasActive = !!row
    } else {
      setActiveSub(null)
    }

    const { data: plans, error: plansErr } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (!plansErr && plans && plans.length) {
      const normalized = (plans as SubPlanRow[]).map((row) => {
        const r = { ...row }
        let f = r.features
        if (typeof f === 'string') {
          try {
            f = JSON.parse(f as unknown as string)
          } catch {
            f = []
          }
        }
        if (!Array.isArray(f)) f = []
        return { ...r, features: f as string[] }
      })
      setPlanRows(normalized)
    } else {
      setPlanRows([])
    }

    const { data: adm } = await supabase.from('admin_settings').select('key, value').eq('category', 'subscription')
    const m: Record<string, string> = {}
    ;((adm as any[]) || []).forEach((r) => {
      if (r?.key) m[String(r.key)] = String(r.value ?? '')
    })
    setSettings(m)

    if (om === 'auran' || om === 'independent' || om === 'integrated') {
      setMode(om)
    } else {
      setMode('auran')
    }

    setLoading(false)
    return hasActive
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const confirmAfterPayment = async () => {
    const ok = await load()
    if (ok) {
      setToast('구독이 시작됐어요 💜')
      router.push('/dashboard/owner')
    } else {
      setToast('아직 결제 반영 전이에요. 잠시 후 다시 눌러주세요')
    }
  }

  const trialDays = getSetting('owner_free_trial_days', '30')

  const filteredPlans = useMemo(() => {
    return planRows.filter((p) => {
      const slug = String(p.slug || p.code || '').toLowerCase()
      if (slug.startsWith('track_a_')) {
        if (originTrack !== 'A') return false
      } else if (slug.startsWith('track_b_')) {
        if (originTrack !== 'B') return false
      }
      // track_a_/track_b_ 패턴이 아니면 기존 mode 필터만
      const pm = planMode(p)
      if (!pm) return true
      return pm === mode
    })
  }, [planRows, mode, originTrack])

  const priceFor = (p: SubPlanRow) => {
    const slug = String(p.slug || p.code || p.id || '')
    const keys = [`price_${slug}`, `subscription_${slug}_price`, `owner_plan_${slug}`]
    for (const k of keys) {
      const v = settings[k]
      if (v !== undefined && v !== null && String(v).trim() !== '') return Number(v)
    }
    const dbPrice = Number(p.price)
    if (Number.isFinite(dbPrice) && dbPrice > 0) return dbPrice
    return 0
  }

  const dDayLabel = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return 'D-?'
    const ms = new Date(expiresAt).getTime() - Date.now()
    const days = Math.max(0, Math.ceil(ms / 86400000))
    return `D-${days}`
  }

  const openPay = (p: SubPlanRow) => {
    setPayTarget(p)
    setPayOpen(true)
  }

  const startCardPay = async () => {
    if (!payTarget || !ownerUserId) return
    const amount = priceFor(payTarget)
    if (!Number.isFinite(amount) || amount < 1000) {
      setToast('금액 설정을 확인해주세요')
      return
    }
    const slug = String(payTarget.slug || payTarget.code || payTarget.id)
    const planName = String(payTarget.name || slug)
    const payload = {
      owner_id: ownerUserId,
      plan: slug,
      plan_name: planName,
      mode,
      monthly_price: amount,
    }
    const res = await fetch('/api/payments/payapp/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        kind: 'owner_subscription',
        amount,
        target_id: JSON.stringify(payload),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (json?.ok && json?.pay_url) {
      window.location.href = json.pay_url as string
      return
    }
    setToast(json?.error ? String(json.error) : '결제 요청에 실패했어요')
  }

  const cancelSubscription = async () => {
    if (!activeSub?.id || !ownerUserId) return
    await supabase.from('owner_subscriptions').update({ status: 'cancelled' } as any).eq('id', activeSub.id)
    setToast('구독이 취소 처리됐어요')
    void load()
  }

  const modeLabel = (m: string | null | undefined) => {
    if (m === 'auran' || m === 'independent' || m === 'integrated') return MODE_META[m].label
    return m || '-'
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(13,11,9,0.95)',
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18 }}>
          ←
        </button>
        <div style={{ fontSize: 15 }}>원장님 구독</div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>불러오는 중…</div>
        ) : (
          <>
            {/* 현재 구독 현황 */}
            {activeSub ? (
              <div
                style={{
                  background: 'rgba(123,94,167,0.1)',
                  border: '1px solid rgba(123,94,167,0.3)',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4a7e7' }}>{String(activeSub.plan || profile?.owner_subscription_plan || '구독')}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
                  모드: {modeLabel(profile?.owner_mode)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                  만료: {activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString('ko-KR') : '-'}
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(123,94,167,0.25)',
                      color: '#e8d6ff',
                      fontWeight: 700,
                    }}
                  >
                    {dDayLabel(activeSub.expires_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
                    style={{
                      flex: 1,
                      border: '1px solid rgba(123,94,167,0.4)',
                      background: 'rgba(123,94,167,0.15)',
                      color: '#c4a7e7',
                      borderRadius: 12,
                      padding: '10px 0',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    플랜 변경
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelSubscription()}
                    style={{
                      flex: 1,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.75)',
                      borderRadius: 12,
                      padding: '10px 0',
                      fontSize: 12,
                    }}
                  >
                    구독 취소
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.6,
                }}
              >
                아직 구독 플랜이 없어요
                <br />
                플랜을 선택해서 시작해보세요 💜
                <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(196,167,231,0.85)' }}>
                  {trialDays}일 무료 체험 가능
                </div>
              </div>
            )}

            {/* 모드 선택 */}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>운영 모드</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {(Object.keys(MODE_META) as OwnerMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    textAlign: 'left',
                    border: mode === m ? '1px solid rgba(123,94,167,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    background: mode === m ? 'rgba(123,94,167,0.12)' : 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    color: '#fff',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: mode === m ? '#c4a7e7' : '#fff' }}>{MODE_META[m].label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{MODE_META[m].hint}</div>
                </button>
              ))}
            </div>

            {/* 플랜 카드 */}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>플랜 선택</div>
            <button
              type="button"
              onClick={() => void confirmAfterPayment()}
              style={{
                width: '100%',
                marginBottom: 12,
                border: '1px solid rgba(123,94,167,0.25)',
                background: 'rgba(123,94,167,0.08)',
                color: '#c4a7e7',
                borderRadius: 12,
                padding: '10px 0',
                fontSize: 12,
              }}
            >
              결제 완료 후 여기서 확인하기
            </button>

            {filteredPlans.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: '12px 0' }}>
                이 모드에 등록된 플랜이 없어요. 관리자에게 subscription_plans 등록을 요청해주세요.
              </div>
            ) : (
              filteredPlans.map((p) => {
                const slug = String(p.slug || p.code || '').toLowerCase()
                const isPro = slug === 'pro' || p.is_recommended === true
                const price = priceFor(p)
                const feats = Array.isArray(p.features) ? p.features : []
                return (
                  <div
                    key={p.id}
                    style={{
                      position: 'relative',
                      background: 'rgba(255,255,255,0.03)',
                      border: isPro ? '1px solid rgba(123,94,167,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 16,
                      padding: 20,
                      marginBottom: 12,
                    }}
                  >
                    {isPro ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: 'rgba(123,94,167,0.35)',
                          color: '#f0e8ff',
                          fontWeight: 800,
                        }}
                      >
                        추천
                      </span>
                    ) : null}
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{p.name || p.slug || '플랜'}</div>
                    <div style={{ marginTop: 8, fontSize: 18, color: '#C9A96E', fontWeight: 800 }}>
                      {price > 0 ? `${price.toLocaleString()}원${pricePeriodLabel(p)}` : '가격 문의'}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {feats.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>혜택 정보가 없습니다</div>
                      ) : (
                        feats.map((f, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                            ✅ {f}
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPay(p)}
                      style={{
                        marginTop: 14,
                        width: '100%',
                        border: 'none',
                        borderRadius: 12,
                        background: '#7B5EA7',
                        color: '#fff',
                        padding: '11px 0',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      선택하기
                    </button>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {payOpen && payTarget ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: '#1a1228',
              border: '1px solid rgba(123,94,167,0.45)',
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>결제</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{payTarget.name || payTarget.slug}</div>
            <div style={{ fontSize: 18, color: '#C9A96E', marginTop: 6, fontWeight: 800 }}>
              {priceFor(payTarget).toLocaleString()}원{pricePeriodLabel(payTarget)}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              첫 {trialDays}일 무료 후 {priceFor(payTarget).toLocaleString()}원{pricePeriodLabel(payTarget)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setPayOpen(false)
                  setPayTarget(null)
                }}
                style={{
                  flex: 1,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '11px 0',
                  fontSize: 12,
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void startCardPay()}
                style={{
                  flex: 2,
                  border: 'none',
                  borderRadius: 12,
                  background: '#7B5EA7',
                  color: '#fff',
                  padding: '11px 0',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                카드 결제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 88,
            background: 'rgba(123,94,167,0.95)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            zIndex: 200,
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      ) : null}

    </div>
  )
}
