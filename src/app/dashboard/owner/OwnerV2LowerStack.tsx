'use client'

import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

const BG = '#ffffff'
const SURFACE = '#f9f8fc'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = '#EEEDFE'
const TEXT = '#1A1A2E'
const TEXT_SUB = '#888888'
const BORDER = '#ede9f7'

type QuickMenu =
  | { icon: string; label: string; sub?: string; href: string }
  | { icon: string; label: string; sub?: string; onClick: () => void }

type TrendItem = { name: string; count: number }
type HormoneAlert = { name: string; days: number }
type ChurnAlert = { id: string; name: string }
type BrandProduct = { id: string; name: string; brand_name?: string; thumb_img?: string | null }

export default function OwnerV2LowerStack({
  card,
  sectionLabel,
  staffCount,
  roomCount,
  onCapacity,
  hormoneAlerts,
  churnAlerts,
  tradeBrands,
  brandMessages,
  brandProducts,
  ready,
  isTrackA,
  monthRevenue,
  monthGoal,
  goalPct,
  goalDone,
  trendItems,
  quickMenus,
}: {
  card: CSSProperties
  sectionLabel: CSSProperties
  staffCount: number | null
  roomCount: number | null
  onCapacity: (field: 'staff_count' | 'room_count', value: number) => void
  hormoneAlerts: HormoneAlert[]
  churnAlerts: ChurnAlert[]
  tradeBrands: string[]
  brandMessages: any[]
  brandProducts: BrandProduct[]
  ready: boolean
  isTrackA: boolean
  monthRevenue: number
  monthGoal: number
  goalPct: number
  goalDone: boolean
  trendItems: TrendItem[]
  quickMenus: QuickMenu[]
}) {
  const router = useRouter()

  return (
    <>
      <div
        style={{
          background: '#ffffff',
          border: '0.5px solid #ede9f7',
          borderRadius: 12,
          padding: 15,
          marginBottom: 12,
          marginTop: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            borderBottom: '0.5px solid #ede9f7',
            paddingBottom: 8,
            marginBottom: 12,
          }}
        >
          예약 설정
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>관리사 수</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCapacity('staff_count', n)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: staffCount === n ? '1.5px solid #7B5EA7' : '0.5px solid #ede9f7',
                  background: staffCount === n ? '#EDE9F7' : 'transparent',
                  color: staffCount === n ? '#7B5EA7' : '#888',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {n}명
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>관리룸 수</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCapacity('room_count', n)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: roomCount === n ? '1.5px solid #7B5EA7' : '0.5px solid #ede9f7',
                  background: roomCount === n ? '#EDE9F7' : 'transparent',
                  color: roomCount === n ? '#7B5EA7' : '#888',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {n}개
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '8px 10px', background: '#f9f8fc', borderRadius: 8, fontSize: 11, color: '#7B5EA7' }}>
          동시 예약 가능: 최대 {Math.min(staffCount ?? 1, roomCount ?? 1)}건
          <span style={{ color: '#888', marginLeft: 4 }}>(관리사·룸 중 적은 수 기준)</span>
        </div>
      </div>

      <div style={sectionLabel}>지금 챙겨야 할 것들</div>
      <div style={card}>
        {hormoneAlerts.length === 0 && churnAlerts.length === 0 && tradeBrands.length === 0 ? (
          brandMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              아직 알림이 없어요.
            </div>
          ) : (
            brandMessages.map((m: any) => (
              <div key={m.id} style={{ padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'rgba(123,94,167,0.2)', color: '#c4a7e7' }}>
                    {m.brands?.name || '브랜드'}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(m.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{m.body}</div>
              </div>
            ))
          )
        ) : (
          <>
            {hormoneAlerts.map((a, i) => (
              <div key={`h${i}`} style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                ✨ {a.name}님 {a.days}일 후 황금기 진입 예정
                <button type="button" style={{ float: 'right', border: `1px solid ${BORDER}`, background: BG, borderRadius: 20, padding: '4px 10px', fontSize: 11, color: PURPLE, cursor: 'pointer' }}>
                  알림톡 발송
                </button>
              </div>
            ))}
            {churnAlerts.map((c) => (
              <div key={c.id} style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                ⚠️ {c.name}님 60일 이상 미방문
                <button type="button" style={{ float: 'right', border: `1px solid ${BORDER}`, background: BG, borderRadius: 20, padding: '4px 10px', fontSize: 11, color: PURPLE, cursor: 'pointer' }}>
                  메시지 발송
                </button>
              </div>
            ))}
            {tradeBrands.length > 0 ? (
              <div style={{ paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>거래 브랜드 제품</div>
                {brandProducts.length > 0 ? (
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {brandProducts.map((prod) => (
                      <div
                        key={prod.id}
                        style={{
                          flexShrink: 0,
                          width: 100,
                          borderRadius: 10,
                          border: `1px solid ${BORDER}`,
                          overflow: 'hidden',
                          background: '#faf9fc',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: 80,
                            background: '#ede9f7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {prod.thumb_img ? (
                            <img src={prod.thumb_img} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 24 }}>🧴</span>
                          )}
                        </div>
                        <div style={{ padding: '6px 8px' }}>
                          <div style={{ fontSize: 10, color: '#7B5EA7', marginBottom: 2 }}>{prod.brand_name}</div>
                          <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.4, wordBreak: 'keep-all' }}>{prod.name}</div>
                        </div>
                      </div>
                    ))}
                    {ready && isTrackA && (
                      <div
                        style={{
                          flexShrink: 0,
                          width: 100,
                          borderRadius: 10,
                          border: `1px solid ${BORDER}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#faf9fc',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#7B5EA7',
                        }}
                        onClick={() => router.push('/dashboard/owner/brand-orders')}
                      >
                        더보기 →
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: TEXT_SUB }}>거래 브랜드: {tradeBrands.join(', ')}</div>
                )}
              </div>
            ) : ready && isTrackA ? (
              <div style={{ padding: '12px 0', fontSize: 13, color: TEXT_SUB, lineHeight: 1.6 }}>
                거래 브랜드사를 설정하면 이벤트 · 프로모션 알림을 받을 수 있어요
                <br />
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/owner/brand-orders')}
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#7B5EA7',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  브랜드사 설정하기 →
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div style={sectionLabel}>이번 달 목표</div>
      <div style={card}>
        <div style={{ height: 8, background: SURFACE, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${goalPct}%`, height: '100%', background: PURPLE, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 13, color: TEXT_SUB }}>
          {goalDone ? '목표 달성! 🎉' : `₩${monthRevenue.toLocaleString()} 목표 · 잔여 ₩${Math.max(0, monthGoal - monthRevenue).toLocaleString()} 남았어요`}
        </div>
      </div>

      <div style={sectionLabel}>이번 달 인기 시술 트렌드</div>
      <div style={card}>
        {trendItems.length > 0 ? (
          trendItems.map((t) => (
            <div key={t.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{t.name}</span>
                <span style={{ color: TEXT_SUB }}>{t.count}건</span>
              </div>
              <div style={{ height: 6, background: SURFACE, borderRadius: 3 }}>
                <div style={{ width: `${Math.min(100, (t.count / (trendItems[0]?.count || 1)) * 100)}%`, height: '100%', background: PURPLE, borderRadius: 3 }} />
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.7 }}>
            대구 수성구 이번 달 인기 시술
            <br />
            1위 MTS · 2위 수분케어 · 3위 스피큘
            <br />
            <span style={{ fontSize: 11 }}>(오렌 전체 데이터 기준)</span>
          </div>
        )}
      </div>

      <div style={sectionLabel}>빠른 메뉴</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {quickMenus.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => ('onClick' in m && m.onClick ? m.onClick() : router.push((m as { href: string }).href))}
            style={{ ...card, textAlign: 'left', cursor: 'pointer', border: `1px solid ${BORDER}`, background: BG }}
          >
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: PURPLE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 8 }}>
              {m.icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 4 }}>{m.sub}</div>
          </button>
        ))}
      </div>
    </>
  )
}
