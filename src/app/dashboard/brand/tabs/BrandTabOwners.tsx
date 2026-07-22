'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import OwnerOrenTalkButton from '../components/OwnerOrenTalkButton'
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
  point_balance: number
}
type CsvRowResult = {
  line: number
  store_name: string
  amount?: number
  status: 'ok' | 'skipped' | 'no_match' | 'conflict' | 'error'
  reason?: string
  owner_id?: string
  matched_owner_name?: string
  matched_store_name?: string
  conflict_owners?: { profile_id: string; owner_store_name: string; owner_name: string }[]
}
type BulkImportResult = {
  imported: number
  skipped: number
  failed: number
  conflicts: number
  dry_run: boolean
  eligible_owners?: number
  results?: CsvRowResult[]
}
interface BrandOwnerLinkRow {
  id: string
  owner_id: string
  status: string
  approved_at: string | null
  name: string
  email: string
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
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [pointBalances, setPointBalances] = useState<Record<string, number>>({})
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvDryRun, setCsvDryRun] = useState(true)
  const [csvResult, setCsvResult] = useState<BulkImportResult | null>(null)
  const [hasManualInit, setHasManualInit] = useState(false)
  const [initLedgerLoading, setInitLedgerLoading] = useState(true)
  const [showCsvReupload, setShowCsvReupload] = useState(false)

  const checkManualInitExists = async (cid: string) => {
    setInitLedgerLoading(true)
    const { count, error } = await supabase
      .from('brand_owner_point_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', cid)
      .eq('type', 'manual_init')
    setHasManualInit(!error && (count ?? 0) > 0)
    setInitLedgerLoading(false)
  }

  const loadPointBalances = async () => {
    if (!brandId) {
      setCompanyId(null)
      setPointBalances({})
      setHasManualInit(false)
      setInitLedgerLoading(false)
      return
    }
    const { data: brandRow } = await supabase
      .from('brands')
      .select('company_id')
      .eq('id', brandId)
      .maybeSingle()
    const cid = (brandRow as { company_id?: string | null } | null)?.company_id
    if (!cid) {
      setCompanyId(null)
      setPointBalances({})
      setHasManualInit(false)
      setInitLedgerLoading(false)
      return
    }
    const cidStr = String(cid)
    setCompanyId(cidStr)
    const [{ data: rows }] = await Promise.all([
      supabase
        .from('brand_owner_point_balance')
        .select('owner_id, balance')
        .eq('company_id', cidStr),
      checkManualInitExists(cidStr),
    ])
    const map: Record<string, number> = {}
    for (const r of (rows || []) as { owner_id: string; balance: number }[]) {
      map[r.owner_id] = Math.trunc(Number(r.balance) || 0)
    }
    setPointBalances(map)
  }

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
    void loadPointBalances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  useEffect(() => {
    setShowCsvReupload(false)
    setCsvResult(null)
  }, [brandId])

  useEffect(() => {
    const fetchOwners = async () => {
      setLoading(true)
      if (!brandId) {
        setOwners([])
        setLoading(false)
        return
      }

      // brand_owner_links.owner_id = users.id → auth_id → profiles (bulk-import 패턴)
      const { data: activeLinks } = await supabase
        .from('brand_owner_links')
        .select('owner_id')
        .eq('brand_id', brandId)
        .eq('status', 'active')

      const linkedUserIds = Array.from(
        new Set((activeLinks || []).map((r: { owner_id: string }) => String(r.owner_id)).filter(Boolean)),
      )
      if (linkedUserIds.length === 0) {
        setOwners([])
        setLoading(false)
        return
      }

      const { data: userRows } = await supabase
        .from('users')
        .select('id, auth_id')
        .in('id', linkedUserIds)
        .eq('role', 'owner')

      const authIds = Array.from(
        new Set((userRows || []).map((u: { auth_id?: string | null }) => String(u.auth_id || '')).filter(Boolean)),
      )
      if (authIds.length === 0) {
        setOwners([])
        setLoading(false)
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, owner_store_name, region, arete_member, phone, last_order_at, monthly_order')
        .in('auth_id', authIds)

      const matched = profiles || []
      let gradeMap: Record<string, string> = {}
      if (matched.length > 0) {
        const { data: gradeRows } = await supabase
          .from('brand_owner_grades')
          .select('owner_id, grade')
          .eq('brand_id', brandId)
          .in('owner_id', matched.map((p: { id: string }) => p.id))
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
        point_balance: pointBalances[p.id] ?? 0,
      })))
      setLoading(false)
    }
    void fetchOwners()
  }, [brandId, pointBalances])
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const csvRowStyle = (status: CsvRowResult['status']) => {
    if (status === 'ok') {
      return { color: '#81c784', bg: 'rgba(129,199,132,0.12)', label: '매칭성공' }
    }
    if (status === 'conflict') {
      return { color: '#ffb74d', bg: 'rgba(255,183,77,0.12)', label: '충돌' }
    }
    if (status === 'skipped') {
      return { color: SUB, bg: 'rgba(255,255,255,0.05)', label: '스킵' }
    }
    if (status === 'no_match') {
      return { color: '#f48fb1', bg: 'rgba(244,143,177,0.12)', label: '매칭실패' }
    }
    return { color: '#f48fb1', bg: 'rgba(244,143,177,0.12)', label: '오류' }
  }
  const downloadCsvTemplate = () => {
    const sample = '매장명,금액,메모\n스킨파우더룸,10000,초기 적립\n'
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'owner_points_init_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const runCsvBulkImport = async (file: File, dryRun: boolean) => {
    if (!brandId) {
      showToast('브랜드 정보를 불러오는 중이에요')
      return
    }
    setCsvBusy(true)
    setCsvResult(null)
    try {
      const csv = await file.text()
      const res = await fetch('/api/brand/owner-points/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, csv, dry_run: dryRun }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        showToast(json.error === 'company_id_not_configured'
          ? 'company_id가 없어요. 093 백필 먼저 실행해주세요'
          : (json.error || '업로드 실패'))
        return
      }
      setCsvResult({
        imported: json.imported ?? 0,
        skipped: json.skipped ?? 0,
        failed: json.failed ?? 0,
        conflicts: json.conflicts ?? 0,
        dry_run: Boolean(json.dry_run),
        eligible_owners: json.eligible_owners,
        results: json.results,
      })
      if (!dryRun) {
        await loadPointBalances()
        if (companyId) await checkManualInitExists(companyId)
        if ((json.imported ?? 0) > 0) {
          setShowCsvReupload(false)
        }
        showToast(`적립 반영 완료 (${json.imported}건)`)
      } else {
        showToast(`미리보기 완료 — 반영 가능 ${json.imported}건`)
      }
    } catch {
      showToast('업로드 중 오류가 났어요')
    } finally {
      setCsvBusy(false)
    }
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
      last_order: null, monthly: 0, point_balance: 0,
    }])
    setAddForm({ name: '', salon_name: '', phone: '', region: '' })
    setShowAddForm(false)
    setAddSaving(false)
  }

  const renderCsvUploadPanel = (placement: 'primary' | 'footer') => {
    const isFooter = placement === 'footer'
    const wrapStyle = isFooter
      ? { marginTop: 8, padding: 12, borderRadius: 8, border: `0.5px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }
      : CARD

    return (
      <div style={wrapStyle}>
        {!isFooter ? (
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>초기 적립금(T) CSV 대량 업로드</div>
        ) : null}
        {!companyId ? (
          <div style={{ fontSize: 11, color: SUB, lineHeight: 1.6, marginBottom: 10 }}>
            회사(company_id)가 아직 연결되지 않았어요. 093 마이그레이션 + 백필 스크립트 실행 후 이용할 수 있어요.
          </div>
        ) : !isFooter ? (
          <div style={{ fontSize: 10, color: SUB, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
            company_id: {companyId.slice(0, 8)}…
          </div>
        ) : null}
        <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6, marginBottom: 10 }}>
          CSV 헤더: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: GOLD }}>매장명, 금액, 메모(선택)</span>
          <br />
          트랙A + active 제휴 연결 원장의 매장명(owner_store_name)으로 자동 매칭돼요.
          <br />
          먼저 검증만(dry-run)으로 미리보기 후, 성공 건만 실제 반영하세요.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, border: `0.5px solid ${GOLD}`, background: 'rgba(201,169,110,0.1)', color: GOLD, cursor: 'pointer' }}
          >
            샘플 CSV
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT, cursor: 'pointer' }}>
            <input type="checkbox" checked={csvDryRun} onChange={(e) => setCsvDryRun(e.target.checked)} />
            검증만 (dry-run)
          </label>
        </div>
        <label
          style={{
            display: 'block',
            width: '100%',
            padding: '10px',
            borderRadius: 8,
            border: `0.5px dashed ${PURPLE}`,
            background: 'rgba(123,94,167,0.08)',
            color: '#c4a8f0',
            fontSize: 12,
            textAlign: 'center',
            cursor: !brandId || csvBusy || !companyId ? 'not-allowed' : 'pointer',
            opacity: !brandId || !companyId ? 0.5 : 1,
          }}
        >
          {csvBusy ? '처리 중...' : 'CSV 파일 선택'}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={!brandId || csvBusy || !companyId}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void runCsvBulkImport(f, csvDryRun)
              e.target.value = ''
            }}
          />
        </label>
        {csvResult ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: TEXT, marginBottom: 8, lineHeight: 1.7 }}>
              {csvResult.dry_run ? '미리보기' : '반영'} —
              성공 {csvResult.imported} · 스킵 {csvResult.skipped} · 실패 {csvResult.failed}
              {csvResult.conflicts > 0 ? ` · 충돌 ${csvResult.conflicts}` : ''}
              {csvResult.eligible_owners != null ? (
                <span style={{ color: SUB }}> (매칭 대상 원장 {csvResult.eligible_owners}명)</span>
              ) : null}
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: `0.5px solid ${BORDER}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', color: SUB }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>행</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>CSV 매장명</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>금액</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>상태</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>매칭 원장</th>
                  </tr>
                </thead>
                <tbody>
                  {(csvResult.results || []).map((r) => {
                    const badge = csvRowStyle(r.status)
                    const matchedLabel =
                      r.status === 'ok' || r.status === 'skipped'
                        ? `${r.matched_owner_name || '—'} (${r.matched_store_name || r.store_name})`
                        : r.status === 'conflict'
                          ? (r.conflict_owners || [])
                              .map((c) => `${c.owner_name}(${c.owner_store_name})`)
                              .join(' / ')
                          : r.reason || '—'
                    return (
                      <tr key={r.line} style={{ background: badge.bg, borderTop: `0.5px solid ${BORDER}` }}>
                        <td style={{ padding: '6px 8px', color: TEXT }}>{r.line}</td>
                        <td style={{ padding: '6px 8px', color: TEXT }}>{r.store_name || '—'}</td>
                        <td style={{ padding: '6px 8px', color: TEXT, textAlign: 'right' }}>
                          {r.amount != null ? r.amount.toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '6px 8px', color: badge.color }}>{badge.label}</td>
                        <td style={{ padding: '6px 8px', color: badge.color, lineHeight: 1.5 }}>{matchedLabel}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const showCsvAtTop = !initLedgerLoading && !hasManualInit

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
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
      {showCsvAtTop ? renderCsvUploadPanel('primary') : null}
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
                {companyId ? (
                  <div style={{ fontSize: 10, color: GOLD, marginTop: 2 }}>
                    T {o.point_balance.toLocaleString()}
                  </div>
                ) : null}
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
                  <OwnerOrenTalkButton brandId={brandId} ownerId={o.id} ownerName={o.name} />
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
      {!initLedgerLoading && hasManualInit && companyId ? (
        <div style={{ marginTop: 14, paddingTop: 4, textAlign: 'right' }}>
          {!showCsvReupload ? (
            <button
              type="button"
              onClick={() => setShowCsvReupload(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 10,
                color: SUB,
                textDecoration: 'underline',
                cursor: 'pointer',
                opacity: 0.75,
              }}
            >
              초기 적립금 CSV 재업로드
            </button>
          ) : (
            <div style={{ textAlign: 'left' }}>
              {renderCsvUploadPanel('footer')}
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => { setShowCsvReupload(false); setCsvResult(null) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 10,
                    color: SUB,
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
