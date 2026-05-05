'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type UserJoin = {
  name?: string | null
  email?: string | null
  phone?: string | null
}

type IntentRow = {
  id: string
  created_at: string
  amount: number
  status: string
  user_id: string | null
  users?: UserJoin | UserJoin[] | null
}

function pickUser(u: IntentRow['users']): UserJoin | null {
  if (!u) return null
  if (Array.isArray(u)) return u[0] ?? null
  return u
}

export default function AdminWalletRequestsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<IntentRow[]>([])
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: qErr } = await supabase
        .from('payment_intents')
        .select('id, created_at, amount, status, user_id, users(name, email, phone)')
        .eq('kind', 'charge')
        .in('status', ['pending', 'created'])
        .order('created_at', { ascending: false })
        .limit(200)

      if (qErr) throw qErr
      setRows((data || []) as IntentRow[])
    } catch (e: any) {
      setError(e?.message || '목록을 불러오지 못했습니다.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (row: IntentRow) => {
    const id = row.id
    setSavingId(id)
    setError('')
    try {
      const { data: cur, error: fetchErr } = await supabase
        .from('payment_intents')
        .select('id, status, amount, user_id')
        .eq('id', id)
        .single()
      if (fetchErr || !cur) throw new Error(fetchErr?.message || '요청을 찾을 수 없습니다.')
      if (cur.status !== 'pending' && cur.status !== 'created') {
        alert('이미 처리된 요청입니다.')
        await load()
        return
      }
      const amount = Math.floor(Number((cur as { amount?: unknown }).amount || 0))
      const uid = String((cur as { user_id?: string | null }).user_id || '')
      if (!uid) throw new Error('user_id가 없습니다.')

      const { error: e1 } = await supabase
        .from('payment_intents')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .in('status', ['pending', 'created'])
      if (e1) throw e1

      const { data: u, error: uErr } = await supabase
        .from('users')
        .select('charge_balance, points')
        .eq('id', uid)
        .single()
      if (uErr || !u) throw new Error(uErr?.message || '회원 정보를 불러오지 못했습니다.')

      const nextBal = Number((u as { charge_balance?: unknown }).charge_balance || 0) + amount
      const ptsAdd = Math.floor(amount * 0.05)
      const nextPts = Number((u as { points?: unknown }).points || 0) + ptsAdd

      const { error: e2 } = await supabase
        .from('users')
        .update({ charge_balance: nextBal, points: nextPts })
        .eq('id', uid)
      if (e2) throw e2

      const { error: e3 } = await supabase.from('toast_transactions').insert({
        user_id: uid,
        amount: ptsAdd,
        transaction_type: 'charge',
        source_type: 'admin',
        reference_id: id,
      } as any)
      if (e3) throw e3

      await load()
    } catch (e: any) {
      setError(e?.message || '승인 처리에 실패했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  const reject = async (row: IntentRow) => {
    const id = row.id
    setSavingId(id)
    setError('')
    try {
      const { error: e1 } = await supabase
        .from('payment_intents')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .in('status', ['pending', 'created'])
      if (e1) throw e1
      await load()
    } catch (e: any) {
      setError(e?.message || '거절 처리에 실패했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>🏦 지갑 충전 (무통장) 요청</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              payment_intents · kind=charge · pending / created
            </div>
          </div>
          <button type="button" className="btn btn-bl" onClick={() => void load()} disabled={loading}>
            {loading ? '불러오는 중…' : '새로고침'}
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
          대기 중인 충전 요청이 없습니다.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 160 }}>신청일시</th>
                <th>고객명</th>
                <th>이메일</th>
                <th style={{ width: 140 }}>금액(원)</th>
                <th style={{ width: 100 }}>상태</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const u = pickUser(r.users)
                const name = u?.name || '—'
                const email = u?.email || '—'
                const amt = Math.floor(Number(r.amount || 0))
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td style={{ fontWeight: 700 }}>{name}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{email}</td>
                    <td className="mono" style={{ color: 'var(--gold)' }}>
                      ₩{amt.toLocaleString()}
                    </td>
                    <td>
                      <span className="b b-gd">{r.status}</span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-gr"
                        style={{ marginRight: 8 }}
                        onClick={() => void approve(r)}
                        disabled={savingId === r.id}
                      >
                        {savingId === r.id ? '처리 중…' : '승인'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-gy"
                        onClick={() => void reject(r)}
                        disabled={savingId === r.id}
                      >
                        거절
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
