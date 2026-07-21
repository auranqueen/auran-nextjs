'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 50
const GOLD = '#C9A96E'
const RED = '#e57373'

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'all'
type TypeFilterKey = 'all' | 'signup' | 'purchase' | 'attendance' | 'referral' | 'review' | 'store_review' | 'share_jam' | 'charge' | 'use'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'yesterday', label: '어제' },
  { key: 'week', label: '일주일' },
  { key: 'month', label: '한달' },
  { key: 'all', label: '전체' },
]

const TYPE_FILTER_OPTIONS: { key: TypeFilterKey; label: string; sourceType?: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'signup', label: '가입', sourceType: 'signup' },
  { key: 'purchase', label: '구매', sourceType: 'order' },
  { key: 'attendance', label: '출석', sourceType: 'attendance' },
  { key: 'referral', label: '추천', sourceType: 'referral' },
  { key: 'review', label: '리뷰', sourceType: 'review_bonus' },
  { key: 'store_review', label: '스토어리뷰', sourceType: 'store_review_bonus' },
  { key: 'share_jam', label: '🍓딸기잼', sourceType: 'share_jam' },
  { key: 'charge', label: '충전', sourceType: 'charge' },
  { key: 'use', label: '사용', sourceType: 'use' },
]

const TYPE_LABEL: Record<string, string> = {
  signup: '가입축하',
  purchase: '구매적립',
  attendance: '출석',
  referral: '추천보상',
  review: '리뷰',
  charge: '충전',
  use: '사용',
  share_reward: '공유보상',
  share_jam: '🍓딸기잼',
  store_review_bonus: '스토어리뷰',
  order: '구매적립',
  share: '공유',
  gift: '선물',
}

type UserJoin = { name?: string | null; auth_id?: string | null; origin_track?: string | null }
type ToastRow = {
  id: string
  user_id: string | null
  amount: number | null
  transaction_type: string | null
  source_type: string | null
  source_id: string | null
  reference_id: string | null
  created_at: string | null
  note: string | null
  admin_id: string | null
  status: string
  balance_after: number
  users?: UserJoin | UserJoin[] | null
}

function pickUser(u: ToastRow['users']): UserJoin | null {
  if (!u) return null
  if (Array.isArray(u)) return u[0] ?? null
  return u
}

function periodBounds(period: PeriodKey): { from?: string; to?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'yesterday') {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const yEnd = new Date(start)
    yEnd.setHours(23, 59, 59, 999)
    return { from: start.toISOString(), to: yEnd.toISOString() }
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  const start = new Date(now)
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  return { from: start.toISOString(), to: end.toISOString() }
}

function typeLabel(tx: string | null | undefined) {
  const k = String(tx || '').trim()
  return TYPE_LABEL[k] || k || '—'
}

function sourceText(row: ToastRow) {
  const parts = [row.source_type, row.reference_id || row.source_id].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

const btnBase: CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.75)',
  fontFamily: 'inherit',
  fontWeight: 400,
}

const btnOn: CSSProperties = {
  ...btnBase,
  border: '1px solid rgba(201,168,76,0.45)',
  background: 'rgba(201,168,76,0.12)',
  color: GOLD,
}

export default function AdminToastHistoryPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ToastRow[]>([])
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilterKey>('all')
  const [nameSearch, setNameSearch] = useState('')
  const [nameSearchApplied, setNameSearchApplied] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [amountSum, setAmountSum] = useState(0)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [adjustTargetId, setAdjustTargetId] = useState<string | null>(null)
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustSubmitting, setAdjustSubmitting] = useState(false)

  const resolveNameSearchIds = useCallback(
    async (term: string): Promise<string[] | null> => {
      const t = term.trim()
      if (!t) return null
      const { data, error: uErr } = await supabase
        .from('users')
        .select('id, auth_id, name')
        .ilike('name', `%${t}%`)
        .limit(200)
      if (uErr) throw uErr
      const ids = new Set<string>()
      ;((data as { id: string; auth_id?: string | null }[]) || []).forEach((u) => {
        if (u.id) ids.add(String(u.id))
        if (u.auth_id) ids.add(String(u.auth_id))
      })
      return Array.from(ids)
    },
    [supabase]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: auth } = await supabase.auth.getUser()
      const authUser = auth?.user
      if (authUser) {
        const { data: u } = await supabase.from('users').select('id,role').eq('auth_id', authUser.id).single()
        setAdminId(u?.id || null)
      } else {
        setAdminId(null)
      }

      let userIds: string[] | null = null
      if (nameSearchApplied.trim()) {
        userIds = await resolveNameSearchIds(nameSearchApplied)
        if (!userIds?.length) {
          setRows([])
          setTotalCount(0)
          setAmountSum(0)
          setNameByUserId({})
          return
        }
      }

      const { from: dateFrom, to: dateTo } = periodBounds(period)
      const typeOpt = TYPE_FILTER_OPTIONS.find((o) => o.key === typeFilter)

      let listQ = supabase
        .from('toast_transactions')
        .select('id, user_id, amount, transaction_type, source_type, source_id, reference_id, created_at, note, admin_id, status, balance_after, users!toast_transactions_user_id_fkey(name, origin_track)', {
          count: 'exact',
        })
      if (dateFrom) listQ = listQ.gte('created_at', dateFrom)
      if (dateTo) listQ = listQ.lte('created_at', dateTo)
      if ((typeOpt as any)?.sourceType) listQ = listQ.eq('source_type', (typeOpt as any).sourceType)
      if (userIds) listQ = listQ.in('user_id', userIds)

      const rangeFrom = page * PAGE_SIZE
      const rangeTo = rangeFrom + PAGE_SIZE - 1
      const { data, error: listErr, count } = await listQ.order('created_at', { ascending: false }).range(rangeFrom, rangeTo)
      if (listErr) throw listErr

      const list = (data || []) as ToastRow[]
      setRows(list)
      setTotalCount(count ?? 0)

      let sumQ = supabase.from('toast_transactions').select('amount, user_id')
      if (dateFrom) sumQ = sumQ.gte('created_at', dateFrom)
      if (dateTo) sumQ = sumQ.lte('created_at', dateTo)
      if ((typeOpt as any)?.sourceType) sumQ = sumQ.eq('source_type', (typeOpt as any).sourceType)
      if (userIds) sumQ = sumQ.in('user_id', userIds)
      const { data: sumRows, error: sumErr } = await sumQ.limit(10000)
      if (sumErr) throw sumErr
      const sum = ((sumRows as { amount?: number | null }[]) || []).reduce(
        (acc, r) => acc + (Number(r.amount) || 0),
        0
      )
      setAmountSum(sum)

      const missing = new Set<string>()
      list.forEach((r) => {
        if (!pickUser(r.users)?.name && r.user_id) missing.add(String(r.user_id))
      })
      const extra: Record<string, string> = {}
      if (missing.size) {
        const ids = Array.from(missing)
        const { data: byId } = await supabase.from('users').select('id, auth_id, name, origin_track').in('id', ids)
        ;((byId as { id: string; name?: string | null }[]) || []).forEach((u) => {
          if (u.id && u.name) extra[String(u.id)] = String(u.name)
        })
        const left = ids.filter((id) => !extra[id])
        if (left.length) {
          const { data: byAuth } = await supabase.from('users').select('id, auth_id, name, origin_track').in('auth_id', left)
          ;((byAuth as { auth_id: string; name?: string | null }[]) || []).forEach((u) => {
            if (u.auth_id && u.name) extra[String(u.auth_id)] = String(u.name)
          })
        }
      }
      setNameByUserId(extra)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      setRows([])
      setTotalCount(0)
      setAmountSum(0)
    } finally {
      setLoading(false)
    }
  }, [supabase, period, typeFilter, page, nameSearchApplied, resolveNameSearchIds])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const onSearchName = () => {
    setPage(0)
    setNameSearchApplied(nameSearch)
  }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--text)' }}>🍞 토스트 거래 내역</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
          toast_transactions · 최신순 · {PAGE_SIZE}건/페이지
        </div>
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(201,168,76,0.08)',
            border: '1px solid rgba(201,168,76,0.25)',
            fontSize: 13,
            color: GOLD,
          }}
        >
          필터 합계: {amountSum >= 0 ? '+' : ''}
          {amountSum.toLocaleString()}T
          <span style={{ marginLeft: 10, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            (총 {totalCount.toLocaleString()}건)
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>기간</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              style={period === o.key ? btnOn : btnBase}
              onClick={() => {
                setPage(0)
                setPeriod(o.key)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>종류</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {TYPE_FILTER_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              style={typeFilter === o.key ? btnOn : btnBase}
              onClick={() => {
                setPage(0)
                setTypeFilter(o.key)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>회원명</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchName()
            }}
            placeholder="회원명 검색"
            style={{
              flex: 1,
              minWidth: 180,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.25)',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button type="button" className="btn btn-bl" style={{ fontWeight: 400 }} onClick={onSearchName}>
            검색
          </button>
          <button
            type="button"
            className="btn btn-gy"
            style={{ fontWeight: 400 }}
            onClick={() => {
              setNameSearch('')
              setNameSearchApplied('')
              setPage(0)
            }}
          >
            초기화
          </button>
          <button type="button" className="btn btn-gy" style={{ fontWeight: 400 }} onClick={() => void load()} disabled={loading}>
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-warn" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'var(--text3)' }}>
          불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'rgba(255,255,255,0.55)' }}>
          거래 내역이 없습니다.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 56 }}>번호</th>
                <th>회원명</th>
                <th style={{ width: 56 }}>트랙</th>
                <th style={{ width: 100 }}>종류</th>
                <th style={{ width: 120 }}>금액(T)</th>
                <th>출처</th>
                <th style={{ width: 168 }}>일시</th>
                <th style={{ width: 88 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const amt = Number(r.amount) || 0
                const uid = String(r.user_id || '')
                const memberName =
                  pickUser(r.users)?.name || (uid && nameByUserId[uid]) || (uid ? '이름없음' : '—')
                const canReverse =
                  r.transaction_type === 'earn' && r.status === 'active' && amt > 0
                const isReversed = r.status === 'reversed'
                const isAdjust = r.transaction_type === 'adjust'
                return [
                  <tr key={r.id}>
                    <td className="mono" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    <td style={{ color: 'var(--text)' }} title={r.user_id || undefined}>{memberName}</td>
                    <td>{pickUser(r.users)?.origin_track || '—'}</td>
                    <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{TYPE_LABEL[r.source_type || ''] || TYPE_LABEL[r.transaction_type || ''] || r.source_type || r.transaction_type || '—'}</td>
                    <td className="mono" style={{ color: isAdjust || amt < 0 ? RED : GOLD }}>
                      {amt >= 0 ? '+' : ''}
                      {amt.toLocaleString()}T
                      {isAdjust && r.note ? (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontWeight: 400 }}>
                          {r.note}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{sourceText(r)}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td>
                      {canReverse ? (
                        <button
                          type="button"
                          style={btnBase}
                          onClick={() => {
                            setAdjustTargetId(r.id)
                            setAdjustNote('')
                          }}
                        >
                          회수
                        </button>
                      ) : isReversed ? (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>회수됨</span>
                      ) : null}
                    </td>
                  </tr>,
                  adjustTargetId === r.id ? (
                    <tr key={`${r.id}-adjust`}>
                      <td colSpan={8} style={{ padding: 12, background: 'rgba(123,94,167,0.08)' }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                          회수 사유
                        </div>
                        <textarea
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                          placeholder="회수 사유를 입력하세요"
                          rows={3}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(0,0,0,0.25)',
                            color: '#fff',
                            fontSize: 12,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            style={{
                              ...btnBase,
                              border: '1px solid rgba(123,94,167,0.45)',
                              background: 'rgba(123,94,167,0.25)',
                              color: '#c4a7e7',
                              opacity: !adjustNote.trim() || adjustSubmitting || !adminId ? 0.5 : 1,
                            }}
                            disabled={!adjustNote.trim() || adjustSubmitting || !adminId}
                            onClick={() => {
                              void (async () => {
                                if (!adjustTargetId || !adjustNote.trim() || adjustSubmitting) return
                                setAdjustSubmitting(true)
                                setError('')
                                try {
                                  const res = await fetch('/api/admin/toast/adjust', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      transaction_id: adjustTargetId,
                                      note: adjustNote.trim(),
                                    }),
                                  })
                                  const json = await res.json().catch(() => ({}))
                                  if (!res.ok || !json?.ok) {
                                    throw new Error(json?.error || '회수 처리에 실패했습니다.')
                                  }
                                  setAdjustTargetId(null)
                                  setAdjustNote('')
                                  await load()
                                } catch (e: unknown) {
                                  setError(e instanceof Error ? e.message : '회수 처리에 실패했습니다.')
                                } finally {
                                  setAdjustSubmitting(false)
                                }
                              })()
                            }}
                          >
                            {adjustSubmitting ? '처리 중…' : '확인'}
                          </button>
                          <button
                            type="button"
                            style={btnBase}
                            disabled={adjustSubmitting}
                            onClick={() => {
                              setAdjustTargetId(null)
                              setAdjustNote('')
                            }}
                          >
                            취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ]
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalCount > PAGE_SIZE ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            style={btnBase}
            disabled={page <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            이전
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            style={btnBase}
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  )
}
