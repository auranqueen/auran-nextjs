// src/app/notices/page.tsx

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Notice {
  id: string
  emoji: string
  title: string
  content: string
  date: string
  isPinned: boolean
  tags: string[]
}

const NOTICES: Notice[] = [
  {
    id: 'notice-001',
    emoji: '🌸',
    title: 'AURAN 12달 계절 테마 오픈',
    isPinned: true,
    date: '2026-03-17',
    tags: ['신기능', '업데이트'],
    content: `매달 자동으로 바뀌는 계절 배경과 애니메이션이 적용됩니다.

🌸 봄 (3~5월) — 벚꽃 꽃잎, 병아리, 하트
🌊 여름 (6~8월) — 바다, 태양, 비행기
🍁 가을 (9~11월) — 단풍, 달빛, 낙엽
❄️ 겨울 (12~2월) — 오로라, 눈, 크리스마스

설날·추석·빼빼로데이·크리스마스 등 한국 이슈도 반영됩니다.
하단 월 버튼으로 원하는 달 테마 직접 선택도 가능합니다.`,
  },
  {
    id: 'notice-002',
    emoji: '🎂',
    title: '생일 D-7 특별 테마 + 선물 이벤트',
    isPinned: true,
    date: '2026-03-17',
    tags: ['이벤트', '생일'],
    content: `생일 7일 전부터 당일까지 AURAN이 특별한 테마로 변신합니다.

✨ 빛나는 당신의 생일을 진심으로 축하드립니다

🎁 생일 선물 지급 기준
• 모든 회원 — 등급별 생일 선물 기본 증정
• 생일月 제품 구매 시 — 본품 추가 선물 증정
• 생일 포인트 별도 적립

🎀 선물은 생일 전날 밤 본사에서 깜짝 발송합니다
마이월드 → 선물함에서 확인하세요

📦 선물 확인 후 배송지를 등록하시면
택배로 발송해드립니다

생일 설정: 메인 화면 하단 MM-DD 입력`,
  },
]

export default function NoticesPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<Notice | null>(null)

  const pinned = NOTICES.filter(n => n.isPinned)
  const regular = NOTICES.filter(n => !n.isPinned)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif" }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 0' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>
          ←
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>공지사항</h1>
      </div>

      <div style={{ padding: '20px' }}>

        {/* 고정 공지 */}
        {pinned.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: '#c9a84c', letterSpacing: '2px', fontWeight: 700, marginBottom: '12px' }}>
              📌 고정 공지
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pinned.map(notice => (
                <NoticeCard key={notice.id} notice={notice} onClick={() => setSelected(notice)} pinned />
              ))}
            </div>
          </div>
        )}

        {/* 일반 공지 */}
        {regular.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: '#666', letterSpacing: '2px', fontWeight: 700, marginBottom: '12px' }}>
              전체 공지
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {regular.map(notice => (
                <NoticeCard key={notice.id} notice={notice} onClick={() => setSelected(notice)} />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* 상세 모달 */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setSelected(null)}>
          <div
            style={{ width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            {/* 모달 핸들 */}
            <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px', margin: '0 auto 20px' }} />

            {/* 태그 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              {selected.tags.map(tag => (
                <span key={tag} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c' }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* 제목 */}
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', lineHeight: 1.4 }}>
              {selected.emoji} {selected.title}
            </h2>

            {/* 날짜 */}
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '20px' }}>{selected.date}</div>

            {/* 구분선 */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '20px' }} />

            {/* 내용 */}
            <div style={{ fontSize: '14px', color: '#ccc', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
              {selected.content}
            </div>

            {/* 닫기 */}
            <button
              onClick={() => setSelected(null)}
              style={{ width: '100%', marginTop: '28px', padding: '14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#888', fontSize: '14px', cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NoticeCard({ notice, onClick, pinned }: { notice: Notice; onClick: () => void; pinned?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: pinned ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${pinned ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '16px',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '14px',
      }}>

      {/* 이모지 */}
      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
        {notice.emoji}
      </div>

      {/* 텍스트 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
          {notice.tags.map(tag => (
            <span key={tag} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: pinned ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.08)', color: pinned ? '#c9a84c' : '#666' }}>
              {tag}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {notice.title}
        </div>
        <div style={{ fontSize: '11px', color: '#555' }}>{notice.date}</div>
      </div>

      <div style={{ color: '#444', fontSize: '16px', flexShrink: 0 }}>›</div>
    </button>
  )
}

