'use client'
import { useEffect, useRef } from 'react'
interface Props {
  staffName: string
  staffRole: string
}
export default function BrandWatermark({ staffName, staffRole }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const now = new Date().toLocaleString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
    const text = `${staffName} ${staffRole} · ${now} · AURAN CONFIDENTIAL`
    if (canvasRef.current) {
      canvasRef.current.setAttribute('data-watermark', text)
    }
  }, [staffName, staffRole])
  const now = new Date().toLocaleString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
  const text = `${staffName} ${staffRole} · ${now} · AURAN CONFIDENTIAL`
  return (
    <div
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i % 4) * 28 - 5}%`,
          top: `${Math.floor(i / 4) * 22 + 5}%`,
          transform: 'rotate(-25deg)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.045)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          fontFamily: 'monospace',
          letterSpacing: 0.5,
        }}>
          {text}
        </div>
      ))}
    </div>
  )
}
