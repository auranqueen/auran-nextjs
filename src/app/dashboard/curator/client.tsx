'use client'

import { useEffect, useRef, useState } from 'react'
import ContributionSheet from './ContributionSheet'
import MyContributions from './MyContributions'
import GroupBuySheet from './GroupBuySheet'

const ACCENT = '#e8845a'

// TODO: 실시간 알림 데이터 연결 (현재 목업)
const MOCK_ALERTS = ['🛒 방금 내 링크로 2건 구매', '🔥 메쓰크림 공구 마감 D-2', '💬 새 문의 3개']
// TODO: 공구 일정 데이터 연결 (현재 목업)
const MOCK_CALENDAR = [
  { title: 'Civasan 메쓰크림', dDay: 2 },
  { title: 'Bollayon 글로우 세럼', dDay: 5 },
  { title: 'ITACA 로즈 미스트', dDay: 9 },
]
// 공구 요청 현황 API 실패 시 대체값 (현재 목업)
const MOCK_REQUESTS = { approved: 3, pending: 2, rejected: 1 }
type RejectedGroupBuy = { id: string; admin_note: string | null; created_at: string; products: { name: string } | null }
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

export default function CuratorDashClient({ profile }: { profile: any }) {
  const [isMobile, setIsMobile] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)
  const [contribOpen, setContribOpen] = useState(false)
  const [postsKey, setPostsKey] = useState(0)
  const [reqCounts, setReqCounts] = useState<(typeof MOCK_REQUESTS & { rejectedList?: RejectedGroupBuy[] }) | null>(null)
  const [reqCountsKey, setReqCountsKey] = useState(0)
  const [showRejected, setShowRejected] = useState(false)
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

  useEffect(() => {
    let alive = true
    fetch('/api/curator/groupbuy?type=status', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: Partial<typeof MOCK_REQUESTS> & { rejectedList?: RejectedGroupBuy[] }) => {
        if (alive) setReqCounts({ approved: Number(json.approved) || 0, pending: Number(json.pending) || 0, rejected: Number(json.rejected) || 0, rejectedList: Array.isArray(json.rejectedList) ? json.rejectedList : [] })
      })
      .catch(err => {
        console.error('[CuratorDash] groupbuy status load error', err)
        if (alive) setReqCounts(null)
      })
    return () => {
      alive = false
    }
  }, [reqCountsKey])

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
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

  const name = String(profile?.name || '큐레이터')

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

        {/* 8. 공구 요청 현황 — [ANCHOR: groupbuy-status-counts] /api/curator/groupbuy?type=status, 로딩 중 '-' */}
        <SecTitle>공구 요청 현황</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: '승인됨', n: reqCounts?.approved ?? '-', bg: '#f0faf5', bd: '#3db87a' },
            { label: '검토중', n: reqCounts?.pending ?? '-', bg: '#fff7f4', bd: ACCENT },
            { label: '미승인', n: reqCounts?.rejected ?? '-', bg: '#fff5f5', bd: '#e57373', onClick: () => setShowRejected(true) },
          ].map(r => (
            <div key={r.label} onClick={r.onClick} style={{ background: r.bg, border: `1px solid ${r.bd}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center', cursor: r.onClick ? 'pointer' : 'default' }}>
              <div style={{ fontSize: 20, color: r.bd }}>{r.n}</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* [ANCHOR: groupbuy-rejected-list] '미승인' 카드 클릭 시 인라인 거절 목록 */}
        {showRejected && (
          <div style={{ backgroundColor: '#fff5f5', border: '1px solid #f3c4c4', borderRadius: 12, padding: '14px 14px 6px', marginTop: 8, colorScheme: 'light' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 14, color: '#333333' }}>거절된 공구 신청</div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowRejected(false)}
                style={{ border: 'none', background: 'transparent', color: '#999999', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 2 }}
              >
                ×
              </button>
            </div>
            {(reqCounts?.rejectedList ?? []).length === 0 ? (
              <div style={{ fontSize: 12, color: '#999999', padding: '10px 0 12px' }}>거절된 신청이 없어요</div>
            ) : (
              (reqCounts?.rejectedList ?? []).map((item, i, arr) => (
                <div key={item.id} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #f3d6d6' : 'none' }}>
                  <div style={{ fontSize: 13, color: '#333333' }}>{item.products?.name || '(삭제된 제품)'}</div>
                  <div style={{ fontSize: 12, color: '#c0504d', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.admin_note || '사유 없음'}</div>
                  <div style={{ fontSize: 11, color: '#999999', marginTop: 4 }}>{new Date(item.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
              ))
            )}
          </div>
        )}

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

        {/* [ANCHOR: curator-my-posts] */}
        <MyContributions refreshKey={postsKey} />

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

      {/* [ANCHOR: curator-groupbuy-sheet] */}
      <GroupBuySheet
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        isMobile={isMobile}
        onSubmitted={() => {
          setReqCountsKey(k => k + 1)
          setToast('공구 신청이 접수됐어요! 검토 후 연락드릴게요 ✅')
          later(() => setToast(''), 2000)
        }}
      />

      {/* [ANCHOR: curator-contribution-sheet] */}
      <ContributionSheet
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        onSubmitted={() => {
          setPostsKey(k => k + 1)
          setToast('기고가 발행됐어요! 매거진에서 확인해보세요 ✅')
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
