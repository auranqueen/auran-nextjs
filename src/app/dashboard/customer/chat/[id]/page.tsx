'use client'

import { compressImage } from '@/lib/imageUpload'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

const VALID_TYPES = new Set(['skin', 'routine', 'recommend', 'photo', 'sample', 'sos'])

const TYPE_PROMPTS: Record<string, string> = {
  skin: '오늘 피부 고민이 있으세요?',
  routine: '보유 제품으로 루틴 정리해드릴게요! 어떤 시간대가 필요하세요?',
  recommend: '어떤 고민을 해결하고 싶으세요?',
  photo: '사진 1장만 올려주세요. 원장님이 확인 후 답변드려요!',
  sample: '어떤 샘플이 필요하세요? 원장님 승인 후 다음 주문에 동봉해드려요',
  sos: '어떤 상황이에요? 즉시 도와드릴게요!',
}

const HELP_ITEMS: { key: string; label: string; sub: string; icon: string }[] = [
  { key: 'skin', label: '오늘 피부 고민', sub: 'AI 즉시 답변', icon: '✨' },
  { key: 'routine', label: '루틴 재배치', sub: '보유 제품 기반', icon: '📋' },
  { key: 'recommend', label: '제품 추천', sub: '피부타입 매핑', icon: '💜' },
  { key: 'photo', label: '사진 상담', sub: '조용한 상담', icon: '📷' },
  { key: 'sample', label: '샘플 받기', sub: '원장님 승인', icon: '🎁' },
  { key: 'sos', label: '피부 SOS', sub: '즉시 원장님 연결', icon: '🆘' },
]

type MsgRow = {
  id: string
  channel_id: string
  user_id: string
  body?: string | null
  content?: string | null
  image_url?: string | null
  is_from_customer?: boolean | null
  message_kind?: string | null
  created_at: string
  coupon_title?: string | null
  coupon_subtitle?: string | null
}

type RoutineCardRow = {
  id: string
  channel_id?: string | null
  user_id?: string | null
  title?: string | null
  body?: string | null
  created_at?: string | null
}

function msgText(m: MsgRow): string {
  return String(m.body ?? m.content ?? '').trim()
}

export default function CustomerChatRoomPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const channelId = params?.id ? String(params.id) : ''

  const fileRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rtRef = useRef<any>(null)
  const openedTypeSheetKeyRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [channelTitle, setChannelTitle] = useState('상담')
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [routineCards, setRoutineCards] = useState<RoutineCardRow[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [helpSheetOpen, setHelpSheetOpen] = useState(false)

  const typeParam = searchParams.get('type')
  const seedLine = useMemo(() => {
    if (!typeParam || !VALID_TYPES.has(typeParam)) return null
    return TYPE_PROMPTS[typeParam] ?? null
  }, [typeParam])

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    scrollBottom()
  }, [messages, routineCards, scrollBottom])

  useEffect(() => {
    openedTypeSheetKeyRef.current = null
  }, [channelId])

  useEffect(() => {
    if (loading || forbidden) return
    if (!seedLine || !typeParam) return
    const k = `${channelId}:${typeParam}`
    if (openedTypeSheetKeyRef.current === k) return
    openedTypeSheetKeyRef.current = k
    setHelpSheetOpen(true)
  }, [loading, forbidden, seedLine, typeParam, channelId])

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
        router.replace('/login?role=customer')
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) {
        router.replace('/login?role=customer')
        return
      }
      const uid = String(urow.id)
      if (cancelled) return
      setInternalUserId(uid)

      const { data: ch, error: chErr } = await supabase
        .from('chat_channels')
        .select('id,title,user_id')
        .eq('id', channelId)
        .eq('user_id', uid)
        .maybeSingle()

      if (cancelled) return
      if (chErr || !ch) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setChannelTitle(String(ch.title || '상담'))

      await supabase.from('chat_channels').update({ unread_count: 0 }).eq('id', channelId).eq('user_id', uid)

      const { data: msgs } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      setMessages((msgs || []) as MsgRow[])

      const { data: rc } = await supabase
        .from('routine_cards')
        .select('id,channel_id,user_id,title,body,created_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (cancelled) return
      setRoutineCards((rc || []) as RoutineCardRow[])

      const rt = supabase.channel(`consultation_messages:${channelId}`)
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
  }, [channelId])

  const sendText = async () => {
    const text = draft.trim()
    if (!text || !internalUserId || !channelId || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        user_id: internalUserId,
        body: text,
        is_from_customer: true,
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
    if (!file || !internalUserId || !channelId || sending) return
    setSending(true)
    try {
      const compressed = await compressImage(file, 'community')
      const path = `consultation-chat/${internalUserId}/${channelId}/${Date.now()}_${compressed.name.replace(/[^\w.-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('community').upload(path, compressed, { upsert: true })
      if (upErr) return
      const { data: pub } = supabase.storage.from('community').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) return
      await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        user_id: internalUserId,
        body: null,
        image_url: url,
        is_from_customer: true,
        message_kind: 'image',
      } as any)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, padding: 24, fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontSize: 13 }}>
        <p style={{ marginBottom: 16 }}>채팅방을 열 수 없어요</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/customer/chat')}
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
          목록으로
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
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
            onClick={() => router.push('/dashboard/customer/chat')}
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
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {routineCards.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 8 }}>루틴 알림장</div>
            {routineCards.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${PURPLE}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 8,
                  background: 'rgba(123,94,167,0.06)',
                }}
              >
                <div style={{ fontSize: 13, color: '#fff', marginBottom: 6 }}>{c.title || '루틴'}</div>
                <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>{c.body || ''}</div>
              </div>
            ))}
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = Boolean(m.is_from_customer)
          const isCoupon = m.message_kind === 'coupon'
          const isImage = m.message_kind === 'image' && m.image_url

          if (isCoupon) {
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div
                  style={{
                    maxWidth: '85%',
                    borderRadius: 12,
                    border: `1px solid ${GOLD}`,
                    padding: '10px 12px',
                    background: 'rgba(201,169,110,0.08)',
                  }}
                >
                  <div style={{ fontSize: 12, color: GOLD, marginBottom: 4 }}>쿠폰</div>
                  <div style={{ fontSize: 13, color: '#fff' }}>{m.coupon_title || msgText(m) || '쿠폰이 도착했어요'}</div>
                  {m.coupon_subtitle ? (
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{m.coupon_subtitle}</div>
                  ) : null}
                </div>
              </div>
            )
          }

          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div
                style={{
                  maxWidth: '85%',
                  borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '10px 12px',
                  background: mine ? 'rgba(123,94,167,0.45)' : 'rgba(255,255,255,0.08)',
                  border: mine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url!} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                ) : (
                  <div style={{ fontSize: 13, color: mine ? '#f3e9ff' : '#fff', lineHeight: 1.5 }}>{msgText(m)}</div>
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
        <button
          type="button"
          onClick={() => setHelpSheetOpen(true)}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '10px 14px',
            borderRadius: 12,
            border: `1px solid rgba(123,94,167,0.35)`,
            background: 'rgba(123,94,167,0.1)',
            color: '#e8dff5',
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          어떤 도움이 필요하세요? +
        </button>
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

      {helpSheetOpen ? (
        <>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setHelpSheetOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              border: 'none',
              padding: 0,
              margin: 0,
              background: 'rgba(0,0,0,0.55)',
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              maxHeight: '72vh',
              overflowY: 'auto',
              background: '#16131a',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderTop: `1px solid rgba(123,94,167,0.35)`,
              padding: '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 12, textAlign: 'center' }}>도움받기</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {HELP_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={async () => {
                    const text = TYPE_PROMPTS[item.key]
                    if (!text || !internalUserId || !channelId || sending) {
                      setHelpSheetOpen(false)
                      return
                    }
                    setHelpSheetOpen(false)
                    setSending(true)
                    try {
                      await supabase.from('consultation_messages').insert({
                        channel_id: channelId,
                        user_id: internalUserId,
                        body: text,
                        is_from_customer: true,
                        message_kind: 'text',
                      } as any)
                    } finally {
                      setSending(false)
                    }
                  }}
                  style={{
                    border:
                      item.key === 'sos' ? '1px solid rgba(217,79,79,0.35)' : '1px solid rgba(255,255,255,0.1)',
                    background: item.key === 'sos' ? 'rgba(217,79,79,0.08)' : 'rgba(255,255,255,0.04)',
                    borderRadius: 12,
                    padding: '12px 10px',
                    cursor: sending ? 'default' : 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: item.key === 'sos' ? '#e08080' : '#fff' }}>{item.label}</span>
                  <span style={{ fontSize: 10, color: TEXT_MUTED }}>{item.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
