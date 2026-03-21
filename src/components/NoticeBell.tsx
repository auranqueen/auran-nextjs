'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return '방금'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}시간 전`
  return `${Math.floor(diff / 86400_000)}일 전`
}

export default function NoticeBell({
  size = 34,
  borderRadius = 9,
}: {
  size?: number
  borderRadius?: number
}) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const supabase = createClient()
  const { getSetting } = useAdminSettings()
  const highlightColor = getSetting('notice_ui', 'highlight_color', '#F5E642')

  const btnStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--border)',
      color: 'var(--text2)',
      fontSize: 16,
      cursor: 'pointer',
    }),
    [size, borderRadius]
  )

  const loadUnreadCount = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      setUnreadCount(0)
      return
    }
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const pid = profile?.id ? String(profile.id) : null
    if (!pid) {
      setUnreadCount(0)
      return
    }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', pid)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }, [supabase])

  const loadItems = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      setItems([])
      return
    }
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const pid = profile?.id ? String(profile.id) : null
    if (!pid) {
      setItems([])
      return
    }
    const { data } = await supabase
      .from('notifications')
      .select('id,title,body,icon,is_read,created_at,link,type')
      .eq('user_id', pid)
      .order('created_at', { ascending: false })
      .limit(40)
    setItems(data || [])
  }, [supabase])

  useEffect(() => {
    loadUnreadCount()
    const id = setInterval(loadUnreadCount, 12_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') loadUnreadCount()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [loadUnreadCount])

  useEffect(() => {
    if (!open) return
    loadItems()
    loadUnreadCount()
  }, [open, loadItems, loadUnreadCount])

  const onRowClick = async (n: any) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    setUnreadCount((c) => Math.max(0, c - (n.is_read ? 0 : 1)))
    setOpen(false)
    const path = (n.link as string | null)?.trim()
    if (path && path.startsWith('/')) {
      router.push(path)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-label="알림" onClick={() => setOpen(true)} style={btnStyle}>
        🔔
      </button>
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            background: '#d94f4f',
            borderRadius: 999,
            fontSize: 9,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            lineHeight: '16px',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 0,
              width: '100%',
              maxWidth: 480,
              background: 'linear-gradient(145deg, #1a2e1a, #0d1f0d)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '16px 14px 24px',
              maxHeight: '72vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ width: 46, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.4)', margin: '0 auto 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ color: highlightColor, fontSize: 18, fontWeight: 700 }}>✦ 마이 알림장</div>
              <button
                onClick={() => router.push('/notices')}
                style={{ border: '1px dashed rgba(255,255,255,0.7)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}
              >
                공지 보기
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((n) => {
                const read = !!n.is_read
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onRowClick(n)}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      textAlign: 'left',
                      width: '100%',
                      padding: '10px 8px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: read ? 'rgba(0,0,0,0.12)' : 'rgba(201,168,76,0.06)',
                      cursor: 'pointer',
                      opacity: read ? 0.45 : 1,
                    }}
                  >
                    {!read && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          marginTop: 5,
                          borderRadius: 999,
                          background: '#c9a84c',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {read && <span style={{ width: 8, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <div style={{ color: read ? 'rgba(255,255,255,0.65)' : '#fff', fontSize: 13, fontWeight: read ? 500 : 800 }}>
                          {n.icon ? `${n.icon} ` : ''}
                          {n.title || '알림'}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, whiteSpace: 'nowrap' }}>{fmtRelative(n.created_at)}</div>
                      </div>
                      {n.body && (
                        <div style={{ marginTop: 4, color: read ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 1.45 }}>{n.body}</div>
                      )}
                    </div>
                  </button>
                )
              })}
              {items.length === 0 && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>알림이 없습니다.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
