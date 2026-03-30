'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function sortNotices(list: any[]) {
  return [...list].sort((a, b) => {
    const aUrgent = String(a?.type || '') === 'urgent' ? 1 : 0
    const bUrgent = String(b?.type || '') === 'urgent' ? 1 : 0
    if (aUrgent !== bUrgent) return bUrgent - aUrgent
    const aTime = new Date(a?.created_at || 0).getTime()
    const bTime = new Date(b?.created_at || 0).getTime()
    return bTime - aTime
  })
}

export default function AdminNoticesPage() {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [important, setImportant] = useState(false)
  const [noticeType, setNoticeType] = useState('general')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(50)
    setItems(sortNotices(data || []))
  }

  useEffect(() => {
    void loadNotices()
  }, [])

  const saveNotice = async () => {
    if (!title.trim()) return
    setLoading(true)
    await supabase.from('notices').insert({
      title: title.trim(),
      body: body.trim() || null,
      is_important: important,
      type: noticeType,
    })
    setTitle('')
    setBody('')
    setImportant(false)
    setNoticeType('general')
    await loadNotices()
    setLoading(false)
  }

  const removeNotice = async (id: string) => {
    await supabase.from('notices').delete().eq('id', id)
    await loadNotices()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0B09', color: '#fff', padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 18, marginBottom: 12 }}>공지 관리</div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목"
            style={{ width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="공지 내용"
            rows={5}
            style={{ width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12 }}>
            <input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)} />
            중요 공지
          </label>
          <select
            value={noticeType}
            onChange={e => setNoticeType(e.target.value)}
            style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
          >
            <option value="general" style={{ background: '#1a1a1a' }}>일반</option>
            <option value="event" style={{ background: '#1a1a1a' }}>이벤트</option>
            <option value="feature" style={{ background: '#1a1a1a' }}>기능업데이트</option>
            <option value="brand" style={{ background: '#1a1a1a' }}>브랜드입점</option>
            <option value="urgent" style={{ background: '#1a1a1a' }}>긴급</option>
          </select>
          <button
            type="button"
            onClick={() => void saveNotice()}
            disabled={loading}
            style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 13, cursor: 'pointer' }}
          >
            저장
          </button>
        </div>

        <div style={{ display: 'grid', gap: 8, background: '#1a3a1a', borderRadius: 12, padding: 12, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08))", backgroundSize: '3px 3px, 100% 100%', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.25)', fontFamily: "'Courier New', monospace" }}>
          {items.map((n, idx) => (
            <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', paddingTop: 2 }}>{idx + 1}</div>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
                {n.is_important ? <div style={{ display: 'inline-block', marginBottom: 6, background: '#7B5EA7', borderRadius: 10, padding: '2px 8px', fontSize: 10 }}>중요</div> : null}
                <div style={{ fontSize: 13, marginBottom: 4, color: '#fff' }}>{n.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>{n.body || ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{n.created_at ? String(n.created_at).slice(0, 10) : ''}</div>
                  <button
                    type="button"
                    onClick={() => void removeNotice(n.id)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
