// src/app/notices/page.tsx

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NOTICES, NoticeItem } from './data'
import { useAdminSettings } from '@/hooks/useAdminSettings'

export default function NoticesPage() {
  const router = useRouter()
  const [readMap, setReadMap] = useState<Record<string, boolean>>({})

  const supabase = createClient()
  const { getSetting, getSettingNum } = useAdminSettings()
  const chalkEnabled = getSetting('notice_ui', 'chalk_effect_enabled', '1') !== '0'
  const highlightColor = getSetting('notice_ui', 'highlight_color', '#F5E642')
  const typingSpeed = getSettingNum('notice_ui', 'typing_animation_speed', 30)

  const isRead = useMemo(() => {
    return (id: string) => !!readMap[id]
  }, [readMap])

  useEffect(() => {
    const m: Record<string, boolean> = {}
    for (const n of NOTICES) {
      m[n.id] = !!localStorage.getItem(`auran_read_${n.id}`)
    }
    setReadMap(m)
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) return

        const { data: profile } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle()

        // schema 호환: (1) users.id 기준, (2) auth user.id 기준 둘 다 시도
        if (profile?.id) {
          await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
        }
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
      } catch {
        // ignore
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openNotice = (notice: NoticeItem) => {
    localStorage.setItem(`auran_read_${notice.id}`, '1')
    setReadMap(prev => ({ ...prev, [notice.id]: true }))
    router.push(`/notices/${notice.id}`)
  }

  const pinned = NOTICES.filter(n => n.isPinned)
  const regular = NOTICES.filter(n => !n.isPinned)

  return (
    <div style={{ minHeight: '100vh', color: '#fff', background: 'linear-gradient(145deg, #1a2e1a, #0d1f0d)', fontFamily: "'Nanum Pen Script', 'Caveat', cursive", position: 'relative', overflow: 'hidden' }}>
      {chalkEnabled && <div style={{ position: 'absolute', inset: 0, opacity: 0.14, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 0.5px, transparent 1px)', backgroundSize: '3px 3px' }} />}
      <style>{`@keyframes chalkWrite { from { width: 0; opacity: 0.3; } to { width: 100%; opacity: 1; } }`}</style>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 0', position: 'relative', zIndex: 1 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>
          ←
        </button>
        <h1 style={{ fontFamily: "'Caveat', 'Nanum Pen Script', cursive", fontSize: '34px', fontWeight: 700, color: highlightColor, letterSpacing: 0.5 }}>🔔 공지사항</h1>
      </div>

      <div style={{ padding: '20px', position: 'relative', zIndex: 1 }}>

        {/* 고정 공지 */}
        {pinned.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: highlightColor, letterSpacing: '2px', fontWeight: 700, marginBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.65)', paddingBottom: 5 }}>
              📌 고정 공지
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pinned.map(notice => (
                <NoticeCard key={notice.id} notice={notice} onClick={() => openNotice(notice)} pinned read={isRead(notice.id)} typingSpeed={typingSpeed} />
              ))}
            </div>
          </div>
        )}

        {/* 일반 공지 */}
        {regular.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.72)', letterSpacing: '2px', fontWeight: 700, marginBottom: '12px', borderBottom: '1px dashed rgba(255,255,255,0.4)', paddingBottom: 5 }}>
              전체 공지
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {regular.map(notice => (
                <NoticeCard key={notice.id} notice={notice} onClick={() => openNotice(notice)} read={isRead(notice.id)} typingSpeed={typingSpeed} />
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  )
}

function NoticeCard({ notice, onClick, pinned, read, typingSpeed }: { notice: NoticeItem; onClick: () => void; pinned?: boolean; read?: boolean; typingSpeed: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', background: 'transparent',
        border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.45)',
        borderRadius: 0, padding: '14px 4px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '12px',
        opacity: read ? 0.55 : 1,
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '16px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'relative', width: '100%', animation: `chalkWrite ${Math.max(0.6, notice.title.length * 0.03 * typingSpeed / 30)}s ease-out both` }}>
              {pinned ? '🔴 ' : '✧ '} {notice.title}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>{notice.date}</div>
        </div>
      </div>
    </button>
  )
}

