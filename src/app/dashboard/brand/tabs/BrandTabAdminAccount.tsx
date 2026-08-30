'use client'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
const BrandInventoryStaff = dynamic(() => import('./BrandInventoryStaff'), { ssr: false })
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 } as const
const SUBTABS = [
  { key: 'company', label: '컴퍼니정보' },
  { key: 'admins', label: '관리자관리' },
  { key: 'policy', label: '판매정책 준수 현황' },
] as const
type SubTab = typeof SUBTABS[number]['key']
type Props = {
  brandId: string | null
  companyId: string | null
  currentUserRole?: string
}

function CompanyWorkHours({ companyId, canEdit }: { companyId: string | null; canEdit: boolean }) {
  const supabase = createClient()
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_companies')
      .select('work_hours_start, work_hours_end')
      .eq('id', companyId)
      .maybeSingle()
    const row = data as { work_hours_start?: string | null; work_hours_end?: string | null } | null
    if (row?.work_hours_start) setStart(String(row.work_hours_start).slice(0, 5))
    if (row?.work_hours_end) setEnd(String(row.work_hours_end).slice(0, 5))
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable per render tree
  }, [companyId])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!companyId) return
    if (!canEdit) { showToast('대표만 저장할 수 있어요'); return }
    setSaving(true)
    const { error } = await supabase
      .from('brand_companies')
      .update({ work_hours_start: start, work_hours_end: end })
      .eq('id', companyId)
    setSaving(false)
    if (error) showToast('저장 실패: ' + error.message)
    else showToast('근무시간 저장 완료')
  }

  if (!companyId) {
    return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>회사 정보를 불러오는 중...</div>
  }
  if (loading) {
    return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  }

  return (
    <div style={CARD}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
      )}
      <div style={{ fontSize: 13, color: TEXT, marginBottom: 6 }}>근무시간 설정</div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 14, lineHeight: 1.5 }}>
        설정된 시간 외 PIN 로그인 시 접속이 차단되고, 관리자 알림에 기록이 남아요.
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>시작시간</div>
          <input
            type="time"
            value={start}
            disabled={!canEdit}
            onChange={(e) => setStart(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: TEXT, outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>종료시간</div>
          <input
            type="time"
            value={end}
            disabled={!canEdit}
            onChange={(e) => setEnd(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: TEXT, outline: 'none' }}
          />
        </div>
      </div>
      {canEdit ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving ? 'wait' : 'pointer' }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      ) : (
        <div style={{ fontSize: 11, color: SUB, textAlign: 'center' }}>대표만 근무시간을 변경할 수 있어요</div>
      )}
    </div>
  )
}

export default function BrandTabAdminAccount({ brandId, companyId, currentUserRole = 'ceo' }: Props) {
  const [sub, setSub] = useState<SubTab>('company')
  const isCeo = currentUserRole === 'ceo'
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {SUBTABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: sub === t.key ? `2px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.15)',
              background: sub === t.key ? '#c4a7e7' : 'transparent',
              color: sub === t.key ? '#1a1520' : SUB,
              fontSize: 13,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'company' && (
        <CompanyWorkHours companyId={companyId} canEdit={isCeo} />
      )}
      {sub === 'admins' && (
        <BrandInventoryStaff brandId={brandId} companyId={companyId} currentUserRole={currentUserRole} />
      )}
      {sub === 'policy' && (
        <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>
          판매정책 준수 현황 기능은 준비중입니다.
        </div>
      )}
    </div>
  )
}
