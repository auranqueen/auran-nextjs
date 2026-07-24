'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.85)'
const SUB = 'rgba(255,255,255,0.35)'
const DANGER = '#E53935'
interface StaffRow {
  id: string
  name: string
  role: string
  pin: string | null
  is_active: boolean
}
const ROLE_MAP: Record<string, { label: string; color: string; pin: number }> = {
  ceo:      { label: '대표',   color: '#C9A96E', pin: 6 },
  director: { label: '이사',   color: '#E8A0BF', pin: 6 },
  manager:  { label: '과장',   color: PURPLE,    pin: 4 },
  staff:    { label: '담당자', color: 'rgba(41,182,246,0.8)', pin: 4 },
  ops_manager: { label: '물류팀장', color: '#4CAF50',              pin: 4 },
  ops_staff:   { label: '물류직원', color: 'rgba(41,182,246,0.6)', pin: 4 },
}
interface Props {
  brandId: string | null
  brandName: string
  onAuth: (staff: { id: string; name: string; role: string; permissions: string[] }) => void
  /** brand: Brand Hub (/dashboard/brand). logi: 물류 허브 (/dashboard/logi) */
  hub?: 'brand' | 'logi'
  /** brand hub에서 ops 차단 시 이동 URL */
  logiHref?: string
}
export default function BrandPinGate({ brandId, brandName, onAuth, hub = 'brand', logiHref = '/dashboard/logi' }: Props) {
  const supabase = createClient()
  const [staffList, setStaffList] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<StaffRow | null>(null)
  const [pin, setPin] = useState('')
  const [failCount, setFailCount] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [shuffleNonce, setShuffleNonce] = useState(0)
  const [opsBlocked, setOpsBlocked] = useState(false)

  const digitSlots = useMemo(() => {
    const digits = Array.from({ length: 10 }, (_, i) => String(i)).sort(() => Math.random() - 0.5)
    return [...digits.slice(0, 9), '', digits[9], '⌫']
  }, [shuffleNonce])

  const loadStaff = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_staff')
      .select('id, name, role, pin, is_active')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('created_at')
    setStaffList((data || []) as StaffRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadStaff() }, [loadStaff])
  const selectStaff = (s: StaffRow) => {
    setSelected(s)
    setPin('')
    setError('')
    setFailCount(0)
    setLocked(false)
    setOpsBlocked(false)
    setShuffleNonce((n) => n + 1)
  }
  const handlePin = async () => {
    if (!selected || !brandId) return
    if (locked) { setError('PIN이 잠겼어요. 대표에게 문의하세요'); return }
    if (pin !== selected.pin) {
      const next = failCount + 1
      setFailCount(next)
      setPin('')
      if (next >= 3) {
        setLocked(true)
        setError('PIN 3회 오류 — 잠금 처리됨. 대표에게 문의하세요')
        await supabase.from('brand_access_logs').insert({
          brand_id: brandId,
          staff_id: selected.id,
          staff_name: selected.name,
          action_type: 'pin_fail_locked',
          module: 'auth',
          target_desc: `PIN 3회 오류 잠금 — ${selected.name} ${ROLE_MAP[selected.role]?.label}`,
        })
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: 'auto_order',
          target_type: 'all',
          title: `🔒 PIN 잠금 발생`,
          body: `${selected.name} ${ROLE_MAP[selected.role]?.label}의 PIN이 3회 오류로 잠겼습니다. 확인이 필요합니다.`,
          send_count: 1,
        })
      } else {
        setError(`PIN이 틀렸어요 (${next}/3)`)
      }
      return
    }
    // Brand Hub에서는 물류 역할(ops_*) 진입 차단 — 물류 허브로 안내
    if (hub === 'brand' && (selected.role === 'ops_manager' || selected.role === 'ops_staff')) {
      setOpsBlocked(true)
      setError('')
      setPin('')
      return
    }
    setChecking(true)
    const { data: permData } = await supabase
      .from('brand_staff_permissions')
      .select('module')
      .eq('staff_id', selected.id)
      .eq('brand_id', brandId)
    const permissions = (permData || []).map((p: { module: string }) => p.module)
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    await supabase.from('brand_pin_sessions').insert({
      brand_id: brandId,
      staff_id: selected.id,
      session_token: token,
      pin_fail_count: 0,
      is_locked: false,
      expires_at: expires,
    })
    await supabase.from('brand_access_logs').insert({
      brand_id: brandId,
      staff_id: selected.id,
      staff_name: selected.name,
      action_type: 'login',
      module: 'auth',
      target_desc: `PIN 인증 성공 — ${selected.name} ${ROLE_MAP[selected.role]?.label}`,
    })
    sessionStorage.setItem('brand_pin_token', token)
    sessionStorage.setItem('brand_staff_id', selected.id)
    sessionStorage.setItem('brand_staff_name', selected.name)
    sessionStorage.setItem('brand_staff_role', selected.role)
    onAuth({ id: selected.id, name: selected.name, role: selected.role, permissions })
    setChecking(false)
  }
  const pinLen = ROLE_MAP[selected?.role || 'staff']?.pin || 4
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 14 }}>
      불러오는 중...
    </div>
  )
  return (
    <div style={{ minHeight: '100vh', background: '#0f0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: SUB, letterSpacing: 2, marginBottom: 6 }}>AURAN BRAND HUB</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{brandName}</div>
        </div>
        {!selected ? (
          <div style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 14, color: TEXT, marginBottom: 4 }}>담당자를 선택해주세요</div>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 20 }}>본인의 이름을 선택 후 PIN을 입력해주세요</div>
            {staffList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>
                등록된 담당자가 없어요<br/>
                <span style={{ fontSize: 11 }}>Brand Hub → 물류직원 탭에서 등록해주세요</span>
              </div>
            ) : staffList.map(s => {
              const r = ROLE_MAP[s.role] || { label: s.role, color: SUB, pin: 4 }
              return (
                <button key={s.id} type="button" onClick={() => selectStaff(s)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', marginBottom: 8, textAlign: 'left' as const }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${r.color}22`, border: `1.5px solid ${r.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: r.color, flexShrink: 0 }}>
                    {s.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: TEXT, marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: r.color }}>{r.label} · PIN {r.pin}자리</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 16, color: SUB }}>→</div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
            <button type="button" onClick={() => { setSelected(null); setPin(''); setError('') }}
              style={{ background: 'none', border: 'none', color: SUB, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              ← 다시 선택
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${ROLE_MAP[selected.role]?.color || SUB}22`, border: `1.5px solid ${ROLE_MAP[selected.role]?.color || SUB}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: ROLE_MAP[selected.role]?.color || SUB, flexShrink: 0 }}>
                {selected.name[0]}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: ROLE_MAP[selected.role]?.color || SUB }}>{ROLE_MAP[selected.role]?.label}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: SUB, marginBottom: 10 }}>PIN {pinLen}자리 입력</div>
            {opsBlocked ? (
              <div style={{ background: 'rgba(33,136,255,0.08)', border: '0.5px solid rgba(33,136,255,0.35)', borderRadius: 10, padding: 16, marginBottom: 12, textAlign: 'center' as const }}>
                <div style={{ fontSize: 13, color: TEXT, marginBottom: 8, lineHeight: 1.5 }}>
                  물류직원은 /dashboard/logi로 접속해주세요
                </div>
                <a
                  href={logiHref}
                  style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 8, background: '#2188ff', color: '#fff', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
                >
                  물류 허브로 이동
                </a>
                <button type="button" onClick={() => { setOpsBlocked(false); setSelected(null); setPin('') }}
                  style={{ display: 'block', width: '100%', marginTop: 12, background: 'none', border: 'none', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                  ← 다른 담당자 선택
                </button>
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              {Array.from({ length: pinLen }).map((_, i) => (
                <div key={i} style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${pin.length > i ? PURPLE : 'rgba(255,255,255,0.15)'}`, background: pin.length > i ? `${PURPLE}20` : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pin.length > i && <div style={{ width: 10, height: 10, borderRadius: '50%', background: PURPLE }} />}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {digitSlots.map((k, i) =>
                k === '' ? (
                  <div key={`empty-${i}`} />
                ) : (
                  <button
                    key={k === '⌫' ? `back-${i}` : `${k}-${i}`}
                    type="button"
                    onClick={() => {
                      if (k === '⌫') { setPin(p => p.slice(0, -1)); setError('') }
                      else if (pin.length < pinLen) { setPin(p => p + k) }
                    }}
                    style={{ padding: '14px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: k === '⌫' ? SUB : TEXT, fontSize: k === '⌫' ? 18 : 20, cursor: 'pointer', fontWeight: 400 }}
                  >
                    {k}
                  </button>
                )
              )}
            </div>
            {error && (
              <div style={{ background: 'rgba(229,57,53,0.08)', border: '0.5px solid rgba(229,57,53,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: DANGER, marginBottom: 12, textAlign: 'center' as const }}>
                {error}
              </div>
            )}
            <button type="button" onClick={() => void handlePin()}
              disabled={pin.length < pinLen || checking || locked}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: pin.length < pinLen || locked ? 'rgba(123,94,167,0.3)' : PURPLE, color: '#fff', fontSize: 15, cursor: pin.length < pinLen || locked ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {checking ? '확인 중...' : locked ? '잠김' : '확인'}
            </button>
              </>
            )}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          모든 접근 기록이 저장됩니다 · AURAN Brand Hub
        </div>
      </div>
    </div>
  )
}
