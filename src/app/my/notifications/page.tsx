'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
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

export default function MyNotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { getSettingNum } = useAdminSettings()
  const maxDisplay = Math.max(1, Math.min(500, getSettingNum('notification', 'max_display_count', 200)))
  const autoReadDays = Math.max(0, getSettingNum('notification', 'auto_read_days', 30))

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotifRow[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)

  const resolveProfileId = useCallback(async (): Promise<string | null> => {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return null
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    return profile?.id ? String(profile.id) : null
  }, [supabase])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace('/login?redirect=/my/notifications')
        return
      }
      const pid = await resolveProfileId()
      setProfileId(pid)
      if (!pid) {
        setLoading(false)
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
      setLoading(false)
    }
    void run()
  }, [supabase, router, resolveProfileId, maxDisplay, autoReadDays])

  const grouped = useMemo(() => groupNotifications(items), [items])

  const markAllRead = async () => {
    const pid = profileId || (await resolveProfileId())
    if (!pid) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', pid).eq('is_read', false)
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
  }

  const onRowClick = async (n: NotifRow) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    const raw = (n.link && String(n.link).trim()) || ''
    const path = raw.startsWith('/') ? raw : getDefaultLinkForType(n.type || undefined) || ''
    if (path) router.push(path)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="알림장" right={<CustomerHeaderRight />} />
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => void markAllRead()}
            style={{
              border: `1px solid ${GOLD}`,
              background: 'rgba(201,168,76,0.12)',
              color: GOLD,
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            전체 읽음
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 12px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>알림이 없어요</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 1.5 }}>쿠폰·주문 알림이 여기 모여요</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {grouped.map((section) => (
              <div key={section.label}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{section.label}</div>
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
                          opacity: read ? 0.55 : 1,
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16, lineHeight: 1.2 }} aria-hidden>
                            {icon}
                          </span>
                          <span style={{ color: read ? 'rgba(255,255,255,0.75)' : '#fff', fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>
                            {n.title || '알림'}
                          </span>
                        </div>
                        {n.body && (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45, marginBottom: 6, paddingLeft: 24 }}>
                            {n.body}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', paddingLeft: 24 }}>{formatDateTime(n.created_at)}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
