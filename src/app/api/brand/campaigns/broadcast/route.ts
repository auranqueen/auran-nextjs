import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { assertStaffPermission } from '@/lib/brand/assertStaffPermission'
import { getOrCreateChatChannel } from '@/lib/brand/getOrCreateChatChannel'
import { resolveOwnersByGrades } from '@/lib/brand/resolveOwnersByGrades'

async function assertCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  companyId: string,
) {
  const { data: companyBrands } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
  const brandIds = (companyBrands || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) return false
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return true
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return Boolean(owned?.id)
}

function normalizeTargetGrades(raw: unknown): string[] | 'all' {
  if (raw === 'all') return 'all'
  if (Array.isArray(raw)) {
    const grades = raw.map((g) => String(g).trim()).filter(Boolean)
    return grades.length > 0 ? grades : 'all'
  }
  if (typeof raw === 'string' && raw.trim() === 'all') return 'all'
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return 'all'
}

function buildCampaignMessageBody(title: string, description: string | null): string {
  const t = title.trim()
  const d = (description || '').trim()
  if (t && d) return `${t}\n\n${d}`
  return t || d || '\uC774\uBCA4\uD2B8 \uC548\uB0B4'
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const staffId = typeof body?.staff_id === 'string' ? body.staff_id.trim() : ''
  const campaignId = typeof body?.campaign_id === 'string' ? body.campaign_id.trim() : ''
  const targetGrades = normalizeTargetGrades(body?.target_grades)

  if (!companyId || !campaignId) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const allowed = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const staffAllowed = await assertStaffPermission(supabase, staffId || null, companyId, 'marketing_create')
  if (!staffAllowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_permission' }, { status: 403 })
  }

  const db = tryCreateAdminClient() ?? supabase

  const { data: campaign, error: campaignErr } = await db
    .from('hq_forced_campaigns')
    .select('id, company_id, title, description, image_url')
    .eq('id', campaignId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (campaignErr || !campaign?.id) {
    return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 })
  }

  const owners = await resolveOwnersByGrades(db, companyId, targetGrades)
  const defaultTitle = '\uC774\uBCA4\uD2B8'
  const msgBody = buildCampaignMessageBody(
    String(campaign.title || defaultTitle),
    campaign.description != null ? String(campaign.description) : null,
  )
  const attachmentUrl = campaign.image_url ? String(campaign.image_url) : null
  const preview = msgBody || (attachmentUrl ? '[attachment]' : '')
  const now = new Date().toISOString()

  let sentCount = 0
  const failedOwners: Array<{ owner_user_id: string; error: string }> = []
  for (const owner of owners) {
    try {
      const channelId = await getOrCreateChatChannel(db, companyId, owner.owner_user_id)
      const { data: ch } = await db
        .from('brand_chat_channels')
        .select('unread_by_owner')
        .eq('id', channelId)
        .maybeSingle()

      const { error: msgErr } = await db.from('brand_chat_messages').insert({
        channel_id: channelId,
        sender_type: 'brand',
        sender_staff_id: staffId || null,
        message_type: 'campaign',
        body: msgBody,
        attachment_url: attachmentUrl,
        campaign_id: campaignId,
      } as Record<string, unknown>)

      if (msgErr) {
        failedOwners.push({ owner_user_id: owner.owner_user_id, error: msgErr.message })
        continue
      }

      await db
        .from('brand_chat_channels')
        .update({
          last_message: preview,
          last_message_at: now,
          unread_by_owner: Number(ch?.unread_by_owner || 0) + 1,
        })
        .eq('id', channelId)

      sentCount += 1
    } catch (err) {
      const errMsg = err instanceof Error ? err.message.trim() : ''
      failedOwners.push({
        owner_user_id: owner.owner_user_id,
        error: errMsg || 'channel_create_failed',
      })
    }
  }

  const { data: brandRow } = await db
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()

  if (brandRow?.id) {
    const postTitle = `[\uC774\uBCA4\uD2B8] ${String(campaign.title || defaultTitle)}`
    await db.from('brand_posts').insert({
      brand_id: brandRow.id,
      title: postTitle,
      body: msgBody,
      is_pinned: false,
      author_type: 'brand',
      campaign_id: campaignId,
      reply_count: 0,
    })
  }

  await db.from('hq_forced_campaigns').update({ broadcasted_at: now }).eq('id', campaignId)

  const response: {
    ok: true
    sent_count: number
    failed_count: number
    first_error?: string
  } = {
    ok: true,
    sent_count: sentCount,
    failed_count: failedOwners.length,
  }
  if (failedOwners[0]?.error) response.first_error = failedOwners[0].error

  return NextResponse.json(response)
}