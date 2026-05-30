'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPayAppPayment } from '@/lib/payments/payapp'

const C = {
  purple: '#7B5EA7', goldDark: '#A07F4A', cream: '#FAF6F0',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5', line: 'rgba(123,94,167,0.18)',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"

type Plan = { id: string; name: string; price: number; perks: string[]; display_order: number }

export default function MembershipGiftPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [senderName, setSenderName] = useState('')
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
      if (rows.length) setSelected(rows[0].id)
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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?role=customer'); return }
    const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const myId = (urow as any)?.id
    if (!myId) { setErr('로그인 정보를 확인할 수 없어요'); setPaying(false); return }
    const { data: gift, error } = await supabase
      .from('membership_gifts')
      .insert({
        plan_id: plan.id,
        gifted_by: myId,
        amount: plan.price,
        message: message.trim() || null,
        sender_name: senderName.trim() || null,
      } as any)
      .select('id')
      .single()
    if (error || !gift) { setErr('선물 생성에 실패했어요: ' + (error?.message ?? '')); setPaying(false); return }
    const res = await createPayAppPayment({ kind: 'membership_gift', amount: plan.price, target_id: (gift as any).id } as any)
    if (res.ok && res.pay_url) { window.location.href = res.pay_url; return }
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

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: '#fff', border: `0.5px solid ${C.line}`,
    borderRadius: 9, padding: '11px 12px', fontFamily: 'inherit', fontSize: 13, color: '#111', outline: 'none',
  }

  return (
    <div style={{ background: C.cream, minHeight: '100vh', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 18px 40px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: 4, color: C.goldDark }}>ORÆN PRIVÉ</div>
          <div style={{ fontSize: 11, color: C.goldDark, letterSpacing: 2, marginTop: 8 }}>선물하기</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>결제 후 받는 분께 보낼 링크가 알림으로 도착해요</div>
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
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: C.faint, marginBottom: 5 }}>받는 분께 한마디 (선택)</div>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="예: 요즘 고생 많았어. 오랜이 챙겨줄게 💜" style={{ ...field, resize: 'vertical' }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.faint, marginBottom: 5 }}>보내는 사람 이름 (선택)</div>
          <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="카드에 표시돼요" style={field} />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 18, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: C.purple }} />
          <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>멤버십 이용약관과 환불·중도해지 규정에 동의합니다</span>
        </label>

        {err && (<div style={{ textAlign: 'center', fontSize: 12, color: '#A33', marginTop: 12 }}>{err}</div>)}

        <button onClick={handlePay} disabled={!selected || !agreed || paying} style={{ width: '100%', marginTop: 14, background: !agreed || paying ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, padding: 14, fontSize: 14, fontFamily: 'inherit', cursor: !agreed || paying ? 'default' : 'pointer' }}>
          {paying ? '결제창으로 이동 중...' : '선물 결제하기'}
        </button>
      </div>
    </div>
  )
}
