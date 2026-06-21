'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const BG = '#ffffff'
const CARD = '#f9f8fc'
const BORDER = '#ede9f7'
const POINT = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#1A1A2E'
const SUB = '#888888'

const SKIN_TYPES = ['지성', '복합성', '건성', '민감성', '중성'] as const
const SKIN_CONCERNS = ['청소년여드름', '성인여드름', '홍조', '색소침착', '주름·탄력', '모공', '각질', '트러블', '아토피'] as const
const HORMONE_STATUS = ['생리 있음', '갱년기', '임신 중', '수유 중'] as const
const TREATMENT_EXP = ['화학필링', '레이저', '보톡스', '필러'] as const
const TREATMENT_AREAS = ['이마', '눈가', '볼', '코', '턱', '목', '전체'] as const
const SKIN_REACTIONS = ['반응 양호', '약간 홍조', '트러블 발생', '건조함', '기타'] as const

type CustomerRow = {
  key: string
  kind: 'user' | 'external'
  id: string
  authId: string | null
  name: string
  profile: Record<string, unknown> | null
  visitCount: number
  lastVisit: string | null
}

type ProductPick = { id: string; name: string; brand?: string | null; thumb_img?: string | null }

type ChartDraft = {
  skinTypes: string[]
  skinConcerns: string[]
  hormoneStatus: string
  treatmentExperience: string[]
  allergy: string
  treatmentName: string
  treatmentAreas: string[]
  selectedProducts: ProductPick[]
  skinReaction: string
  reactionDetail: string
  adminMemo: string
  treatmentAmount: string
  nextVisitDate: string
}

function getPhaseFromCycleStart(startDate: string | null | undefined): string {
  if (!startDate) return '—'
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return '—'
  const today = new Date()
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const day = ((diff % 28) + 28) % 28
  if (day < 5) return '달빛기'
  if (day < 13) return '황금기'
  if (day < 20) return '만개기'
  return '물들기'
}

function phaseEmoji(phase: string): string {
  if (phase === '달빛기') return '🌙'
  if (phase === '황금기') return '✨'
  if (phase === '만개기') return '🌸'
  if (phase === '물들기') return '🍂'
  return ''
}

function cycleStartFromProfile(profile: Record<string, unknown> | null | undefined): string | null {
  if (!profile) return null
  const start = profile.menstrual_cycle_start ?? profile.menstrual_cycle
  return start ? String(start) : null
}

function getNextGoldenDate(cycleStart: string | null | undefined): string {
  if (!cycleStart) return ''
  const start = new Date(cycleStart)
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

function draftKey(ownerId: string, customerKey: string) {
  return `chart_draft_${ownerId}_${customerKey}`
}

function toggleInList(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 44,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 400,
    borderRadius: 20,
    border: active ? `1px solid ${POINT}` : `1px solid ${BORDER}`,
    background: active ? '#EDE9F7' : BG,
    color: active ? POINT : TEXT,
    cursor: 'pointer',
  }
}

function PhaseBadge({ phase }: { phase: string }) {
  if (!phase || phase === '—') return <span style={{ color: SUB, fontSize: 12 }}>—</span>
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        background: '#EDE9F7',
        color: POINT,
        border: `1px solid ${BORDER}`,
      }}
    >
      {phase}
      {phaseEmoji(phase)}
    </span>
  )
}

export default function OwnerChartsV2Page() {
  const supabase = createClient()
  const router = useRouter()
  const supabaseRef = useRef(supabase)
  supabaseRef.current = supabase

  const [owner, setOwner] = useState<{ id: string; auth_id?: string } | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [kpi, setKpi] = useState({ today: 0, month: 0, unsigned: 0, totalCustomers: 0 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [popupOpen, setPopupOpen] = useState(false)
  const [activeCustomer, setActiveCustomer] = useState<CustomerRow | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const [skinTypes, setSkinTypes] = useState<string[]>([])
  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [hormoneStatus, setHormoneStatus] = useState('')
  const [treatmentExperience, setTreatmentExperience] = useState<string[]>([])
  const [allergy, setAllergy] = useState('')

  const [treatmentName, setTreatmentName] = useState('')
  const [treatmentAreas, setTreatmentAreas] = useState<string[]>([])
  const [productQ, setProductQ] = useState('')
  const [productHits, setProductHits] = useState<ProductPick[]>([])
  const [selectedProducts, setSelectedProducts] = useState<ProductPick[]>([])
  const [beforeFiles, setBeforeFiles] = useState<File[]>([])
  const [afterFiles, setAfterFiles] = useState<File[]>([])
  const [beforePreview, setBeforePreview] = useState<string[]>([])
  const [afterPreview, setAfterPreview] = useState<string[]>([])
  const [skinReaction, setSkinReaction] = useState('')
  const [reactionDetail, setReactionDetail] = useState('')
  const [adminMemo, setAdminMemo] = useState('')
  const [treatmentAmount, setTreatmentAmount] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [saving, setSaving] = useState(false)

  const activePhase = useMemo(() => {
    const start = cycleStartFromProfile(activeCustomer?.profile ?? null)
    return getPhaseFromCycleStart(start)
  }, [activeCustomer])

  const refreshData = useCallback(async (ownerId: string) => {
    const sb = supabaseRef.current
    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const monthKey = todayKey.slice(0, 7)

    const [{ data: charts }, { data: salonCustomers }, { data: externals }] = await Promise.all([
      sb.from('treatment_charts').select('id,treatment_date,customer_signed_at,customer_id,treatment_items,treatment_name,products_used,before_photos,after_photos,hormone_phase').eq('owner_id', ownerId).order('treatment_date', { ascending: false }).limit(200),
      sb.from('users').select('id,auth_id,name').eq('role', 'customer').limit(300),
      sb.from('external_customers').select('id,name,visit_count,last_purchase_at,auran_user_id').order('updated_at', { ascending: false }).limit(300),
    ])

    const chartList = (charts as any[]) || []
    const userList = (salonCustomers as any[]) || []
    const extList = (externals as any[]) || []

    const authIds = [
      ...userList.map((u) => u.auth_id).filter(Boolean),
      ...extList.map((e) => e.auran_user_id).filter(Boolean),
    ]
    let profileMap: Record<string, Record<string, unknown>> = {}
    if (authIds.length) {
      const { data: profiles } = await sb
        .from('profiles')
        .select('auth_id,birth_date,skin_type,skin_concerns,menstrual_cycle,menstrual_cycle_start')
        .in('auth_id', authIds)
      for (const p of (profiles as any[]) || []) {
        if (p.auth_id) profileMap[p.auth_id] = p
      }
    }

    const visitByAuth: Record<string, { count: number; last: string | null }> = {}
    for (const c of chartList) {
      const cid = String(c.customer_id || '')
      if (!cid) continue
      const prev = visitByAuth[cid] || { count: 0, last: null }
      const d = String(c.treatment_date || '').slice(0, 10)
      visitByAuth[cid] = {
        count: prev.count + 1,
        last: !prev.last || d > prev.last ? d : prev.last,
      }
    }

    const rows: CustomerRow[] = []
    for (const u of userList) {
      const authId = String(u.auth_id || '')
      rows.push({
        key: `user-${u.id}`,
        kind: 'user',
        id: String(u.id),
        authId: authId || null,
        name: String(u.name || '고객'),
        profile: authId ? profileMap[authId] ?? null : null,
        visitCount: authId ? visitByAuth[authId]?.count ?? 0 : 0,
        lastVisit: authId ? visitByAuth[authId]?.last ?? null : null,
      })
    }
    for (const e of extList) {
      const authId = e.auran_user_id ? String(e.auran_user_id) : null
      rows.push({
        key: `ext-${e.id}`,
        kind: 'external',
        id: String(e.id),
        authId,
        name: String(e.name || '외부고객'),
        profile: authId ? profileMap[authId] ?? null : null,
        visitCount: Number(e.visit_count || 0),
        lastVisit: e.last_purchase_at ? String(e.last_purchase_at).slice(0, 10) : null,
      })
    }

    setCustomers(rows)
    setKpi({
      today: chartList.filter((x) => String(x.treatment_date || '').slice(0, 10) === todayKey).length,
      month: chartList.filter((x) => String(x.treatment_date || '').slice(0, 7) === monthKey).length,
      unsigned: chartList.filter((x) => !x.customer_signed_at).length,
      totalCustomers: rows.length,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    const run = async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) {
        router.push('/login?role=owner')
        return
      }
      const { data: me } = await sb.from('users').select('id,auth_id').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) return
      setOwner(me as any)
      await refreshData(String(me.id))
    }
    void run()
  }, [router, refreshData])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!productQ.trim()) {
      setProductHits([])
      return
    }
    const t = setTimeout(async () => {
      const q = productQ.trim()
      const { data } = await supabaseRef.current
        .from('products')
        .select('id,name,brand_name,thumb_img')
        .eq('status', 'active')
        .or(`name.ilike.%${q}%,brand_name.ilike.%${q}%`)
        .limit(12)
      setProductHits(
        ((data as any[]) || []).map((p) => ({
          id: String(p.id),
          name: String(p.name || ''),
          brand: p.brand_name,
          thumb_img: p.thumb_img,
        }))
      )
    }, 280)
    return () => clearTimeout(t)
  }, [productQ])

  const collectDraft = (): ChartDraft => ({
    skinTypes,
    skinConcerns,
    hormoneStatus,
    treatmentExperience,
    allergy,
    treatmentName,
    treatmentAreas,
    selectedProducts,
    skinReaction,
    reactionDetail,
    adminMemo,
    treatmentAmount,
    nextVisitDate,
  })

  const applyDraft = (d: ChartDraft) => {
    setSkinTypes(d.skinTypes || [])
    setSkinConcerns(d.skinConcerns || [])
    setHormoneStatus(d.hormoneStatus || '')
    setTreatmentExperience(d.treatmentExperience || [])
    setAllergy(d.allergy || '')
    setTreatmentName(d.treatmentName || '')
    setTreatmentAreas(d.treatmentAreas || [])
    setSelectedProducts(d.selectedProducts || [])
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
    setProductQ('')
    setProductHits([])
    setSelectedProducts([])
    setBeforeFiles([])
    setAfterFiles([])
    setBeforePreview([])
    setAfterPreview([])
    setSkinReaction('')
    setReactionDetail('')
    setAdminMemo('')
    setTreatmentAmount('')
    setNextVisitDate('')
    setHistory([])
    setHistoryExpanded(false)
  }

  const loadCustomerContext = async (row: CustomerRow) => {
    const sb = supabaseRef.current
    resetForm()

    if (owner?.id) {
      let skinQ = sb.from('customer_skin_profiles').select('*').eq('owner_id', owner.id)
      if (row.kind === 'external') skinQ = skinQ.eq('external_customer_id', row.id)
      else if (row.authId) skinQ = skinQ.eq('customer_id', row.authId)
      const { data: skinProf } = await skinQ.maybeSingle()
      if (skinProf) {
        setSkinTypes((skinProf as any).skin_types || [])
        setSkinConcerns((skinProf as any).skin_concerns || [])
        setHormoneStatus(String((skinProf as any).hormone_status || ''))
        setTreatmentExperience((skinProf as any).treatment_experience || [])
        setAllergy(String((skinProf as any).allergy || ''))
      }
    }

    const golden = getNextGoldenDate(cycleStartFromProfile(row.profile))
    if (golden) setNextVisitDate(golden)

    if (row.authId && owner?.id) {
      const { data: hist } = await sb
        .from('treatment_charts')
        .select('id,treatment_date,treatment_name,treatment_items,products_used,before_photos,after_photos,hormone_phase')
        .eq('owner_id', owner.id)
        .eq('customer_id', row.authId)
        .order('treatment_date', { ascending: false })
        .limit(historyExpanded ? 20 : 5)
      setHistory((hist as any[]) || [])
    }

    if (owner?.id) {
      const raw = localStorage.getItem(draftKey(owner.id, row.key))
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ChartDraft
          if (window.confirm('임시저장된 차트가 있습니다. 불러올까요?')) applyDraft(parsed)
        } catch {
          /* ignore */
        }
      }
    }
  }

  const openPopup = async (row: CustomerRow) => {
    setActiveCustomer(row)
    setPopupOpen(true)
    await loadCustomerContext(row)
  }

  const closePopup = () => {
    if (owner?.id && activeCustomer) {
      localStorage.setItem(draftKey(owner.id, activeCustomer.key), JSON.stringify(collectDraft()))
    }
    setPopupOpen(false)
    setActiveCustomer(null)
  }

  const onPickFiles = (files: FileList | null, kind: 'before' | 'after') => {
    if (!files) return
    const arr = Array.from(files)
    if (kind === 'before') {
      setBeforeFiles((p) => [...p, ...arr].slice(0, 9))
      setBeforePreview((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
    } else {
      setAfterFiles((p) => [...p, ...arr].slice(0, 9))
      setAfterPreview((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9))
    }
  }

  const uploadBatch = async (files: File[], chartId: string, kind: 'before' | 'after') => {
    if (!owner?.id) return [] as string[]
    const sb = supabaseRef.current
    const urls: string[] = []
    for (let f of files) {
      const path = `charts/${owner.id}/${chartId}/${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`
      f = await compressImage(f, 'owner_store')
      const { error } = await sb.storage.from('charts').upload(path, f, { upsert: true })
      if (!error) {
        const { data } = sb.storage.from('charts').getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
      }
    }
    return urls
  }

  const saveDraftManual = () => {
    if (!owner?.id || !activeCustomer) return
    localStorage.setItem(draftKey(owner.id, activeCustomer.key), JSON.stringify(collectDraft()))
    setToast('임시저장 완료 💜')
  }

  const submitChart = async () => {
    if (!owner?.id || !activeCustomer) return
    if (!activeCustomer.authId && activeCustomer.kind === 'user') {
      setToast('고객 정보가 없어 저장할 수 없습니다')
      return
    }
    setSaving(true)
    const sb = supabaseRef.current
    const chartId = crypto.randomUUID()
    const hormonePhase = activePhase !== '—' ? activePhase : null

    try {
      const skinPayload: Record<string, unknown> = {
        owner_id: owner.id,
        skin_types: skinTypes,
        skin_concerns: skinConcerns,
        hormone_status: hormoneStatus || null,
        treatment_experience: treatmentExperience,
        allergy: allergy || null,
        updated_at: new Date().toISOString(),
      }
      if (activeCustomer.kind === 'external') {
        skinPayload.external_customer_id = activeCustomer.id
        skinPayload.customer_id = activeCustomer.authId
      } else {
        skinPayload.customer_id = activeCustomer.authId
        skinPayload.external_customer_id = null
      }

      const skinFilter =
        activeCustomer.kind === 'external'
          ? { owner_id: owner.id, external_customer_id: activeCustomer.id }
          : { owner_id: owner.id, customer_id: activeCustomer.authId }

      await sb.from('customer_skin_profiles').upsert(skinPayload as any, { onConflict: 'owner_id,external_customer_id' })

      const beforeUrls = await uploadBatch(beforeFiles, chartId, 'before')
      const afterUrls = await uploadBatch(afterFiles, chartId, 'after')
      const items = treatmentName.trim() ? [treatmentName.trim(), ...treatmentAreas] : treatmentAreas

      const chartCustomerId = activeCustomer.authId || activeCustomer.id
      const { error: chartErr } = await sb.from('treatment_charts').insert({
        id: chartId,
        owner_id: owner.id,
        customer_id: chartCustomerId,
        treatment_date: new Date().toISOString(),
        treatment_name: treatmentName.trim() || null,
        treatment_items: items,
        treatment_areas: treatmentAreas,
        products_used: selectedProducts.map((p) => ({ id: p.id, name: p.name, brand: p.brand ?? null })),
        hormone_phase: hormonePhase,
        skin_condition: skinReaction,
        before_photos: beforeUrls,
        after_photos: afterUrls,
        management_tips: reactionDetail,
        admin_memo: adminMemo,
        treatment_amount: treatmentAmount ? Number(treatmentAmount) : null,
        next_visit_date: nextVisitDate || null,
        share_type: 'private',
        status: 'completed',
      } as any)

      if (chartErr) throw chartErr

      if (activeCustomer.kind === 'external') {
        await sb
          .from('external_customers')
          .update({
            visit_count: activeCustomer.visitCount + 1,
            last_purchase_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeCustomer.id)
      } else if (activeCustomer.id) {
        await sb
          .from('users')
          .update({ last_purchase_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          .eq('id', activeCustomer.id)
      }

      localStorage.removeItem(draftKey(owner.id, activeCustomer.key))
      setPopupOpen(false)
      setActiveCustomer(null)
      setToast('차트 저장 완료 💜')
      await refreshData(owner.id)
    } catch {
      setToast('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const loadMoreHistory = async () => {
    if (!owner?.id || !activeCustomer?.authId) return
    setHistoryExpanded(true)
    const { data } = await supabaseRef.current
      .from('treatment_charts')
      .select('id,treatment_date,treatment_name,treatment_items,products_used,before_photos,after_photos,hormone_phase')
      .eq('owner_id', owner.id)
      .eq('customer_id', activeCustomer.authId)
      .order('treatment_date', { ascending: false })
      .limit(20)
    setHistory((data as any[]) || [])
  }

  const profile = activeCustomer?.profile
  const selfSkinType = profile?.skin_type ? String(profile.skin_type) : '—'
  const selfConcerns = Array.isArray(profile?.skin_concerns)
    ? (profile!.skin_concerns as string[]).join(', ')
    : profile?.skin_concerns
      ? String(profile.skin_concerns)
      : '—'

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 1024, margin: '0 auto', paddingBottom: 40 }}>
      <style>{`
        @media (max-width: 768px) {
          .charts-v2-popup { width: 100% !important; }
        }
      `}</style>

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: BG,
          padding: '14px 16px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 20, minWidth: 44, minHeight: 44, cursor: 'pointer' }}
        >
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>시술 차트 V2</div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            ['오늘 차트', kpi.today],
            ['이번 달', kpi.month],
            ['미서명', kpi.unsigned],
            ['전체 고객', kpi.totalCustomers],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 12, color: SUB }}>{label}</div>
              <div style={{ fontSize: 20, marginTop: 6, fontWeight: 500, color: POINT }}>{Number(val).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 14, fontWeight: 500 }}>고객 목록</div>
          {loading ? (
            <div style={{ padding: 20, fontSize: 13, color: SUB }}>불러오는 중…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: SUB, textAlign: 'left' }}>
                    {['고객명', '호르몬위상', '피부타입', '방문횟수', '마지막방문', '차트작성'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const phase = getPhaseFromCycleStart(cycleStartFromProfile(c.profile))
                    const skin = c.profile?.skin_type ? String(c.profile.skin_type) : '—'
                    return (
                      <tr key={c.key} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '12px' }}>{c.name}</td>
                        <td style={{ padding: '12px' }}>
                          <PhaseBadge phase={phase} />
                        </td>
                        <td style={{ padding: '12px' }}>{skin}</td>
                        <td style={{ padding: '12px' }}>{c.visitCount}회</td>
                        <td style={{ padding: '12px', color: SUB }}>{c.lastVisit || '—'}</td>
                        <td style={{ padding: '12px' }}>
                          <button
                            type="button"
                            onClick={() => void openPopup(c)}
                            style={{
                              ...btnStyle(false),
                              background: POINT,
                              color: '#fff',
                              border: 'none',
                              minHeight: 44,
                            }}
                          >
                            차트 작성
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {popupOpen && activeCustomer ? (
        <>
          <div
            role="presentation"
            onClick={closePopup}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.35)', zIndex: 100 }}
          />
          <div
            className="charts-v2-popup"
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              height: '100vh',
              width: 520,
              maxWidth: '100%',
              background: BG,
              zIndex: 110,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(26,26,46,0.12)',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{activeCustomer.name} — 차트 작성</div>
              <button
                type="button"
                onClick={closePopup}
                style={{ border: 'none', background: 'transparent', fontSize: 22, minWidth: 44, minHeight: 44, cursor: 'pointer', color: TEXT }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
              {/* 섹션 1 */}
              <section style={{ padding: '16px 0', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>고객 기본 정보</div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>※ 고객 입력 정보입니다 (수정 불가)</div>
                <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: SUB }}>생년월일 </span>
                    {profile?.birth_date ? String(profile.birth_date).slice(0, 10) : '—'}
                  </div>
                  <div>
                    <span style={{ color: SUB }}>자가진단 피부타입 </span>
                    {selfSkinType}
                  </div>
                  <div>
                    <span style={{ color: SUB }}>자가진단 피부고민 </span>
                    {selfConcerns}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: SUB }}>호르몬 위상</span>
                    <PhaseBadge phase={activePhase} />
                  </div>
                </div>
              </section>

              {/* 섹션 2 */}
              <section style={{ padding: '16px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>원장님 피부 진단</div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>피부타입</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {SKIN_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => setSkinTypes((p) => toggleInList(p, t))} style={btnStyle(skinTypes.includes(t))}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>피부고민</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {SKIN_CONCERNS.map((t) => (
                    <button key={t} type="button" onClick={() => setSkinConcerns((p) => toggleInList(p, t))} style={btnStyle(skinConcerns.includes(t))}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>호르몬 상태</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {HORMONE_STATUS.map((t) => (
                    <button key={t} type="button" onClick={() => setHormoneStatus(t)} style={btnStyle(hormoneStatus === t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>시술 경험</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {TREATMENT_EXP.map((t) => (
                    <button key={t} type="button" onClick={() => setTreatmentExperience((p) => toggleInList(p, t))} style={btnStyle(treatmentExperience.includes(t))}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>알레르기</div>
                <input
                  value={allergy}
                  onChange={(e) => setAllergy(e.target.value)}
                  placeholder="알레르기 성분 입력"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: 44,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    fontSize: 13,
                  }}
                />
              </section>

              {/* 섹션 3 */}
              <section style={{ padding: '16px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>오늘 시술 기록</div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>시술명</div>
                <input
                  value={treatmentName}
                  onChange={(e) => setTreatmentName(e.target.value)}
                  placeholder="시술명 입력"
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, marginBottom: 14, fontSize: 13 }}
                />
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>시술 부위</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {TREATMENT_AREAS.map((t) => (
                    <button key={t} type="button" onClick={() => setTreatmentAreas((p) => toggleInList(p, t))} style={btnStyle(treatmentAreas.includes(t))}>
                      {t}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>사용 제품</div>
                <input
                  value={productQ}
                  onChange={(e) => setProductQ(e.target.value)}
                  placeholder="브랜드명 / 제품명 검색"
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 13 }}
                />
                {productHits.length > 0 ? (
                  <div style={{ marginTop: 6, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                    {productHits.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (!selectedProducts.some((x) => x.id === p.id)) setSelectedProducts((prev) => [...prev, p])
                          setProductQ('')
                          setProductHits([])
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          border: 'none',
                          borderBottom: `1px solid ${BORDER}`,
                          background: BG,
                          minHeight: 44,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        {p.brand ? `[${p.brand}] ` : ''}
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 14 }}>
                  {selectedProducts.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 20,
                        background: '#EDE9F7',
                        color: POINT,
                        fontSize: 12,
                      }}
                    >
                      {p.name}
                      <button
                        type="button"
                        onClick={() => setSelectedProducts((prev) => prev.filter((x) => x.id !== p.id))}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: POINT, fontSize: 14 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>Before 사진</div>
                <input type="file" accept="image/*" multiple onChange={(e) => onPickFiles(e.target.files, 'before')} style={{ marginBottom: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                  {beforePreview.map((u, i) => (
                    <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>After 사진</div>
                <input type="file" accept="image/*" multiple onChange={(e) => onPickFiles(e.target.files, 'after')} style={{ marginBottom: 8 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                  {afterPreview.map((u, i) => (
                    <img key={i} src={u} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>피부 반응</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {SKIN_REACTIONS.map((t) => (
                    <button key={t} type="button" onClick={() => setSkinReaction(t)} style={btnStyle(skinReaction === t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reactionDetail}
                  onChange={(e) => setReactionDetail(e.target.value)}
                  rows={3}
                  placeholder="상세 메모"
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${BORDER}`, padding: 10, fontSize: 13, marginBottom: 14 }}
                />
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>원장님 메모</div>
                <textarea
                  value={adminMemo}
                  onChange={(e) => setAdminMemo(e.target.value)}
                  rows={3}
                  placeholder="내부 메모"
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${BORDER}`, padding: 10, fontSize: 13, marginBottom: 14 }}
                />
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>시술 금액</div>
                <input
                  type="number"
                  value={treatmentAmount}
                  onChange={(e) => setTreatmentAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, marginBottom: 14, fontSize: 13 }}
                />
                <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>
                  다음 방문 추천일 {nextVisitDate ? <span style={{ color: GOLD }}>(황금기 추천)</span> : null}
                </div>
                <input
                  type="date"
                  value={nextVisitDate}
                  onChange={(e) => setNextVisitDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 13 }}
                />
              </section>

              {/* 섹션 4 */}
              <section style={{ padding: '16px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>이전 시술 히스토리</div>
                {history.length === 0 ? (
                  <div style={{ fontSize: 13, color: SUB }}>기록 없음</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {history.map((h) => {
                      const hp = h.hormone_phase || '—'
                      const prods = Array.isArray(h.products_used)
                        ? (h.products_used as any[]).map((x) => x.name).filter(Boolean).join(', ')
                        : ''
                      const name = h.treatment_name || (h.treatment_items || []).join(', ')
                      return (
                        <div key={h.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13 }}>{String(h.treatment_date || '').slice(0, 10)}</span>
                            <PhaseBadge phase={String(hp)} />
                          </div>
                          <div style={{ fontSize: 13, marginTop: 6 }}>{name || '—'}</div>
                          {prods ? <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>{prods}</div> : null}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {(h.before_photos || []).slice(0, 1).map((u: string, i: number) => (
                              <img key={`b${i}`} src={u} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                            ))}
                            {(h.after_photos || []).slice(0, 1).map((u: string, i: number) => (
                              <img key={`a${i}`} src={u} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {history.length >= 5 && !historyExpanded ? (
                  <button type="button" onClick={() => void loadMoreHistory()} style={{ ...btnStyle(false), marginTop: 12, width: '100%' }}>
                    더보기
                  </button>
                ) : null}
              </section>
            </div>

            <div
              style={{
                position: 'fixed',
                bottom: 0,
                right: 0,
                width: 520,
                maxWidth: '100%',
                padding: '12px 16px',
                background: BG,
                borderTop: `1px solid ${BORDER}`,
                display: 'flex',
                gap: 10,
                zIndex: 120,
              }}
              className="charts-v2-popup"
            >
              <button type="button" onClick={saveDraftManual} style={{ ...btnStyle(false), flex: 1 }}>
                임시저장
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitChart()}
                style={{
                  ...btnStyle(true),
                  flex: 1,
                  background: POINT,
                  color: '#fff',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '저장 중…' : '저장 완료'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 24,
            background: POINT,
            color: '#fff',
            borderRadius: 12,
            padding: '12px 18px',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 200,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
