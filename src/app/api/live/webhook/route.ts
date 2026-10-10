import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const mux = new Mux()

type MuxEvent = { type: string; streamId: string | null }

function parseEvent(raw: string): MuxEvent | null {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  if (!json || typeof json !== 'object') return null
  const type = 'type' in json && typeof json.type === 'string' ? json.type : ''
  const data = 'data' in json && json.data && typeof json.data === 'object' ? json.data : null
  const streamId = data && 'id' in data && typeof data.id === 'string' ? data.id : null
  return { type, streamId }
}

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// [ANCHOR: mux-live-webhook]
export async function POST(req: NextRequest) {
  const raw = await req.text()

  const secret = process.env.MUX_WEBHOOK_SECRET
  if (secret) {
    try {
      await mux.webhooks.verifySignature(raw, req.headers, secret)
    } catch (err) {
      console.error('[live/webhook] signature verification failed', err instanceof Error ? err.message : err)
      return fail('invalid_signature', 401)
    }
  } else {
    console.warn('[live/webhook] MUX_WEBHOOK_SECRET not set — signature verification skipped')
  }

  const event = parseEvent(raw)
  if (!event) return fail('invalid_payload', 400)

  const now = new Date().toISOString()
  const patch =
    event.type === 'video.live_stream.active'
      ? { status: 'live', started_at: now }
      : event.type === 'video.live_stream.idle'
        ? { status: 'ended', ended_at: now }
        : null
  if (!patch || !event.streamId) return NextResponse.json({ ok: true })

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  // active는 예정 방송만 시작 처리, idle은 진행 중 방송만 종료 처리 (재전송·순서 뒤바뀜 대비)
  const { error } = await svc
    .from('oren_live_broadcasts')
    .update(patch)
    .eq('mux_live_stream_id', event.streamId)
    .eq('status', patch.status === 'live' ? 'upcoming' : 'live')
  if (error) {
    console.error('[live/webhook] update error', error.message)
    return fail(error.message, 500)
  }

  return NextResponse.json({ ok: true })
}
