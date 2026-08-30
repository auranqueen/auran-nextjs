'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandChatChannelList, { type BrandChatChannel } from './BrandChatChannelList'
import BrandChatThread, { type BrandChatMessage } from './BrandChatThread'
import BrandChatPurchaseHistory from './BrandChatPurchaseHistory'

type Props = { companyId: string; staffId: string | null }

function playBeep() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.value = 0.08
    o.start()
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    o.stop(ctx.currentTime + 0.3)
  } catch {
    /* ignore */
  }
}

export default function BrandChatPanel({ companyId, staffId }: Props) {
  const supabase = createClient()
  const [channels, setChannels] = useState<BrandChatChannel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<BrandChatMessage[]>([])
  const [showAll, setShowAll] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const unreadRef = useRef(0)

  const loadChannels = useCallback(async () => {
    const res = await fetch(`/api/brand/chat/channels?company_id=${encodeURIComponent(companyId)}`)
    const json = await res.json().catch(() => ({}))
    if (!json.ok) return
    const list = (json.channels || []) as BrandChatChannel[]
    const totalUnread = list.reduce((s, c) => s + Number(c.unread_by_brand || 0), 0)
    if (totalUnread > unreadRef.current) playBeep()
    unreadRef.current = totalUnread
    setChannels(list)
  }, [companyId])

  const loadMessages = useCallback(async (channelId: string) => {
    const res = await fetch(`/api/brand/chat/messages?channel_id=${encodeURIComponent(channelId)}`)
    const json = await res.json().catch(() => ({}))
    if (json.ok) setMessages((json.messages || []) as BrandChatMessage[])
  }, [])

  useEffect(() => { void loadChannels() }, [loadChannels])
  useEffect(() => {
    const t = setInterval(() => { void loadChannels() }, 10000)
    return () => clearInterval(t)
  }, [loadChannels])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    void loadMessages(selectedId)
  }, [selectedId, loadMessages])

  const selected = channels.find((c) => c.id === selectedId) || null

  const onSend = async (text: string) => {
    if (!selectedId) return
    const res = await fetch('/api/brand/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: selectedId,
        staff_id: staffId,
        company_id: companyId,
        message_type: 'text',
        body: text,
      }),
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
    const res = await fetch('/api/brand/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: selectedId,
        staff_id: staffId,
        company_id: companyId,
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
    <div style={{
      display: 'flex', height: 520, background: '#140f18',
      border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ width: 280, flexShrink: 0, borderRight: '0.5px solid rgba(255,255,255,0.07)' }}>
        <BrandChatChannelList
          channels={channels}
          selectedId={selectedId}
          onSelect={setSelectedId}
          showAll={showAll}
          onToggleShowAll={() => setShowAll((v) => !v)}
          companyId={companyId}
          staffId={staffId}
          onChannelStarted={async (channelId) => {
            await loadChannels()
            setSelectedId(channelId)
          }}
        />
      </div>
      <BrandChatThread
        channel={selected}
        messages={messages}
        onSend={onSend}
        onSendAttachment={onSendAttachment}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      {historyOpen && selected && (
        <BrandChatPurchaseHistory
          ownerId={selected.owner_id}
          companyId={companyId}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}
