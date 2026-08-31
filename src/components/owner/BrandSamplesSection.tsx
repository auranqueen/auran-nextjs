'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { getOwnerLinkedBrandIds, getOwnerPendingOnlyBrandNames, formatPendingApprovalNotice } from '@/lib/brand/getOwnerLinkedBrandIds'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
interface SampleRow {
  id: string
  product_name: string
  description: string | null
  target_grades: string[]
  auto_welcome: boolean
  brand_id: string
  brands: { name: string } | null
}
interface SendRow {
  id: string
  sample_id: string
  status: string
  sent_at: string | null
  created_at: string
  brand_samples: { product_name: string; brand_id: string } | null
}
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '발송 대기', color: '#A07830', bg: '#FBF5E8' },
  sent:      { label: '발송완료', color: '#1E6B40', bg: '#EAF5EE' },
  confirmed: { label: '수령확인', color: '#185FA5', bg: '#E6F1FB' },
}
export default function BrandSamplesSection({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [samples, setSamples] = useState<SampleRow[]>([])
  const [mySends, setMySends] = useState<SendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [grade, setGrade] = useState('')
  const [tab, setTab] = useState<'available' | 'history'>('available')
  const [pendingNotice, setPendingNotice] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setPendingNotice('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }
    const { data: prof } = await supabase
      .from('profiles')
      .select('grade')
      .eq('auth_id', user.id)
      .maybeSingle()
    const ownerGrade = (prof as { grade?: string })?.grade || ''
    setGrade(ownerGrade)
    const brandIds = await getOwnerLinkedBrandIds(supabase, user.id)
    if (brandIds.length === 0) {
      const pendingNames = await getOwnerPendingOnlyBrandNames(supabase, user.id)
      setPendingNotice(formatPendingApprovalNotice(pendingNames))
      setSamples([])
      setMySends([])
      setLoading(false)
      return
    }
    const [{ data: sampleData }, { data: sendData }] = await Promise.all([
      supabase.from('brand_samples')
        .select('id, product_name, description, target_grades, auto_welcome, brand_id, brands(name)')
        .in('brand_id', brandIds)
        .order('created_at', { ascending: false }),
      supabase.from('brand_sample_sends')
        .select('id, sample_id, status, sent_at, created_at, brand_samples(product_name, brand_id)')
        .in('brand_id', brandIds)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    const filtered = (sampleData || []).filter((s: { target_grades?: string[] }) =>
      !ownerGrade || !Array.isArray(s.target_grades) || s.target_grades.length === 0 || s.target_grades.includes(ownerGrade)
    )
    setSamples(filtered as unknown as SampleRow[])
    setMySends((sendData || []) as unknown as SendRow[])
    setLoading(false)
  }, [router, supabase])
  useEffect(() => { void load() }, [load])
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86400000)
    if (d < 1) return '오늘'
    if (d < 7) return `${d}일 전`
    return new Date(iso).toLocaleDateString('ko-KR')
  }
  if (loading) return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
      불러오는 중...
    </div>
  )
  return (
    <div style={{ background: BG, minHeight: embedded ? undefined : '100vh', paddingBottom: embedded ? 0 : 80 }}>
      {embedded ? null : (
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 샘플</div>
        {grade && (
          <span style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${PURPLE}15`, color: PURPLE, border: `0.5px solid ${PURPLE}40` }}>
            {grade}
          </span>
        )}
      </div>
      )}
      {pendingNotice ? (
        <div style={{ margin: '0 16px 16px', padding: '14px 16px', borderRadius: 10, background: `${PURPLE}10`, border: `1px solid ${PURPLE}30`, color: PURPLE, fontSize: 13, lineHeight: 1.55, textAlign: 'center' }}>
          {pendingNotice}
        </div>
      ) : null}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 16, padding: '0 16px' }}>
        {([
          { key: 'available', label: `받을 수 있는 샘플 (${samples.length})` },
          { key: 'history', label: `발송 이력 (${mySends.length})` },
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px', fontSize: 12, border: 'none', background: 'none', color: tab === t.key ? PURPLE : SUB, borderBottom: tab === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'available' && (
        <div style={{ padding: '0 16px' }}>
          {samples.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>
              {pendingNotice ? '승인되면 샘플을 받을 수 있어요' : '받을 수 있는 샘플이 없어요'}
            </div>
          ) : samples.map(s => (
            <div key={s.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: PURPLE, marginBottom: 4 }}>{s.brands?.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, marginBottom: 4 }}>{s.product_name}</div>
                  {s.description && (
                    <div style={{ fontSize: 12, color: SUB, marginBottom: 6, lineHeight: 1.5 }}>{s.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                    {Array.isArray(s.target_grades) && s.target_grades.map(g => (
                      <span key={g} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: LIGHT, color: PURPLE }}>
                        {g}
                      </span>
                    ))}
                    {s.auto_welcome && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#EAF5EE', color: '#1E6B40' }}>
                        웰컴 자동 발송
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'history' && (
        <div style={{ padding: '0 16px' }}>
          {mySends.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>
              {pendingNotice ? '승인되면 발송 이력이 보여요' : '샘플 발송 이력이 없어요'}
            </div>
          ) : mySends.map(send => {
            const st = STATUS_MAP[send.status] || { label: send.status, color: SUB, bg: LIGHT }
            return (
              <div key={send.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                    {send.brand_samples?.product_name || '샘플'}
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {send.sent_at ? `발송일: ${new Date(send.sent_at).toLocaleDateString('ko-KR')}` : `신청일: ${timeAgo(send.created_at)}`}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {embedded ? null : <DashboardBottomNav role="owner" />}
    </div>
  )
}
