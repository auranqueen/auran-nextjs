'use client'

import { useEffect, useRef, useState } from 'react'

/** 홈 마운트 시 출석체크 1회 호출 + 팝업 (클라이언트 in-flight 락) */
export default function CheckinTracker() {
  const checkinInFlightRef = useRef(false)
  const [showCheckinPopup, setShowCheckinPopup] = useState(false)
  const [checkinResult, setCheckinResult] = useState<{
    toast_earned: number
    streak: number
    message: string
  } | null>(null)

  useEffect(() => {
    const todayKey =
      'auran_checkin_' + new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    if (localStorage.getItem(todayKey)) return
    if (checkinInFlightRef.current) return
    checkinInFlightRef.current = true
    void (async () => {
      try {
        const res = await fetch('/api/checkin', { method: 'POST', credentials: 'same-origin' })
        const json = await res.json()
        if (json.ok) {
          localStorage.setItem(todayKey, '1')
          if (!json.already) {
            setCheckinResult({
              toast_earned: json.toast_earned || 0,
              streak: json.streak || 1,
              message: json.message || '',
            })
            setShowCheckinPopup(true)
            setTimeout(() => setShowCheckinPopup(false), 4000)
          }
        }
      } catch (_) {
      } finally {
        checkinInFlightRef.current = false
      }
    })()
  }, [])

  if (!showCheckinPopup || !checkinResult) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg, #0d0d0d)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 36px',
          pointerEvents: 'auto',
          boxShadow: '0 -4px 30px rgba(0,0,0,.4)',
          border: '0.5px solid rgba(255,255,255,.08)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            background: 'rgba(255,255,255,.15)',
            borderRadius: 2,
            margin: '0 auto 18px',
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🍞</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#F0E8FF', marginBottom: 4 }}>
            출석 완료!
          </div>
          <div style={{ fontSize: 13, color: '#9B7EC8', marginBottom: 12 }}>
            {checkinResult.streak}일 연속 출석 중이에요
          </div>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(201,169,110,.15)',
              border: '0.5px solid rgba(201,169,110,.3)',
              color: '#C9A96E',
              fontSize: 15,
              fontWeight: 500,
              padding: '6px 18px',
              borderRadius: 20,
              marginBottom: 16,
            }}
          >
            +{checkinResult.toast_earned}T 적립됐어요 💜
          </div>
          {checkinResult.streak === 6 && (
            <div style={{ fontSize: 11, color: '#C9A96E', marginBottom: 12 }}>
              내일도 오시면 7일 연속 보너스 +500T!
            </div>
          )}
          {checkinResult.streak === 29 && (
            <div style={{ fontSize: 11, color: '#C9A96E', marginBottom: 12 }}>
              내일 30일 개근 달성! +3,000T 보너스!
            </div>
          )}
          <button
            onClick={() => setShowCheckinPopup(false)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              background: '#7B5EA7',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            확인 💜
          </button>
        </div>
      </div>
    </div>
  )
}
