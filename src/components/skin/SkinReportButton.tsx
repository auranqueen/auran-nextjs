'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeComposite, computeSkinAge } from '@/lib/skinAge'

const G = '#C9A96E'

function skinAgeOf(r: any): number | null {
  if (!r) return null
  if (r.skin_age != null) return r.skin_age
  const comp = r.skin_score != null ? r.skin_score : computeComposite({
    moisture: r.moisture_score, oil: r.oil_score, sensitivity: r.sensitivity_score,
    elasticity: r.elasticity_score, pigmentation: r.pigmentation_score, pore: r.pore_score,
  } as any)
  return computeSkinAge(comp, r.age_at_analysis)
}

export default function SkinReportButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [row, setRow] = useState<any>(null)
  const [name, setName] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setReady(true); return }
      const { data: prof } = await sb.from('profiles').select('full_name, username').eq('auth_id', user.id).maybeSingle()
      setName(((((prof as any)?.full_name || (prof as any)?.username || '') as string).trim()) || null)
      const { data } = await sb.from('skin_analyses')
        .select('skin_age, skin_score, moisture_score, oil_score, sensitivity_score, elasticity_score, pigmentation_score, pore_score, age_at_analysis')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      setRow((data && data[0]) || null)
      setReady(true)
    }
    load()
  }, [])

  if (!ready) return null
  const age = skinAgeOf(row)
  if (age == null) return null

  const realAge = row?.age_at_analysis
  const delta = (realAge != null) ? realAge - age : null
  const careMsg = name == null ? null
    : (delta != null && delta > 0) ? (name + '님, 요즘 피부가 좋아지고 있어요.')
    : (delta != null && delta < 0) ? (name + '님, 요즘 조금 지쳤나 봐요. 같이 챙겨요.')
    : (name + '님, 꾸준히 기록해볼까요.')

  return (
    <>
      <div style={{ margin: '12px 16px 0' }}>
        <div onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2D2740', border: '0.5px solid rgba(201,169,110,0.4)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>내 피부나이 리포트 보기</span>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>›</span>
        </div>
      </div>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,14,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 280, background: '#221C2E', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '22px 18px 18px', position: 'relative', textAlign: 'center' }}>
            <div onClick={() => setOpen(false)} style={{ position: 'absolute', top: 12, right: 14, fontSize: 18, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', lineHeight: 1 }}>×</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{name ? (name + '님의 피부나이') : '내 피부나이'}</div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 56, color: '#fff', lineHeight: 1.1, marginTop: 2 }}>{age}<span style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)' }}>세</span></div>
            {delta != null && delta !== 0 && (
              <div style={{ display: 'inline-block', fontSize: 12, color: G, background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.4)', borderRadius: 999, padding: '4px 12px', marginTop: 8 }}>
                실제 {realAge}세 · {delta > 0 ? delta + '세 어려요' : (-delta) + '세 더 나와요'}
              </div>
            )}
            {careMsg && <div style={{ fontSize: 12, color: '#D8C4F0', marginTop: 12, lineHeight: 1.6 }}>{careMsg}</div>}
            <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)', marginTop: 16, paddingTop: 14 }}>
              <div onClick={() => router.push('/my')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>마이 리포트에서 추이 보기 ›</div>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>설문·사진 기반 추정치예요. 의료·진단이 아니에요.</div>
          </div>
        </div>
      )}
    </>
  )
}
