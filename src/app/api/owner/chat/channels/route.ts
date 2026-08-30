import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { getOwnerCompanyIds } from '@/lib/brand/getOwnerCompanyIds'
import { getOrCreateChatChannel } from '@/lib/brand/getOrCreateChatChannel'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  const companyIds = await getOwnerCompanyIds(supabase, user.id)
  if (companyIds.length === 0) {
    return NextResponse.json({ ok: true, channels: [] })
  }

  const db = tryCreateServiceClient() ?? supabase

  const channelIds: string[] = []
  for (const cid of companyIds) {
    try {
      const id = await getOrCreateChatChannel(db, cid, me.id)
      channelIds.push(id)
    } catch {
      /* skip failed company */
    }
  }

  if (channelIds.length === 0) {
    return NextResponse.json({ ok: true, channels: [] })
  }

  const { data: channels, error } = await db
    .from('brand_chat_channels')
    .select('id, company_id, owner_id, last_message, last_message_at, unread_by_brand, unread_by_owner')
    .in('id', channelIds)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const cids = (channels || []).map((c: { company_id: string }) => c.company_id)
  const { data: companies } = cids.length
    ? await db.from('brand_companies').select('id, name').in('id', cids)
    : { data: [] as any[] }
  const { data: brands } = cids.length
    ? await db.from('brands').select('company_id, name, logo_url').in('company_id', cids)
    : { data: [] as any[] }

  const companyName: Record<string, string> = {}
  for (const c of companies || []) companyName[c.id] = c.name || ''
  const logoByCompany: Record<string, string | null> = {}
  const brandNameByCompany: Record<string, string> = {}
  for (const b of brands || []) {
    if (!logoByCompany[b.company_id] && b.logo_url) logoByCompany[b.company_id] = b.logo_url
    if (!brandNameByCompany[b.company_id] && b.name) brandNameByCompany[b.company_id] = b.name
  }

  const enriched = (channels || []).map((ch: any) => ({
    id: ch.id,
    company_id: ch.company_id,
    owner_id: ch.owner_id,
    last_message: ch.last_message,
    last_message_at: ch.last_message_at,
    unread_by_brand: Number(ch.unread_by_brand || 0),
    unread_by_owner: Number(ch.unread_by_owner || 0),
    company_name: companyName[ch.company_id] || brandNameByCompany[ch.company_id] || '브랜드사',
    logo_url: logoByCompany[ch.company_id] || null,
  }))

  return NextResponse.json({ ok: true, channels: enriched })
}
