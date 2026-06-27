'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
}
interface StaffRow {
  id: string
  name: string
  role: string
  pin: string | null
  is_active: boolean
  created_at: string
}
interface Props {
  brandId: string | null
}
const ROLE_MAP: Record<string, { label: string; color: string }> = {
  owner:     { label: '대표', color: '#C9A96E' },
  manager:   { label: '관리자', color: PURPLE },
  logistics: { label: '물류팀', color: 'rgba(41,182,246,0.8)' },
}
const PERMISSIONS: Record<string, { allowed: string[]; denied: string[] }> = {
  owner: {
    allowed: ['전체 권한', '마감 확정', '폐기 승인', '직원 관리'],
    denied: [],
  },
  manager: {
    allowed: ['재고 조회', '입출고 처리', '반품 승인', '발주 승인'],
    denied: ['직원 관리', '마감 확정'],
  },
  logistics: {
    allowed: ['스캔 입출고', '반품 수령', '재고 현황 조회'],
    denied: ['재고 직접 수정', '발주 승인', '폐기 단독 확정', '마감 확정', '이력 수정·삭제'],
  },
}
export default function BrandInventoryStaff({ brandId }: Props) {
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'manager' | 'logistics'>('logistics')
  const [newPin, setNewPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editPin, setEditPin] = useState('')
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const loadStaff = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_staff')
      .select('id, name, role, pin, is_active, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    setStaff((data || []) as StaffRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadStaff() }, [loadStaff])
  const addStaff = async () => {
    if (!newName.trim()) { showToast('이름을 입력해주세요'); return }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('PIN은 숫자 4자리여야 해요')
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
      setNewName(''); setNewPin(''); setNewRole('logistics')
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
  const savePin = async (id: string, name: string) => {
    if (editPin.length !== 4 || !/^\d{4}$/.test(editPin)) {
      showToast('PIN은 숫자 4자리여야 해요')
      return
    }
    const { error } = await supabase
      .from('brand_staff')
      .update({ pin: editPin })
      .eq('id', id)
    if (!error) {
      setStaff(prev => prev.map(st => st.id === id ? { ...st, pin: editPin } : st))
      setEditId(null)
      setEditPin('')
      showToast(`${name} PIN 변경 완료`)
    }
  }
  if (loading) return (
    <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>
      불러오는 중...
    </div>
  )
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: SUB }}>물류팀 직원 ({staff.length}명)</span>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer' }}
          >
            + 직원 추가
          </button>
        </div>
        {showForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>이름</div>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="홍길동"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 5 }}>역할</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['manager', 'logistics'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    style={{ flex: 1, padding: '6px', borderRadius: 6, border: `0.5px solid ${newRole === r ? ROLE_MAP[r].color : 'rgba(255,255,255,0.1)'}`, background: newRole === r ? `${ROLE_MAP[r].color}18` : 'transparent', color: newRole === r ? ROLE_MAP[r].color : SUB, fontSize: 12, cursor: 'pointer' }}
                  >
                    {ROLE_MAP[r].label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>PIN (숫자 4자리)</div>
              <input
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: TEXT, outline: 'none', letterSpacing: 4, textAlign: 'center' as const }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={addStaff}
                disabled={saving}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}
              >
                {saving ? '등록 중...' : '등록하기'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewName(''); setNewPin('') }}
                style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}
              >
                취소
              </button>
            </div>
          </div>
        )}
        {staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>
            등록된 직원이 없어요
          </div>
        ) : staff.map((s, i) => {
          const role = ROLE_MAP[s.role] || { label: s.role, color: SUB }
          return (
            <div key={s.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < staff.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${role.color}22`, border: `1px solid ${role.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500, color: role.color, flexShrink: 0 }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, color: TEXT }}>{s.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${role.color}18`, color: role.color }}>{role.label}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: s.is_active ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.05)', color: s.is_active ? '#4CAF50' : SUB }}>
                      {s.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: SUB }}>
                    PIN: {editId === s.id ? '****' : s.pin ? '****' : '미설정'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => { setEditId(editId === s.id ? null : s.id); setEditPin('') }}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, cursor: 'pointer' }}
                  >
                    PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(s)}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: `0.5px solid ${s.is_active ? 'rgba(229,57,53,0.3)' : 'rgba(76,175,80,0.3)'}`, background: 'transparent', color: s.is_active ? 'rgba(229,57,53,0.7)' : '#4CAF50', cursor: 'pointer' }}
                  >
                    {s.is_active ? '비활성' : '활성화'}
                  </button>
                </div>
              </div>
              {editId === s.id && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={editPin}
                    onChange={e => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="새 PIN 4자리"
                    maxLength={4}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: TEXT, outline: 'none', letterSpacing: 4, textAlign: 'center' as const }}
                  />
                  <button
                    type="button"
                    onClick={() => void savePin(s.id, s.name)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditId(null); setEditPin('') }}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 11, cursor: 'pointer' }}
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>역할별 권한</div>
        {(['owner', 'manager', 'logistics'] as const).map(role => {
          const r = ROLE_MAP[role]
          const p = PERMISSIONS[role]
          return (
            <div key={role} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: r.color, marginBottom: 6 }}>{r.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 4 }}>
                {p.allowed.map(a => (
                  <span key={a} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>✅ {a}</span>
                ))}
              </div>
              {p.denied.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                  {p.denied.map(d => (
                    <span key={d} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.7)' }}>❌ {d}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ padding: '10px 12px', background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 8, fontSize: 11, color: 'rgba(201,169,110,0.7)', lineHeight: 1.7 }}>
        🔒 PIN은 현장 빠른 전환용 · 실제 로그인은 브랜드 계정으로만 가능<br/>
        비활성 직원은 처리 이력에서 검색 가능하나 신규 처리 불가
      </div>
    </div>
  )
}
