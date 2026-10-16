'use client'

import { useEffect, useRef } from 'react'
import type Hls from 'hls.js'

type Props = {
  hlsUrl: string
  muted: boolean
  onMutedChange: (muted: boolean) => void
}

export default function LiveWatchPlayer({ hlsUrl, muted, onMutedChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onMutedChangeRef = useRef(onMutedChange)
  onMutedChangeRef.current = onMutedChange

  useEffect(() => {
    let hls: Hls | null = null
    const video = videoRef.current
    if (!video) return

    const tryPlay = async () => {
      video.muted = false
      try {
        await video.play()
        onMutedChangeRef.current(false)
        return
      } catch {
        /* fall through */
      }
      video.muted = true
      onMutedChangeRef.current(true)
      try {
        await video.play()
      } catch {
        /* autoplay blocked even muted */
      }
    }

    const setup = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl
        await tryPlay()
        return
      }
      try {
        const { default: HlsLib } = await import('hls.js')
        if (HlsLib.isSupported()) {
          const instance = new HlsLib({ lowLatencyMode: true })
          hls = instance
          instance.loadSource(hlsUrl)
          instance.attachMedia(video)
          instance.on(HlsLib.Events.MANIFEST_PARSED, () => { void tryPlay() })
        }
      } catch {
        video.src = hlsUrl
        await tryPlay()
      }
    }
    void setup()
    return () => { hls?.destroy() }
  }, [hlsUrl])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = muted
  }, [muted])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        playsInline
        muted={muted}
      />
    </div>
  )
}