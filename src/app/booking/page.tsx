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
      <div style={{ padding: '18px 18px 0' }}>
        <BookingSalonListView loading={loading} salons={salons} />
      </div>
      <DashboardBottomNav role="customer" />
    </CustomerDashboardShell>
  )
}

