'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GRADES = ['전체', '메디슈티컬', '프리미엄전문점', '전문점', '취급점', '아레테클럽']
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  scheduled: { label: '예정', color: 'rgba(100,181,246,0.8)' },
  live:      { label: '진행중', color: 'rgba(229,57,53,0.85)' },
  done:      { label: '완료', color: 'rgba(255,255,255,0.3)' },
  cancelled: { label: '취소', color: 'rgba(229,57,53,0.5)' },
}
interface Live {
  id: string
  title: string
  description: string | null
  platform: string
  live_url: string | null
  scheduled_at: string
  status: string
  registrant_count: number
  viewer_count: number
  target_grades: string[]
  recording_url: string | null
}
interface Props {
  myBrands: { id: string; name: string }[]
  brandId: string | null
}
export default function BrandTabLive({ myBrands, brandId }: Props) {
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [platform, setPlatform] = useState<'zoom' | 'prism'>('zoom')
  const [liveUrl, setLiveUrl] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [targetGrades, setTargetGrades] = useState<string[]>(['전체'])
  const [saving, setSaving] = useState(false)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  useEffect(() => {
    if (!brandId) { setCompanyBrandIds([]); return }
    let cancelled = false
    void (async () => {
      const ids = await resolveCompanyBrandIds(supabase, brandId)
      if (!cancelled) setCompanyBrandIds(ids)
    })()
    return () => { cancelled = true }
  }, [brandId, supabase])
  const fetchLives = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_lives')
      .select('id, title, description, platform, live_url, scheduled_at, status, registrant_count, viewer_count, target_grades, recording_url')
      .in('brand_id', companyBrandIds)
      .order('scheduled_at', { ascending: false })
      .limit(20)
    setLives((data || []) as Live[])
    setLoading(false)
  }, [companyBrandIds])
  useEffect(() => { void fetchLives() }, [fetchLives])
  const toggleGrade = (g: string) => {
    if (g === '전체') { setTargetGrades(['전체']); return }
    setTargetGrades(prev => {
      const without = prev.filter(x => x !== '전체')
      return without.includes(g) ? without.filter(x => x !== g) || ['전체'] : [...without, g]
    })
  }
  const submitLive = async () => {
    if (!title.trim()) { showToast('제목을 입력해주세요'); return }
    if (!scheduledAt) { showToast('일시를 입력해주세요'); return }
    if (!brandId) { showToast('브랜드 정보가 없습니다'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('brand_lives')
      .insert({
        brand_id: brandId,
        title: title.trim(),
        description: desc.trim() || null,
        platform,
        live_url: liveUrl.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        target_grades: targetGrades,
        status: 'scheduled',
      })
      .select('id, title, description, platform, live_url, scheduled_at, status, registrant_count, viewer_count, target_grades, recording_url')
      .single()
    if (!error && data) {
      setLives(prev => [data as Live, ...prev])
      setTitle(''); setDesc(''); setLiveUrl(''); setScheduledAt('')
      setTargetGrades(['전체']); setPlatform('zoom')
      setShowForm(false)
      showToast('라이브 예약 완료!')
    } else {
      showToast('저장 실패: ' + (error?.message || ''))
    }
    setSaving(false)
  }
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('brand_lives')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setLives(prev => prev.map(l => l.id === id ? { ...l, status } : l))
      showToast(STATUS_MAP[status]?.label + '!')
    }
  }
  const copyLink = (url: string | null) => {
    if (!url) { showToast('링크가 없어요'); return }
    navigator.clipboard?.writeText(url).catch(() => {})
    showToast('링크 복사됨!')
  }
  const resolveOwnerProfileIds = async (grades: string[]): Promise<string[]> => {
    if (!brandId) return []
    const { data: activeLinks } = await supabase
      .from('brand_owner_links')
      .select('owner_id')
      .eq('brand_id', brandId)
      .eq('status', 'active')
    const linkedUserIds = Array.from(
      new Set((activeLinks || []).map((r: { owner_id: string }) => String(r.owner_id)).filter(Boolean)),
    )
    if (linkedUserIds.length === 0) return []
    const { data: userRows } = await supabase
      .from('users')
      .select('id, auth_id')
      .in('id', linkedUserIds)
      .eq('role', 'owner')
    const authIds = Array.from(
      new Set((userRows || []).map((u: { auth_id?: string | null }) => String(u.auth_id || '')).filter(Boolean)),
    )
    if (authIds.length === 0) return []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .in('auth_id', authIds)
    const allIds = (profiles || []).map((p: { id: string }) => String(p.id))
    if (grades.includes('전체') || grades.length === 0) return allIds
    const wantArete = grades.includes('아레테클럽')
    const gradeOnly = grades.filter(g => g !== '아레테클럽' && g !== '전체')
    const idSet = new Set<string>()
    if (gradeOnly.length > 0 && allIds.length > 0) {
      const { data: gradeRows } = await supabase
        .from('brand_owner_grades')
        .select('owner_id, grade')
        .eq('brand_id', brandId)
        .in('grade', gradeOnly)
        .in('owner_id', allIds)
      for (const r of gradeRows || []) idSet.add(String((r as { owner_id: string }).owner_id))
    }
    if (wantArete) {
      const { data: areteRows } = await supabase
        .from('brand_arete_members')
        .select('owner_id')
        .eq('brand_id', brandId)
        .eq('status', 'active')
      for (const r of areteRows || []) {
        const oid = String((r as { owner_id: string }).owner_id)
        if (allIds.includes(oid)) idSet.add(oid)
      }
    }
    return Array.from(idSet)
  }
  const sendLiveOrenTalk = async (live: Live) => {
    if (!brandId) { showToast('브랜드 정보가 없습니다'); return }
    const ownerIds = await resolveOwnerProfileIds(live.target_grades || ['전체'])
    if (ownerIds.length === 0) { showToast('발송 대상 원장님이 없어요'); return }
    let ok = 0
    for (const ownerId of ownerIds) {
      const { error } = await supabase.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'manual',
        target_type: 'selected',
        target_owner_id: ownerId,
        title: `${brandName} 라이브 안내`,
        body: '미등록 원장님 오렌톡 발송!',
        send_count: 1,
      })
      if (!error) ok += 1
    }
    showToast(ok > 0 ? `미등록 원장님 ${ok}명에게 오렌톡 발송!` : '발송 실패')
  }
  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const upcoming = lives.filter(l => l.status === 'scheduled' || l.status === 'live')
  const past = lives.filter(l => l.status === 'done' || l.status === 'cancelled')
  if (!companyBrandIds.length) {
    return <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>불러오는 중…</div>
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📡 예정된 라이브</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : upcoming.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>예정된 라이브가 없어요</div>
        ) : (
          upcoming.map((l, i) => {
            const st = STATUS_MAP[l.status]
            return (
              <div key={l.id} style={{ padding: '12px 0', borderBottom: i < upcoming.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: TEXT }}>{l.title}</span>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${st.color}22`, color: st.color, border: `0.5px solid ${st.color}55` }}>{st.label}</span>
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(100,181,246,0.1)', color: 'rgba(100,181,246,0.8)' }}>{l.platform.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>{formatDate(l.scheduled_at)}</div>
                    <div style={{ fontSize: 11, color: SUB }}>등록 {l.registrant_count}명 · {l.target_grades.join(', ')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => void sendLiveOrenTalk(l)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', cursor: 'pointer' }}>오렌톡</button>
                  <button type="button" onClick={() => copyLink(l.live_url)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}>링크 복사</button>
                  {l.status === 'scheduled' && (
                    <button type="button" onClick={() => updateStatus(l.id, 'live')}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.8)', cursor: 'pointer' }}>라이브 시작</button>
                  )}
                  {l.status === 'live' && (
                    <button type="button" onClick={() => updateStatus(l.id, 'done')}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(76,175,80,0.3)', background: 'rgba(76,175,80,0.08)', color: 'rgba(76,175,80,0.8)', cursor: 'pointer' }}>라이브 종료</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
      {showForm ? (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>+ 새 라이브 예약</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="라이브 제목 *"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }} />
          <input value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} type="datetime-local"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8, colorScheme: 'dark' }} />
          <input value={liveUrl} onChange={e => setLiveUrl(e.target.value)} placeholder="ZOOM/프리즘 링크 (선택)"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['zoom', 'prism'] as const).map(p => (
              <button key={p} type="button" onClick={() => setPlatform(p)}
                style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: `0.5px solid ${platform === p ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: platform === p ? 'rgba(123,94,167,0.2)' : 'transparent', color: platform === p ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                {p === 'zoom' ? 'ZOOM' : 'AURAN 프리즘'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>대상</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {GRADES.map(g => (
              <button key={g} type="button" onClick={() => toggleGrade(g)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${targetGrades.includes(g) ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: targetGrades.includes(g) ? 'rgba(123,94,167,0.2)' : 'transparent', color: targetGrades.includes(g) ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                {g}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={submitLive} disabled={saving}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '저장 중...' : '예약하기'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
          + 새 라이브 예약
        </button>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>🏅 교육 이수 관리</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(201,169,110,0.1)', border: '0.5px solid rgba(201,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏆</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{brandName} 공인 에스테티션</div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 6 }}>필수 교육 3회 이수 후 인증 배지 발급</div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (past.length / 3) * 100)}%`, height: '100%', background: 'rgba(201,169,110,0.6)', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>완료 {past.length}회 / 3회</div>
          </div>
          <button type="button" onClick={() => showToast('인증서 발급!')}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(201,169,110,0.35)', background: 'transparent', color: GOLD, cursor: 'pointer', flexShrink: 0 }}>발급</button>
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📼 다시보기</div>
        {past.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>진행된 라이브가 없습니다</div>
        ) : (
          past.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < past.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{l.title}</div>
                <div style={{ fontSize: 11, color: SUB }}>시청 {l.viewer_count}명 · {formatDate(l.scheduled_at)}</div>
              </div>
              {l.recording_url && (
                <button type="button" onClick={() => copyLink(l.recording_url)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, cursor: 'pointer', flexShrink: 0 }}>링크</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
