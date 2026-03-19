'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import NoticeBell from '@/components/NoticeBell'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import Link from 'next/link'

export default function BrandDashClient({ profile, brand, products }: { profile: any; brand: any; products: any[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [savingStory, setSavingStory] = useState(false)
  const [storyTitle, setStoryTitle] = useState<string>(brand?.story_title || '')
  const [storyBody, setStoryBody] = useState<string>(brand?.story_body || '')
  const [storyImageUrl, setStoryImageUrl] = useState<string>(brand?.story_image_url || '')
  const [promoEnabled, setPromoEnabled] = useState<boolean>(!!brand?.promo_enabled)
  const [promoTitle, setPromoTitle] = useState<string>(brand?.promo_title || '')
  const [promoBody, setPromoBody] = useState<string>(brand?.promo_body || '')
  const [promoImageUrl, setPromoImageUrl] = useState<string>(brand?.promo_image_url || '')
  const [promoLinkUrl, setPromoLinkUrl] = useState<string>(brand?.promo_link_url || '')
  const [saveError, setSaveError] = useState<string>('')
  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const isActive = brand?.status === 'active'

  const promoNowActive = useMemo(() => {
    if (!promoEnabled) return false
    const s = brand?.promo_starts_at ? new Date(brand.promo_starts_at).getTime() : null
    const e = brand?.promo_ends_at ? new Date(brand.promo_ends_at).getTime() : null
    const now = Date.now()
    if (s && now < s) return false
    if (e && now > e) return false
    return true
  }, [brand?.promo_starts_at, brand?.promo_ends_at, promoEnabled])

  async function applyBrand() {
    setApplying(true)
    setApplyError('')
    try {
      const payload: any = {
        user_id: profile.id,
        name: profile.brand_name || profile.name || '브랜드',
        origin: profile.brand_origin || null,
        status: 'pending',
      }
      const { error } = await supabase.from('brands').insert(payload)
      if (error) throw error
      alert('✅ 입점 신청이 접수되었습니다. 승인까지 잠시만 기다려주세요.')
      router.refresh()
    } catch (e: any) {
      setApplyError(e?.message || '입점 신청 중 오류가 발생했습니다.')
    } finally {
      setApplying(false)
    }
  }

  async function saveBrandStoryAndPromo() {
    if (!brand?.id) return
    setSavingStory(true)
    setSaveError('')
    try {
      const payload: any = {
        story_title: storyTitle || null,
        story_body: storyBody || null,
        story_image_url: storyImageUrl || null,
        promo_enabled: !!promoEnabled,
        promo_title: promoTitle || null,
        promo_body: promoBody || null,
        promo_image_url: promoImageUrl || null,
        promo_link_url: promoLinkUrl || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('brands').update(payload).eq('id', brand.id)
      if (error) throw error
      alert('✅ 브랜드 스토리/프로모션이 저장되었습니다.')
      router.refresh()
    } catch (e: any) {
      setSaveError(e?.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSavingStory(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
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

      <div style={{ padding: '18px 18px 0' }}>
        {!brand ? (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>입점 신청하기</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 20 }}>AI 매칭·살롱 유통·플랫폼 판매는<br />본사가 전담합니다</div>
            <button
              onClick={applyBrand}
              disabled={applying}
              style={{ width: '100%', padding: '15px', background: 'rgba(76,173,126,0.15)', border: '1px solid rgba(76,173,126,0.4)', borderRadius: 12, color: '#4cad7e', fontSize: 15, fontWeight: 700, opacity: applying ? 0.7 : 1 }}
            >
              {applying ? '접수 중...' : '🏭 입점 신청하기 →'}
            </button>
            {applyError && <div style={{ marginTop: 10, fontSize: 12, color: '#e08080' }}>{applyError}</div>}
          </div>
        ) : (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>✨ 브랜드 스토리/프로모션</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 12 }}>
                고객이 <span style={{ color: 'var(--gold)', fontWeight: 800 }}>제품추천</span>에서 브랜드 버튼을 눌렀을 때 상단에 표시됩니다.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>브랜드 스토리 제목</div>
                  <input value={storyTitle} onChange={e => setStoryTitle(e.target.value)} placeholder="예: 피부관리실이 선택한 이유" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>브랜드 스토리 내용</div>
                  <textarea value={storyBody} onChange={e => setStoryBody(e.target.value)} placeholder="브랜드 철학, 핵심 성분/기술, 대표 라인업, AURAN 입점 이유 등을 작성해 주세요." rows={6} style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12, resize: 'vertical' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>스토리 이미지 URL (선택)</div>
                  <input value={storyImageUrl} onChange={e => setStoryImageUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                </div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: '#fff', fontWeight: 800 }}>
                  <input type="checkbox" checked={promoEnabled} onChange={e => setPromoEnabled(e.target.checked)} />
                  프로모션 게시하기 {promoNowActive ? <span style={{ fontSize: 10, color: '#4cad7e', fontWeight: 800 }}>(노출 중)</span> : null}
                </label>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>프로모션 제목</div>
                  <input value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="예: 신규 입점 기념 혜택" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>프로모션 내용</div>
                  <textarea value={promoBody} onChange={e => setPromoBody(e.target.value)} placeholder="혜택/기간/대상 등을 작성해 주세요." rows={4} style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12, resize: 'vertical' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>프로모션 이미지 URL (선택)</div>
                  <input value={promoImageUrl} onChange={e => setPromoImageUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }}>프로모션 링크 URL (선택)</div>
                  <input value={promoLinkUrl} onChange={e => setPromoLinkUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                </div>

                <button
                  onClick={saveBrandStoryAndPromo}
                  disabled={savingStory}
                  style={{
                    width: '100%',
                    padding: '13px 12px',
                    background: 'rgba(201,168,76,0.14)',
                    border: '1px solid rgba(201,168,76,0.35)',
                    borderRadius: 12,
                    color: 'var(--gold)',
                    fontSize: 13,
                    fontWeight: 900,
                    opacity: savingStory ? 0.7 : 1,
                  }}
                >
                  {savingStory ? '저장 중...' : '저장 / 게시하기'}
                </button>
                {saveError && <div style={{ fontSize: 12, color: '#e08080' }}>{saveError}</div>}
              </div>
            </div>

            {/* 관리 메뉴 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
              {[
                { icon: '📦', label: '제품 등록', tc: '#4cad7e', color: 'rgba(76,173,126,0.1)', border: 'rgba(76,173,126,0.3)', href: '/dashboard/brand/products/new' },
                { icon: '📢', label: '공지 발송', tc: '#4a8dc0', color: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)' },
                { icon: '🎁', label: '납품 프로모션', tc: 'var(--gold)', color: 'rgba(201,168,76,0.1)', border: 'rgba(201,168,76,0.3)' },
                { icon: '📊', label: '매출 리포트', tc: '#f0a050', color: 'rgba(240,160,80,0.08)', border: 'rgba(240,160,80,0.25)' },
              ].map(m => (
                m.href ? (
                  <Link key={m.label} href={m.href} style={{ textDecoration: 'none' }}>
                    <div style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '13px 12px', textAlign: 'left' }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: m.tc }}>{m.label}</div>
                    </div>
                  </Link>
                ) : (
                  <button key={m.label} style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '13px 12px', textAlign: 'left' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.tc }}>{m.label}</div>
                  </button>
                )
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
      <DashboardBottomNav role="brand" />
    </div>
  )
}
