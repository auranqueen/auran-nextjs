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
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [streamKey, setStreamKey] = useState<{ rtmp_url: string; rtmp_key: string } | null>(null)
  const [keyLoading, setKeyLoading] = useState<number | null>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000) }

  const loadBroadcasts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
    if (!profile?.id) return
    const { data } = await supabase
      .from('oren_live_broadcasts')
      .select('id, title, description, scheduled_at, status, mux_live_stream_id, hls_url, started_at, ended_at')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setBroadcasts((data || []) as BroadcastRow[])
    setLoading(false)
  }, [router])

  useEffect(() => { void loadBroadcasts() }, [loadBroadcasts])

  useEffect(() => () => { if (thumbPreview) URL.revokeObjectURL(thumbPreview) }, [thumbPreview])

  const pickThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setThumbPreview(URL.createObjectURL(file))
  }

  const submit = async () => {
    if (!draft.title.trim()) { showToast('방송 제목을 입력해주세요'); return }
    const scheduledAt = new Date(`${schedule.date}T${schedule.hour}:${schedule.minute}:00`)
    if (Number.isNaN(scheduledAt.getTime())) { showToast('방송 날짜를 선택해주세요'); return }
    if (scheduledAt.getTime() < Date.now()) { showToast('지난 시간은 선택할 수 없어요'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/live/create-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          scheduled_at: scheduledAt.toISOString(),
          thumbnail_url: '',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) { showToast(json?.error === 'title_required' ? '제목을 입력해주세요' : '방송 생성 실패'); return }
      showToast('방송이 만들어졌어요!')
      setShowForm(false)
      setDraft(EMPTY)
      setSchedule(defaultSchedule())
      setThumbPreview(null)
      await loadBroadcasts()
    } finally {
      setSaving(false)
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
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
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

      {showForm && (
        <div style={{ margin: '0 16px 16px', background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 12 }}>새 방송 만들기</div>
          <label style={{ display: 'block', position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, border: '2px dashed #d8b4fe', background: '#faf5ff', overflow: 'hidden', cursor: 'pointer', marginBottom: 12 }}>
            <input type="file" accept="image/*" onChange={pickThumb} style={{ display: 'none' }} />
            {thumbPreview ? (
              <img src={thumbPreview} alt="방송 썸네일 미리보기" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: PURPLE }}>📷 방송 썸네일 추가</div>
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
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>방송 날짜</div>
          <input
            type="date"
            value={schedule.date}
            min={toDateStr(new Date())}
            onChange={(e) => setSchedule((p) => ({ ...p, date: e.target.value }))}
            style={{ ...FIELD, marginBottom: 10 }}
          />
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>방송 시간</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select value={schedule.hour} onChange={(e) => setSchedule((p) => ({ ...p, hour: e.target.value }))} style={{ ...FIELD, flex: 1 }}>
              {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select value={schedule.minute} onChange={(e) => setSchedule((p) => ({ ...p, minute: e.target.value }))} style={{ ...FIELD, flex: 1 }}>
              {MINUTES.map((m) => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: saving ? '#ccc' : PURPLE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? '만드는 중…' : '방송 만들기'}
          </button>
        </div>
      )}

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

      <div style={{ padding: '0 16px' }}>
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
              <div key={b.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 13, padding: 14, marginBottom: 10, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 6, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span>
                  {b.scheduled_at && (
                    <span style={{ fontSize: 11, color: SUB }}>
                      {new Date(b.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 3 }}>{b.title}</div>
                {b.description && <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>{b.description}</div>}
                {b.status !== 'ended' && (
                  <button
                    type="button"
                    disabled={isKeyLoading}
                    onClick={() => void fetchStreamKey(b.id)}
                    style={{ marginTop: 4, fontSize: 12, padding: '7px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: LIGHT, color: PURPLE, cursor: isKeyLoading ? 'wait' : 'pointer', fontWeight: 600 }}
                  >
                    {isKeyLoading ? '조회 중…' : '📡 송출키 보기'}
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <DashboardBottomNav role="owner" />
    </div>
  )
}
