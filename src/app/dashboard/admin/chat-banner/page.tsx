'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type ChatBanner = {
  main_text: string
  sub_text: string
  link: string
  expires_at: string
  phase_auto: boolean
}

type ChatQuickBtns = {
  skin_report: boolean
  owner_pick: boolean
  toast_wallet: boolean
}

const PAGE_BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const BORDER = '1px solid rgba(255,255,255,0.12)'
const MUTED = 'rgba(255,255,255,0.6)'

export default function AdminChatBannerPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [eventEnabled, setEventEnabled] = useState(false)
  const [banner, setBanner] = useState<ChatBanner>({
    main_text: '',
    sub_text: '',
    link: '',
    expires_at: '',
    phase_auto: false,
  })
  const [quickBtns, setQuickBtns] = useState<ChatQuickBtns>({
    skin_report: true,
    owner_pick: true,
    toast_wallet: true,
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const authId = authData.user?.id
        if (!authId) return
        const { data: profile } = await supabase.from('profiles').select('role').eq('auth_id', authId).maybeSingle()
        if (cancelled) return
        if (profile?.role !== 'admin') {
          setAllowed(false)
          return
        }
        setAllowed(true)
        const { data: rows } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['chat_banner_enabled', 'chat_banner_event_enabled', 'chat_banner', 'chat_quick_btns'])
        if (cancelled) return
        if (!rows) return
        const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]))
        setBannerEnabled(map.chat_banner_enabled === 'true')
        setEventEnabled(map.chat_banner_event_enabled === 'true')
        if (map.chat_banner) {
          const parsed = typeof map.chat_banner === 'string' ? JSON.parse(map.chat_banner) : map.chat_banner
          setBanner({
            main_text: parsed?.main_text ?? '',
            sub_text: parsed?.sub_text ?? '',
            link: parsed?.link ?? '',
            expires_at: parsed?.expires_at ?? '',
            phase_auto: Boolean(parsed?.phase_auto),
          })
        }
        if (map.chat_quick_btns) {
          const parsed = typeof map.chat_quick_btns === 'string' ? JSON.parse(map.chat_quick_btns) : map.chat_quick_btns
          setQuickBtns({
            skin_report: parsed?.skin_report !== false,
            owner_pick: parsed?.owner_pick !== false,
            toast_wallet: parsed?.toast_wallet !== false,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleBtnStyle = (on: boolean) => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: BORDER,
    background: on ? '#7B5EA7' : 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 12,
    cursor: 'pointer',
  })

  const inputStyle = {
    width: '100%',
    border: BORDER,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    color: '#fff',
    padding: '10px 12px',
    fontSize: 13,
    outline: 'none',
  } as const

  const onSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const payload = [
        { category: 'chat', key: 'chat_banner_enabled', value: bannerEnabled ? 'true' : 'false' },
        { category: 'chat', key: 'chat_banner_event_enabled', value: eventEnabled ? 'true' : 'false' },
        {
          category: 'chat',
          key: 'chat_banner',
          value: JSON.stringify({
            main_text: banner.main_text,
            sub_text: banner.sub_text,
            link: banner.link,
            expires_at: banner.expires_at,
            phase_auto: banner.phase_auto,
          }),
        },
        { category: 'chat', key: 'chat_quick_btns', value: JSON.stringify(quickBtns) },
      ]
      const { error } = await supabase.from('admin_settings').upsert(payload, { onConflict: 'key' })
      if (error) {
        setMessage('저장 실패')
        return
      }
      setMessage('저장 완료')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: PAGE_BG, color: '#fff', padding: 24 }}>로딩 중...</div>
  }

  if (!allowed) {
    return <div style={{ minHeight: '100vh', background: PAGE_BG, color: '#fff', padding: 24 }}>접근 권한이 없습니다.</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, color: '#fff', padding: 20 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>채팅 배너 관리</h1>
        <div style={{ color: MUTED, fontSize: 12 }}>고객 채팅 하단 배너/혜택 버튼 설정</div>

        <section style={{ border: BORDER, background: CARD_BG, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#fff' }}>배너 전체 on/off</div>
          <button type="button" onClick={() => setBannerEnabled((v) => !v)} style={toggleBtnStyle(bannerEnabled)}>
            {bannerEnabled ? 'ON' : 'OFF'}
          </button>
        </section>

        <section style={{ border: BORDER, background: CARD_BG, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#fff' }}>이벤트 배너 on/off</div>
          <button type="button" onClick={() => setEventEnabled((v) => !v)} style={toggleBtnStyle(eventEnabled)}>
            {eventEnabled ? 'ON' : 'OFF'}
          </button>

          <div style={{ fontSize: 12, color: MUTED }}>main_text</div>
          <input value={banner.main_text} onChange={(e) => setBanner((p) => ({ ...p, main_text: e.target.value }))} style={inputStyle} />

          <div style={{ fontSize: 12, color: MUTED }}>sub_text</div>
          <input value={banner.sub_text} onChange={(e) => setBanner((p) => ({ ...p, sub_text: e.target.value }))} style={inputStyle} />

          <div style={{ fontSize: 12, color: MUTED }}>link</div>
          <input value={banner.link} onChange={(e) => setBanner((p) => ({ ...p, link: e.target.value }))} style={inputStyle} />

          <div style={{ fontSize: 12, color: MUTED }}>expires_at</div>
          <input value={banner.expires_at} onChange={(e) => setBanner((p) => ({ ...p, expires_at: e.target.value }))} style={inputStyle} />

          <div style={{ fontSize: 13, color: '#fff', marginTop: 4 }}>phase_auto on/off</div>
          <button
            type="button"
            onClick={() => setBanner((p) => ({ ...p, phase_auto: !p.phase_auto }))}
            style={toggleBtnStyle(banner.phase_auto)}
          >
            {banner.phase_auto ? 'ON' : 'OFF'}
          </button>
        </section>

        <section style={{ border: BORDER, background: CARD_BG, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: '#fff' }}>혜택 버튼 on/off</div>
          <button
            type="button"
            onClick={() => setQuickBtns((p) => ({ ...p, skin_report: !p.skin_report }))}
            style={toggleBtnStyle(quickBtns.skin_report)}
          >
            skin_report: {quickBtns.skin_report ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setQuickBtns((p) => ({ ...p, owner_pick: !p.owner_pick }))}
            style={toggleBtnStyle(quickBtns.owner_pick)}
          >
            owner_pick: {quickBtns.owner_pick ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setQuickBtns((p) => ({ ...p, toast_wallet: !p.toast_wallet }))}
            style={toggleBtnStyle(quickBtns.toast_wallet)}
          >
            toast_wallet: {quickBtns.toast_wallet ? 'ON' : 'OFF'}
          </button>
        </section>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            border: 'none',
            borderRadius: 10,
            background: '#7B5EA7',
            color: '#fff',
            padding: '12px 14px',
            fontSize: 13,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {message ? <div style={{ color: MUTED, fontSize: 12 }}>{message}</div> : null}
      </div>
    </div>
  )
}
