'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PERMISSION_MODULES = [
  {
    group: '발주',
    modules: [
      { key: 'order_view',    label: '발주 목록 조회' },
      { key: 'order_approve', label: '발주 승인/반려' },
      { key: 'order_ship',    label: '운송장 입력/발송 처리' },
    ]
  },
  {
    group: '재고',
    modules: [
      { key: 'inventory_view',      label: '재고 현황 조회' },
      { key: 'inventory_edit',      label: '입출고 처리' },
      { key: 'inventory_lot',       label: '로트 관리' },
      { key: 'inventory_close',     label: '월 마감 확정' },
      { key: 'inventory_emergency', label: '비상 출고' },
    ]
  },
  {
    group: '마케팅',
    modules: [
      { key: 'marketing_create', label: '이벤트 생성/오렌톡 발송' },
      { key: 'marketing_bundle', label: '번들 패키지 구성' },
    ]
  },
  {
    group: '리포트',
    modules: [
      { key: 'report_view',     label: '대조 리포트 열람' },
      { key: 'report_staff',    label: '담당자별 통계' },
      { key: 'report_mismatch', label: '불일치 감지' },
    ]
  },
  {
    group: '반품',
    modules: [
      { key: 'returns_view',    label: '반품 목록 조회' },
      { key: 'returns_approve', label: '반품 승인/반려' },
      { key: 'returns_receive', label: '수령 처리' },
    ]
  },
  {
    group: '직원 관리',
    modules: [
      { key: 'staff_manage', label: '직원 등록/삭제' },
      { key: 'staff_grant',  label: '권한 부여' },
    ]
  },
  {
    group: '기타',
    modules: [
      { key: 'sample_manage',   label: '샘플 등록/발송' },
      { key: 'community_post',  label: '커뮤니티 공지 작성' },
    ]
  },
] as const
type ModuleKey = 'order_view' | 'order_approve' | 'order_ship' | 'inventory_view' | 'inventory_edit' | 'inventory_lot' | 'inventory_close' | 'inventory_emergency' | 'marketing_create' | 'marketing_bundle' | 'report_view' | 'report_staff' | 'report_mismatch' | 'returns_view' | 'returns_approve' | 'returns_receive' | 'staff_manage' | 'staff_grant' | 'sample_manage' | 'community_post'
interface StaffRow {
  id: string
  name: string
  role: string
}
interface Props {
  brandId: string | null
  companyId: string | null
  staff: StaffRow
  granterRole: string
  granterPermissions: ModuleKey[]
  onClose: () => void
  onSaved: () => void
}
export default function BrandStaffPermissions({ brandId, companyId, staff, granterRole, granterPermissions, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [current, setCurrent] = useState<ModuleKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const isCEO = granterRole === 'ceo'
  const availableModules: ModuleKey[] = isCEO
    ? PERMISSION_MODULES.flatMap(g => g.modules.map(m => m.key as ModuleKey))
    : granterPermissions
  const loadPermissions = useCallback(async () => {
    if (!brandId || !companyId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_staff_permissions')
      .select('module')
      .eq('staff_id', staff.id)
      .eq('company_id', companyId)
    setCurrent((data || []).map((d: { module: string }) => d.module as ModuleKey))
    setLoading(false)
  }, [brandId, companyId, staff.id])
  useEffect(() => { void loadPermissions() }, [loadPermissions])
  const toggle = (key: ModuleKey) => {
    if (!availableModules.includes(key)) return
    setCurrent(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }
  const savePermissions = async () => {
    if (!brandId || !companyId) return
    setSaving(true)
    await supabase
      .from('brand_staff_permissions')
      .delete()
      .eq('staff_id', staff.id)
      .eq('company_id', companyId)
    if (current.length > 0) {
      await supabase.from('brand_staff_permissions').insert(
        current.map(module => ({
          brand_id: brandId,
          company_id: companyId,
          staff_id: staff.id,
          module,
        }))
      )
    }
    showToast(`${staff.name} 권한 저장 완료!`)
    setTimeout(() => { onSaved(); onClose() }, 800)
    setSaving(false)
  }
  const ROLE_LABEL: Record<string, string> = {
    ceo: '대표', director: '이사', manager: '과장', staff: '담당자'
  }
  if (loading) return (
    <div onClick={e => { if ((e.target as HTMLElement).id === 'perm-overlay') onClose() }}
      id="perm-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#1a1520', borderRadius: 16, padding: 24, color: SUB, fontSize: 13 }}>불러오는 중...</div>
    </div>
  )
  return (
    <div
      onClick={e => { if ((e.target as HTMLElement).id === 'perm-overlay') onClose() }}
      id="perm-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ background: '#1a1520', borderRadius: 16, padding: 20, width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto', border: '0.5px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 2 }}>{staff.name} 권한 설정</div>
            <div style={{ fontSize: 11, color: SUB }}>{ROLE_LABEL[staff.role] || staff.role} · {isCEO ? '전체 권한 위임 가능' : `위임 가능 ${availableModules.length}개`}</div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: SUB, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        {!isCEO && granterPermissions.length === 0 && (
          <div style={{ background: 'rgba(229,57,53,0.08)', border: '0.5px solid rgba(229,57,53,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: DANGER, marginBottom: 12 }}>
            본인에게 위임된 권한이 없어요. 상위 직책에게 권한을 받아야 합니다.
          </div>
        )}
        <div style={{ background: 'rgba(123,94,167,0.08)', border: '0.5px solid rgba(123,94,167,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#c4a7e7', marginBottom: 14, lineHeight: 1.6 }}>
          💡 본인이 가진 권한만 위임 가능해요<br/>
          {isCEO ? '대표는 모든 권한을 위임할 수 있어요' : '회색 항목은 위임 불가 (본인 권한 없음)'}
        </div>
        {PERMISSION_MODULES.map(group => (
          <div key={group.group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 8, padding: '4px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              {group.group}
            </div>
            {group.modules.map(mod => {
              const canGrant = availableModules.includes(mod.key as ModuleKey)
              const isChecked = current.includes(mod.key as ModuleKey)
              return (
                <div key={mod.key}
                  onClick={() => canGrant && toggle(mod.key as ModuleKey)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, marginBottom: 4, cursor: canGrant ? 'pointer' : 'not-allowed', background: isChecked ? 'rgba(123,94,167,0.12)' : 'transparent', opacity: canGrant ? 1 : 0.35 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isChecked ? PURPLE : 'rgba(255,255,255,0.2)'}`, background: isChecked ? PURPLE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                    {isChecked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13, color: canGrant ? TEXT : SUB }}>{mod.label}</span>
                  {!canGrant && <span style={{ fontSize: 10, color: SUB, marginLeft: 'auto' }}>권한 없음</span>}
                </div>
              )
            })}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={() => void savePermissions()} disabled={saving}
            style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
            {saving ? '저장 중...' : '권한 저장하기'}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: '11px 16px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 13, cursor: 'pointer' }}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
