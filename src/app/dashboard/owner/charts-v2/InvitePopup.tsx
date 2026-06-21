'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const POINT = '#7B5EA7'
const BORDER = '#ede9f7'
const SUB = '#888888'

type Props = {
  open: boolean
  onClose: () => void
  customer: any
}

function parseMemo(raw: string | null | undefined) {
  try {
    return JSON.parse(String(raw || '{}'))
  } catch {
    return {}
  }
}

export default function InvitePopup({ open, onClose, customer }: Props) {
  const supabaseRef = useRef(createClient())
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  if (!open || !customer) return null

  const send = async () => {
    setSending(true)
    const prev = parseMemo(customer.memo)
    const nextMemo = { ...prev, invite_sent_at: new Date().toISOString() }
    const { error } = await supabaseRef.current
      .from('external_customers')
      .update({ memo: JSON.stringify(nextMemo), updated_at: new Date().toISOString() } as any)
      .eq('id', customer.id)
    setSending(false)
    if (error) {
      setToast('발송에 실패했습니다')
      return
    }
    setToast('초대 알림톡 발송 완료! 💜')
    setTimeout(onClose, 500)
  }

  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 220 }} />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360,
          maxWidth: '92%',
          background: '#ffffff',
          borderRadius: 16,
          padding: '24px 20px',
          zIndex: 230,
        }}
      >
        <div style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 500, textAlign: 'center' }}>
          {customer.name}님께 오렌 앱 초대장을 보낼까요?
        </div>
        <div style={{ fontSize: 13, color: SUB, lineHeight: 1.7, textAlign: 'center', marginTop: 12 }}>
          앱 가입 시 홈케어 루틴과 시술 기록을
          <br />
          고객님이 직접 확인하실 수 있어요 💜
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 10, border: `1px solid ${BORDER}`, background: '#fff', fontSize: 14, cursor: 'pointer' }}>
            나중에
          </button>
          <button type="button" disabled={sending} onClick={() => void send()} style={{ flex: 1, height: 48, borderRadius: 10, border: 'none', background: POINT, color: '#fff', fontSize: 14, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
            알림톡 발송
          </button>
        </div>
      </div>
      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: POINT, color: '#fff', borderRadius: 12, padding: '12px 18px', fontSize: 13, zIndex: 300 }}>
          {toast}
        </div>
      ) : null}
    </>
  )
}
