'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchCompanyTierNames } from '@/lib/brand/fetchCompanyTierNames'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
const GRADE_COLORS: Record<string, string> = {
  '메디슈티컬': '#E53935', '프리미엄전문점': '#C9A96E', '전문점': '#9C7FD4', '취급점': '#64B5F6',
}
const inp: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none',
}
const btnPrimary: CSSProperties = { fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }
const btnGhost: CSSProperties = { fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: SUB, cursor: 'pointer' }

interface Props { companyId: string }

export default function BrandGradePointRatesCard({ companyId }: Props) {
  const supabase = createClient()
  const [toast, setToast] = useState('')
  const [grades, setGrades] = useState<string[]>([])
  /** Only grades that have a row in brand_grade_point_rates */
  const [rates, setRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingGrade, setEditingGrade] = useState<string | null>(null)
  const [draftRate, setDraftRate] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2800) }

  const load = useCallback(async () => {
    if (!companyId) {
      setGrades([])
      setRates({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const names = await fetchCompanyTierNames(supabase, companyId)
      const nextRates: Record<string, number> = {}
      const { data, error } = await supabase
        .from('brand_grade_point_rates')
        .select('grade, rate')
        .eq('company_id', companyId)
      if (!error && data) {
        const nameSet = new Set(names)
        for (const row of data as { grade?: string; rate?: number }[]) {
          const g = String(row.grade || '').trim()
          const r = Number(row.rate)
          if (!g || !nameSet.has(g) || !Number.isFinite(r)) continue
          nextRates[g] = r
        }
      }
      setGrades(names)
      setRates(nextRates)
    } finally {
      setLoading(false)
    }
  }, [companyId, supabase])

  useEffect(() => { void load() }, [load])

  const beginGradeEdit = (grade: string) => {
    setEditingGrade(grade)
    setDraftRate(Object.prototype.hasOwnProperty.call(rates, grade) ? String(rates[grade]) : '0')
  }

  const saveRate = async (grade: string) => {
    const rate = Number(draftRate)
    if (!Number.isFinite(rate) || rate < 0) { showToast('적립율을 숫자로 입력해주세요'); return }
    setSavingRate(true)
    const { data: existing } = await supabase.from('brand_grade_point_rates').select('id').eq('company_id', companyId).eq('grade', grade).maybeSingle()
    const { error } = existing?.id
      ? await supabase.from('brand_grade_point_rates').update({ rate }).eq('id', existing.id)
      : await supabase.from('brand_grade_point_rates').insert({ company_id: companyId, grade, rate })
    setSavingRate(false)
    if (error) { showToast('적립율 저장 실패: ' + error.message); return }
    setRates((prev) => ({ ...prev, [grade]: rate }))
    setEditingGrade(null)
    showToast(`${grade} 적립율 ${rate}% 저장됨`)
  }

  const rateLabel = (grade: string) => {
    if (Object.prototype.hasOwnProperty.call(rates, grade)) {
      return `구매액의 ${rates[grade]}%`
    }
    return '미설정'
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB }}>📊 등급별 적립율 (회사 전체 브랜드 공통 적용)</div>
        </div>
        {loading ? (
          <div style={{ fontSize: 12, color: SUB, padding: '8px 0' }}>불러오는 중…</div>
        ) : grades.length === 0 ? (
          <div style={{ fontSize: 12, color: SUB, padding: '8px 0' }}>등록된 등급 패키지가 없어요. 위에서 등급을 먼저 추가해 주세요.</div>
        ) : (
          grades.map((grade) => {
            const color = GRADE_COLORS[grade] || GOLD
            const editing = editingGrade === grade
            const configured = Object.prototype.hasOwnProperty.call(rates, grade)
            return (
              <div key={grade} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                <button type="button" onClick={() => beginGradeEdit(grade)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${color}22`, color, border: `0.5px solid ${color}55`, cursor: 'pointer' }}>{grade}</button>
                {editing ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={draftRate} onChange={(e) => setDraftRate(e.target.value)} inputMode="decimal" style={{ ...inp, width: 72 }} />
                    <span style={{ fontSize: 11, color: SUB }}>%</span>
                    <button type="button" disabled={savingRate} onClick={() => void saveRate(grade)} style={btnPrimary}>저장</button>
                    <button type="button" onClick={() => setEditingGrade(null)} style={btnGhost}>취소</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => beginGradeEdit(grade)}
                    style={{ fontSize: 12, color: configured ? GREEN : SUB, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {rateLabel(grade)}
                  </button>
                )}
              </div>
            )
          })
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(123,94,167,0.05)', borderRadius: 7, border: '0.5px solid rgba(123,94,167,0.15)' }}>
          💡 포인트는 제품 구매 시 1T = ₩1 · 현금 전환 불가 · 등급 클릭으로 수정
        </div>
      </div>
    </div>
  )
}
