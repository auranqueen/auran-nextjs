'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.5)'

type WalletRow = {
  balance: number | null
  total_earned: number | null
  total_used: number | null
}

type TransactionRow = {
  id: string
  amount: number
  type: string | null
  description: string | null
  created_at: string
}

export default function MyPointPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'전체' | '적립' | '사용'>('전체')
  const [wallet, setWallet] = useState<WalletRow | null>(null)
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [expiring, setExpiring] = useState(0)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      const { data: walletData } = await supabase
        .from('user_wallets')
        .select('balance, total_earned, total_used')
        .eq('user_id', user.id)
        .single()
      setWallet((walletData as WalletRow) || null)

      const { data: txData } = await supabase
        .from('point_transactions')
        .select('id, amount, type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setRows((txData as TransactionRow[]) || [])

      const { data: expireRows } = await supabase
        .from('point_transactions')
        .select('amount, type, description, created_at')
        .eq('user_id', user.id)
        .or('type.eq.expire,description.ilike.%소멸%')
      const expiringAmount = ((expireRows as { amount: number }[] | null) || []).reduce((sum, r) => sum + Math.abs(Number(r.amount || 0)), 0)
      setExpiring(expiringAmount)
    }
    run()
  }, [supabase])

  const filteredRows = useMemo(() => {
    if (tab === '전체') return rows
    if (tab === '적립') return rows.filter((r) => Number(r.amount) > 0)
    return rows.filter((r) => Number(r.amount) < 0)
  }, [rows, tab])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 24 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>AURAN POINT</div>
      </header>

      <div style={{ padding: 16 }}>
        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8 }}>포인트 잔액</div>
          <div style={{ fontSize: 34, color: GOLD, fontWeight: 600, marginBottom: 10 }}>{Number(wallet?.balance || 0).toLocaleString()}T</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: TEXT_MUTED }}>
            <span>총 적립 {Number(wallet?.total_earned || 0).toLocaleString()}T</span>
            <span>총 사용 {Number(wallet?.total_used || 0).toLocaleString()}T</span>
          </div>
        </section>

        <button
          onClick={() => router.push('/wallet')}
          style={{ width: '100%', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#C9A96E,#E1C38F)', color: '#0D0B09', fontWeight: 700, padding: '12px 0', marginBottom: 10, cursor: 'pointer' }}
        >
          충전하기
        </button>

        <section style={{ background: 'rgba(123,94,167,0.14)', border: '1px solid rgba(123,94,167,0.35)', borderRadius: 12, padding: '10px 12px', fontSize: 12, color: '#c7b0ea', marginBottom: 10 }}>
          {expiring.toLocaleString()}T가 12월 31일 소멸 예정이에요
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['전체', '적립', '사용'] as const).map((t) => (
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

          {filteredRows.map((row) => (
            <div key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>{row.description || row.type || '포인트 내역'}</span>
                <span style={{ fontSize: 12, color: row.amount > 0 ? '#7fd08f' : '#ef9a9a' }}>
                  {row.amount > 0 ? `+${Math.abs(row.amount).toLocaleString()}` : `-${Math.abs(row.amount).toLocaleString()}`} T
                </span>
              </div>
              <div style={{ fontSize: 10, color: TEXT_MUTED }}>{new Date(row.created_at).toLocaleString('ko-KR')}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
