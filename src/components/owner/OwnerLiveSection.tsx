'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: '예정', color: '#185FA5', bg: '#E6F1FB' },
  live: { label: '방송중', color: '#A32D2D', bg: '#FCEBEB' },
  ended: { label: '종료', color: '#5F5E5A', bg: '#F1EFE8' },
}

interface BroadcastRow {
  id: number
  title: string
  description: string | null
  scheduled_at: string | null
  status: string
  mux_live_stream_id: string | null
  hls_url: string | null
  started_at: string | null
  ended_at: string | null
  thumbnail_url: string | null
  viewer_count: number | null
}

const EMPTY = { title: '', description: '' }
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = ['00', '30']
const FIELD = { width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box' as const, background: '#fff', color: TEXT }

function toDateStr(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function defaultSchedule() {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return { date: toDateStr(d), hour: String(d.getHours()).padStart(2, '0'), minute: '00' }
}

export default function OwnerLiveSection() {
  const router = useRouter()
  const supabase = createClient()
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(EMPTY)
  const [schedule, setSchedule] = useState(defaultSchedule)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [thumbFile, setThumbFile] = useState(null as File | null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [streamKey, setStreamKey] = useState<{ rtmp_url: string; rtmp_key: string } | null>(null)
  const [keyLoading, setKeyLoading] = useState<number | null>(null)
  const [isPC, setIsPC] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null as number | null)
  const [deleting, setDeleting] = useState(null as number | null)

  useEffect(() => {
    const onResize = () => setIsPC(window.innerWidth >= 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000) }

  const loadBroadcasts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }
    try {
      const res = await fetch('/api/live/my-broadcasts', { credentials: 'same-origin', cache: 'no-store' })
      if (res.status === 401) { router.replace('/login?role=owner'); return }
      const json = await res.json().catch(() => ({}))
      if (!json?.ok || !Array.isArray(json.broadcasts)) {
        console.error('[OwnerLiveSection] 방송 목록 조회 실패', res.status, json?.error)
        setBroadcasts([])
        return
      }
      setBroadcasts(json.broadcasts)
    } catch (e) {
      console.error('[OwnerLiveSection] 방송 목록 조회 오류', e)
      setBroadcasts([])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void loadBroadcasts() }, [loadBroadcasts])

  useEffect(() => () => { if (thumbPreview) URL.revokeObjectURL(thumbPreview) }, [thumbPreview])

  const pickThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      setThumbFile(file)
      setThumbPreview(URL.createObjectURL(file))
    }
  }

  const submit = async () => {
    if (!draft.title.trim()) { showToast('방송 제목을 입력해주세요'); return }
    const scheduledAt = new Date(`${schedule.date}T${schedule.hour}:${schedule.minute}:00`)
    if (Number.isNaN(scheduledAt.getTime())) { showToast('방송 날짜를 선택해주세요'); return }
    if (scheduledAt.getTime() < Date.now()) { showToast('지난 시간은 선택할 수 없어요'); return }
    setSaving(true)
    try {
      let thumbnailUrl = ''
      if (thumbFile) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id
          if (userId) {
            const ext = thumbFile.name.split('.').pop() || 'jpg'
            const path = `${userId}/live/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('live-thumbnails').upload(path, thumbFile, { upsert: true })
            if (uploadError) {
              console.error('[OwnerLiveSection] 썸네일 업로드 실패', uploadError)
            } else {
              const { data: pub } = supabase.storage.from('live-thumbnails').getPublicUrl(path)
              thumbnailUrl = pub?.publicUrl || ''
            }
          }
        } catch (e) {
          console.error('[OwnerLiveSection] 썸네일 업로드 실패', e)
          thumbnailUrl = ''
        }
      }
      const res = await fetch('/api/live/create-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          scheduled_at: scheduledAt.toISOString(),
          thumbnail_url: thumbnailUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) { showToast(json?.error === 'title_required' ? '제목을 입력해주세요' : '방송 생성 실패'); return }
      showToast('방송이 만들어졌어요!')
      setShowForm(false)
      setDraft(EMPTY)
      setSchedule(defaultSchedule())
      setThumbPreview(null)
      setThumbFile(null)
      await loadBroadcasts()
    } finally {
      setSaving(false)
    }
  }

  const deleteBroadcast = async (broadcastId: number) => {
    if (deleting) return
    setDeleting(broadcastId)
    try {
      const res = await fetch(`/api/live/delete-broadcast?broadcast_id=${broadcastId}`, { method: 'DELETE', credentials: 'same-origin' })
      if (res.status === 401) { router.replace('/login?role=owner'); return }
      const json = await res.json().catch(() => ({}))
      if (json?.ok) {
        showToast('방송을 삭제했어요')
        await loadBroadcasts()
        return
      }
      if (json?.error === 'not_deletable') showToast('예정 방송만 삭제할 수 있어요')
      else if (json?.error === 'has_related_data') showToast('연결된 데이터가 있어 삭제할 수 없어요')
      else if (json?.error === 'not_found') {
        showToast('이미 삭제된 방송이에요')
        await loadBroadcasts()
      } else showToast('삭제에 실패했어요')
    } catch (e) {
      console.error('[OwnerLiveSection] 방송 삭제 오류', e)
      showToast('삭제에 실패했어요')
    } finally {
      setDeleting(null)
      setDeleteConfirm(null)
    }
  }

  const fetchStreamKey = async (broadcastId: number) => {
    if (keyLoading) return
    setKeyLoading(broadcastId)
    setStreamKey(null)
    try {
      const res = await fetch(`/api/live/stream-key?broadcast_id=${broadcastId}`, { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) { showToast('송출키 조회 실패'); return }
      setStreamKey({ rtmp_url: json.rtmp_url, rtmp_key: json.rtmp_key })
    } finally {
      setKeyLoading(null)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('복사됐어요')).catch(() => showToast('복사 실패'))
  }

  return (
    <div style={{ background: '#fff', color: '#1a1a1a', minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>내 라이브 방송</div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px', borderRadius: 20, border: `1px solid ${PURPLE}`, background: showForm ? LIGHT : PURPLE, color: showForm ? PURPLE : '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          {showForm ? '취소' : '+ 방송 만들기'}
        </button>
      </div>

      {isPC && showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }} />
      )}
      <div
        aria-hidden={!showForm}
        style={isPC ? {
          position: 'fixed', top: '50%', left: '50%', width: '480px', maxHeight: '90vh', zIndex: 50,
          background: '#fff', color: '#1a1a1a', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transform: showForm ? 'translate(-50%, -50%)' : 'translate(-40%, -50%)',
          opacity: showForm ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s, visibility 0.28s',
          visibility: showForm ? 'visible' : 'hidden',
        } : {
          position: 'fixed', inset: 0, zIndex: 50, background: '#fff', color: '#1a1a1a',
          display: 'flex', flexDirection: 'column',
          transform: showForm ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), visibility 0.28s',
          visibility: showForm ? 'visible' : 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button type="button" aria-label="뒤로가기" onClick={() => setShowForm(false)}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
          <div style={{ fontSize: 16, color: TEXT }}>방송 만들기</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>썸네일 (선택)</div>
          <label style={{ display: 'block', position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '1.5px dashed #C9A96E', cursor: 'pointer', background: '#fbf8f2', marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={pickThumb} style={{ display: 'none' }} />
            {thumbPreview ? (
              <img src={thumbPreview} alt="방송 썸네일 미리보기" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 20 }}>📷</span>
                <span style={{ fontSize: 10, color: '#bbb' }}>16:9 비율 권장</span>
              </div>
            )}
          </label>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>방송 제목 *</div>
          <input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="예: 신제품 출시 기념 라이브"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff' }}
          />
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>설명 (선택)</div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder="방송 내용을 간단히 적어주세요"
            rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff', resize: 'none' }}
          />
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>예정 일시</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              type="date"
              value={schedule.date}
              min={toDateStr(new Date())}
              onChange={(e) => setSchedule((p) => ({ ...p, date: e.target.value }))}
              style={{ flex: 2, minWidth: 0, padding: '10px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT }}
            />
            <select value={schedule.hour} onChange={(e) => setSchedule((p) => ({ ...p, hour: e.target.value }))}
              style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, appearance: 'none', WebkitAppearance: 'none' }}>
              {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select value={schedule.minute} onChange={(e) => setSchedule((p) => ({ ...p, minute: e.target.value }))}
              style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, appearance: 'none', WebkitAppearance: 'none' }}>
              {['00', '10', '20', '30', '40', '50'].map((m) => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: saving ? '#ccc' : '#C9A96E', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? '만드는 중…' : '방송 만들기'}
          </button>
        </div>
      </div>

      {streamKey && (
        <div style={{ margin: '0 16px 16px', background: '#fff9f0', border: '1px solid #f5d8a0', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#a06010', marginBottom: 8 }}>📡 송출 정보 (비공개)</div>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>RTMP URL</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', background: '#f5f5f5', padding: '5px 8px', borderRadius: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{streamKey.rtmp_url}</span>
            <button type="button" onClick={() => copy(streamKey.rtmp_url)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', flexShrink: 0 }}>복사</button>
          </div>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>스트림 키</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', background: '#f5f5f5', padding: '5px 8px', borderRadius: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{streamKey.rtmp_key}</span>
            <button type="button" onClick={() => copy(streamKey.rtmp_key)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', flexShrink: 0 }}>복사</button>
          </div>
          <div style={{ fontSize: 10, color: '#c08040', marginTop: 8 }}>⚠️ 스트림 키는 타인에게 공유하지 마세요</div>
          <button type="button" onClick={() => setStreamKey(null)} style={{ marginTop: 8, fontSize: 11, color: SUB, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>닫기</button>
        </div>
      )}

      <div style={{ padding: '0 16px', maxWidth: 600, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : broadcasts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📹</div>
            <div style={{ fontSize: 13, color: SUB }}>아직 방송이 없어요</div>
            <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>위에서 첫 방송을 만들어보세요</div>
          </div>
        ) : (
          broadcasts.map((b) => {
            const st = STATUS_MAP[b.status] || STATUS_MAP['ended']
            const isKeyLoading = keyLoading === b.id
            return (
              <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, border: `1px solid ${BORDER}`, borderRadius: 13, marginBottom: 10, background: '#fff' }}>
                <div style={{ width: 60, flexShrink: 0, aspectRatio: '9/16', borderRadius: 8, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #a78bfa, #f9a8d4)' }}>
                  {b.thumbnail_url && (
                    <img src={b.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3, flexWrap: 'nowrap' }}>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 5, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
                    {b.scheduled_at && (
                      <span style={{ fontSize: 10, color: SUB, whiteSpace: 'nowrap' }}>
                        {new Date(b.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: TEXT, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  {b.description && (
                    <div style={{ fontSize: 11, color: SUB, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.description}</div>
                  )}
                  {b.status === 'ended' ? (
                    <div style={{ fontSize: 10, color: SUB }}>👁️ {b.viewer_count ?? 0}명</div>
                  ) : deleteConfirm === b.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 10, color: TEXT, whiteSpace: 'nowrap' }}>정말 삭제할까요?</span>
                      <button type="button" onClick={() => setDeleteConfirm(null)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: PURPLE, cursor: 'pointer' }}>취소</button>
                      <button type="button" disabled={deleting === b.id} onClick={() => { void deleteBroadcast(b.id) }} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', cursor: 'pointer' }}>{deleting === b.id ? '삭제 중…' : '확인삭제'}</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button type="button" onClick={() => showToast('준비 중이에요')} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: PURPLE, cursor: 'pointer' }}>✏️ 수정</button>
                      <button type="button" onClick={() => setDeleteConfirm(b.id)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', cursor: 'pointer' }}>🗑️ 삭제</button>
                      <button
                        type="button"
                        disabled={isKeyLoading}
                        onClick={() => void fetchStreamKey(b.id)}
                        style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: PURPLE, cursor: isKeyLoading ? 'wait' : 'pointer' }}
                      >
                        {isKeyLoading ? '조회 중…' : '📡 송출키'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <DashboardBottomNav role="owner" />
    </div>
  )
}
