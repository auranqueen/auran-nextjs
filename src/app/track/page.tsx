'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
export default function TrackPage() {
  const searchParams = useSearchParams()
  const courier = searchParams.get('courier') || 'CJ대한통운'
  const trackingNo = searchParams.get('no') || ''
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!trackingNo) return
    setLoading(true)
    fetch(`/api/tracking?courier=${encodeURIComponent(courier)}&tracking_no=${trackingNo}`)
      .then(r => r.json())
      .then(json => {
        if (json.ok) setData(json.data)
        else setError('배송 정보를 불러오지 못했어요')
      })
      .catch(() => setError('네트워크 오류가 발생했어요'))
      .finally(() => setLoading(false))
  }, [courier, trackingNo])
  const BG = '#0D0B09'
  const CARD = '#181520'
  const PURPLE = '#7B5EA7'
  const GOLD = '#C9A96E'
  const statusLabel: Record<string, string> = {
    'at_pickup': '집화완료',
    'in_transit': '배송중',
    'out_for_delivery': '배송출발',
    'delivered': '배달완료',
    'unknown': '정보없음',
  }
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', padding: '24px 16px', fontFamily: "'Noto Sans KR', sans-serif", color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <button onClick={() => window.history.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, color: '#fff', fontWeight: 500 }}>배송 조회</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{courier} · {trackingNo || '운송장 없음'}</div>
        </div>
      </div>
      {!trackingNo && (
        <div style={{ background: CARD, borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>운송장 번호가 없어요</div>
        </div>
      )}
      {loading && (
        <div style={{ background: CARD, borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>배송 정보 불러오는 중...</div>
        </div>
      )}
      {error && (
        <div style={{ background: CARD, borderRadius: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>😢</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{error}</div>
        </div>
      )}
      {data && (
        <>
          <div style={{ background: CARD, borderRadius: 14, padding: 16, marginBottom: 12, border: `0.5px solid rgba(123,94,167,0.25)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>현재 상태</div>
              <div style={{ background: 'rgba(123,94,167,0.2)', border: `0.5px solid ${PURPLE}`, borderRadius: 20, padding: '3px 12px', fontSize: 12, color: '#c4b5d4' }}>
                {statusLabel[data.state?.id] ?? data.state?.text ?? '확인중'}
              </div>
            </div>
            {data.from?.name && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>📍 보낸 곳: {data.from.name}</div>}
            {data.to?.name && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>🏠 받는 곳: {data.to.name}</div>}
          </div>
          {data.progresses?.length > 0 && (
            <div style={{ background: CARD, borderRadius: 14, padding: 16, border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>배송 현황</div>
              {[...data.progresses].reverse().map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? GOLD : PURPLE, marginTop: 4, flexShrink: 0 }} />
                    {i < data.progresses.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.1)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ fontSize: 12, color: i === 0 ? GOLD : 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{p.status?.text ?? ''}</div>
                    {p.location?.name && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>{p.location.name}</div>}
                    {p.time && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{new Date(p.time).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
