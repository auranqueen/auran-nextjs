'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabCommunity({ brandId, brandName }: Props) {
  const [toast, setToast] = useState('')
  const [post, setPost] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const posts = [
    { title: '신제품 사용 후기 공유해주세요', replies: 0, date: '-' },
    { title: 'Q&A · 제품 보관 방법', replies: 0, date: '-' },
  ]
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>✍️ 원장님 커뮤니티 글쓰기</div>
        <textarea
          value={post}
          onChange={e => setPost(e.target.value)}
          placeholder={`${brandName} 원장님들에게 공지·소식을 전해보세요`}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: TEXT, minHeight: 70, resize: 'none', outline: 'none', marginBottom: 8 }}
        />
        <button
          type="button"
          onClick={() => { if (post.trim()) { showToast('게시 완료!'); setPost('') } }}
          style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}
        >
          게시하기
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>💬 최근 게시글</div>
        {posts.map((p, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: i < posts.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 11, color: SUB }}>댓글 {p.replies} · {p.date}</div>
          </div>
        ))}
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>게시글을 작성하면 원장님들에게 노출됩니다</div>
      </div>
    </div>
  )
}
