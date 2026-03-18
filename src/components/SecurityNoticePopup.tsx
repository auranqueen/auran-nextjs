'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'auran_security_notice_dismissed'

export default function SecurityNoticePopup() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [mounted])

  const dismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}
      onClick={() => dismiss(false)}
    >
      <div
        role="dialog"
        aria-label="보안 안내"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          background: 'var(--bg)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 24,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>🔐</span>
          <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, color: '#fff', margin: 0 }}>
            내 계정과 자산을 지키는 방법
          </h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: '#c9a84c' }}>이메일 인증</strong> · 가입 시 발송된 메일의 링크를 눌러 인증을 완료해주세요.
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong style={{ color: '#c9a84c' }}>결제 PIN</strong> · 충전·정산·계좌 변경 시 6자리 PIN으로 한 번 더 확인합니다. 평문으로 저장되지 않습니다.
          </p>
          <p>
            <strong style={{ color: '#c9a84c' }}>5회 오류 시 잠금</strong> · PIN을 5번 잘못 입력하면 30분간 잠깁니다. 비정상 접근을 막기 위한 조치입니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => dismiss(true)}
            style={{
              flex: 1,
              padding: 14,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: 'var(--text3)',
              fontSize: 14,
            }}
          >
            다음에 보지 않기
          </button>
          <button
            type="button"
            onClick={() => dismiss(false)}
            style={{
              flex: 1,
              padding: 14,
              background: '#c9a84c',
              border: 'none',
              borderRadius: 12,
              color: '#0a0a0a',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            확인, 보안 설정할게요
          </button>
        </div>
      </div>
    </div>
  )
}

export function SecurityNoticeTrigger() {
  const [show, setShow] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text3)',
          fontSize: 18,
          padding: 4,
          cursor: 'pointer',
        }}
        aria-label="보안 안내 보기"
        title="보안 안내"
      >
        ?
      </button>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShow(false)}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>🔐</span>
              <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, color: '#fff', margin: 0 }}>내 계정과 자산을 지키는 방법</h2>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
              <p style={{ marginBottom: 10 }}><strong style={{ color: '#c9a84c' }}>이메일 인증</strong> · 가입 시 발송된 메일의 링크를 눌러 인증을 완료해주세요.</p>
              <p style={{ marginBottom: 10 }}><strong style={{ color: '#c9a84c' }}>결제 PIN</strong> · 충전·정산·계좌 변경 시 6자리 PIN으로 한 번 더 확인합니다.</p>
              <p><strong style={{ color: '#c9a84c' }}>5회 오류 시 잠금</strong> · PIN 5번 잘못 입력 시 30분 잠금.</p>
            </div>
            <button type="button" onClick={() => setShow(false)} style={{ width: '100%', padding: 14, background: '#c9a84c', border: 'none', borderRadius: 12, color: '#0a0a0a', fontWeight: 700 }}>확인</button>
          </div>
        </div>
      )}
    </>
  )
}
