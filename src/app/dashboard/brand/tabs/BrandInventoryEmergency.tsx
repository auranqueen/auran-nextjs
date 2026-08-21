'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const REASONS = ['스캐너 오류', '카메라 권한 오류', '인터넷 연결 오류', 'QR 라벨 훼손', '긴급 대량 출고', '기타'] as const
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '확인대기', color: '#C9A96E', bg: 'rgba(201,169,110,0.1)' },
  confirmed: { label: '확인완료', color: '#4CAF50', bg: 'rgba(76,175,80,0.1)' },
  disputed:  { label: '이의제기', color: DANGER, bg: 'rgba(229,57,53,0.1)' },
}
interface InventoryRow { id: string; product_name: string; total_stock: number; brand_id: string }
interface StaffRow { id: string; name: string; pin: string | null }
interface LogRow {
  id: string
  type: string
  qty: number
  memo: string | null
  staff_name: string | null
  created_at: string
  hq_status: string
  brand_inventory: { product_name: string } | null
}
interface Props { brandId: string | null; brandName: string; isHQ?: boolean }
export default function BrandInventoryEmergency({ brandId, brandName, isHQ = false }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<'logistics' | 'hq'>(isHQ ? 'hq' : 'logistics')
  const [inventories, setInventories] = useState<InventoryRow[]>([])
  const [staffList, setStaffList] = useState<StaffRow[]>([])
  const [emergencyLogs, setEmergencyLogs] = useState<LogRow[]>([])
  const [selReason, setSelReason] = useState('')
  const [selInv, setSelInv] = useState('')
  const [qty, setQty] = useState(1)
  const [staffName, setStaffName] = useState('')
  const [memo, setMemo] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2800) }
  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const companyBrandIds = await resolveCompanyBrandIds(supabase, brandId)
    const [{ data: invData }, { data: staffData }, { data: logData }] = await Promise.all([
      supabase.from('brand_inventory').select('id, product_name, total_stock, brand_id').in('brand_id', companyBrandIds).order('product_name'),
      supabase.from('brand_staff').select('id, name, pin').in('brand_id', companyBrandIds).eq('is_active', true),
      supabase.from('brand_stock_logs')
        .select('id, type, qty, memo, staff_name, created_at, hq_status, brand_inventory(product_name)')
        .in('brand_id', companyBrandIds)
        .eq('ref_type', 'emergency')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setInventories((invData || []) as InventoryRow[])
    setStaffList((staffData || []) as StaffRow[])
    setEmergencyLogs((logData || []) as unknown as LogRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadData() }, [loadData])
  const pendingCount = emergencyLogs.filter(l => l.hq_status === 'pending').length
  const confirmedCount = emergencyLogs.filter(l => l.hq_status === 'confirmed').length
  const verifyPin = () => {
    const staff = staffList.find(s => s.name === staffName && s.pin === pin)
    return !!staff
  }
  const submitEmergency = async () => {
    if (!selReason) { showToast('사유를 선택해주세요'); return }
    if (!selInv) { showToast('제품을 선택해주세요'); return }
    if (!staffName.trim()) { showToast('담당자 이름을 입력해주세요'); return }
    if (pin.length !== 4) { showToast('PIN 4자리를 입력해주세요'); return }
    if (!verifyPin()) {
      setPinError(prev => {
        const next = prev + 1
        if (next >= 3) showToast('PIN 오류 3회 — 본사 알림 발송됨')
        else showToast(`PIN이 일치하지 않아요 (${next}/3)`)
        return next
      })
      return
    }
    if (!brandId) return
    setSaving(true)
    const inv = inventories.find(i => i.id === selInv)
    const before = inv?.total_stock || 0
    const after = Math.max(0, before - qty)
    const { error } = await supabase.from('brand_stock_logs').insert({
      brand_id: inv?.brand_id || brandId,
      inventory_id: selInv,
      type: 'out',
      qty,
      before_qty: before,
      after_qty: after,
      ref_type: 'emergency',
      staff_name: staffName.trim(),
      memo: `[비상출고] ${selReason} · ${memo.trim() || '-'}`,
      hq_status: 'pending',
    })
    if (!error) {
      await supabase.rpc('decrement_inventory_stock', { p_inventory_id: selInv, p_qty: qty })
      await supabase.from('brand_messages').insert({
        brand_id: inv?.brand_id || brandId,
        message_type: 'auto_order',
        target_type: 'all',
        title: `⚠️ 비상 수동 출고 발생 — 즉시 확인 필요`,
        body: `${inv?.product_name || '제품'} ${qty}개 · 담당: ${staffName} · 사유: ${selReason}${memo ? ' · ' + memo : ''} · 확인 후 승인/이의제기 해주세요.`,
        send_count: 1,
      })
      setDone(true)
      showToast('비상 수동 출고 완료! 본사 즉시 알림 발송됨')
      void loadData()
    } else {
      showToast('처리 실패: ' + error.message)
    }
    setSaving(false)
  }
  const hqAction = async (logId: string, status: 'confirmed' | 'disputed') => {
    const { error } = await supabase
      .from('brand_stock_logs')
      .update({ hq_status: status })
      .eq('id', logId)
    if (!error) {
      setEmergencyLogs(prev => prev.map(l => l.id === logId ? { ...l, hq_status: status } : l))
      if (status === 'disputed') {
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: 'auto_order',
          target_type: 'all',
          title: `⚠️ 비상 출고 이의제기`,
          body: `비상 수동 출고에 이의가 제기됐습니다. 담당자 소명이 필요합니다.`,
          send_count: 1,
        })
        showToast('이의제기 완료 — 담당자 소명 요청 발송됨')
      } else {
        showToast('확인 완료 — 이력에 기록됨')
      }
    }
  }
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: DANGER, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
        {([
          { key: 'logistics', label: '물류팀 (긴급출고)', icon: '🚨' },
          { key: 'hq', label: `본사 확인 ${pendingCount > 0 ? `(${pendingCount})` : ''}`, icon: '🏢' },
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, border: 'none', background: 'transparent', color: tab === t.key ? (t.key === 'logistics' ? DANGER : PURPLE) : SUB, borderBottom: tab === t.key ? `2px solid ${t.key === 'logistics' ? DANGER : PURPLE}` : '2px solid transparent', cursor: 'pointer' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'logistics' && (
        <div>
          <div style={{ background: 'rgba(229,57,53,0.08)', border: `0.5px solid rgba(229,57,53,0.3)`, borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: 'rgba(229,57,53,0.9)', lineHeight: 1.6 }}>
            🚨 플랜 B — 비상 수동 출고 모드<br/>
            <span style={{ fontSize: 11, color: 'rgba(229,57,53,0.6)' }}>스캐너/카메라 오류 시 사용 · 모든 처리가 본사에 즉시 통보됩니다</span>
          </div>
          {done ? (
            <div>
              <div style={{ background: 'rgba(76,175,80,0.08)', border: '0.5px solid rgba(76,175,80,0.3)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: '#4CAF50', marginBottom: 4 }}>✅ 비상 수동 출고 처리 완료</div>
                <div style={{ fontSize: 12, color: SUB }}>본사 실시간 알림 발송됨 · 수정 불가 이력 저장됨</div>
              </div>
              <button type="button" onClick={() => { setDone(false); setPin(''); setMemo(''); setSelReason(''); setQty(1) }}
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
                추가 출고하기
              </button>
              <button type="button" onClick={() => setTab('hq')}
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer' }}>
                본사 확인 화면 보기 →
              </button>
            </div>
          ) : (
            <>
              <div style={CARD}>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>긴급 출고 사유 (필수)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {REASONS.map(r => (
                    <button key={r} type="button" onClick={() => setSelReason(r)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${selReason === r ? DANGER : 'rgba(255,255,255,0.1)'}`, background: selReason === r ? 'rgba(229,57,53,0.1)' : 'transparent', color: selReason === r ? DANGER : SUB, cursor: 'pointer' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div style={CARD}>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>제품 선택 (필수)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {inventories.map(inv => (
                    <button key={inv.id} type="button" onClick={() => setSelInv(inv.id)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${selInv === inv.id ? DANGER : 'rgba(255,255,255,0.1)'}`, background: selInv === inv.id ? 'rgba(229,57,53,0.1)' : 'transparent', color: selInv === inv.id ? DANGER : SUB, cursor: 'pointer' }}>
                      {inv.product_name} ({inv.total_stock}개)
                    </button>
                  ))}
                </div>
              </div>
              <div style={CARD}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>출고 수량</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                        style={{ width: 28, height: 28, borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 14, cursor: 'pointer' }}>−</button>
                      <input type="number" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))} min={1}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '5px 8px', fontSize: 13, color: TEXT, outline: 'none', textAlign: 'center' as const }} />
                      <button type="button" onClick={() => setQty(q => q + 1)}
                        style={{ width: 28, height: 28, borderRadius: 5, border: 'none', background: DANGER, color: '#fff', fontSize: 14, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>담당자</div>
                    <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="이름"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '6px 8px', fontSize: 12, color: TEXT, outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>상세 메모 (발주번호·수신처 등)</div>
                  <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="출고 상황 상세 기록"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none' }} />
                </div>
              </div>
              <div style={CARD}>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>담당자 PIN (본인 인증 필수)</div>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="• • • •"
                  maxLength={4}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${pinError > 0 ? DANGER : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, padding: '10px', fontSize: 18, color: TEXT, outline: 'none', textAlign: 'center' as const, letterSpacing: 8 }}
                />
                {pinError > 0 && (
                  <div style={{ fontSize: 11, color: DANGER, textAlign: 'center', marginTop: 4 }}>
                    PIN 오류 {pinError}/3 {pinError >= 3 ? '— 본사 알림 발송됨' : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: SUB, textAlign: 'center' as const, marginTop: 6 }}>
                  PIN 없이 수동 출고 불가 · 처리 후 수정 불가
                </div>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 7, fontSize: 11, color: 'rgba(201,169,110,0.7)', marginBottom: 12, lineHeight: 1.6 }}>
                👁 수동 출고는 즉시 본사에 실시간 알림이 발송됩니다. 허위·임의 출고 시 담당자 책임이 기록됩니다.
              </div>
              <button type="button" onClick={() => void submitEmergency()} disabled={saving}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: saving ? 'rgba(229,57,53,0.4)' : DANGER, color: '#fff', fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                {saving ? '처리 중...' : '🚨 비상 수동 출고 처리'}
              </button>
            </>
          )}
        </div>
      )}
      {tab === 'hq' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: '이달 비상출고', val: emergencyLogs.length, color: DANGER },
              { label: '확인 대기', val: pendingCount, color: '#C9A96E' },
              { label: '확인 완료', val: confirmedCount, color: '#4CAF50' },
            ].map(k => (
              <div key={k.label} style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, textAlign: 'center' as const }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: k.color, marginBottom: 2 }}>{k.val}</div>
                <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
              </div>
            ))}
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>비상 출고 이력 (실시간 · 수정 불가)</div>
            {emergencyLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>비상 출고 이력이 없어요</div>
            ) : emergencyLogs.map((log, i) => {
              const st = STATUS_MAP[log.hq_status] || STATUS_MAP.pending
              return (
                <div key={log.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < emergencyLogs.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' as const }}>
                        <span style={{ fontSize: 13, color: TEXT }}>{(log.brand_inventory as { product_name?: string })?.product_name}</span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: SUB, marginBottom: 2 }}>{log.memo}</div>
                      <div style={{ fontSize: 11, color: SUB }}>{log.staff_name} · {timeAgo(log.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: DANGER, flexShrink: 0, marginLeft: 8 }}>-{log.qty}개</div>
                  </div>
                  {log.hq_status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => void hqAction(log.id, 'confirmed')}
                        style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: 'rgba(76,175,80,0.15)', color: '#4CAF50', fontSize: 11, cursor: 'pointer' }}>
                        ✅ 확인
                      </button>
                      <button type="button" onClick={() => void hqAction(log.id, 'disputed')}
                        style={{ padding: '6px 12px', borderRadius: 6, border: `0.5px solid rgba(229,57,53,0.3)`, background: 'rgba(229,57,53,0.08)', color: DANGER, fontSize: 11, cursor: 'pointer' }}>
                        이의제기
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>자동 감지 · 알림 규칙</div>
            {[
              { rule: '비상 수동 출고 발생', action: '즉시 알림', color: DANGER },
              { rule: 'PIN 불일치 3회', action: '계정 잠금 + 알림', color: DANGER },
              { rule: '본사 미확인 2시간 초과', action: '재알림', color: '#C9A96E' },
              { rule: '동일 담당자 3회 이상', action: '패턴 감지 알림', color: '#C9A96E' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: 12, color: TEXT }}>{r.rule}</span>
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: `${r.color}15`, color: r.color }}>{r.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
