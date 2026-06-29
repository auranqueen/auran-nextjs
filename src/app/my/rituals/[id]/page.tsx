'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'

type Product = { id: string; name: string; description: string | null; key_ingredients: string | null; thumb_img: string | null; storage_thumb_url: string | null }
type Shipment = {
  id: string; cycle_no: number; status: string; shipped_at: string
  curated_product_ids: string[]
  care_card?: { reasons?: Record<string, string[]> } | null
  bundle_templates: { theme_name: string; target_phase: string | null; usage_guide: string | null; owner_tip: string | null } | null
}

export default function RitualDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const supabase = createClient()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data: s } = await supabase
        .from('membership_shipments')
        .select('id, cycle_no, status, shipped_at, curated_product_ids, care_card, bundle_templates(theme_name, target_phase, usage_guide, owner_tip)')
        .eq('id', id)
        .maybeSingle()
      if (!s) { setLoading(false); return }
      setShipment(s as any)
      const ids = (s as any).curated_product_ids || []
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, description, key_ingredients, thumb_img, storage_thumb_url')
          .in('id', ids)
        setProducts((prods as Product[]) || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{ background: '#0a0c0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>불러오는 중...</div>
  if (!shipment) return <div style={{ background: '#0a0c0f', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>리추얼을 찾을 수 없어요</div>

  const tpl = shipment.bundle_templates as any

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c0f', color: '#e8e0f5', paddingBottom: 80 }}>
      <DashboardHeader onBack={() => router.back()} title={`${shipment.cycle_no}회차 리추얼`} right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px' }}>
        <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 14, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 2, marginBottom: 8 }}>ORÆN PRIVÉ · {shipment.cycle_no}회차</div>
          <div style={{ fontSize: 16, color: '#F0E8FF', marginBottom: 4 }}>{tpl?.theme_name || '리추얼'}</div>
          {tpl?.target_phase && <div style={{ fontSize: 12, color: '#9B7EC8', marginBottom: 4 }}>{tpl.target_phase}</div>}
          <div style={{ fontSize: 11, color: '#555' }}>{shipment.shipped_at ? new Date(shipment.shipped_at).toLocaleDateString('ko-KR') + ' 발송' : ''}</div>
        </div>
        {tpl?.usage_guide && (
          <div style={{ background: 'rgba(123,94,167,0.08)', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 6 }}>사용법 안내</div>
            <div style={{ fontSize: 13, color: '#e8e0f5', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{tpl.usage_guide}</div>
          </div>
        )}
        {tpl?.owner_tip && (
          <div style={{ background: 'rgba(201,169,110,0.08)', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#C9A96E', marginBottom: 6 }}>원장님 팁 💜</div>
            <div style={{ fontSize: 13, color: '#e8e0f5', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{tpl.owner_tip}</div>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#9B7EC8', marginBottom: 10 }}>이번 리추얼 구성</div>
        {products.map(p => (
          <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(123,94,167,0.15)', borderRadius: 12, padding: '14px', marginBottom: 10 }}>
            {(p.storage_thumb_url || p.thumb_img) && (
              <img
                src={p.storage_thumb_url || p.thumb_img || ''}
                alt={p.name}
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div style={{ fontSize: 14, color: '#F0E8FF', marginBottom: 6 }}>{p.name}</div>
            {p.description && <div style={{ fontSize: 12, color: '#9B7EC8', marginBottom: 6, lineHeight: 1.6 }}>{p.description}</div>}
            {p.key_ingredients && (
              <div style={{ fontSize: 11, color: '#C9A96E', marginTop: 4 }}>
                핵심 성분 · {p.key_ingredients}
              </div>
            )}
            {shipment.care_card?.reasons?.[p.id]?.length ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#9B7EC8', marginBottom: 4 }}>✨ 추천 이유</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {shipment.care_card.reasons[p.id].map((r: string, i: number) => (
                    <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 12, background: 'rgba(123,94,167,0.15)', color: '#9B7EC8' }}>{r}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
