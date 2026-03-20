'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'

type JournalRow = {
  id: string
  user_id: string
  date: string
  photo_url?: string | null
  memo?: string | null
  score: number
  product_ids?: string[] | null
  created_at: string
}

type AuthorRow = {
  id: string
  name: string
  avatar_url?: string | null
  skin_type?: string | null
}

type ProductLite = {
  id: string
  name: string
  thumb_img?: string | null
  retail_price?: number | null
  brands?: { name: string }[] | { name: string } | null
}

type GuestbookRow = {
  id: string
  owner_id: string
  writer_id: string
  writer_name: string
  message: string
  created_at: string
}

function skinBadgeText(skinType: string | null | undefined) {
  if (!skinType) return '미설정 ✨'
  return `${skinType} ✨`
}

function getBrandName(p: ProductLite) {
  const b: any = p.brands
  if (!b) return ''
  if (Array.isArray(b)) return b?.[0]?.name || ''
  return b?.name || ''
}

export default function JournalPublicClient({
  journal,
  author,
  products,
  likeCount,
  initialGuestbook,
  journalId,
}: {
  journal: JournalRow
  author: AuthorRow
  products: ProductLite[]
  likeCount: number
  initialGuestbook: GuestbookRow[]
  journalId: string
}) {
  const supabase = createClient()
  const router = useRouter()

  const { getSettingNum } = useAdminSettings()
  const guestbookMaxChars = getSettingNum('myworld', 'guestbook_max_chars', 300)

  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(likeCount || 0)

  const [guestbookMessage, setGuestbookMessage] = useState('')
  const [guestbookSaving, setGuestbookSaving] = useState(false)
  const [guestbookError, setGuestbookError] = useState('')
  const [guestbookRows, setGuestbookRows] = useState<GuestbookRow[]>(initialGuestbook || [])

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) return

        const { data: profile } = await supabase
          .from('users')
          .select('id,name')
          .eq('auth_id', data.user.id)
          .single()

        if (!profile?.id) return

        setAuthUserId(profile.id)
        setMe({ id: profile.id, name: profile.name || '' })

        const { data: myLike } = await supabase
          .from('skin_journal_likes')
          .select('id')
          .eq('journal_id', journal.id)
          .eq('user_id', profile.id)
          .maybeSingle()

        setLiked(!!myLike)
      } finally {
        setLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.id])

  const requireLogin = (redirectPath: string) => {
    router.push(`/login?role=customer&redirect=${encodeURIComponent(redirectPath)}`)
  }

  const onToggleLike = async () => {
    if (!me) {
      requireLogin(`/journal/${journalId}`)
      return
    }

    const nextLiked = !liked
    setLiked(nextLiked)
    setCount(c => Math.max(0, c + (nextLiked ? 1 : -1)))

    try {
      if (nextLiked) {
        await supabase.from('skin_journal_likes').insert({ journal_id: journal.id, user_id: me.id })
      } else {
        await supabase.from('skin_journal_likes').delete().eq('journal_id', journal.id).eq('user_id', me.id)
      }
    } catch {
      // rollback best-effort
      setLiked(!nextLiked)
      setCount(c => Math.max(0, c + (nextLiked ? -1 : 1)))
    }
  }

  const onPostGuestbook = async () => {
    if (!me) {
      requireLogin(`/journal/${journalId}`)
      return
    }
    if (!guestbookMessage.trim()) {
      setGuestbookError('메시지를 입력해주세요.')
      return
    }

    setGuestbookSaving(true)
    setGuestbookError('')
    try {
      await supabase.from('guestbook').insert({
        owner_id: journal.user_id,
        writer_id: me.id,
        writer_name: me.name,
        message: guestbookMessage.trim(),
      })
      setGuestbookMessage('')
      const { data: rows } = await supabase
        .from('guestbook')
        .select('id,owner_id,writer_id,writer_name,message,created_at')
        .eq('owner_id', journal.user_id)
        .order('created_at', { ascending: false })
        .limit(20)
      setGuestbookRows((rows || []) as any)
    } catch (e: any) {
      setGuestbookError(e?.message || '방명록 저장에 실패했습니다.')
    } finally {
      setGuestbookSaving(false)
    }
  }

  const usedProducts = useMemo(() => products || [], [products])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ padding: '16px 18px 0', position: 'sticky', top: 0, background: 'linear-gradient(160deg,#0a0c0f,#111318)', zIndex: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
            ‹
          </button>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>공개 저널</div>
          <div />
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        {/* 작성자 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(201,168,76,0.25)', background: 'rgba(0,0,0,0.2)' }}>
              {author.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>🙂</div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{author.name}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontWeight: 900, fontSize: 12, padding: '6px 10px', borderRadius: 999 }}>
                  {skinBadgeText(author.skin_type)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleLike}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: liked ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${liked ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                color: liked ? 'var(--gold)' : 'var(--text3)',
                fontWeight: 900,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ❤️ 공감 {count}
            </button>
          </div>
        </div>

        {/* 저널 본문 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          {journal.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={journal.photo_url} alt="" style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', marginBottom: 12, maxHeight: 260, objectFit: 'cover' }} />
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{journal.date}</div>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 900 }}>{journal.score}점</div>
          </div>

          <div style={{ fontSize: 13, color: '#fff', fontWeight: 800, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {journal.memo || '메모 없음'}
          </div>
        </div>

        {/* 사용 제품 */}
        {usedProducts.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>사용 제품</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {usedProducts.slice(0, 4).map(p => (
                <div key={p.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                      {p.thumb_img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>🧴</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{getBrandName(p)}</div>
                      <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 900, marginTop: 6 }}>{`₩${(p.retail_price || 0).toLocaleString()}`}</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => router.push(`/products/${p.id}`)} style={{ width: '100%', marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)', color: 'var(--gold)', fontWeight: 900, cursor: 'pointer' }}>
                    구매하기 →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 방명록 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>방명록</div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 900, marginBottom: 8 }}>{me ? '메시지를 남겨보세요' : '로그인 후 방명록을 작성할 수 있어요'}</div>
            <textarea
              value={guestbookMessage}
              onChange={e => setGuestbookMessage(e.target.value)}
              placeholder="메시지를 남겨보세요."
              maxLength={guestbookMaxChars}
              style={{ width: '100%', minHeight: 90, resize: 'none', background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, color: '#fff', fontSize: 13, outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {guestbookMessage.trim().length}/{guestbookMaxChars}
              </div>
              <button
                type="button"
                onClick={onPostGuestbook}
                disabled={guestbookSaving}
                style={{ padding: '10px 14px', borderRadius: 12, background: guestbookSaving ? 'var(--bg3)' : 'rgba(201,168,76,0.12)', border: `1px solid ${guestbookSaving ? 'var(--border)' : 'rgba(201,168,76,0.35)'}`, color: guestbookSaving ? 'var(--text3)' : 'var(--gold)', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                등록
              </button>
            </div>
            {guestbookError && <div style={{ marginTop: 8, fontSize: 12, color: '#e57373', fontWeight: 800 }}>{guestbookError}</div>}
          </div>

          {guestbookRows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>아직 방명록이 없어요.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {guestbookRows.slice(0, 6).map(g => (
                <div key={g.id} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{g.writer_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(g.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.5 }}>{g.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 배너 */}
        <div style={{ marginTop: 16, background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: 14 }}>
          <button type="button" onClick={() => router.push('/signup?role=customer')} style={{ width: '100%', padding: 14, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 12, color: 'var(--gold)', fontWeight: 900, cursor: 'pointer' }}>
            AURAN에서 내 피부 기록 시작하기 →
          </button>
        </div>
      </div>
    </div>
  )
}

