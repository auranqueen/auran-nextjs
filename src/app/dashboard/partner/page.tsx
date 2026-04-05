'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const BG = '#0D0B09'

type TabKey = 'commissions' | 'settlement' | 'referrals'

function randomRefCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function normalizePartnerGrade(g: string | null | undefined): 'BASIC' | 'PRO' | 'PREMIUM' {
  const s = String(g || '').toLowerCase().trim()
  if (!s) return 'BASIC'
  if (['basic', 'rookie', 'r'].includes(s)) return 'BASIC'
  if (['pro', 'silver', 's'].includes(s)) return 'PRO'
  if (['premium', 'gold', 'platinum', 'g', 'p'].includes(s)) return 'PREMIUM'
  const u = s.toUpperCase()
  if (u === 'BASIC' || u === 'PRO' || u === 'PREMIUM') return u as 'BASIC' | 'PRO' | 'PREMIUM'
  return 'BASIC'
}

function maskName(name: string) {
  const s = String(name || '').trim()
  if (s.length <= 1) return '*'
  if (s.length === 2) return `${s[0]}*`
  return `${s[0]}${'*'.repeat(Math.min(2, s.length - 2))}${s[s.length - 1]}`
}

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export default function PartnerDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [commissions, setCommissions] = useState<any[]>([])
  const [commissionsMonth, setCommissionsMonth] = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [referralRows, setReferralRows] = useState<any[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<TabKey>('commissions')
  const [toast, setToast] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  const getSetting = useCallback(
    (key: string, fallback: string) => {
      const v = settings[key]
      return v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : fallback
    },
    [settings]
  )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?role=partner')
        return
      }

      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      const uid = urow?.id ? String(urow.id) : null
      setPartnerUserId(uid)

      const { data: prof } = await supabase
        .from('profiles')
        .select('username, full_name, grade, partner_grade, partner_referral_code, partner_total_sales, partner_total_commission, partner_bank_name, partner_bank_account, partner_bank_holder')
        .eq('auth_id', user.id)
        .maybeSingle()
      let p = prof as any

      if (p && !p.partner_referral_code) {
        let code = randomRefCode()
        for (let i = 0; i < 5; i++) {
          const { error: upErr } = await supabase.from('profiles').update({ partner_referral_code: code } as any).eq('auth_id', user.id)
          if (!upErr) break
          code = randomRefCode()
        }
        const { data: prof2 } = await supabase
          .from('profiles')
          .select('username, full_name, grade, partner_grade, partner_referral_code, partner_total_sales, partner_total_commission, partner_bank_name, partner_bank_account, partner_bank_holder')
          .eq('auth_id', user.id)
          .maybeSingle()
        p = prof2 as any
      }

      setProfile(p || null)
      setBankName(String(p?.partner_bank_name || ''))
      setBankAccount(String(p?.partner_bank_account || ''))
      setBankHolder(String(p?.partner_bank_holder || ''))

      if (uid) {
        const { start: ms, end: me } = monthRange()
        const [{ data: comm }, { data: commM }, { data: stl }, { data: logs }] = await Promise.all([
          supabase.from('partner_commissions').select('*').eq('partner_id', uid).order('created_at', { ascending: false }).limit(20),
          supabase
            .from('partner_commissions')
            .select('*')
            .eq('partner_id', uid)
            .gte('created_at', ms.toISOString())
            .lte('created_at', me.toISOString()),
          supabase.from('partner_settlements').select('*').eq('partner_id', uid).order('created_at', { ascending: false }),
          supabase.from('referral_logs').select('*').eq('referrer_id', uid).order('created_at', { ascending: false }).limit(80),
        ])
        const clist = (comm as any[]) || []
        setCommissions(clist)
        setCommissionsMonth((commM as any[]) || [])
        setSettlements((stl as any[]) || [])
        const logList = (logs as any[]) || []

        const pids = Array.from(new Set(clist.map((c) => String(c.product_id || '').trim()).filter(Boolean)))
        if (pids.length) {
          const { data: prows } = await supabase.from('products').select('id,name').in('id', pids)
          const nm: Record<string, string> = {}
          ;((prows as any[]) || []).forEach((r) => {
            nm[String(r.id)] = String(r.name || '')
          })
          setProductNames(nm)
        } else {
          setProductNames({})
        }

        const enriched: any[] = []
        for (const log of logList) {
          const refereeId = String(log.referee_id || log.referred_user_id || log.referee_user_id || log.user_id || '').trim()
          let displayName = '고객'
          let purchaseCount = 0
          let purchaseTotal = 0
          let commSum = 0
          if (refereeId) {
            const { data: ru } = await supabase.from('users').select('id,auth_id,name').eq('id', refereeId).maybeSingle()
            const authRef = (ru as any)?.auth_id
            if (authRef) {
              const { data: rp } = await supabase.from('profiles').select('username,full_name').eq('auth_id', authRef).maybeSingle()
              displayName = String((rp as any)?.username || (rp as any)?.full_name || (ru as any)?.name || '고객')
              const { data: ords } = await supabase.from('orders').select('id,total_amount,amount').eq('customer_id', authRef).limit(500)
              const ol = (ords as any[]) || []
              purchaseCount = ol.length
              purchaseTotal = ol.reduce((a, o) => a + Number(o.total_amount ?? o.amount ?? 0), 0)
              const oids = ol.map((o) => o.id).filter(Boolean)
              if (oids.length) {
                const { data: cpart } = await supabase.from('partner_commissions').select('commission_amount').eq('partner_id', uid).in('order_id', oids)
                commSum = ((cpart as any[]) || []).reduce((a, c) => a + Number(c.commission_amount || 0), 0)
              }
            } else {
              displayName = String((ru as any)?.name || '고객')
            }
          }
          enriched.push({
            ...log,
            _displayName: displayName,
            _purchaseCount: purchaseCount,
            _purchaseTotal: purchaseTotal,
            _commSum: commSum,
          })
        }
        setReferralRows(enriched)
      } else {
        setCommissions([])
        setCommissionsMonth([])
        setSettlements([])
        setReferralRows([])
        setProductNames({})
      }

      const [{ data: s1 }, { data: s2 }] = await Promise.all([
        supabase.from('admin_settings').select('key,value').eq('category', 'commission'),
        supabase.from('admin_settings').select('key,value').eq('category', 'partner'),
      ])
      const map: Record<string, string> = {}
      ;((s1 as any[]) || []).forEach((r) => {
        if (r?.key != null) map[String(r.key)] = String(r.value ?? '')
      })
      ;((s2 as any[]) || []).forEach((r) => {
        if (r?.key != null) map[String(r.key)] = String(r.value ?? '')
      })
      setSettings(map)
    } catch {
      setProfile(null)
      setCommissions([])
      setCommissionsMonth([])
      setSettlements([])
      setReferralRows([])
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const monthRecommendedSales = useMemo(() => {
    return commissionsMonth.reduce((a, c) => a + Number(c.order_amount || c.amount || 0), 0)
  }, [commissionsMonth])

  const monthCommission = useMemo(() => {
    return commissionsMonth.reduce((a, c) => a + Number(c.commission_amount || 0), 0)
  }, [commissionsMonth])

  const settlementPreview = useMemo(() => {
    return commissionsMonth.reduce((a, c) => {
      const st = String(c.status || '').toLowerCase()
      if (st !== 'confirmed' && st !== '확정') return a
      return a + Number(c.commission_amount || 0)
    }, 0)
  }, [commissionsMonth])

  const displayGrade = normalizePartnerGrade(profile?.partner_grade)

  const totalSales = Number(profile?.partner_total_sales || 0)
  const proMin = Number(getSetting('partner_grade_pro_min_sales', '1000000'))
  const premMin = Number(getSetting('partner_grade_premium_min_sales', '5000000'))

  const gradeProgress = useMemo(() => {
    if (displayGrade === 'BASIC') {
      const need = Math.max(0, proMin - totalSales)
      const pct = proMin > 0 ? Math.min(100, (totalSales / proMin) * 100) : 0
      return { label: 'PRO', need, pct, nextMin: proMin }
    }
    if (displayGrade === 'PRO') {
      const need = Math.max(0, premMin - totalSales)
      const pct = premMin > 0 ? Math.min(100, (totalSales / premMin) * 100) : 0
      return { label: 'PREMIUM', need, pct, nextMin: premMin }
    }
    return null
  }, [displayGrade, totalSales, proMin, premMin])

  const refLink = `https://auran.kr?ref=${profile?.partner_referral_code || ''}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(refLink)
      setToast('복사됐어요 💜')
    } catch {
      setToast('복사에 실패했어요')
    }
  }

  const shareKakao = async () => {
    const payload = { title: 'AURAN 파트너 추천', text: '추천 링크로 만나요 💜', url: refLink }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
    } catch {
      /* ignore */
    }
    void copyLink()
  }

  const saveBank = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('profiles')
      .update({
        partner_bank_name: bankName.trim() || null,
        partner_bank_account: bankAccount.trim() || null,
        partner_bank_holder: bankHolder.trim() || null,
      } as any)
      .eq('auth_id', user.id)
    setToast('저장됐어요 💜')
  }

  const commissionTypeStyle = (t: string) => {
    const s = String(t || '').toLowerCase()
    if (s.includes('공구') || s === 'groupbuy' || s === 'group') return { bg: 'rgba(201,169,110,0.15)', color: '#C9A96E', label: '공구' }
    if (s.includes('타임') || s === 'flash' || s === 'timesale') return { bg: 'rgba(74,141,192,0.15)', color: '#4a8dc0', label: '타임세일' }
    if (s.includes('이벤트') || s === 'event') return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', label: '이벤트' }
    return { bg: 'rgba(123,94,167,0.2)', color: '#c4a7e7', label: '일반' }
  }

  const statusStyle = (st: string) => {
    const s = String(st || '').toLowerCase()
    if (s === 'paid' || s === '지급완료') return { bg: 'rgba(76,173,126,0.15)', color: '#4cad7e', label: '지급완료' }
    if (s === 'confirmed' || s === '확정') return { bg: 'rgba(74,141,192,0.15)', color: '#4a8dc0', label: '확정' }
    if (s === 'cancelled' || s === 'canceled' || s === '취소') return { bg: 'rgba(255,100,100,0.12)', color: '#ff6b6b', label: '취소' }
    return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', label: '대기' }
  }

  const minSettle = Number(getSetting('partner_min_settlement_amount', '10000'))
  const settleDay = getSetting('partner_settlement_day', '25')

  const switchRole = async (role: string) => {
    await fetch('/api/profile/active-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (role === 'customer') window.location.href = '/'
    else if (role === 'owner') window.location.href = '/dashboard/owner'
    else if (role === 'partner') window.location.href = '/dashboard/partner'
    else if (role === 'brand') window.location.href = '/dashboard/brand'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', padding: 24 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>파트너스 대시보드</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid rgba(123,94,167,0.45)',
                background: 'rgba(123,94,167,0.15)',
                color: '#c4a7e7',
                fontWeight: 800,
              }}
            >
              {displayGrade}
            </span>
            <button
              onClick={() => switchRole('customer')}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 20, padding: '5px 12px',
                fontSize: 11, color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              ✦ 고객으로
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>이달 추천 판매</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#C9A96E', marginTop: 4 }}>₩{monthRecommendedSales.toLocaleString()}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>이달 커미션</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#c4a7e7', marginTop: 4 }}>₩{monthCommission.toLocaleString()}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>누적 총 판매</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#7B5EA7', marginTop: 4 }}>₩{Number(profile?.partner_total_sales || 0).toLocaleString()}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>누적 총 커미션</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#C9A96E', marginTop: 4 }}>₩{Number(profile?.partner_total_commission || 0).toLocaleString()}</div>
        </div>
      </div>

      <div style={{ margin: '0 16px 14px', background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>내 추천 링크 💜</div>
        <div style={{ fontSize: 12, color: '#c4a7e7', marginTop: 8, wordBreak: 'break-all', lineHeight: 1.5 }}>{refLink}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void copyLink()}
            style={{
              border: '1px solid rgba(123,94,167,0.35)',
              background: 'rgba(123,94,167,0.12)',
              color: '#c4a7e7',
              borderRadius: 10,
              padding: '10px 0',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📋 링크 복사
          </button>
          <button
            type="button"
            onClick={() => void shareKakao()}
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 0',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📤 카카오 공유
          </button>
        </div>
      </div>

      <div style={{ margin: '0 16px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>등급 현황</div>
        {gradeProgress ? (
          <>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
              {gradeProgress.label}까지 {gradeProgress.need.toLocaleString()}원 더!
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${gradeProgress.pct}%`, height: '100%', background: '#7B5EA7', borderRadius: 999 }} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>최고 등급이에요 💜</div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          <div>
            BASIC: {getSetting('partner_commission_basic', '5')}% · PRO: {getSetting('partner_commission_pro', '8')}% · PREMIUM:{' '}
            {getSetting('partner_commission_premium', '10')}%
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', margin: '0 16px 12px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
        {(
          [
            ['commissions', '커미션 내역'],
            ['settlement', '정산 관리'],
            ['referrals', '추천 고객'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 10,
              padding: '8px 4px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              background: tab === k ? 'rgba(123,94,167,0.25)' : 'transparent',
              color: tab === k ? '#c4a7e7' : 'rgba(255,255,255,0.45)',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        {tab === 'commissions' ? (
          commissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              아직 커미션 내역이 없어요
              <br />
              추천 링크를 공유해보세요 💜
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {commissions.map((c, idx) => {
                const pid = String(c.product_id || '')
                const pname = productNames[pid] || c.product_name || '제품'
                const ctype = commissionTypeStyle(c.commission_type || c.type || 'normal')
                const st = statusStyle(c.status)
                const rate = c.commission_rate != null ? `${Number(c.commission_rate)}%` : '-'
                return (
                  <div
                    key={String(c.id ?? `c-${idx}`)}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{pname}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
                      주문 ₩{Number(c.order_amount || c.amount || 0).toLocaleString()} · 커미션율 {rate} · 커미션 ₩
                      {Number(c.commission_amount || 0).toLocaleString()}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: ctype.bg, color: ctype.color }}>{ctype.label}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                      {c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : null}

        {tab === 'settlement' ? (
          <div>
            <div style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>이번달 예상 정산</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#c4a7e7', marginTop: 6 }}>₩{settlementPreview.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>매월 {settleDay}일 정산</div>
              {settlementPreview < minSettle ? (
                <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 8 }}>최소 정산금액 {minSettle.toLocaleString()}원 미만이에요</div>
              ) : null}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>정산 계좌 설정</div>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="은행명"
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }}
              />
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="계좌번호"
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }}
              />
              <input
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                placeholder="예금주"
                style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }}
              />
              <button
                type="button"
                onClick={() => void saveBank()}
                style={{ width: '100%', border: 'none', borderRadius: 10, background: '#7B5EA7', color: '#fff', padding: '11px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                저장
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>정산 내역</div>
            {settlements.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>정산 내역이 없어요</div>
            ) : (
              settlements.map((s) => {
                const done = String(s.status || '').toLowerCase().includes('완료') || String(s.status || '').toLowerCase() === 'completed' || String(s.status || '').toLowerCase() === 'paid'
                return (
                  <div
                    key={String(s.id)}
                    style={{
                      marginBottom: 8,
                      padding: 12,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                      {s.period_start && s.period_end
                        ? `${new Date(s.period_start).toLocaleDateString('ko-KR')} ~ ${new Date(s.period_end).toLocaleDateString('ko-KR')}`
                        : s.period || '-'}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      총 커미션 ₩{Number(s.total_commission || s.commission_total || 0).toLocaleString()} · 정산 ₩{Number(s.net_amount || s.settlement_amount || s.amount || 0).toLocaleString()}
                    </div>
                    <span
                      style={{
                        display: 'inline-block',
                        marginTop: 8,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 8,
                        background: done ? 'rgba(76,173,126,0.15)' : 'rgba(201,169,110,0.15)',
                        color: done ? '#4cad7e' : '#C9A96E',
                      }}
                    >
                      {s.status || '-'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        ) : null}

        {tab === 'referrals' ? (
          referralRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 12px', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
              아직 추천한 고객이 없어요
              <br />
              링크를 공유해서 친구를 초대해보세요 💜
            </div>
          ) : (
            referralRows.map((r, idx) => (
              <div
                key={String(r.id ?? `r-${idx}`)}
                style={{ marginBottom: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{maskName(r._displayName)}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                  가입 {r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '-'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
                  구매 {r._purchaseCount}회 · 총 ₩{r._purchaseTotal.toLocaleString()} · 내 커미션 ₩{r._commSum.toLocaleString()}
                </div>
              </div>
            ))
          )
        ) : null}
      </div>

      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 88, background: 'rgba(123,94,167,0.95)', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 200 }}>
          {toast}
        </div>
      ) : null}

      <DashboardBottomNav role="partner" />
    </div>
  )
}
