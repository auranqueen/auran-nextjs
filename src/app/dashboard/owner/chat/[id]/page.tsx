'use client'

import { compressImage } from '@/lib/imageUpload'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

type MsgRow = {
  id: string
  channel_id: string
  sender_id?: string | null
  body?: string | null
  message?: string | null
  content?: string | null
  image_url?: string | null
  is_from_customer?: boolean | null
  message_kind?: string | null
  created_at: string
}

function msgText(m: MsgRow): string {
  return String(m.body ?? m.message ?? m.content ?? '').trim()
}

export default function OwnerChatRoomPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const channelId = params?.id ? String(params.id) : ''

  const fileRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rtRef = useRef<any>(null)

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [channelTitle, setChannelTitle] = useState('상담')
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoText, setMemoText] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    scrollBottom()
  }, [messages, scrollBottom])

  useEffect(() => {
    if (!channelId) {
      setLoading(false)
      setForbidden(true)
      return
    }

    let cancelled = false

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=owner')
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) {
        router.replace('/login?role=owner')
        return
      }
      const uid = String(urow.id)
      if (cancelled) return
      setOwnerUserId(uid)

      const { data: ch, error: chErr } = await supabase
        .from('chat_channels')
        .select('id,title,owner_memo')
        .eq('id', channelId)
        .maybeSingle()

      if (cancelled) return
      if (chErr || !ch) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setChannelTitle(String(ch.title || '상담'))
      setMemoText(String((ch as { owner_memo?: string | null }).owner_memo ?? ''))

      await supabase.from('chat_channels').update({ unread_count: 0 }).eq('id', channelId)

      const { data: msgs } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      setMessages((msgs || []) as MsgRow[])

      const rt = supabase.channel(`consultation_messages:owner:${channelId}`)
      ;(rt as any)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'consultation_messages', filter: `channel_id=eq.${channelId}` },
          (payload: { new?: MsgRow }) => {
            const row = payload?.new
            if (!row?.id) return
            setMessages((prev) => {
              if (prev.some((p) => p.id === row.id)) return prev
              return [...prev, row]
            })
          }
        )
        .subscribe()

      rtRef.current = rt
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
      const ch = rtRef.current
      rtRef.current = null
      if (ch) {
        void supabase.removeChannel(ch)
      }
    }
  }, [channelId, router, supabase])

  const sendText = async () => {
    const text = draft.trim()
    if (!text || !ownerUserId || !channelId || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: text,
        is_from_customer: false,
        message_kind: 'text',
      } as any)
      if (!error) setDraft('')
    } finally {
      setSending(false)
    }
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !ownerUserId || !channelId || sending) return
    setSending(true)
    try {
      const compressed = await compressImage(file, 'community')
      const path = `consultation-chat/${ownerUserId}/${channelId}/${Date.now()}_${compressed.name.replace(/[^\w.-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('community').upload(path, compressed, { upsert: true })
      if (upErr) return
      const { data: pub } = supabase.storage.from('community').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) return
      await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: null,
        image_url: url,
        is_from_customer: false,
        message_kind: 'image',
      } as any)
    } finally {
      setSending(false)
    }
  }

  const saveMemo = async () => {
    if (!channelId || memoSaving) return
    setMemoSaving(true)
    try {
      const { error } = await supabase.from('chat_channels').update({ owner_memo: memoText }).eq('id', channelId)
      if (!error) setMemoOpen(false)
    } finally {
      setMemoSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, padding: 24, fontSize: 13 }}>
        불러오는 중...
      </div>
    )
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontSize: 13 }}>
        <p style={{ marginBottom: 16 }}>채팅방을 열 수 없어요</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner')}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: `1px solid ${PURPLE}`,
            background: 'rgba(123,94,167,0.15)',
            color: '#e8dff5',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          대시보드로
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'linear-gradient(160deg,#0a0c0f,#111318)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            aria-label="목록으로"
            onClick={() => router.push('/dashboard/owner')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ‹
          </button>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 16,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {channelTitle}
          </div>
          <button
            type="button"
            aria-label="원장 메모"
            onClick={() => setMemoOpen(true)}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid rgba(123,94,167,0.45)`,
              background: 'rgba(123,94,167,0.18)',
              color: '#e8dff5',
              fontSize: 13,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            📝
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#e8dff5', border: '1px solid rgba(123,94,167,0.45)', background: 'rgba(123,94,167,0.2)', borderRadius: 999, padding: '4px 10px' }}>
          원장
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {messages.map((m) => {
          const mine = !m.is_from_customer
          const isImage = m.message_kind === 'image' && m.image_url
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div
                style={{
                  maxWidth: '85%',
                  borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '10px 12px',
                  background: mine ? 'rgba(123,94,167,0.45)' : 'rgba(201,169,110,0.15)',
                  border: mine ? 'none' : '1px solid rgba(201,169,110,0.3)',
                }}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url!} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                ) : (
                  <div style={{ fontSize: 13, color: mine ? '#f3e9ff' : '#f5e6c8', lineHeight: 1.5 }}>{msgText(m)}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, transparent, #0D0B09 28%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: `1px solid rgba(123,94,167,0.35)`,
              background: 'rgba(123,94,167,0.12)',
              color: PURPLE,
              fontSize: 18,
              cursor: sending ? 'default' : 'pointer',
            }}
            aria-label="사진"
          >
            🖼
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="메시지를 입력하세요"
            rows={1}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              resize: 'none',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 13,
              padding: '10px 12px',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendText()
              }
            }}
          />
          <button
            type="button"
            onClick={() => void sendText()}
            disabled={sending || !draft.trim()}
            style={{
              flexShrink: 0,
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: sending || !draft.trim() ? 'rgba(123,94,167,0.25)' : PURPLE,
              color: '#fff',
              fontSize: 13,
              cursor: sending || !draft.trim() ? 'default' : 'pointer',
            }}
          >
            보내기
          </button>
        </div>
      </div>

      {memoOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: 14,
              border: '1px solid rgba(123,94,167,0.35)',
              background: '#151218',
              padding: 16,
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 10 }}>원장님만 볼 수 있는 메모예요</div>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
                resize: 'vertical',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMemoOpen(false)}
                disabled={memoSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: TEXT_MUTED,
                  fontSize: 13,
                  cursor: memoSaving ? 'default' : 'pointer',
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void saveMemo()}
                disabled={memoSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: memoSaving ? 'rgba(123,94,167,0.35)' : PURPLE,
                  color: '#fff',
                  fontSize: 13,
                  cursor: memoSaving ? 'default' : 'pointer',
                }}
              >
                {memoSaving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
