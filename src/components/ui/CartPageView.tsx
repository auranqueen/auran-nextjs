'use client'

import Link from 'next/link'
import ProductThumbImage from '@/components/ProductThumbImage'
import type { CartLine } from '@/context/CartContext'

export type GiftUserHit = { id: string; name: string; email: string }

type Props = {
  toast: string
  items: CartLine[]
  selectedIds: Record<string, boolean | undefined>
  allSelected: boolean
  selectedCount: number
  selectedSubtotal: number
  giftOpen: boolean
  giftQ: string
  giftHits: GiftUserHit[]
  giftPick: string
  giftLoading: boolean
  onGiftQChange: (q: string) => void
  onCloseGift: () => void
  onGiftPick: (id: string) => void
  onConfirmGift: () => void
  onSetAllSelected: (v: boolean) => void
  onSetSelected: (id: string, v: boolean) => void
  onQuantity: (id: string, next: number) => void
  onRemove: (id: string) => void
  onBuy: () => void
  onOpenGift: () => void
}

export default function CartPageView({
  toast,
  items,
  selectedIds,
  allSelected,
  selectedCount,
  selectedSubtotal,
  giftOpen,
  giftQ,
  giftHits,
  giftPick,
  giftLoading,
  onGiftQChange,
  onCloseGift,
  onGiftPick,
  onConfirmGift,
  onSetAllSelected,
  onSetSelected,
  onQuantity,
  onRemove,
  onBuy,
  onOpenGift,
}: Props) {
  return (
    <>
      <div style={{ padding: '16px 18px 0' }}>
        {toast ? (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>{toast}</div>
        ) : null}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 12px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>장바구니가 비어 있어요</div>
            <Link
              href="/products"
              style={{
                display: 'inline-block',
                padding: '12px 20px',
                borderRadius: 12,
                background: 'rgba(201,168,76,0.15)',
                border: '1px solid rgba(201,168,76,0.4)',
                color: 'var(--gold)',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              제품 보러가기
            </Link>
          </div>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, color: '#fff', fontWeight: 800 }}>
              <input type="checkbox" checked={allSelected} onChange={e => onSetAllSelected(e.target.checked)} />
              전체 선택
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(r => {
                const checked = selectedIds[r.id] !== false
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={e => onSetSelected(r.id, e.target.checked)} style={{ marginTop: 4 }} />
                    <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.25)', flexShrink: 0 }}>
                      <ProductThumbImage src={r.thumb_img} alt={r.name} fill sizes="64px" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.brand_name}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{r.name}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>
                        ₩{(r.price * r.quantity).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => onQuantity(r.id, r.quantity - 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#fff',
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: 13, color: '#fff', fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{r.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onQuantity(r.id, r.quantity + 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#fff',
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(r.id)}
                          style={{ marginLeft: 'auto', fontSize: 11, color: '#e57373', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {items.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 72,
            width: '100%',
            maxWidth: 480,
            zIndex: 45,
            padding: '10px 14px 14px',
            background: 'rgba(10,12,15,0.96)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 800, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>
              선택 {selectedCount}개{selectedCount ? ` · ₩${selectedSubtotal.toLocaleString()}` : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => void onOpenGift()}
              style={{
                height: 46,
                borderRadius: 12,
                border: '1px solid rgba(140,180,255,0.45)',
                background: 'rgba(140,180,255,0.12)',
                color: '#bcd6ff',
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              선물하기 🎁
            </button>
            <button
              type="button"
              onClick={() => void onBuy()}
              disabled={!selectedCount}
              style={{
                height: 46,
                borderRadius: 12,
                border: 'none',
                background: !selectedCount ? '#55606f' : '#c9a84c',
                color: !selectedCount ? '#c8d0db' : '#111',
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              구매하기
            </button>
          </div>
        </div>
      ) : null}

      {giftOpen ? (
        <div onClick={onCloseGift} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 120 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 0,
              width: '100%',
              maxWidth: 480,
              background: '#11161b',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderTop: '1px solid var(--border)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 10 }}>🎁 선물할 회원 검색</div>
            <input
              value={giftQ}
              onChange={e => onGiftQChange(e.target.value)}
              placeholder="이름 / 이메일 (2글자 이상)"
              style={{
                width: '100%',
                marginBottom: 10,
                padding: '12px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 14,
              }}
            />
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 8, marginBottom: 12 }}>
              {giftLoading ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>검색 중...</div> : null}
              {!giftLoading &&
                giftHits.map(u => (
                  <label
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: giftPick === u.id ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)',
                      background: giftPick === u.id ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="radio" name="giftu" checked={giftPick === u.id} onChange={() => onGiftPick(u.id)} />
                    <div style={{ fontSize: 13, color: '#fff' }}>
                      {u.name} · {u.email}
                    </div>
                  </label>
                ))}
              {!giftLoading && giftQ.trim().length >= 2 && giftHits.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>검색 결과가 없어요</div>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" onClick={onCloseGift} style={{ height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 800 }}>
                취소
              </button>
              <button
                type="button"
                disabled={!giftPick}
                onClick={onConfirmGift}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: 'none',
                  background: !giftPick ? '#55606f' : '#c9a84c',
                  color: !giftPick ? '#c8d0db' : '#111',
                  fontWeight: 900,
                }}
              >
                선물하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
