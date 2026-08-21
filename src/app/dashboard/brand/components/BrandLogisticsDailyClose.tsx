'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import LogisticsCloseConfirmPopup from './LogisticsCloseConfirmPopup'
import {
  CARD,
  GOLD,
  PURPLE,
  SUB,
  groupBySalon,
  nextKstDay,
  staffSubmittedBy,
  todayKst,
  type ClosePreviewGroup,
  type OrderRow,
} from './BrandLogisticsDailyClose.helpers'

interface Props {
  brandId: string
  onToast: (msg: string) => void
  onClosedChange?: (closed: boolean) => void
}

export default function BrandLogisticsDailyClose({ brandId, onToast, onClosedChange }: Props) {
  const supabase = createClient()
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submittedBy, setSubmittedBy] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const [previewGroups, setPreviewGroups] = useState<ClosePreviewGroup[]>([])
  const [pendingTotalCount, setPendingTotalCount] = useState(0)
  const [pendingBatchIds, setPendingBatchIds] = useState<string[]>([])
  const [pendingClosingDate, setPendingClosingDate] = useState<string | null>(null)
  const onClosedChangeRef = useRef(onClosedChange)
  onClosedChangeRef.current = onClosedChange

  const resolveCompany = useCallback(async () => {
    if (!brandId) {
      setCompanyId(null)
      setCompanyBrandIds([])
      return
    }
    const { data } = await supabase.from('brands').select('company_id').eq('id', brandId).maybeSingle()
    const cid = data?.company_id ? String(data.company_id) : null
    if (!cid) {
      setCompanyId(null)
      setCompanyBrandIds([brandId])
      return
    }
    const { data: rows } = await supabase.from('brands').select('id').eq('company_id', cid)
    const ids = ((rows || []) as Array<{ id: string }>).map((r) => r.id)
    setCompanyId(cid)
    setCompanyBrandIds(ids.length > 0 ? ids : [brandId])
  }, [brandId])

  useEffect(() => { void resolveCompany() }, [resolveCompany])

  const brandIdsKey = companyBrandIds.slice().sort().join('|')

  const refreshClosed = useCallback(async () => {
    if (!companyId && companyBrandIds.length === 0) return
    const closingDate = todayKst()
    let q = supabase
      .from('brand_logistics_daily_closings')
      .select('id, submitted_by')
      .eq('closing_date', closingDate)
    if (companyId) {
      q = q.eq('company_id', companyId)
    } else {
      q = q.eq('brand_id', brandId)
    }
    const { data } = await q.maybeSingle()
    const isClosed = !!data
    setClosed(isClosed)
    setSubmittedBy(data?.submitted_by ? String(data.submitted_by) : null)
    onClosedChangeRef.current?.(isClosed)
  }, [brandId, companyId, brandIdsKey])

  useEffect(() => { void refreshClosed() }, [refreshClosed])

  const resetConfirm = () => {
    setShowConfirmPopup(false)
    setPreviewGroups([])
    setPendingTotalCount(0)
    setPendingBatchIds([])
    setPendingClosingDate(null)
  }

  const handleClose = async () => {
    if (busy || closed) return
    const ids = companyBrandIds.length > 0 ? companyBrandIds : [brandId]
    if (ids.length === 0) return
    setBusy(true)
    const closingDate = todayKst()
    const start = `${closingDate}T00:00:00+09:00`
    const end = `${nextKstDay(closingDate)}T00:00:00+09:00`

    const [{ data: aRows }, { data: bRows }] = await Promise.all([
      supabase
        .from('brand_orders')
        .select('id, batch_id, shipped_at, salon_name, items')
        .in('brand_id', ids)
        .not('shipped_at', 'is', null)
        .gte('shipped_at', start)
        .lt('shipped_at', end),
      supabase
        .from('hq_stock_orders')
        .select('id, status, updated_at, salon_name, items')
        .in('brand_id', ids)
        .eq('status', '배송완료')
        .gte('updated_at', start)
        .lt('updated_at', end),
    ])

    const rows = ([...(aRows || []), ...(bRows || [])] as OrderRow[])
    const batchIds = Array.from(
      new Set(
        ((aRows || []) as Array<{ batch_id?: string | null }>)
          .map((r) => r.batch_id)
          .filter((id): id is string => !!id),
      ),
    )
    const totalCount = rows.length

    if (totalCount === 0 && batchIds.length === 0) {
      setBusy(false)
      onToast('오늘 발송된 건이 없어요')
      return
    }

    setPreviewGroups(groupBySalon(rows))
    setPendingTotalCount(totalCount)
    setPendingBatchIds(batchIds)
    setShowConfirmPopup(true)
    setPendingClosingDate(closingDate)
    setBusy(false)
  }

  const confirmClose = async () => {
    if (busy || closed || !pendingClosingDate) return
    if (!companyId) {
      onToast('company_id가 없어요. 브랜드 회사 연결을 확인해주세요')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('brand_logistics_daily_closings').insert({
      company_id: companyId,
      brand_id: brandId,
      closing_date: pendingClosingDate,
      order_batch_ids: pendingBatchIds,
      total_count: pendingTotalCount,
      submitted_by: staffSubmittedBy(),
    })
    setBusy(false)
    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
        onToast('이미 마감했습니다')
        resetConfirm()
        void refreshClosed()
        return
      }
      onToast('마감 실패: ' + error.message)
      return
    }
    onToast(`오늘 마감 완료 (${pendingTotalCount}건)`)
    resetConfirm()
    void refreshClosed()
  }

  return (
    <div style={CARD}>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>📋 오늘 마감</div>
      {closed ? (
        <div style={{ fontSize: 12, color: GOLD, lineHeight: 1.5 }}>
          오늘 마감이 완료되었습니다.
          {submittedBy ? <span style={{ color: SUB }}> · {submittedBy}</span> : null}
          <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
            마감 후 오늘 발송건 체크리스트는 수정할 수 없어요.
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => { void handleClose() }}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: PURPLE,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy && !showConfirmPopup ? '확인 중…' : '오늘 마감'}
        </button>
      )}

      {showConfirmPopup ? (
        <LogisticsCloseConfirmPopup
          totalCount={pendingTotalCount}
          groups={previewGroups}
          busy={busy}
          onCancel={resetConfirm}
          onConfirm={() => { void confirmClose() }}
        />
      ) : null}
    </div>
  )
}
