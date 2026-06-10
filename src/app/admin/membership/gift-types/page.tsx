'use client'

import { useCallback, useEffect, useState } from 'react'

type GiftTypeRow = {
  id: string
  name: string
  emoji: string
  is_active: boolean
  order: number
  created_at: string
}

const C = {
  purple: '#7B5EA7',
  muted: '#8A7E92',
  line: 'rgba(123,94,167,0.2)',
  bg: '#0a0c0f',
  card: '#fff',
}

const EMOJI_PRESETS = ['🎂', '🎉', '💝', '🌟', '🎁', '💐', '🎊', '💜', '🌸', '✨', '🎀', '💌']

export default function AdminGiftTypesPage() {
  const [items, setItems] = useState<GiftTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<GiftTypeRow | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmoji, setFormEmoji] = useState('🎁')
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/gift-types')
    const json = await res.json().catch(() => ({}))
    setItems(json.ok ? (json.items as GiftTypeRow[]) || [] : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setFormName('')
    setFormEmoji('🎁')
    setFormActive(true)
    setModalOpen(true)
  }

  const openEdit = (row: GiftTypeRow) => {
    setEditing(row)
    setFormName(row.name)
    setFormEmoji(row.emoji || '🎁')
    setFormActive(row.is_active)
    setModalOpen(true)
  }

  const saveForm = async () => {
    if (!formName.trim()) {
      setMsg('이름을 입력해주세요')
      return
    }
    setSaving(true)
    setMsg('')
    const payload = {
      ...(editing ? { id: editing.id } : {}),
      name: formName.trim(),
      emoji: formEmoji.trim() || '🎁',
      is_active: formActive,
    }
    const res = await fetch('/api/admin/gift-types', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!json.ok) {
      setMsg(json.error || '저장 실패')
      return
    }
    setModalOpen(false)
    void load()
  }

  const remove = async (row: GiftTypeRow) => {
    if (!confirm(`"${row.name}" 타입을 삭제할까요?`)) return
    const res = await fetch('/api/admin/gift-types', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json.ok) {
      setMsg(json.error || '삭제 실패')
      return
    }
    void load()
  }

  const moveOrder = async (row: GiftTypeRow, dir: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((x) => x.id === row.id)
    const swap = sorted[idx + dir]
    if (!swap) return
    await Promise.all([
      fetch('/api/admin/gift-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, order: swap.order }),
      }),
      fetch('/api/admin/gift-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swap.id, order: row.order }),
      }),
    ])
    void load()
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    fontSize: 11,
    color: C.muted,
    padding: '10px 12px',
    borderBottom: `1px solid ${C.line}`,
    fontWeight: 500,
  }
  const td: React.CSSProperties = {
    fontSize: 13,
    color: '#2A2433',
    padding: '12px',
    borderBottom: `1px solid ${C.line}`,
    verticalAlign: 'middle',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#e8e0f5', padding: '20px 16px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, color: '#C9A96E', letterSpacing: 1 }}>ORÆN PRIVÉ · 선물 타입 관리</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>멤버십 선물 발송·상담톡에 쓰이는 타입을 관리해요</div>
          </div>
          <button
            type="button"
            onClick={openAdd}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: C.purple, color: '#fff', fontSize: 13, cursor: 'pointer' }}
          >
            + 추가
          </button>
        </div>

        {msg ? (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(217,79,79,0.12)', color: '#e08080', fontSize: 12 }}>
            {msg}
          </div>
        ) : null}

        <div style={{ background: C.card, borderRadius: 12, overflow: 'hidden', border: `0.5px solid ${C.line}` }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>불러오는 중...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13 }}>등록된 타입이 없어요</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>순서</th>
                  <th style={th}>이모지</th>
                  <th style={th}>이름</th>
                  <th style={th}>활성</th>
                  <th style={th}>관리</th>
                </tr>
              </thead>
              <tbody>
                {[...items].sort((a, b) => a.order - b.order).map((row) => (
                  <tr key={row.id}>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => void moveOrder(row, -1)} style={miniBtn}>↑</button>
                        <button type="button" onClick={() => void moveOrder(row, 1)} style={miniBtn}>↓</button>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>{row.order}</span>
                      </div>
                    </td>
                    <td style={{ ...td, fontSize: 20 }}>{row.emoji}</td>
                    <td style={td}>{row.name}</td>
                    <td style={td}>{row.is_active ? '✅' : '—'}</td>
                    <td style={td}>
                      <button type="button" onClick={() => openEdit(row)} style={{ ...miniBtn, marginRight: 6 }}>수정</button>
                      <button type="button" onClick={() => void remove(row)} style={{ ...miniBtn, color: '#A33' }}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 400, background: '#1a1a22', borderRadius: 14, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, color: '#C9A96E', marginBottom: 16 }}>{editing ? '타입 수정' : '타입 추가'}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>이름</div>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: 생일 축하"
              style={fieldStyle}
            />
            <div style={{ fontSize: 11, color: C.muted, margin: '12px 0 6px' }}>이모지</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setFormEmoji(em)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: formEmoji === em ? `2px solid ${C.purple}` : '1px solid rgba(255,255,255,0.12)',
                    background: formEmoji === em ? 'rgba(123,94,167,0.2)' : 'transparent',
                    fontSize: 18,
                    cursor: 'pointer',
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
            <input value={formEmoji} onChange={(e) => setFormEmoji(e.target.value)} maxLength={8} style={fieldStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#e8e0f5', cursor: 'pointer' }}>
              <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
              활성 (선물 발송 시 선택 가능)
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 9, border: '1px solid #444', background: 'transparent', color: '#aaa', cursor: 'pointer' }}>
                취소
              </button>
              <button type="button" disabled={saving} onClick={() => void saveForm()} style={{ flex: 1, padding: 12, borderRadius: 9, border: 'none', background: C.purple, color: '#fff', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 6,
  border: '0.5px solid rgba(123,94,167,0.3)',
  background: 'transparent',
  color: '#7B5EA7',
  fontSize: 11,
  cursor: 'pointer',
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(123,94,167,0.3)',
  background: '#111',
  color: '#e8e0f5',
  fontSize: 13,
  outline: 'none',
}
