import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ names: {} }, { status: 401 })

    const appRole = user.app_metadata?.role || ''
    const isAdminApp = appRole === 'admin' || appRole === 'super_admin'
    if (!isAdminApp) {
      const svcCheck = tryCreateServiceClient()
      if (svcCheck) {
        const { data: uRow } = await svcCheck.from('users').select('role').eq('auth_id', user.id).maybeSingle()
        if (!uRow || !['owner', 'admin'].includes(uRow.role)) {
          return NextResponse.json({ names: {} }, { status: 403 })
        }
      }
    }

    const { userIds } = await request.json()
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ names: {} })
    }

    const svc = tryCreateServiceClient()
    if (!svc) return NextResponse.json({ names: {} })

    const { data: uData } = await svc
      .from('users')
      .select('id, name, email, auth_id')
      .in('id', userIds.slice(0, 100))

    const authIds = (uData ?? []).map((u: any) => u.auth_id).filter(Boolean)
    const { data: pData } = authIds.length > 0
      ? await svc.from('profiles').select('auth_id, full_name, username').in('auth_id', authIds)
      : { data: [] }

    const profileMap: Record<string, any> = {}
    for (const p of pData ?? []) profileMap[p.auth_id] = p

    const names: Record<string, string> = {}
    for (const u of uData ?? []) {
      const profile = profileMap[u.auth_id || '']
      names[u.id] = profile?.full_name || profile?.username || u.name || u.email?.split('@')[0] || '고객'
    }

    return NextResponse.json({ names })
  } catch {
    return NextResponse.json({ names: {} })
  }
}
