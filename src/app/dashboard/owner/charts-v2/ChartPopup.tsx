'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const BG = '#ffffff'
const CARD = '#f9f8fc'
const BORDER = '#ede9f7'
const POINT = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#1A1A2E'
const SUB = '#888888'

const SKIN_TYPES = ['지성', '복합성', '건성', '민감성', '중성']
const SKIN_CONCERNS = ['청소년여드름', '성인여드름', '홍조', '색소침착', '주름·탄력', '모공', '각질', '트러블', '아토피']
const HORMONE_STATUS = ['생리 있음', '갱년기', '임신 중', '수유 중']
const TREATMENT_EXP = ['화학필링', '레이저', '보톡스', '필러']
const TREATMENT_AREAS = ['이마', '눈가', '볼', '코', '턱', '목', '전체']
const SKIN_REACTIONS = ['반응 양호', '약간 홍조', '트러블 발생', '건조함', '기타']

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  customer: any
  ownerId: string
  onOpenSalonChat?: (customer: any) => void
}

type Draft = {
  skinTypes: string[]
  skinConcerns: string[]
  hormoneStatus: string
  treatmentExperience: string[]
  allergy: string
  treatmentName: string
  treatmentAreas: string[]
  products: string[]
  skinReaction: string
  reactionDetail: string
  adminMemo: string
  treatmentAmount: string
  nextVisitDate: string
}

function parseMemo(raw: string | null | undefined) {
  try {
    return JSON.parse(String(raw || '{}'))
  } catch {
    return {}
  }
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function getPhase(lastPeriod: string | null | undefined): string {
  if (!lastPeriod) return '—'
  const start = new Date(lastPeriod)
  if (Number.isNaN(start.getTime())) return '—'
  const today = new Date()
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const day = ((diff % 28) + 28) % 28
  if (day < 5) return '달빛기'
  if (day < 13) return '황금기'
  if (day < 20) return '만개기'
  return '물들기'
}

function phaseEmoji(phase: string) {
  if (phase === '달빛기') return '🌙'
  if (phase === '황금기') return '✨'
  if (phase === '만개기') return '🌸'
  if (phase === '물들기') return '🍂'
  return ''
}

function getNextGoldenDate(lastPeriod: string | null | undefined): string {
  if (!lastPeriod) return ''
  const start = new Date(lastPeriod)
  if (Number.isNaN(start.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i <= 60; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const diff = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const day = ((diff % 28) + 28) % 28
    if (day >= 5 && day < 13) return d.toISOString().slice(0, 10)
  }
  return ''
}

function fmtDate(iso: string) {
  const p = String(iso || '').slice(0, 10).split('-')
  if (p.length !== 3) return iso
  return `${p[0]}.${p[1]}.${p[2]}`
}

function chip(active: boolean): React.CSSProperties {
  return {
    height: 44,
    padding: '0 14px',
    borderRadius: 22,
    fontSize: 14,
    fontWeight: 400,
    border: active ? '1.5px solid #7B5EA7' : `1px solid ${BORDER}`,
    background: active ? '#EDE9F7' : BG,
    color: active ? POINT : TEXT,
    cursor: 'pointer',
  }
}

function parseItems(raw: unknown) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

export default function ChartPopup({ open, onClose, onSaved, customer, ownerId, onOpenSalonChat }: Props) {
  const supabaseRef = useRef(createClient())
  const [phase, setPhase] = useState('—')
  const [goldenHint, setGoldenHint] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [draftAsk, setDraftAsk] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null)

  const [skinTypes, setSkinTypes] = useState<string[]>([])
  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [hormoneStatus, setHormoneStatus] = useState('')
  const [treatmentExperience, setTreatmentExperience] = useState<string[]>([])
  const [allergy, setAllergy] = useState('')
  const [treatmentName, setTreatmentName] = useState('')
  const [treatmentAreas, setTreatmentAreas] = useState<string[]>([])
  const [productInput, setProductInput] = useState('')
  const [products, setProducts] = useState<string[]>([])
  const [beforeFiles, setBeforeFiles] = useState<File[]>([])
  const [afterFiles, setAfterFiles] = useState<File[]>([])
  const [beforePreview, setBeforePreview] = useState<string[]>([])
  const [afterPreview, setAfterPreview] = useState<string[]>([])
  const [skinReaction, setSkinReaction] = useState('')
  const [reactionDetail, setReactionDetail] = useState('')
  const [adminMemo, setAdminMemo] = useState('')
  const [treatmentAmount, setTreatmentAmount] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [nameErr, setNameErr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [chartSaved, setChartSaved] = useState(false)
  const [toast, setToast] = useState('')

  const memoData = useMemo(() => parseMemo(customer?.memo), [customer])

  const collectDraft = (): Draft => ({
    skinTypes,
    skinConcerns,
    hormoneStatus,
    treatmentExperience,
    allergy,
    treatmentName,
    treatmentAreas,
    products,
    skinReaction,
    reactionDetail,
    adminMemo,
    treatmentAmount,
    nextVisitDate,
  })

  const applyDraft = (d: Draft) => {
    setSkinTypes(d.skinTypes || [])
    setSkinConcerns(d.skinConcerns || [])
    setHormoneStatus(d.hormoneStatus || '')
    setTreatmentExperience(d.treatmentExperience || [])
    setAllergy(d.allergy || '')
    setTreatmentName(d.treatmentName || '')
    setTreatmentAreas(d.treatmentAreas || [])
    setProducts(d.products || [])
    setSkinReaction(d.skinReaction || '')
    setReactionDetail(d.reactionDetail || '')
    setAdminMemo(d.adminMemo || '')
    setTreatmentAmount(d.treatmentAmount || '')
    setNextVisitDate(d.nextVisitDate || '')
  }

  const resetForm = () => {
    setSkinTypes([])
    setSkinConcerns([])
    setHormoneStatus('')
    setTreatmentExperience([])
    setAllergy('')
    setTreatmentName('')
    setTreatmentAreas([])
    setProductInput('')
    setProducts([])
    setBeforeFiles([])
    setAfterFiles([])
    setBeforePreview([])
    setAfterPreview([])
    setSkinReaction('')
    setReactionDetail('')
    setAdminMemo('')
    setTreatmentAmount('')
    setNextVisitDate('')
    setNameErr(false)
    setHistoryExpanded(false)
    setChartSaved(false)
  }

  useEffect(() => {
    if (!open || !customer?.id) return
    resetForm()
    const run = async () => {
      const sb = supabaseRef.current
      let lastPeriod: string | null = null
      if (customer.auran_user_id) {
        const { data: hcRows } = await sb
          .from('hormone_cycle')
          .select('last_period_date')
          .eq('user_id', customer.auran_user_id)
          .order('created_at', { ascending: false })
          .limit(1)
        lastPeriod = ((hcRows as any[]) || [])[0]?.last_period_date ?? null
      }
      if (!lastPeriod && memoData.birth_date && memoData.menstruation === '있음') {
        lastPeriod = String(memoData.birth_date)
      }
      const p = getPhase(lastPeriod)
      setPhase(p)
      const golden = getNextGoldenDate(lastPeriod)
      setGoldenHint(golden)
      if (golden) setNextVisitDate(golden)

      const { data: hist } = await sb
        .from('treatment_charts')
        .select('id,treatment_date,treatment_items,before_photos,after_photos')
        .eq('external_customer_id', customer.id)
        .order('treatment_date', { ascending: false })
        .limit(5)
      setHistory((hist as any[]) || [])

      const raw = localStorage.getItem(`chart_draft_${ownerId}_${customer.id}`)
      if (raw) {
        try {
          setPendingDraft(JSON.parse(raw) as Draft)
          setDraftAsk(true)
        } catch {
          /* ignore */
        }
      }
    }
    void run()
  }, [open, customer?.id, customer?.auran_user_id, memoData.birth_date, memoData.menstruation, ownerId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const handleClose = () => {
    if (customer?.id) {
      localStorage.setItem(`chart_draft_${ownerId}_${customer.id}`, JSON.stringify(collectDraft()))
    }
    onClose()
  }

  const uploadBatch = async (files: File[], kind: 'before' | 'after') => {
    const urls: string[] = []
    const ts = Date.now()
    for (let f of files) {
      const path = `${ownerId}/${customer.id}/${ts}_${kind}_${Math.random().toString(16).slice(2)}`
      f = await compressImage(f, 'owner_store')
      const { error } = await supabaseRef.current.storage.from('charts').upload(path, f, { upsert: true })
      if (!error) {
        const { data } = supabaseRef.current.storage.from('charts').getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
      }
    }
    return urls
  }

  const saveDraft = () => {
    if (!customer?.id) return
    localStorage.setItem(`chart_draft_${ownerId}_${customer.id}`, JSON.stringify(collectDraft()))
    setToast('임시저장 완료 💜')
  }

  const submit = async () => {
    if (!treatmentName.trim()) {
      setNameErr(true)
      return
    }
    setNameErr(false)
    setSaving(true)
    try {
      const beforeUrls = await uploadBatch(beforeFiles, 'before')
      const afterUrls = await uploadBatch(afterFiles, 'after')
      const adminMemoFinal = treatmentAmount.trim()
        ? `시술금액: ₩${Number(treatmentAmount).toLocaleString()}\n${adminMemo}`.trim()
        : adminMemo

      const { error } = await supabaseRef.current.from('treatment_charts').insert({
        owner_id: ownerId,
        external_customer_id: customer.id,
        treatment_date: new Date().toISOString(),
        treatment_items: JSON.stringify({
          name: treatmentName.trim(),
          areas: treatmentAreas,
          products,
          hormone_phase: phase !== '—' ? phase : null,
        }),
        skin_condition: JSON.stringify({
          diagnosis: {
            skin_type: skinTypes,
            concerns: skinConcerns,
            hormone_status: hormoneStatus,
            experiences: treatmentExperience,
            allergies: allergy,
          },
          reaction: skinReaction,
          detail: reactionDetail,
        }),
        admin_memo: adminMemoFinal,
        before_photos: beforeUrls,
        after_photos: afterUrls,
        next_visit_date: nextVisitDate || null,
        status: 'active',
        share_type: 'private',
      } as any)
      if (error) throw error

      await supabaseRef.current
        .from('external_customers')
        .update({
          visit_count: Number(customer.visit_count || 0) + 1,
          last_purchase_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', customer.id)

      localStorage.removeItem(`chart_draft_${ownerId}_${customer.id}`)
      setToast('시술차트 저장 완료 💜')
      setChartSaved(true)
      if (onOpenSalonChat) return
      setTimeout(() => {
        onSaved()
        onClose()
      }, 400)
    } catch {
      setToast('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const loadMore = async () => {
    setHistoryExpanded(true)
    const { data } = await supabaseRef.current
      .from('treatment_charts')
      .select('id,treatment_date,treatment_items,before_photos,after_photos')
      .eq('external_customer_id', customer.id)
      .order('treatment_date', { ascending: false })
      .limit(20)
    setHistory((data as any[]) || [])
  }

  if (!open || !customer) return null

  const cardStyle: React.CSSProperties = { background: CARD, borderRadius: 12, padding: 16, marginBottom: 12 }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: SUB, marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: 48,
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '0 14px',
    fontSize: 15,
    background: BG,
  }

  const skinTags = Array.isArray(memoData.skin_type) ? memoData.skin_type : memoData.skin_type ? [memoData.skin_type] : []
  const statusLabel = customer.auran_joined ? '오렌 연동' : memoData.invite_sent_at ? '앱 초대 중' : '내방 고객'

  return (
    <>
      <div role="presentation" onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.35)', zIndex: 200 }} />
      <div className="charts-v2-chart-popup" style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 520, maxWidth: '100%', background: BG, zIndex: 210, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(26,26,46,0.12)' }}>
        <style>{`@media (max-width:768px){.charts-v2-chart-popup{width:100%!important}}`}</style>
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>시술 차트 작성</span>
          <button type="button" onClick={handleClose} style={{ border: 'none', background: 'transparent', fontSize: 22, minWidth: 44, minHeight: 44, cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{customer.name}님</span>
              <button type="button" style={{ border: 'none', background: 'transparent', color: POINT, fontSize: 13, cursor: 'pointer' }}>
                앱 초대 →
              </button>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, background: '#EDE9F7', color: POINT, fontSize: 13, marginBottom: 10 }}>
              {phaseEmoji(phase)} {phase}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {skinTags.map((t: string) => (
                <span key={t} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: BG, border: `1px solid ${BORDER}` }}>
                  {t}
                </span>
              ))}
              {memoData.allergies ? (
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: '#fff5f5', border: '1px solid #ffd6d6', color: '#c0392b' }}>
                  ⚠ {memoData.allergies}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: SUB }}>상태: {statusLabel}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>원장님 피부 진단</div>
            <label style={labelStyle}>피부타입 (복수 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SKIN_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setSkinTypes((p) => toggle(p, t))} style={chip(skinTypes.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>피부 고민 (복수 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SKIN_CONCERNS.map((t) => (
                <button key={t} type="button" onClick={() => setSkinConcerns((p) => toggle(p, t))} style={chip(skinConcerns.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>호르몬 상태</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {HORMONE_STATUS.map((t) => (
                <button key={t} type="button" onClick={() => setHormoneStatus(t)} style={chip(hormoneStatus === t)}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>시술 경험</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {TREATMENT_EXP.map((t) => (
                <button key={t} type="button" onClick={() => setTreatmentExperience((p) => toggle(p, t))} style={chip(treatmentExperience.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>알레르기</label>
            <input value={allergy} onChange={(e) => setAllergy(e.target.value)} style={inputStyle} />
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>오늘 시술 기록</div>
            <label style={labelStyle}>시술명 *</label>
            <input
              value={treatmentName}
              onChange={(e) => setTreatmentName(e.target.value)}
              style={{ ...inputStyle, border: nameErr ? '1px solid #e74c3c' : inputStyle.border, marginBottom: 12 }}
            />
            <label style={labelStyle}>시술 부위 (복수 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {TREATMENT_AREAS.map((t) => (
                <button key={t} type="button" onClick={() => setTreatmentAreas((p) => toggle(p, t))} style={chip(treatmentAreas.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>사용 제품</label>
            <input
              value={productInput}
              onChange={(e) => setProductInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && productInput.trim()) {
                  e.preventDefault()
                  setProducts((p) => [...p, productInput.trim()])
                  setProductInput('')
                }
              }}
              placeholder="검색 또는 직접 입력"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>제품명 직접 입력 가능 (Enter)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {products.map((p, i) => (
                <span key={`${p}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 20, background: '#EDE9F7', color: POINT, fontSize: 12 }}>
                  {p}
                  <button type="button" onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: POINT }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <label style={{ ...labelStyle, marginTop: 12 }}>Before 사진</label>
            <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 14, marginBottom: 8 }}>
              📷 사진 추가
              <input type="file" accept="image/*" multiple hidden onChange={(e) => {
                const arr = Array.from(e.target.files || [])
                setBeforeFiles((p) => [...p, ...arr].slice(0, 9))
                setBeforePreview((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
              }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
              {beforePreview.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />)}
            </div>
            <label style={labelStyle}>After 사진</label>
            <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 14, marginBottom: 8 }}>
              📷 사진 추가
              <input type="file" accept="image/*" multiple hidden onChange={(e) => {
                const arr = Array.from(e.target.files || [])
                setAfterFiles((p) => [...p, ...arr].slice(0, 9))
                setAfterPreview((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
              }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {afterPreview.map((u, i) => <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />)}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>피부 반응 · 메모</div>
            <label style={labelStyle}>피부 반응</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SKIN_REACTIONS.map((t) => (
                <button key={t} type="button" onClick={() => setSkinReaction(t)} style={chip(skinReaction === t)}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>상세 메모</label>
            <textarea value={reactionDetail} onChange={(e) => setReactionDetail(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${BORDER}`, padding: 12, fontSize: 15, marginBottom: 12, background: BG }} />
            <label style={labelStyle}>원장님 메모</label>
            <textarea value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${BORDER}`, padding: 12, fontSize: 15, background: BG }} />
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>방문 정보</div>
            <label style={labelStyle}>시술 금액</label>
            <input type="number" value={treatmentAmount} onChange={(e) => setTreatmentAmount(e.target.value)} placeholder="₩" style={{ ...inputStyle, marginBottom: 12 }} />
            <label style={labelStyle}>다음 방문 추천일</label>
            <input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)} style={inputStyle} />
            {goldenHint ? <div style={{ fontSize: 12, color: GOLD, marginTop: 8 }}>(다음 황금기: {fmtDate(goldenHint)} 자동표시)</div> : null}
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>이전 시술 히스토리 ({history.length}회)</div>
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: SUB }}>기록 없음</div>
            ) : (
              history.map((h) => {
                const items = parseItems(h.treatment_items)
                const hp = items?.hormone_phase ? String(items.hormone_phase) : '—'
                const name = items?.name ? String(items.name) : '—'
                return (
                  <div key={h.id} style={{ fontSize: 13, padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
                    {fmtDate(String(h.treatment_date || ''))} {phaseEmoji(hp)} {hp} {name}
                  </div>
                )
              })
            )}
            {history.length >= 5 && !historyExpanded ? (
              <button type="button" onClick={() => void loadMore()} style={{ ...chip(false), width: '100%', marginTop: 10 }}>
                더보기
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ position: 'sticky', bottom: 0, background: BG, padding: 16, borderTop: '1px solid #f0edf8', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={saveDraft} style={{ flex: 1, height: 48, borderRadius: 10, border: `1px solid ${BORDER}`, background: BG, fontSize: 15, cursor: 'pointer' }}>
              임시저장
            </button>
            <button type="button" disabled={saving} onClick={() => void submit()} style={{ flex: 1, height: 48, borderRadius: 10, border: 'none', background: POINT, color: '#fff', fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '저장 중…' : '저장 완료'}
            </button>
          </div>
          {chartSaved && onOpenSalonChat ? (
            <button
              type="button"
              onClick={() => onOpenSalonChat(customer)}
              style={{ width: '100%', height: 48, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#EDE9F7', color: POINT, fontSize: 15, cursor: 'pointer' }}
            >
              상담톡 시작하기
            </button>
          ) : null}
        </div>
      </div>

      {draftAsk && pendingDraft ? (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
          <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: BG, borderRadius: 14, padding: 20, zIndex: 310, width: 300, maxWidth: '90%' }}>
            <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>임시저장된 내용이 있어요. 불러올까요?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { applyDraft(pendingDraft); setDraftAsk(false); setPendingDraft(null) }} style={{ flex: 1, height: 44, borderRadius: 10, background: POINT, color: '#fff', border: 'none', cursor: 'pointer' }}>
                불러오기
              </button>
              <button type="button" onClick={() => { setDraftAsk(false); setPendingDraft(null) }} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, background: BG, cursor: 'pointer' }}>
                새로 작성
              </button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: POINT, color: '#fff', borderRadius: 12, padding: '12px 18px', fontSize: 13, zIndex: 400 }}>
          {toast}
        </div>
      ) : null}
    </>
  )
}
