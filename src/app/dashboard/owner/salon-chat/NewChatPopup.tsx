'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const BORDER = '#ede9f7'

type Props = {
  open: boolean
  onClose: () => void
  ownerId: string
  preselectedCustomer?: any
  onCreated: (channelId: string) => void
}

type ExtCustomer = {
  id: string
  name: string
  phone?: string | null
  auran_user_id?: string | null
}

export default function NewChatPopup({ open, onClose, ownerId, preselectedCustomer, onCreated }: Props) {
  const supabaseRef = useRef(createClient())
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ExtCustomer[]>([])
  const [selected, setSelected] = useState<ExtCustomer | null>(null)
  const [firstMessage, setFirstMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setFirstMessage('')
    if (preselectedCustomer?.id) {
      setSelected({
        id: String(preselectedCustomer.id),
        name: String(preselectedCustomer.name || '고객'),
        phone: preselectedCustomer.phone ?? null,
        auran_user_id: preselectedCustomer.auran_user_id ?? null,
      })
    } else {
      setSelected(null)
    }
  }, [open, preselectedCustomer?.id, preselectedCustomer?.name, preselectedCustomer?.phone, preselectedCustomer?.auran_user_id])

  useEffect(() => {
    if (!open || preselectedCustomer?.id || !ownerId) return
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabaseRef.current
        .from('external_customers')
        .select('id,name,phone,auran_user_id')
        .ilike('name', `%${q}%`)
        .eq('owner_id', ownerId)
        .limit(10)
      if (!cancelled) {
        setResults((data as ExtCustomer[]) || [])
        setSearching(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, query, ownerId, preselectedCustomer?.id])

  const startChat = async () => {
    const customer = selected
    if (!customer?.id || !ownerId || saving) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const msg = firstMessage.trim()
      const lastMsg = msg || '상담이 시작되었어요'
      const { data: ch, error: chErr } = await supabaseRef.current
        .from('chat_channels')
        .insert({
          owner_id: ownerId,
          user_id: customer.auran_user_id || null,
          external_customer_id: customer.id || null,
          channel_type: 'salon',
          title: `${customer.name}님 상담`,
          last_message: lastMsg,
          last_message_at: now,
          unread_count: 0,
        } as any)
        .select('id')
        .single()
      if (chErr || !ch?.id) return
      if (msg) {
        await supabaseRef.current.from('messages').insert({
          channel_id: ch.id,
          sender_id: ownerId,
          sender_type: 'owner',
          body: msg,
          is_from_customer: false,
          message_kind: 'text',
        } as any)
      }
      onCreated(String(ch.id))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const locked = !!preselectedCustomer?.id

  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 220 }} />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 360,
          maxWidth: 'calc(100% - 32px)',
          background: BG,
          borderRadius: 16,
          zIndex: 230,
          padding: 20,
          boxShadow: '0 8px 32px rgba(26,26,46,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>새 상담 시작</span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, minWidth: 44, minHeight: 44, cursor: 'pointer', color: TEXT }}>
            ×
          </button>
        </div>
        <label style={{ fontSize: 12, color: SUB, display: 'block', marginBottom: 6 }}>고객 선택</label>
        {locked && selected ? (
          <div style={{ height: 48, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 15, background: '#f9f8fc', marginBottom: 12 }}>
            {selected.name}
          </div>
        ) : (
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              value={selected && !query ? selected.name : query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(null)
              }}
              placeholder="고객 이름 검색"
              style={{ width: '100%', boxSizing: 'border-box', height: 48, borderRadius: 10, border: `1px solid ${BORDER}`, padding: '0 14px', fontSize: 15, background: BG }}
            />
            {(results.length > 0 || searching) && !selected ? (
              <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, maxHeight: 200, overflowY: 'auto', zIndex: 1 }}>
                {searching ? (
                  <div style={{ padding: 12, fontSize: 13, color: SUB }}>검색 중…</div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelected(r)
                        setQuery('')
                        setResults([])
                      }}
                      style={{ width: '100%', border: 'none', background: BG, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontSize: 14, borderBottom: `1px solid ${BORDER}` }}
                    >
                      {r.name}
                      {r.phone ? <span style={{ color: SUB, fontSize: 12, marginLeft: 8 }}>{r.phone}</span> : null}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )}
        <label style={{ fontSize: 12, color: SUB, display: 'block', marginBottom: 6 }}>첫 메시지 (선택)</label>
        <textarea
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={3}
          placeholder={'안녕하세요! 궁금하신 점을 남겨주시면\n 원장님이 확인 후 답변 드릴게요 💜'}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${BORDER}`, padding: 12, fontSize: 14, lineHeight: 1.5, resize: 'none', background: BG, marginBottom: 16 }}
        />
        <button
          type="button"
          disabled={!selected || saving}
          onClick={() => void startChat()}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 10,
            border: 'none',
            background: !selected || saving ? '#c4b8dc' : PURPLE,
            color: '#fff',
            fontSize: 15,
            fontWeight: 500,
            cursor: !selected || saving ? 'default' : 'pointer',
          }}
        >
          {saving ? '시작 중…' : '시작하기'}
        </button>
      </div>
    </>
  )
}
