'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = '#EEEDFE'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const BORDER = '#ede9f7'

type ChannelRow = {
  id: string
  title?: string | null
  last_message?: string | null
  last_message_at?: string | null
  unread_count?: number | null
  channel_type?: string | null
  user_id?: string | null
  external_customer_id?: string | null
  external_customers?: { name?: string | null; phone?: string | null } | { name?: string | null; phone?: string | null }[] | null
  users?: { name?: string | null } | { name?: string | null }[] | null
}

type Props = {
  open: boolean
  onClose: () => void
  ownerId: string
  onOpenChat: (channelId: string) => void
  onNewChat: (customer: any) => void
}

function relOne(v: { name?: string | null } | { name?: string | null }[] | null | undefined) {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function customerName(ch: ChannelRow) {
  const ext = relOne(ch.external_customers)
  if (ch.external_customer_id && ext?.name) return String(ext.name)
  const u = relOne(ch.users)
  if (ch.user_id && u?.name) return String(u.name)
  return String(ch.title || '고객').replace(/님 상담$/, '')
}

function initials(name: string) {
  return String(name || '고').slice(0, 1)
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function SalonChatListPopup({ open, onClose, ownerId, onOpenChat, onNewChat }: Props) {
  const supabaseRef = useRef(createClient())
  const [channels, setChannels] = useState<ChannelRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !ownerId) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const { data } = await supabaseRef.current
        .from('chat_channels')
        .select(`
          id, title, last_message, last_message_at,
          unread_count, channel_type, user_id,
          external_customer_id,
          external_customers(name, phone),
          users(name)
        `)
        .eq('owner_id', ownerId)
        .eq('channel_type', 'salon')
        .order('last_message_at', { ascending: false })
      if (!cancelled) {
        setChannels((data as ChannelRow[]) || [])
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [open, ownerId])

  if (!open) return null

  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
      <div
        className="salon-chat-list-popup"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: 380,
          maxWidth: '100%',
          background: BG,
          zIndex: 210,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(26,26,46,0.12)',
        }}
      >
        <style>{`@media (max-width:768px){.salon-chat-list-popup{width:100%!important}}`}</style>
        <div style={{ padding: '16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 500, flex: 1 }}>샵 상담톡</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: PURPLE_LIGHT, color: PURPLE }}>{channels.length}</span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, minWidth: 44, minHeight: 44, cursor: 'pointer', color: TEXT }}>
            ×
          </button>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <button
            type="button"
            onClick={() => onNewChat(null)}
            style={{ width: '100%', height: 44, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            + 새 상담 시작
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: SUB, fontSize: 13 }}>불러오는 중…</div>
          ) : channels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: SUB, fontSize: 13, lineHeight: 1.7 }}>
              아직 상담 채널이 없어요
              <br />
              고객 차트에서 상담톡을 시작해보세요 💜
            </div>
          ) : (
            channels.map((ch) => {
              const name = customerName(ch)
              const preview = String(ch.last_message || '').trim() || '대화를 시작해보세요'
              const unread = Number(ch.unread_count || 0)
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onOpenChat(ch.id)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: `1px solid ${BORDER}`,
                    background: BG,
                    padding: '14px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: PURPLE_LIGHT,
                      color: PURPLE,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {initials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{name}</div>
                    <div style={{ fontSize: 12, color: SUB, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: SUB }}>{fmtTime(ch.last_message_at)}</span>
                      {unread > 0 ? (
                        <span style={{ fontSize: 11, fontWeight: 500, background: PURPLE, color: '#fff', minWidth: 20, height: 20, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
