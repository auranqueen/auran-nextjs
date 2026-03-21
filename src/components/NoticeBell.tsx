'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'
import {
  formatDateTime,
  getDefaultLinkForType,
  getNotificationGroupLabel,
  getNotificationIcon,
} from '@/lib/notifications/format'

const GOLD = '#C9A84c'

type NotifRow = {
  id: string
  title: string | null
  body: string | null
  type: string | null
  icon: string | null
  is_read: boolean | null
  created_at: string | null
  link: string | null
}

function groupNotifications(rows: NotifRow[]) {
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime()
    const tb = new Date(b.created_at || 0).getTime()
    return tb - ta
  })
  const order: string[] = []
  const seen = new Set<string>()
  for (const n of sorted) {
    const lab = getNotificationGroupLabel(n.created_at || '')
    if (!seen.has(lab)) {
      seen.add(lab)
      order.push(lab)
    }
  }
  return order.map((label) => ({
    label,
    items: sorted.filter((n) => getNotificationGroupLabel(n.created_at || '') === label),
  }))
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
  const [items, setItems] = useState<NotifRow[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)

  const supabase = createClient()
  const { getSettingNum } = useAdminSettings()
  const maxDisplay = Math.max(1, Math.min(200, getSettingNum('notification', 'max_display_count', 50)))
  const autoReadDays = Math.max(0, getSettingNum('notification', 'auto_read_days', 30))

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

  const resolveProfileId = useCallback(async (): Promise<string | null> => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return null
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    return profile?.id ? String(profile.id) : null
  }, [supabase])

  const loadUnreadCount = useCallback(async () => {
    const pid = await resolveProfileId()
    setProfileId(pid)
    if (!pid) {
      setUnreadCount(0)
      return
    }
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', pid)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }, [supabase, resolveProfileId])

  const loadItems = useCallback(async () => {
    const pid = profileId || (await resolveProfileId())
    if (!pid) {
      setItems([])
      return
    }
    if (autoReadDays > 0) {
      const cutoff = new Date(Date.now() - autoReadDays * 86400000).toISOString()
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', pid).eq('is_read', false).lt('created_at', cutoff)
    }
    const { data } = await supabase
      .from('notifications')
      .select('id,title,body,icon,is_read,created_at,link,type')
      .eq('user_id', pid)
      .order('created_at', { ascending: false })
      .limit(maxDisplay)
    setItems((data || []) as NotifRow[])
  }, [supabase, profileId, resolveProfileId, maxDisplay, autoReadDays])

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
    void (async () => {
      await loadItems()
      await loadUnreadCount()
    })()
  }, [open, loadItems, loadUnreadCount])

  const grouped = useMemo(() => groupNotifications(items), [items])

  const markAllRead = async () => {
    const pid = profileId || (await resolveProfileId())
    if (!pid) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', pid).eq('is_read', false)
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
    setUnreadCount(0)
  }

  const onRowClick = async (n: NotifRow) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    setUnreadCount((c) => Math.max(0, c - (n.is_read ? 0 : 1)))
    setOpen(false)
    const raw = (n.link && String(n.link).trim()) || ''
    const path =
      raw.startsWith('/') ? raw : getDefaultLinkForType(n.type || undefined) || ''
    if (path) router.push(path)
  }

  const sheetTitle = unreadCount > 0 ? `🔔 알림 (${unreadCount})` : '🔔 알림'

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
              background: 'linear-gradient(145deg, #1a1f24, #0d1114)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '14px 14px 28px',
              maxHeight: '78vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: 46, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.35)', margin: '0 auto 14px' }} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 10,
              }}
            >
              <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>{sheetTitle}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    style={{
                      border: `1px solid ${GOLD}`,
                      background: 'rgba(201,168,76,0.12)',
                      color: GOLD,
                      borderRadius: 10,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    전체읽음
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push('/notices')}
                  style={{
                    border: '1px dashed rgba(255,255,255,0.35)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.75)',
                    borderRadius: 10,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: 11,
                    textDecoration: 'none',
                  }}
                >
                  공지
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px 28px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 8, textDecoration: 'none' }}>새 알림이 없어요</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5, textDecoration: 'none' }}>
                  활동하면 여기에 알림이 쌓여요
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {grouped.map((section) => (
                  <div key={section.label}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 800, marginBottom: 8, letterSpacing: 0.3 }}>
                      {section.label}
                    </div>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 10 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {section.items.map((n) => {
                        const read = !!n.is_read
                        const icon = getNotificationIcon(n.type || undefined)
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => void onRowClick(n)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 12px 10px',
                              borderRadius: 12,
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderLeft: read ? '3px solid transparent' : `3px solid ${GOLD}`,
                              background: read ? 'transparent' : 'rgba(201,168,76,0.05)',
                              opacity: read ? 0.5 : 1,
                              cursor: 'pointer',
                              textDecoration: 'none',
                              boxSizing: 'border-box',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 16, lineHeight: 1.2, flexShrink: 0 }} aria-hidden>
                                {icon}
                              </span>
                              <span
                                style={{
                                  color: read ? 'rgba(255,255,255,0.75)' : '#fff',
                                  fontSize: 14,
                                  fontWeight: 800,
                                  lineHeight: 1.35,
                                  textDecoration: 'none',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {n.title || '알림'}
                              </span>
                            </div>
                            {n.body && (
                              <div
                                style={{
                                  color: read ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.88)',
                                  fontSize: 13,
                                  lineHeight: 1.45,
                                  marginLeft: 24,
                                  marginBottom: 8,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textDecoration: 'none',
                                }}
                              >
                                {n.body}
                              </div>
                            )}
                            <div
                              style={{
                                textAlign: 'right',
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.45)',
                                marginLeft: 24,
                                fontVariantNumeric: 'tabular-nums',
                                textDecoration: 'none',
                              }}
                            >
                              {formatDateTime(n.created_at)}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
