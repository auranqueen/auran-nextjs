'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcHormoneBriefing, canShowCyclePhase } from '@/lib/hormoneUtils'

const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'

type SalonDecor = {
  id?: string
  name?: string | null
  description?: string | null
  owner_id?: string | null
  phase_greetings?: Record<string, string> | null
  phase_reco_enabled?: boolean | null
  main_cta?: string | null
}

type Props = {
  salon: SalonDecor
  customerTrack: string | null
  customerGender: string | null
}

const PHASE_ORDER = ['달빛기', '황금기', '만개기', '물들기'] as const

export default function StoreHeroGreeting({ salon, customerTrack, customerGender }: Props) {
  const router = useRouter()
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null)

  const showPhase = canShowCyclePhase(customerTrack, customerGender)
  const recoOn = salon.phase_reco_enabled !== false
  const mainCta = salon.main_cta === 'chat' || salon.main_cta === 'product' ? salon.main_cta : 'booking'

  useEffect(() => {
    if (!showPhase) {
      setPhaseLabel(null)
      return
    }
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user || cancelled) return
      const { data: urow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!urow?.id || cancelled) return
      const { data: hcRows } = await sb
        .from('hormone_cycle')
        .select('*')
        .eq('user_id', urow.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const hc = ((hcRows as unknown[]) || [])[0]
      if (!hc || cancelled) return
      const calc = calcHormoneBriefing(hc)
      setPhaseLabel(calc?.phase && PHASE_ORDER.includes(calc.phase as (typeof PHASE_ORDER)[number]) ? calc.phase : null)
    }
    void run()
    return () => { cancelled = true }
  }, [showPhase])

  const greeting = useMemo(() => {
    if (!showPhase || !recoOn || !phaseLabel) return null
    const pg = salon.phase_greetings
    if (pg && typeof pg === 'object' && pg[phaseLabel]) return String(pg[phaseLabel])
    return null
  }, [showPhase, recoOn, phaseLabel, salon.phase_greetings])

  const goChat = () => {
    if (!salon.id) return
    router.push(`/dashboard/customer/salon-chat/new?salon_id=${salon.id}&owner_id=${salon.owner_id || ''}`)
  }

  if (showPhase && greeting) {
    return (
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ background: PURPLE_LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 4 }}>{phaseLabel} 맞춤 인사</div>
          <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, marginBottom: 10 }}>{greeting}</div>
          {mainCta === 'chat' ? (
            <button type="button" onClick={goChat} style={{ width: '100%', padding: '10px 0', borderRadius: 9, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>💬 상담하기</button>
          ) : mainCta === 'product' ? (
            <div style={{ fontSize: 11, color: TEXT_SUB }}>시술 메뉴 탭에서 추천 제품을 확인해 보세요</div>
          ) : (
            <div style={{ fontSize: 11, color: TEXT_SUB }}>하단 예약하기 버튼으로 바로 예약할 수 있어요</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.6, marginBottom: 10 }}>{salon.description || `${salon.name || '살롱'}을 방문해 보세요`}</div>
        <button type="button" onClick={() => router.push('/my/hormone')} style={{ width: '100%', padding: '9px 0', borderRadius: 9, border: `1px solid ${PURPLE}`, background: 'transparent', color: PURPLE, fontSize: 12, cursor: 'pointer' }}>
          내 페이즈 확인하기
        </button>
      </div>
    </div>
  )
}
