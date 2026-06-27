'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'
const BrandStaffPermissions = dynamic(() => import('./BrandStaffPermissions'), { ssr: false })
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const ROLE_MAP: Record<string, { label: string; color: string; pin: number }> = {
  ceo:         { label: '대표',     color: '#C9A96E',              pin: 6 },
  director:    { label: '이사',     color: '#E8A0BF',              pin: 6 },
  manager:     { label: '과장',     color: PURPLE,                 pin: 4 },
  staff:       { label: '담당자',   color: 'rgba(41,182,246,0.8)', pin: 4 },
  ops_manager: { label: '물류팀장', color: '#4CAF50',              pin: 4 },
  ops_staff:   { label: '물류직원', color: 'rgba(41,182,246,0.6)', pin: 4 },
}
const GRANT_ROLES: Record<string, string[]> = {
  ceo:         ['director', 'manager', 'staff', 'ops_manager', 'ops_staff'],
  director:    ['manager', 'staff', 'ops_manager', 'ops_staff'],
  manager:     ['staff'],
  staff:       [],
  ops_manager: ['ops_staff'],
  ops_staff:   [],
}
interface StaffRow {
  id: string
  name: string
  role: string
  pin: string | null
  is_active: boolean
  created_at: string
  permissions?: string[]
}
interface Props {
  brandId: string | null
  currentUserRole?: string
}
export default function BrandInventoryStaff({ brandId, currentUserRole = 'ceo' }: Props) {
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'director' | 'manager' | 'staff' | 'ops_manager' | 'ops_staff'>('staff')
  const [newPin, setNewPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [editPinId, setEditPinId] = useState<string | null>(null)
  const [editPin, setEditPin] = useState('')
  const [permTarget, setPermTarget] = useState<StaffRow | null>(null)
  const [myPermissions, setMyPermissions] = useState<string[]>([])
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadStaff = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const { data: staffData } = await supabase
      .from('brand_staff')
      .select('id, name, role, pin, is_active, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    const { data: permData } = await supabase
      .from('brand_staff_permissions')
      .select('staff_id, module')
      .eq('brand_id', brandId)
    const permMap: Record<string, string[]> = {}
    for (const p of (permData || []) as Array<{ staff_id: string; module: string }>) {
      if (!permMap[p.staff_id]) permMap[p.staff_id] = []
      permMap[p.staff_id].push(p.module)
    }
    const enriched = (staffData || []).map((s: StaffRow) => ({
      ...s,
      permissions: permMap[s.id] || [],
    }))
    setStaff(enriched as StaffRow[])
    if (currentUserRole !== 'ceo') {
      const me = enriched.find((s: StaffRow) => s.role === currentUserRole)
      if (me) setMyPermissions(permMap[me.id] || [])
    }
    setLoading(false)
  }, [brandId, currentUserRole])
  useEffect(() => { void loadStaff() }, [loadStaff])
  const canAddRole = GRANT_ROLES[currentUserRole] || []
  const addStaff = async () => {
    if (!newName.trim()) { showToast('이름을 입력해주세요'); return }
    const pinLen = ROLE_MAP[newRole]?.pin || 4
    if (newPin.length !== pinLen || !/^\d+$/.test(newPin)) {
      showToast(`PIN은 숫자 ${pinLen}자리여야 해요`)
      return
    }
    if (!brandId) return
    setSaving(true)
    const { error } = await supabase.from('brand_staff').insert({
      brand_id: brandId,
      name: newName.trim(),
      role: newRole,
      pin: newPin,
      is_active: true,
    })
    if (!error) {
      setNewName(''); setNewPin(''); setNewRole('staff')
      setShowForm(false)
      showToast(`${newName} 등록 완료!`)
      void loadStaff()
    } else {
      showToast('등록 실패: ' + error.message)
    }
    setSaving(false)
  }
  const toggleActive = async (s: StaffRow) => {
    const { error } = await supabase
      .from('brand_staff')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
    if (!error) {
      setStaff(prev => prev.map(st => st.id === s.id ? { ...st, is_active: !s.is_active } : st))
      showToast(`${s.name} ${!s.is_active ? '활성화' : '비활성화'} 완료`)
    }
  }
  const savePin = async (id: string, name: string, role: string) => {
    const pinLen = ROLE_MAP[role]?.pin || 4
    if (editPin.length !== pinLen || !/^\d+$/.test(editPin)) {
      showToast(`PIN은 숫자 ${pinLen}자리여야 해요`)
      return
    }
    const { error } = await supabase.from('brand_staff').update({ pin: editPin }).eq('id', id)
    if (!error) {
      setStaff(prev => prev.map(st => st.id === id ? { ...st, pin: editPin } : st))
      setEditPinId(null); setEditPin('')
      showToast(`${name} PIN 변경 완료`)
    }
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      {permTarget && (
        <BrandStaffPermissions
          brandId={brandId}
          staff={permTarget}
          granterRole={currentUserRole}
          granterPermissions={myPermissions as any}
          onClose={() => setPermTarget(null)}
          onSaved={() => { void loadStaff(); setPermTarget(null) }}
        />
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: SUB }}>직원 목록 ({staff.length}명)</span>
          {canAddRole.length > 0 && (
            <button type="button" onClick={() => setShowForm(v => !v)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer' }}>
              + 직원 추가
            </button>
          )}
        </div>
        {showForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>이름</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 5 }}>직책</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {canAddRole.map(r => (
                  <button key={r} type="button" onClick={() => { setNewRole(r as 'director' | 'manager' | 'staff' | 'ops_manager' | 'ops_staff'); setNewPin('') }}
                    style={{ flex: 1, padding: '6px', borderRadius: 6, border: `0.5px solid ${newRole === r ? ROLE_MAP[r]?.color : 'rgba(255,255,255,0.1)'}`, background: newRole === r ? `${ROLE_MAP[r]?.color}18` : 'transparent', color: newRole === r ? ROLE_MAP[r]?.color : SUB, fontSize: 12, cursor: 'pointer' }}>
                    {ROLE_MAP[r]?.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>PIN ({ROLE_MAP[newRole]?.pin || 4}자리)</div>
              <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, ROLE_MAP[newRole]?.pin || 4))}
                placeholder={newRole === 'director' ? '••••••' : '••••'} maxLength={ROLE_MAP[newRole]?.pin || 4}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: TEXT, outline: 'none', letterSpacing: 4, textAlign: 'center' as const }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => void addStaff()} disabled={saving}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                {saving ? '등록 중...' : '등록하기'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setNewName(''); setNewPin('') }}
                style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        )}
        {staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>등록된 직원이 없어요</div>
        ) : staff.map((s, i) => {
          const role = ROLE_MAP[s.role] || { label: s.role, color: SUB, pin: 4 }
          const canManage = GRANT_ROLES[currentUserRole]?.includes(s.role)
          return (
            <div key={s.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < staff.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${role.color}22`, border: `1px solid ${role.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: role.color, flexShrink: 0 }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 13, color: TEXT }}>{s.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${role.color}18`, color: role.color }}>{role.label}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: s.is_active ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.05)', color: s.is_active ? '#4CAF50' : SUB }}>
                      {s.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: SUB }}>
                    PIN {role.pin}자리 · 권한 {s.permissions?.length || 0}개
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button type="button" onClick={() => setPermTarget(s)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer' }}>
                      권한
                    </button>
                    <button type="button" onClick={() => { setEditPinId(editPinId === s.id ? null : s.id); setEditPin('') }}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, cursor: 'pointer' }}>
                      PIN
                    </button>
                    <button type="button" onClick={() => void toggleActive(s)}
                      style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: `0.5px solid ${s.is_active ? 'rgba(229,57,53,0.3)' : 'rgba(76,175,80,0.3)'}`, background: 'transparent', color: s.is_active ? DANGER : '#4CAF50', cursor: 'pointer' }}>
                      {s.is_active ? '비활성' : '활성화'}
                    </button>
                  </div>
                )}
              </div>
              {editPinId === s.id && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input value={editPin} onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, role.pin))}
                    placeholder={`새 PIN ${role.pin}자리`} maxLength={role.pin}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: TEXT, outline: 'none', letterSpacing: 4, textAlign: 'center' as const }} />
                  <button type="button" onClick={() => void savePin(s.id, s.name, s.role)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}>저장</button>
                  <button type="button" onClick={() => { setEditPinId(null); setEditPin('') }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 11, cursor: 'pointer' }}>취소</button>
                </div>
              )}
              {s.permissions && s.permissions.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                  {s.permissions.slice(0, 5).map(p => (
                    <span key={p} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7' }}>{p.replace('_', ' ')}</span>
                  ))}
                  {s.permissions.length > 5 && (
                    <span style={{ fontSize: 10, color: SUB }}>+{s.permissions.length - 5}개</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>직책별 PIN 자리수</div>
        {Object.entries(ROLE_MAP).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 12, color: val.color }}>{val.label}</span>
            <span style={{ fontSize: 11, color: SUB }}>PIN {val.pin}자리</span>
          </div>
        ))}
        <div style={{ marginTop: 10, fontSize: 11, color: SUB, lineHeight: 1.7 }}>
          🔒 대표만 이사 등록 가능<br/>
          🔒 이사까지만 과장 등록 가능<br/>
          🔒 과장까지만 담당자 등록 가능<br/>
          🔒 본인 직책 이상 권한 위임 불가
        </div>
      </div>
    </div>
  )
}
