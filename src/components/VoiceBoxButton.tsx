'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ===== [고객의 목소리 함] =====
// 고객이 버그/아이디어/칭찬을 남기는 플로팅 버튼
// voice_box 테이블에 저장 → 어드민에서 확인
export default function VoiceBoxButton() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'bug' | 'idea' | 'praise' | null>(null)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()

  const handleSend = async () => {
    if (!type || !content.trim()) return
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('voice_box').insert({
        user_id: user?.id || null,
        type,
        content: content.trim(),
        // 현재 페이지 URL 자동 첨부
        page_url: window.location.pathname,
      })
      setDone(true)
      setTimeout(() => {
        setOpen(false)
        setDone(false)
        setType(null)
        setContent('')
      }, 1500)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 999,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#7B5EA7',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            boxShadow: '0 2px 12px rgba(123,94,167,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          💜
        </button>
      )}

      {/* 모달 */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 1000,
          width: 280,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
          padding: '18px 16px',
        }}>
          {done ? (
            // 전송 완료
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: '#7B5EA7' }}>
              맑원장이 확인할게요 💜
            </div>
          ) : !type ? (
            // 유형 선택
            <>
              <div style={{ fontSize: 13, color: '#333', marginBottom: 12 }}>
                오랜에게 말하기
              </div>
              {[
                { key: 'bug', label: '🐛 뭔가 안 돼요' },
                { key: 'idea', label: '💡 이런 기능 있으면 좋겠어요' },
                { key: 'praise', label: '💜 칭찬할게요' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setType(item.key as any)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    marginBottom: 6,
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.2)',
                    background: 'rgba(123,94,167,0.04)',
                    fontSize: 13,
                    color: '#444',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setOpen(false)}
                style={{ fontSize: 11, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
              >
                닫기
              </button>
            </>
          ) : (
            // 내용 입력
            <>
              <div style={{ fontSize: 12, color: '#7B5EA7', marginBottom: 8 }}>
                {type === 'bug' ? '🐛 어떤 문제가 있었나요?' : type === 'idea' ? '💡 어떤 기능이 있으면 좋을까요?' : '💜 칭찬해주세요!'}
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="자유롭게 적어주세요"
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(123,94,167,0.3)',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => setType(null)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #eee', fontSize: 12, cursor: 'pointer', background: '#fff' }}
                >
                  이전
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !content.trim()}
                  style={{
                    flex: 2,
                    padding: '8px 0',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: '#7B5EA7',
                    color: '#fff',
                    opacity: sending || !content.trim() ? 0.5 : 1,
                  }}
                >
                  {sending ? '전송 중...' : '전송'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
