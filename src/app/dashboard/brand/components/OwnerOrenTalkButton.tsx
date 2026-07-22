'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

interface Props {
  brandId: string | null
  ownerId: string
  ownerName: string
}

export default function OwnerOrenTalkButton({ brandId, ownerId, ownerName }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const send = async () => {
    if (!brandId) { showToast('브랜드 정보가 없습니다'); return }
    if (!msg.trim()) { showToast('메시지를 입력해주세요'); return }
    setSending(true)
    const { error } = await supabase.from('brand_messages').insert({
      brand_id: brandId,
      message_type: 'manual',
      target_type: 'selected',
      target_owner_id: ownerId,
      title: `${ownerName} 원장님 오렌톡`,
      body: msg.trim(),
      send_count: 1,
    })
    setSending(false)
    if (error) {
      showToast('발송 실패: ' + error.message)
      return
    }
    setMsg('')
    setOpen(false)
    showToast(`${ownerName} 오렌톡 발송!`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      {toast ? (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', cursor: 'pointer' }}
      >
        오렌톡
      </button>
      {open ? (
        <div style={{ width: 200, background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8 }}>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder={`${ownerName}님께 보낼 메시지`}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: TEXT, minHeight: 56, resize: 'none', outline: 'none', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              style={{ flex: 1, fontSize: 10, padding: '4px 0', borderRadius: 4, border: 'none', background: sending ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', cursor: sending ? 'not-allowed' : 'pointer' }}
            >
              {sending ? '발송 중...' : '전송'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setMsg('') }}
              style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
