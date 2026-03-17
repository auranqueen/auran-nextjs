import { redirect } from 'next/navigation'

export default async function OwnerDashboard() {
  redirect('/dashboard/salon')
}
