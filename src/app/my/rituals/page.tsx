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

export default function RitualsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?role=customer'); return }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      const myId = (urow as any)?.id
      if (!myId) { setLoading(false); return }
      const { data } = await supabase
        .from('membership_shipments')
        .select('id, cycle_no, status, shipped_at, bundle_templates(theme_name, target_phase)')
        .eq('user_id', myId)
        .order('cycle_no', { ascending: false })
      setShipments((data as any) || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0f', color: '#e8e0f5', paddingBottom: 80 }}>
      <DashboardHeader title="나의 리추얼" right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>불러오는 중...</div>
        ) : shipments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌙</div>
            <div style={{ fontSize: 13, color: '#555' }}>아직 발송된 리추얼이 없어요</div>
          </div>
        ) : shipments.map(s => (
          <div key={s.id}
            onClick={() => router.push('/my/rituals/' + s.id)}
            style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 14, padding: '16px', marginBottom: 12, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 2 }}>ORÆN PRIVÉ</div>
              <div style={{ fontSize: 10, color: '#9B7EC8' }}>{s.shipped_at ? new Date(s.shipped_at).toLocaleDateString('ko-KR') : ''}</div>
            </div>
            <div style={{ fontSize: 15, color: '#F0E8FF', marginBottom: 4 }}>{s.cycle_no}회차 리추얼</div>
            <div style={{ fontSize: 12, color: '#9B7EC8' }}>
              {(s.bundle_templates as any)?.theme_name || ''} {(s.bundle_templates as any)?.target_phase ? `· ${(s.bundle_templates as any).target_phase}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#7B5EA7', marginTop: 8 }}>자세히 보기 →</div>
          </div>
        ))}
      </div>
    </div>
  )
}
