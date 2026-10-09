import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function POST(req: NextRequest) {
  try {
    const supabase = tryCreateAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase service role env missing' }, { status: 500 })
    }

    const { owner_id, title, description, scheduled_at } = await req.json()

    // Mux 라이브 스트림 생성
    const stream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
    })

    const rtmpUrl = 'rtmps://global-live.mux.com:443/app'
    const rtmpKey = stream.stream_key!
    const hlsUrl = `https://stream.mux.com/${stream.playback_ids?.[0]?.id}.m3u8`

    // Supabase에 저장
    const { data, error } = await supabase
      .from('oren_live_broadcasts')
      .insert({
        owner_id,
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

    return NextResponse.json({ success: true, broadcast: data })
  } catch (err: any) {
    console.error('라이브 스트림 생성 오류:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
