'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: '예정', color: '#185FA5', bg: '#E6F1FB' },
  live: { label: '진행중', color: '#A32D2D', bg: '#FCEBEB' },
  done: { label: '완료', color: '#5F5E5A', bg: '#F1EFE8' },
  cancelled: { label: '취소', color: '#888', bg: '#F1EFE8' },
}
interface LiveRow {
  id: string
  title: string
  description: string
  platform: string
  live_url: string
  scheduled_at: string
  status: string
  recording_url: string
  target_grades: string[]
  brands: { name: string }
}
export default function BrandLivePage() {
  const router = useRouter()
  const supabase = createClient()
  const [lives, setLives] = useState<LiveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tradeBrands, setTradeBrands] = useState<string[]>([])
  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?role=owner'); return }
      const brandIds = await getOwnerLinkedBrandIds(supabase, user.id, { includePending: true })
      if (brandIds.length === 0) { setLoading(false); return }
      const { data: brandRows } = await supabase
        .from('brands').select('id, name').in('id', brandIds)
      setTradeBrands((brandRows || []).map((b: { name?: string }) => String(b.name || '')).filter(Boolean))
      const { data } = await supabase
        .from('brand_lives')
        .select('id, title, description, platform, live_url, scheduled_at, status, recording_url, target_grades, brands(name)')
        .in('brand_id', brandIds)
        .order('scheduled_at', { ascending: false })
        .limit(20)
      setLives((data || []) as any[])
      setLoading(false)
    }
    void fetch()
  }, [])
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 라이브</div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : tradeBrands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>거래 브랜드를 설정하면 라이브 일정을 볼 수 있어요</div>
        ) : lives.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>등록된 라이브가 없어요</div>
        ) : lives.map((l) => {
          const st = STATUS_MAP[l.status] || STATUS_MAP['done']
          return (
            <div key={l.id} style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 11, color: SUB }}>{l.brands?.name}</span>
                <span style={{ fontSize: 11, color: SUB, marginLeft: 'auto' }}>
                  {l.scheduled_at ? new Date(l.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{l.title}</div>
              {l.description && <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>{l.description}</div>}
              {l.status === 'live' && l.live_url && (
                <a href={l.live_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8, background: PURPLE, color: '#fff', fontSize: 12, textDecoration: 'none' }}>
                  라이브 참여하기 →
                </a>
              )}
              {l.status === 'done' && l.recording_url && (
                <a href={l.recording_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8, background: LIGHT, border: `1px solid ${BORDER}`, color: PURPLE, fontSize: 12, textDecoration: 'none' }}>
                  다시보기 →
                </a>
              )}
            </div>
          )
        })}
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}
