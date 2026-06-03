'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import LoginRequiredModal from '@/components/LoginRequiredModal'
type GiftSent = {
  id: string
  status: string
  shipping_status: string | null
  shipping_name: string | null
  gift_copy: string | null
  claim_token: string | null
  amount: number
  message: string | null
  created_at: string
  tracking_no: string | null
  courier: string | null
  membership_plans?: { name: string } | null
}
const SHIP_LABEL: Record<string, string> = {
  pending: '배송지 미입력',
  address_received: '배송지 등록완료',
  shipped: '발송완료',
  delivered: '배송완료',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '결제대기',
  paid: '전달 대기중',
  claimed: '수령완료',
}
export default function GiftsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [authed, setAuthed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [sentGifts, setSentGifts] = useState<GiftSent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'sent' | 'received'>('sent')
  const [membership, setMembership] = useState<any>(null)
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setShowLogin(true); setLoading(false); return }
      setAuthed(true)
      const { data: urow } = await supabase
        .from('users').select('id').eq('auth_id', user.id).maybeSingle()
      const myId = (urow as any)?.id
      if (!myId) { setLoading(false); return }
      const [{ data: sent }, { data: mem }] = await Promise.all([
        supabase
          .from('membership_gifts')
          .select('id, status, shipping_status, shipping_name, gift_copy, claim_token, amount, message, created_at, tracking_no, courier, membership_plans(name)')
          .eq('gifted_by', myId)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_memberships')
          .select('id, status, next_shipment_date, shipments_remaining, source_type, membership_plans(name)')
          .eq('user_id', myId)
          .eq('source_type', 'membership_gift')
          .eq('status', 'active')
          .maybeSingle(),
      ])
      setSentGifts((sent as any) || [])
      setMembership(mem || null)
      setLoading(false)
    }
    load()
  }, [])
  if (!authed && !loading) return (
    <LoginRequiredModal open={showLogin} onClose={() => router.back()} returnPath="/my/gifts" />
  )
  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0f', color: '#e8e0f5', paddingBottom: 80 }}>
      <DashboardHeader
        title="선물함"
        right={<CustomerHeaderRight />}
      />
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
        {(['sent', 'received'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none', fontSize: 12, cursor: 'pointer',
            background: tab === t ? '#7B5EA7' : 'rgba(123,94,167,0.15)',
            color: tab === t ? '#fff' : '#9B7EC8',
          }}>
            {t === 'sent' ? '보낸 선물' : '받은 선물'}
          </button>
        ))}
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>불러오는 중...</div>
        ) : tab === 'sent' ? (
          sentGifts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎁</div>
              <div style={{ fontSize: 13, color: '#555' }}>보낸 선물이 없어요</div>
              <button onClick={() => router.push('/membership/gift')} style={{ marginTop: 16, padding: '10px 24px', background: '#7B5EA7', border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer' }}>
                선물하기
              </button>
            </div>
          ) : sentGifts.map(g => (
            <div key={g.id} style={{ background: 'rgba(123,94,167,0.08)', border: '0.5px solid rgba(123,94,167,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: '#e8e0f5' }}>{(g.membership_plans as any)?.name || '멤버십'} · ₩{g.amount?.toLocaleString()}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(123,94,167,0.2)', color: '#9B7EC8' }}>{STATUS_LABEL[g.status] || g.status}</span>
              </div>
              {g.gift_copy && <div style={{ fontSize: 11, color: '#C9A96E', marginBottom: 6 }}>"{g.gift_copy}"</div>}
              {g.shipping_name && <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 4 }}>받는 분: {g.shipping_name}</div>}
              {g.shipping_status && <div style={{ fontSize: 10, color: '#7B5EA7' }}>{SHIP_LABEL[g.shipping_status] || g.shipping_status}</div>}
              {g.tracking_no && <div style={{ fontSize: 10, color: '#1D9E75', marginTop: 4 }}>{g.courier} {g.tracking_no}</div>}
              {(!g.shipping_status || g.shipping_status === 'pending') && g.claim_token && (
                <button
                  onClick={() => router.push('/membership/claim/' + g.claim_token)}
                  style={{ marginTop: 8, padding: '8px 16px', background: '#7B5EA7', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'block', width: '100%' }}
                >
                  📦 배송지 입력하기
                </button>
              )}
              {g.status === 'paid' && g.claim_token && (
                <button
                  onClick={() => { navigator.clipboard?.writeText('https://auran.kr/membership/claim/' + g.claim_token); alert('링크 복사됐어요 💜') }}
                  style={{ marginTop: 8, padding: '6px 14px', background: 'transparent', border: '1px solid rgba(201,169,110,0.4)', color: '#C9A96E', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}
                >
                  🔗 선물 링크 복사
                </button>
              )}
            </div>
          ))
        ) : (
          membership ? (
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.25)', borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#C9A96E', marginBottom: 8 }}>ORÆN PRIVÉ</div>
              <div style={{ fontSize: 14, color: '#F0E8FF', marginBottom: 6 }}>🎁 선물로 받은 멤버십</div>
              <div style={{ fontSize: 13, color: '#e8e0f5', marginBottom: 4 }}>{(membership.membership_plans as any)?.name || '멤버십'} 구독 중</div>
              <div style={{ fontSize: 11, color: '#9B7EC8' }}>
                다음 배송일 · {membership.next_shipment_date ? new Date(membership.next_shipment_date).toLocaleDateString('ko-KR') : '미정'}
              </div>
              <div style={{ fontSize: 11, color: '#C9A96E', marginTop: 4 }}>남은 횟수 · {membership.shipments_remaining}회</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🎁</div>
              <div style={{ fontSize: 13, color: '#555' }}>받은 선물 멤버십이 없어요</div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
