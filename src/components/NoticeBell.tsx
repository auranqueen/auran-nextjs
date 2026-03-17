'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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
       {unread > 0 && (
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
           {unread}
         </span>
       )}
     </div>
   )
}

