'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.55)'

const faqs = [
  { q: '주문 취소는 어떻게 하나요?', a: '마이페이지 → 주문 내역에서 취소 신청 가능합니다.' },
  { q: '토스트 포인트는 언제 적립되나요?', a: '구매 확정 후 자동 적립됩니다.' },
  { q: '배송은 얼마나 걸리나요?', a: '결제 후 1~3 영업일 내 출고됩니다.' },
  { q: '교환/반품은 어떻게 하나요?', a: '수령 후 7일 이내 고객센터로 문의해주세요.' },
  { q: '등급은 어떻게 올라가나요?', a: '12개월 누적 구매금액 기준으로 자동 변경됩니다.' },
]

type InquiryRow = {
  id: string
  title: string | null
  status: string | null
  created_at: string | null
}

export default function MySupportPage() {
  const router = useRouter()
  const supabase = createClient()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return
      const { data: rows } = await supabase
        .from('inquiries')
        .select('id, title, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setInquiries((rows as InquiryRow[]) || [])
    }
    run()
  }, [])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 20 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(13,11,9,0.96)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>고객센터</div>
      </header>

      <div style={{ padding: 16 }}>
        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>빠른 문의</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="tel:0212345678" style={{ textDecoration: 'none', color: '#fff', border: CARD_BORDER, borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>📞 전화 문의</a>
            <a href="https://pf.kakao.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#fff', border: CARD_BORDER, borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>💬 카카오톡 채널</a>
            <a href="mailto:support@auran.co.kr" style={{ textDecoration: 'none', color: '#fff', border: CARD_BORDER, borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>📧 이메일 문의</a>
          </div>
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>자주 묻는 질문 FAQ</div>
          {faqs.map((faq, idx) => (
            <div key={faq.q} style={{ borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
              <button
                onClick={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', background: 'transparent', color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >
                <span>Q. {faq.q}</span>
                <span style={{ color: TEXT_MUTED }}>{openIdx === idx ? '−' : '+'}</span>
              </button>
              {openIdx === idx ? <div style={{ marginTop: 8, fontSize: 12, color: TEXT_MUTED }}>A. {faq.a}</div> : null}
            </div>
          ))}
        </section>

        <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14 }}>
          <div style={{ color: GOLD, fontSize: 12, marginBottom: 10 }}>문의 내역</div>
          {inquiries.length === 0 ? (
            <div style={{ fontSize: 13, color: TEXT_MUTED }}>문의 내역이 없어요</div>
          ) : (
            inquiries.map((inq) => (
              <div key={inq.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
                <div style={{ fontSize: 13 }}>{inq.title || '문의'}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
                  {inq.status || '접수'} · {inq.created_at ? new Date(inq.created_at).toLocaleDateString('ko-KR') : '-'}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
