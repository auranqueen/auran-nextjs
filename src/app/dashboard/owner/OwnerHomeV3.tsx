'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { OwnerBadgeTierSection, type TierBadgeBrand } from './OwnerBadgeTierSection'
import { OwnerBrandSelfTierSection, type SelfTierBrand } from './OwnerBrandSelfTierSection'
import OwnerBrandProductRevenueRow from '@/components/salon-store/OwnerBrandProductRevenueRow'

const GRADE_COLORS: Record<string, string> = {
  debut: 'var(--text3)',
  essor: '#4a8dc0',
  prestige: '#aab8c8',
  couronne: '#c9a84c',
  empire: '#7B5EA7',
}
const GRADE_LABELS: Record<string, string> = {
  debut: 'DÉBUT',
  essor: 'ESSOR',
  prestige: 'PRESTIGE',
  couronne: 'COURONNE',
  empire: 'EMPIRE',
}

export type RevenueSlice = {
  current: number
  previous: number
  changePercent: number
}

export type RecentChat = {
  id: string
  title: string | null
  preview_text: string | null
  last_message_at: string | null
  unread_count: number
}

export type RecruitedOwner = {
  id: string
  name: string
  monthSales: number
}

export type BrandPostPreview = {
  id: string
  title: string | null
  body: string
  created_at: string
  brand_name?: string | null
} | null

type Props = {
  profile: any
  salon: any
  todayBookings: any[]
  serviceRevenue: RevenueSlice
  productRevenue: RevenueSlice
  brandProductRevenue: RevenueSlice
  pendingCsCount: number
  unreadChatCount: number
  recentChats: RecentChat[]
  recruitedOwners: RecruitedOwner[]
  brandPost: BrandPostPreview
  monthlyTrend: { month: string; total: number }[]
  topServices: { name: string; count: number }[]
  topProducts: { name: string; quantity: number }[]
  salonId: string | null
  storeThumbnailUrl: string | null
  tierBadgeBrands: TierBadgeBrand[]
  selfTierBrands: SelfTierBrand[]
}

export default function OwnerHomeV3({
  profile,
  salon,
  todayBookings,
  serviceRevenue,
  productRevenue,
  brandProductRevenue,
  pendingCsCount,
  unreadChatCount,
  recentChats,
  recruitedOwners,
  brandPost,
  monthlyTrend,
  topServices,
  topProducts,
  salonId,
  storeThumbnailUrl,
  tierBadgeBrands,
  selfTierBrands,
}: Props) {
  const router = useRouter()
  const [chatOpen, setChatOpen] = useState(false)
  const [kpiMonth, setKpiMonth] = useState(0)
  const [kpiBookings, setKpiBookings] = useState(0)
  const [kpiUnanswered, setKpiUnanswered] = useState(0)
  const supabase = createClient()
  const ownerProfileId = profile?.id ? String(profile.id) : null
  const [areteCompanyId, setAreteCompanyId] = useState<string | null>(null)
  const [pointBalance, setPointBalance] = useState(0)
  const [rewardBalance, setRewardBalance] = useState(0)
  const [pointsReady, setPointsReady] = useState(false)

  const loadPoints = useCallback(async () => {
    if (!ownerProfileId) {
      setAreteCompanyId(null)
      setPointBalance(0)
      setRewardBalance(0)
      setPointsReady(true)
      return
    }
    const { data: memberRow } = await supabase
      .from('brand_arete_members')
      .select('company_id')
      .eq('owner_id', ownerProfileId)
      .eq('status', 'active')
      .maybeSingle()
    const cid = (memberRow as { company_id?: string } | null)?.company_id || null
    setAreteCompanyId(cid)
    if (!cid) {
      setPointBalance(0)
      setRewardBalance(0)
      setPointsReady(true)
      return
    }
    const [{ data: pointRow }, { data: rewardRow }] = await Promise.all([
      supabase
        .from('brand_points')
        .select('balance')
        .eq('company_id', cid)
        .eq('owner_id', ownerProfileId)
        .eq('track', 'ARETE')
        .maybeSingle(),
      supabase
        .from('brand_points')
        .select('balance')
        .eq('company_id', cid)
        .eq('owner_id', ownerProfileId)
        .eq('track', 'REWARD')
        .maybeSingle(),
    ])
    setPointBalance(Math.trunc(Number((pointRow as { balance?: number } | null)?.balance) || 0))
    setRewardBalance(Math.trunc(Number((rewardRow as { balance?: number } | null)?.balance) || 0))
    setPointsReady(true)
  }, [ownerProfileId, supabase])

  useEffect(() => {
    void loadPoints()
  }, [loadPoints])

  const grade = String(profile?.store_grade || 'debut')
  const gradeColor = GRADE_COLORS[grade] || GRADE_COLORS.debut
  const salonName = salon?.name || profile?.salon_name || profile?.name || '살롱'
  const monthTotal = serviceRevenue.current + productRevenue.current
  const unanswered = pendingCsCount + unreadChatCount
  const serviceShare = monthTotal > 0 ? Math.round((serviceRevenue.current / monthTotal) * 100) : 0
  const productShare = monthTotal > 0 ? Math.round((productRevenue.current / monthTotal) * 100) : 0

  useEffect(() => {
    const targets = [monthTotal, todayBookings.length, unanswered]
    const duration = 800
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const ease = 1 - Math.pow(1 - p, 3)
      setKpiMonth(Math.round(targets[0] * ease))
      setKpiBookings(Math.round(targets[1] * ease))
      setKpiUnanswered(Math.round(targets[2] * ease))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [monthTotal, todayBookings.length, unanswered])

  const fmtWon = (n: number) => `₩${Math.max(0, Math.floor(n)).toLocaleString()}`
  const fmtPct = (p: number) => (p === 0 ? '0%' : `${p > 0 ? '+' : ''}${p}%`)

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 1100, margin: '0 auto', paddingBottom: 24, width: '100%' }}>
      <style>{`
        @media (min-width: 768px) {
          .owner-v3-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
          .owner-v3-card:hover { transform: translateY(-2px); }
        }
      `}</style>
      <div style={{ background: 'linear-gradient(160deg,#FBF7EE,#F5F1FA)', borderBottom: '1px solid #E1D8F0', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: '#8A7E72', letterSpacing: '0.2em', marginBottom: 4 }}>CLINIC COMMAND CENTER</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, color: '#3A3540' }}>{salonName}</div>
              <span
                style={{
                  fontSize: 9,
                  padding: '2px 8px',
                  background: `${gradeColor}22`,
                  color: gradeColor,
                  border: `1px solid ${gradeColor}44`,
                  borderRadius: 18,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  boxShadow: `0 0 10px ${gradeColor}55`,
                }}
              >
                {GRADE_LABELS[grade] || grade.toUpperCase()}
              </span>
            </div>
          </div>
          {salonId ? (
            <a
              href={`/salons/${salonId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="owner-v3-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
                padding: '8px 12px',
                background: '#F5F1FA',
                border: '1px solid #E1D8F0',
                borderRadius: 12,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: storeThumbnailUrl ? `url(${storeThumbnailUrl}) center/cover` : '#E1D8F0',
                  border: '1px solid #E1D8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  overflow: 'hidden',
                }}
              >
                {!storeThumbnailUrl ? '🏪' : null}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#3A3540', whiteSpace: 'nowrap' }}>내 스토어 보기</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>↗</span>
            </a>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { l: '이번 달 매출', v: fmtWon(kpiMonth), c: '#8A6A2E', bg: '#FBF7EE', bd: '#EFE3C8' },
            { l: '오늘 예약', v: `${kpiBookings}건`, c: '#8A6A2E', bg: '#FBF7EE', bd: '#EFE3C8' },
            { l: '미답변', v: `${kpiUnanswered}건`, c: '#5A4380', bg: '#F5F1FA', bd: '#E1D8F0' },
          ].map((s) => (
            <div key={s.l} className="owner-v3-card" style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>
          이번 달 매출 = 관리권 + 제품 (수수료 차감 전 총액)
        </div>

        {pointsReady && areteCompanyId ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, background: 'linear-gradient(160deg, #fff 0%, #faf3e6 100%)', border: '1px solid #ecdfc4', borderRadius: 16, padding: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: '#c9a96e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, color: '#fff', fontSize: 12, fontWeight: 600 }}>P</div>
              <div style={{ fontSize: 11, color: '#a8863f', marginBottom: 4 }}>적립포인트</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: '#1A1A2E' }}>{rewardBalance.toLocaleString()}P</div>
              <div style={{ borderTop: '1px solid #ecdfc4', marginTop: 10, paddingTop: 8, fontSize: 10, color: '#888888' }}>발주 시 등급 비율로 적립</div>
            </div>
            <div style={{ flex: 1, background: 'linear-gradient(160deg, #fff 0%, #f1ecf7 100%)', border: '1px solid #e2d5f0', borderRadius: 16, padding: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: '#7b5ea7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, color: '#fff', fontSize: 12, fontWeight: 600 }}>P</div>
              <div style={{ fontSize: 11, color: '#7b5ea7', marginBottom: 4 }}>아레테포인트</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: '#1A1A2E' }}>{pointBalance.toLocaleString()}P</div>
              <div style={{ borderTop: '1px solid #e2d5f0', marginTop: 10, paddingTop: 8, fontSize: 10, color: '#888888' }}>포인트 누적잔액 · 이벤트 상품 결제시 사용 가능</div>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          {[
            { href: '/dashboard/owner/bookings', icon: '📅', label: '예약 관리' },
            { href: '/dashboard/owner/brand-orders', icon: '📦', label: '발주하기' },
            { href: '/dashboard/owner/charts-v2', icon: '📋', label: '시술차트' },
            { href: '/dashboard/owner/brand-store-decoration', icon: '✨', label: '스토어 꾸미기' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 14px',
                background: '#fff',
                border: '1px solid #E8E4F0',
                borderRadius: 12,
                textDecoration: 'none',
                color: '#3A3540',
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: '18px 18px 0',
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className="owner-v3-card"
            style={{
              width: '100%',
              padding: '16px 18px',
              marginBottom: chatOpen ? 0 : 10,
              background: '#F5F1FA',
              border: '1px solid #E1D8F0',
              borderRadius: chatOpen ? '14px 14px 0 0' : 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#7B5EA7',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <span style={{ fontSize: 15, fontWeight: 500 }}>상담톡</span>
              {unreadChatCount > 0 && (
                <span style={{ fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '2px 7px' }}>{unreadChatCount}</span>
              )}
            </span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{chatOpen ? '접기 ▲' : '펼치기 ▼'}</span>
          </button>
          {chatOpen && (
            <div
              style={{
                background: '#F8F5FC',
                border: '1px solid #E1D8F0',
                borderTop: 'none',
                borderRadius: '0 0 14px 14px',
                padding: '10px 14px 14px',
                marginBottom: 10,
              }}
            >
              {recentChats.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>최근 상담이 없습니다</div>
              ) : (
                recentChats.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/owner/chat/${ch.id}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginBottom: 6,
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ch.title || '상담'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch.preview_text || '메시지 없음'}
                    </div>
                  </button>
                ))
              )}
              <Link href="/dashboard/owner/chat/redirect" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#7B5EA7', marginTop: 8, textDecoration: 'none' }}>
                전체 상담 보기 →
              </Link>
            </div>
          )}

          <div style={{ marginBottom: 16, marginTop: chatOpen ? 6 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📅 오늘 예약 일정</div>
            {todayBookings.length === 0 ? (
              <div className="owner-v3-card" style={{ textAlign: 'center', padding: 20, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text3)' }}>
                오늘 예약이 없습니다
              </div>
            ) : (
              todayBookings.map((b) => (
                <div
                  key={b.id}
                  className="owner-v3-card"
                  style={{
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 13px',
                    marginBottom: 7,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text3)' }}>{b.booking_time}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.service_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>₩{(b.service_price || 0).toLocaleString()}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '3px 9px',
                      borderRadius: 18,
                      background: b.status === '예약확정' ? 'rgba(76,173,126,0.12)' : 'rgba(201,168,76,0.1)',
                      color: b.status === '예약확정' ? '#4cad7e' : 'var(--gold)',
                      border: `1px solid ${b.status === '예약확정' ? 'rgba(76,173,126,0.3)' : 'rgba(201,168,76,0.3)'}`,
                      fontWeight: 600,
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="owner-v3-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>📈 월별 매출 추이</div>
            {monthlyTrend.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>매출 데이터가 없습니다</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyTrend}>
                  <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1830', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 8, fontSize: 11, color: '#e8e0f5' }}
                    formatter={(v: number) => [`₩${Number(v).toLocaleString()}`, '매출']}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--gold)" strokeWidth={2} dot={{ fill: 'var(--gold)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="owner-v3-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>매출 디테일</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>관리권 매출</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: '#7B5EA7', fontWeight: 700 }}>{fmtWon(serviceRevenue.current)}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                비중 {serviceShare}% · 전월대비 {fmtPct(serviceRevenue.changePercent)}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>제품 매출</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--gold)', fontWeight: 700 }}>{fmtWon(productRevenue.current)}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                비중 {productShare}% · 전월대비 {fmtPct(productRevenue.changePercent)}
              </div>
            </div>
            <OwnerBrandProductRevenueRow revenue={brandProductRevenue} />
          </div>

          <OwnerBadgeTierSection brands={tierBadgeBrands} />
          <OwnerBrandSelfTierSection
            brands={selfTierBrands}
            sectionTitle="시바산 본사 인증 등급"
            sectionSubtitle="시바산 파트너 전용 혜택"
          />

          {profile?.origin_track === 'B' && (
          <div className="owner-v3-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>내가 모집한 원장님</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.4 }}>
              모집 원장님 매출 기준 커미션 - 정산 로직 연결 예정
            </div>
            {recruitedOwners.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>모집한 원장님이 아직 없습니다</div>
            ) : (
              recruitedOwners.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>이번달 매출 {fmtWon(o.monthSales)}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'rgba(201,168,76,0.85)',
                      background: 'rgba(201,168,76,0.1)',
                      border: '1px solid rgba(201,168,76,0.25)',
                      borderRadius: 8,
                      padding: '4px 8px',
                    }}
                  >
                    정산 준비중
                  </span>
                </div>
              ))
            )}
          </div>
          )}

          {brandPost && (
            <div className="owner-v3-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>브랜드 소식</div>
              {brandPost.brand_name && (
                <div style={{ fontSize: 10, color: '#7B5EA7', marginBottom: 4 }}>{brandPost.brand_name}</div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                {brandPost.title || '공지'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text3)',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {brandPost.body}
              </div>
              <Link href="/dashboard/owner/brand-community" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#7B5EA7', textDecoration: 'none' }}>
                더보기 →
              </Link>
            </div>
          )}

          <div className="owner-v3-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>🏆 인기 시술 TOP3</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>최근 30일 기준</div>
            {topServices.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>데이터가 없습니다</div>
            ) : (
              topServices.map((s, i) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < topServices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: i === 0 ? 'var(--gold)' : 'var(--text3)',
                      background: i === 0 ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${i === 0 ? 'rgba(201,168,76,0.3)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '2px 7px',
                      minWidth: 24,
                      textAlign: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{s.count}건</div>
                </div>
              ))
            )}
          </div>

          <div className="owner-v3-card" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>🛍️ 인기 제품 TOP3</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>최근 30일 기준</div>
            {topProducts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>데이터가 없습니다</div>
            ) : (
              topProducts.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < topProducts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: i === 0 ? '#7B5EA7' : 'var(--text3)',
                      background: i === 0 ? 'rgba(123,94,167,0.12)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${i === 0 ? 'rgba(123,94,167,0.3)' : 'var(--border)'}`,
                      borderRadius: 6,
                      padding: '2px 7px',
                      minWidth: 24,
                      textAlign: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{p.quantity}개</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
