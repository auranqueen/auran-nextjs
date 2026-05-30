'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPayAppPayment } from '@/lib/payments/payapp'
import KakaoShareButton from '@/components/membership/KakaoShareButton'

const C = {
  purple: '#7B5EA7', gold: '#C9A96E', goldDark: '#A07F4A', cream: '#FAF6F0',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5', line: 'rgba(123,94,167,0.18)',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"

type Plan = { id: string; name: string; price: number; perks: string[]; display_order: number }

export default function MembershipCheckoutPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('membership_plans')
        .select('id,name,price,perks,display_order')
        .eq('is_active', true)
        .eq('tier_type', 'online')
        .order('display_order', { ascending: true })
      const rows = (data ?? []).map((p: any) => ({ ...p, perks: Array.isArray(p.perks) ? p.perks : [] })) as Plan[]
      setPlans(rows)
      if (rows.length) setSelected(rows[rows.length - 1].id)
      setLoading(false)
    }
    load()
  }, [])

  const handlePay = async () => {
    if (!selected || !agreed || paying) return
    const plan = plans.find((p) => p.id === selected)
    if (!plan) return
    setPaying(true)
    setErr(null)
    const res = await createPayAppPayment({ kind: 'membership', amount: plan.price, target_id: plan.id } as any)
    if (res.ok && res.pay_url) { window.location.href = res.pay_url; return }
    if ((res as any).reason === 'not_logged_in') { router.push('/login?role=customer'); return }
    setErr((res as any).error || '결제 요청에 실패했어요')
    setPaying(false)
  }

  if (loading) {
    return (
      <div style={{ background: C.cream, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontFamily: SERIF }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ background: C.cream, minHeight: '100vh', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 18px 40px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: 4, color: C.goldDark }}>ORÆN PRIVÉ</div>
          <div style={{ fontSize: 11, color: C.goldDark, letterSpacing: 2, marginTop: 8 }}>오랜이 만든 홀리스틱 멤버십</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>체크아웃</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
          {plans.map((p) => {
            const active = selected === p.id
            return (
              <button key={p.id} onClick={() => setSelected(p.id)} style={{ textAlign: 'left', background: '#fff', border: active ? `2px solid ${C.purple}` : `0.5px solid ${C.line}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: SERIF, fontSize: 17, letterSpacing: 1.5, color: C.purple }}>{p.name}</span>
                  <span style={{ fontSize: 13, color: C.goldDark }}>₩{p.price.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>연 6회 · 두 달마다 · 1년 선결제</div>
                {p.perks.length > 0 && (
                  <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.8, marginTop: 10 }}>
                    {p.perks.map((perk, i) => (<div key={i}>{perk}</div>))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: C.purple }} />
          <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>멤버십 이용약관과 환불·중도해지 규정에 동의합니다</span>
        </label>
        <div style={{ textAlign: 'center', fontSize: 11, color: C.faint, marginTop: 16, lineHeight: 1.7 }}>쿠폰과 토스트는 적용되지 않아요</div>
        {err && (<div style={{ textAlign: 'center', fontSize: 12, color: '#A33', marginTop: 12 }}>{err}</div>)}
        <button onClick={handlePay} disabled={!selected || !agreed || paying} style={{ width: '100%', marginTop: 14, background: !agreed || paying ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, padding: 14, fontSize: 14, fontFamily: 'inherit', cursor: !agreed || paying ? 'default' : 'pointer' }}>
          {paying ? '결제창으로 이동 중...' : '결제하고 시작하기'}
        </button>
        <KakaoShareButton />
      </div>
    </div>
  )
}
