'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const HQ_PAID = ['결제완료', '배송완료', '구매확정'] as const

type HqOrder = {
  id: string
  status: string
  final_amount: number
  ordered_at: string | null
  created_at: string
  owner_name: string | null
  salon_name: string | null
  brand_id: string
  profile_id: string
}

type LedgerRow = {
  id: string
  sponsor_owner_id: string
  buyer_owner_id: string
  brand_id: string
  commission_amount: number
  commission_rate: number
  status: string
  created_at: string
  paid_at: string | null
  source_order_id: string | null
}

type OrderItemLite = { name?: string; qty?: number; bonus?: number }

type SponsorDetailLine = {
  ledger_id: string
  source_order_id: string
  buyer_name: string
  commission_rate: number
  commission_amount: number
  order_status: string
  final_amount: number
  products: Array<{ name: string; qty: number; bonus: number }>
}

type SponsorAgg = {
  sponsor_owner_id: string
  name: string
  grade: string
  pending_amount: number
  paid_amount: number
  pending_count: number
  bank_name?: string
  bank_account?: string
  bank_holder?: string
}

type TrackASalonAgg = {
  salon_id: string
  owner_name: string
  salon_name: string
  pending_count: number
  pending_amount: number
  pending_ids: Array<{ id: string; source: 'bpo' | 'purchase_session' }>
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 계좌번호 마스킹: 앞 최대 3자리 + 가운데 * + 뒤 4자리 */
function maskAccount(acc: string) {
  const raw = String(acc || '').replace(/\s/g, '')
  if (!raw) return ''
  if (raw.length <= 4) return raw
  if (raw.length <= 8) return `${'*'.repeat(raw.length - 4)}${raw.slice(-4)}`
  const head = raw.slice(0, 3)
  const mid = '*'.repeat(raw.length - 7)
  return `${head}${mid}${raw.slice(-4)}`
}

function formatSponsorBank(
  s: Pick<SponsorAgg, 'bank_name' | 'bank_account' | 'bank_holder'>,
  reveal?: boolean,
) {
  const name = String(s.bank_name || '').trim()
  const rawAcc = String(s.bank_account || '').trim()
  const account = reveal ? rawAcc : maskAccount(rawAcc)
  const holder = String(s.bank_holder || '').trim()
  if (!name && !account) return '계좌 미등록'
  const parts = [name, account].filter(Boolean)
  if (holder) parts.push(`(${holder})`)
  return parts.join(' ')
}

function monthStartIso() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function AdminTrackBSystemPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<HqOrder[]>([])
  const [ledgers, setLedgers] = useState<LedgerRow[]>([])
  const [sponsorAgg, setSponsorAgg] = useState<SponsorAgg[]>([])
  const [trend, setTrend] = useState<Array<{ label: string; amount: number }>>([])
  const [kpi, setKpi] = useState({ monthSales: 0, pendingCommission: 0, activeSponsors: 0, monthOrders: 0 })
  const [trackAKpi, setTrackAKpi] = useState({ pendingTotal: 0, settledTotal: 0, pendingSalonCount: 0 })
  const [trackASalonAgg, setTrackASalonAgg] = useState<TrackASalonAgg[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('전체')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [revealedAccounts, setRevealedAccounts] = useState<Set<string>>(new Set())
  const [settlementBatches, setSettlementBatches] = useState<Array<{ id: string; batch_seq: number; period_start: string; period_end: string; item_count: number; total_amount: number }>>([])
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [batchDetailRows, setBatchDetailRows] = useState<Array<{ id: string; sponsor_owner_id: string; buyer_owner_id: string; commission_amount: number }>>([])
  const [batchOwnerNames, setBatchOwnerNames] = useState<Record<string, string>>({})
  const [batchDetailLoading, setBatchDetailLoading] = useState(false)
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [detailBySponsor, setDetailBySponsor] = useState<Record<string, SponsorDetailLine[]>>({})
  const [selectedLedgerIds, setSelectedLedgerIds] = useState<Record<string, Set<string>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    setDetailBySponsor({})
    void supabase
      .from('hq_settlement_batches')
      .select('id, batch_seq, period_start, period_end, item_count, total_amount')
      .eq('settlement_type', 'sponsor_commission')
      .order('batch_seq', { ascending: false })
      .limit(12)
      .then(({ data }) => setSettlementBatches(data || []))
    setDetailOpenId(null)
    setDetailLoadingId(null)
    setSelectedLedgerIds({})
    const thisMonthIso = monthStartIso()
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 29)
    const sinceIso = since.toISOString()

    const [{ data: orderRows }, { data: ledgerRows }, { data: trendRows }] = await Promise.all([
      supabase
        .from('hq_stock_orders')
        .select('id, status, final_amount, ordered_at, created_at, brand_id, profile_id')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('hq_commission_ledger')
        .select('id, sponsor_owner_id, buyer_owner_id, brand_id, commission_amount, commission_rate, status, created_at, paid_at, source_order_id')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('hq_stock_orders')
        .select('final_amount, ordered_at, created_at, status')
        .in('status', [...HQ_PAID])
        .gte('created_at', sinceIso),
    ])

    const { data: salonAggData, error: salonAggError } = await supabase.rpc('get_salon_store_pending_by_salon')
    const { data: settledTotalData } = await supabase.rpc('get_salon_store_settled_total')

    // 트랙B: profile_id → profiles.auth_id → users.name / users.id → salons.name
    const rawHqOrders = orderRows || []
    const hqProfileIds = Array.from(
      new Set(rawHqOrders.map((o: { profile_id?: string }) => String(o.profile_id || '')).filter(Boolean)),
    )
    const profileIdToAuthId: Record<string, string> = {}
    const authIdToUserName: Record<string, string> = {}
    const authIdToUserId: Record<string, string> = {}
    const userIdToSalonName: Record<string, string> = {}
    if (hqProfileIds.length) {
      const { data: profRows } = await supabase
        .from('profiles')
        .select('id, auth_id')
        .in('id', hqProfileIds)
      for (const p of profRows || []) {
        if (p.id && p.auth_id) profileIdToAuthId[String(p.id)] = String(p.auth_id)
      }
      const authIds = Array.from(new Set(Object.values(profileIdToAuthId)))
      if (authIds.length) {
        const { data: userRows } = await supabase
          .from('users')
          .select('id, auth_id, name')
          .in('auth_id', authIds)
        for (const u of userRows || []) {
          const aid = String((u as { auth_id?: string }).auth_id || '')
          if (!aid) continue
          authIdToUserName[aid] = String((u as { name?: string }).name || '원장')
          authIdToUserId[aid] = String(u.id)
        }
        const userIds = Array.from(new Set(Object.values(authIdToUserId)))
        if (userIds.length) {
          const { data: salonRows } = await supabase
            .from('salons')
            .select('owner_id, name')
            .in('owner_id', userIds)
          for (const s of salonRows || []) {
            const oid = String((s as { owner_id?: string }).owner_id || '')
            if (oid) userIdToSalonName[oid] = String((s as { name?: string }).name || '')
          }
        }
      }
    }

    const ordersList = rawHqOrders.map((o: any) => {
      const pid = String(o.profile_id || '')
      const authId = profileIdToAuthId[pid] || ''
      const userId = authId ? authIdToUserId[authId] || '' : ''
      return {
        id: o.id,
        status: o.status,
        final_amount: o.final_amount,
        ordered_at: o.ordered_at,
        created_at: o.created_at,
        brand_id: o.brand_id,
        profile_id: pid,
        owner_name: (authId && authIdToUserName[authId]) || '원장',
        salon_name: (userId && userIdToSalonName[userId]) || null,
      } as HqOrder
    })
    const ledgersList = (ledgerRows || []) as LedgerRow[]
    setOrders(ordersList)
    setLedgers(ledgersList)

    const monthSales = ordersList
      .filter((o) => {
        if (!HQ_PAID.includes(o.status as (typeof HQ_PAID)[number])) return false
        const ts = o.ordered_at || o.created_at
        return ts && ts >= thisMonthIso
      })
      .reduce((s, o) => s + Math.trunc(Number(o.final_amount) || 0), 0)

    const monthOrders = ordersList.filter((o) => {
      if (!HQ_PAID.includes(o.status as (typeof HQ_PAID)[number])) return false
      const ts = o.ordered_at || o.created_at
      return ts && ts >= thisMonthIso
    }).length

    const pendingCommission = ledgersList
      .filter((l) => l.status === 'pending')
      .reduce((s, l) => s + Math.trunc(Number(l.commission_amount) || 0), 0)

    const activeSponsors = new Set(
      ledgersList.filter((l) => l.status === 'pending' || l.status === 'paid').map((l) => l.sponsor_owner_id),
    ).size

    setKpi({ monthSales, pendingCommission, activeSponsors, monthOrders })

    const byDay: Record<string, number> = {}
    for (const o of trendRows || []) {
      const ts = (o as { ordered_at?: string; created_at?: string }).ordered_at
        || (o as { created_at?: string }).created_at
      if (!ts) continue
      const k = dayKey(ts)
      byDay[k] = (byDay[k] || 0) + Math.trunc(Number((o as { final_amount?: number }).final_amount) || 0)
    }
    const trendOut: Array<{ label: string; amount: number }> = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      trendOut.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, amount: byDay[k] || 0 })
    }
    setTrend(trendOut)

    const sponsorIds = Array.from(new Set(ledgersList.map((l) => l.sponsor_owner_id)))
    const nameById: Record<string, string> = {}
    const bankById: Record<string, { bank_name: string; bank_account: string; bank_holder: string }> = {}
    const gradeByKey: Record<string, string> = {}
    const companyByBrand: Record<string, string> = {}
    if (sponsorIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, owner_bank_name, owner_bank_account, owner_bank_holder')
        .in('id', sponsorIds)
      for (const p of profiles || []) {
        const pid = String(p.id)
        nameById[pid] = String((p as { full_name?: string }).full_name || '스폰서')
        bankById[pid] = {
          bank_name: String((p as { owner_bank_name?: string | null }).owner_bank_name || ''),
          bank_account: String((p as { owner_bank_account?: string | null }).owner_bank_account || ''),
          bank_holder: String((p as { owner_bank_holder?: string | null }).owner_bank_holder || ''),
        }
      }
      const brandIds = Array.from(new Set(ledgersList.map((l) => l.brand_id)))
      const { data: brandRows } = await supabase
        .from('brands')
        .select('id, company_id')
        .in('id', brandIds)
      for (const b of brandRows || []) {
        const bid = String((b as { id: string }).id)
        const cid = String((b as { company_id?: string | null }).company_id || '')
        if (bid && cid) companyByBrand[bid] = cid
      }
      const companyIds = Array.from(new Set(Object.values(companyByBrand)))
      if (companyIds.length) {
        const { data: grades } = await supabase
          .from('brand_owner_grades')
          .select('owner_id, company_id, grade')
          .in('owner_id', sponsorIds)
          .in('company_id', companyIds)
          .eq('origin_track', 'B')
        for (const g of grades || []) {
          gradeByKey[`${g.owner_id}:${g.company_id}`] = String(g.grade || '-')
        }
      }
    }

    const aggMap: Record<string, SponsorAgg> = {}
    for (const l of ledgersList) {
      const key = l.sponsor_owner_id
      if (!aggMap[key]) {
        const bank = bankById[key]
        aggMap[key] = {
          sponsor_owner_id: key,
          name: nameById[key] || key.slice(0, 8),
          grade: gradeByKey[`${key}:${companyByBrand[l.brand_id] || ''}`] || '-',
          pending_amount: 0,
          paid_amount: 0,
          pending_count: 0,
          bank_name: bank?.bank_name || '',
          bank_account: bank?.bank_account || '',
          bank_holder: bank?.bank_holder || '',
        }
      }
      const amt = Math.trunc(Number(l.commission_amount) || 0)
      if (l.status === 'pending') {
        aggMap[key].pending_amount += amt
        aggMap[key].pending_count += 1
      } else if (l.status === 'paid') {
        aggMap[key].paid_amount += amt
      }
      if (aggMap[key].grade === '-' && gradeByKey[`${key}:${l.brand_id}`]) {
        aggMap[key].grade = gradeByKey[`${key}:${l.brand_id}`]
      }
    }
    setSponsorAgg(Object.values(aggMap).sort((a, b) => b.pending_amount - a.pending_amount))

    // ── AB 살롱스토어 정산 (RPC 집계)
    if (salonAggError) {
      setMsg(salonAggError.message)
    }
    const salonAggRows = salonAggData || []
    let pendingTotal = 0
    for (const row of salonAggRows) {
      pendingTotal += Number(row.pending_amount) || 0
    }
    const settledTotal = Number(settledTotalData) || 0
    setTrackAKpi({
      pendingTotal,
      settledTotal,
      pendingSalonCount: salonAggRows.length,
    })
    setTrackASalonAgg(
      salonAggRows.map((row: any) => ({
        salon_id: row.salon_id,
        owner_name: row.owner_name || '원장',
        salon_name: row.salon_name || row.salon_id.slice(0, 8),
        pending_count: Number(row.pending_count) || 0,
        pending_amount: Number(row.pending_amount) || 0,
        pending_ids: [
          ...(row.bpo_ids || []).map((id: string) => ({ id, source: 'bpo' as const })),
          ...(row.psu_ids || []).map((id: string) => ({ id, source: 'purchase_session' as const })),
        ],
      })),
    )

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const filteredOrders = useMemo(() => {
    if (statusFilter === '전체') return orders
    return orders.filter((o) => o.status === statusFilter)
  }, [orders, statusFilter])

  const toggleBatchDetail = async (batchId: string) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null)
      return
    }
    setExpandedBatchId(batchId)
    setBatchDetailLoading(true)
    const { data } = await supabase
      .from('hq_commission_ledger')
      .select('id, sponsor_owner_id, buyer_owner_id, commission_amount')
      .eq('batch_id', batchId)
    const rows = data || []
    setBatchDetailRows(rows)
    const ownerIds = Array.from(new Set(rows.flatMap((r) => [r.sponsor_owner_id, r.buyer_owner_id]).filter(Boolean)))
    if (ownerIds.length) {
      // hq_commission_ledger.sponsor/buyer_owner_id → profiles.id (users.id 아님)
      const { data: owners } = await supabase.from('profiles').select('id, full_name').in('id', ownerIds)
      const nameMap: Record<string, string> = {}
      ;(owners || []).forEach((o) => {
        nameMap[o.id] = String((o as { full_name?: string | null }).full_name || o.id.slice(0, 8))
      })
      setBatchOwnerNames(nameMap)
    }
    setBatchDetailLoading(false)
  }
  const exportBatchCsv = (batch: { batch_seq: number; period_start: string }, rows: Array<{ id: string; sponsor_owner_id: string; buyer_owner_id: string; commission_amount: number }>, nameMap: Record<string, string>) => {
    const header = 'ID,스폰서,구매자,커미션금액\n'
    const body = rows.map((r) => `${r.id},${nameMap[r.sponsor_owner_id] || r.sponsor_owner_id},${nameMap[r.buyer_owner_id] || r.buyer_owner_id},${r.commission_amount}`).join('\n')
    const csv = '\uFEFF' + header + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `정산_${batch.batch_seq}회차_${new Date(batch.period_start).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' })}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const printBatch = (batch: { batch_seq: number; period_start: string; item_count: number; total_amount: number }, rows: Array<{ id: string; sponsor_owner_id: string; buyer_owner_id: string; commission_amount: number }>, nameMap: Record<string, string>) => {
    const w = window.open('', '_blank')
    if (!w) return
    const rowsHtml = rows
      .map((r) => `<tr><td>${nameMap[r.sponsor_owner_id] || r.sponsor_owner_id}</td><td>${nameMap[r.buyer_owner_id] || r.buyer_owner_id}</td><td style="text-align:right">${Number(r.commission_amount).toLocaleString()}원</td></tr>`)
      .join('')
    w.document.write(`
      <html><head><title>정산 ${batch.batch_seq}회차</title></head>
      <body style="font-family:sans-serif;padding:24px">
        <h2>스폰서 커미션 정산 ${batch.batch_seq}회차</h2>
        <p>${new Date(batch.period_start).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}분 · 총 ${batch.item_count}건 · ${Number(batch.total_amount).toLocaleString()}원</p>
        <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
          <thead><tr><th>스폰서</th><th>구매자</th><th>커미션금액</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    w.document.close()
  }
  const settleMonthlyBatch = async () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    setMsg('')
    const { data: targets, error: previewError } = await supabase
      .from('hq_commission_ledger')
      .select('id, commission_amount')
      .eq('status', 'pending')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    if (previewError) {
      setMsg(previewError.message)
      return
    }
    const count = targets?.length || 0
    const total = (targets || []).reduce((sum, t) => sum + Number(t.commission_amount || 0), 0)
    if (count === 0) {
      setMsg(`${start.getFullYear()}년 ${start.getMonth() + 1}월분 정산대상 없음`)
      return
    }
    const confirmed = window.confirm(
      `${start.getFullYear()}년 ${start.getMonth() + 1}월분 ${count}건, 총 ${total.toLocaleString()}원을 정산 처리하시겠습니까?`,
    )
    if (!confirmed) return
    const { data: rpcResult, error } = await supabase.rpc('settle_monthly_sponsor_commission', {
      p_period_start: start.toISOString(),
      p_period_end: end.toISOString(),
    })
    if (error) {
      setMsg(error.message)
      return
    }
    const result = rpcResult?.[0]
    if (!result || !result.out_batch_id) {
      setMsg('정산대상 없음')
      return
    }
    setMsg(`${result.out_batch_seq}회차 정산 완료 (${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, '0')}월분, ${result.out_item_count}건, ${Number(result.out_total_amount).toLocaleString()}원)`)
    await load()
  }
  const settleSponsor = async (sponsorOwnerId: string) => {
    setBusyId(sponsorOwnerId)
    setMsg('')
    const nowIso = new Date().toISOString()
    const selected = selectedLedgerIds[sponsorOwnerId]
    const rows = detailBySponsor[sponsorOwnerId] || []
    // selected state 없음 → 상세 rows 전체(없으면 스폰서 pending 전체)
    // selected 있음 → 체크된 id만 (0건이면 중단)
    let targetIds: string[] | null
    if (selected) {
      targetIds = Array.from(selected)
    } else if (rows.length > 0) {
      targetIds = rows.map((d) => d.ledger_id)
    } else {
      targetIds = null
    }
    if (targetIds && targetIds.length === 0) {
      setMsg('선택된 항목이 없어요')
      setBusyId(null)
      return
    }
    let query = supabase
      .from('hq_commission_ledger')
      .update({ status: 'paid', paid_at: nowIso })
      .eq('status', 'pending')
    if (targetIds) {
      query = query.in('id', targetIds)
    } else {
      query = query.eq('sponsor_owner_id', sponsorOwnerId)
    }
    const { error } = await query
    setBusyId(null)
    if (error) {
      setMsg(error.message)
      return
    }
    setMsg('정산 처리 완료 (장부 상태만 변경 · 실송금 없음)')
    setDetailBySponsor((prev) => {
      const next = { ...prev }
      delete next[sponsorOwnerId]
      return next
    })
    setSelectedLedgerIds((prev) => ({ ...prev, [sponsorOwnerId]: new Set() }))
    if (detailOpenId === sponsorOwnerId) setDetailOpenId(null)
    await load()
  }

  const toggleLedgerSelect = (sponsorOwnerId: string, ledgerId: string, allIds: string[]) => {
    setSelectedLedgerIds((prev) => {
      // 최초 토글 시 전체 선택 상태에서 시작 (checked 기본 true와 일치)
      const current = new Set(prev[sponsorOwnerId] ?? allIds)
      if (current.has(ledgerId)) current.delete(ledgerId)
      else current.add(ledgerId)
      return { ...prev, [sponsorOwnerId]: current }
    })
  }

  const toggleSponsorDetail = async (sponsorOwnerId: string) => {
    if (detailOpenId === sponsorOwnerId) {
      setDetailOpenId(null)
      return
    }
    setDetailOpenId(sponsorOwnerId)
    if (detailBySponsor[sponsorOwnerId]) return

    setDetailLoadingId(sponsorOwnerId)
    setMsg('')
    const pending = ledgers.filter(
      (l) => l.sponsor_owner_id === sponsorOwnerId && l.status === 'pending' && l.source_order_id,
    )
    if (pending.length === 0) {
      setDetailBySponsor((prev) => ({ ...prev, [sponsorOwnerId]: [] }))
      setDetailLoadingId(null)
      return
    }

    const orderIds = Array.from(new Set(pending.map((l) => String(l.source_order_id))))
    const buyerIds = Array.from(new Set(pending.map((l) => String(l.buyer_owner_id || '')).filter(Boolean)))

    const [{ data: orderRows }, { data: lineRows }, { data: buyerProfiles }] = await Promise.all([
      supabase
        .from('hq_stock_orders')
        .select('id, status, final_amount, items')
        .in('id', orderIds),
      supabase
        .from('hq_stock_order_lines')
        .select('order_id, items, line_amount')
        .in('order_id', orderIds),
      buyerIds.length
        ? supabase.from('profiles').select('id, full_name').in('id', buyerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name?: string | null }> }),
    ])

    const buyerNameById: Record<string, string> = {}
    for (const p of buyerProfiles || []) {
      buyerNameById[String(p.id)] = String((p as { full_name?: string | null }).full_name || '원장')
    }

    const orderById: Record<string, { status: string; final_amount: number; items: OrderItemLite[] }> = {}
    for (const o of orderRows || []) {
      orderById[String(o.id)] = {
        status: String((o as { status?: string }).status || '-'),
        final_amount: Math.trunc(Number((o as { final_amount?: number }).final_amount) || 0),
        items: Array.isArray((o as { items?: unknown }).items)
          ? ((o as { items: OrderItemLite[] }).items)
          : [],
      }
    }

    const productsByOrder: Record<string, Array<{ name: string; qty: number; bonus: number }>> = {}
    for (const line of lineRows || []) {
      const oid = String((line as { order_id?: string }).order_id || '')
      if (!oid) continue
      if (!productsByOrder[oid]) productsByOrder[oid] = []
      const items = Array.isArray((line as { items?: unknown }).items)
        ? ((line as { items: OrderItemLite[] }).items)
        : []
      for (const it of items) {
        productsByOrder[oid].push({
          name: String(it.name || '제품'),
          qty: Math.trunc(Number(it.qty) || 0),
          bonus: Math.trunc(Number(it.bonus) || 0),
        })
      }
    }

    const rows: SponsorDetailLine[] = pending.map((l) => {
      const oid = String(l.source_order_id)
      const order = orderById[oid]
      let products = productsByOrder[oid] || []
      if (products.length === 0 && order?.items?.length) {
        products = order.items.map((it) => ({
          name: String(it.name || '제품'),
          qty: Math.trunc(Number(it.qty) || 0),
          bonus: Math.trunc(Number(it.bonus) || 0),
        }))
      }
      return {
        ledger_id: l.id,
        source_order_id: oid,
        buyer_name: buyerNameById[String(l.buyer_owner_id)] || String(l.buyer_owner_id).slice(0, 8),
        commission_rate: Number(l.commission_rate) || 0,
        commission_amount: Math.trunc(Number(l.commission_amount) || 0),
        order_status: order?.status || '-',
        final_amount: order?.final_amount || 0,
        products,
      }
    })

    setDetailBySponsor((prev) => ({ ...prev, [sponsorOwnerId]: rows }))
    setSelectedLedgerIds((prev) => ({
      ...prev,
      [sponsorOwnerId]: new Set(rows.map((r) => r.ledger_id)),
    }))
    setDetailLoadingId(null)
  }

  const settleTrackASalon = async (
    salonId: string,
    pendingIds: Array<{ id: string; source: 'bpo' | 'purchase_session' }>,
  ) => {
    if (!pendingIds.length) return
    setBusyId(`a-${salonId}`)
    setMsg('')
    const bpoIds = pendingIds.filter((p) => p.source === 'bpo').map((p) => p.id)
    const psuIds = pendingIds.filter((p) => p.source === 'purchase_session').map((p) => p.id)
    if (bpoIds.length) {
      const { error } = await supabase
        .from('brand_product_orders')
        .update({ settlement_status: '정산완료' })
        .in('id', bpoIds)
      if (error) {
        setBusyId(null)
        setMsg(error.message)
        return
      }
    }
    if (psuIds.length) {
      const { error } = await supabase
        .from('purchase_session_usages')
        .update({ settlement_status: '정산완료', settled_at: new Date().toISOString() })
        .in('id', psuIds)
      if (error) {
        setBusyId(null)
        setMsg(error.message)
        return
      }
    }
    setBusyId(null)
    setMsg('AB 살롱스토어 정산 처리 완료 (확정만 · 실송금 없음)')
    await load()
  }

  const updateOrderStatus = async (id: string, status: string) => {
    setBusyId(id)
    setMsg('')
    const { error } = await supabase
      .from('hq_stock_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    setBusyId(null)
    if (error) {
      setMsg(error.message)
      return
    }
    await load()
  }

  const card = (label: string, value: string, sub?: string) => (
    <div style={{ background: '#111', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, color: GOLD, fontWeight: 600 }}>{value}</div>
      {sub ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{sub}</div> : null}
    </div>
  )

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, color: '#fff', margin: '0 0 6px' }}>AB 정산 시스템</h1>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>
        HQ 재고발주 매출·스폰서 커미션·살롱스토어 정산 통합 관리
      </p>
      {msg ? <div style={{ marginBottom: 12, fontSize: 12, color: GOLD }}>{msg}</div> : null}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>불러오는 중…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {card('이번달 트랙B 매출', `₩${kpi.monthSales.toLocaleString()}`)}
            {card('정산대기 커미션', `₩${kpi.pendingCommission.toLocaleString()}`)}
            {card('활성 스폰서 수', `${kpi.activeSponsors}명`)}
            {card('이번달 발주건수', `${kpi.monthOrders}건`)}
          </div>

          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: '#fff', marginBottom: 10 }}>30일 매출 추이</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} width={56} />
                  <Tooltip
                    contentStyle={{ background: '#1a1520', border: `1px solid ${PURPLE}`, fontSize: 11 }}
                    formatter={(v: number) => [`₩${Number(v).toLocaleString()}`, '매출']}
                  />
                  <Line type="monotone" dataKey="amount" stroke={PURPLE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
              <div style={{ fontSize: 13, color: '#fff' }}>스폰서 커미션</div>
              <button
                type="button"
                onClick={() => void settleMonthlyBatch()}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(201,169,110,0.4)',
                  background: 'rgba(201,169,110,0.15)',
                  color: GOLD,
                  cursor: 'pointer',
                }}
              >
                전월분 월정산 일괄처리
              </button>
            </div>
            {settlementBatches.length > 0 ? (
              <div style={{ marginBottom: 14, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                <div style={{ marginBottom: 6 }}>최근 정산이력</div>
                {settlementBatches.map((b) => (
                  <div key={b.id}>
                    <div
                      onClick={() => void toggleBatchDetail(b.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
                    >
                      <span>{b.batch_seq}회차 · {new Date(b.period_start).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}분</span>
                      <span>{b.item_count}건 · {Number(b.total_amount).toLocaleString()}원</span>
                    </div>
                    {expandedBatchId === b.id ? (
                      <div style={{ padding: '4px 0 8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                        {batchDetailLoading ? (
                          <div>불러오는 중...</div>
                        ) : batchDetailRows.length === 0 ? (
                          <div>내역 없음</div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                              <span
                                onClick={() => exportBatchCsv(b, batchDetailRows, batchOwnerNames)}
                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                엑셀 다운로드
                              </span>
                              <span
                                onClick={() => printBatch(b, batchDetailRows, batchOwnerNames)}
                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                인쇄
                              </span>
                            </div>
                            {batchDetailRows.map((r) => (
                              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                <span>{batchOwnerNames[r.sponsor_owner_id] || r.sponsor_owner_id.slice(0, 8)} ← {batchOwnerNames[r.buyer_owner_id] || r.buyer_owner_id.slice(0, 8)}</span>
                                <span>{Number(r.commission_amount).toLocaleString()}원</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {sponsorAgg.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>커미션 내역 없음</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>스폰서</th>
                    <th style={{ padding: '6px 4px' }}>등급</th>
                    <th style={{ padding: '6px 4px' }}>대기</th>
                    <th style={{ padding: '6px 4px' }}>완료</th>
                    <th style={{ padding: '6px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {sponsorAgg.map((s) => {
                    const open = detailOpenId === s.sponsor_owner_id
                    const detailRows = detailBySponsor[s.sponsor_owner_id]
                    const detailLoading = detailLoadingId === s.sponsor_owner_id
                    return (
                      <Fragment key={s.sponsor_owner_id}>
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '8px 4px', color: '#fff' }}>
                            <div>{s.name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {formatSponsorBank(s, revealedAccounts.has(s.sponsor_owner_id))}
                              <span
                                onClick={() => setRevealedAccounts((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(s.sponsor_owner_id)) next.delete(s.sponsor_owner_id)
                                  else next.add(s.sponsor_owner_id)
                                  return next
                                })}
                                style={{ marginLeft: 6, fontSize: 11, textDecoration: 'underline', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
                              >
                                {revealedAccounts.has(s.sponsor_owner_id) ? '가리기' : '전체보기'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 4px', color: PURPLE }}>{s.grade}</td>
                          <td style={{ padding: '8px 4px', color: GOLD }}>
                            ₩{s.pending_amount.toLocaleString()} ({s.pending_count})
                          </td>
                          <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)' }}>
                            ₩{s.paid_amount.toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                disabled={!s.pending_count || detailLoading}
                                onClick={() => void toggleSponsorDetail(s.sponsor_owner_id)}
                                style={{
                                  fontSize: 11,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: open ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.2)',
                                  background: open ? 'rgba(123,94,167,0.2)' : 'transparent',
                                  color: open ? '#c4a8f0' : 'rgba(255,255,255,0.7)',
                                  cursor: s.pending_count ? 'pointer' : 'default',
                                  opacity: s.pending_count ? 1 : 0.4,
                                }}
                              >
                                {open ? '접기' : '상세보기'}
                              </button>
                              <button
                                type="button"
                                disabled={!s.pending_count || busyId === s.sponsor_owner_id}
                                onClick={() => void settleSponsor(s.sponsor_owner_id)}
                                style={{
                                  fontSize: 11,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(201,169,110,0.4)',
                                  background: s.pending_count ? 'rgba(201,169,110,0.15)' : 'transparent',
                                  color: GOLD,
                                  cursor: s.pending_count ? 'pointer' : 'default',
                                  opacity: s.pending_count ? 1 : 0.4,
                                }}
                              >
                                {(() => {
                                  const sel = selectedLedgerIds[s.sponsor_owner_id]
                                  const n = detailRows?.length || 0
                                  if (sel && n > 0 && sel.size < n) return `선택 ${sel.size}건 정산`
                                  return '정산 처리'
                                })()}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {open ? (
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                            <td colSpan={5} style={{ padding: '10px 8px 14px', background: 'rgba(123,94,167,0.06)' }}>
                              <div style={{ fontSize: 11, color: GOLD, marginBottom: 10 }}>
                                송금계좌: {formatSponsorBank(s, revealedAccounts.has(s.sponsor_owner_id))}
                                <span
                                  onClick={() => setRevealedAccounts((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(s.sponsor_owner_id)) next.delete(s.sponsor_owner_id)
                                    else next.add(s.sponsor_owner_id)
                                    return next
                                  })}
                                  style={{ marginLeft: 6, fontSize: 11, textDecoration: 'underline', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
                                >
                                  {revealedAccounts.has(s.sponsor_owner_id) ? '가리기' : '전체보기'}
                                </span>
                              </div>
                              {detailLoading ? (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>상세 불러오는 중…</div>
                              ) : !detailRows || detailRows.length === 0 ? (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>pending 상세 없음</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {detailRows.map((d) => (
                                    <div
                                      key={d.ledger_id}
                                      style={{
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 8,
                                        padding: 10,
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'flex-start',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedLedgerIds[s.sponsor_owner_id]?.has(d.ledger_id) ?? true}
                                        onChange={() =>
                                          toggleLedgerSelect(
                                            s.sponsor_owner_id,
                                            d.ledger_id,
                                            detailRows.map((r) => r.ledger_id),
                                          )
                                        }
                                        style={{ marginRight: 8, marginTop: 2 }}
                                      />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 6, fontSize: 11 }}>
                                        <span style={{ color: '#fff' }}>구매자(원장): {d.buyer_name}</span>
                                        <span style={{ color: PURPLE }}>적용요율: {d.commission_rate}%</span>
                                        <span style={{ color: GOLD }}>커미션 ₩{d.commission_amount.toLocaleString()}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                                          주문 ₩{d.final_amount.toLocaleString()} · {d.order_status}
                                        </span>
                                      </div>
                                      {d.products.length === 0 ? (
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>제품 내역 없음</div>
                                      ) : (
                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                                          {d.products.map((p, i) => (
                                            <span key={`${d.ledger_id}-${i}`}>
                                              {i > 0 ? ' · ' : ''}
                                              {p.name} {p.qty}ea
                                              {p.bonus > 0 ? ` (+${p.bonus})` : ''}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
            {ledgers.length > 0 ? (
              <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                원장 건수 {ledgers.length} · pending {ledgers.filter((l) => l.status === 'pending').length}
              </div>
            ) : null}
          </div>

          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#fff', marginRight: 8 }}>최근 발주</div>
              {['전체', '결제대기', '결제완료', '배송완료', '구매확정', '취소'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: statusFilter === s ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.12)',
                    background: statusFilter === s ? 'rgba(123,94,167,0.2)' : 'transparent',
                    color: statusFilter === s ? '#c4a8f0' : 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {filteredOrders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>발주 없음</div>
            ) : (
              filteredOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.4)', width: 78 }}>
                    {new Date(o.ordered_at || o.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#fff', fontSize: 13 }}>
                      {o.salon_name || '살롱'}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                      {o.owner_name || '원장'}
                    </span>
                  </span>
                  <span style={{ color: GOLD }}>₩{Math.trunc(Number(o.final_amount) || 0).toLocaleString()}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', width: 64 }}>{o.status}</span>
                  {o.status === '결제완료' ? (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void updateOrderStatus(o.id, '배송완료')}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: `1px solid ${PURPLE}`,
                        background: 'rgba(123,94,167,0.15)',
                        color: '#c4a8f0',
                        cursor: 'pointer',
                      }}
                    >
                      배송완료
                    </button>
                  ) : null}
                  {o.status === '배송완료' ? (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void updateOrderStatus(o.id, '구매확정')}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(201,169,110,0.4)',
                        background: 'rgba(201,169,110,0.12)',
                        color: GOLD,
                        cursor: 'pointer',
                      }}
                    >
                      구매확정
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {/* ── 트랙A 살롱스토어 정산 ── */}
          <div
            style={{
              background: '#111',
              border: '1px solid rgba(201,169,110,0.35)',
              borderRadius: 10,
              padding: 14,
              marginTop: 18,
            }}
          >
            <div style={{ fontSize: 13, color: GOLD, marginBottom: 4, fontWeight: 600 }}>AB 살롱스토어 정산</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
              제품(brand_product_orders) + 관리권(purchases) · 트랙A/B 공통 · 실송금 없음 · 확정만
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>정산대기 총액</div>
                <div style={{ fontSize: 18, color: GOLD, fontWeight: 600 }}>₩{trackAKpi.pendingTotal.toLocaleString()}</div>
              </div>
              <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>정산완료 총액</div>
                <div style={{ fontSize: 18, color: GOLD, fontWeight: 600 }}>₩{trackAKpi.settledTotal.toLocaleString()}</div>
              </div>
              <div style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>정산대상 원장 수</div>
                <div style={{ fontSize: 18, color: GOLD, fontWeight: 600 }}>{trackAKpi.pendingSalonCount}명</div>
              </div>
            </div>
            {trackASalonAgg.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>정산대기 건 없음</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>원장</th>
                    <th style={{ padding: '6px 4px' }}>살롱</th>
                    <th style={{ padding: '6px 4px' }}>대기 건수</th>
                    <th style={{ padding: '6px 4px' }}>대기 금액</th>
                    <th style={{ padding: '6px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {trackASalonAgg.map((row) => (
                    <tr key={row.salon_id} style={{ borderTop: '1px solid rgba(201,169,110,0.12)' }}>
                      <td style={{ padding: '8px 4px', color: '#fff' }}>{row.owner_name}</td>
                      <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.55)' }}>{row.salon_name}</td>
                      <td style={{ padding: '8px 4px', color: GOLD }}>{row.pending_count}</td>
                      <td style={{ padding: '8px 4px', color: GOLD }}>₩{row.pending_amount.toLocaleString()}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <button
                          type="button"
                          disabled={busyId === `a-${row.salon_id}`}
                          onClick={() => void settleTrackASalon(row.salon_id, row.pending_ids)}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid rgba(201,169,110,0.45)',
                            background: 'rgba(201,169,110,0.15)',
                            color: GOLD,
                            cursor: 'pointer',
                          }}
                        >
                          정산 처리
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
