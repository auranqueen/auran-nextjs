'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = '#EDE9F7'
const PURPLE_DARK = '#534AB7'
const BORDER = '#ede9f7'
const TEXT = '#111111'
const TEXT_SUB = '#888888'

type ServiceItem = {
  id: string
  name?: string
  price?: number
  duration_min?: number
  phase_tags?: string[]
  thumbnail_url?: string
  is_public?: boolean
}

const PHASE_LABEL: Record<string, string> = {
  gold: '✨ 황금기 추천',
  moon: '🌙 달빛기 추천',
  bloom: '🌸 만개기 추천',
  fall: '🍂 물들기 추천',
}

function phaseBadge(tags?: string[]): string {
  if (!tags?.length || tags.includes('all')) return ''
  for (const t of tags) {
    if (PHASE_LABEL[t]) return PHASE_LABEL[t]
  }
  return ''
}

function parseServices(raw: unknown): ServiceItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as ServiceItem[]
  return []
}

export default function OwnerServicesPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const [loading, setLoading] = useState(true)
  const [salonId, setSalonId] = useState<string | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = supabaseRef.current
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) {
        router.push('/login')
        return
      }
      const { data: salon } = await supabase
        .from('salons')
        .select('id, services')
        .eq('owner_id', uid)
        .maybeSingle()
      if (cancelled) return
      if (!salon?.id) {
        setLoading(false)
        return
      }
      setSalonId(salon.id)
      setServices(parseServices(salon.services))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const persistServices = async (next: ServiceItem[]) => {
    if (!salonId) return false
    setSaving(true)
    const { error } = await supabaseRef.current
      .from('salons')
      .update({ services: next })
      .eq('id', salonId)
    setSaving(false)
    if (error) {
      alert('저장에 실패했어요')
      return false
    }
    setServices(next)
    return true
  }

  const moveService = async (idx: number, dir: -1 | 1) => {
    const next = [...services]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    await persistServices(next)
  }

  const deleteService = async (id: string) => {
    if (!confirm('정말 삭제할까요?')) return
    await persistServices(services.filter((s) => s.id !== id))
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 14 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `0.5px solid ${BORDER}` }}>
        <button type="button" onClick={() => router.push('/dashboard/owner?v=2')} style={{ border: 'none', background: 'transparent', fontSize: 14, color: PURPLE_DARK, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>관리 프로그램 관리</div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/services/edit')}
          style={{ border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}
        >
          + 등록하기
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {!salonId ? (
          <div style={{ fontSize: 14, color: TEXT_SUB, textAlign: 'center', marginTop: 40 }}>샵 정보를 먼저 등록해주세요</div>
        ) : services.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: TEXT }}>
              아직 등록된 관리 프로그램이 없어요 💜
              <br />
              첫 프로그램을 등록해보세요
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/owner/services/edit')}
              style={{ marginTop: 20, border: 'none', background: PURPLE, color: '#fff', borderRadius: 10, padding: '12px 24px', fontSize: 14, cursor: 'pointer' }}
            >
              등록하기
            </button>
          </div>
        ) : (
          services.map((svc, idx) => {
            const badge = phaseBadge(svc.phase_tags)
            return (
              <div
                key={svc.id}
                style={{
                  background: BG,
                  border: `0.5px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: 15,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      background: PURPLE_LIGHT,
                      flexShrink: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}
                  >
                    {svc.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={svc.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '💜'
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{svc.name || '이름 없음'}</div>
                    <div style={{ fontSize: 13, color: TEXT_SUB, marginTop: 4 }}>
                      ₩{Number(svc.price || 0).toLocaleString()} · {svc.duration_min || 0}분
                    </div>
                    {badge ? <div style={{ fontSize: 12, color: PURPLE_DARK, marginTop: 4 }}>{badge}</div> : null}
                    <div style={{ fontSize: 12, color: svc.is_public !== false ? PURPLE : TEXT_SUB, marginTop: 6 }}>
                      {svc.is_public !== false ? '공개중' : '비공개'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/owner/services/edit?id=' + svc.id)}
                    style={{ flex: 1, minWidth: 60, border: `1px solid ${PURPLE}`, background: PURPLE_LIGHT, color: PURPLE_DARK, borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteService(svc.id)}
                    disabled={saving}
                    style={{ flex: 1, minWidth: 60, border: `1px solid #ddd`, background: '#fff', color: TEXT_SUB, borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => moveService(idx, -1)}
                    disabled={idx === 0 || saving}
                    style={{ width: 36, border: `1px solid ${BORDER}`, background: '#fff', borderRadius: 8, cursor: 'pointer' }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveService(idx, 1)}
                    disabled={idx === services.length - 1 || saving}
                    style={{ width: 36, border: `1px solid ${BORDER}`, background: '#fff', borderRadius: 8, cursor: 'pointer' }}
                  >
                    ↓
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
