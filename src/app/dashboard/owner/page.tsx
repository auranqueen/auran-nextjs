// ── OWNER (Salon)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalonDashClient from '../salon/client'
import OwnerDashClientV2 from './client-v2'

export default async function OwnerDashboard({ searchParams }: { searchParams: { v?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=owner')

  if (searchParams?.v === '2') {
    return <OwnerDashClientV2 />
  }

  const { data: profile } = await supabase.from('users').select('*').eq('auth_id', user.id).single()
  if (!profile) redirect('/login?role=owner')

  const { data: salon } = await supabase.from('salons').select('*').eq('owner_id', profile.id).single()
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('owner_id', profile.id)
    .eq('booking_date', new Date().toISOString().slice(0, 10))
    .order('booking_time')

  return <SalonDashClient profile={profile} salon={salon} todayBookings={todayBookings || []} />
}
