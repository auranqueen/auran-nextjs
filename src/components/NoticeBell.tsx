'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'

const NOTICE_IDS = ['notice-001', 'notice-002'] as const

function getUnreadCount(): number {
   if (typeof window === 'undefined') return 0
   let unread = 0
   for (const id of NOTICE_IDS) {
     const key = `auran_read_${id}`
     if (!localStorage.getItem(key)) unread += 1
   }
   return unread
 }
 
export default function NoticeBell({
   size = 34,
   borderRadius = 9,
 }: {
   size?: number
   borderRadius?: number
 }) {
   const router = useRouter()
   const [unread, setUnread] = useState(0)
  const [dynamicUnread, setDynamicUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])

  const supabase = createClient()
  const { getSetting } = useAdminSettings()
  const highlightColor = getSetting('notice_ui', 'highlight_color', '#F5E642')
 
   const btnStyle = useMemo(() => ({
     width: size,
     height: size,
     borderRadius,
     background: 'rgba(255,255,255,0.06)',
     border: '1px solid var(--border)',
     color: 'var(--text2)',
     fontSize: 16,
     cursor: 'pointer',
   }), [size, borderRadius])
 
   useEffect(() => {
     const update = () => setUnread(getUnreadCount())
     update()
     window.addEventListener('storage', update)
     document.addEventListener('visibilitychange', update)
     return () => {
       window.removeEventListener('storage', update)
       document.removeEventListener('visibilitychange', update)
     }
   }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) {
          setDynamicUnread(0)
          return
        }

        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle()

        let c1 = 0
        if (profile?.id) {
          const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('is_read', false)
          c1 = count || 0
        }

        let c2 = 0
        {
          const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)
          c2 = count || 0
        }

        setDynamicUnread(c1 + c2)
      } catch {
        setDynamicUnread(0)
      }
    }
    run()
  }, [])

  useEffect(() => {
    if (!open) return
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) {
        setItems([])
        return
      }
      const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      const userIds = [user.id, profile?.id].filter(Boolean)
      const { data } = await supabase
        .from('notifications')
        .select('id,title,body,is_read,created_at')
        .in('user_id', userIds as string[])
        .order('created_at', { ascending: false })
        .limit(30)
      setItems(data || [])
    }
    run()
  }, [open, supabase])
 
   return (
     <div style={{ position: 'relative' }}>
       <button
         type="button"
         aria-label="공지사항"
        onClick={() => setOpen(true)}
         style={btnStyle}
       >
         🔔
       </button>
      {unread + dynamicUnread > 0 && (
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
          {unread + dynamicUnread}
         </span>
       )}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: 'linear-gradient(145deg, #1a2e1a, #0d1f0d)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '16px 14px 24px', maxHeight: '72vh', overflowY: 'auto' }}>
            <div style={{ width: 46, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.4)', margin: '0 auto 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ color: highlightColor, fontSize: 18, fontWeight: 700 }}>✦ 알림</div>
              <button onClick={() => router.push('/notices')} style={{ border: '1px dashed rgba(255,255,255,0.7)', background: 'transparent', color: '#fff', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' }}>공지 보기</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((n, idx) => (
                <div key={n.id} style={{ borderBottom: '1px dashed rgba(255,255,255,0.35)', paddingBottom: 8, opacity: n.is_read ? 0.4 : 1, textDecoration: n.is_read ? 'line-through' : 'none' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{idx % 3 === 0 ? '✦' : idx % 3 === 1 ? '✧' : '★'} {n.title || '알림'}</div>
                  <div style={{ marginTop: 3, color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{n.body || ''}</div>
                </div>
              ))}
              {items.length === 0 && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>알림이 없습니다.</div>}
            </div>
          </div>
        </div>
      )}
     </div>
   )
}

