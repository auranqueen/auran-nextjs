'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

export type NoticePanelProps = {
  supabase: SupabaseClient
  myUserId: string
  /** 제어 모드: 부모에서 패널 열림 여부를 관리할 때 전달 */
  open?: boolean
  onClose?: () => void
  showHomeEditChrome?: boolean
  onNoticeAdmin?: (n: any) => void
  onDecrementUnread?: () => void
}

export default function NoticePanel({
  supabase,
  myUserId,
  open: controlledOpen,
  onClose,
  showHomeEditChrome = false,
  onNoticeAdmin,
  onDecrementUnread,
}: NoticePanelProps) {
  const router = useRouter()
  const [innerOpen, setInnerOpen] = useState(false)
  const noticeOpen = typeof controlledOpen === 'boolean' ? controlledOpen : innerOpen
  const closePanel = () => {
    if (onClose) onClose()
    else setInnerOpen(false)
  }

  const [noticeTab, setNoticeTab] = useState<'notif' | 'notice'>('notif')
  const [myNotifications, setMyNotifications] = useState<any[]>([])
  const [notices, setNotices] = useState<any[]>([])
  const [noticeLoading, setNoticeLoading] = useState(false)

  useEffect(() => {
    if (!noticeOpen) return
    const loadPanelData = async () => {
      setNoticeLoading(true)
      if (myUserId) {
        const { data: nRows } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', myUserId)
          .order('created_at', { ascending: false })
          .limit(20)
        setMyNotifications(nRows || [])
      } else {
        setMyNotifications([])
      }
      const { data: noticeRows } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotices(noticeRows || [])
      setNoticeLoading(false)
    }
    void loadPanelData()
  }, [noticeOpen, myUserId])

  return (
    <>
      {noticeOpen ? (
        <>
          <div
            onClick={closePanel}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 190,
              visibility: noticeOpen ? 'visible' : 'hidden',
              pointerEvents: noticeOpen ? 'auto' : 'none',
            }}
          />
          <div
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(320px, 100%)',
              background: '#111',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              zIndex: 200,
              pointerEvents: noticeOpen ? 'auto' : 'none',
              visibility: noticeOpen ? 'visible' : 'hidden',
              transform: noticeOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 240ms ease',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 8px' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <button
                  type="button"
                  onClick={() => setNoticeTab('notif')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: 0,
                    borderBottom: noticeTab === 'notif' ? '2px solid #7B5EA7' : '2px solid transparent',
                  }}
                >
                  알림
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeTab('notice')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: 0,
                    borderBottom: noticeTab === 'notice' ? '2px solid #7B5EA7' : '2px solid transparent',
                  }}
                >
                  공지
                </button>
              </div>
              <button
                type="button"
                onClick={closePanel}
                style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 14, cursor: 'pointer' }}
              >
                X
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
              {noticeLoading ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: '10px 4px' }}>불러오는 중...</div>
              ) : noticeTab === 'notif' ? (
                myNotifications.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: '10px 4px' }}>새 알림이 없어요</div>
                ) : (
                  myNotifications.map((n: any) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) {
                          await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
                          setMyNotifications(prev => prev.map(row => (row.id === n.id ? { ...row, is_read: true } : row)))
                          onDecrementUnread?.()
                        }
                        if (n.link_url) router.push(String(n.link_url))
                      }}
                      style={{
                        padding: '10px 4px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      {!n.is_read ? <span style={{ position: 'absolute', left: -6, top: 16, width: 6, height: 6, borderRadius: 3, background: '#7B5EA7' }} /> : null}
                      <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{n.body || ''}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{n.created_at ? String(n.created_at).slice(0, 16).replace('T', ' ') : ''}</div>
                    </div>
                  ))
                )
              ) : notices.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: '10px 4px' }}>공지사항이 없어요</div>
              ) : (
                notices.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!showHomeEditChrome) return
                      onNoticeAdmin?.(n)
                    }}
                    style={{
                      padding: '10px 4px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      cursor: showHomeEditChrome ? 'pointer' : undefined,
                      outline: showHomeEditChrome ? '1px dashed rgba(123,94,167,0.35)' : undefined,
                      borderRadius: 6,
                    }}
                  >
                    {n.is_important ? (
                      <div style={{ display: 'inline-block', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 10, marginBottom: 6 }}>중요</div>
                    ) : null}
                    <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{n.created_at ? String(n.created_at).slice(0, 10) : ''}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
