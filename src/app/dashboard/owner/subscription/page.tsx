'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'

export default function OwnerSubscriptionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [me, setMe] = useState<any>(null)
  const [prices, setPrices] = useState({ basic: 30000, pro: 70000, premium: 150000 })
  const [plan, setPlan] = useState<'basic' | 'pro' | 'premium'>('basic')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return
      const { data: row } = await supabase.from('users').select('id,auth_id,owner_subscription_plan').eq('auth_id', user.id).maybeSingle()
      setMe(row)
      const { data } = await supabase.from('admin_settings').select('key,value').eq('category', 'owner_subscription')
      const m: Record<string, string> = {}
      ;((data as any[]) || []).forEach((r) => {
        m[r.key] = String(r.value || '')
      })
      setPrices({
        basic: Number(m.basic_price || 30000),
        pro: Number(m.pro_price || 70000),
        premium: Number(m.premium_price || 150000),
      })
    }
    void run()
  }, [supabase])

  const subscribe = async () => {
    if (!me?.id) return
    await supabase.from('owner_subscriptions').insert({ owner_id: me.id, plan, status: 'active', started_at: new Date().toISOString() } as any)
    await supabase.from('profiles').update({ owner_subscription_plan: plan } as any).eq('id', me.id)
    await supabase.from('notifications').insert({ user_id: me.id, type: 'promo', title: '구독이 시작됐어요 💜', body: `${plan.toUpperCase()} 플랜 구독이 시작됐어요`, icon: '💜', is_read: false } as any)
    setToast('구독이 시작됐어요 💜')
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 420, margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(13,11,9,0.95)', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18 }}>←</button>
        <div style={{ fontSize: 15 }}>원장님 구독</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>현재 구독 플랜: {String(me?.owner_subscription_plan || '-').toUpperCase()}</div>
        {[
          ['basic', 'BASIC', prices.basic, ['예약 시스템', '고객 관리 50명', '처방전 월 20건', '차트 작성']],
          ['pro', 'PRO', prices.pro, ['예약 + CRM 무제한', '피부 데이터 열람', '처방전 무제한', '케어룸 꾸미기', '통계 분석']],
          ['premium', 'PREMIUM', prices.premium, ['전체 기능', '전담 브랜드 설정', '알림톡 무제한', '추천 원장님 노출', '매출 통계 고급']],
        ].map((x) => {
          const key = x[0] as 'basic' | 'pro' | 'premium'
          const active = plan === key
          return (
            <button key={key} onClick={() => setPlan(key)} style={{ width: '100%', textAlign: 'left', marginBottom: 8, border: active ? '1px solid rgba(123,94,167,0.6)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, background: active ? 'rgba(123,94,167,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', padding: 12 }}>
              <div style={{ fontSize: 13 }}>{x[1]} · {Number(x[2]).toLocaleString()}원</div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{(x[3] as string[]).join(' / ')}</div>
            </button>
          )
        })}
        <button onClick={() => void subscribe()} style={{ width: '100%', marginTop: 10, border: 'none', borderRadius: 12, background: '#7B5EA7', color: '#fff', padding: '11px 0', fontSize: 13 }}>
          구독하기
        </button>
      </div>
      {toast ? <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 20, background: 'rgba(123,94,167,0.95)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>{toast}</div> : null}
    </div>
  )
}
