'use client'

import { useEffect, useRef, useState } from 'react'
import type { BrandChatChannel } from './BrandChatChannelList'

export type BrandChatMessage = {
  id: string
  sender_type: 'brand' | 'owner' | string
  message_type: string
  body: string | null
  attachment_url: string | null
  created_at: string
}

type Props = {
  channel: BrandChatChannel | null
  messages: BrandChatMessage[]
  onSend: (text: string) => void | Promise<void>
  onSendAttachment: (file: File) => void | Promise<void>
  onOpenHistory: () => void
}

const QUICK = ['안녕하세요 원장님 👋', '샘플 발송했어요', '재고 확인해드릴게요', '출고 일정 안내드릴게요']
const TEXT = 'rgba(255,255,255,0.75)'
const SUB = 'rgba(255,255,255,0.35)'
const PURPLE = '#7B5EA7'

export default function BrandChatThread({
  channel, messages, onSend, onSendAttachment, onOpenHistory,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, channel?.id])

  if (!channel) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 13 }}>
        왼쪽에서 원장님을 선택하세요
      </div>
    )
  }

  const submit = async (text: string) => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await onSend(t)
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <div style={{
        padding: '10px 14px', borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: TEXT, fontWeight: 700 }}>{channel.owner_name}</div>
          <div style={{ fontSize: 11, color: SUB }}>{channel.salon_name}</div>
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
            border: '0.5px solid rgba(201,169,110,0.35)', background: 'rgba(201,169,110,0.08)', color: '#C9A96E',
          }}
        >
          구매이력
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: SUB, fontSize: 12, padding: 24 }}>첫 메시지를 보내보세요</div>
        ) : messages.map((m) => {
          const mine = m.sender_type === 'brand'
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                background: mine ? 'rgba(123,94,167,0.35)' : 'rgba(255,255,255,0.07)',
                color: TEXT, fontSize: 13, lineHeight: 1.45,
              }}>
                {m.body ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div> : null}
                {m.attachment_url ? (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: '#c4a7e7', fontSize: 12 }}>
                    📎 첨부파일 보기
                  </a>
                ) : null}
                <div style={{ fontSize: 10, color: SUB, marginTop: 4, textAlign: mine ? 'right' : 'left' }}>
                  {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void submit(q)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
              border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: SUB,
            }}
          >
            {q}
          </button>
        ))}
      </div>

      <div style={{ padding: '10px 12px 12px', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void onSendAttachment(f)
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            width: 36, height: 36, borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: TEXT, cursor: 'pointer', flexShrink: 0,
          }}
          title="첨부"
        >
          📎
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit(draft)
            }
          }}
          placeholder="메시지 입력…"
          rows={2}
          style={{
            flex: 1, resize: 'none', borderRadius: 10, padding: '8px 10px', fontSize: 13, color: TEXT,
            background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', outline: 'none',
          }}
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={() => void submit(draft)}
          style={{
            padding: '10px 14px', borderRadius: 10, border: 'none', flexShrink: 0,
            background: sending || !draft.trim() ? 'rgba(123,94,167,0.35)' : PURPLE,
            color: '#fff', fontSize: 12, cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          전송
        </button>
      </div>
    </div>
  )
}
