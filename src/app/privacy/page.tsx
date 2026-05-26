'use client'

import { useRouter } from 'next/navigation'

const BG = '#0d0b09'
const GOLD = '#C9A96E'
const PRIMARY = '#7B5EA7'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.55)'
const TEXT_DIM = 'rgba(255,255,255,0.35)'

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div
      style={{
        background: BG,
        minHeight: '100vh',
        maxWidth: 390,
        margin: '0 auto',
        fontFamily: "'Noto Sans KR', sans-serif",
        fontWeight: 400,
        color: '#fff',
        paddingBottom: 32,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: CARD_BORDER,
          background: 'rgba(13,11,9,0.95)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            border: CARD_BORDER,
            color: '#fff',
            fontSize: 18,
            cursor: 'pointer',
            fontWeight: 400,
          }}
        >
          ‹
        </button>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>개인정보처리방침</span>
        <span style={{ width: 34 }} />
      </header>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: GOLD, letterSpacing: 3, marginBottom: 8 }}>AURAN</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 6px', color: '#fff' }}>개인정보처리방침</h1>
        <p style={{ fontSize: 11, color: TEXT_DIM, margin: '0 0 20px' }}>시행일: 2026년 5월 26일</p>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>1. 개인정보의 처리 목적</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            주식회사 티엔씨(이하 &quot;회사&quot;)는 AURAN 서비스 제공을 위해 다음 목적 범위 내에서 개인정보를 처리합니다.
            회원 가입·로그인, AI 피부분석·맞춤 추천, 호르몬 주기 기반 케어, 상품 주문·결제, 원장 상담톡, 고객 문의 응대 및 서비스 개선.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>2. 수집하는 개인정보 항목</h2>
          <ul style={{ fontSize: 12, lineHeight: 1.85, color: TEXT_MUTED, margin: 0, paddingLeft: 18 }}>
            <li>이메일 주소 (회원 식별, 알림, 고객 지원)</li>
            <li>카카오 로그인 정보 (소셜 로그인 시 제공받는 식별자·프로필 닉네임·이미지 등)</li>
            <li>피부분석 데이터 (촬영·설문 기반 점수, 피부 타입, 고민 부위, 분석 이력)</li>
            <li>호르몬 주기 정보 (생리 주기, 임신·갱년기 등 맞춤 서비스 제공)</li>
            <li>구매내역 (주문·결제·배송·환불 처리)</li>
            <li>상담톡 내용 (원장·고객 간 상담 메시지, 첨부 이미지)</li>
          </ul>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>3. 개인정보의 보유 및 이용 기간</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            회원 탈퇴 시까지 보유하며, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.
            (전자상거래 등에서의 소비자보호에 관한 법률 등)
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>4. 개인정보 처리 위탁</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: '0 0 10px' }}>
            원활한 서비스 제공을 위해 아래 업체에 개인정보 처리를 위탁할 수 있습니다.
          </p>
          <ul style={{ fontSize: 12, lineHeight: 1.85, color: TEXT_MUTED, margin: 0, paddingLeft: 18 }}>
            <li>Supabase — 데이터베이스·인증 저장</li>
            <li>Vercel — 웹 서비스 호스팅</li>
            <li>Anthropic — AI 피부분석 API 처리</li>
            <li>페이앱(PayApp) — 결제 처리</li>
            <li>카카오 — 소셜 로그인·알림 연동</li>
          </ul>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>5. 정보주체의 권리</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            이용자는 개인정보 열람·정정·삭제·처리정지·동의 철회를 요청할 수 있습니다.
            앱 내 MY &gt; 프로필 또는 고객센터를 통해 요청하실 수 있습니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>6. 개인정보 보호책임자</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            성명: AURAN 개인정보보호 담당<br />
            이메일:{' '}
            <a href="mailto:queen8039@gmail.com" style={{ color: GOLD, textDecoration: 'none' }}>
              queen8039@gmail.com
            </a>
          </p>
        </section>

        <section
          style={{
            padding: 14,
            background: 'rgba(123,94,167,0.08)',
            border: `1px solid ${PRIMARY}44`,
            borderRadius: 12,
          }}
        >
          <p style={{ fontSize: 11, lineHeight: 1.7, color: TEXT_DIM, margin: 0 }}>
            본 방침은 2026년 5월 26일부터 시행됩니다. 내용 변경 시 서비스 내 공지를 통해 안내합니다.
          </p>
        </section>
      </div>
    </div>
  )
}
