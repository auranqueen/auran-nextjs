'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'

type Shipment = {
  id: string
  cycle_no: number
  status: string
  shipped_at: string
  bundle_templates: { theme_name: string; target_phase: string | null } | null
}

type Membership = {
  id: string
  shipments_total: number
  shipments_remaining: number
  next_shipment_date: string | null
  status: string
  membership_plans: { name: string } | null
}

export default function RitualsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?role=customer'); return }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      const myId = (urow as any)?.id
      if (!myId) { setLoading(false); return }
      const [{ data: mem }, { data: ships }] = await Promise.all([
        supabase.from('user_memberships')
          .select('id, shipments_total, shipments_remaining, next_shipment_date, status, membership_plans(name)')
          .eq('user_id', myId)
          .in('status', ['active', 'expired'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('membership_shipments')
          .select('id, cycle_no, status, shipped_at, bundle_templates(theme_name, target_phase)')
          .eq('user_id', myId)
          .order('cycle_no', { ascending: true }),
      ])
      setMembership((mem as any) || null)
      setShipments((ships as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  // 회차별 스케줄 계산
  const buildSchedule = () => {
    if (!membership) return []
    const total = membership.shipments_total || 6
    const remaining = membership.shipments_remaining || 0
    const completed = total - remaining
    const nextDate = membership.next_shipment_date ? new Date(membership.next_shipment_date) : null
    const schedule = []
    for (let i = 1; i <= total; i++) {
      const shipped = shipments.find(s => s.cycle_no === i)
      let date: string | null = null
      let state: 'done' | 'next' | 'pending' | 'expired' = 'pending'
      if (shipped) {
        date = shipped.shipped_at ? new Date(shipped.shipped_at).toLocaleDateString('ko-KR') : null
        state = 'done'
      } else if (i === completed + 1 && nextDate) {
        date = nextDate.toLocaleDateString('ko-KR')
        state = membership.status === 'expired' ? 'expired' : 'next'
      } else if (nextDate && i > completed + 1) {
        const d = new Date(nextDate)
        d.setMonth(d.getMonth() + (i - completed - 1) * 2)
        date = d.toLocaleDateString('ko-KR')
        state = membership.status === 'expired' ? 'expired' : 'pending'
      }
      schedule.push({ cycle: i, state, date, shipment: shipped || null })
    }
    return schedule
  }

  const schedule = buildSchedule()

  const stateStyle = (state: string): React.CSSProperties => ({
    done: { color: '#1D9E75', background: 'rgba(29,158,117,0.1)' },
    next: { color: '#C9A96E', background: 'rgba(201,169,110,0.12)' },
    pending: { color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' },
    expired: { color: '#555', background: 'rgba(255,255,255,0.03)' },
  }[state] || {})

  const stateLabel = (state: string) => ({
    done: '✅ 발송완료',
    next: '🔜 발송 예정',
    pending: '⏳ 예정',
    expired: '종료',
  }[state] || '')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0f', color: '#e8e0f5', paddingBottom: 80 }}>
      <DashboardHeader title="나의 리추얼" right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>불러오는 중...</div>
        ) : !membership ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌙</div>
            <div style={{ fontSize: 13, color: '#555' }}>멤버십이 없어요</div>
          </div>
        ) : (
          <>
            {/* 멤버십 헤더 */}
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 2, marginBottom: 6 }}>ORÆN PRIVÉ</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, color: '#F0E8FF' }}>{(membership.membership_plans as any)?.name || '멤버십'}</div>
                  <div style={{ fontSize: 11, color: '#9B7EC8', marginTop: 4 }}>총 {membership.shipments_total}회 리추얼</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, color: '#C9A96E' }}>{membership.shipments_total - membership.shipments_remaining}</div>
                  <div style={{ fontSize: 10, color: '#9B7EC8' }}>/ {membership.shipments_total}회 완료</div>
                </div>
              </div>
              {/* 프로그레스 바 */}
              <div style={{ marginTop: 12, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((membership.shipments_total - membership.shipments_remaining) / membership.shipments_total) * 100}%`, background: '#C9A96E', borderRadius: 4, transition: 'width 0.5s' }}/>
              </div>
            </div>

            {/* 회차 스케줄 */}
            <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 10, letterSpacing: 1 }}>리추얼 스케줄</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schedule.map(({ cycle, state, date, shipment }) => (
                <div
                  key={cycle}
                  onClick={() => shipment && router.push('/my/rituals/' + shipment.id)}
                  style={{
                    background: state === 'done' ? 'rgba(29,158,117,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `0.5px solid ${state === 'done' ? 'rgba(29,158,117,0.2)' : state === 'next' ? 'rgba(201,169,110,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    cursor: shipment ? 'pointer' : 'default',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: state === 'done' ? '#F0E8FF' : state === 'next' ? '#C9A96E' : '#555' }}>
                        {cycle}회차
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, ...stateStyle(state) }}>
                        {stateLabel(state)}
                      </span>
                    </div>
                    {date && (
                      <div style={{ fontSize: 11, color: state === 'done' ? '#1D9E75' : state === 'next' ? '#C9A96E' : '#444' }}>
                        {state === 'done' ? '발송일 ' : '예정일 '}{date}
                      </div>
                    )}
                    {shipment && (
                      <div style={{ fontSize: 11, color: '#7B5EA7', marginTop: 2 }}>
                        {(shipment.bundle_templates as any)?.theme_name || ''}
                        {(shipment.bundle_templates as any)?.target_phase ? ` · ${(shipment.bundle_templates as any).target_phase}` : ''}
                      </div>
                    )}
                  </div>
                  {shipment && (
                    <div style={{ fontSize: 11, color: '#7B5EA7' }}>상세 →</div>
                  )}
                  {state === 'next' && !shipment && (
                    <div style={{ fontSize: 10, color: '#C9A96E', opacity: 0.7 }}>준비중</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
