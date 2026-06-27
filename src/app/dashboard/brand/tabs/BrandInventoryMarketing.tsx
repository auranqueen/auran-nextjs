'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'
const GOLD = '#C9A96E'
const GREEN = '#4CAF50'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const EVT_TYPES = [
  { key: 'flash',    icon: '⚡', label: '번개 특가',    desc: '24시간 한정 최대 증정' },
  { key: 'lucky',    icon: '⭐', label: '럭키 증정',    desc: '발주 원장님 추첨 서프라이즈' },
  { key: 'welcome',  icon: '💜', label: '웰컴 선물',    desc: '30일 미발주 원장님 귀환' },
  { key: 'feedback', icon: '📝', label: '피드백 리워드', desc: '후기 남기면 증정 — 데이터 확보' },
  { key: 'sample',   icon: '🎁', label: '샘플 배포',    desc: '등급별 무료 발송' },
  { key: 'bundle',   icon: '🎀', label: '번들 구성',    desc: '정상+임박 세트 — 객단가 UP' },
] as const
type EvtKey = typeof EVT_TYPES[number]['key']
const PROMOS = ['10+10 증정', '10+5 증정', '5+5 증정', '5+3 증정', '3+3 증정'] as const
const GRADES = ['전체 원장님', '메디슈티컬', '프리미엄전문점', '전문점', '아레테클럽', '30일 미발주'] as const
interface LotRow {
  id: string
  inventory_id: string
  lot_number: string
  initial_qty: number
  remaining_qty: number
  expires_at: string | null
  status: string
  days: number | null
  product_name: string
}
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandInventoryMarketing({ brandId }: Props) {
  const supabase = createClient()
  const [lots, setLots] = useState<LotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [popup, setPopup] = useState<{ open: boolean; lot: LotRow | null }>({ open: false, lot: null })
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selEvt, setSelEvt] = useState<EvtKey | ''>('')
  const [selPromo, setSelPromo] = useState('10+10 증정')
  const [selGrades, setSelGrades] = useState<string[]>(['전체 원장님'])
  const [deadline, setDeadline] = useState('')
  const [msgText, setMsgText] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'expiry' | 'normal' | 'bundle'>('expiry')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const defaultDeadline = () => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  }
  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const { data: lotData } = await supabase
      .from('brand_inventory_lots')
      .select('id, inventory_id, lot_number, initial_qty, remaining_qty, expires_at, status, brand_inventory(product_name)')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('expires_at', { ascending: true, nullsFirst: false })
    const now = Date.now()
    const mapped: LotRow[] = (lotData || []).map((l: any) => ({
      id: l.id,
      inventory_id: l.inventory_id,
      lot_number: l.lot_number,
      initial_qty: l.initial_qty,
      remaining_qty: l.remaining_qty,
      expires_at: l.expires_at,
      status: l.status,
      days: l.expires_at ? Math.floor((new Date(l.expires_at).getTime() - now) / 86400000) : null,
      product_name: (l.brand_inventory as { product_name?: string })?.product_name || '',
    }))
    setLots(mapped)
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadData() }, [loadData])
  const expiryLots = lots.filter(l => l.days !== null && l.days <= 90)
  const normalLots = lots.filter(l => l.days === null || l.days > 180)
  const cautionLots = lots.filter(l => l.days !== null && l.days > 90 && l.days <= 180)
  const dColor = (days: number | null) => {
    if (days === null) return GREEN
    if (days <= 30) return DANGER
    if (days <= 90) return GOLD
    if (days <= 180) return GOLD
    return GREEN
  }
  const dIcon = (days: number | null) => {
    if (days === null) return '🟢'
    if (days <= 30) return '🔴'
    if (days <= 90) return '🟡'
    if (days <= 180) return '🟡'
    return '🟢'
  }
  const genMsg = (lot: LotRow, evt: EvtKey, promo: string) => {
    const msgs: Record<EvtKey, string> = {
      flash:    `⚡ ${lot.days ? `D-${lot.days} ` : ''}한정!\n\n${lot.product_name} 긴급 특가\n${promo}\n\n잔여 ${lot.remaining_qty}개 · 소진 시 자동 종료\n지금 바로 발주하세요! 💜`,
      lucky:    `⭐ 럭키 이벤트!\n\n이번 주 ${lot.product_name} 발주 원장님 중\n추첨 5명께 서프라이즈 증정!\n\n원장님과 함께 나눕니다 💜`,
      welcome:  `💜 보고 싶었어요!\n\n최근 발주가 없으신 원장님께\n${lot.product_name} 샘플을 선물로 보내드려요.\n\n언제든 다시 함께해요 :)`,
      feedback: `📝 후기 남기고 선물 받으세요!\n\n${lot.product_name} 사용 경험을 알려주시면\n추가 증정해 드립니다.\n\n원장님 의견이 브랜드를 만들어요 💜`,
      sample:   `🎁 무료 샘플 발송 안내\n\n${lot.product_name} 샘플을 발송해 드립니다.\n품질 보장 — 써보시고 알려주세요 💜`,
      bundle:   `🎀 프리미엄 번들 구성!\n\n${lot.product_name} 포함 특별 세트를 구성했어요.\n아레테클럽 전용 구성입니다 💜`,
    }
    return msgs[evt] || ''
  }
  const openPopup = (lot: LotRow) => {
    setPopup({ open: true, lot })
    setStep(1)
    setSelEvt('')
    setSelPromo('10+10 증정')
    setSelGrades(['전체 원장님'])
    setDeadline(defaultDeadline())
    setMsgText('')
  }
  const closePopup = () => setPopup({ open: false, lot: null })
  const selEvent = (key: EvtKey) => {
    setSelEvt(key)
    if (popup.lot) setMsgText(genMsg(popup.lot, key, selPromo))
    setStep(2)
  }
  const handlePromo = (p: string) => {
    setSelPromo(p)
    if (popup.lot && selEvt) setMsgText(genMsg(popup.lot, selEvt as EvtKey, p))
  }
  const toggleGrade = (g: string) => {
    setSelGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    )
  }
  const doSend = async () => {
    if (!popup.lot || !selEvt || !brandId) return
    setSaving(true)
    const { error } = await supabase.from('brand_messages').insert({
      brand_id: brandId,
      message_type: 'auto_order',
      target_type: 'all',
      title: `${EVT_TYPES.find(e => e.key === selEvt)?.icon} ${EVT_TYPES.find(e => e.key === selEvt)?.label} — ${popup.lot.product_name}`,
      body: msgText,
      send_count: 1,
    })
    if (!error) {
      await supabase.from('brand_posts').insert({
        brand_id: brandId,
        title: `[이벤트] ${EVT_TYPES.find(e => e.key === selEvt)?.label} — ${popup.lot.product_name}`,
        body: msgText,
        is_pinned: false,
        author_type: 'brand',
        reply_count: 0,
      })
      setStep(3)
      showToast('이벤트 생성 + 오렌톡 발송 완료!')
    } else {
      showToast('발송 실패: ' + error.message)
    }
    setSaving(false)
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
        {([
          { key: 'expiry', label: '🔴 임박 재고', count: expiryLots.length },
          { key: 'normal', label: '🟢 정상 재고', count: normalLots.length },
          { key: 'bundle', label: '🎀 번들 구성', count: null },
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setViewMode(t.key)}
            style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, border: 'none', background: 'transparent', color: viewMode === t.key ? '#c4a7e7' : SUB, borderBottom: viewMode === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.label}{t.count !== null ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>
      {viewMode === 'expiry' && (
        <div>
          {expiryLots.length === 0 && cautionLots.length === 0 ? (
            <div style={CARD}>
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#4CAF50', fontSize: 14 }}>
                ✅ 임박 재고 없음 · 모든 로트 정상
              </div>
            </div>
          ) : (
            <>
              {expiryLots.length > 0 && (
                <div style={CARD}>
                  <div style={{ fontSize: 12, color: DANGER, marginBottom: 12 }}>🔴 D-90 이내 긴급 처리 필요 ({expiryLots.length}건)</div>
                  {expiryLots.map((lot, i) => (
                    <div key={lot.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < expiryLots.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' as const }}>
                            <span style={{ fontSize: 13, color: TEXT }}>{lot.product_name}</span>
                            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'rgba(41,182,246,0.1)', color: 'rgba(41,182,246,0.8)' }}>{lot.lot_number}</span>
                            <span style={{ fontSize: 11, color: dColor(lot.days), fontWeight: 500 }}>{dIcon(lot.days)} D-{lot.days}</span>
                          </div>
                          <div style={{ fontSize: 11, color: SUB }}>잔여 {lot.remaining_qty.toLocaleString()}개 / 초기 {lot.initial_qty.toLocaleString()}개</div>
                        </div>
                        <button type="button" onClick={() => openPopup(lot)}
                          style={{ fontSize: 12, padding: '7px 12px', borderRadius: 7, border: 'none', background: lot.days !== null && lot.days <= 30 ? DANGER : GOLD, color: '#fff', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                          😊 기분좋게 처리하기
                        </button>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round(lot.remaining_qty / lot.initial_qty * 100)}%`, height: '100%', background: dColor(lot.days), borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cautionLots.length > 0 && (
                <div style={CARD}>
                  <div style={{ fontSize: 12, color: GOLD, marginBottom: 12 }}>🟡 D-90~180 주의 ({cautionLots.length}건)</div>
                  {cautionLots.map((lot, i) => (
                    <div key={lot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < cautionLots.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: 13, color: TEXT }}>{lot.product_name}</span>
                          <span style={{ fontSize: 11, color: GOLD }}>D-{lot.days}</span>
                        </div>
                        <div style={{ fontSize: 11, color: SUB }}>잔여 {lot.remaining_qty.toLocaleString()}개</div>
                      </div>
                      <button type="button" onClick={() => openPopup(lot)}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: `0.5px solid ${GOLD}`, background: 'rgba(201,169,110,0.1)', color: GOLD, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                        😊 기분좋게 처리하기
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {viewMode === 'normal' && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>🟢 정상 재고 시즌 기획 이벤트</div>
          {normalLots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 13 }}>정상 재고 로트가 없어요</div>
          ) : normalLots.map((lot, i) => (
            <div key={lot.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < normalLots.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{lot.product_name}</span>
                  <span style={{ fontSize: 11, color: GREEN }}>{lot.days !== null ? `🟢 D-${lot.days}` : '🟢 기한 없음'}</span>
                </div>
                <div style={{ fontSize: 11, color: SUB }}>잔여 {lot.remaining_qty.toLocaleString()}개</div>
              </div>
              <button type="button" onClick={() => openPopup(lot)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                🎯 이벤트 기획
              </button>
            </div>
          ))}
        </div>
      )}
      {viewMode === 'bundle' && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>🎀 아레테클럽 번들 패키지 구성</div>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 12, lineHeight: 1.6 }}>
            정상 재고 위주로 구성 · 여유 있는 임박 로트(D-90 이상) 선택적 포함 가능
          </div>
          <div style={{ marginBottom: 14 }}>
            {lots.map(lot => {
              const isOk = lot.days === null || lot.days > 90
              const isNearExp = lot.days !== null && lot.days > 30 && lot.days <= 90
              return (
                <div key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  <input type="checkbox" disabled={lot.days !== null && lot.days <= 30}
                    style={{ flexShrink: 0, accentColor: PURPLE, width: 16, height: 16, cursor: isOk || isNearExp ? 'pointer' : 'not-allowed' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 12, color: TEXT }}>{lot.product_name}</span>
                      <span style={{ fontSize: 10, color: dColor(lot.days) }}>{dIcon(lot.days)} {lot.days !== null ? `D-${lot.days}` : '기한없음'}</span>
                      {isNearExp && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(201,169,110,0.1)', color: GOLD }}>선택 가능</span>}
                      {lot.days !== null && lot.days <= 30 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(229,57,53,0.1)', color: DANGER }}>비추천</span>}
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>잔여 {lot.remaining_qty.toLocaleString()}개 · {lot.lot_number}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => showToast('번들 패키지 구성 — 다음 단계 구현 예정')}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer' }}>
            🎀 번들 패키지 이벤트 생성
          </button>
        </div>
      )}
      {popup.open && popup.lot && (
        <div
          onClick={e => { if ((e.target as HTMLElement).id === 'mkt-overlay') closePopup() }}
          id="mkt-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1a1520', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', border: '0.5px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 2 }}>{popup.lot.product_name}</div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {popup.lot.lot_number} · 잔여 {popup.lot.remaining_qty.toLocaleString()}개
                  {popup.lot.days !== null && ` · D-${popup.lot.days}`}
                </div>
              </div>
              <button type="button" onClick={closePopup}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: SUB, lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ background: 'rgba(123,94,167,0.1)', border: '0.5px solid rgba(123,94,167,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#c4a7e7', marginBottom: 14, lineHeight: 1.6 }}>
              쓰린 마음은 잠깐 접어두고 💜<br/>원장님과 케미있게 기분좋게 털어봐요!
            </div>
            {step === 1 && (
              <div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>어떤 이벤트로 처리할까요?</div>
                {EVT_TYPES.map(evt => (
                  <button key={evt.key} type="button" onClick={() => selEvent(evt.key)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', marginBottom: 7, textAlign: 'left' as const }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{evt.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 2 }}>{evt.label}</div>
                      <div style={{ fontSize: 11, color: SUB }}>{evt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && selEvt && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => setStep(1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: SUB, fontSize: 13, padding: 0 }}>← 뒤로</button>
                  <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                    {EVT_TYPES.find(e => e.key === selEvt)?.icon} {EVT_TYPES.find(e => e.key === selEvt)?.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>프로모션 설정</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 12 }}>
                  {PROMOS.map(p => (
                    <button key={p} type="button" onClick={() => handlePromo(p)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${selPromo === p ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: selPromo === p ? 'rgba(123,94,167,0.2)' : 'transparent', color: selPromo === p ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                      {p}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>발송 대상</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 12 }}>
                  {GRADES.map(g => (
                    <button key={g} type="button" onClick={() => toggleGrade(g)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${selGrades.includes(g) ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: selGrades.includes(g) ? 'rgba(123,94,167,0.2)' : 'transparent', color: selGrades.includes(g) ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                      {g}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>이벤트 마감일</div>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 12 }} />
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>오렌톡 메시지 (수정 가능)</div>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={5}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', resize: 'none', marginBottom: 12, lineHeight: 1.7 }} />
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, fontSize: 11, color: SUB, marginBottom: 12, lineHeight: 1.7 }}>
                  brand_messages INSERT + brand_posts 커뮤니티 공지 자동 등록<br/>
                  소진 현황은 재고현황 탭에서 실시간 확인
                </div>
                <button type="button" onClick={() => void doSend()} disabled={saving}
                  style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                  {saving ? '발송 중...' : '😊 기분좋게 이벤트 생성 + 오렌톡 발송!'}
                </button>
              </div>
            )}
            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>😊</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 6 }}>
                  기분좋게 완료! 💜
                </div>
                <div style={{ fontSize: 12, color: SUB, lineHeight: 1.9, marginBottom: 16 }}>
                  {popup.lot?.product_name} · {EVT_TYPES.find(e => e.key === selEvt)?.label}<br/>
                  마감일: {deadline}
                </div>
                <div style={{ background: 'rgba(76,175,80,0.08)', border: '0.5px solid rgba(76,175,80,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#4CAF50', lineHeight: 1.9, textAlign: 'left' as const, marginBottom: 16 }}>
                  ✅ 오렌톡 자동 발송됨<br/>
                  ✅ 커뮤니티 공지 등록됨<br/>
                  ✅ 소진 현황 실시간 연동
                </div>
                <div style={{ fontSize: 12, color: '#c4a7e7', marginBottom: 16 }}>
                  쓰린 마음이 기분좋게 바뀌는 중... 💜
                </div>
                <button type="button" onClick={closePopup}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 13, cursor: 'pointer' }}>
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
