'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ===== [고객의 목소리 함] 어드민 목록 페이지 =====
// 버그(🔴)/아이디어(💡)/칭찬(💜) 수신함
// 읽음/처리완료 인라인 토글 가능
export default function VoiceBoxPage() {
  const [items, setItems] = useState<any[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const { data } = await supabase
        .from('voice_box')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
      setItems(data || [])
    })()
  }, [])

  const unreadBug = items?.filter(i => i.type === 'bug' && !i.is_read).length || 0

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>
        고객의 목소리 함
        {unreadBug > 0 && (
          <span style={{
            marginLeft: 8,
            fontSize: 11,
            background: '#ff4444',
            color: '#fff',
            borderRadius: 20,
            padding: '2px 8px',
          }}>
            버그 {unreadBug}건 미처리
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 24 }}>
        고객이 남긴 버그 신고 · 아이디어 · 칭찬
      </div>

      {items?.map(item => (
        <VoiceBoxItem key={item.id} item={item} />
      ))}

      {(!items || items.length === 0) && (
        <div style={{ textAlign: 'center', color: '#ccc', padding: '40px 0', fontSize: 13 }}>
          아직 접수된 목소리가 없어요
        </div>
      )}
    </div>
  )
}

function VoiceBoxItem({ item }: { item: any }) {
  const typeMap = {
    bug: { label: '🐛 버그', color: '#ff4444' },
    idea: { label: '💡 아이디어', color: '#f5a623' },
    praise: { label: '💜 칭찬', color: '#7B5EA7' },
  } as const

  const t = typeMap[item.type as keyof typeof typeMap]

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      border: '1px solid #f0f0f0',
      marginBottom: 10,
      background: item.is_read ? '#fafafa' : '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: t.color }}>{t.label}</span>
        <span style={{ fontSize: 11, color: '#ccc' }}>
          {item.profiles?.full_name || '비회원'} · {item.page_url}
        </span>
        <span style={{ fontSize: 11, color: '#ccc', marginLeft: 'auto' }}>
          {new Date(item.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
        {item.content}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <ResolveButton id={item.id} isRead={item.is_read} isResolved={item.is_resolved} />
      </div>
    </div>
  )
}

function ResolveButton({ id, isRead, isResolved }: { id: string, isRead: boolean, isResolved: boolean }) {
  const [read, setRead] = useState(isRead)
  const [resolved, setResolved] = useState(isResolved)
  const supabase = createClient()

  return (
    <>
      <button
        onClick={async () => {
          await supabase.from('voice_box').update({ is_read: !read }).eq('id', id)
          setRead(r => !r)
        }}
        style={{
          fontSize: 11, padding: '4px 10px', borderRadius: 20,
          border: '1px solid #eee', cursor: 'pointer',
          background: read ? '#f0f0f0' : '#fff', color: '#666',
        }}
      >
        {read ? '읽음 ✓' : '읽음 처리'}
      </button>
      <button
        onClick={async () => {
          await supabase.from('voice_box').update({ is_resolved: !resolved }).eq('id', id)
          setResolved(r => !r)
        }}
        style={{
          fontSize: 11, padding: '4px 10px', borderRadius: 20,
          border: '1px solid #eee', cursor: 'pointer',
          background: resolved ? '#7B5EA7' : '#fff',
          color: resolved ? '#fff' : '#666',
        }}
      >
        {resolved ? '처리완료 ✓' : '처리완료'}
      </button>
    </>
  )
}
