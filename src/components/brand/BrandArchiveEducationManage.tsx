'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

interface Props {
  companyId: string
  staffId: string | null
}

interface SessionRow {
  id: string
  title: string
  session_date: string
  start_time: string
  end_time: string
  format: string
  location?: string | null
  link?: string | null
  capacity?: number | null
  asset_url?: string | null
  applied_count?: number
}

interface ApplicationRow {
  id: string
  owner_id: string
  applied_at: string
  owner_name: string | null
  salon_name: string | null
}

const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
}
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const INPUT: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function BrandArchiveEducationManage({ companyId, staffId }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [format, setFormat] = useState<'offline' | 'online'>('offline')
  const [location, setLocation] = useState('')
  const [link, setLink] = useState('')
  const [capacity, setCapacity] = useState(30)
  const [assetUrl, setAssetUrl] = useState('')
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [apps, setApps] = useState<ApplicationRow[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/brand/education/sessions/list?company_id=${encodeURIComponent(companyId)}`,
      )
      const json = await res.json()
      if (json?.ok) setSessions(json.sessions || [])
      else showToast(json?.error || '세션 목록 실패')
    } catch {
      showToast('세션 목록 실패')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  const loadApps = async (sessionId: string) => {
    setAppsLoading(true)
    setApps([])
    try {
      const qs = new URLSearchParams({ session_id: sessionId })
      if (staffId) qs.set('staff_id', staffId)
      const res = await fetch(`/api/brand/education/applications/list?${qs.toString()}`)
      const json = await res.json()
      if (json?.ok) setApps(json.applications || [])
      else showToast(json?.error || '신청자 목록 실패')
    } catch {
      showToast('신청자 목록 실패')
    } finally {
      setAppsLoading(false)
    }
  }

  const onToggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setApps([])
      return
    }
    setExpandedId(id)
    void loadApps(id)
  }

  const uploadEducationAsset = async (file: File, path: string) => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    let uploadFile = file
    if (!isPdf && file.type.startsWith('image/')) {
      try {
        uploadFile = await compressImage(file, 'product_detail')
      } catch {
        uploadFile = file
      }
    }
    const { data, error } = await supabase.storage.from('brand-assets').upload(path, uploadFile, { upsert: true })
    if (error || !data) throw new Error(error?.message || 'upload_failed')
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return urlData.publicUrl
  }

  const onFormAssetFile = async (file: File) => {
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `education/${companyId}-${Date.now()}.${ext}`
      const url = await uploadEducationAsset(file, path)
      setAssetUrl(url)
      showToast('파일 업로드 완료')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const attachFileToSession = async (sessionId: string, file: File) => {
    setAttachingId(sessionId)
    try {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `education/${companyId}-${sessionId}.${ext}`
      const url = await uploadEducationAsset(file, path)
      const res = await fetch('/api/brand/education/sessions/attach-file', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          company_id: companyId,
          staff_id: staffId || '',
          asset_url: url,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '첨부 저장 실패')
        return
      }
      showToast('파일 첨부 완료')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '첨부 실패')
    } finally {
      setAttachingId(null)
    }
  }

  const onSave = async () => {
    if (!title.trim() || !sessionDate || !startTime || !endTime) {
      showToast('필수 항목을 입력하세요')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/brand/education/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId || '',
          company_id: companyId,
          title: title.trim(),
          session_date: sessionDate,
          start_time: startTime,
          end_time: endTime,
          format,
          location: format === 'offline' ? location : null,
          link: format === 'online' ? link : null,
          capacity,
          asset_url: assetUrl || null,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '저장 실패')
        return
      }
      setTitle('')
      setSessionDate('')
      setStartTime('')
      setEndTime('')
      setLocation('')
      setLink('')
      setCapacity(30)
      setFormat('offline')
      setAssetUrl('')
      showToast('세션 등록 완료')
      await load()
    } catch {
      showToast('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '7px 18px',
            borderRadius: 20,
            zIndex: 999,
          }}
        >
          {toast}
        </div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>에듀케이션 세션 등록</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>제목</div>
          <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>날짜</div>
            <input type="date" style={INPUT} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>시작</div>
            <input type="time" style={INPUT} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>종료</div>
            <input type="time" style={INPUT} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setFormat('offline')}
            style={{
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 8,
              border: format === 'offline' ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.1)',
              background: format === 'offline' ? 'rgba(123,94,167,0.25)' : 'transparent',
              color: TEXT,
              cursor: 'pointer',
            }}
          >
            오프라인
          </button>
          <button
            type="button"
            onClick={() => setFormat('online')}
            style={{
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 8,
              border: format === 'online' ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.1)',
              background: format === 'online' ? 'rgba(123,94,167,0.25)' : 'transparent',
              color: TEXT,
              cursor: 'pointer',
            }}
          >
            온라인
          </button>
        </div>
        {format === 'offline' ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>장소</div>
            <input style={INPUT} value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        ) : (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>링크</div>
            <input style={INPUT} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>정원</div>
          <input
            type="number"
            style={INPUT}
            value={capacity}
            min={1}
            onChange={(e) => setCapacity(Math.trunc(Number(e.target.value)) || 30)}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: SUB }}>📎 출력용 자료 첨부 (선택)</div>
            <span
              title="💰 원장님이 바로 뽑아 써서 관리권 매출을 팡팡 올릴 수 있는 완성 자료를 넣어주세요!"
              style={{ fontSize: 12, color: SUB, cursor: 'help' }}
            >
              ❓
            </span>
          </div>
          <input
            type="file"
            accept="image/*,.pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onFormAssetFile(f)
            }}
            style={{ fontSize: 12, color: TEXT }}
          />
          {assetUrl && (
            <div style={{ fontSize: 11, color: PURPLE, marginTop: 6, wordBreak: 'break-all' }}>{assetUrl}</div>
          )}
          <div style={{ fontSize: 10, color: SUB, marginTop: 6, lineHeight: 1.45 }}>
            💰 원장님이 바로 뽑아 써서 관리권 매출을 팡팡 올릴 수 있는 완성 자료를 넣어주세요!
          </div>
        </div>
        <button
          type="button"
          disabled={saving || uploading}
          onClick={() => void onSave()}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: PURPLE,
            color: '#fff',
            fontSize: 13,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving || uploading ? 0.7 : 1,
          }}
        >
          {saving ? '저장 중…' : '세션 등록'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>세션 목록</div>
      {loading ? (
        <div style={{ color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : sessions.length === 0 ? (
        <div style={{ color: SUB, fontSize: 12 }}>등록된 세션이 없어요.</div>
      ) : (
        sessions.map((s) => (
          <div key={s.id} style={CARD}>
            <button
              type="button"
              onClick={() => onToggle(s.id)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: PURPLE, whiteSpace: 'nowrap' }}>
                  {s.applied_count ?? 0}/{s.capacity ?? '—'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
                {s.session_date} {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)} ·{' '}
                {s.format === 'online' ? '온라인' : '오프라인'}
              </div>
            </button>
            <div
              style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {s.asset_url ? (
                  <>
                    <span style={{ fontSize: 11, color: '#C9A96E' }}>📄 첨부됨</span>
                    <label
                      style={{
                        fontSize: 11,
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: `1px solid ${PURPLE}`,
                        color: '#c4a7e7',
                        cursor: attachingId === s.id ? 'wait' : 'pointer',
                        opacity: attachingId === s.id ? 0.6 : 1,
                      }}
                    >
                      {attachingId === s.id ? '업로드 중…' : '교체'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        disabled={attachingId === s.id}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          if (f) void attachFileToSession(s.id, f)
                        }}
                      />
                    </label>
                  </>
                ) : (
                  <label
                    style={{
                      fontSize: 11,
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: `1px solid ${PURPLE}`,
                      color: '#c4a7e7',
                      cursor: attachingId === s.id ? 'wait' : 'pointer',
                      opacity: attachingId === s.id ? 0.6 : 1,
                    }}
                  >
                    {attachingId === s.id ? '업로드 중…' : '📎 파일 첨부'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={attachingId === s.id}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void attachFileToSession(s.id, f)
                      }}
                    />
                  </label>
                )}
                <span
                  title="💰 원장님이 바로 뽑아 써서 관리권 매출을 팡팡 올릴 수 있는 완성 자료를 넣어주세요!"
                  style={{ fontSize: 12, color: SUB, cursor: 'help' }}
                >
                  ❓
                </span>
              </div>
            </div>
            {expandedId === s.id && (
              <div style={{ marginTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                {appsLoading ? (
                  <div style={{ fontSize: 11, color: SUB }}>신청자 불러오는 중…</div>
                ) : apps.length === 0 ? (
                  <div style={{ fontSize: 11, color: SUB }}>신청자가 없어요.</div>
                ) : (
                  apps.map((a) => (
                    <div key={a.id} style={{ fontSize: 12, color: TEXT, marginBottom: 6 }}>
                      {a.owner_name || '이름 없음'}
                      {a.salon_name ? ` · ${a.salon_name}` : ''}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
