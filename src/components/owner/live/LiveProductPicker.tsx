'use client'
import { useCallback, useEffect, useState } from 'react'
import { BORDER, GOLD, SUB } from './liveUtils'

export type LivePickerProduct = { id: string; name: string; thumb_img: string | null; consumer_price: number | null }
type Item = LivePickerProduct
type PanelState = 'closed' | 'entering' | 'open' | 'leaving'

const INK = '#1a1a1a'
const PANEL_MS = 280
const SEARCH_DEBOUNCE_MS = 280
const EASE = 'cubic-bezier(0.4,0,0.2,1)'
const ERRORS: Record<string, string> = {
  already_exists: '이미 연결된 제품이에요',
  broadcast_not_editable: '예정·방송 중인 방송만 제품을 바꿀 수 있어요',
  product_not_allowed: '연결할 수 없는 제품이에요',
  not_found: '방송을 찾을 수 없어요',
  not_logged_in: '로그인이 필요해요',
  owner_only: '원장님만 연결할 수 있어요',
}

const toItem = (p: { id: unknown; name?: unknown; thumb_img?: unknown; price?: unknown; consumer_price?: unknown }): Item => {
  const raw = p.consumer_price ?? p.price
  return {
    id: String(p.id),
    name: String(p.name ?? ''),
    thumb_img: typeof p.thumb_img === 'string' && p.thumb_img ? p.thumb_img : null,
    consumer_price: raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null,
  }
}
const won = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ko-KR')}원`)

const THUMB = { width: 38, height: 38, aspectRatio: '1/1', borderRadius: 6, objectFit: 'cover', background: '#f5f5f5', flexShrink: 0 } as const
const SMALL_BTN = { fontSize: 10, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0 } as const

function Row({ item, children }: { item: Item; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
      {item.thumb_img ? <img src={item.thumb_img} alt={item.name} style={THUMB} /> : <div style={THUMB} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
        <div style={{ fontSize: 10, color: SUB }}>{won(item.consumer_price)}</div>
      </div>
      {children}
    </div>
  )
}

type Props = {
  mode?: 'remote' | 'local'
  broadcastId?: number
  value?: LivePickerProduct[]
  onChange?: (items: LivePickerProduct[]) => void
  showToast?: (text: string) => void
}

export default function LiveProductPicker({ mode = 'remote', broadcastId, value, onChange, showToast }: Props) {
  const isLocal = mode === 'local'
  const [linkedRemote, setLinkedRemote] = useState<Item[]>([])
  const [loading, setLoading] = useState(!isLocal)
  const [busy, setBusy] = useState<string[]>([])
  const [panel, setPanel] = useState<PanelState>('closed')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [searching, setSearching] = useState(false)
  const [msg, setMsg] = useState('')

  const linked = isLocal ? (value ?? []) : linkedRemote
  const toast = (text: string) => (showToast ? showToast(text) : setMsg(text))

  const load = useCallback(async () => {
    if (isLocal || broadcastId == null) return
    try {
      const res = await fetch(`/api/live/broadcast-products?broadcast_id=${broadcastId}`, { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      if (json?.ok && Array.isArray(json.products)) setLinkedRemote(json.products.map(toItem))
    } finally {
      setLoading(false)
    }
  }, [isLocal, broadcastId])

  useEffect(() => { if (!isLocal) void load() }, [isLocal, load])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 1800)
    return () => clearTimeout(t)
  }, [msg])

  useEffect(() => {
    if (panel === 'entering') {
      let r2 = 0
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setPanel('open')) })
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }
    if (panel === 'leaving') {
      const t = setTimeout(() => setPanel('closed'), PANEL_MS)
      return () => clearTimeout(t)
    }
  }, [panel])

  const searchActive = panel === 'entering' || panel === 'open'
  useEffect(() => {
    if (!searchActive) return
    let cancelled = false
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/brand-product-orders/story/product-search?q=${encodeURIComponent(q.trim())}`, { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        if (!cancelled) setResults(json?.ok && Array.isArray(json.products) ? json.products.map(toItem) : [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => { cancelled = true; clearTimeout(t) }
  }, [searchActive, q])

  const send = async (method: 'POST' | 'DELETE', productId: string) => {
    if (broadcastId == null) return false
    try {
      const res = await fetch('/api/live/broadcast-products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ broadcast_id: broadcastId, brand_product_id: productId }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok) return true
      if (method === 'POST' && json?.error === 'already_exists') {
        await load()
        return true
      }
      toast(ERRORS[json?.error] ?? (method === 'POST' ? '제품 연결에 실패했어요' : '제품 해제에 실패했어요'))
    } catch {
      toast(method === 'POST' ? '제품 연결에 실패했어요' : '제품 해제에 실패했어요')
    }
    return false
  }

  const closePanel = () => {
    setPanel('leaving')
    if (!isLocal) void load()
  }

  const setLinked = (next: Item[] | ((prev: Item[]) => Item[])) => {
    const resolved = typeof next === 'function' ? next(linked) : next
    if (isLocal) onChange?.(resolved)
    else setLinkedRemote(resolved)
  }

  const add = async (item: Item) => {
    if (busy.includes(item.id) || linked.some((x) => x.id === item.id)) return
    if (isLocal) {
      setLinked([...linked, item])
      return
    }
    setBusy((b) => [...b, item.id])
    setLinkedRemote((l) => [...l, item])
    if (!(await send('POST', item.id))) setLinkedRemote((l) => l.filter((x) => x.id !== item.id))
    setBusy((b) => b.filter((x) => x !== item.id))
  }

  const remove = async (item: Item) => {
    if (busy.includes(item.id)) return
    if (isLocal) {
      setLinked(linked.filter((x) => x.id !== item.id))
      return
    }
    const index = linked.findIndex((x) => x.id === item.id)
    if (index < 0) return
    setBusy((b) => [...b, item.id])
    setLinkedRemote((l) => l.filter((x) => x.id !== item.id))
    if (!(await send('DELETE', item.id))) {
      setLinkedRemote((l) => (l.some((x) => x.id === item.id) ? l : [...l.slice(0, index), item, ...l.slice(index)]))
    }
    setBusy((b) => b.filter((x) => x !== item.id))
  }

  const linkedIds = new Set(linked.map((x) => x.id))
  const panelStyle = panel === 'open'
    ? { transform: 'translate(0, 0)', opacity: 1 }
    : panel === 'leaving'
      ? { transform: 'translateY(-100%)', opacity: 0 }
      : { transform: 'translateX(-100%)', opacity: 1 }

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>판매할 제품 (선택)</div>
        {loading ? (
          <div style={{ fontSize: 10, color: SUB, padding: '6px 0' }}>불러오는 중…</div>
        ) : linked.length === 0 ? (
          <div style={{ fontSize: 10, color: SUB, padding: '6px 0' }}>{isLocal ? '선택된 제품이 없어요' : '연결된 제품이 없어요'}</div>
        ) : (
          linked.map((item) => (
            <Row key={item.id} item={item}>
              <button type="button" disabled={busy.includes(item.id)} onClick={() => void remove(item)}
                style={{ ...SMALL_BTN, border: `1px solid ${BORDER}`, background: '#fff', color: SUB, opacity: busy.includes(item.id) ? 0.6 : 1 }}>해제</button>
            </Row>
          ))
        )}
        <button type="button" onClick={() => { setQ(''); setPanel('entering') }}
          style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 9, border: `1.5px dashed ${GOLD}`, background: '#fbf8f2', color: GOLD, fontSize: 11, cursor: 'pointer' }}>
          제품 추가
        </button>
      </div>

      {panel !== 'closed' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3, background: '#fff', color: INK, display: 'flex', flexDirection: 'column',
          transition: `transform ${PANEL_MS}ms ${EASE}, opacity ${PANEL_MS}ms`, pointerEvents: panel === 'leaving' ? 'none' : 'auto', ...panelStyle,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <button type="button" aria-label="뒤로가기" onClick={closePanel}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: INK, padding: 0 }}>←</button>
            <div style={{ fontSize: 16, color: INK }}>제품 선택</div>
          </div>
          <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제품명 검색"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: INK }} />
            <div style={{ fontSize: 10, color: SUB, margin: '6px 0 4px' }}>
              {isLocal
                ? '검색어가 없으면 최신 제품 30개가 보여요. 누르면 선택돼요.'
                : '검색어가 없으면 최신 제품 30개가 보여요. 누르면 바로 연결돼요.'}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px' }}>
            {searching && <div style={{ fontSize: 10, color: SUB, padding: '8px 0' }}>검색 중…</div>}
            {!searching && results.length === 0 && <div style={{ fontSize: 10, color: SUB, padding: '8px 0' }}>검색 결과가 없어요</div>}
            {results.map((item) => {
              const on = linkedIds.has(item.id)
              const isBusy = busy.includes(item.id)
              return (
                <Row key={item.id} item={item}>
                  <button type="button" disabled={isBusy} onClick={() => void (on ? remove(item) : add(item))}
                    style={{ ...SMALL_BTN, border: `1px solid ${GOLD}`, background: on ? GOLD : '#fff', color: on ? '#fff' : GOLD, opacity: isBusy ? 0.6 : 1 }}>
                    {on ? (isLocal ? '선택됨' : '연결됨') : '추가'}
                  </button>
                </Row>
              )
            })}
          </div>
          <div style={{ padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <button type="button" onClick={closePanel}
              style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: GOLD, color: '#fff', fontSize: 13, cursor: 'pointer' }}>완료</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ position: 'absolute', left: '50%', bottom: 80, transform: 'translateX(-50%)', zIndex: 4, background: 'rgba(26,26,26,0.88)', color: '#fff', fontSize: 11, padding: '8px 14px', borderRadius: 18, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {msg}
        </div>
      )}
    </>
  )
}
