'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(76,175,80,0.8)'
const TARGETS = ['전체 원장님', '메디슈티컬', '프리미엄전문점', '전문점', '취급점', '아레테클럽']
interface HistItem {
  id: string
  type: 'auto' | 'manual'
  target: string
  message: string
  created_at: string
  read_count: number
  total_count: number
}
interface AutoSetting {
  key: string
  icon: string
  title: string
  desc: string
  enabled: boolean
}
interface Props {
  brandName: string
  brandId: string | null
}
export default function BrandTabOrenTalk({ brandName, brandId }: Props) {
  const supabase = createClient()
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const [target, setTarget] = useState('전체 원장님')
  const [histFilter, setHistFilter] = useState<'all' | 'auto' | 'manual'>('all')
  const [history, setHistory] = useState<HistItem[]>([])
  const [sending, setSending] = useState(false)
  const [autoSettings, setAutoSettings] = useState<AutoSetting[]>([
    { key: 'order', icon: '📦', title: '발주 접수 자동 알림', desc: '발주 접수 시 원장님에게 자동 발송', enabled: true },
    { key: 'noorder', icon: '🔄', title: '30일 미주문 유도', desc: '30일 미주문 원장님 자동 알림', enabled: true },
    { key: 'sample', icon: '🎁', title: '신제품 샘플 안내', desc: '샘플 발송 시 자동 오렌톡', enabled: false },
    { key: 'live', icon: '📡', title: '라이브 사전 알림', desc: 'D-3, D-1, 당일 1시간 전 자동 발송', enabled: true },
  ])
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const fetchHistory = useCallback(async () => {
    if (!brandId) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, message, created_at, is_read')
      .eq('type', 'brand_orentalk')
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) {
      setHistory(data.map((n: any) => ({
        id: n.id,
        type: n.message?.startsWith('[자동]') ? 'auto' : 'manual',
        target: n.target_label || '전체 원장님',
        message: n.message?.replace('[자동] ', '').replace('[직접] ', '') || '',
        created_at: n.created_at,
        read_count: 0,
        total_count: 0,
      })))
    }
  }, [brandId])
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
    setSending(true)
    const { error } = await supabase
      .from('notifications')
      .insert({
        type: 'brand_orentalk',
        message: `[직접] ${msg.trim()}`,
        is_read: false,
        target_label: target,
      })
    if (!error) {
      setHistory(prev => [{
        id: Date.now().toString(),
        type: 'manual',
        target,
        message: msg.trim(),
        created_at: new Date().toISOString(),
        read_count: 0,
        total_count: 0,
      }, ...prev])
      setMsg('')
      showToast('오렌톡 발송 완료!')
    } else {
      showToast('발송 실패: ' + error.message)
    }
    setSending(false)
  }
  const filtered = histFilter === 'all' ? history : history.filter(h => h.type === histFilter)
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      {/* 자동 발송 설정 */}
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
      {/* 직접 발송 */}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>✉️ 직접 발송</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {TARGETS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTarget(t)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${target === t ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: target === t ? 'rgba(123,94,167,0.2)' : 'transparent', color: target === t ? '#c4a7e7' : SUB, cursor: 'pointer' }}
            >
              {t}
            </button>
          ))}
        </div>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder={`${target}에게 보낼 메시지 입력...`}
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
            onClick={() => showToast('카카오 알림톡 연동 필요')}
            style={{ padding: '8px 12px', borderRadius: 8, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', fontSize: 12, cursor: 'pointer' }}
          >
            카카오
          </button>
        </div>
      </div>
      {/* 발송 이력 */}
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
              <span style={{ fontSize: 14, flexShrink: 0 }}>{h.type === 'auto' ? '🤖' : '✉️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: TEXT, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.message}</div>
                <div style={{ fontSize: 11, color: SUB }}>{h.target}</div>
              </div>
              <div style={{ fontSize: 11, color: SUB, flexShrink: 0 }}>{timeAgo(h.created_at)}</div>
            </div>
          ))
        )}
      </div>
      {/* 카카오 알림톡 */}
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
    </div>
  )
}
