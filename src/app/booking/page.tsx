'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function BookingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [salons, setSalons] = useState<any[]>([])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('salons')
        .select('id,name,address,phone,status')
        .order('created_at', { ascending: false })
        .limit(30)
      setSalons(data || [])
      setLoading(false)
    }
    run()
  }, [supabase])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="살롱예약" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : salons.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>표시할 살롱이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {salons.map(s => (
              <div key={s.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{s.name || '살롱'}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
                  {s.address || '-'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{s.phone || ''}</div>
                  <div style={{ fontSize: 10, color: s.status === 'active' ? '#4cad7e' : 'var(--gold)' }}>
                    {s.status === 'active' ? '예약 가능' : '확인 중'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

