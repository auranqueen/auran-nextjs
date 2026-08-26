'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type UserRow = { id: string; name: string; avatar_url: string | null }
type CommentRow = {
  id: string
  author_type: string
  author_user_id: string
  parent_comment_id: string | null
  mentioned_user_id: string | null
  content: string
  like_count: number
  created_at: string
}

const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#fff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.12)'

function renderContent(content: string, mentioned?: UserRow | null) {
  if (!mentioned) return content
  const mention = `@${mentioned.name}`
  if (!content.includes(mention) && !content.includes('@')) {
    return (
      <>
        <span style={{ color: GOLD, fontWeight: 700 }}>{mention} </span>
        {content}
      </>
    )
  }
  const parts = content.split(/(@[^\s]+)/g)
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} style={{ color: GOLD, fontWeight: 700 }}>{p}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

export default function SceneCommentSheet(props: {
  scenePostId: string
  open: boolean
  onClose: () => void
}) {
  const { scenePostId, open, onClose } = props
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [usersById, setUsersById] = useState<Record<string, UserRow>>({})
  const [uploaderUserId, setUploaderUserId] = useState<string | null>(null)
  const [salon, setSalon] = useState<{ id: string; name: string } | null>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`/api/oren-scene-posts/${scenePostId}/comments`)
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error || 'load_failed')
        return
      }
      setComments(json.comments || [])
      setUsersById(json.usersById || {})
      setUploaderUserId(json.uploaderUserId || null)
      setSalon(json.salon || null)
    } finally {
      setLoading(false)
    }
  }, [scenePostId])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const roots = useMemo(
    () => comments.filter((c) => !c.parent_comment_id),
    [comments],
  )
  const repliesOf = useCallback(
    (id: string) => comments.filter((c) => c.parent_comment_id === id),
    [comments],
  )

  const submit = async () => {
    if (submitting) return
    const content = text.trim()
    if (!content) return
    setSubmitting(true)
    setErr('')
    try {
      const res = await fetch(`/api/oren-scene-posts/${scenePostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          parent_comment_id: replyTo?.id || null,
          mentioned_user_id: replyTo?.author_user_id || null,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        setErr(json?.error === 'not_logged_in' ? '로그인이 필요해요' : (json?.error || '등록 실패'))
        return
      }
      setText('')
      setReplyTo(null)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const report = async (commentId: string) => {
    setMenuId(null)
    const res = await fetch(`/api/oren-scene-posts/${scenePostId}/comments/${commentId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'inappropriate' }),
    })
    const json = await res.json().catch(() => ({}))
    if (json?.ok) alert('신고가 접수됐어요')
    else if (json?.error === 'already_reported') alert('이미 신고한 댓글이에요')
    else if (json?.error === 'not_logged_in') alert('로그인이 필요해요')
    else alert('신고에 실패했어요')
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '72vh',
          background: '#141018',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: TEXT }}>댓글 {comments.length}</div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: TEXT_SUB, fontSize: 13 }}>닫기</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 12px' }}>
          {loading ? (
            <div style={{ color: TEXT_SUB, fontSize: 12, padding: 16 }}>불러오는 중…</div>
          ) : roots.length === 0 ? (
            <div style={{ color: TEXT_SUB, fontSize: 12, padding: 16 }}>첫 댓글을 남겨보세요</div>
          ) : (
            roots.map((c) => {
              const author = usersById[c.author_user_id]
              const mentioned = c.mentioned_user_id ? usersById[c.mentioned_user_id] : null
              const isOwnerReply = c.author_user_id === uploaderUserId
              const replies = repliesOf(c.id)
              return (
                <div key={c.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(123,94,167,0.35)',
                      backgroundImage: author?.avatar_url ? `url(${author.avatar_url})` : undefined,
                      backgroundSize: 'cover',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{author?.name || '회원'}</span>
                        {isOwnerReply && c.parent_comment_id ? (
                          <span style={{ fontSize: 10, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: '1px 6px' }}>원장</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: TEXT_SUB, fontSize: 14, padding: '0 4px' }}
                        >
                          ⋯
                        </button>
                      </div>
                      {menuId === c.id ? (
                        <div style={{ marginBottom: 6 }}>
                          <button
                            type="button"
                            onClick={() => void report(c.id)}
                            style={{ fontSize: 11, color: '#E57373', background: 'rgba(229,115,115,0.12)', border: 'none', borderRadius: 8, padding: '4px 8px' }}
                          >
                            신고하기
                          </button>
                        </div>
                      ) : null}
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45 }}>
                        {renderContent(c.content, mentioned)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(c)}
                        style={{ marginTop: 4, background: 'transparent', border: 'none', color: TEXT_SUB, fontSize: 11, padding: 0 }}
                      >
                        답글 달기
                      </button>
                    </div>
                  </div>

                  {replies.map((r) => {
                    const ra = usersById[r.author_user_id]
                    const rm = r.mentioned_user_id ? usersById[r.mentioned_user_id] : null
                    const ownerReply = r.author_user_id === uploaderUserId
                    return (
                      <div key={r.id} style={{ marginLeft: 42, marginTop: 10, display: 'flex', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(123,94,167,0.35)',
                          backgroundImage: ra?.avatar_url ? `url(${ra.avatar_url})` : undefined,
                          backgroundSize: 'cover',
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{ra?.name || '회원'}</span>
                            {ownerReply ? (
                              <span style={{ fontSize: 10, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: '1px 6px' }}>원장</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setMenuId(menuId === r.id ? null : r.id)}
                              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: TEXT_SUB, fontSize: 14 }}
                            >
                              ⋯
                            </button>
                          </div>
                          {menuId === r.id ? (
                            <button
                              type="button"
                              onClick={() => void report(r.id)}
                              style={{ fontSize: 11, color: '#E57373', background: 'rgba(229,115,115,0.12)', border: 'none', borderRadius: 8, padding: '4px 8px', marginTop: 4 }}
                            >
                              신고하기
                            </button>
                          ) : null}
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.45, marginTop: 2 }}>
                            {renderContent(r.content, rm)}
                          </div>
                          {ownerReply && salon ? (
                            <a
                              href={`/salons/${salon.id}/products`}
                              style={{
                                display: 'block',
                                marginTop: 8,
                                padding: '8px 10px',
                                borderRadius: 10,
                                border: `1px solid ${BORDER}`,
                                background: 'rgba(123,94,167,0.15)',
                                color: TEXT,
                                textDecoration: 'none',
                                fontSize: 12,
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{salon.name} 스토어</div>
                              <div style={{ color: TEXT_SUB, fontSize: 11, marginTop: 2 }}>살롱 스토어 바로가기 →</div>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div style={{ padding: '8px 14px 4px', fontSize: 10, color: TEXT_SUB, lineHeight: 1.45 }}>
          서로 존중하는 댓글 문화를 지켜주세요. 신고가 누적되면 관리자가 직접 확인 후 삭제해요.
        </div>
        {replyTo ? (
          <div style={{ padding: '0 14px', fontSize: 11, color: GOLD }}>
            @{usersById[replyTo.author_user_id]?.name || '회원'}님에게 답글
            <button type="button" onClick={() => setReplyTo(null)} style={{ marginLeft: 8, border: 'none', background: 'transparent', color: TEXT_SUB }}>취소</button>
          </div>
        ) : null}
        {err ? <div style={{ padding: '0 14px', fontSize: 11, color: '#E57373' }}>{err}</div> : null}
        <div style={{ display: 'flex', gap: 8, padding: '8px 14px 16px' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요"
            style={{
              flex: 1,
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.06)',
              color: TEXT,
              padding: '10px 12px',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            style={{
              border: 'none',
              borderRadius: 12,
              background: PURPLE,
              color: TEXT,
              padding: '0 14px',
              fontWeight: 800,
              fontSize: 13,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            등록
          </button>
        </div>
      </div>
    </div>
  )
}
