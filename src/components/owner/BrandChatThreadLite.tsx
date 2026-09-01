'use client'

import { useEffect, useRef, useState } from 'react'
import CampaignQuickOrderModal from '@/components/owner/CampaignQuickOrderModal'

export type OwnerBrandChatChannel = {
  id: string
  company_id: string
  company_name: string
  logo_url: string | null
  last_message: string | null
  last_message_at: string | null
  unread_by_owner: number
}

export type OwnerBrandChatMessage = {
  id: string
  sender_type: 'brand' | 'owner' | string
  message_type: string
  body: string | null
  attachment_url: string | null
  campaign_id?: string | null
  created_at: string
}

type Props = {
  channel: OwnerBrandChatChannel | null
  messages: OwnerBrandChatMessage[]
  onSend: (text: string) => void | Promise<void>
  onSendAttachment: (file: File) => void | Promise<void>
  ownerProfileId: string | null
}

const BG = '#ffffff'
const SURFACE = '#f9f8fc'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const TEXT_SUB = '#888888'
const PURPLE = '#7B5EA7'
const MINE_BG = '#EDE9F7'
const THEIR_BG = '#f0f0f3'

export default function BrandChatThreadLite({
  channel, messages, onSend, onSendAttachment, ownerProfileId,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [modalCampaignId, setModalCampaignId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, channel?.id])

  if (!channel) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: SURFACE, color: TEXT_SUB, fontSize: 13, borderRadius: 12, border: `1px solid ${BORDER}`,
      }}>
        브랜드사를 선택하세요
      </div>
    )
  }

  const submit = async () => {
    const t = draft.trim()
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
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
      background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, background: SURFACE,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {channel.logo_url ? (
          <img src={channel.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', background: '#fff' }} />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: MINE_BG, color: PURPLE,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
          }}>
            {(channel.company_name || '?').slice(0, 1)}
          </div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{channel.company_name}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, background: BG, minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 12, padding: 24 }}>메시지를 보내보세요</div>
        ) : messages.map((m) => {
          const mine = m.sender_type === 'owner'
          const isCampaign = m.message_type === 'campaign'
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                background: mine ? MINE_BG : THEIR_BG, color: TEXT, fontSize: 13, lineHeight: 1.45,
              }}>
                {isCampaign ? (
                  <>
                    {m.attachment_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.attachment_url} alt="" style={{ maxWidth: 200, width: '100%', borderRadius: 8, marginBottom: 6, display: 'block' }} />
                    ) : null}
                    {m.body ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div> : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (m.campaign_id && ownerProfileId) setModalCampaignId(m.campaign_id)
                      }}
                      style={{ marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}
                    >
                      자세히 보고 주문하기 →
                    </button>
                  </>
                ) : (
                  <>
                    {m.body ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div> : null}
                    {m.attachment_url ? (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: PURPLE, fontSize: 12 }}>
                        📎 첨부파일 보기
                      </a>
                    ) : null}
                  </>
                )}
                <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 4, textAlign: mine ? 'right' : 'left' }}>
                  {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 12, display: 'flex', gap: 8, borderTop: `1px solid ${BORDER}`, background: SURFACE }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
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
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${BORDER}`,
            background: BG, cursor: 'pointer', flexShrink: 0,
          }}
        >
          📎
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="메시지 입력…"
          rows={2}
          style={{
            flex: 1, resize: 'none', borderRadius: 10, padding: '8px 10px', fontSize: 13, color: TEXT,
            background: BG, border: `1px solid ${BORDER}`, outline: 'none',
          }}
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={() => void submit()}
          style={{
            padding: '0 14px', borderRadius: 10, border: 'none', flexShrink: 0,
            background: sending || !draft.trim() ? '#c4b5d9' : PURPLE,
            color: '#fff', fontSize: 12, cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          전송
        </button>
      </div>
      {modalCampaignId && ownerProfileId ? (
        <CampaignQuickOrderModal
          campaignId={modalCampaignId}
          ownerProfileId={ownerProfileId}
          onClose={() => setModalCampaignId(null)}
        />
      ) : null}
    </div>
  )
}
