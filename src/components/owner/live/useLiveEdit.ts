'use client'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EMPTY, defaultSchedule, scheduleFromIso, type BroadcastRow } from './liveUtils'

type Draft = { title: string; description: string; thumbnail_url?: string | null; thumb_file?: File | null }
type Schedule = { date: string; hour: string; minute: string }

const EDIT_ERRORS: Record<string, string> = {
  not_editable: '예정 방송만 수정할 수 있어요',
  not_found: '방송을 찾을 수 없어요',
  title_required: '제목을 입력해주세요',
  past_time: '지난 시간은 선택할 수 없어요',
}

interface Options {
  draft: Draft
  schedule: Schedule
  setDraft: Dispatch<SetStateAction<Draft>>
  setSchedule: Dispatch<SetStateAction<Schedule>>
  setShowForm: (open: boolean) => void
  setSaving: (saving: boolean) => void
  showToast: (text: string) => void
  reload: () => Promise<void>
  onUnauthorized: () => void
}

export function useLiveEdit(o: Options) {
  const [editingId, setEditingId] = useState<number | null>(null)

  const openEdit = (b: BroadcastRow) => {
    o.setDraft({ title: b.title, description: b.description ?? '', thumbnail_url: b.thumbnail_url, thumb_file: null })
    o.setSchedule(b.scheduled_at ? scheduleFromIso(b.scheduled_at) : defaultSchedule())
    setEditingId(b.id)
    o.setShowForm(true)
  }

  const closeEdit = () => {
    setEditingId(null)
    o.setDraft(EMPTY)
    o.setSchedule(defaultSchedule())
  }

  const submitEdit = async () => {
    if (editingId === null) return
    if (!o.draft.title.trim()) { o.showToast('방송 제목을 입력해주세요'); return }
    const scheduledAt = new Date(`${o.schedule.date}T${o.schedule.hour}:${o.schedule.minute}:00`)
    if (Number.isNaN(scheduledAt.getTime())) { o.showToast('방송 날짜를 선택해주세요'); return }
    if (scheduledAt.getTime() < Date.now()) { o.showToast('지난 시간은 선택할 수 없어요'); return }
    o.setSaving(true)
    try {
      let newThumbnailUrl: string | undefined
      let thumbFailed = false
      const file = o.draft.thumb_file
      if (file) {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.id) {
            const ext = file.type === 'image/png' ? 'png' : (file.name.split('.').pop() || 'jpg')
            const path = `${user.id}/live/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('live-thumbnails').upload(path, file, { upsert: true })
            if (uploadError) {
              console.error('[OwnerLiveSection] 썸네일 업로드 실패', uploadError)
              thumbFailed = true
            } else {
              newThumbnailUrl = supabase.storage.from('live-thumbnails').getPublicUrl(path).data?.publicUrl || undefined
            }
          } else thumbFailed = true
        } catch (e) {
          console.error('[OwnerLiveSection] 썸네일 업로드 실패', e)
          thumbFailed = true
        }
      }
      const res = await fetch('/api/live/update-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id: editingId,
          title: o.draft.title.trim(),
          description: o.draft.description.trim() || null,
          scheduled_at: scheduledAt.toISOString(),
          thumbnail_url: newThumbnailUrl,
        }),
      })
      if (res.status === 401) { o.onUnauthorized(); return }
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        o.showToast(EDIT_ERRORS[json?.error] ?? '수정에 실패했어요')
        if (json?.error === 'not_editable' || json?.error === 'not_found') {
          o.setShowForm(false)
          closeEdit()
          await o.reload()
        }
        return
      }
      o.showToast(thumbFailed ? '썸네일 업로드에 실패했어요. 수정에서 다시 올려 주세요' : '방송을 수정했어요')
      o.setShowForm(false)
      closeEdit()
      await o.reload()
    } catch (e) {
      console.error('[OwnerLiveSection] 방송 수정 오류', e)
      o.showToast('수정에 실패했어요')
    } finally {
      o.setSaving(false)
    }
  }

  return { editingId, openEdit, closeEdit, submitEdit }
}
