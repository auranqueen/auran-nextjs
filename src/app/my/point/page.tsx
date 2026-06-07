'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function toastLabel(type: string, source: string) {
  if (source === 'signup') return '🎁 가입 환영'
  if (source === 'attendance') return '🧈 출석 체크인'
  if (source === 'review') return '⭐ 리뷰 작성'
  if (source === 'purchase') return '🛒 구매 적립'
  if (source === 'gift') return '🍓 딸기잼 선물'
  if (source === 'referral') return '🍓 추천인 적립'
  if (type === 'spend') return '🛍 토스트 사용'
  return '🍞 토스트 적립'
}

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.5)'

type TransactionRow = {
  id: string
  amount: number
  transaction_type: string | null
  source_type: string | null
  created_at: string
}

export default function MyPointPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'전체' | '들어온 돈' | '나간 돈'>('전체')
  const [point, setPoint] = useState(0)
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [chargeRows, setChargeRows] = useState<any[]>([])
  const [chargeUseRows, setChargeUseRows] = useState<any[]>([])
  const [chargeBalance, setChargeBalance] = useState(0)
  const [expiringPoints, setExpiringPoints] = useState(0)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      const { data: userRow } = await supabase
        .from('users')
        .select('points, charge_balance')
        .eq('auth_id', user.id)
        .single()
      setPoint(Number(userRow?.points || 0))
      setChargeBalance(Number(userRow?.charge_balance || 0))

      const { data: txData } = await supabase
        .from('toast_transactions')
        .select('id, amount, transaction_type, source_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setRows((txData as TransactionRow[]) || [])

      const { data: payData } = await supabase
        .from('payment_intents')
        .select('amount, created_at')
        .eq('user_id', user.id)
        .eq('kind', 'charge')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(50)
      setChargeRows(payData || [])

      const { data: orderData } = await supabase
        .from('orders')
        .select('charge_used, created_at')
        .eq('customer_id', user.id)
        .gt('charge_used', 0)
        .order('created_at', { ascending: false })
        .limit(50)
      setChargeUseRows(orderData || [])

      const { data: expireRows } = await supabase
        .from('toast_transactions')
        .select('amount, type, description, created_at')
        .eq('user_id', user.id)
        .eq('source_type', 'expire')
      const expiringAmount = ((expireRows as { amount: number }[] | null) || []).reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0)
      setExpiringPoints(expiringAmount)

    }
    run()
  }, [])

  const filteredRows = useMemo(() => {
    const pointEarn = rows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({ icon: '🍞', desc: toastLabel(r.transaction_type || '', r.source_type || ''), amountText: `+${Math.abs(Number(r.amount)).toLocaleString()}T`, amountColor: '#6dba6d', created_at: r.created_at }))
    const pointSpend = rows
      .filter((r) => Number(r.amount) < 0)
      .map((r) => ({ icon: '🍞', desc: toastLabel(r.transaction_type || '', r.source_type || ''), amountText: `-${Math.abs(Number(r.amount)).toLocaleString()}T`, amountColor: 'rgba(220,80,80,0.8)', created_at: r.created_at }))
    const chargeEarn = chargeRows
      .map((r: any) => ({ icon: '💳', desc: 'AURAN PAY 충전', amountText: `+₩${Math.abs(Number(r.amount || 0)).toLocaleString()}`, amountColor: '#9b7ec8', created_at: r.created_at }))
    const chargeSpend = chargeUseRows
      .map((r: any) => ({ icon: '💳', desc: 'AURAN PAY 사용', amountText: `-₩${Math.abs(Number(r.charge_used || 0)).toLocaleString()}`, amountColor: 'rgba(220,80,80,0.8)', created_at: r.created_at }))

    if (tab === '들어온 돈') {
      return [...pointEarn, ...chargeEarn.map((r: any) => ({ ...r, amountColor: '#6dba6d' }))].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    if (tab === '나간 돈') return [...pointSpend, ...chargeSpend].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return [...chargeEarn, ...chargeSpend, ...pointEarn, ...pointSpend].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [rows, chargeRows, chargeUseRows, tab])

  const now = new Date()
  const isDecember = now.getMonth() === 11

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 24 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 400 }}>토스트(T)</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>토스트 적립·사용·충전 내역을 확인해요</div>
        </div>
        <button
          onClick={() => router.push('/wallet')}
          style={{ fontSize: 11, fontWeight: 400, border: '1px solid rgba(201,169,110,0.3)', color: '#C9A96E', padding: '6px 12px', borderRadius: 8, background: 'transparent', cursor: 'pointer' }}
        >
          💳 충전
        </button>
      </header>

      <div style={{ padding: 16 }}>
        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: chargeBalance > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 8 }}>토스트 잔액</div>
              <div style={{ fontSize: 18, color: '#c4a7e7', fontWeight: 400 }}>
                {(Number(point || 0) + Math.floor(Number(chargeBalance || 0) / 100)).toLocaleString()}T
              </div>
            </div>
            {chargeBalance > 0 ? (
              <div>
                <div style={{ fontSize: 10, color: '#9b7ec8', marginBottom: 8 }}>AURAN PAY (원)</div>
                <div style={{ fontSize: 18, color: '#9b7ec8', fontWeight: 400 }}>₩{Number(chargeBalance || 0).toLocaleString()}</div>
              </div>
            ) : null}
          </div>
        </section>

        {isDecember && expiringPoints > 0 ? (
          <section style={{ background: 'rgba(123,94,167,0.14)', border: '1px solid rgba(123,94,167,0.35)', borderRadius: 12, padding: '10px 12px', fontSize: 12, color: '#c7b0ea', marginBottom: 10 }}>
            {expiringPoints.toLocaleString()}T 토스트가 12월 31일 소멸 예정이에요
          </section>
        ) : null}

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['전체', '들어온 돈', '나간 돈'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  border: tab === t ? '1px solid #7B5EA7' : CARD_BORDER,
                  background: tab === t ? 'rgba(123,94,167,0.16)' : 'rgba(255,255,255,0.02)',
                  color: tab === t ? '#c7b0ea' : TEXT_MUTED,
                  borderRadius: 999,
                  fontSize: 11,
                  padding: '7px 12px',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {filteredRows.length === 0 ? (
            <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '32px 0' }}>
              아직 내역이 없어요 💜
            </div>
          ) : (
            filteredRows.map((row: any, idx: number) => (
              <div key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span>{row.icon}</span>
                  <span style={{ fontSize: 12 }}>{row.desc}</span>
                  <span style={{ fontSize: 12, color: row.amountColor }}>{row.amountText}</span>
                </div>
                <div style={{ fontSize: 10, color: TEXT_MUTED }}>
                  {new Date(row.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(' ', '')}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
