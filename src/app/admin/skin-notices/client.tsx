'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SkinNoticesClient({ notices: initial }: { notices: any[] }) {
  const supabase = createClient()
  const [tab, setTab] = useState<'notice'|'tip'>('notice')
  const [notices, setNotices] = useState(initial)
  const [msg, setMsg] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2000) }
  const filtered = notices.filter(n => n.type === tab)

  const add = async () => {
    if (!msg.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('today_skin_notices')
      .insert({ message: msg.trim(), type: tab, is_active: true, starts_at: startsAt || null, ends_at: endsAt || null })
      .select().single()
    setSaving(false)
    if (error) return showToast('저장 실패')
    setNotices([data, ...notices])
    setMsg(''); setStartsAt(''); setEndsAt('')
    showToast('추가됐어요 ✦')
  }

  const toggle = async (id: string, cur: boolean) => {
    await supabase.from('today_skin_notices').update({ is_active: !cur }).eq('id', id)
    setNotices(notices.map(n => n.id === id ? { ...n, is_active: !cur } : n))
  }

  const updateMsg = async (id: string, newMsg: string) => {
    await supabase.from('today_skin_notices').update({ message: newMsg }).eq('id', id)
    setNotices(notices.map(n => n.id === id ? { ...n, message: newMsg } : n))
    showToast('수정됐어요 ✦')
  }

  const updateDates = async (id: string, starts: string, ends: string) => {
    await supabase.from('today_skin_notices').update({ starts_at: starts || null, ends_at: ends || null }).eq('id', id)
    setNotices(notices.map(n => n.id === id ? { ...n, starts_at: starts || null, ends_at: ends || null } : n))
    showToast('기간 저장됐어요')
  }

  const remove = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('today_skin_notices').delete().eq('id', id)
    setNotices(notices.filter(n => n.id !== id))
    showToast('삭제됐어요')
  }

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#333', color: '#fff', padding: '10px 20px', borderRadius: 10, zIndex: 999, fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([['notice', "💧 TODAY'S SKIN 공지"], ['tip', '💡 전문가 팁']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
            background: tab === t ? 'var(--purple)' : 'var(--bg2)',
            color: tab === t ? '#fff' : 'var(--text3)',
          }}>{label}</button>
        ))}
      </div>

      {/* 추가 폼 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hdr">
          <div className="card-title">+ {tab === 'notice' ? "TODAY'S SKIN 공지" : '전문가 팁'} 추가</div>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={msg} onChange={e => setMsg(e.target.value)}
            placeholder={tab === 'notice' ? '예: 4월 환절기 주의보 — 장벽 케어 집중하세요' : '예: 세안 후 3초 이내 토너 바르면 수분 흡수율 2배'}
            rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
              <span>시작일</span>
              <input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
              <span>종료일</span>
              <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12 }} />
            </div>
            <button onClick={add} disabled={saving || !msg.trim()}
              style={{ padding: '7px 20px', borderRadius: 8, background: 'var(--purple)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              {saving ? '...' : '추가'}
            </button>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">📋 {tab === 'notice' ? '공지' : '전문가 팁'} 목록 ({filtered.length}개)</div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>등록된 항목이 없어요</div>
          )}
          {filtered.map(n => (
            <NoticeRow key={n.id} n={n} onToggle={toggle} onUpdateMsg={updateMsg} onUpdateDates={updateDates} onRemove={remove} />
          ))}
        </div>
      </div>
    </div>
  )
}

function NoticeRow({ n, onToggle, onUpdateMsg, onUpdateDates, onRemove }: any) {
  const [editing, setEditing] = useState(false)
  const [editMsg, setEditMsg] = useState(n.message)
  const [starts, setStarts] = useState(n.starts_at || '')
  const [ends, setEnds] = useState(n.ends_at || '')
  const [openDate, setOpenDate] = useState(false)

  const saveMsg = () => {
    if (editMsg.trim() && editMsg !== n.message) onUpdateMsg(n.id, editMsg.trim())
    setEditing(false)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* ON/OFF */}
        <button onClick={() => onToggle(n.id, n.is_active)}
          style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
            background: n.is_active ? 'var(--green)' : 'var(--bg3)',
            color: n.is_active ? '#fff' : 'var(--text3)', fontSize: 11 }}>
          {n.is_active ? 'ON' : 'OFF'}
        </button>

        {/* 멘트 인라인 편집 */}
        <div style={{ flex: 1 }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <textarea
                value={editMsg}
                onChange={e => setEditMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveMsg() } if (e.key === 'Escape') setEditing(false) }}
                autoFocus
                rows={2}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--purple)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, resize: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button onClick={saveMsg} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--purple)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}>저장</button>
                <button onClick={() => { setEditMsg(n.message); setEditing(false) }} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bg3)', color: 'var(--text3)', border: 'none', cursor: 'pointer', fontSize: 11 }}>취소</button>
              </div>
            </div>
          ) : (
            <div onClick={() => setEditing(true)} style={{ fontSize: 13, color: n.is_active ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, marginBottom: 4, cursor: 'text', padding: '2px 4px', borderRadius: 4 }}
              title="클릭하여 수정">
              {n.message}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {n.starts_at || n.ends_at
              ? `${n.starts_at || '제한없음'} ~ ${n.ends_at || '제한없음'}`
              : '기간 제한 없음'}
            {' · '}
            <span style={{ cursor: 'pointer', color: 'var(--purple)' }} onClick={() => setOpenDate(!openDate)}>
              기간 수정
            </span>
          </div>
          {openDate && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={starts} onChange={e => setStarts(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 11 }} />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>~</span>
              <input type="date" value={ends} onChange={e => setEnds(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 11 }} />
              <button onClick={() => { onUpdateDates(n.id, starts, ends); setOpenDate(false) }}
                style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--purple)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}>
                저장
              </button>
              <button onClick={() => setOpenDate(false)}
                style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--bg3)', color: 'var(--text3)', border: 'none', cursor: 'pointer', fontSize: 11 }}>
                취소
              </button>
            </div>
          )}
        </div>

        {/* 삭제 */}
        <button onClick={() => onRemove(n.id)}
          style={{ padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
            background: 'var(--red)', color: '#fff', fontSize: 11 }}>
          삭제
        </button>
      </div>
    </div>
  )
}
