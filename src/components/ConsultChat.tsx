'use client'
// ===== [상담톡] 비회원/회원 공통 상담 컴포넌트 =====
// 비회원: guest_consultations 테이블에 저장
// 회원: 기존 consultation_messages 채널로 연결
// 르노벨 전용 멘트 / 일반 멘트 분기
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const RENOBEL_BRAND_ID = '90175aa9-70c8-4568-865a-195f11bd7859'

interface ConsultChatProps {
  productId: string
  productName: string
  brandId?: string
  onClose: () => void
  onLoginRequest: () => void
}

export default function ConsultChat({
  productId,
  productName,
  brandId,
  onClose,
  onLoginRequest,
}: ConsultChatProps) {
  const supabase = createClient()
  const isRenobel = brandId === RENOBEL_BRAND_ID
  const [messages, setMessages] = useState<{ role: 'bot' | 'user', text: string }[]>([])
  const [input, setInput] = useState('')
  const [step, setStep] = useState<'chat' | 'hook'>('chat')
  const [channelId] = useState(() => 'guest-' + Date.now() + '-' + Math.random().toString(36).slice(2))
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // 로그인 여부 체크
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })
  }, [])

  // 초기 인사말 세팅
  useEffect(() => {
    const greeting = isRenobel
      ? '어서와요 🤫\n르노벨 찾아오셨네요 ㅎㅎ\n어떤 향기가 끌리세요? 💜'
      : `맞아요 맞아요 🤫\n${productName} 보고 오셨군요!\n근데 피부마다 달라서요\n어떤 피부 고민 있으세요? 💜`
    setMessages([{ role: 'bot', text: greeting }])
  }, [isRenobel, productName])

  // 메시지 추가될 때 스크롤 아래로
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [messages])

  const saveToDb = async (msgs: typeof messages) => {
    // [비회원 상담 저장] guest_consultations 테이블
    await supabase.from('guest_consultations').upsert({
      channel_id: channelId,
      product_id: productId,
      product_name: productName,
      messages: msgs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'channel_id' })
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user' as const, text: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')

    // 2번째 고객 메시지 후 후킹 단계로
    const userCount = next.filter(m => m.role === 'user').length
    if (userCount >= 2 && step === 'chat') {
      setTimeout(() => {
        const hookMsg = isRenobel
          ? '회원이시면 호르몬 사이클이랑\n피부 타입까지 같이 봐드릴 수 있어요 💜\n훨씬 찰떡인 향기 찾아드릴 수 있거든요 🤫'
          : '회원이시면 피부 타입이랑\n호르몬 데이터까지 같이 봐드려요 💜\n그래야 100% 확신 드릴 수 있어요 ㅎㅎ'
        setMessages(prev => [...prev, { role: 'bot', text: hookMsg }])
        setStep('hook')
        saveToDb([...next, { role: 'bot', text: hookMsg }])
      }, 600)
    } else {
      await saveToDb(next)
    }
  }

  const accentColor = isRenobel ? '#C9A96E' : '#7B5EA7'
  const headerBg = isRenobel ? '#2D1B5E' : '#7B5EA7'
  const avatarBg = isRenobel ? '#C9A96E' : '#fff'
  const avatarColor = isRenobel ? '#2D1B5E' : '#7B5EA7'

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16, left: 16,
      maxWidth: 360, marginLeft: 'auto',
      zIndex: 1000, borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column',
      background: '#1a1a1a',
    }}>
      {/* 헤더 */}
      <div style={{ background: headerBg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: avatarBg, color: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, flexShrink: 0,
        }}>맑</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: isRenobel ? '#C9A96E' : '#fff', letterSpacing: 0.5 }}>맑원장 상담톡</div>
          <div style={{ fontSize: 10, color: isRenobel ? 'rgba(201,169,110,0.6)' : 'rgba(255,255,255,0.6)', marginTop: 1 }}>보통 5분 내 답변</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: isRenobel ? '#C9A96E' : '#fff', fontSize: 18, cursor: 'pointer', padding: 4 }}
        >✕</button>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={bodyRef}
        style={{
          background: '#1a1a1a',
          padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: 280, overflowY: 'auto',
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              maxWidth: '82%', padding: '9px 12px', borderRadius: 12,
              fontSize: 12, lineHeight: 1.6, wordBreak: 'keep-all',
              whiteSpace: 'pre-line',
              alignSelf: m.role === 'bot' ? 'flex-start' : 'flex-end',
              background: m.role === 'bot'
                ? 'var(--color-background-primary)'
                : accentColor,
              color: m.role === 'bot' ? 'var(--color-text-primary)' : '#fff',
              border: m.role === 'bot' ? '0.5px solid var(--color-border-tertiary)' : 'none',
              borderBottomLeftRadius: m.role === 'bot' ? 4 : 12,
              borderBottomRightRadius: m.role === 'user' ? 4 : 12,
            }}
          >
            {m.text}
          </div>
        ))}

        {/* 후킹 박스 — 2번째 메시지 후 노출 */}
        {step === 'hook' && !isLoggedIn && (
          <div style={{
            background: '#f5f0ff', border: '0.5px solid #AFA9EC',
            borderRadius: 10, padding: 12,
            fontSize: 12, color: '#534AB7', lineHeight: 1.7,
          }}>
            {isRenobel
              ? '맑원장한테 다 맡기실래요? 💜\n가입하시면 호르몬 데이터까지 분석해드려요!'
              : '오늘 상담 내용 저장해드릴게요 💜\n가입하시면 맑원장이 먼저 연락드리기도 해요 ㅎㅎ'}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={onLoginRequest}
                style={{
                  flex: 2, padding: '9px 0', borderRadius: 8,
                  border: 'none', background: '#7B5EA7', color: '#fff',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                {isRenobel ? '맑원장한테 다 맡기러 가기' : '1분만에 가입하기'}
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: '0.5px solid var(--color-border-secondary)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                다음에요
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        borderTop: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-background-primary)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="메시지 입력..."
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 20,
            border: '0.5px solid var(--color-border-secondary)',
            fontSize: 12, fontFamily: 'inherit',
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '8px 14px', borderRadius: 20,
            border: 'none', background: accentColor,
            color: '#fff', fontSize: 12, cursor: 'pointer',
          }}
        >전송</button>
      </div>
    </div>
  )
}
