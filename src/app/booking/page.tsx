'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import BookingSalonListView from '@/components/ui/BookingSalonListView'
import CustomerDashboardShell from '@/components/views/CustomerDashboardShell'
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
    <CustomerDashboardShell>
      <DashboardHeader title="살롱예약" right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px 16px 0' }}>
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <p style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>SALON</p>
          <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>살롱 예약</p>
          <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 300, lineHeight: 1.6, color: 'rgba(255,255,255,0.4)' }}>
            등록된 살롱을 확인하고 예약을 진행하세요.
          </p>
        </div>
        <BookingSalonListView loading={loading} salons={salons} />
      </div>
      <DashboardBottomNav role="customer" />
    </CustomerDashboardShell>
  )
}

