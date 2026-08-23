'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const TEXT_DIM = 'rgba(255,255,255,0.35)'
const SELECT = 'id, name, area, address, avg_rating, review_count, banner_urls_pc, banner_urls_mobile, banner_urls, banner_url, lat, lng, status'
const SELECT_NO_GEO = 'id, name, area, address, avg_rating, review_count, banner_urls_pc, banner_urls_mobile, banner_urls, banner_url, status'

type SortKey = 'popular' | 'reviews' | 'distance'

type SalonRow = {
  id: string
  name?: string | null
  area?: string | null
  address?: string | null
  avg_rating?: number | null
  review_count?: number | null
  banner_urls_pc?: unknown
  banner_urls_mobile?: unknown
  banner_urls?: unknown
  banner_url?: string | null
  lat?: number | null
  lng?: number | null
  status?: string | null
}

function firstUrl(v: unknown): string {
  if (Array.isArray(v) && v[0]) return String(v[0])
  return ''
}

function salonCover(s: SalonRow): string {
  return firstUrl(s.banner_urls_pc) || firstUrl(s.banner_urls) || (s.banner_url ? String(s.banner_url) : '')
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function SalonsBrowsePage() {
  const router = useRouter()
  const [rows, setRows] = useState<SalonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('popular')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [geoAsking, setGeoAsking] = useState(false)
  const [toast, setToast] = useState('')

  const hasUserGeo = userLat != null && userLng != null

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const withGeo = await sb.from('salons').select(SELECT).eq('status', 'active')
      let list: SalonRow[] = []
      if (!withGeo.error && withGeo.data) {
        list = withGeo.data as SalonRow[]
      } else {
        const fallback = await sb.from('salons').select(SELECT_NO_GEO).eq('status', 'active')
        list = (fallback.data || []) as SalonRow[]
      }
      if (!cancelled) {
        setRows(list)
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const distanceOf = useCallback(
    (s: SalonRow): number | null => {
      if (!hasUserGeo) return null
      const lat = Number(s.lat)
      const lng = Number(s.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return haversineKm(userLat as number, userLng as number, lat, lng)
    },
    [hasUserGeo, userLat, userLng],
  )

  const askLocation = (thenSort: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setToast('위치 권한이 필요해요')
      return
    }
    setGeoAsking(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        setGeoAsking(false)
        if (thenSort) setSort('distance')
      },
      () => {
        setGeoAsking(false)
        setToast('위치 권한이 필요해요')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  const onSortChip = (key: SortKey) => {
    if (key !== 'distance') {
      setSort(key)
      return
    }
    if (hasUserGeo) {
      setSort('distance')
      return
    }
    askLocation(true)
  }

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sort === 'reviews') {
      list.sort((a, b) => num(b.review_count) - num(a.review_count) || num(b.avg_rating) - num(a.avg_rating))
    } else if (sort === 'distance' && hasUserGeo) {
      list.sort((a, b) => {
        const da = distanceOf(a)
        const db = distanceOf(b)
        if (da == null && db == null) return num(b.avg_rating) - num(a.avg_rating)
        if (da == null) return 1
        if (db == null) return -1
        return da - db
      })
    } else {
      list.sort((a, b) => num(b.avg_rating) - num(a.avg_rating) || num(b.review_count) - num(a.review_count))
    }
    return list
  }, [rows, sort, hasUserGeo, distanceOf])

  const weeklyPopular = useMemo(() => {
    return [...rows]
      .sort((a, b) => num(b.avg_rating) - num(a.avg_rating) || num(b.review_count) - num(a.review_count))
      .slice(0, 8)
  }, [rows])

  const chipStyle = (on: boolean, disabled?: boolean): CSSProperties => ({
    fontSize: 12,
    padding: '7px 14px',
    borderRadius: 20,
    border: `1px solid ${on ? PURPLE : BORDER}`,
    background: on ? 'rgba(123,94,167,0.25)' : 'transparent',
    color: disabled ? TEXT_DIM : on ? TEXT : TEXT_SUB,
    cursor: disabled && !geoAsking ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  })

  const goSalon = (id: string) => router.push(`/salons/${id}`)

  const metaLine = (s: SalonRow) => {
    const km = distanceOf(s)
    const area = s.area ? String(s.area) : ''
    if (km != null) return area ? `${area} · ${formatKm(km)}` : formatKm(km)
    return area
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: 48 }}>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '8px 16px',
            borderRadius: 20,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 16px 0' }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            color: TEXT,
            fontSize: 15,
            padding: '8px 0 16px',
            cursor: 'pointer',
          }}
        >
          ← 스토어 둘러보기
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: TEXT_SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: TEXT_SUB, fontSize: 13 }}>등록된 살롱이 없어요</div>
        ) : (
          <>
            {weeklyPopular.length > 0 ? (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🔥 이번주 인기</div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
                  {weeklyPopular.map((s) => {
                    const cover = salonCover(s)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => goSalon(s.id)}
                        style={{
                          flexShrink: 0,
                          width: 168,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 14,
                          background: CARD,
                          padding: 0,
                          cursor: 'pointer',
                          textAlign: 'left',
                          overflow: 'hidden',
                          color: TEXT,
                        }}
                      >
                        <div
                          style={{
                            height: 110,
                            background: cover ? `url(${cover}) center/cover no-repeat` : 'rgba(123,94,167,0.25)',
                          }}
                        />
                        <div style={{ padding: '10px 10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.name || '살롱'}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT_SUB }}>{metaLine(s) || '지역 미등록'}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onSortChip('distance')} style={chipStyle(sort === 'distance', !hasUserGeo)}>
                {geoAsking ? '위치 확인 중…' : '거리순'}
              </button>
              <button type="button" onClick={() => onSortChip('popular')} style={chipStyle(sort === 'popular')}>
                인기순
              </button>
              <button type="button" onClick={() => onSortChip('reviews')} style={chipStyle(sort === 'reviews')}>
                리뷰순
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map((s) => {
                const cover = salonCover(s)
                const rating = num(s.avg_rating)
                const reviews = num(s.review_count)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goSalon(s.id)}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      background: CARD,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 14,
                      padding: 10,
                      cursor: 'pointer',
                      color: TEXT,
                    }}
                  >
                    <div
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: cover ? `url(${cover}) center/cover no-repeat` : 'rgba(123,94,167,0.25)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{s.name || '살롱'}</div>
                      <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>{metaLine(s) || s.address || '지역 미등록'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: 'rgba(201,169,110,0.15)',
                            color: GOLD,
                          }}
                        >
                          ★ {rating > 0 ? rating.toFixed(1) : '-'}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: 'rgba(123,94,167,0.18)',
                            color: TEXT_SUB,
                          }}
                        >
                          리뷰 {reviews}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
