'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { EMPTY, GOLD, SUB, TEXT, buildDateMarks, defaultSchedule, filterByDate, pickHero, splitBroadcasts, toDateStr, type BroadcastActions, type BroadcastRow } from '@/components/owner/live/liveUtils'
import LiveHeroCard, { StreamKeyCard } from '@/components/owner/live/LiveHeroCard'
import LiveMiniCalendar from '@/components/owner/live/LiveMiniCalendar'
import LiveBroadcastList from '@/components/owner/live/LiveBroadcastList'
import LiveCreateSheet from '@/components/owner/live/LiveCreateSheet'
import { useLiveEdit } from '@/components/owner/live/useLiveEdit'
import { compressImage } from '@/lib/imageUpload'
import type { LivePickerProduct } from '@/components/owner/live/LiveProductPicker'

function currentMonth() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() }
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
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(currentMonth)
  const [createProducts, setCreateProducts] = useState<LivePickerProduct[]>([])

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

  const pickThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      showToast('사진은 20MB 이하로 선택해 주세요')
      return
    }
    try {
      const compressed = await compressImage(file, 'live_thumb')
      const mime = (compressed.type || '').toLowerCase()
      const name = (compressed.name || '').toLowerCase()
      if (mime.includes('heic') || mime.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')) {
        throw new Error('unsupported')
      }
      setThumbFile(compressed)
      setThumbPreview(URL.createObjectURL(compressed))
    } catch {
      setThumbFile(null)
      setThumbPreview(null)
      showToast('이 사진은 사용할 수 없어요. 다른 사진을 선택해 주세요')
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
      let thumbFailed = false
      if (thumbFile) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id
          if (userId) {
            const ext = thumbFile.type === 'image/png' ? 'png' : (thumbFile.name.split('.').pop() || 'jpg')
            const path = `${userId}/live/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('live-thumbnails').upload(path, thumbFile, { upsert: true })
            if (uploadError) {
              console.error('[OwnerLiveSection] 썸네일 업로드 실패', uploadError)
              thumbFailed = true
            } else {
              const { data: pub } = supabase.storage.from('live-thumbnails').getPublicUrl(path)
              thumbnailUrl = pub?.publicUrl || ''
            }
          } else thumbFailed = true
        } catch (e) {
          console.error('[OwnerLiveSection] 썸네일 업로드 실패', e)
          thumbFailed = true
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
      const newId = json.broadcast?.id as number | undefined
      let productFail = 0
      if (newId != null && createProducts.length > 0) {
        for (const p of createProducts) {
          try {
            const pr = await fetch('/api/live/broadcast-products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ broadcast_id: newId, brand_product_id: p.id }),
            })
            const pj = await pr.json().catch(() => ({}))
            if (!(pj?.ok || pj?.error === 'already_exists')) productFail += 1
          } catch {
            productFail += 1
          }
        }
      }
      if (productFail > 0) showToast(`방송은 만들어졌어요. ${productFail}개 제품 연결에 실패했어요. 수정에서 다시 연결해 주세요`)
      else if (thumbFailed) showToast('썸네일 업로드에 실패했어요. 수정에서 다시 올려 주세요')
      else showToast('방송이 만들어졌어요!')
      setShowForm(false)
      setDraft(EMPTY)
      setSchedule(defaultSchedule())
      setThumbPreview(null)
      setThumbFile(null)
      setCreateProducts([])
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

  const edit = useLiveEdit({
    draft, schedule, setDraft, setSchedule, setShowForm, setSaving, showToast,
    reload: loadBroadcasts, onUnauthorized: () => router.replace('/login?role=owner'),
  })
  const closeForm = () => { setShowForm(false); setCreateProducts([]); setThumbPreview(null); setThumbFile(null); setDraft(EMPTY); if (edit.editingId !== null) edit.closeEdit() }

  const today = toDateStr(new Date())
  const { upcoming, past } = splitBroadcasts(broadcasts)
  const hero = pickHero(upcoming)
  const marks = buildDateMarks(broadcasts)
  const upcomingShown = selectedDate ? filterByDate(upcoming, selectedDate) : upcoming.filter((b) => b.id !== hero?.id)
  const pastShown = filterByDate(past, selectedDate)
  const actions: BroadcastActions = {
    keyLoading,
    deleteConfirm,
    deleting,
    onStreamKey: (id) => { void fetchStreamKey(id) },
    onEdit: edit.openEdit,
    onAskDelete: setDeleteConfirm,
    onDelete: (id) => { void deleteBroadcast(id) },
  }

  const openForm = (date?: string) => {
    const base = defaultSchedule()
    if (!date) { setSchedule(base); setShowForm(true); return }
    if (new Date(`${date}T${base.hour}:${base.minute}:00`).getTime() < Date.now()) {
      showToast('지금 시간 이후로 선택해주세요')
      return
    }
    setSchedule({ ...base, date })
    setShowForm(true)
  }

  const pickDate = (date: string) => {
    const mark = marks[date]
    if (mark) {
      if (selectedDate === date) { setSelectedDate(null); return }
      setSelectedDate(date)
      setTab(mark.upcoming ? 'upcoming' : 'past')
      return
    }
    if (date < today) return
    openForm(date)
  }

  const moveMonth = (delta: number) => {
    setCalMonth((p) => {
      const d = new Date(p.year, p.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <div style={{ background: '#fff', color: '#1a1a1a', minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0, flexShrink: 0 }}>←</button>
        <div style={{ fontSize: 13, color: TEXT, whiteSpace: 'nowrap' }}>내 라이브 방송</div>
      </div>

      <LiveCreateSheet
        isPC={isPC}
        showForm={showForm}
        onClose={closeForm} mode={edit.editingId !== null ? 'edit' : 'create'}
        draft={draft} setDraft={setDraft} schedule={schedule} setSchedule={setSchedule}
        thumbPreview={thumbPreview} pickThumb={(e) => { void pickThumb(e) }} saving={saving}
        submit={edit.editingId !== null ? edit.submitEdit : submit}
        broadcastId={edit.editingId}
        showToast={showToast}
        createProducts={createProducts}
        onCreateProductsChange={setCreateProducts}
      />

      <div style={{ padding: '0 16px', maxWidth: 600, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : (
          <>
            <LiveHeroCard broadcast={hero} actions={actions} onCreate={() => openForm()} />

            {streamKey && <StreamKeyCard streamKey={streamKey} onCopy={copy} onClose={() => setStreamKey(null)} />}

            <LiveMiniCalendar
              year={calMonth.year} month={calMonth.month} marks={marks} selectedDate={selectedDate} today={today}
              onPrev={() => moveMonth(-1)} onNext={() => moveMonth(1)} onToday={() => setCalMonth(currentMonth())} onPick={pickDate}
            />

            <LiveBroadcastList
              tab={tab} onTab={setTab} upcoming={upcomingShown} past={pastShown}
              selectedDate={selectedDate} onClearDate={() => setSelectedDate(null)} actions={actions}
            />
            {hero != null && (
              <button
                type="button"
                onClick={() => openForm()}
                style={{
                  width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 9,
                  border: `1px solid ${GOLD}`, background: '#fbf8f2', color: GOLD,
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                + 방송 추가
              </button>
            )}
          </>
        )}
      </div>

      <DashboardBottomNav role="owner" />
    </div>
  )
}
