'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  parseCsvText,
  parseOwnerPointCsvRows,
  readCsvFile,
  type OwnerPointCsvRow,
} from '@/lib/csv/parseCsv'
const CARD = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GRADE_COLORS: Record<string, string> = {
  '메디슈티컬': '#E53935',
  '프리미엄전문점': '#C9A96E',
  '전문점': '#9C7FD4',
  '취급점': '#64B5F6',
}
interface OwnerRow {
  id: string
  name: string
  salon_name: string
  region: string
  grade: string
  arete: boolean
  last_order: string | null
  monthly: number
}
interface BrandOwnerLinkRow {
  id: string
  owner_id: string
  status: string
  approved_at: string | null
  name: string
  email: string
}
type PointImportRow = {
  line: number
  store_name: string
  amount: number
  memo: string | null
  status: 'success' | 'failed' | 'conflict'
  profile_id?: string
  owner_name?: string
  matched_store_name?: string
  candidates?: Array<{ profile_id: string; full_name: string; store_name: string }>
  error?: string
}

type PointImportSummary = {
  total: number
  success: number
  failed: number
  conflict: number
  inserted?: number
  skipped?: number
  apply_failed?: number
}

interface Props {
  brandId: string | null
  brandName: string
  authId: string | null
}
export default function BrandTabOwners({ brandId, brandName, authId }: Props) {
  const supabase = createClient()
  const [owners, setOwners] = useState<OwnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', salon_name: '', phone: '', region: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [autoApprove, setAutoApprove] = useState(false)
  const [autoApproveBusy, setAutoApproveBusy] = useState(false)
  const [linkRows, setLinkRows] = useState<BrandOwnerLinkRow[]>([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkSaving, setLinkSaving] = useState<string | null>(null)
  const [pointsBulkOpen, setPointsBulkOpen] = useState(false)
  const [pointsCsvRows, setPointsCsvRows] = useState<OwnerPointCsvRow[]>([])
  const [pointsPreview, setPointsPreview] = useState<PointImportRow[]>([])
  const [pointsSummary, setPointsSummary] = useState<PointImportSummary | null>(null)
  const [pointsBusy, setPointsBusy] = useState(false)
  const [pointsApplying, setPointsApplying] = useState(false)
  const [pointsMessage, setPointsMessage] = useState('')
  const [pointsFileKey, setPointsFileKey] = useState(0)
  const pointsBatchIdRef = useRef<string>(crypto.randomUUID())

  const loadBrandOwnerLinks = async () => {
    if (!brandId) {
      setLinkRows([])
      setAutoApprove(false)
      return
    }
    setLinkLoading(true)
    const { data: brandRow } = await supabase
      .from('brands')
      .select('auto_approve_owner_invite')
      .eq('id', brandId)
      .maybeSingle()
    setAutoApprove(Boolean((brandRow as { auto_approve_owner_invite?: boolean | null } | null)?.auto_approve_owner_invite))

    const { data: links } = await supabase
      .from('brand_owner_links')
      .select('id, owner_id, status, approved_at')
      .eq('brand_id', brandId)
      .order('approved_at', { ascending: false })

    const rows = (links || []) as { id: string; owner_id: string; status: string; approved_at: string | null }[]
    const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)))
    let userMap: Record<string, { name: string; email: string }> = {}
    if (ownerIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name, email').in('id', ownerIds)
      if (users) {
        for (const u of users as { id: string; name?: string | null; email?: string | null }[]) {
          userMap[u.id] = { name: u.name || '이름 없음', email: u.email || '—' }
        }
      }
    }
    setLinkRows(rows.map((r) => ({
      id: r.id,
      owner_id: r.owner_id,
      status: r.status || 'pending',
      approved_at: r.approved_at,
      name: userMap[r.owner_id]?.name || '이름 없음',
      email: userMap[r.owner_id]?.email || '—',
    })))
    setLinkLoading(false)
  }

  useEffect(() => {
    void loadBrandOwnerLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  useEffect(() => {
    const fetchOwners = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, owner_store_name, region, trade_brands, preferred_brands, arete_member, phone, last_order_at, monthly_order')
        .not('trade_brands', 'is', null)
      if (data) {
        const matched = data.filter((p: any) => {
          const brands = Array.isArray(p.trade_brands) && p.trade_brands.length > 0
            ? p.trade_brands
            : (Array.isArray(p.preferred_brands) ? p.preferred_brands : [])
          return brands.some((b: string) => b === brandName)
        })
        let gradeMap: Record<string, string> = {}
        if (brandId && matched.length > 0) {
          const { data: gradeRows } = await supabase
            .from('brand_owner_grades')
            .select('owner_id, grade')
            .eq('brand_id', brandId)
            .in('owner_id', matched.map((p: any) => p.id))
          if (gradeRows) {
            for (const row of gradeRows) gradeMap[row.owner_id] = row.grade
          }
        }
        setOwners(matched.map((p: any) => ({
          id: p.id,
          name: p.full_name || p.name || '이름 없음',
          salon_name: p.owner_store_name || '-',
          region: p.region || '-',
          grade: gradeMap[p.id] || '취급점',
          arete: p.arete_member || false,
          last_order: p.last_order_at || null,
          monthly: p.monthly_order || 0,
        })))
      }
      setLoading(false)
    }
    void fetchOwners()
  }, [brandId, brandName])
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const resetPointsImport = () => {
    setPointsCsvRows([])
    setPointsPreview([])
    setPointsSummary(null)
    setPointsMessage('')
    pointsBatchIdRef.current = crypto.randomUUID()
  }

  const requestPointsPreview = async (rows: OwnerPointCsvRow[]) => {
    if (!brandId) {
      setPointsMessage('브랜드 정보를 불러오는 중이에요')
      return
    }
    setPointsBusy(true)
    setPointsMessage('')
    try {
      const res = await fetch('/api/brand/owner-points/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          rows,
          dry_run: true,
          import_batch_id: pointsBatchIdRef.current,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setPointsPreview([])
        setPointsSummary(null)
        setPointsMessage(json.error || '미리보기에 실패했어요')
        return
      }
      setPointsPreview((json.rows || []) as PointImportRow[])
      setPointsSummary(json.summary as PointImportSummary)
      setPointsMessage(
        `미리보기 ${json.summary?.total || 0}건 · 성공 ${json.summary?.success || 0} · 실패 ${json.summary?.failed || 0} · 충돌 ${json.summary?.conflict || 0}`,
      )
    } catch {
      setPointsMessage('미리보기 요청에 실패했어요')
    } finally {
      setPointsBusy(false)
    }
  }

  const handlePointsCsvFile = async (file: File | undefined) => {
    setPointsFileKey((k) => k + 1)
    if (!file) return
    try {
      const text = await readCsvFile(file)
      const { headers, rows } = parseCsvText(text)
      const parsed = parseOwnerPointCsvRows(headers, rows)
      if (!parsed.ok) {
        resetPointsImport()
        setPointsMessage(parsed.error)
        return
      }
      setPointsCsvRows(parsed.rows)
      await requestPointsPreview(parsed.rows)
    } catch {
      resetPointsImport()
      setPointsMessage('CSV 파일을 읽지 못했어요')
    }
  }

  const applyPointsImport = async () => {
    if (!brandId || !pointsCsvRows.length || pointsApplying) return
    const successCount = pointsPreview.filter((r) => r.status === 'success').length
    if (successCount === 0) {
      setPointsMessage('적용할 성공 건이 없어요')
      return
    }
    setPointsApplying(true)
    setPointsMessage('')
    try {
      const res = await fetch('/api/brand/owner-points/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          rows: pointsCsvRows,
          dry_run: false,
          import_batch_id: pointsBatchIdRef.current,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setPointsMessage(json.error || '적용에 실패했어요')
        return
      }
      setPointsPreview((json.rows || []) as PointImportRow[])
      setPointsSummary(json.summary as PointImportSummary)
      setPointsMessage(
        `적용 완료 · 반영 ${json.summary?.inserted || 0}건 · 건너뜀 ${json.summary?.skipped || 0}건 · 실패 ${json.summary?.apply_failed || 0}건`,
      )
      showToast('적립금 CSV 적용 완료')
    } catch {
      setPointsMessage('적용 요청에 실패했어요')
    } finally {
      setPointsApplying(false)
    }
  }

  const pointRowStyle = (status: PointImportRow['status']) => {
    if (status === 'success') return { bg: 'rgba(76,175,80,0.08)', color: '#81c784', border: 'rgba(76,175,80,0.25)' }
    if (status === 'conflict') return { bg: 'rgba(255,193,7,0.08)', color: '#ffd54f', border: 'rgba(255,193,7,0.25)' }
    return { bg: 'rgba(244,67,54,0.08)', color: '#ef9a9a', border: 'rgba(244,67,54,0.25)' }
  }

  const linkStatusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'active') {
      return { label: '연결됨', color: PURPLE, bg: 'rgba(123,94,167,0.15)', border: 'rgba(123,94,167,0.35)' }
    }
    if (s === 'revoked') {
      return { label: '해제됨', color: SUB, bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' }
    }
    return { label: '승인대기', color: GOLD, bg: 'rgba(201,169,110,0.12)', border: 'rgba(201,169,110,0.35)' }
  }
  const copyInviteLink = async () => {
    if (!brandId) {
      showToast('브랜드 정보를 불러오는 중이에요')
      return
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.auran.kr'
    const url = `${origin}/signup/owner-v2?brand_id=${brandId}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('초대 링크가 복사됐어요')
    } catch {
      showToast('복사에 실패했어요')
    }
  }
  const toggleAutoApprove = async () => {
    if (!brandId || autoApproveBusy) return
    setAutoApproveBusy(true)
    const next = !autoApprove
    const { error } = await supabase.from('brands').update({ auto_approve_owner_invite: next }).eq('id', brandId)
    setAutoApproveBusy(false)
    if (error) {
      showToast('설정 저장에 실패했어요')
      return
    }
    setAutoApprove(next)
    showToast(next ? '신규 원장 자동승인 ON' : '신규 원장 자동승인 OFF')
  }
  const approveBrandLink = async (linkId: string) => {
    setLinkSaving(linkId)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('brand_owner_links')
      .update({ status: 'active', approved_at: now })
      .eq('id', linkId)
    setLinkSaving(null)
    if (error) {
      showToast('승인 처리에 실패했어요')
      return
    }
    setLinkRows((prev) => prev.map((r) => (r.id === linkId ? { ...r, status: 'active', approved_at: now } : r)))
    showToast('원장님 연결을 승인했어요')
  }
  const grades = ['all', '메디슈티컬', '프리미엄전문점', '전문점', '취급점']
  const filtered = owners.filter(o => {
    const matchGrade = filter === 'all' || o.grade === filter
    const matchSearch = !search || o.name.includes(search) || o.salon_name.includes(search)
    return matchGrade && matchSearch
  })
  const updateGrade = async (ownerId: string, grade: string) => {
    if (!brandId) return
    setSaving(ownerId + '_grade')
    await supabase.from('brand_owner_grades').upsert(
      { brand_id: brandId, owner_id: ownerId, grade },
      { onConflict: 'brand_id,owner_id' }
    )
    setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, grade } : o))
    setSaving(null)
  }
  const toggleArete = async (ownerId: string, current: boolean) => {
    setSaving(ownerId + '_arete')
    const next = !current
    await supabase.from('profiles').update({ arete_member: next }).eq('id', ownerId)
    if (next && brandId) {
      await supabase.from('brand_arete_members').upsert({
        brand_id: brandId,
        owner_id: ownerId,
        status: 'active',
        started_at: new Date().toISOString(),
      }, { onConflict: 'brand_id,owner_id' })
      await supabase.from('brand_points').upsert({
        brand_id: brandId,
        owner_id: ownerId,
        track: 'B',
        balance: 500000,
        total_earned: 500000,
      }, { onConflict: 'brand_id,owner_id,track' })
    } else if (!next && brandId) {
      await supabase.from('brand_arete_members').update({ status: 'cancelled' })
        .eq('brand_id', brandId).eq('owner_id', ownerId)
    }
    setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, arete: next } : o))
    setSaving(null)
  }
  const addOwner = async () => {
    if (!addForm.name || !addForm.salon_name) return
    setAddSaving(true)
    const { data } = await supabase.from('profiles').insert({
      full_name: addForm.name,
      owner_store_name: addForm.salon_name,
      phone: addForm.phone,
      region: addForm.region,
      role: 'owner',
      trade_brands: [brandName],
    }).select().single()
    if (data) setOwners(prev => [...prev, {
      id: data.id, name: addForm.name, salon_name: addForm.salon_name,
      region: addForm.region, grade: '', arete: false,
      last_order: null, monthly: 0,
    }])
    setAddForm({ name: '', salon_name: '', phone: '', region: '' })
    setShowAddForm(false)
    setAddSaving(false)
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ ...CARD, marginBottom: 10 }}>
        <button
          type="button"
          disabled={!brandId}
          onClick={() => {
            setPointsBulkOpen((v) => {
              const next = !v
              if (!next) resetPointsImport()
              return next
            })
          }}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: `0.5px solid ${PURPLE}`,
            background: pointsBulkOpen ? 'rgba(123,94,167,0.2)' : 'rgba(123,94,167,0.1)',
            color: '#c4a8f0',
            fontSize: 12,
            cursor: brandId ? 'pointer' : 'not-allowed',
            opacity: brandId ? 1 : 0.5,
          }}
        >
          📥 적립금 CSV 업로드
        </button>

        {pointsBulkOpen && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${BORDER}` }}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 8, lineHeight: 1.5 }}>
              CSV 헤더: 매장명, 금액, 메모(선택) · 회사(company) 단위 트랙A 연결 원장만 매칭
            </div>

            <input
              key={pointsFileKey}
              type="file"
              accept=".csv,text/csv"
              disabled={pointsBusy || pointsApplying}
              onChange={(e) => void handlePointsCsvFile(e.target.files?.[0])}
              style={{ fontSize: 11, color: TEXT, width: '100%' }}
            />

            {pointsMessage ? (
              <div style={{ marginTop: 8, fontSize: 11, color: SUB }}>{pointsMessage}</div>
            ) : null}

            {pointsPreview.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 260, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: SUB, textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>행</th>
                      <th style={{ padding: '4px 6px' }}>매장명</th>
                      <th style={{ padding: '4px 6px' }}>금액</th>
                      <th style={{ padding: '4px 6px' }}>상태</th>
                      <th style={{ padding: '4px 6px' }}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsPreview.map((row) => {
                      const tone = pointRowStyle(row.status)
                      const statusLabel =
                        row.status === 'success' ? '성공'
                          : row.status === 'conflict' ? '충돌'
                            : '실패'
                      const note =
                        row.status === 'success'
                          ? `${row.owner_name || ''}${row.matched_store_name ? ` (${row.matched_store_name})` : ''}`
                          : row.status === 'conflict'
                            ? (row.candidates || []).map((c) => c.full_name).join(', ')
                            : (row.error || '')
                      return (
                        <tr
                          key={`${row.line}-${row.store_name}`}
                          style={{ background: tone.bg, borderBottom: `0.5px solid ${tone.border}` }}
                        >
                          <td style={{ padding: '6px', color: tone.color }}>{row.line}</td>
                          <td style={{ padding: '6px', color: TEXT }}>{row.store_name}</td>
                          <td style={{ padding: '6px', color: TEXT }}>{row.amount.toLocaleString()}T</td>
                          <td style={{ padding: '6px', color: tone.color, fontWeight: 600 }}>{statusLabel}</td>
                          <td style={{ padding: '6px', color: SUB }}>{note}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                disabled={pointsApplying || pointsBusy || !pointsPreview.some((r) => r.status === 'success')}
                onClick={() => void applyPointsImport()}
                style={{
                  fontSize: 11,
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `0.5px solid ${PURPLE}`,
                  background: 'rgba(123,94,167,0.2)',
                  color: '#c4a8f0',
                  cursor: pointsApplying ? 'wait' : 'pointer',
                  opacity: pointsApplying ? 0.6 : 1,
                }}
              >
                {pointsApplying ? '적용 중...' : `적용 (${pointsSummary?.success || 0}건)`}
              </button>
              {pointsSummary ? (
                <span style={{ fontSize: 11, color: SUB }}>
                  총 {pointsSummary.total} · 성공 {pointsSummary.success} · 실패 {pointsSummary.failed} · 충돌 {pointsSummary.conflict}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <div style={{ ...CARD, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {grades.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setFilter(g)}
              style={{ fontSize: 11, padding: '3px 12px', borderRadius: 20, border: `0.5px solid ${filter === g ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: filter === g ? 'rgba(123,94,167,0.2)' : 'transparent', color: filter === g ? '#c4a7e7' : SUB, cursor: 'pointer' }}
            >
              {g === 'all' ? `전체 (${owners.length})` : g}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="원장님 이름 또는 살롱명 검색"
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: TEXT, outline: 'none' }}
        />
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>제휴 원장 초대</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: TEXT }}>신규 원장 자동승인</span>
          <button
            type="button"
            disabled={!brandId || autoApproveBusy}
            onClick={() => void toggleAutoApprove()}
            style={{
              fontSize: 11,
              padding: '5px 14px',
              borderRadius: 20,
              border: `0.5px solid ${autoApprove ? GOLD : 'rgba(255,255,255,0.15)'}`,
              background: autoApprove ? 'rgba(201,169,110,0.15)' : 'transparent',
              color: autoApprove ? GOLD : SUB,
              cursor: !brandId || autoApproveBusy ? 'not-allowed' : 'pointer',
              opacity: autoApproveBusy ? 0.6 : 1,
            }}
          >
            {autoApproveBusy ? '저장 중...' : autoApprove ? 'ON' : 'OFF'}
          </button>
        </div>
        <button
          type="button"
          disabled={!brandId}
          onClick={() => void copyInviteLink()}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: `0.5px solid ${PURPLE}`,
            background: 'rgba(123,94,167,0.1)',
            color: '#c4a8f0',
            fontSize: 12,
            cursor: brandId ? 'pointer' : 'not-allowed',
            opacity: brandId ? 1 : 0.5,
          }}
        >
          초대 링크 복사
        </button>
        <div style={{ marginTop: 8, fontSize: 10, color: SUB, lineHeight: 1.5 }}>
          링크로 가입한 원장님은 아래 제휴 연결 목록에 표시돼요.
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>제휴 연결 원장 ({linkRows.length})</div>
        {linkLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : linkRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 13, lineHeight: 1.7 }}>
            아직 제휴 링크로 가입한 원장님이 없어요.<br />
            초대 링크를 공유해보세요.
          </div>
        ) : (
          linkRows.map((row, i) => {
            const badge = linkStatusBadge(row.status)
            return (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < linkRows.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, color: TEXT }}>{row.name}</span>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: badge.bg, color: badge.color, border: `0.5px solid ${badge.border}` }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: SUB, fontFamily: "'JetBrains Mono', monospace" }}>{row.email}</div>
                </div>
                {row.status.toLowerCase() === 'pending' ? (
                  <button
                    type="button"
                    disabled={linkSaving === row.id}
                    onClick={() => void approveBrandLink(row.id)}
                    style={{
                      fontSize: 11,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `0.5px solid ${PURPLE}`,
                      background: 'rgba(123,94,167,0.2)',
                      color: '#c4a8f0',
                      cursor: linkSaving === row.id ? 'wait' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {linkSaving === row.id ? '처리 중...' : '승인'}
                  </button>
                ) : null}
              </div>
            )
          })
        )}
      </div>
      <div style={CARD}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 13, lineHeight: 1.7 }}>
            아직 연결된 원장님이 없어요.<br />
            레퍼럴 링크를 공유해 원장님을 초대해보세요.
          </div>
        ) : (
          filtered.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < filtered.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(123,94,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                🌸
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{o.name}</span>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${GRADE_COLORS[o.grade] || PURPLE}22`, color: GRADE_COLORS[o.grade] || PURPLE, border: `0.5px solid ${GRADE_COLORS[o.grade] || PURPLE}55` }}>
                    {o.grade}
                  </span>
                  {o.arete && (
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(201,169,110,0.1)', color: GOLD, border: '0.5px solid rgba(201,169,110,0.3)' }}>
                      아레테
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>{o.salon_name} · {o.region}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, flexShrink: 0, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['메디슈티컬', '프리미엄전문점', '전문점', '취급점'].map(g => (
                    <button key={g} type="button" onClick={() => updateGrade(o.id, g)}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: `0.5px solid ${o.grade === g ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: o.grade === g ? 'rgba(123,94,167,0.25)' : 'transparent', color: o.grade === g ? '#c4a8f0' : SUB, cursor: 'pointer', opacity: saving === o.id + '_grade' ? 0.5 : 1 }}>
                      {g === '메디슈티컬' ? '메디' : g === '프리미엄전문점' ? '프리미엄' : g === '전문점' ? '전문점' : '취급점'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => toggleArete(o.id, o.arete)}
                    style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, border: `0.5px solid ${o.arete ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.1)'}`, background: o.arete ? 'rgba(201,169,110,0.15)' : 'transparent', color: o.arete ? GOLD : SUB, cursor: 'pointer', opacity: saving === o.id + '_arete' ? 0.5 : 1 }}>
                    {o.arete ? '아레테 ON' : '아레테 OFF'}
                  </button>
                  <button type="button" onClick={() => showToast(`${o.name} 오렌톡 발송!`)}
                    style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', cursor: 'pointer' }}>
                    오렌톡
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => setShowAddForm(!showAddForm)}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a8f0', fontSize: 12, cursor: 'pointer' }}>
          + 수기 원장님 등록
        </button>
      </div>
      {showAddForm && (
        <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>수기 원장님 등록</div>
          {[
            { key: 'name', placeholder: '원장님 이름 *' },
            { key: 'salon_name', placeholder: '살롱명 *' },
            { key: 'phone', placeholder: '연락처' },
            { key: 'region', placeholder: '지역 (예: 서울 강남구)' },
          ].map(f => (
            <input key={f.key} value={addForm[f.key as keyof typeof addForm]} onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={{ width: '100%', marginBottom: 6, padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12 }} />
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setShowAddForm(false)}
              style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
              취소
            </button>
            <button type="button" onClick={addOwner} disabled={addSaving}
              style={{ flex: 2, padding: '8px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
              {addSaving ? '등록 중...' : '등록 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
