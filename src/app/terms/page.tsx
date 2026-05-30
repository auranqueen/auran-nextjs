'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const BG = '#0a0a0f'
const GOLD = '#C9A96E'
const PRIMARY = '#7B5EA7'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.55)'
const TEXT_DIM = 'rgba(255,255,255,0.35)'

export default function TermsPage() {
  const router = useRouter()

  return (
    <div
      style={{
        background: BG,
        minHeight: '100vh',
        maxWidth: 480,
        margin: '0 auto',
        fontFamily: "'Noto Sans KR', sans-serif",
        fontWeight: 400,
        color: '#fff',
        padding: '0 16px 32px',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0',
          margin: '0 -16px',
          paddingLeft: 16,
          paddingRight: 16,
          borderBottom: CARD_BORDER,
          background: 'rgba(10,10,15,0.95)',
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
        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>서비스 이용약관</span>
        <span style={{ width: 34 }} />
      </header>

      <div style={{ paddingTop: 20 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: GOLD, letterSpacing: 3, marginBottom: 8 }}>AURAN</div>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 6px', color: '#fff' }}>서비스 이용약관</h1>
        <p style={{ fontSize: 11, color: TEXT_DIM, margin: '0 0 20px' }}>시행일: 2026년 1월 1일 · 주식회사티엔씨</p>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제1조 (목적)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            본 약관은 주식회사티엔씨(이하 &quot;회사&quot;)가 제공하는 AURAN 서비스의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및
            책임 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제2조 (서비스 내용)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: '0 0 8px' }}>
            회사는 다음과 같은 서비스를 제공합니다.
          </p>
          <ul style={{ fontSize: 12, lineHeight: 1.85, color: TEXT_MUTED, margin: 0, paddingLeft: 18 }}>
            <li>AI 기반 피부 분석 및 맞춤 케어 추천</li>
            <li>살롱·뷰티 파트너 예약 및 상담 연계</li>
            <li>파트너·브랜드 수익·커미션 관련 기능</li>
          </ul>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: '10px 0 0' }}>
            본 서비스는 의료행위가 아니며, AI 분석·추천 결과는 참고용 정보입니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제3조 (회원 자격)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            이용자는 만 14세 이상이어야 하며, 회원가입 시 본 약관 및 개인정보처리방침에 동의한 것으로 간주합니다.
            만 14세 미만은 서비스를 이용할 수 없습니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제4조 (서비스 이용)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            서비스는 연중무휴 24시간 제공을 원칙으로 합니다. 다만 시스템 점검, 장애, 천재지변 등 불가피한 사유로
            일시 중단될 수 있으며, 회사는 사전 또는 사후에 이를 안내할 수 있습니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제5조 (금지 행위)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: '0 0 8px' }}>
            이용자는 다음 행위를 하여서는 안 됩니다.
          </p>
          <ul style={{ fontSize: 12, lineHeight: 1.85, color: TEXT_MUTED, margin: 0, paddingLeft: 18 }}>
            <li>타인의 정보·계정 도용 또는 허위 정보 등록</li>
            <li>서비스 해킹, 비정상 접근, 자동화 수단을 통한 과도한 요청</li>
            <li>허위 리뷰·후기 작성, 타인 비방·명예 훼손</li>
            <li>회사 또는 제3자의 지적재산권·영업비밀 침해</li>
            <li>기타 관련 법령 또는 본 약관에 위반되는 행위</li>
          </ul>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제6조 (지적재산권)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            서비스 내 텍스트, 이미지, UI, 로고, AI 분석 결과 표시 방식 등 모든 콘텐츠에 대한 저작권 및 지적재산권은
            회사 또는 정당한 권리자에게 귀속됩니다. 이용자는 회사의 사전 동의 없이 이를 복제·배포·상업적으로 이용할 수 없습니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제7조 (책임 제한)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            AI 피부 분석·추천 결과는 참고용이며, 의학적 진단·치료·처방을 대체하지 않습니다.
            이용자는 전문 의료기관 상담이 필요한 경우 반드시 의료 전문가의 판단을 따르셔야 합니다.
            회사는 이용자가 서비스 정보에만 의존하여 발생한 손해에 대해 법령이 허용하는 범위 내에서 책임을 제한합니다.
          </p>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 500, color: PRIMARY, margin: '0 0 8px' }}>제8조 (분쟁 해결)</h2>
          <p style={{ fontSize: 12, lineHeight: 1.75, color: TEXT_MUTED, margin: 0 }}>
            본 약관과 서비스 이용에 관한 분쟁은 대한민국 법령을 적용하며, 관할 법원은 민사소송법 등 관련 법령에 따릅니다.
          </p>
        </section>

        <section
          style={{
            padding: 14,
            background: 'rgba(123,94,167,0.08)',
            border: `1px solid ${PRIMARY}44`,
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 11, lineHeight: 1.7, color: TEXT_DIM, margin: 0 }}>
            본 약관은 2026년 1월 1일부터 시행됩니다. 내용 변경 시 서비스 내 공지를 통해 안내합니다.
          </p>
        </section>

        <div style={{ textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              fontSize: 13,
              color: GOLD,
              textDecoration: 'none',
              padding: '10px 20px',
              border: `1px solid ${GOLD}55`,
              borderRadius: 8,
            }}
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
