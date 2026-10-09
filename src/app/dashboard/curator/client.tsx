'use client'

import { useEffect, useRef, useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'
import ContributionSheet from './ContributionSheet'

type Brand = 'Civasan' | 'Bollayon' | 'ITACA'
type Product = { id: string; brand: Brand; emoji: string; name: string; price: number }

const ACCENT = '#e8845a'
const BRANDS: Brand[] = ['Civasan', 'Bollayon', 'ITACA']

// TODO: products + brands 테이블 연결 (현재 목업)
const MOCK_PRODUCTS: Product[] = [
  { id: 'c1', brand: 'Civasan', emoji: '🧴', name: '메쓰크림', price: 89000 },
  { id: 'c2', brand: 'Civasan', emoji: '💧', name: '하이드라 앰플', price: 72000 },
  { id: 'c3', brand: 'Civasan', emoji: '🌿', name: '카밍 토너', price: 48000 },
  { id: 'b1', brand: 'Bollayon', emoji: '✨', name: '글로우 세럼', price: 65000 },
  { id: 'b2', brand: 'Bollayon', emoji: '🫧', name: '클렌징 폼', price: 32000 },
  { id: 'b3', brand: 'Bollayon', emoji: '🌙', name: '나이트 크림', price: 58000 },
  { id: 'i1', brand: 'ITACA', emoji: '🌸', name: '로즈 미스트', price: 38000 },
  { id: 'i2', brand: 'ITACA', emoji: '🍯', name: '허니 마스크', price: 42000 },
]
// TODO: 실시간 알림 데이터 연결 (현재 목업)
const MOCK_ALERTS = ['🛒 방금 내 링크로 2건 구매', '🔥 메쓰크림 공구 마감 D-2', '💬 새 문의 3개']
// TODO: 공구 일정 데이터 연결 (현재 목업)
const MOCK_CALENDAR = [
  { title: 'Civasan 메쓰크림', dDay: 2 },
  { title: 'Bollayon 글로우 세럼', dDay: 5 },
  { title: 'ITACA 로즈 미스트', dDay: 9 },
]
// TODO: group_buy_requests 테이블 연결 (현재 목업)
const MOCK_REQUESTS = { approved: 3, pending: 2, rejected: 1 }
// TODO: 실제 링크 통계 데이터 연결 (현재 목업)
const MOCK_LINK_STATS = { clicks: 1284, purchases: 86, rate: 12 }
// TODO: 실제 링크 데이터 연결 (현재 목업)
const MOCK_LINK = 'https://www.auran.kr/g/curator-demo'
// TODO: 랭킹 데이터 연결 (현재 목업)
const MOCK_RANKING = [
  { rank: 1, medal: '🥇', name: '뷰티지니', amount: 412000 },
  { rank: 2, medal: '🥈', name: '스킨로그', amount: 286500 },
  { rank: 3, medal: '🥉', name: '데일리글로우', amount: 174200 },
]
const MOCK_MY_RANK = { rank: 4, amount: 128400 }
// TODO: settlements 테이블 연결 (현재 목업)
const MOCK_SETTLEMENTS = [
  { date: '2026-09-30', title: '9월 공구 수수료', amount: 312000 },
  { date: '2026-08-31', title: '8월 공구 수수료', amount: 284500 },
  { date: '2026-07-31', title: '7월 공구 수수료', amount: 196000 },
]

const won = (n: number) => `₩${n.toLocaleString()}`

const card = {
  background: '#fff',
  border: '1px solid #f0ece8',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
} as const

const inp = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: '#faf8f6',
  border: '1px solid #f0ece8',
  color: '#222',
  fontSize: 13,
  boxSizing: 'border-box',
} as const

const chip = {
  flex: '0 0 auto',
  background: '#fff7f4',
  border: '1px solid #f0ece8',
  borderRadius: 20,
  padding: '8px 12px',
  fontSize: 12,
  color: '#444',
  whiteSpace: 'nowrap',
} as const

function SecTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 500, color: '#222', margin: '20px 0 10px' }}>{children}</div>
}

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#222' }}>{title}</div>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        style={{ border: 'none', background: 'transparent', color: '#888', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
      >
        ×
      </button>
    </div>
  )
}

export default function CuratorDashClient({ profile }: { profile: any }) {
  const [isMobile, setIsMobile] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [desc, setDesc] = useState('')
  const [pickError, setPickError] = useState(false)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)
  const [brand, setBrand] = useState<Brand>('Civasan')
  const [query, setQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [contribOpen, setContribOpen] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480)
    onResize()
    window.addEventListener('resize', onResize)
    const pending = timers.current
    return () => {
      window.removeEventListener('resize', onResize)
      pending.forEach(clearTimeout)
    }
  }, [])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }

  const resetForm = () => {
    setSelectedProduct(null)
    setTitle('')
    setStartAt('')
    setEndAt('')
    setDesc('')
  }

  const submitRequest = () => {
    if (selectedProduct === null) {
      setPickError(true)
      later(() => setPickError(false), 500)
      return
    }
    // TODO: API 연결 — group_buy_requests INSERT (product_id, desired_start_at, desired_end_at, message)
    setToast('신청 완료! 검토 후 승인됩니다 ✅')
    later(() => setToast(''), 2000)
    setRequestOpen(false)
    resetForm()
  }

  const onSelect = (p: Product) => {
    setHighlightId(p.id)
    later(() => {
      setHighlightId(null)
      setSelectedProduct(p)
      setPickerOpen(false)
    }, 200)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_LINK)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = MOCK_LINK
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    later(() => setCopied(false), 1500)
  }

  const q = query.trim().toLowerCase()
  const filtered = MOCK_PRODUCTS.filter(p => p.brand === brand && (!q || p.name.toLowerCase().includes(q)))
  const name = String(profile?.name || '큐레이터')

  const productBtnBorder = pickError ? '2px solid red' : selectedProduct ? `2px solid ${ACCENT}` : `2px dashed ${ACCENT}`

  return (
    <div style={{ minHeight: '100dvh', background: '#faf8f6', color: '#222', colorScheme: 'light', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{'.cur-hscroll::-webkit-scrollbar{display:none}'}</style>

      {/* 1. 헤더 */}
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 30, borderBottom: '1px solid #f0ece8' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#222', letterSpacing: 1 }}>ORÆN.</span>
            <span style={{ background: ACCENT, color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11 }}>큐레이터</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* TODO: 알림 연결 */}
            <div style={{ position: 'relative', fontSize: 20 }}>
              🔔
              <span style={{ position: 'absolute', top: 0, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#e53935' }} />
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0e6df', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: ACCENT }}>
              {name.slice(0, 1)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 140px' }}>
        {/* 2. 인사말 + 레벨 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 17, color: '#222' }}>안녕하세요, {name}님 👋</div>
          {/* TODO: 레벨 데이터 연결 */}
          <span style={{ background: '#f4f4f6', border: '1px solid #e0e0e6', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#555' }}>⭐ 실버</span>
        </div>

        {/* 3. 목표 진행바 — TODO: 실제 수수료 데이터 연결 */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 8 }}>
            <span>이번달 목표</span>
            <span><span style={{ color: ACCENT }}>{won(128400)}</span> / {won(200000)}</span>
          </div>
          <div style={{ background: '#f5ede8', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ background: ACCENT, width: '64%', height: 8, borderRadius: 4 }} />
          </div>
        </div>

        {/* 4. 내 공구 링크 빠른 공유 — TODO: 실제 링크 데이터 연결 */}
        <div style={{ ...card, border: `2px solid ${ACCENT}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>내 공구 링크</div>
            <div style={{ fontSize: 13, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{MOCK_LINK}</div>
          </div>
          <button
            type="button"
            onClick={() => void copyLink()}
            style={{ flex: '0 0 auto', border: 'none', background: ACCENT, color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
          >
            {copied ? '복사됨 ✓' : '복사'}
          </button>
        </div>

        {/* 5. 이번달 예상수수료 — TODO: 실제 수수료 데이터 연결 */}
        <div style={{ background: 'linear-gradient(135deg, #e8845a, #d06b42)', color: '#fff', borderRadius: 16, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.9 }}>이번달 예상수수료</div>
          <div style={{ fontSize: 28, margin: '6px 0 4px' }}>{won(128400)}</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>누적정산완료 {won(1240000)}</div>
        </div>

        {/* 6. 실시간 알림 — TODO: 목업 */}
        <SecTitle>실시간 알림</SecTitle>
        <div className="cur-hscroll" style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4, scrollbarWidth: 'none' }}>
          {MOCK_ALERTS.map(a => (
            <div key={a} style={chip}>{a}</div>
          ))}
        </div>

        {/* 7. 공구 캘린더 — TODO: 목업 */}
        <SecTitle>공구 캘린더</SecTitle>
        <div className="cur-hscroll" style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4, scrollbarWidth: 'none' }}>
          {MOCK_CALENDAR.map(c => (
            <div key={c.title} style={{ ...chip, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ background: ACCENT, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>D-{c.dDay}</span>
              {c.title}
            </div>
          ))}
        </div>

        {/* 8. 공구 요청 현황 — TODO: group_buy_requests 테이블 연결 */}
        <SecTitle>공구 요청 현황</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: '승인됨', n: MOCK_REQUESTS.approved, bg: '#f0faf5', bd: '#3db87a' },
            { label: '검토중', n: MOCK_REQUESTS.pending, bg: '#fff7f4', bd: ACCENT },
            { label: '미승인', n: MOCK_REQUESTS.rejected, bg: '#fff5f5', bd: '#e57373' },
          ].map(r => (
            <div key={r.label} style={{ background: r.bg, border: `1px solid ${r.bd}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, color: r.bd }}>{r.n}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* 9. 내 공구 링크 통계 — TODO: 실제 데이터 연결 */}
        <SecTitle>내 공구 링크 통계</SecTitle>
        <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', padding: '14px 8px' }}>
          {[
            { label: '클릭수', v: MOCK_LINK_STATS.clicks.toLocaleString() },
            { label: '구매수', v: MOCK_LINK_STATS.purchases.toLocaleString() },
            { label: '수수료율', v: `${MOCK_LINK_STATS.rate}%` },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 18, color: '#222' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 10. 내 채널 — TODO: curator_channels 테이블 연결 */}
        <SecTitle>내 채널</SecTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={chip}>📷 인스타 12.4K</div>
          <div style={chip}>▶️ 유튜브 3.2K</div>
          <button
            type="button"
            onClick={() => { /* TODO: 채널 추가 */ }}
            style={{ ...chip, background: '#fff', border: `1px dashed ${ACCENT}`, color: ACCENT, cursor: 'pointer' }}
          >
            + 채널추가
          </button>
        </div>

        {/* 11. 이달 랭킹 — TODO: 목업 */}
        <SecTitle>이달 랭킹</SecTitle>
        <div style={{ ...card, padding: '6px 16px' }}>
          {MOCK_RANKING.map(r => (
            <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f5f2ef' }}>
              <span style={{ fontSize: 18 }}>{r.medal}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#222' }}>{r.name}</span>
              <span style={{ fontSize: 13, color: '#666' }}>{won(r.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', color: ACCENT }}>
            <span style={{ fontSize: 13, width: 22, textAlign: 'center' }}>{MOCK_MY_RANK.rank}위</span>
            <span style={{ flex: 1, fontSize: 13 }}>나 ({name})</span>
            <span style={{ fontSize: 13 }}>{won(MOCK_MY_RANK.amount)}</span>
          </div>
        </div>

        {/* 12. 콘텐츠 만들기 */}
        <SecTitle>콘텐츠 만들기</SecTitle>
        {/* [ANCHOR: curator-contribution-button] */}
        <button
          type="button"
          onClick={() => setContribOpen(true)}
          style={{ width: '100%', border: `2px dashed ${ACCENT}`, borderRadius: 12, padding: '12px 16px', background: '#fff', color: ACCENT, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}
        >
          ✍️ 매거진 기고하기
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            { emoji: '🖼️', label: '공유카드' },
            { emoji: '✍️', label: '소개글' },
            { emoji: '📊', label: '성과리포트' },
            { emoji: '🎬', label: '쇼츠스크립트' },
          ].map(c => (
            <button
              key={c.label}
              type="button"
              onClick={() => { /* TODO: 콘텐츠 생성 연결 */ }}
              style={{ ...card, marginBottom: 0, cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#222' }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{c.emoji}</div>
              {c.label}
            </button>
          ))}
        </div>

        {/* 13. 최근 정산 내역 — TODO: settlements 테이블 연결 */}
        <SecTitle>최근 정산 내역</SecTitle>
        <div style={{ ...card, padding: '4px 16px' }}>
          {MOCK_SETTLEMENTS.map(s => (
            <div key={s.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f5f2ef' }}>
              <div>
                <div style={{ fontSize: 13, color: '#222' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.date}</div>
              </div>
              <div style={{ fontSize: 13, color: '#3db87a' }}>+{won(s.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        type="button"
        aria-label="공구 신청"
        onClick={() => setRequestOpen(true)}
        style={{ position: 'fixed', right: 16, bottom: 88, zIndex: 9000, width: 56, height: 56, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 20, border: 'none', cursor: 'pointer', boxShadow: '0 6px 16px rgba(232,132,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
      >
        ＋
      </button>

      {/* 공구신청 시트 */}
      <SlideUpSheet open={requestOpen} onClose={() => setRequestOpen(false)} zIndex={9000} height="auto" maxHeight="90dvh">
        <div style={{ background: '#fff', color: '#222', colorScheme: 'light', padding: '18px 18px 28px', maxWidth: 560, margin: '0 auto' }}>
          <SheetHead title="공구 신청" onClose={() => setRequestOpen(false)} />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{ border: productBtnBorder, borderRadius: 12, padding: '12px 16px', background: '#fff', color: ACCENT, width: '100%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}
          >
            {selectedProduct ? (
              <>
                <span style={{ color: '#222' }}>{selectedProduct.emoji} {selectedProduct.name} {selectedProduct.price.toLocaleString()}원</span>
                <span style={{ fontSize: 12 }}>변경 ▼</span>
              </>
            ) : (
              <span style={{ width: '100%', textAlign: 'center' }}>🛍️ 제품 불러오기</span>
            )}
          </button>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>제목</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="공구 제목" style={{ ...inp, marginBottom: 14 }} />
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>희망 기간</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input type="date" value={startAt} onChange={e => setStartAt(e.target.value)} style={inp} />
            <span style={{ fontSize: 12, color: '#888' }}>~</span>
            <input type="date" value={endAt} min={startAt || undefined} onChange={e => setEndAt(e.target.value)} style={inp} />
          </div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>설명</div>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="이 제품 추천 이유를 적어주세요" rows={3} style={{ ...inp, resize: 'vertical', minHeight: 72, marginBottom: 18 }} />
          <button
            type="button"
            onClick={submitRequest}
            style={{ width: '100%', border: 'none', borderRadius: 12, padding: '14px 16px', background: ACCENT, color: '#fff', fontSize: 14, cursor: 'pointer' }}
          >
            신청하기
          </button>
        </div>
      </SlideUpSheet>

      {/* 제품선택 시트 */}
      <SlideUpSheet open={pickerOpen} onClose={() => setPickerOpen(false)} zIndex={9100} height="80dvh">
        <div style={{ background: '#fff', color: '#222', colorScheme: 'light', padding: '18px 18px 28px', minHeight: '100%', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <SheetHead title="제품 선택" onClose={() => setPickerOpen(false)} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {BRANDS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrand(b)}
                  style={{ border: `1px solid ${brand === b ? ACCENT : '#f0ece8'}`, background: brand === b ? '#fff7f4' : '#fff', color: brand === b ? ACCENT : '#555', borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
                >
                  {b}
                </button>
              ))}
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제품명 검색" style={{ ...inp, marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 10 }}>
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  style={{ border: highlightId === p.id ? `2px solid ${ACCENT}` : '2px solid #f0ece8', borderRadius: 12, background: '#fff', padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s' }}
                >
                  <div style={{ fontSize: 30, marginBottom: 6 }}>{p.emoji}</div>
                  <div style={{ fontSize: 13, color: '#222' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: ACCENT, marginTop: 2 }}>{p.price.toLocaleString()}원</div>
                </button>
              ))}
            </div>
            {filtered.length === 0 && <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '24px 0' }}>검색 결과가 없어요</div>}
          </div>
        </div>
      </SlideUpSheet>

      {/* [ANCHOR: curator-contribution-sheet] */}
      <ContributionSheet
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        onSubmitted={() => {
          setToast('기고가 접수됐어요! 검토 후 발행됩니다 ✅')
          later(() => setToast(''), 2000)
        }}
      />

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 160, transform: 'translateX(-50%)', zIndex: 9200, background: 'rgba(34,34,34,0.92)', color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
