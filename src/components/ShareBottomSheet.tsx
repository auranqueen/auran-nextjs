'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import html2canvas from 'html2canvas'

declare global {
  interface Window {
    Kakao?: any
  }
}

type SharePayload = {
  link: string
  title: string
  description: string
  imageUrl?: string | null
  buttonTitle: string
}

async function ensureKakaoSdk(appKey: string) {
  if (typeof window === 'undefined') return null
  if (!appKey) throw new Error('Kakao app key is missing')

  const w = window as any
  if (w.Kakao && w.Kakao.isInitialized?.()) return w.Kakao

  await new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[data-kakao-sdk="true"]')) {
      const t = setInterval(() => {
        if (w.Kakao) {
          clearInterval(t)
          resolve()
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://developers.kakao.com/sdk/js/kakao.min.js'
    script.async = true
    script.defer = true
    script.setAttribute('data-kakao-sdk', 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Kakao SDK'))
    document.head.appendChild(script)
  })

  w.Kakao.init(appKey)
  return w.Kakao
}

export default function ShareBottomSheet({
  open,
  onClose,
  cardDomId,
  payload,
}: {
  open: boolean
  onClose: () => void
  cardDomId: string
  payload: SharePayload
}) {
  const [busy, setBusy] = useState(false)

  const kakaoAppKey = useMemo(() => {
    // Client-side Kakao key is expected as NEXT_PUBLIC_*
    return process.env.NEXT_PUBLIC_KAKAO_APP_KEY || (process.env as any).NEXT_PUBLIC_KAKAO_APPKEY || ''
  }, [])

  const link = payload.link

  const copy = async () => {
    setBusy(true)
    try {
      await navigator.clipboard.writeText(link)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const kakaoShare = async () => {
    setBusy(true)
    try {
      const Kakao = await ensureKakaoSdk(kakaoAppKey)
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: payload.title,
          description: payload.description,
          imageUrl: payload.imageUrl || undefined,
          link: { mobileWebUrl: link, webUrl: link },
        },
        buttons: [
          {
            title: payload.buttonTitle,
            link: { mobileWebUrl: link, webUrl: link },
          },
        ],
      })
      onClose()
    } catch (e: any) {
      alert(e?.message || '카카오 공유에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const downloadAsImage = async () => {
    setBusy(true)
    try {
      const el = document.getElementById(cardDomId)
      if (!el) throw new Error('캡처할 카드가 없습니다.')
      const canvas = await html2canvas(el, { useCORS: true, backgroundColor: '#0a0c0f' })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'auran_journal.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const btnStyle: CSSProperties = {
    width: '100%',
    padding: '14px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    color: '#fff',
    fontWeight: 900,
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(10,12,15,0.98)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 14,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--gold)', letterSpacing: '0.02em' }}>공유</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" onClick={copy} disabled={busy} style={btnStyle}>
            🔗 링크 복사
          </button>
          <button type="button" onClick={kakaoShare} disabled={busy} style={btnStyle}>
            💬 카카오톡 공유
          </button>
          <button type="button" onClick={downloadAsImage} disabled={busy} style={btnStyle}>
            📸 이미지로 저장
          </button>
        </div>
      </div>
    </div>
  )
}

