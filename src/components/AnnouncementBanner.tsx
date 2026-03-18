'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Announcement = { id: string; title: string | null; content: string | null; type: string | null; is_pinned: boolean | null }

export default function AnnouncementBanner() {
  const [item, setItem] = useState<Announcement | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('announcements')
          .select('id, title, content, type, is_pinned')
          .or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
        const list = (data || []).filter((a: any) => a.title || a.content)
        setItem(list[0] || null)
      } catch {
        setItem(null)
      }
    }
    run()
  }, [])

  if (!item) return null

  const isSecurity = item.type === 'security'

  return (
    <div
      style={{
        marginBottom: 12,
        padding: '12px 16px',
        background: isSecurity ? 'rgba(201,168,76,0.08)' : 'var(--bg3)',
        border: `1px solid ${isSecurity ? '#c9a84c' : 'var(--border)'}`,
        borderRadius: 12,
        fontSize: 13,
        color: 'var(--text)',
      }}
    >
      {isSecurity && <span style={{ marginRight: 6 }}>🔐</span>}
      <strong style={{ color: isSecurity ? '#c9a84c' : 'var(--text)' }}>{item.title || '공지'}</strong>
      {item.content && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{item.content}</span>}
    </div>
  )
}
