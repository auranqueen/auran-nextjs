import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 500

/** KST calendar date YYYY-MM-DD (cron runs ~03:00 KST). */
function todayKstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Daily cumulative snapshot of published oren_scene_posts metrics.
 * Vercel Cron or manual: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const qSecret = req.nextUrl.searchParams.get('secret') || ''
  const secret = bearer || qSecret

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CRON_SECRET) return json({ ok: false, error: 'CRON_SECRET not configured' }, 503)
    if (secret !== process.env.CRON_SECRET) return json({ ok: false, error: 'unauthorized' }, 401)
  } else if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const service = tryCreateAdminClient()
  if (!service) return json({ ok: false, error: 'service_unavailable' }, 503)

  const snapshotDate = todayKstDate()
  let offset = 0
  let upserted = 0

  for (;;) {
    const { data: posts, error } = await service
      .from('oren_scene_posts')
      .select('id, like_count, view_count, booking_conversion_count, revenue_generated')
      .eq('is_published', true)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) return json({ ok: false, error: error.message }, 500)
    if (!posts || posts.length === 0) break

    const rows = posts.map((p) => ({
      scene_post_id: p.id,
      snapshot_date: snapshotDate,
      like_count: Number(p.like_count || 0),
      view_count: Number(p.view_count || 0),
      booking_conversion_count: Number(p.booking_conversion_count || 0),
      revenue_generated: Number(p.revenue_generated || 0),
    }))

    const { error: upErr } = await service
      .from('oren_scene_daily_stats')
      .upsert(rows, { onConflict: 'scene_post_id,snapshot_date' })

    if (upErr) return json({ ok: false, error: upErr.message, upserted }, 500)

    upserted += rows.length
    if (posts.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return json({ ok: true, snapshot_date: snapshotDate, upserted })
}