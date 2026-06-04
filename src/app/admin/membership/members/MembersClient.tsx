'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  purple: '#7B5EA7', purpleSoft: '#F1ECF8', goldDark: '#A07F4A', goldSoft: '#F6EFE3',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5',
  line: 'rgba(123,94,167,0.15)', green: '#5B8A6B', greenSoft: '#EAF3EC', gold: '#C9A96E',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"
const PHASES = ['달빛기', '황금기', '만개기', '물들기']

type Membership = {
  id: string; user_id: string; status: string; shipments_total: number; shipments_remaining: number
  next_shipment_date: string | null; source_type?: string | null
  users: { name: string } | null; membership_plans: { name: string } | null
}
type Tpl = {
  id: string; theme_name: string; target_phase: string | null
  product_ids: string[]; usage_guide: string | null; owner_tip: string | null
  is_active: boolean; display_order: number; target_gender?: string | null
}
type Plan = { id: string; name: string; price: number }
type ProductInfo = { id: string; name: string; description: string | null; key_ingredients: string | null }
type Scored = { id: string; name: string; retail_price: number | null; _score: number; _reasons: string[] }

export default function MembersClient({
  memberships: initial, templates: initialTpls, plans, productMap, genderMap = {},
}: {
  memberships: Membership[]; templates: Tpl[]; plans: Plan[]; productMap: Record<string, ProductInfo>; genderMap?: Record<string, string>
}) {
  const supabase = createClient()
  const [memberships, setMemberships] = useState<Membership[]>(initial)
  const [templates, setTemplates] = useState<Tpl[]>(initialTpls)
  const [openId, setOpenId] = useState<string | null>(null)
  const [shipDates, setShipDates] = useState<Record<string, string>>({})
  const [deliveryTypes, setDeliveryTypes] = useState<Record<string, string>>({})
  const [couriers, setCouriers] = useState<Record<string, string>>({})
  const [trackingNos, setTrackingNos] = useState<Record<string, string>>({})
  const [quickCompanies, setQuickCompanies] = useState<Record<string, string>>({})
  const [tplId, setTplId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ theme: string; phase: string | null; products: Scored[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // 템플릿 관리
  const [showTplPanel, setShowTplPanel] = useState(false)
  const [editTpl, setEditTpl] = useState<Tpl | null>(null)
  const [tplSearch, setTplSearch] = useState('')
  const [tplSearchResults, setTplSearchResults] = useState<{ id: string; name: string }[]>([])
  const [savingTpl, setSavingTpl] = useState(false)
  const [tplMsg, setTplMsg] = useState('')

  // 수동 등록
  const [showManual, setShowManual] = useState(false)
  const [mSearch, setMSearch] = useState('')
  const [mUsers, setMUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [mUserId, setMUserId] = useState('')
  const [mUserName, setMUserName] = useState('')
  const [mPlanId, setMPlanId] = useState('')
  const [mShipments, setMShipments] = useState(6)
  const [mDate, setMDate] = useState('')
  const [mMemo, setMMemo] = useState('')
  const [mBusy, setMBusy] = useState(false)
  const [mMsg, setMMsg] = useState('')

  const open = (id: string) => { setOpenId(openId === id ? null : id); setTplId(null); setPreview(null); setMsg(null) }

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, cursor: 'pointer', color: active ? '#fff' : C.muted,
    background: active ? C.purple : '#fff', border: active ? 'none' : `0.5px solid rgba(123,94,167,0.22)`,
    borderRadius: 17, padding: '6px 13px', fontFamily: 'inherit',
  })

  // 큐레이션
  const call = async (mId: string, action: 'preview' | 'ship') => {
    if (!tplId) { setMsg('리추얼을 먼저 선택하세요'); return }
    if (action === 'ship' && !confirm('이 리추얼을 발송 처리할까요?')) return
    setBusy(true); setMsg(null)
    const res = await fetch('/api/admin/membership/curate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_membership_id: mId, bundle_template_id: tplId, action, ship_date: shipDates[mId] || undefined, delivery_type: deliveryTypes[mId] || 'courier', courier: couriers[mId] || 'CJ대한통운', tracking_no: trackingNos[mId] || undefined, quick_company: quickCompanies[mId] || undefined }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!json.ok) { setMsg(json.error || '실패했어요'); return }
    if (action === 'preview') {
      setPreview({ theme: json.theme, phase: json.phase, products: json.products })
    } else {
      setMemberships(ms => ms.map(m => m.id === mId ? { ...m, shipments_remaining: json.remaining, status: json.remaining > 0 ? 'active' : 'expired' } : m))
      setMsg(`${json.cycle_no}회차 발송 완료 · 남은 ${json.remaining}회`)
      setPreview(null)
    }
  }

  // 템플릿 제품 검색
  const searchProducts = async (q: string) => {
    if (q.length < 2) { setTplSearchResults([]); return }
    const { data } = await supabase.from('products').select('id,name').ilike('name', `%${q}%`).limit(8)
    setTplSearchResults((data as any) || [])
  }

  // 템플릿 저장
  const saveTpl = async () => {
    if (!editTpl) return
    setSavingTpl(true); setTplMsg('')
    const { error } = await supabase.from('bundle_templates').update({
      theme_name: editTpl.theme_name,
      target_phase: editTpl.target_phase,
      product_ids: editTpl.product_ids,
      usage_guide: editTpl.usage_guide,
      owner_tip: editTpl.owner_tip,
      is_active: editTpl.is_active,
      target_gender: editTpl.target_gender || 'all',
    }).eq('id', editTpl.id)
    setSavingTpl(false)
    if (error) { setTplMsg('저장 실패: ' + error.message); return }
    setTemplates(ts => ts.map(t => t.id === editTpl.id ? editTpl : t))
    setTplMsg('저장됐어요 ✓'); setEditTpl(null)
  }

  // 템플릿 추가
  const addTpl = async () => {
    const { data, error } = await supabase.from('bundle_templates')
      .insert({ theme_name: '새 리추얼', product_ids: [], is_active: true, display_order: templates.length + 1 } as any)
      .select().single()
    if (!error && data) {
      const newTpl = data as Tpl
      setTemplates(ts => [...ts, newTpl])
      setEditTpl(newTpl)
    }
  }

  // 수동 등록
  const searchUsers = async (q: string) => {
    if (q.length < 2) { setMUsers([]); return }
    const res = await fetch('/api/admin/membership/manual?q=' + encodeURIComponent(q))
    const json = await res.json()
    setMUsers(json.users || [])
  }

  const registerManual = async () => {
    if (!mUserId || !mPlanId || !mDate) { setMMsg('고객·플랜·배송일을 모두 입력해주세요'); return }
    setMBusy(true); setMMsg('')
    const res = await fetch('/api/admin/membership/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: mUserId, plan_id: mPlanId, shipments_total: mShipments, next_shipment_date: mDate, memo: mMemo || undefined, user_name: mUserName || undefined }),
    })
    const json = await res.json()
    setMBusy(false)
    if (json.ok) { setMMsg('등록 완료! 💜'); setMUserId(''); setMUserName(''); setMPlanId(''); setMDate(''); setMMemo(''); setMSearch(''); setMUsers([]) }
    else { setMMsg(json.error || '실패했어요') }
  }

  const selectedTpl = templates.find(t => t.id === tplId)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '22px 16px 48px', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: C.ink, marginBottom: 12 }}>멤버 · 큐레이션</div>

      {/* 상단 버튼 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setShowManual(!showManual); setShowTplPanel(false); setMMsg('') }}
          style={{ padding: '7px 14px', background: showManual ? C.purple : 'transparent', border: `1px solid ${C.purple}`, color: showManual ? '#fff' : C.purple, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showManual ? '닫기' : '+ 수동 등록'}
        </button>
        <button onClick={() => { setShowTplPanel(!showTplPanel); setShowManual(false); setEditTpl(null); setTplMsg('') }}
          style={{ padding: '7px 14px', background: showTplPanel ? C.purple : 'transparent', border: `1px solid ${C.purple}`, color: showTplPanel ? '#fff' : C.purple, borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showTplPanel ? '닫기' : '📋 템플릿 관리'}
        </button>
      </div>

      {/* 수동 등록 패널 */}
      {showManual && (
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>수동 멤버십 등록</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>고객 검색</div>
              <input value={mSearch} onChange={e => { setMSearch(e.target.value); void searchUsers(e.target.value) }}
                placeholder="이름 또는 이메일 2자 이상"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
              {mUsers.length > 0 && (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                  {mUsers.map(u => (
                    <div key={u.id} onClick={() => { setMUserId(u.id); setMUserName(u.name || ''); setMSearch(u.email); setMUsers([]) }}
                      style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: `0.5px solid ${C.line}`, background: mUserId === u.id ? C.purpleSoft : '#fff', color: '#111' }}>
                      {u.name || '(이름없음)'} · {u.email}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {mUserId && (
              <input value={mUserName} onChange={e => setMUserName(e.target.value)} placeholder="이름 확인/수정"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            )}
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>플랜</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {plans.map(p => <button key={p.id} onClick={() => setMPlanId(p.id)} style={pill(mPlanId === p.id)}>{p.name} · ₩{p.price.toLocaleString()}</button>)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>배송 횟수</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[3, 6, 12].map(n => <button key={n} onClick={() => setMShipments(n)} style={pill(mShipments === n)}>{n}회</button>)}
              </div>
            </div>
            <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            <input value={mMemo} onChange={e => setMMemo(e.target.value)} placeholder="메모 (예: 300만원 송금 확인)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
            {mMsg && <div style={{ fontSize: 12, color: mMsg.includes('완료') ? C.green : '#A33' }}>{mMsg}</div>}
            <button onClick={registerManual} disabled={mBusy}
              style={{ padding: 12, background: mBusy ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: mBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {mBusy ? '등록 중...' : '멤버십 등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* 템플릿 관리 패널 */}
      {showTplPanel && (
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.ink }}>리추얼 템플릿 관리</div>
            <button onClick={addTpl} style={{ padding: '5px 12px', background: C.purple, border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>+ 추가</button>
          </div>
          {tplMsg && <div style={{ fontSize: 12, color: tplMsg.includes('✓') ? C.green : '#A33', marginBottom: 8 }}>{tplMsg}</div>}

          {/* 템플릿 목록 */}
          {!editTpl && templates.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${C.line}` }}>
              <div>
                <div style={{ fontSize: 13, color: C.plum }}>{t.theme_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{t.target_phase || '전체 페이즈'} · 제품 {t.product_ids?.length || 0}개 · {t.is_active ? '활성' : '비활성'}</div>
              </div>
              <button onClick={() => { setEditTpl({ ...t }); setTplMsg('') }}
                style={{ padding: '5px 10px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>편집</button>
            </div>
          ))}

          {/* 템플릿 편집 */}
          {editTpl && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={editTpl.theme_name} onChange={e => setEditTpl({ ...editTpl, theme_name: e.target.value })}
                placeholder="테마명" style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>호르몬 페이즈</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PHASES.map(p => <button key={p} onClick={() => setEditTpl({ ...editTpl, target_phase: editTpl.target_phase === p ? null : p })} style={pill(editTpl.target_phase === p)}>{p}</button>)}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>대상 성별</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['all', 'female', 'male'] as const).map(g => (
                      <button key={g} onClick={() => setEditTpl({ ...editTpl, target_gender: g })}
                        style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid rgba(123,94,167,0.3)', background: (editTpl.target_gender || 'all') === g ? C.purple : 'transparent', color: (editTpl.target_gender || 'all') === g ? '#fff' : C.muted }}>
                        {g === 'all' ? '전체' : g === 'female' ? '여성' : '남성'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>제품 검색</div>
                <input value={tplSearch} onChange={e => { setTplSearch(e.target.value); void searchProducts(e.target.value) }}
                  placeholder="제품명 검색" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
                {tplSearchResults.length > 0 && (
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 4 }}>
                    {tplSearchResults.map(p => (
                      <div key={p.id} onClick={() => { if (!editTpl.product_ids.includes(p.id)) setEditTpl({ ...editTpl, product_ids: [...editTpl.product_ids, p.id] }); setTplSearch(''); setTplSearchResults([]) }}
                        style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: '#111', borderBottom: `0.5px solid ${C.line}`, background: '#fff' }}>
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>구성 제품 ({editTpl.product_ids.length}개)</div>
                {editTpl.product_ids.map(pid => (
                  <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `0.5px solid ${C.line}` }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.plum }}>{productMap[pid]?.name || pid}</div>
                      {productMap[pid]?.key_ingredients && <div style={{ fontSize: 10, color: C.gold }}>성분: {productMap[pid].key_ingredients}</div>}
                    </div>
                    <button onClick={() => setEditTpl({ ...editTpl, product_ids: editTpl.product_ids.filter(id => id !== pid) })}
                      style={{ fontSize: 11, color: '#A33', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>사용법 안내</div>
                <textarea value={editTpl.usage_guide || ''} onChange={e => setEditTpl({ ...editTpl, usage_guide: e.target.value })} rows={3}
                  placeholder="제품 사용법, 순서 등을 입력하세요"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', resize: 'vertical' }}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>원장님 팁</div>
                <textarea value={editTpl.owner_tip || ''} onChange={e => setEditTpl({ ...editTpl, owner_tip: e.target.value })} rows={2}
                  placeholder="원장님만의 특별한 팁을 입력하세요 💜"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', resize: 'vertical' }}/>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
                <input type="checkbox" checked={editTpl.is_active} onChange={e => setEditTpl({ ...editTpl, is_active: e.target.checked })} style={{ accentColor: C.purple }}/>
                활성 템플릿
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveTpl} disabled={savingTpl}
                  style={{ flex: 1, padding: 11, background: savingTpl ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {savingTpl ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => { setEditTpl(null); setTplMsg('') }}
                  style={{ padding: '11px 16px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 멤버 목록 */}
      {memberships.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>아직 멤버가 없어요.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {memberships.map(m => {
          const opened = openId === m.id
          return (
            <div key={m.id} style={{ background: '#fff', border: `0.5px solid ${opened ? C.purple : C.line}`, borderRadius: 12, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div onClick={() => open(m.id)} style={{ display: 'flex', alignItems: 'baseline', gap: 9, flex: 1, cursor: 'pointer' }}>
                  <span style={{ fontSize: 15, color: C.plum }}>{m.users?.name || '회원'}</span>
                  {m.source_type === 'membership_gift' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(201,169,110,0.15)', color: C.gold }}>선물수령</span>
                  )}
                  {m.source_type === 'manual' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(123,94,167,0.1)', color: C.purple }}>수동등록</span>
                  )}
                  <span style={{ fontSize: 11, color: C.goldDark, background: C.goldSoft, borderRadius: 5, padding: '2px 8px' }}>{m.membership_plans?.name || '멤버'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{m.shipments_total - m.shipments_remaining}/{m.shipments_total}회</span>
                  <span style={{ fontSize: 11, color: m.status === 'active' ? C.green : C.faint, background: m.status === 'active' ? C.greenSoft : 'transparent', borderRadius: 5, padding: '2px 7px' }}>
                    {m.status === 'active' ? '활성' : m.status === 'expired' ? '소진' : m.status}
                  </span>
                  {opened && (
                    <button onClick={e => { e.stopPropagation(); open(m.id) }}
                      style={{ padding: '4px 12px', background: 'transparent', border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 6, fontSize: 11, cursor: 'pointer', marginLeft: 8, flexShrink: 0 }}>
                      닫기
                    </button>
                  )}
                </div>
              </div>
              {opened && (
                <div style={{ marginTop: 14, borderTop: `0.5px solid ${C.line}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
                    남은 {m.shipments_remaining}회 · {m.next_shipment_date ? `다음 ${m.next_shipment_date}` : '예정일 없음'}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 7 }}>이번 회차 리추얼 선택</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                    {templates.filter(t => {
                      if (!t.is_active) return false
                      const g = genderMap[m.user_id] || null
                      const tg = t.target_gender || 'all'
                      if (!g || g === 'other' || tg === 'all') return true
                      if ((g === 'F' || g === 'Trans_MtF') && tg === 'female') return true
                      if ((g === 'M' || g === 'Trans_FtM') && tg === 'male') return true
                      return false
                    }).map(t => (
                      <button key={t.id} onClick={() => { setTplId(t.id); setPreview(null) }} style={pill(tplId === t.id)}>{t.theme_name}</button>
                    ))}
                  </div>

                  {/* 선택된 템플릿 상세 인라인 */}
                  {selectedTpl && tplId && (
                    <div style={{ background: C.purpleSoft, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: C.purple, marginBottom: 8 }}>
                        {selectedTpl.theme_name}{selectedTpl.target_phase ? ` · ${selectedTpl.target_phase}` : ''}
                      </div>
                      {selectedTpl.product_ids.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>구성 제품</div>
                          {selectedTpl.product_ids.map(pid => (
                            <div key={pid} style={{ fontSize: 12, color: C.plum, padding: '4px 0', borderBottom: `0.5px solid rgba(123,94,167,0.1)` }}>
                              {productMap[pid]?.name || pid}
                              {productMap[pid]?.description && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{productMap[pid].description}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedTpl.usage_guide && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>사용법</div>
                          <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{selectedTpl.usage_guide}</div>
                        </div>
                      )}
                      {selectedTpl.owner_tip && (
                        <div>
                          <div style={{ fontSize: 10, color: C.gold, marginBottom: 2 }}>원장님 팁 💜</div>
                          <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{selectedTpl.owner_tip}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {preview && (
                    <div style={{ background: '#F5F0FF', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: C.purple, marginBottom: 10 }}>{preview.theme}{preview.phase ? ` · ${preview.phase}` : ''} · AI 큐레이션</div>
                      {preview.products.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>템플릿에 제품을 먼저 추가해주세요</div>}
                      {preview.products.map(p => (
                        <div key={p.id} style={{ paddingBottom: 9, marginBottom: 9, borderBottom: `0.5px solid rgba(123,94,167,0.1)` }}>
                          <div style={{ fontSize: 13, color: C.plum }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                            {p._reasons.map((r, i) => <span key={i} style={{ fontSize: 11, color: C.purple, background: '#fff', borderRadius: 5, padding: '2px 7px' }}>{r}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg && (
                    <div style={{ fontSize: 12, marginBottom: 10, padding: '8px 12px', borderRadius: 8,
                      background: msg.includes('완료') ? 'rgba(91,138,107,0.1)' : 'rgba(201,169,110,0.1)',
                      color: msg.includes('완료') ? C.green : C.gold,
                      border: `0.5px solid ${msg.includes('완료') ? 'rgba(91,138,107,0.3)' : 'rgba(201,169,110,0.3)'}` }}>
                      {msg.includes('완료') ? '✓ ' : '⚠ '}{msg}
                    </div>
                  )}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>발송 예정일</div>
                    <input type="date" value={shipDates[m.id] || new Date().toISOString().slice(0, 10)}
                      onChange={e => setShipDates(prev => ({ ...prev, [m.id]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 13, color: '#111', cursor: 'pointer' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.faint, marginBottom: 6 }}>배송 방법</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {(['courier', 'quick', 'direct'] as const).map(dt => (
                        <button key={dt} onClick={() => setDeliveryTypes(prev => ({ ...prev, [m.id]: dt }))}
                          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid rgba(123,94,167,0.3)', background: (deliveryTypes[m.id] || 'courier') === dt ? C.purple : 'transparent', color: (deliveryTypes[m.id] || 'courier') === dt ? '#fff' : C.muted }}>
                          {dt === 'courier' ? '📦 택배' : dt === 'quick' ? '🛵 퀵' : '🤝 직접전달'}
                        </button>
                      ))}
                    </div>
                    {(deliveryTypes[m.id] || 'courier') === 'courier' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={couriers[m.id] || 'CJ대한통운'} onChange={e => setCouriers(prev => ({ ...prev, [m.id]: e.target.value }))}
                          style={{ padding: '7px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: '#111', cursor: 'pointer' }}>
                          {['CJ대한통운','롯데택배','한진택배','우체국택배','로젠택배'].map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input value={trackingNos[m.id] || ''} onChange={e => setTrackingNos(prev => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder="운송장 번호" style={{ flex: 1, padding: '7px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: '#111' }} />
                      </div>
                    )}
                    {(deliveryTypes[m.id] || 'courier') === 'quick' && (
                      <input value={quickCompanies[m.id] || ''} onChange={e => setQuickCompanies(prev => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="퀵 업체명" style={{ width: '100%', padding: '7px 10px', background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: '#111' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => call(m.id, 'preview')} disabled={busy}
                      style={{ flex: 1, background: 'transparent', border: `0.5px solid rgba(123,94,167,0.3)`, color: C.muted, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                      {busy ? '...' : '미리보기'}
                    </button>
                    <button onClick={() => call(m.id, 'ship')} disabled={busy || m.shipments_remaining <= 0}
                      style={{ flex: 1, background: m.shipments_remaining <= 0 ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', cursor: m.shipments_remaining <= 0 ? 'default' : 'pointer' }}>
                      발송 처리
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
