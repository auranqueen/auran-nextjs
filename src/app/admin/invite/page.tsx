'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type InviteRow = {
  id: string
  role: string
  code: string
  note?: string | null
  url: string
  used_count: number
  is_active: boolean
  created_at: string
}

const ROLES = [
  { role: 'customer', label: '고객', icon: '💧', color: 'var(--gold)' },
  { role: 'partner', label: '파트너스', icon: '💼', color: 'var(--blue)' },
  { role: 'owner', label: '원장님', icon: '🏥', color: 'var(--pink)' },
  { role: 'brand', label: '브랜드사', icon: '🏭', color: 'var(--green)' },
] as const

function makeCode(role: string) {
  const tail = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${role.slice(0, 3).toUpperCase()}-${tail}`
}

export default function AdminInvitePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<InviteRow[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalRole, setModalRole] = useState<(typeof ROLES)[number]['role']>('customer')
  const [modalNote, setModalNote] = useState('')
  const [modalUrl, setModalUrl] = useState('')
  const [modalMsg, setModalMsg] = useState('')

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://auran.kr'
    return window.location.origin.includes('localhost') ? 'https://auran.kr' : window.location.origin
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data } = await supabase.from('invite_links').select('*').order('created_at', { ascending: false }).limit(200)
      setRows((data || []) as any)
      setLoading(false)
    }
    run()
  }, [supabase])

  const template = (role: string, url: string, note: string) => {
    if (role === 'customer') return `[AURAN] ${note ? note + '\n' : ''}AI 피부 분석을 무료로 받아보세요 🌿\n\n피부 타입을 정확히 분석하고 맞춤 제품과 케어 루틴을 추천받으세요.\n\n👇 지금 무료 가입\n${url}\n\n분석 완료 시 500P 즉시 적립 🎁`
    if (role === 'partner') return `[AURAN 파트너스] ${note ? note + '\n' : ''}내 SNS가 수익 채널이 됩니다 💰\n\n추천 링크 공유 → 구매 시 커미션 자동 정산\n\n👇 파트너 가입 신청\n${url}`
    if (role === 'owner') return `[AURAN 원장님] ${note ? note + '\n' : ''}살롱 운영을 스마트하게 바꿔보세요 🏥\n\n✅ 예약 관리 자동화\n✅ 고객 피부 분석 데이터 확인\n✅ 제품 판매 커미션\n\n👇 원장님 등록 신청\n${url}`
    return `[AURAN 브랜드 입점] ${note ? note + '\n' : ''}전국 클리닉 살롱에 제품을 공급하세요 🧴\n\n✅ AI 피부 분석 자동 추천 노출\n✅ 전국 원장님 판매 채널\n\n👇 입점 신청\n${url}`
  }

  const openModal = async (role: (typeof ROLES)[number]['role']) => {
    setModalRole(role)
    setModalNote('')
    setModalUrl('')
    setModalMsg('')
    setModalOpen(true)
  }

  const generate = async () => {
    const code = makeCode(modalRole)
    const url = `${baseUrl}/join/${modalRole}?ref=${code}`
    const payload = { role: modalRole, code, note: modalNote || null, url, used_count: 0, is_active: true, created_at: new Date().toISOString() }
    const { error } = await supabase.from('invite_links').insert(payload)
    if (error) {
      alert(error.message)
      return
    }
    setModalUrl(url)
    setModalMsg(template(modalRole, url, modalNote))
    setRows(prev => [payload as any, ...prev])
  }

  const cp = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="alert alert-warn">
        ⚠️ 링크는 <span className="mono">/join/[role]?ref=CODE</span> 형식으로 생성됩니다. (테이블: <span className="mono">invite_links</span>)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
        {ROLES.map(r => (
          <div key={r.role} className="card">
            <div className="card-hdr">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <div>
                  <div className="card-title">{r.label} 초대</div>
                  <div className="card-sub">역할 전용 링크 생성</div>
                </div>
              </div>
              <button className="btn btn-gd" onClick={() => openModal(r.role)}>🔗 생성</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">🔗 초대 링크 목록</div>
            <div className="card-sub">최근 200개</div>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>역할</th>
                <th>코드</th>
                <th>메모</th>
                <th>사용</th>
                <th>활성</th>
                <th>생성일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id || r.code}>
                  <td><span className="b b-gy">{r.role}</span></td>
                  <td className="mono">{r.code}</td>
                  <td>{r.note || '-'}</td>
                  <td className="mono">{r.used_count || 0}</td>
                  <td><span className={`b ${r.is_active ? 'b-gr' : 'b-re'}`}>{r.is_active ? 'active' : 'off'}</span></td>
                  <td className="mono">{r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={6} style={{ color: 'var(--text3)' }}>링크가 없습니다.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div onClick={() => setModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderTop: '2px solid var(--gold)', borderRadius: 14, padding: 26, minWidth: 460, maxWidth: 600, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>🔗 초대 링크 · 발송 문구</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }}>{modalRole}</div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19 }}>×</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>메모(선택)</div>
              <input value={modalNote} onChange={e => setModalNote(e.target.value)} placeholder="예) 3월 원장님 모임" style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '8px 11px', outline: 'none' }} />
            </div>

            <div style={{ marginTop: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 13px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--gold)' }}>
              {modalUrl || '생성 전'}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>카카오톡 / 문자 발송 문구</div>
              <textarea value={modalMsg} onChange={e => setModalMsg(e.target.value)} rows={8} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '10px 11px', outline: 'none', lineHeight: 1.7, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-gy" onClick={() => setModalOpen(false)}>닫기</button>
              <button className="btn btn-gy" onClick={() => cp(modalUrl)}>📋 링크 복사</button>
              <button className="btn btn-gd" onClick={() => cp(modalMsg)}>💬 문구 복사</button>
              <button className="btn btn-gr" onClick={generate}>🔗 생성</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

