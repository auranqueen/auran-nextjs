'use client'

import { compressImage } from '@/lib/imageUpload'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BUBBLE_CUSTOMER = '#f0edf8'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const BORDER = '#ede9f7'

type MsgRow = {
  id: string
  channel_id: string
  sender_id?: string | null
  body?: string | null
  image_url?: string | null
  is_from_customer?: boolean | null
  message_kind?: string | null
  created_at: string
}

type ChannelRow = {
  id: string
  title?: string | null
  user_id?: string | null
  external_customer_id?: string | null
  external_customers?: { name?: string | null } | { name?: string | null }[] | null
  users?: { name?: string | null } | { name?: string | null }[] | null
}

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function SalonChatPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const channelId = params?.id ? String(params.id) : ''
  const supabaseRef = useRef(createClient())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const rtRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const [loading, setLoading] = useState(true)
  const [ownerId, setOwnerId] = useState('')
  const [customerName, setCustomerName] = useState('고객')
  const [isOraen, setIsOraen] = useState(false)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!channelId) return
    let cancelled = false
    const run = async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/login?role=owner')
        return
      }
      const { data: me } = await sb.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) {
        router.replace('/login?role=owner')
        return
      }
      if (cancelled) return
      setOwnerId(String(me.id))

      const { data: ch } = await sb
        .from('chat_channels')
        .select(`
          id, title, user_id, external_customer_id,
          external_customers(name),
          users(name)
        `)
        .eq('id', channelId)
        .maybeSingle()

      if (cancelled) return
      if (!ch) {
        setLoading(false)
        return
      }

      const row = ch as ChannelRow
      const ext = relOne(row.external_customers)
      const u = relOne(row.users)
      const name = (row.external_customer_id && ext?.name ? String(ext.name) : row.user_id && u?.name ? String(u.name) : String(row.title || '고객')).replace(/님 상담$/, '')
      setCustomerName(name)
      setIsOraen(!!row.user_id)

      await sb.from('chat_channels').update({ unread_count: 0 }).eq('id', channelId)

      const { data: msgs } = await sb.from('salon_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true })
      if (cancelled) return
      setMessages((msgs as MsgRow[]) || [])
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [channelId, router])

  useEffect(() => {
    if (!channelId) return
    const sb = supabaseRef.current
    const rt = sb
      .channel('salon-chat-' + channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'salon_messages',
          filter: 'channel_id=eq.' + channelId,
        },
        (payload) => {
          const row = payload.new as MsgRow
          if (!row?.id) return
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .subscribe()
    rtRef.current = rt
    return () => {
      if (rtRef.current) void sb.removeChannel(rtRef.current)
    }
  }, [channelId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineH = 22
    const maxH = lineH * 4 + 16
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
  }, [inputText])

  const sendText = async () => {
    const text = inputText.trim()
    if (!text || !ownerId || !channelId || sending) return
    setSending(true)
    try {
      const now = new Date().toISOString()
      await supabaseRef.current.from('salon_messages').insert({
        channel_id: channelId,
        sender_id: ownerId,
        sender_type: 'owner',
        body: text,
        is_from_customer: false,
        message_kind: 'text',
      } as any)
      await supabaseRef.current
        .from('chat_channels')
        .update({
          last_message: text,
          last_message_at: now,
          unread_count: 0,
        })
        .eq('id', channelId)
      setInputText('')
    } finally {
      setSending(false)
    }
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !ownerId || !channelId || sending) return
    setSending(true)
    try {
      const compressed = await compressImage(file, 'community')
      const path = `${ownerId}/${channelId}/${Date.now()}_${compressed.name.replace(/[^\w.-]+/g, '_')}`
      const { error: upErr } = await supabaseRef.current.storage.from('salon-chat-images').upload(path, compressed, { upsert: true })
      if (upErr) return
      const { data: pub } = supabaseRef.current.storage.from('salon-chat-images').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) return
      const now = new Date().toISOString()
      await supabaseRef.current.from('salon_messages').insert({
        channel_id: channelId,
        sender_id: ownerId,
        sender_type: 'owner',
        body: null,
        image_url: url,
        is_from_customer: false,
        message_kind: 'image',
      } as any)
      await supabaseRef.current
        .from('chat_channels')
        .update({
          last_message: '사진',
          last_message_at: now,
          unread_count: 0,
        })
        .eq('id', channelId)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 14 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, display: 'flex', flexDirection: 'column', fontWeight: 400 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: BG, borderBottom: `1px solid ${BORDER}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44, color: TEXT }}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{customerName}</div>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: isOraen ? '#e8f8ef' : '#f0edf8', color: isOraen ? '#2d8a56' : PURPLE, marginTop: 2, display: 'inline-block' }}>
            {isOraen ? '오렌 연동' : '내방 고객'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/charts-v2')}
          style={{ border: `1px solid ${BORDER}`, background: BG, borderRadius: 20, padding: '8px 12px', fontSize: 12, color: PURPLE, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          고객 차트 보기
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 8px' }}>
        {messages.map((m) => {
          const fromCustomer = !!m.is_from_customer
          const isImage = m.message_kind === 'image' && m.image_url
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: fromCustomer ? 'flex-start' : 'flex-end', marginBottom: 12 }}>
              <div style={{ maxWidth: '78%' }}>
                <div
                  style={{
                    padding: isImage ? 4 : '10px 14px',
                    borderRadius: fromCustomer ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                    background: fromCustomer ? BUBBLE_CUSTOMER : PURPLE,
                    color: fromCustomer ? TEXT : '#ffffff',
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}
                >
                  {isImage ? <img src={m.image_url!} alt="" style={{ maxWidth: '100%', borderRadius: 14, display: 'block' }} /> : String(m.body || '')}
                </div>
                <div style={{ fontSize: 11, color: SUB, marginTop: 4, textAlign: fromCustomer ? 'left' : 'right' }}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: BG, borderTop: `1px solid ${BORDER}`, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44, color: SUB }}>
          📎
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPickImage(e)} />
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={1}
          placeholder="메시지를 입력하세요"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void sendText()
            }
          }}
          style={{ flex: 1, resize: 'none', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '10px 12px', fontSize: 14, lineHeight: '22px', maxHeight: 104, background: BG, fontFamily: 'inherit' }}
        />
        <button
          type="button"
          disabled={sending || !inputText.trim()}
          onClick={() => void sendText()}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: sending || !inputText.trim() ? '#c4b8dc' : PURPLE,
            color: '#fff',
            fontSize: 18,
            cursor: sending || !inputText.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}
