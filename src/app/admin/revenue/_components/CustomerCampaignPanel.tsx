'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = { purple: '#7B5EA7', gold: '#C9A96E', green: '#5B8A6B', red: '#dc5050' }

const REWARD_OPTIONS: { label: string; value: 'none' | 'discount' | 'gift_product' | 'gift_product_and_discount' }[] = [
  { label: '없음', value: 'none' },
  { label: '쿠폰', value: 'discount' },
  { label: '제품', value: 'gift_product' },
  { label: '제품+쿠폰', value: 'gift_product_and_discount' },
]

export default function CustomerCampaignPanel({
  selectedCustomerIds,
  onClose,
}: {
  selectedCustomerIds: string[]
  onClose: () => void
}) {
  const supabase = createClient()
  const [mode, setMode] = useState<'now' | 'scheduled'>('now')
  const [message, setMessage] = useState('')
  const [rewardType, setRewardType] = useState<'none' | 'discount' | 'gift_product' | 'gift_product_and_discount'>('none')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    if (saving || !message.trim() || selectedCustomerIds.length === 0) return
    if (mode === 'scheduled' && !scheduledAt) {
      setResult({ ok: false, text: '발송 예정 일시를 선택하세요.' })
      return
    }
    setSaving(true)
    setResult(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setResult({ ok: false, text: '로그인이 필요해요.' })
        setSaving(false)
        return
      }
      const scheduledIso = mode === 'now' ? new Date().toISOString() : new Date(scheduledAt).toISOString()
      const { error } = await supabase.from('scheduled_campaigns').insert({
        sender_type: 'owner',
        sender_id: user.id,
        target_type: 'manual_list',
        target_customer_type: 'auran_user',
        target_customer_ids: selectedCustomerIds,
        message: message.trim(),
        reward_type: mode === 'now' ? 'none' : rewardType,
        scheduled_at: scheduledIso,
        created_by: user.id,
      } as any)
      if (error) {
        setResult({ ok: false, text: `저장 실패: ${error.message}` })
      } else {
        setResult({ ok: true, text: mode === 'now' ? '즉시 발송 캠페인이 등록됐어요 (발송 처리는 곧).' : '예약 캠페인이 등록됐어요.' })
      }
    } catch (e: any) {
      setResult({ ok: false, text: `오류: ${e?.message || 'unknown'}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 400, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', background: '#1a1830', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', color: '#8A7E92', fontSize: 22, lineHeight: 1, cursor: 'pointer', minWidth: 32, minHeight: 32 }}
        >
          ×
        </button>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e0f5', marginBottom: 4 }}>선택 고객 캠페인</div>
        <div style={{ fontSize: 11, color: '#8A7E92', marginBottom: 14 }}>
          오렌 내부고객 {selectedCustomerIds.length}명 · 오렌톡으로 발송
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['now', 'scheduled'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: mode === m ? C.purple : 'rgba(255,255,255,0.06)', color: mode === m ? '#fff' : '#8A7E92', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {m === 'now' ? '지금 바로 발송' : '예약 발송'}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="보낼 메시지를 입력하세요"
          rows={5}
          disabled={saving}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e0f5', fontSize: 12, padding: '10px', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
        />

        {mode === 'scheduled' && (
          <>
            <div style={{ fontSize: 11, color: '#8A7E92', margin: '14px 0 6px' }}>증정 종류</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {REWARD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setRewardType(o.value)}
                  style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: rewardType === o.value ? C.gold : 'rgba(255,255,255,0.06)', color: rewardType === o.value ? '#1a1830' : '#8A7E92', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#8A7E92', margin: '14px 0 6px' }}>발송 예정 일시</div>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e0f5', fontSize: 12, padding: '10px', fontFamily: 'inherit', outline: 'none' }}
            />
          </>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving || !message.trim() || selectedCustomerIds.length === 0}
          style={{ width: '100%', marginTop: 16, padding: '11px', borderRadius: 9, border: 'none', background: saving || !message.trim() || selectedCustomerIds.length === 0 ? 'rgba(123,94,167,0.3)' : C.purple, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving || !message.trim() ? 'default' : 'pointer' }}
        >
          {saving ? '저장 중…' : mode === 'now' ? `${selectedCustomerIds.length}명에게 지금 발송` : `${selectedCustomerIds.length}명 예약 등록`}
        </button>

        {result && (
          <div style={{ marginTop: 14, fontSize: 12, color: result.ok ? C.green : C.red }}>
            {result.text}
          </div>
        )}
      </div>
    </div>
  )
}
