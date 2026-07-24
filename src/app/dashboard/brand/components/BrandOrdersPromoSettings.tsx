'use client'

import { useCallback, useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GRADE_POINT_RATES } from '@/lib/brand/brandOrderPromos'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
const RED = 'rgba(229,57,53,0.75)'
const GRADES = Object.keys(GRADE_POINT_RATES)
const GRADE_COLORS: Record<string, string> = {
  '메디슈티컬': '#E53935', '프리미엄전문점': '#C9A96E', '전문점': '#9C7FD4', '취급점': '#64B5F6',
}
const inp: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none',
}
const btnPrimary: CSSProperties = { fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }
const btnGhost: CSSProperties = { fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: SUB, cursor: 'pointer' }
const pill = (selected: boolean): CSSProperties => ({
  fontSize: 11, padding: '3px 8px', borderRadius: 6,
  border: `0.5px solid ${selected ? PURPLE : 'rgba(255,255,255,0.1)'}`,
  background: selected ? 'rgba(123,94,167,0.2)' : 'transparent', color: selected ? '#c4a7e7' : SUB, cursor: 'pointer',
})

type PromoRow = {
  id: string; brand_id: string; title: string | null; condition: string | null
  bonus: string | null; qty: number | null; bonus_qty: number | null; status: string | null; promo_type: string | null
}
type PromoDraft = { title: string; condition: string; qty: string; bonus_qty: string; bonus: string }
const emptyDraft = (): PromoDraft => ({ title: '', condition: '', qty: '', bonus_qty: '', bonus: '' })

function toPayload(d: PromoDraft) {
  const qty = d.qty.trim() === '' ? null : Math.trunc(Number(d.qty))
  const bonus_qty = d.bonus_qty.trim() === '' ? null : Math.trunc(Number(d.bonus_qty))
  const bonus = d.bonus.trim() || (qty != null && bonus_qty != null ? `${qty}+${bonus_qty}` : null)
  const title = d.title.trim() || [d.condition.trim(), bonus].filter(Boolean).join(' ') || '프로모션'
  return {
    title, condition: d.condition.trim() || null,
    qty: Number.isFinite(qty as number) ? qty : null,
    bonus_qty: Number.isFinite(bonus_qty as number) ? bonus_qty : null,
    bonus, promo_type: 'qty_price' as const,
  }
}

function DraftFields({ draft, setDraft }: { draft: PromoDraft; setDraft: Dispatch<SetStateAction<PromoDraft>> }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="제목 (비우면 자동)" style={inp} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {GRADES.map((g) => (
          <button key={g} type="button" onClick={() => setDraft((p) => ({ ...p, condition: g }))} style={pill(draft.condition === g)}>{g}</button>
        ))}
        <button type="button" onClick={() => setDraft((p) => ({ ...p, condition: '' }))} style={pill(!draft.condition)}>전체</button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={draft.qty} onChange={(e) => setDraft((p) => ({ ...p, qty: e.target.value }))} placeholder="구매 수량" inputMode="numeric" style={{ ...inp, flex: 1 }} />
        <input value={draft.bonus_qty} onChange={(e) => setDraft((p) => ({ ...p, bonus_qty: e.target.value }))} placeholder="증정 수량" inputMode="numeric" style={{ ...inp, flex: 1 }} />
      </div>
      <input value={draft.bonus} onChange={(e) => setDraft((p) => ({ ...p, bonus: e.target.value }))} placeholder="표시문구 (예: 10+5)" style={inp} />
    </div>
  )
}

interface Props { brandId: string }

export default function BrandOrdersPromoSettings({ brandId }: Props) {
  const supabase = createClient()
  const [toast, setToast] = useState('')
  const [rates, setRates] = useState<Record<string, number>>({ ...GRADE_POINT_RATES })
  const [editingGrade, setEditingGrade] = useState<string | null>(null)
  const [draftRate, setDraftRate] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [promos, setPromos] = useState<PromoRow[]>([])
  const [loadingPromos, setLoadingPromos] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addDraft, setAddDraft] = useState<PromoDraft>(emptyDraft())
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<PromoDraft>(emptyDraft())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [promoOpen, setPromoOpen] = useState(false)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2800) }

  const loadRates = useCallback(async () => {
    const base = { ...GRADE_POINT_RATES }
    const { data, error } = await supabase.from('brand_grade_point_rates').select('grade, rate').eq('brand_id', brandId)
    if (!error && data) {
      for (const row of data as { grade?: string; rate?: number }[]) {
        const g = String(row.grade || '').trim()
        const r = Number(row.rate)
        if (g && Number.isFinite(r)) base[g] = r
      }
    }
    setRates(base)
  }, [brandId])

  const loadPromos = useCallback(async () => {
    setLoadingPromos(true)
    const { data, error } = await supabase
      .from('supply_promos')
      .select('id, brand_id, title, condition, bonus, qty, bonus_qty, status, promo_type')
      .eq('brand_id', brandId)
      .order('qty', { ascending: true })
    if (error) { showToast('프로모션 목록 불러오기 실패: ' + error.message); setPromos([]) }
    else setPromos((data || []) as PromoRow[])
    setLoadingPromos(false)
  }, [brandId])

  useEffect(() => { void loadRates(); void loadPromos() }, [loadRates, loadPromos])

  const beginGradeEdit = (grade: string) => {
    setEditingGrade(grade)
    setDraftRate(String(rates[grade] ?? GRADE_POINT_RATES[grade] ?? 1))
  }

  const saveRate = async (grade: string) => {
    const rate = Number(draftRate)
    if (!Number.isFinite(rate) || rate < 0) { showToast('적립율을 숫자로 입력해주세요'); return }
    setSavingRate(true)
    const { data: existing } = await supabase.from('brand_grade_point_rates').select('id').eq('brand_id', brandId).eq('grade', grade).maybeSingle()
    const { error } = existing?.id
      ? await supabase.from('brand_grade_point_rates').update({ rate }).eq('id', existing.id)
      : await supabase.from('brand_grade_point_rates').insert({ brand_id: brandId, grade, rate })
    setSavingRate(false)
    if (error) { showToast('적립율 저장 실패: ' + error.message); return }
    setRates((prev) => ({ ...prev, [grade]: rate }))
    setEditingGrade(null)
    showToast(`${grade} 적립율 ${rate}% 저장됨`)
  }

  const insertPromo = async () => {
    const payload = toPayload(addDraft)
    if (!payload.title) { showToast('제목 또는 수량 조건을 입력해주세요'); return }
    setBusyId('add')
    const { error } = await supabase.from('supply_promos').insert({ brand_id: brandId, ...payload, status: 'active' })
    setBusyId(null)
    if (error) { showToast('추가 실패: ' + error.message); return }
    setAdding(false); setAddDraft(emptyDraft()); showToast('프로모션이 추가됐어요'); void loadPromos()
  }

  const saveEdit = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from('supply_promos').update(toPayload(editDraft)).eq('id', id)
    setBusyId(null)
    if (error) { showToast('수정 실패: ' + error.message); return }
    setEditId(null); showToast('프로모션이 수정됐어요'); void loadPromos()
  }

  const toggleStatus = async (row: PromoRow) => {
    const next = row.status === 'active' ? 'inactive' : 'active'
    setBusyId(row.id)
    const { error } = await supabase.from('supply_promos').update({ status: next }).eq('id', row.id)
    setBusyId(null)
    if (error) { showToast('상태 변경 실패: ' + error.message); return }
    showToast(next === 'active' ? '활성화됐어요' : '비활성화됐어요'); void loadPromos()
  }

  const deletePromo = async (id: string) => {
    setBusyId(id)
    const { error } = await supabase.from('supply_promos').delete().eq('id', id)
    setBusyId(null)
    if (error) { showToast('삭제 실패: ' + error.message); setConfirmDeleteId(null); return }
    setConfirmDeleteId(null); showToast('프로모션이 삭제됐어요'); void loadPromos()
  }

  const startEdit = (row: PromoRow) => {
    setEditId(row.id); setConfirmDeleteId(null)
    setEditDraft({
      title: row.title || '', condition: row.condition || '',
      qty: row.qty != null ? String(row.qty) : '', bonus_qty: row.bonus_qty != null ? String(row.bonus_qty) : '',
      bonus: row.bonus || '',
    })
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB }}>📊 등급별 적립율</div>
          {!promoOpen ? (
            <button
              type="button"
              onClick={() => { setPromoOpen(true); setAdding(true); setEditId(null); setConfirmDeleteId(null) }}
              style={btnPrimary}
            >
              + 새 프로모션 추가
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setPromoOpen(false); setAdding(false); setAddDraft(emptyDraft()); setEditId(null); setConfirmDeleteId(null) }}
              style={btnGhost}
            >
              닫기
            </button>
          )}
        </div>
        {GRADES.map((grade) => {
          const color = GRADE_COLORS[grade] || GOLD
          const editing = editingGrade === grade
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
                <button type="button" onClick={() => beginGradeEdit(grade)} style={{ fontSize: 12, color: GREEN, background: 'none', border: 'none', cursor: 'pointer' }}>
                  구매액의 {rates[grade] ?? GRADE_POINT_RATES[grade] ?? 1}%
                </button>
              )}
            </div>
          )
        })}
        <div style={{ marginTop: 10, fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(123,94,167,0.05)', borderRadius: 7, border: '0.5px solid rgba(123,94,167,0.15)' }}>
          💡 포인트는 제품 구매 시 1T = ₩1 · 현금 전환 불가 · 등급 클릭으로 수정
        </div>
      </div>

      {promoOpen && (
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB }}>📋 프로모션</div>
          {!adding && (
            <button type="button" onClick={() => { setAdding(true); setEditId(null); setConfirmDeleteId(null) }} style={btnPrimary}>새 프로모션 추가</button>
          )}
        </div>
        {adding && (
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
            <DraftFields draft={addDraft} setDraft={setAddDraft} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" disabled={busyId === 'add'} onClick={() => void insertPromo()} style={btnPrimary}>추가</button>
              <button type="button" onClick={() => { setAdding(false); setAddDraft(emptyDraft()) }} style={btnGhost}>취소</button>
            </div>
          </div>
        )}
        {loadingPromos ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : promos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>등록된 프로모션이 없어요</div>
        ) : promos.map((row) => {
          const active = row.status === 'active'
          const label = row.bonus || (row.qty != null && row.bonus_qty != null ? `${row.qty}+${row.bonus_qty}` : row.title || '-')
          return (
            <div key={row.id} style={{ padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.04)', opacity: active ? 1 : 0.55 }}>
              {editId === row.id ? (
                <div>
                  <DraftFields draft={editDraft} setDraft={setEditDraft} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button type="button" disabled={busyId === row.id} onClick={() => void saveEdit(row.id)} style={btnPrimary}>저장</button>
                    <button type="button" onClick={() => setEditId(null)} style={btnGhost}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 14, color: PURPLE, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: SUB }}>
                      {row.condition || '전체 등급'} · {row.title || '-'}
                      {!active && <span style={{ marginLeft: 6, color: RED }}>비활성</span>}
                    </div>
                  </div>
                  {confirmDeleteId === row.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: RED }}>정말 삭제할까요?</span>
                      <button type="button" disabled={busyId === row.id} onClick={() => void deletePromo(row.id)} style={{ ...btnGhost, borderColor: 'rgba(229,57,53,0.4)', color: RED }}>삭제</button>
                      <button type="button" onClick={() => setConfirmDeleteId(null)} style={btnGhost}>취소</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => startEdit(row)} style={btnGhost}>수정</button>
                      <button type="button" disabled={busyId === row.id} onClick={() => void toggleStatus(row)} style={btnGhost}>{active ? '비활성화' : '활성화'}</button>
                      <button type="button" onClick={() => { setConfirmDeleteId(row.id); setEditId(null) }} style={{ ...btnGhost, borderColor: 'rgba(229,57,53,0.3)', color: RED }}>삭제</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
