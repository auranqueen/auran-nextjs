'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandOrdersSummary from '../components/BrandOrdersSummary'
import BrandOrderBatchApproval from '../components/BrandOrderBatchApproval'
import BrandLogisticsClosingReview from '../components/BrandLogisticsClosingReview'
import BrandShippedOrderReport from '../components/BrandShippedOrderReport'
import type { CSSProperties } from 'react'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const SUB = 'rgba(255,255,255,0.3)'

interface Props {
  myBrands: { id: string; name: string }[]
}

export default function BrandTabOrders({ myBrands }: Props) {
  const supabase = createClient()
  const [reportOpen, setReportOpen] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyBrands, setCompanyBrands] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const resolve = async () => {
      const seedId = myBrands[0]?.id
      if (!seedId) {
        setCompanyId(null)
        setCompanyBrands([])
        return
      }
      const { data } = await supabase.from('brands').select('company_id').eq('id', seedId).maybeSingle()
      const cid = data?.company_id ? String(data.company_id) : null
      setCompanyId(cid)
      if (!cid) {
        setCompanyBrands(myBrands)
        return
      }
      const { data: rows } = await supabase.from('brands').select('id, name').eq('company_id', cid).order('name')
      setCompanyBrands(rows && rows.length > 0 ? (rows as { id: string; name: string }[]) : myBrands)
    }
    void resolve()
  }, [myBrands, supabase])

  const companyBrandIds = useMemo(() => companyBrands.map((b) => b.id), [companyBrands])
  const hubBrandId = companyBrandIds[0] || ''
  const brandName = companyBrands[0]?.name || ''

  return (
    <div>
      <BrandOrdersSummary myBrands={companyBrands} />
      <BrandOrderBatchApproval
        brandIds={companyBrandIds}
        brandName={brandName}
      />
      <div style={CARD}>
        <button
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          style={{
            width: '100%', textAlign: 'left', fontSize: 13, padding: '8px 0', cursor: 'pointer',
            border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.75)',
          }}
        >
          📦 발송완료 리포트 {reportOpen ? '접기' : '펼치기'}
        </button>
        {reportOpen && companyId ? (
          <div style={{ marginTop: 12 }}>
            <BrandShippedOrderReport
              companyId={companyId}
              hubBrandId={hubBrandId}
            />
          </div>
        ) : reportOpen ? (
          <div style={{ fontSize: 12, color: SUB, marginTop: 8 }}>company_id가 없어요</div>
        ) : null}
      </div>
      <BrandLogisticsClosingReview brandId={hubBrandId} brandName={brandName} />
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>👑 아레테클럽 포인트 현황</div>
        <div style={{ fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(201,169,110,0.04)', borderRadius: 7, border: '0.5px solid rgba(201,169,110,0.15)' }}>
          💡 아레테 포인트 + 발주 적립 포인트 → 시바산 제품 구매 시 통합 사용
        </div>
      </div>
    </div>
  )
}
