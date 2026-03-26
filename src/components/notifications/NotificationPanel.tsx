'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NotificationPanelProps = {
  isOpen: boolean
  onClose: () => void
}

const PURPLE = '#7B5EA7'

function iconForType(type: string): { icon: string; color: string } {
  if (type === 'toast_expire') return { icon: '🔥', color: '#ff8a3d' }
  if (type === 'best_review') return { icon: '🎉', color: '#9b7bd2' }
  if (type === 'grade_up') return { icon: '✨', color: '#C9A96E' }
  if (type === 'review_purchase') return { icon: '💜', color: '#7B5EA7' }
  if (type === 'reservation') return { icon: '💆', color: '#66d1c1' }
  if (type === 'skin_diary') return { icon: '🌸', color: '#ff8fb1' }
  if (type === 'birthday') return { icon: '🎂', color: '#ffd93d' }
  if (type === 'groupbuy') return { icon: '⏰', color: '#ff5b5b' }
  if (type === 'timesale') return { icon: '⚡', color: '#ffe066' }
  if (type === 'noir_invite') return { icon: '🖤', color: '#b79f74' }
  return { icon: '🔔', color: '#a0a0a0' }
}

function sortNotices(list: any[]) {
  return [...list].sort((a, b) => {
    const aUrgent = String(a?.type || '') === 'urgent' ? 1 : 0
    const bUrgent = String(b?.type || '') === 'urgent' ? 1 : 0
    if (aUrgent !== bUrgent) return bUrgent - aUrgent
    const aTime = new Date(a?.created_at || 0).getTime()
    const bTime = new Date(b?.created_at || 0).getTime()
    return bTime - aTime
  })
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<'notif' | 'notice'>('notif')
  const [uid, setUid] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [notices, setNotices] = useState<any[]>([])
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null)
  const [popNotice, setPopNotice] = useState<any>(null)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [swipeColor, setSwipeColor] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id || ''
      setUid(userId)
      if (userId) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
        setItems(data || [])
      } else {
        setItems([])
      }
      const { data: nData } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotices(sortNotices(nData || []))
    }
    void run()
  }, [isOpen, supabase])

  const chalkNoise = useMemo(
    () =>
      "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.08))",
    []
  )

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: isOpen ? 'rgba(0,0,0,0.35)' : 'transparent',
          zIndex: isOpen ? 199 : -1,
          transition: 'background 220ms ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(320px, 100vw)',
          background: '#111',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 200,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 240ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 8px' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <button
              type="button"
              onClick={() => setTab('notif')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                borderBottom: tab === 'notif' ? `2px solid ${PURPLE}` : '2px solid transparent',
              }}
            >
              알림
            </button>
            <button
              type="button"
              onClick={() => setTab('notice')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                borderBottom: tab === 'notice' ? `2px solid ${PURPLE}` : '2px solid transparent',
              }}
            >
              공지
            </button>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
            X
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
          {tab === 'notif' ? (
            items.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingTop: 28 }}>새 알림이 없어요</div>
            ) : (
              items.map((n: any) => {
                const iconStyle = iconForType(String(n.type || ''))
                return (
                  <div
                    key={n.id}
                    onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
                    onTouchEnd={async e => {
                      if (touchStartX == null) return
                      const delta = e.changedTouches[0].clientX - touchStartX
                      setTouchStartX(null)
                      if (delta > 50) {
                        setSwipeColor(prev => ({ ...prev, [n.id]: 'rgba(220,60,60,0.25)' }))
                        await supabase.from('notifications').delete().eq('id', n.id)
                        setItems(prev => prev.filter(x => x.id !== n.id))
                        return
                      }
                      if (delta < -50) {
                        setSwipeColor(prev => ({ ...prev, [n.id]: 'rgba(123,94,167,0.25)' }))
                        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
                        setItems(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: true } : x)))
                        return
                      }
                    }}
                    onClick={async () => {
                      console.log('카드 클릭됨', n.id)
                      setPopNotice(n)
                      if (!n.is_read) {
                        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
                        setItems(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: true } : x)))
                      }
                    }}
                    style={{
                      background: swipeColor[n.id] || (n.is_read ? 'rgba(255,255,255,0.03)' : 'rgba(123,94,167,0.08)'),
                      borderRadius: 12,
                      padding: 14,
                      margin: 8,
                      cursor: 'pointer',
                      pointerEvents: 'all',
                      opacity: n.is_read ? 0.5 : 1,
                      borderLeft: n.is_read ? '3px solid transparent' : `3px solid ${PURPLE}`,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: iconStyle.color }}>{iconStyle.icon}</span>
                      <span style={{ fontSize: 13, color: '#fff' }}>{n.title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{'>'}</span>
                    </div>
                  </div>
                )
              })
            )
          ) : notices.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: '12px 10px', fontFamily: "'Courier New', monospace" }}>
              // 아직 공지가 없어요
            </div>
          ) : (
            <div
              style={{
                background: '#1a3a1a',
                borderRadius: 12,
                padding: 16,
                fontFamily: "'Courier New', monospace",
                backgroundImage: chalkNoise,
                backgroundSize: '3px 3px, 100% 100%',
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.25)',
              }}
            >
              {notices.map((n: any, idx: number) => {
                const type = String(n.type || '')
                const chalkColor =
                  n.is_important ? '#ff6b6b' :
                  type === 'event' ? '#ffd93d' :
                  type === 'feature' ? '#7B5EA7' :
                  type === 'brand' ? '#6bcb77' :
                  'rgba(255,255,255,0.85)'
                return (
                  <div key={n.id || idx} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setExpandedNotice(expandedNotice === n.id ? null : n.id)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', paddingTop: 2 }}>{idx + 1}</div>
                      <div>
                        <div style={{ fontSize: 13, color: '#fff' }}>{n.title}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{n.created_at ? String(n.created_at).slice(0, 10) : ''}</div>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{expandedNotice === n.id ? 'v' : '>'}</div>
                    </div>
                    <div
                      style={{
                        background: '#1a3a1a',
                        borderRadius: 10,
                        padding: expandedNotice === n.id ? '16px' : '0 16px',
                        fontFamily: "'Courier New', monospace",
                        maxHeight: expandedNotice === n.id ? '400px' : '0px',
                        transition: 'max-height 0.4s ease, padding 0.4s ease, opacity 0.4s ease',
                        opacity: expandedNotice === n.id ? 1 : 0,
                        overflow: 'hidden',
                        marginTop: expandedNotice === n.id ? 8 : 0,
                      }}
                    >
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                        // {n.created_at ? String(n.created_at).slice(0, 10) : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>const notice = '</div>
                      <div style={{ fontSize: 12, color: chalkColor, margin: '4px 0 4px 10px' }}>
                        {String(n.body || '')}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>'</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', animation: expandedNotice === n.id ? 'blinkCursor 1s steps(1) infinite' : 'none' }}>|</div>
                    </div>
                  </div>
                )
              })}
              <style>{`@keyframes blinkCursor { 0%{opacity:1} 50%{opacity:0} 100%{opacity:1} } @keyframes popIn { 0% { transform: scale(0) translateY(10px); opacity: 0; } 60% { transform: scale(1.1) translateY(-3px); opacity: 1; } 100% { transform: scale(1) translateY(0); opacity: 1; } } @keyframes wordRise { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }`}</style>
            </div>
          )}
        </div>
      </div>
      {popNotice ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: '90vw',
              maxWidth: 360,
              borderRadius: 24,
              padding: '40px 28px',
              textAlign: 'center',
              position: 'relative',
              background:
                popNotice?.type === 'birthday' ? 'linear-gradient(135deg, #3d1f5e, #7B5EA7)' :
                popNotice?.type === 'grade_up' ? 'linear-gradient(135deg, #1f3d2e, #C9A96E)' :
                popNotice?.type === 'toast_expire' ? 'linear-gradient(135deg, #3d1f00, #ff6b00)' :
                popNotice?.type === 'best_review' ? 'linear-gradient(135deg, #1f003d, #7B5EA7)' :
                'linear-gradient(135deg, #1a1a2e, #7B5EA7)',
            }}
          >
            <button
              type="button"
              onClick={() => setPopNotice(null)}
              style={{ position: 'absolute', right: 12, top: 10, border: 'none', background: 'transparent', color: '#fff', fontSize: 16, cursor: 'pointer' }}
            >
              X
            </button>
            <div style={{ fontSize: 72, animation: 'bounceIn 0.5s ease' }}>{iconForType(String(popNotice?.type || '')).icon}</div>
            <div style={{ fontSize: 18, color: '#fff', marginTop: 10, animation: 'slideDown 0.3s ease' }}>{String(popNotice?.title || '')}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 10, lineHeight: 1.6, animation: 'fadeIn 0.5s ease' }}>
              {String(popNotice?.body || '')}
            </div>
            {popNotice?.link_url ? (
              <button
                type="button"
                onClick={() => {
                  router.push(String(popNotice.link_url))
                  setPopNotice(null)
                }}
                style={{ marginTop: 14, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                바로가기 →
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <style>{`@keyframes bounceIn { 0%{transform:scale(0)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} } @keyframes slideDown { 0%{transform:translateY(-20px);opacity:0} 100%{transform:translateY(0);opacity:1} } @keyframes fadeIn { 0%{opacity:0} 100%{opacity:1} }`}</style>
    </>
  )
}

