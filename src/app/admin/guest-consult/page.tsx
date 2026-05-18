'use client'
// ===== [비회원 상담톡 관리] guest_consultations 목록 =====
// 비회원이 제품 상세에서 시작한 상담 내역
// 읽음/전환 처리 + 메시지 열람
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GuestConsultPage() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('guest_consultations')
        .select('*')
        .order('created_at', { ascending: false })
      setItems(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleRead = async (id: string, current: boolean) => {
    await supabase
      .from('guest_consultations')
      .update({ is_read: !current })
      .eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_read: !current } : i))
    showToast(!current ? '읽음 처리됐어요' : '읽지 않음으로 변경됐어요')
  }

  const handleConverted = async (id: string, current: boolean) => {
    await supabase
      .from('guest_consultations')
      .update({ is_converted: !current })
      .eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_converted: !current } : i))
    showToast(!current ? '회원 전환 완료로 표시됐어요 💜' : '전환 취소됐어요')
  }

  const unread = items.filter(i => !i.is_read).length

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%',
          transform: 'translateX(-50%)',
          background: '#7B5EA7', color: '#fff',
          padding: '10px 20px', borderRadius: 20,
          fontSize: 13, zIndex: 9999,
        }}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ fontSize: 18, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        비회원 상담톡 🤫
        {unread > 0 && (
          <span style={{
            marginLeft: 8, fontSize: 11,
            background: '#ff4444', color: '#fff',
            borderRadius: 20, padding: '2px 8px',
          }}>
            {unread}건 미확인
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        제품 상세에서 시작된 비회원 상담 내역이에요
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0', fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0', fontSize: 13 }}>
          아직 상담 내역이 없어요 🤫
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => {
            const msgs = Array.isArray(item.messages) ? item.messages : []
            const isOpen = expanded === item.id
            const lastMsg = msgs[msgs.length - 1]

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--color-background-primary)',
                  borderRadius: 12, padding: '14px 16px',
                  border: `0.5px solid ${!item.is_read ? '#AFA9EC' : 'var(--color-border-tertiary)'}`,
                  opacity: item.is_converted ? 0.6 : 1,
                }}
              >
                {/* 상단 요약 */}
                <div
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {/* 미읽음 dot */}
                    {!item.is_read && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#7B5EA7', flexShrink: 0,
                      }} />
                    )}
                    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', flex: 1 }}>
                      {item.product_name || '제품 없음'}
                    </div>
                    {item.is_converted && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px',
                        borderRadius: 20, background: '#f0faf6',
                        color: '#0F6E56', border: '0.5px solid #5DCAA5',
                      }}>
                        회원 전환 💜
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {new Date(item.created_at).toLocaleDateString('ko-KR')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {isOpen ? '∧' : '∨'}
                    </div>
                  </div>
                  {/* 마지막 메시지 미리보기 */}
                  {!isOpen && lastMsg && (
                    <div style={{
                      fontSize: 12, color: 'var(--color-text-secondary)',
                      overflow: 'hidden', whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}>
                      {lastMsg.role === 'user' ? '고객: ' : '맑원장: '}
                      {lastMsg.text}
                    </div>
                  )}
                </div>

                {/* 메시지 상세 펼치기 */}
                {isOpen && (
                  <div style={{
                    marginTop: 10, padding: 10,
                    background: 'var(--color-background-secondary)',
                    borderRadius: 10, display: 'flex',
                    flexDirection: 'column', gap: 6,
                    maxHeight: 240, overflowY: 'auto',
                  }}>
                    {msgs.map((m: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          maxWidth: '80%', padding: '7px 10px',
                          borderRadius: 10, fontSize: 12,
                          lineHeight: 1.6, whiteSpace: 'pre-line',
                          wordBreak: 'keep-all',
                          alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                          background: m.role === 'user' ? '#7B5EA7' : 'var(--color-background-primary)',
                          color: m.role === 'user' ? '#fff' : 'var(--color-text-primary)',
                          border: m.role === 'bot' ? '0.5px solid var(--color-border-tertiary)' : 'none',
                        }}
                      >
                        {m.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button
                    onClick={() => handleRead(item.id, item.is_read)}
                    style={{
                      fontSize: 11, padding: '5px 12px',
                      borderRadius: 20, cursor: 'pointer',
                      border: 'none',
                      background: item.is_read
                        ? 'var(--color-background-secondary)'
                        : '#7B5EA7',
                      color: item.is_read
                        ? 'var(--color-text-secondary)'
                        : '#fff',
                    }}
                  >
                    {item.is_read ? '읽음 ✓' : '읽음 처리'}
                  </button>
                  <button
                    onClick={() => handleConverted(item.id, item.is_converted)}
                    style={{
                      fontSize: 11, padding: '5px 12px',
                      borderRadius: 20, cursor: 'pointer',
                      border: '0.5px solid var(--color-border-secondary)',
                      background: item.is_converted ? '#f0faf6' : 'transparent',
                      color: item.is_converted ? '#0F6E56' : 'var(--color-text-secondary)',
                    }}
                  >
                    {item.is_converted ? '회원 전환 ✓' : '회원 전환'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
