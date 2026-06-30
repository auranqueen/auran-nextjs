'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BG = '#0d0b09'
const GOLD = '#C9A96E'
const PRIMARY = '#7B5EA7'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.55)'
const TEXT_DIM = 'rgba(255,255,255,0.35)'

const DELETE_CONTACT_EMAIL = 'queen8039@gmail.com'

export default function AccountDeletePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [requested, setRequested] = useState(false)

  const handleRequest = () => {
    setRequested(true)
  }

  return (
    <div
      style={{
        background: BG,
        minHeight: '100vh',
        maxWidth: 390,
        margin: '0 auto',
        fontFamily: "'Noto Sans KR', sans-serif",
        fontWeight: 400,
        color: '#fff',
        paddingBottom: 32,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: CARD_BORDER,
          background: 'rgba(13,11,9,0.95)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: CARD_BG,
            border: CARD_BORDER,
            color: '#fff',
            fontSize: 18,
            cursor: 'pointer',
            fontWeight: 400,
          }}
        >
          ‹
        </button>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>계정 삭제 요청</span>
        <span style={{ width: 34 }} />
      </header>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: GOLD, letterSpacing: 3, marginBottom: 8 }}>AURAN</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 12px', color: '#fff' }}>계정 삭제 요청</h1>
        <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: '0 0 20px' }}>
          계정 삭제를 원하시면 아래 이메일로 요청해주세요.
        </p>

        <div
          style={{
            padding: 14,
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: 12,
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <a
            href={`mailto:${DELETE_CONTACT_EMAIL}`}
            style={{ fontSize: 14, color: GOLD, textDecoration: 'none', fontWeight: 500 }}
          >
            {DELETE_CONTACT_EMAIL}
          </a>
        </div>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>가입 이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)',
              border: CARD_BORDER,
              borderRadius: 10,
              color: '#fff',
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 400,
              marginBottom: 12,
            }}
          />
          <button
            type="button"
            onClick={handleRequest}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: `rgba(123,94,167,0.25)`,
              color: 'rgba(220,200,255,0.95)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            삭제 요청
          </button>
        </section>

        {requested ? (
          <section
            style={{
              padding: 14,
              background: 'rgba(123,94,167,0.08)',
              border: `1px solid ${PRIMARY}44`,
              borderRadius: 12,
            }}
          >
            <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: '0 0 8px' }}>
              아래 이메일로 계정 삭제 요청을 보내주세요. 확인 후 처리해 드립니다.
            </p>
            <p style={{ fontSize: 13, color: GOLD, margin: '0 0 8px', fontWeight: 500 }}>{DELETE_CONTACT_EMAIL}</p>
            {email.trim() ? (
              <p style={{ fontSize: 11, color: TEXT_DIM, margin: 0 }}>
                요청 계정: {email.trim()}
              </p>
            ) : null}
            <a
              href={`mailto:${DELETE_CONTACT_EMAIL}?subject=${encodeURIComponent('[AURAN] 계정 삭제 요청')}&body=${encodeURIComponent(`계정 삭제를 요청합니다.\n\n가입 이메일: ${email.trim() || '(미입력)'}\n`)}`}
              style={{
                display: 'inline-block',
                marginTop: 12,
                fontSize: 12,
                color: PRIMARY,
                textDecoration: 'none',
              }}
            >
              메일 앱으로 보내기 →
            </a>
          </section>
        ) : null}

        <p style={{ fontSize: 10, lineHeight: 1.7, color: TEXT_DIM, marginTop: 16 }}>
          삭제 시 주문·상담·피부분석 등 서비스 이용 기록이 삭제되며 복구할 수 없습니다.
        </p>
      </div>
    </div>
  )
}
