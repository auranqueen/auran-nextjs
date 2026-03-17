'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import NoticeBell from '@/components/NoticeBell'

export default function BrandDashClient({ profile, brand, products }: { profile: any; brand: any; products: any[] }) {
  const router = useRouter()
  const supabase = createClient()
  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const isActive = brand?.status === 'active'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(160deg,#0a180a,#0d1a0d)', borderBottom: '1px solid rgba(76,173,126,0.18)', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(76,173,126,0.5)', letterSpacing: '0.2em', marginBottom: 4 }}>BRAND DASHBOARD</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: '#fff' }}>{brand?.name || profile.brand_name || profile.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{brand?.origin || profile.brand_origin || '-'} · {profile.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 9, padding: '3px 10px', background: isActive ? 'rgba(76,173,126,0.15)' : 'rgba(201,168,76,0.12)', color: isActive ? '#4cad7e' : 'var(--gold)', border: `1px solid ${isActive ? 'rgba(76,173,126,0.3)' : 'rgba(201,168,76,0.3)'}`, borderRadius: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{isActive ? '입점 활성' : '심사 중'}</span>
            <NoticeBell />
            <button onClick={logout} style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>로그아웃</button>
          </div>
        </div>

        {isActive && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[{ l: '이달 판매', v: '₩0', c: 'var(--gold)' }, { l: '등록 제품', v: `${products.length}종`, c: '#4cad7e' }].map(s => (
              <div key={s.l} style={{ background: 'rgba(76,173,126,0.08)', border: '1px solid rgba(76,173,126,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '18px 18px 80px' }}>
        {!brand ? (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>입점 신청하기</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 20 }}>AI 매칭·살롱 유통·플랫폼 판매는<br />본사가 전담합니다</div>
            <button style={{ width: '100%', padding: '15px', background: 'rgba(76,173,126,0.15)', border: '1px solid rgba(76,173,126,0.4)', borderRadius: 12, color: '#4cad7e', fontSize: 15, fontWeight: 700 }}>🏭 입점 신청하기 →</button>
          </div>
        ) : (
          <div>
            {/* 관리 메뉴 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
              {[
                { icon: '📦', label: '제품 관리', tc: '#4cad7e', color: 'rgba(76,173,126,0.1)', border: 'rgba(76,173,126,0.3)' },
                { icon: '📢', label: '공지 발송', tc: '#4a8dc0', color: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)' },
                { icon: '🎁', label: '납품 프로모션', tc: 'var(--gold)', color: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.3)' },
                { icon: '📊', label: '매출 리포트', tc: '#f0a050', color: 'rgba(240,160,80,0.08)', border: 'rgba(240,160,80,0.25)' },
              ].map(m => (
                <button key={m.label} style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '13px 12px', textAlign: 'left' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: m.tc }}>{m.label}</div>
                </button>
              ))}
            </div>

            {/* 등록 제품 */}
            {products.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📦 등록 제품</div>
                {products.map(p => (
                  <div key={p.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>소비자가 ₩{p.retail_price?.toLocaleString()}</div>
                    </div>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 7, background: p.status === 'active' ? 'rgba(76,173,126,0.12)' : 'rgba(201,168,76,0.1)', color: p.status === 'active' ? '#4cad7e' : 'var(--gold)', border: `1px solid ${p.status === 'active' ? 'rgba(76,173,126,0.3)' : 'rgba(201,168,76,0.3)'}` }}>{p.status === 'active' ? '판매중' : '심사중'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
