'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  const supabase = createClient()
 
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
 
   return (
     <div style={{ position: 'relative' }}>
       <button
         type="button"
         aria-label="공지사항"
         onClick={() => router.push('/notices')}
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
     </div>
   )
}

