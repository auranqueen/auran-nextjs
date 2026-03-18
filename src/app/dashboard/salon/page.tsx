// ── SALON (Owner)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SalonDashClient from './client'

export default async function SalonDashboard() {
  // /dashboard/salon is kept as legacy alias. The entry route is /dashboard/owner.
  redirect('/dashboard/owner')
}

