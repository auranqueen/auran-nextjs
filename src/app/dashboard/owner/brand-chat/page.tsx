'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandChatThreadLite, {
  type OwnerBrandChatChannel,
  type OwnerBrandChatMessage,
} from '@/components/owner/BrandChatThreadLite'

const BG = '#ffffff'
const SURFACE = '#f9f8fc'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const TEXT_SUB = '#888888'
const PURPLE = '#7B5EA7'

export default function OwnerBrandChatPage() {
  const supabase = createClient()
  const [channels, setChannels] = useState<OwnerBrandChatChannel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<OwnerBrandChatMessage[]>([])

  const loadChannels = useCallback(async () => {
    const res = await fetch('/api/owner/chat/channels')
    const json = await res.json().catch(() => ({}))
    if (json.ok) setChannels((json.channels || []) as OwnerBrandChatChannel[])
  }, [])

  const loadMessages = useCallback(async (channelId: string) => {
    const res = await fetch(`/api/owner/chat/messages?channel_id=${encodeURIComponent(channelId)}`)
    const json = await res.json().catch(() => ({}))
    if (json.ok) {
      setMessages((json.messages || []) as OwnerBrandChatMessage[])
      void loadChannels()
    }
  }, [loadChannels])

  useEffect(() => { void loadChannels() }, [loadChannels])
  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    void loadMessages(selectedId)
  }, [selectedId, loadMessages])

  const selected = channels.find((c) => c.id === selectedId) || null

  const onSend = async (text: string) => {
    if (!selectedId) return
    const res = await fetch('/api/owner/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: selectedId, message_type: 'text', body: text }),
    })
    const json = await res.json().catch(() => ({}))
    if (json.ok && json.message) {
      setMessages((prev) => [...prev, json.message])
      void loadChannels()
    }
  }

  const onSendAttachment = async (file: File) => {
    if (!selectedId) return
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `chat/${selectedId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
    if (error) return
    const { data: pub } = supabase.storage.from('brand-assets').getPublicUrl(path)
    const url = pub?.publicUrl
    if (!url) return
    const res = await fetch('/api/owner/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: selectedId,
        message_type: 'attachment',
        body: '',
        attachment_url: url,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (json.ok && json.message) {
      setMessages((prev) => [...prev, json.message])
      void loadChannels()
    }
  }

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: SURFACE, padding: 16 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: TEXT, margin: '0 0 14px' }}>브랜드 상담</h1>
      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 100px)', minHeight: 420 }}>
        <div style={{
          width: 260, flexShrink: 0, overflowY: 'auto', background: BG,
          border: `1px solid ${BORDER}`, borderRadius: 12, padding: 8,
        }}>
          {channels.length === 0 ? (
            <div style={{ padding: 16, color: TEXT_SUB, fontSize: 12, textAlign: 'center' }}>연결된 브랜드사가 없어요</div>
          ) : channels.map((ch) => {
            const active = ch.id === selectedId
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedId(ch.id)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center',
                  padding: '10px', marginBottom: 6, borderRadius: 10, cursor: 'pointer',
                  border: active ? `1px solid ${PURPLE}` : `1px solid ${BORDER}`,
                  background: active ? 'rgba(123,94,167,0.08)' : BG,
                }}
              >
                {ch.logo_url ? (
                  <img src={ch.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: '#EDE9F7', color: PURPLE,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  }}>
                    {(ch.company_name || '?').slice(0, 1)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.company_name}
                    </span>
                    {ch.unread_by_owner > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, background: '#e85555', color: '#fff',
                        borderRadius: 999, padding: '1px 6px',
                      }}>{ch.unread_by_owner}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.last_message || '대화 시작하기'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <BrandChatThreadLite
          channel={selected}
          messages={messages}
          onSend={onSend}
          onSendAttachment={onSendAttachment}
        />
      </div>
    </div>
  )
}
