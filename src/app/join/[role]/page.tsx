import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

const JOIN_OG: Record<string, { title: string; description: string; image: string }> = {
  owner: { title: 'AURAN PRO · 원장님 초대', description: '예약관리 + 스토어 + 매출관리', image: '/og-pro.png' },
  partner: { title: 'AURAN Partners · 파트너스 초대', description: '추천링크 + 커미션 수익', image: '/og-partners.png' },
  brand: { title: 'AURAN Brand · 브랜드사 초대', description: 'AI 추천 노출 + 전국 살롱 납품', image: '/og-brand.png' },
  customer: { title: 'AURAN · 고객 초대', description: 'AI 피부 분석 + 제품 추천 + 살롱 예약', image: '/og-image.png' },
}

export async function generateMetadata({ params }: { params: { role: string } }): Promise<Metadata> {
  const { role } = params
  const og = JOIN_OG[role] || JOIN_OG.customer
  return {
    title: og.title,
    description: og.description,
    openGraph: {
      title: og.title,
      description: og.description,
      images: [{ url: og.image, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: og.title, description: og.description, images: [og.image] },
  }
}

function DiamondIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M12 1L23 12 12 23 1 12 12 1z" fill="#9B111E" />
    </svg>
  )
}

interface Props { params: { role: string }; searchParams: { ref?: string } }

export default async function JoinPage({ params, searchParams }: Props) {
  const { role } = params
  const code = searchParams.ref || ''
  const validRoles = ['customer', 'partner', 'owner', 'brand']
  if (!validRoles.includes(role)) redirect('/')

  // 초대 링크 유효성 확인
  let inviteValid = false
  let inviteNote = ''
  if (code) {
    const supabase = createClient()
    const { data } = await supabase.from('invite_links').select('*').eq('code', code).eq('is_active', true).single()
    inviteValid = !!data
    inviteNote = data?.note || ''
  }

  const ROLE_META: Record<string, { label: string; icon: string | null; color: string; desc: string; benefit: string }> = {
    customer: { label: '고객', icon: '💧', color: '#c9a84c', desc: 'AI 피부 분석 + 제품 추천 + 살롱 예약', benefit: '🎁 가입 즉시 500P 적립' },
    partner:  { label: '파트너스', icon: '💎', color: '#4a8dc0', desc: '추천링크 + 커미션 수익', benefit: '💰 가입 즉시 추천 링크 생성' },
    owner:    { label: '원장님', icon: '✨', color: '#bf5f90', desc: '예약관리 + 스토어 + 매출관리', benefit: '⭐ BASIC 스토어 무료 시작' },
    brand:    { label: '브랜드사', icon: null, color: '#4cad7e', desc: 'AI 추천 노출 + 전국 살롱 납품', benefit: '✅ 입점 신청 즉시 검토' },
  }
  const meta = ROLE_META[role]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', padding: '0 0 40px', fontFamily: 'Pretendard, sans-serif' }}>
      <style>{`
        :root { --bg:#0a0c0f;--bg3:#181c23;--border:rgba(255,255,255,0.07);--text:#eef1f6;--text3:#4e5870; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:Pretendard,sans-serif; background:var(--bg); color:var(--text); }
      `}</style>

      <div style={{ background: 'linear-gradient(160deg,#0a0c0f,#111318)', borderBottom: '1px solid var(--border)', padding: '32px 24px 28px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#e8c870', letterSpacing: '.15em', marginBottom: 20 }}>AURAN</div>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{meta.icon != null ? meta.icon : <DiamondIcon />}</div>
        <div style={{ fontFamily: 'Noto Serif KR, serif', fontSize: 22, color: '#fff', marginBottom: 8 }}>{meta.label} 초대</div>
        {inviteNote && <div style={{ fontSize: 13, color: meta.color, marginBottom: 6 }}>📩 {inviteNote}</div>}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{meta.desc}</div>
        <div style={{ marginTop: 14, padding: '10px 16px', background: `${meta.color}18`, border: `1px solid ${meta.color}44`, borderRadius: 10, fontSize: 13, color: meta.color, fontWeight: 600 }}>
          {meta.benefit}
        </div>
        {code && (
          <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>
            초대 코드: {code} {inviteValid ? '✓' : '(만료됨)'}
          </div>
        )}
      </div>

      <div style={{ padding: '28px 24px' }}>
        <Link href={`/signup?role=${role}&ref=${code}`}
          style={{ display: 'block', width: '100%', padding: '16px', background: `${meta.color}18`, border: `1px solid ${meta.color}44`, borderRadius: 14, color: meta.color, fontSize: 15, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
          ✅ {meta.label}으로 회원가입
        </Link>
        <Link href={`/login?role=${role}`}
          style={{ display: 'block', width: '100%', padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 14, color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
          이미 계정이 있어요 → 로그인
        </Link>
      </div>
    </div>
  )
}
