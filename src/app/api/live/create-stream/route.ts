import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  try {
    const svc = tryCreateAdminClient()
    const db = svc ?? supabase

    const { title, description, scheduled_at } = await req.json().catch(() => ({}))

    // Mux 라이브 스트림 생성
    const stream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
    })

    const rtmpUrl = 'rtmps://global-live.mux.com:443/app'
    const rtmpKey = stream.stream_key!
    const playbackId = stream.playback_ids?.[0]?.id
    const hlsUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null

    // Supabase에 저장
    const { data, error } = await db
      .from('oren_live_broadcasts')
      .insert({
        owner_id: me.id,
        mux_live_stream_id: stream.id,
        mux_rtmp_url: rtmpUrl,
        mux_rtmp_key: rtmpKey,
        hls_url: hlsUrl,
        title,
        description,
        status: 'upcoming',
        scheduled_at: scheduled_at || null,
      })
      .select()
      .single()

    if (error) throw error

    const { mux_rtmp_key: _rtmpKey, ...broadcast } = data
    return NextResponse.json({ success: true, broadcast })
  } catch (err: any) {
    console.error('라이브 스트림 생성 오류:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
