'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcHormoneBriefing } from '@/lib/hormoneUtils'

const BG = '#0D0B09'
const CARD = '#181520'
const BORDER = 'rgba(255,255,255,0.07)'
const P = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MAIN = 'rgba(255,255,255,0.9)'
const TEXT_SUB = 'rgba(255,255,255,0.45)'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

const PHASE_TIPS: Record<string, string> = {
  '달빛기': '휴식과 진정 케어가 좋아요',
  '황금기': '흡수율이 가장 좋은 시기예요. 리프팅·앰플 케어가 효과를 극대화해요',
  '만개기': '활력 케어와 리프팅을 추천해요',
  '물들기': '수분·진정 케어로 균형을 잡아주세요',
  '갱년기': '탄력·재생 케어가 좋아요',
  '폐경기': '탄력·재생 케어가 좋아요',
  '불규칙기': '탄력·재생 케어가 좋아요',
  '남성 갱년기': '탄력·재생 케어가 좋아요',
  '남성': '딥클렌징·진정 케어를 추천해요',
}

type SalonService = {
  name?: string
  price?: number
  duration_min?: number
  is_signature?: boolean
  phase_tags?: string[]
}

type SalonRow = {
  id: string
  owner_id?: string | null
  name?: string | null
  description?: string | null
  area?: string | null
  address?: string | null
  phone?: string | null
  banner_url?: string | null
  avatar_url?: string | null
  services?: SalonService[] | null
  open_hours?: Record<string, string> | null
  status?: string | null
  review_count?: number | null
  avg_rating?: number | null
}

type OwnerRow = {
  name?: string | null
  avatar_url?: string | null
}

function fmtPrice(n: number | undefined | null) {
  return `${Number(n || 0).toLocaleString('ko-KR')}원`
}

function parseServices(raw: unknown): SalonService[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as SalonService[]
  return []
}

function phaseTip(phase: string) {
  if (PHASE_TIPS[phase]) return PHASE_TIPS[phase]
  if (phase.includes('갱년') || phase.includes('폐경') || phase.includes('불규칙')) return PHASE_TIPS['갱년기']
  return PHASE_TIPS['황금기']
}

function todayHours(openHours: Record<string, string> | null | undefined): string | null {
  if (!openHours || typeof openHours !== 'object') return null
  const d = new Date()
  const key = DAY_KEYS[d.getDay()]
  const ko = DAY_KO[d.getDay()]
  const val =
    openHours[key] ||
    openHours[ko] ||
    openHours.default ||
    openHours.all ||
    (openHours.open && openHours.close ? `${openHours.open}~${openHours.close}` : '')
  if (!val) return null
  return String(val).replace('-', '~')
}

function ownerMeta(reviewCount: number | null | undefined) {
  const base = Math.max(12400, (reviewCount || 124) * 100)
  return `시술 ${base.toLocaleString('ko-KR')}+`
}

export default function SalonDetailPage() {
  const router = useRouter()
  const params = useParams()
  const salonId = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [salon, setSalon] = useState<SalonRow | null>(null)
  const [owner, setOwner] = useState<OwnerRow | null>(null)
  const [userName, setUserName] = useState('')
  const [hormonePhase, setHormonePhase] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<SalonService | null>(null)

  useEffect(() => {
    if (salon?.id) {
      router.replace('/salons/' + salon.id)
    } else if (!loading && !salon?.id) {
      router.replace('/')
    }
  }, [salon?.id, loading, router])

  useEffect(() => {
    if (!salonId) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setNotFound(false)
      const sb = createClient()

      const { data: salonData, error } = await sb
        .from('salons')
        .select('id,owner_id,name,description,area,address,phone,banner_url,avatar_url,services,open_hours,status,review_count,avg_rating')
        .eq('id', salonId)
        .single()

      if (cancelled) return
      if (error || !salonData) {
        setSalon(null)
        setNotFound(true)
        setLoading(false)
        return
      }

      setSalon(salonData as SalonRow)

      if (salonData.owner_id) {
        const { data: ownerData } = await sb
          .from('users')
          .select('name, avatar_url')
          .eq('id', salonData.owner_id)
          .maybeSingle()
        if (!cancelled && ownerData) setOwner(ownerData as OwnerRow)
      } else {
        setOwner(null)
      }

      const { data: { user } } = await sb.auth.getUser()
      if (user && !cancelled) {
        const { data: urow } = await sb
          .from('users')
          .select('id, name')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (urow?.name) setUserName(String(urow.name))

        const { data: hc } = await sb
          .from('hormone_cycle')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (hc) {
          const briefing = calcHormoneBriefing(hc)
          if (briefing?.phase) setHormonePhase(briefing.phase)
        } else {
          setHormonePhase(null)
        }
      } else if (!cancelled) {
        setUserName('')
        setHormonePhase(null)
      }

      if (!cancelled) setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [salonId])

  const services = useMemo(() => parseServices(salon?.services), [salon?.services])
  const todayOpen = useMemo(() => todayHours(salon?.open_hours ?? null), [salon?.open_hours])
  const rating = Number(salon?.avg_rating) || 0
  const reviews = salon?.review_count ?? 0

  if (notFound && !loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <p style={{ fontSize: 14, color: TEXT_SUB, margin: 0 }}>살롱을 찾을 수 없어요</p>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 20px', color: TEXT_MAIN, fontSize: 13, cursor: 'pointer' }}
        >
          뒤로가기
        </button>
      </div>
    )
  }

  const heroBg = salon?.banner_url
    ? { backgroundImage: `url(${salon.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(180deg,#1a1228,#2a1d3d)' }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT_MAIN, opacity: loading ? 0.4 : 1, paddingBottom: 32 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', fontSize: 13, color: TEXT_SUB }}>불러오는 중...</div>
      ) : null}

      <div style={{ display: loading ? 'none' : 'block' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', color: TEXT_MAIN, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 15, color: TEXT_MAIN }}>살롱 상세</span>
          <span style={{ width: 22 }} />
        </header>

        <div style={{ position: 'relative', height: 160, ...heroBg }}>
          {salon?.area ? (
            <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, color: TEXT_MAIN, background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: '3px 8px' }}>
              {salon.area}
            </span>
          ) : null}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(transparent,rgba(13,11,9,0.92))' }}>
            <div style={{ fontSize: 17, color: TEXT_MAIN, marginBottom: 4 }}>{salon?.name || '살롱'}</div>
            {salon?.description ? (
              <div style={{ fontSize: 11, color: TEXT_SUB, lineHeight: 1.5 }}>{salon.description}</div>
            ) : null}
          </div>
        </div>

        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {owner ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {owner.avatar_url ? (
                <img src={owner.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: P, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', flexShrink: 0 }}>
                  {(owner.name || '원').charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: TEXT_MAIN, marginBottom: 3 }}>{owner.name || '원장님'}</div>
                <div style={{ fontSize: 10, color: TEXT_SUB }}>{ownerMeta(reviews)}</div>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/customer/chat?salon=${salonId}`)}
                style={{ background: 'rgba(123,94,167,0.2)', border: `1px solid rgba(123,94,167,0.35)`, borderRadius: 10, padding: '7px 12px', color: P, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
              >
                상담
              </button>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: '평점', value: rating.toFixed(1) },
              { label: '리뷰', value: `${reviews}개` },
              { label: '시술 완료', value: '0' },
            ].map(item => (
              <div key={item.label} style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: GOLD, marginBottom: 4 }}>{item.value}</div>
                <div style={{ fontSize: 9, color: TEXT_SUB }}>{item.label}</div>
              </div>
            ))}
          </div>

          {hormonePhase ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: 12, color: TEXT_MAIN, marginBottom: 10 }}>
                {userName ? `${userName}님 ` : ''}호르몬 페이즈 추천
              </div>
              <span style={{ display: 'inline-block', fontSize: 10, color: P, background: 'rgba(123,94,167,0.2)', borderRadius: 6, padding: '3px 8px', marginBottom: 8 }}>
                {hormonePhase}
              </span>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_SUB, lineHeight: 1.6 }}>{phaseTip(hormonePhase)}</p>
            </div>
          ) : null}

          <div>
            <div style={{ fontSize: 12, color: TEXT_MAIN, marginBottom: 10 }}>시술 메뉴</div>
            {services.length === 0 ? (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', fontSize: 12, color: TEXT_SUB }}>
                준비 중인 메뉴예요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {services.map((svc, idx) => {
                  const selected = selectedService === svc
                  const phaseTag = Array.isArray(svc.phase_tags) ? svc.phase_tags[0] : null
                  return (
                    <button
                      key={`${svc.name}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedService(svc)
                        console.log('selected service', svc)
                      }}
                      style={{
                        background: selected ? 'rgba(123,94,167,0.12)' : CARD,
                        border: selected ? `1px solid rgba(123,94,167,0.45)` : `1px solid ${BORDER}`,
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {svc.is_signature ? (
                          <span style={{ display: 'inline-block', fontSize: 8, letterSpacing: '0.5px', color: GOLD, marginBottom: 4 }}>SIGNATURE</span>
                        ) : null}
                        <div style={{ fontSize: 13, color: TEXT_MAIN, marginBottom: 3 }}>{svc.name || '시술'}</div>
                        <div style={{ fontSize: 10, color: TEXT_SUB }}>
                          {svc.duration_min ? `${svc.duration_min}분` : ''}
                          {svc.duration_min && phaseTag ? ' · ' : ''}
                          {phaseTag ? `${phaseTag} 추천` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: GOLD, flexShrink: 0 }}>{fmtPrice(svc.price)}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {todayOpen ? (
            <div style={{ fontSize: 11, color: TEXT_SUB, padding: '4px 0' }}>
              오늘 영업: {todayOpen}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!selectedService}
            onClick={() => {
              if (!selectedService) return
              alert('예약 모달은 다음 작업에서 구현됩니다')
            }}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '14px 16px',
              borderRadius: 14,
              border: 'none',
              fontSize: 14,
              cursor: selectedService ? 'pointer' : 'not-allowed',
              background: selectedService ? P : 'rgba(123,94,167,0.25)',
              color: selectedService ? '#fff' : 'rgba(255,255,255,0.35)',
            }}
          >
            {selectedService ? '예약하기' : '메뉴를 먼저 선택해주세요'}
          </button>
        </div>
      </div>
    </div>
  )
}
