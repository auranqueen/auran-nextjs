'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function AdminOwnerChatPage() {
  const supabase = createClient()
  const [owners, setOwners] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('users').select('id').eq('auth_id', data.user.id).maybeSingle()
        .then(({ data: u }) => { if (u?.id) setMyId(u.id) })
    })
    supabase.from('users').select('id, name, email').eq('role', 'owner').eq('status', 'active')
      .then(({ data }) => { if (data) setOwners(data) })
  }, [])

  useEffect(() => {
    if (!selected) return
    supabase.from('chat_channels').select('id').eq('user_id', selected).maybeSingle()
      .then(({ data: ch }) => {
        if (!ch?.id) return
        supabase.from('consultation_messages').select('*').eq('channel_id', ch.id)
          .order('created_at', { ascending: true })
          .then(({ data }) => { if (data) setMessages(data) })
      })
  }, [selected])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#0d0b12' }}>
      <div style={{ width: 200, borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto' }}>
        <div style={{ padding: '12px 14px', fontSize: 9, color: '#C9A96E', letterSpacing: 2, fontFamily: 'monospace' }}>원장님 목록</div>
        {owners.map(o => (
          <div key={o.id} onClick={() => setSelected(o.id)}
            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: selected === o.id ? 'rgba(123,94,167,0.15)' : 'transparent' }}>
            <div style={{ fontSize: 12, color: '#fff' }}>{o.name || o.email?.split('@')[0]}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{o.email}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            원장님을 선택해주세요
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {messages.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_id === myId ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                  <div style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, maxWidth: '70%',
                    background: m.sender_id === myId ? 'rgba(123,94,167,0.3)' : 'rgba(255,255,255,0.06)',
                    color: m.sender_id === myId ? '#c4a8f0' : 'rgba(255,255,255,0.8)' }}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                placeholder="원장님께 메시지..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, outline: 'none' }} />
              <button style={{ padding: '10px 18px', borderRadius: 10, background: '#7B5EA7', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>전송</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
