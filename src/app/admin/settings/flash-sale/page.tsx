'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function FlashSaleSettingsPage() {
  const supabase = createClient()
  const { getSettingNum } = useAdminSettings()
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [active, setActive] = useState<any[]>([])
  const [savingId, setSavingId] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState<Record<string, { price: string; start: string; end: string }>>({})

  const maxDiscountRate = getSettingNum('flash_sale', 'max_discount_rate', 70)
  const defaultDurationHours = getSettingNum('flash_sale', 'default_duration_hours', 24)

  useEffect(() => {
    const t = setTimeout(async () => {
      const query = q.trim()
      let req = supabase
        .from('products')
        .select('id,name,retail_price,flash_sale_price,flash_sale_start,flash_sale_end,is_flash_sale,brands(name)')
        .order('created_at', { ascending: false })
        .limit(30)
      if (query) req = req.ilike('name', `%${query}%`)
      const { data } = await req
      setProducts(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, supabase])

  const refreshActive = async () => {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('products')
      .select('id,name,flash_sale_price,flash_sale_end,is_flash_sale')
      .eq('is_flash_sale', true)
      .lt('flash_sale_start', now)
      .gt('flash_sale_end', now)
      .order('flash_sale_end', { ascending: true })
      .limit(50)
    setActive(data || [])
  }

  useEffect(() => {
    refreshActive()
    const i = setInterval(refreshActive, 10000)
    return () => clearInterval(i)
  }, [])

  const remainText = (end: string) => {
    const diff = new Date(end).getTime() - Date.now()
    if (diff <= 0) return '종료'
    const sec = Math.floor(diff / 1000)
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (d > 0) return `${d}일 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const rows = useMemo(() => {
    return products.map((p) => {
      const f = form[p.id]
      const now = new Date()
      const endDefault = new Date(now.getTime() + defaultDurationHours * 3600 * 1000)
      const startDefault = new Date(now.getTime() + 5 * 60 * 1000)
      return {
        ...p,
        _price: f?.price ?? String(toNum(p.flash_sale_price) || ''),
        _start: f?.start ?? (p.flash_sale_start ? new Date(p.flash_sale_start).toISOString().slice(0, 16) : startDefault.toISOString().slice(0, 16)),
        _end: f?.end ?? (p.flash_sale_end ? new Date(p.flash_sale_end).toISOString().slice(0, 16) : endDefault.toISOString().slice(0, 16)),
      }
    })
  }, [products, form, defaultDurationHours])

  return (
    <div style={{ padding: 4 }}>
      <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text3)' }}>상품 검색 후 타임세일을 등록/종료할 수 있습니다.</div>
      {toast ? (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>
          {toast}
        </div>
      ) : null}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 상품 검색..."
        style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', padding: '0 12px', marginBottom: 12 }}
      />

      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((p) => {
          const retail = toNum(p.retail_price)
          const sale = toNum(p._price)
          const minSale = Math.floor(retail * (1 - Math.min(95, Math.max(0, maxDiscountRate)) / 100))
          return (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg2)', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>원가: ₩{retail.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--gold)' }}>세일가 최소: ₩{Math.max(0, minSale).toLocaleString()}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={p._price} onChange={(e) => setForm((prev) => ({ ...prev, [p.id]: { price: e.target.value, start: p._start, end: p._end } }))} placeholder="세일가 입력" style={{ height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: '#fff', padding: '0 10px' }} />
                <input type="datetime-local" value={p._start} onChange={(e) => setForm((prev) => ({ ...prev, [p.id]: { price: p._price, start: e.target.value, end: p._end } }))} style={{ height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: '#fff', padding: '0 10px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                <input type="datetime-local" value={p._end} onChange={(e) => setForm((prev) => ({ ...prev, [p.id]: { price: p._price, start: p._start, end: e.target.value } }))} style={{ height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: '#fff', padding: '0 10px' }} />
                <button
                  type="button"
                  disabled={savingId === p.id}
                  onClick={async () => {
                    setSavingId(p.id)
                    const payload = {
                      is_flash_sale: true,
                      flash_sale_start: new Date(p._start).toISOString(),
                      flash_sale_end: new Date(p._end).toISOString(),
                      flash_sale_price: Math.max(0, toNum(p._price)),
                    }
                    const { error } = await supabase.from('products').update(payload).eq('id', p.id)
                    setSavingId('')
                    if (error) setToast(error.message)
                    else {
                      setToast('타임세일 등록 완료')
                      await refreshActive()
                    }
                  }}
                  style={{ height: 36, borderRadius: 8, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 800, padding: '0 12px' }}
                >
                  타임세일 등록
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase.from('products').update({ is_flash_sale: false }).eq('id', p.id)
                    if (error) setToast(error.message)
                    else {
                      setToast('타임세일 종료 처리 완료')
                      await refreshActive()
                    }
                  }}
                  style={{ height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 700, padding: '0 12px' }}
                >
                  종료
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg2)', padding: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 800, marginBottom: 10 }}>진행중 타임세일</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {active.map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg3)', padding: 10 }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--gold)' }}>₩{toNum(p.flash_sale_price).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{remainText(p.flash_sale_end)}</div>
              <button
                type="button"
                onClick={async () => {
                  const { error } = await supabase.from('products').update({ is_flash_sale: false }).eq('id', p.id)
                  if (error) setToast(error.message)
                  else {
                    setToast('종료 처리 완료')
                    await refreshActive()
                  }
                }}
                style={{ height: 30, borderRadius: 7, border: '1px solid rgba(217,79,79,0.35)', background: 'rgba(217,79,79,0.12)', color: '#d94f4f', fontWeight: 700, padding: '0 10px' }}
              >
                종료
              </button>
            </div>
          ))}
          {active.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>진행중 타임세일이 없습니다.</div> : null}
        </div>
      </div>
    </div>
  )
}
