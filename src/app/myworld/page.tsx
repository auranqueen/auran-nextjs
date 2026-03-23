'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ImpactToast from '@/components/impact/ImpactToast'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export default function MyWorldPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userName, setUserName] = useState('유미')
  const [userAge, setUserAge] = useState(42)
  const [activeTab, setActiveTab] = useState<'history' | 'routine' | 'toast' | 'diary' | 'guest'>('history')
  const [skinData, setSkinData] = useState<any[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [showBdayPopup, setShowBdayPopup] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name = data.user.user_metadata?.full_name || data.user.user_metadata?.name
        if (name) setUserName(name)
        // 생일 확인
        const birth = data.user.user_metadata?.birth_date
        if (birth) {
          const today = new Date()
          const bday = new Date(birth)
          if (today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()) {
            setShowBdayPopup(true)
          }
          const age = today.getFullYear() - bday.getFullYear()
          setUserAge(age)
        }
      }
    })
    // TODO: skin_analyses 테이블에서 히스토리 조회
    supabase.from('skin_analyses').select('*').order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      if (data) setSkinData(data)
    })
  }, [])

  const timelineData = [
    { date: '2026.03.22', tag: '오늘', tagColor: GOLD, scores: [{ name: '수분', val: 62, color: '#6ab0e0' }, { name: '탄력', val: 72, color: GOLD }, { name: '민감', val: 85, color: '#e07060' }], compare: '작년 이날보다 수분 +15%, 탄력 +8% 개선!', compareColor: '#4CAF50', isToday: true },
    { date: '2026.02.14', tag: '💉 레이저 시술', tagColor: 'rgba(220,100,80,0.9)', scores: [], compare: '시술 후 민감도 급상승 → 진정 루틴 전환', compareColor: 'rgba(220,120,100,0.9)', isEvent: true, product: { icon: '🌿', name: '칼라민 진정 크림' } },
    { date: '2026.01.15', tag: '🎂 43세 루틴 추가', tagColor: 'rgba(180,120,240,0.9)', scores: [], compare: '항산화 루틴 추가 · 비타민C 세럼, 레티놀 크림 시작', compareColor: 'rgba(180,120,240,0.9)', isBday: true },
    { date: '2025.03.22', tag: '1년 전 오늘', tagColor: TEXT_DIM, scores: [{ name: '수분', val: 47, color: '#6ab0e0' }, { name: '탄력', val: 64, color: GOLD }, { name: '민감', val: 72, color: '#e07060' }], compare: '지금과 비교 → 수분 +15%, 탄력 +8% 성장', compareColor: '#4CAF50' },
  ]

  const ageRoutines = [
    { age: 40, status: 'past', title: '보습 집중 루틴 시작', items: ['세럼', '수분크림', '선크림'], done: true },
    { age: 42, status: 'past', title: '탄력 루틴 추가', items: ['탄력 앰플', '아이크림', '페이셜 마사지'], done: true },
    { age: 43, status: 'current', title: '항산화 루틴 추가', items: ['비타민C ✓', '레티놀 크림 ●', '나이아신아마이드 +'] },
    { age: 45, status: 'future', title: '딥 리페어 루틴 (예정)', items: ['펩타이드', '성장인자', 'EGF'] },
  ]

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '96px', position: 'relative' }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(160deg,#1a0a2a,#2a1040,#1a0a30)', padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '2px solid rgba(201,169,110,0.4)' }}>👩</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 400, marginBottom: '2px' }}>{userName}님의 WORLD</div>
            <div style={{ fontSize: '10px', color: 'rgba(201,169,110,0.7)', fontFamily: 'monospace' }}>만 {userAge}세 · 건성·민감 복합</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => router.push('/my')} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', cursor: 'pointer' }}>👤</button>
            <button style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', cursor: 'pointer' }}>⚙️</button>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { key: 'history', label: '히스토리' },
            { key: 'routine', label: '루틴' },
            { key: 'toast', label: '토스트지갑' },
            { key: 'diary', label: '피부일기' },
            { key: 'guest', label: '방명록' },
          ] as const).map((tab) => (
            <div key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: '11px', fontWeight: activeTab === tab.key ? 400 : 300, color: activeTab === tab.key ? GOLD : TEXT_MUTED, borderBottom: activeTab === tab.key ? `2px solid ${GOLD}` : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}>
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* 히스토리 탭 */}
      {activeTab === 'history' && (
        <div>
          {/* 오늘 피부 카드 */}
          <div style={{ margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', color: TEXT_MUTED }}>TODAY&apos;S SKIN</span>
              <span style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace' }}>2026.03.22</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
              {[{ name: '수분', val: 62, color: '#6ab0e0' }, { name: '탄력', val: 72, color: GOLD }, { name: '민감', val: 85, color: '#e07060' }].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 400 }}>{s.val}<span style={{ fontSize: '9px', fontWeight: 300, color: TEXT_DIM }}>%</span></div>
                  <div style={{ fontSize: '9px', color: TEXT_MUTED }}>{s.name}</div>
                  <div style={{ height: '2px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', marginTop: '3px' }}>
                    <div style={{ height: '100%', width: `${s.val}%`, background: s.color, borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '9px', color: TEXT_DIM }}>1년 전 대비</span>
              <span style={{ fontSize: '11px', color: '#4CAF50' }}>수분 +15% · 탄력 +8% ↑</span>
              <span onClick={() => router.push('/skin-analysis')} style={{ fontSize: '9px', color: GOLD, marginLeft: 'auto', cursor: 'pointer' }}>분석하기 ›</span>
            </div>
          </div>

          {/* 공개 설정 */}
          <div style={{ margin: '10px 16px 0', padding: '9px 12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>👥</span>
            <div style={{ flex: 1, fontSize: '10px', color: TEXT_MUTED }}>히스토리 일촌 공개 중</div>
            <div onClick={() => setIsPublic(!isPublic)} style={{ width: '36px', height: '20px', borderRadius: '10px', background: isPublic ? GOLD : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: '3px', right: isPublic ? '3px' : 'auto', left: isPublic ? 'auto' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff' }} />
            </div>
          </div>

          {/* 타임라인 */}
          <div style={{ padding: '14px 16px 0' }}>
            <div style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px', marginBottom: '14px' }}>SKIN TIMELINE</div>

            {/* 2026 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 400 }}>2026</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {timelineData.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: `2px solid ${item.isToday ? GOLD : item.isBday ? '#a060e0' : item.isEvent ? '#e07060' : 'rgba(255,255,255,0.2)'}`, background: item.isToday ? GOLD : 'transparent', flexShrink: 0 }} />
                  <div style={{ fontSize: '8px', color: TEXT_DIM, fontFamily: 'monospace', marginTop: '3px', textAlign: 'center', lineHeight: 1.3 }}>{item.date.slice(5)}</div>
                  {i < timelineData.length - 1 && <div style={{ flex: 1, width: '1px', background: 'rgba(255,255,255,0.06)', marginTop: '4px' }} />}
                </div>
                <div style={{ flex: 1, background: item.isToday ? 'rgba(201,169,110,0.04)' : item.isBday ? 'rgba(160,96,224,0.05)' : item.isEvent ? 'rgba(220,100,80,0.04)' : CARD_BG, border: `1px solid ${item.isToday ? 'rgba(201,169,110,0.25)' : item.isBday ? 'rgba(160,96,224,0.25)' : item.isEvent ? 'rgba(220,100,80,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '2px' }}>
                  <div style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '4px', fontSize: '9px', marginBottom: '4px', background: item.isToday ? 'rgba(201,169,110,0.15)' : item.isBday ? 'rgba(160,96,224,0.12)' : item.isEvent ? 'rgba(220,100,80,0.12)' : 'rgba(255,255,255,0.05)', color: item.tagColor }}>{item.tag}</div>
                  {item.scores.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', marginBottom: '5px' }}>
                      {item.scores.map((s, si) => (
                        <div key={si} style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '9px', fontFamily: 'monospace', background: `${s.color}18`, color: s.color }}>
                          {s.name} {s.val}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', lineHeight: 1.6, color: TEXT_MUTED }}>
                    <em style={{ color: item.compareColor, fontStyle: 'normal' }}>{item.compare}</em>
                  </div>
                  {item.product && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer' }}>
                      <span style={{ fontSize: '14px' }}>{item.product.icon}</span>
                      <span style={{ fontSize: '9px', color: TEXT_MUTED, flex: 1 }}>{item.product.name}</span>
                      <span style={{ fontSize: '9px', color: GOLD }}>재구매 ›</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 1년 히트맵 */}
          <div style={{ margin: '10px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', color: TEXT_MUTED, fontFamily: 'monospace', letterSpacing: '1px' }}>수분도 1년 히트맵</span>
              <span style={{ fontSize: '10px', color: '#4CAF50' }}>+15% ↑</span>
            </div>
            <div style={{ display: 'flex', gap: '3px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {Array.from({ length: 52 }, (_, w) => (
                <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {Array.from({ length: 3 }, (_, d) => {
                    const intensity = Math.max(0.05, Math.min(1, (w / 52) * 0.8 + Math.random() * 0.2))
                    const isToday = w === 51 && d === 0
                    return (
                      <div key={d} style={{ width: '10px', height: '10px', borderRadius: '2px', background: `rgba(106,176,224,${isToday ? 1 : intensity})`, border: isToday ? `1px solid ${GOLD}` : 'none' }} />
                    )
                  })}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '8px', color: TEXT_DIM }}>낮음</span>
              {[0.15, 0.35, 0.6, 1].map((o, i) => <div key={i} style={{ width: '10px', height: '10px', borderRadius: '2px', background: `rgba(106,176,224,${o})` }} />)}
              <span style={{ fontSize: '8px', color: TEXT_DIM }}>높음</span>
            </div>
          </div>
        </div>
      )}

      {/* 루틴 탭 */}
      {activeTab === 'routine' && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px', marginBottom: '14px' }}>AGE ROUTINE HISTORY</div>
          {ageRoutines.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontFamily: 'monospace', fontWeight: 400, flexShrink: 0, background: r.status === 'current' ? GOLD : r.status === 'past' ? 'rgba(201,169,110,0.1)' : 'rgba(255,255,255,0.03)', border: r.status === 'past' ? '1px solid rgba(201,169,110,0.2)' : r.status === 'future' ? '1.5px dashed rgba(255,255,255,0.1)' : 'none', color: r.status === 'current' ? BG : r.status === 'past' ? 'rgba(201,169,110,0.7)' : TEXT_DIM }}>
                {r.age}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 400, color: r.status === 'future' ? TEXT_DIM : '#fff', marginBottom: '5px' }}>
                  {r.title}
                  {r.status === 'current' && <span style={{ fontSize: '9px', background: 'rgba(201,169,110,0.15)', color: GOLD, padding: '1px 6px', borderRadius: '4px', marginLeft: '6px' }}>진행중</span>}
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {r.items.map((item, ii) => (
                    <div key={ii} style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '9px', background: r.status === 'past' ? 'rgba(74,200,120,0.1)' : r.status === 'current' ? (item.includes('✓') ? 'rgba(74,200,120,0.1)' : item.includes('●') ? 'rgba(201,169,110,0.12)' : 'rgba(160,96,224,0.1)') : 'rgba(255,255,255,0.03)', color: r.status === 'past' ? 'rgba(100,220,140,0.8)' : r.status === 'current' ? (item.includes('✓') ? 'rgba(100,220,140,0.8)' : item.includes('●') ? GOLD : 'rgba(180,120,240,0.9)') : TEXT_DIM, border: r.status === 'current' && !item.includes('✓') ? `1px solid ${item.includes('●') ? 'rgba(201,169,110,0.3)' : 'rgba(160,96,224,0.25)'}` : 'none' }}>
                      {item}
                    </div>
                  ))}
                </div>
                {r.status === 'current' && (
                  <div onClick={() => {}} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '7px', padding: '4px 10px', background: GOLD, borderRadius: '8px', fontSize: '10px', color: BG, cursor: 'pointer' }}>
                    + 루틴 추가하기
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 43세 나이별 루틴 추천 제품 */}
          <div style={{ marginTop: '8px', background: 'rgba(160,96,224,0.06)', border: '1px solid rgba(160,96,224,0.15)', borderRadius: '14px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>🎂</span>
              <span style={{ fontSize: '12px', color: '#fff', flex: 1 }}>43세 이달의 루틴 추천</span>
              <span style={{ fontSize: '11px', color: 'rgba(180,120,240,0.9)', fontFamily: 'monospace' }}>43세</span>
            </div>
            <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.7, marginBottom: '10px' }}>
              항산화 루틴이 아직 완성되지 않았어요.
              <em style={{ color: 'rgba(180,120,240,0.9)', fontStyle: 'normal' }}> 레티놀 크림</em>과
              <em style={{ color: GOLD, fontStyle: 'normal' }}> 나이아신아마이드 세럼</em>을 추가하면 피부 재생 속도가 빨라져요.
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { icon: '🌙', brand: 'GERNETIC', name: '레티놀 나이트 크림', price: 92000 },
                { icon: '💊', brand: 'CIVASAN', name: '나이아신아마이드 세럼', price: 74000 },
                { icon: '✨', brand: 'SHOPBELLE', name: '콜라겐 부스터', price: 76000 },
              ].map((p, i) => (
                <div key={i} onClick={() => router.push('/products')} style={{ minWidth: '85px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(160,96,224,0.15)', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                  <div style={{ height: '56px', background: 'linear-gradient(135deg,#1a1020,#2a1830)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{p.icon}</div>
                  <div style={{ padding: '6px 7px' }}>
                    <div style={{ fontSize: '7px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '1px' }}>{p.brand}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.65)', marginBottom: '2px', lineHeight: 1.4 }}>{p.name}</div>
                    <div style={{ fontSize: '10px', fontWeight: 400 }}>{p.price.toLocaleString()}원</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <div onClick={() => router.push('/products')} style={{ flex: 2, padding: '9px', background: 'linear-gradient(90deg,rgba(160,96,224,0.3),rgba(120,60,200,0.3))', border: '1px solid rgba(160,96,224,0.3)', borderRadius: '10px', fontSize: '11px', color: 'rgba(180,120,240,0.9)', textAlign: 'center', cursor: 'pointer' }}>🛒 이달의 루틴 제품 담기</div>
              <div style={{ flex: 1, padding: '9px', background: CARD_BG, border: CARD_BORDER, borderRadius: '10px', fontSize: '11px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>다음달</div>
            </div>
          </div>
        </div>
      )}

      {/* 피부일기 탭 */}
      {activeTab === 'toast' && <ImpactToast />}

      {/* 피부일기 탭 */}
      {activeTab === 'diary' && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px' }}>SKIN DIARY</div>
            <div style={{ padding: '5px 12px', background: GOLD, borderRadius: '8px', fontSize: '10px', color: BG, cursor: 'pointer' }}>+ 오늘 기록</div>
          </div>
          {/* TODO: skin_diary 테이블 연동 */}
          {[
            { date: '03.22', emoji: '😊', mood: '좋음', text: '오늘 피부가 촉촉해서 기분 좋았어요. 메쓰크림 덕분인 것 같아요!', tags: ['수분UP', '좋은날'] },
            { date: '03.20', emoji: '😐', mood: '보통', text: '환절기라 약간 당기는 느낌. 추가 수분 케어 필요할 것 같아요.', tags: ['환절기', '건조'] },
          ].map((d, i) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>{d.emoji}</span>
                <div>
                  <div style={{ fontSize: '10px', color: TEXT_DIM, fontFamily: 'monospace' }}>{d.date}</div>
                  <div style={{ fontSize: '11px', color: GOLD }}>{d.mood}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '8px' }}>{d.text}</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {d.tags.map((tag, ti) => (
                  <div key={ti} style={{ padding: '2px 8px', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '20px', fontSize: '9px', color: 'rgba(201,169,110,0.7)' }}>#{tag}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 방명록 탭 */}
      {activeTab === 'guest' && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px', marginBottom: '12px' }}>GUESTBOOK</div>
          {/* TODO: guestbook 테이블 연동 */}
          {[
            { avatar: '🌸', name: '소미님', text: '언니 피부 완전 좋아졌어요! 비결이 뭐예요? 😍', date: '3분 전' },
            { avatar: '🌺', name: '지연님', text: '메쓰크림 추천해줘서 고마워요! 저도 주문했어요', date: '1시간 전' },
            { avatar: '💜', name: '수아님', text: '피부 히스토리 보니까 진짜 많이 좋아졌네요 👍', date: '어제' },
          ].map((g, i) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{g.avatar}</div>
                <div style={{ flex: 1, fontSize: '11px', fontWeight: 400 }}>{g.name}</div>
                <span style={{ fontSize: '9px', color: TEXT_DIM }}>{g.date}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{g.text}</div>
            </div>
          ))}
          <div style={{ padding: '10px 12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: '12px', color: TEXT_DIM }}>방명록 남기기...</div>
            <div style={{ padding: '5px 12px', background: GOLD, borderRadius: '8px', fontSize: '10px', color: BG, cursor: 'pointer' }}>등록</div>
          </div>
        </div>
      )}

      {/* 생일 팝업 */}
      {showBdayPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '390px', margin: '0 auto', background: BG, borderRadius: '24px 24px 0 0', borderTop: CARD_BORDER, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,#1a0a2a,#2a1040)', padding: '24px 20px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎂</div>
              <div style={{ fontSize: '22px', fontWeight: 400, marginBottom: '4px' }}>생일 축하해요, {userName}님!</div>
              <div style={{ fontSize: '12px', color: TEXT_MUTED, lineHeight: 1.6 }}>어느새 {userAge}세가 되셨네요 🥰</div>
              <div style={{ display: 'inline-block', marginTop: '8px', padding: '4px 16px', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.35)', borderRadius: '20px', fontSize: '12px', color: GOLD, fontFamily: 'monospace' }}>{userAge}세 · 새 루틴 추천 도착</div>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: '10px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px', marginBottom: '10px' }}>{userAge}세부터 추가하면 좋은 루틴</div>
              <div style={{ background: 'rgba(160,96,224,0.07)', border: '1px solid rgba(160,96,224,0.2)', borderRadius: '14px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', color: '#fff', marginBottom: '6px' }}>✨ 항산화 + 재생 루틴</div>
                <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.7, marginBottom: '10px' }}>이 시기부터 피부 세포 재생 속도가 약 20% 느려져요. 항산화 성분과 저농도 레티놀로 재생을 도와주면 좋아요.</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ icon: '💊', name: '비타민C 앰플', price: '68,000원' }, { icon: '🌙', name: '레티놀 나이트 크림', price: '92,000원' }].map((p, i) => (
                    <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(160,96,224,0.15)', borderRadius: '10px', padding: '8px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: '22px', marginBottom: '4px' }}>{p.icon}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.65)', marginBottom: '2px' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', fontWeight: 400 }}>{p.price}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div onClick={() => setShowBdayPopup(false)} style={{ flex: 1, padding: '12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', fontSize: '12px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>나중에</div>
                <div onClick={() => { setShowBdayPopup(false); router.push('/products') }} style={{ flex: 2, padding: '12px', background: GOLD, borderRadius: '12px', fontSize: '13px', color: BG, textAlign: 'center', cursor: 'pointer', fontWeight: 400 }}>🛒 루틴 제품 담기</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 하단 네비 */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '390px', height: '80px', background: 'rgba(13,11,9,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px 16px', zIndex: 50 }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🏠</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>HOME</span>
        </div>
        <div onClick={() => router.push('/products')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🛍</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>SHOP</span>
        </div>
        <div onClick={() => router.push('/skin-analysis')} style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'linear-gradient(135deg,#C9A96E,#E8C88A)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: '0 4px 24px rgba(201,169,110,0.5)', marginTop: '-22px', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: '22px' }}>🔬</span>
          <span style={{ fontSize: '8px', fontWeight: 400, color: BG, fontFamily: 'monospace' }}>AI</span>
        </div>
        <div onClick={() => router.push('/salon')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>📅</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>BOOK</span>
        </div>
        <div onClick={() => router.push('/my')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>👤</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>MY</span>
        </div>
      </nav>

    </div>
  )
}
