'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

const BOARDS = [
  { id: 'skin', title: '피부고민', desc: '트러블/홍조/건조/민감' },
  { id: 'review', title: '제품리뷰', desc: '사용후기·성분·추천템' },
  { id: 'salon', title: '살롱후기', desc: '관리 후기·추천 샵' },
  { id: 'routine', title: '스킨루틴', desc: '아침/저녁 루틴 공유' },
  { id: 'qa', title: 'Q&A', desc: '궁금한 점을 물어보세요' },
]

export default function CustomerCommunityPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="커뮤니티" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>게시판</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BOARDS.map(b => (
            <div
              key={b.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 14,
                padding: '14px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{b.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.desc}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

