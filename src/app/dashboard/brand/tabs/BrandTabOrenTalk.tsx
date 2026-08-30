'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import BrandChatPanel from '@/components/brand/BrandChatPanel'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const TARGETS = [
  { key: 'all', label: '전체 원장님' },
  { key: 'medi', label: '메디슈티컬' },
  { key: 'premium', label: '프리미엄전문점' },
  { key: 'spec', label: '전문점' },
  { key: 'auth', label: '취급점' },
  { key: 'arete', label: '아레테클럽' },
]
interface MsgRow {
  id: string
  message_type: string
  target_type: string
  title: string | null
  body: string
  send_count: number
  created_at: string
}
interface AutoSetting {
  key: string
  icon: string
  title: string
  desc: string
  enabled: boolean
}
interface Props {
  myBrands: { id: string; name: string }[]
  brandId: string | null
  companyId?: string | null
  staffId?: string | null
}
export default function BrandTabOrenTalk({ myBrands, brandId, companyId, staffId }: Props) {
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [subTab, setSubTab] = useState<'history' | 'chat'>('history')
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const [target, setTarget] = useState('all')
  const [histFilter, setHistFilter] = useState<'all' | 'auto' | 'manual'>('all')
  const [history, setHistory] = useState<MsgRow[]>([])
  const [sending, setSending] = useState(false)
  const [autoSettings, setAutoSettings] = useState<AutoSetting[]>([
    { key: 'auto_order', icon: '📦', title: '발주 접수 자동 알림', desc: '발주 접수 시 원장님에게 자동 발송', enabled: true },
    { key: 'auto_noorder', icon: '🔄', title: '30일 미주문 유도', desc: '30일 미주문 원장님 자동 알림', enabled: true },
    { key: 'auto_sample', icon: '🎁', title: '신제품 샘플 안내', desc: '샘플 발송 시 자동 오렌톡', enabled: false },
    { key: 'auto_live', icon: '📡', title: '라이브 사전 알림', desc: 'D-3, D-1, 당일 1시간 전 자동 발송', enabled: true },
  ])
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  useEffect(() => {
    if (!brandId) { setCompanyBrandIds([]); return }
    let cancelled = false
    void (async () => {
      const ids = await resolveCompanyBrandIds(supabase, brandId)
      if (!cancelled) setCompanyBrandIds(ids)
    })()
    return () => { cancelled = true }
  }, [brandId, supabase])
  const fetchHistory = useCallback(async () => {
    if (!companyBrandIds.length) return
    const { data } = await supabase
      .from('brand_messages')
      .select('id, message_type, target_type, title, body, send_count, created_at')
      .in('brand_id', companyBrandIds)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data || []) as MsgRow[])
  }, [companyBrandIds])
  useEffect(() => { void fetchHistory() }, [fetchHistory])
  const toggleAuto = (key: string) => {
    setAutoSettings(prev => prev.map(s =>
      s.key === key ? { ...s, enabled: !s.enabled } : s
    ))
    const s = autoSettings.find(a => a.key === key)
    showToast(s ? (s.enabled ? '자동 발송 OFF' : '자동 발송 ON!') : '')
  }
  const sendMsg = async () => {
    if (!msg.trim()) { showToast('메시지를 입력해주세요'); return }
    if (!brandId) { showToast('브랜드 정보가 없습니다'); return }
    setSending(true)
    const targetLabel = TARGETS.find(t => t.key === target)?.label || '전체 원장님'
    const { data, error } = await supabase
      .from('brand_messages')
      .insert({
        brand_id: brandId,
        message_type: 'manual',
        target_type: target,
        title: `${brandName} 오렌톡`,
        body: msg.trim(),
        send_count: 0,
      })
      .select('id, message_type, target_type, title, body, send_count, created_at')
      .single()
    if (!error && data) {
      setHistory(prev => [data as MsgRow, ...prev])
      setMsg('')
      showToast(`${targetLabel}에게 오렌톡 발송 완료!`)
    } else {
      showToast('발송 실패: ' + (error?.message || ''))
    }
    setSending(false)
  }
  const filtered = histFilter === 'all'
    ? history
    : history.filter(h => histFilter === 'auto'
      ? h.message_type.startsWith('auto_')
      : h.message_type === 'manual')
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  if (!companyBrandIds.length) {
    return <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>불러오는 중…</div>
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([
          { key: 'history' as const, label: '발송이력' },
          { key: 'chat' as const, label: '1:1 상담' },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
              border: `0.5px solid ${subTab === t.key ? PURPLE : 'rgba(255,255,255,0.1)'}`,
              background: subTab === t.key ? 'rgba(123,94,167,0.25)' : 'transparent',
              color: subTab === t.key ? '#c4a7e7' : SUB,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'chat' && (
        companyId
          ? <BrandChatPanel companyId={companyId} staffId={staffId ?? null} />
          : <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>회사 정보를 불러오는 중…</div>
      )}
      {subTab === 'history' && (
      <>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>💜 자동 발송 설정 <span style={{ fontSize: 10 }}>· AURAN 인앱 무료</span></div>
        {autoSettings.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < autoSettings.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: SUB }}>{s.desc}</div>
            </div>
            <div
              onClick={() => toggleAuto(s.key)}
              style={{ width: 36, height: 20, borderRadius: 10, background: s.enabled ? PURPLE : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 3, left: s.enabled ? 19 : 3, transition: 'left .2s' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>✉️ 직접 발송</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {TARGETS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTarget(t.key)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${target === t.key ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: target === t.key ? 'rgba(123,94,167,0.2)' : 'transparent', color: target === t.key ? '#c4a7e7' : SUB, cursor: 'pointer' }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder={`${TARGETS.find(t => t.key === target)?.label || '전체 원장님'}에게 보낼 메시지 입력...`}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: TEXT, minHeight: 80, resize: 'none', outline: 'none', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={sendMsg}
            disabled={sending}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: sending ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 12, cursor: sending ? 'not-allowed' : 'pointer' }}
          >
            {sending ? '발송 중...' : '💜 발송하기'}
          </button>
          <button
            type="button"
            onClick={() => showToast('카카오 알림톡 연동 준비 중')}
            style={{ padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', fontSize: 12, cursor: 'pointer' }}
          >
            카카오
          </button>
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📋 발송 이력</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(['all', 'auto', 'manual'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setHistFilter(f)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${histFilter === f ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: histFilter === f ? 'rgba(123,94,167,0.2)' : 'transparent', color: histFilter === f ? '#c4a7e7' : SUB, cursor: 'pointer' }}
            >
              {f === 'all' ? '전체' : f === 'auto' ? '자동' : '직접'}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>발송 이력이 없어요</div>
        ) : (
          filtered.map((h, i) => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < filtered.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{h.message_type.startsWith('auto_') ? '🤖' : '✉️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: TEXT, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.body}</div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {TARGETS.find(t => t.key === h.target_type)?.label || h.target_type}
                  {h.send_count > 0 && ` · ${h.send_count}명`}
                </div>
              </div>
              <div style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{timeAgo(h.created_at)}</div>
            </div>
          ))
        )}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>💛 카카오 알림톡</div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 10, lineHeight: 1.6 }}>
          카카오 비즈니스 채널 연동 시 앱 미설치 원장님에게도 알림 발송 가능
        </div>
        <button
          type="button"
          onClick={() => showToast('카카오 채널 연동 준비 중')}
          style={{ width: '100%', padding: '8px', borderRadius: 8, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', fontSize: 12, cursor: 'pointer' }}
        >
          카카오 채널 연동하기
        </button>
      </div>
      </>
      )}
    </div>
  )
}
