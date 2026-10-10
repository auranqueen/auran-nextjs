'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type RequestStatus = 'pending' | 'approved' | 'rejected'

export type GroupBuyRequestRow = {
  id: string
  requester_id: string
  product_id: string
  message: string | null
  desired_start_at: string | null
  desired_end_at: string | null
  status: RequestStatus
  admin_note: string | null
  created_at: string
  products: {
    name: string | null
    brand_id: string | null
    brands: { name: string | null; brand_name_kr: string | null } | null
  } | null
}

const TABS: { value: RequestStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '거절' },
]

const chip = (active: boolean) => ({
  padding: '8px 12px',
  borderRadius: 8,
  border: active ? '1px solid #c9a84c' : '1px solid #e5e5e5',
  background: active ? 'rgba(201,169,110,0.15)' : '#f8f8f8',
  color: active ? '#c9a84c' : '#111111',
  fontSize: 12,
  fontWeight: 400,
  cursor: 'pointer',
})

const actionBtn = (bg: string, color: string) => ({
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  background: bg,
  color,
  fontSize: 12,
  fontWeight: 400,
  cursor: 'pointer',
})

const nameOf = (p: Record<string, unknown> | undefined) =>
  String(p?.full_name || p?.name || p?.nickname || p?.email || '큐레이터')

export default function GroupBuyRequestsSheet({
  isOpen,
  onClose,
  onApprove,
  onChanged,
}: {
  isOpen: boolean
  onClose: () => void
  onApprove: (request: GroupBuyRequestRow) => void
  onChanged?: () => void
}) {
  const supabase = createClient()
  const [tab, setTab] = useState<RequestStatus>('pending')
  const [rows, setRows] = useState<GroupBuyRequestRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('group_buy_requests')
      .select('id, requester_id, product_id, message, desired_start_at, desired_end_at, status, admin_note, created_at, products(name, brand_id, brands(name, brand_name_kr))')
      .eq('status', tab)
      .order('created_at', { ascending: false })
    if (error) {
      setLoading(false)
      alert(error.message)
      return
    }
    const list = (data as unknown as GroupBuyRequestRow[]) || []
    setRows(list)
    const ids = Array.from(new Set(list.map(r => r.requester_id)))
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('*').in('auth_id', ids)
      const map: Record<string, string> = {}
      for (const p of (profs as Record<string, unknown>[]) || []) map[String(p.auth_id)] = nameOf(p)
      setNames(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, tab])

  const approve = async (r: GroupBuyRequestRow) => {
    setBusyId(r.id)
    const { error } = await supabase.from('group_buy_requests').update({ status: 'approved' } as any).eq('id', r.id)
    setBusyId(null)
    if (error) {
      alert(error.message)
      return
    }
    onChanged?.()
    onApprove(r)
    void load()
  }

  const reject = async (r: GroupBuyRequestRow) => {
    setBusyId(r.id)
    const { error } = await supabase
      .from('group_buy_requests')
      .update({ status: 'rejected', admin_note: note.trim() || null } as any)
      .eq('id', r.id)
    setBusyId(null)
    if (error) {
      alert(error.message)
      return
    }
    setRejectingId(null)
    setNote('')
    onChanged?.()
    void load()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          left: 0,
          bottom: 0,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 221,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e5e5',
          borderRadius: '16px 16px 0 0',
          color: '#111111',
          colorScheme: 'light',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', maxWidth: 560, margin: '0 auto', padding: '18px 18px 28px' }}>
          <div style={{ backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ backgroundColor: '#ffffff', fontSize: 16, color: '#c9a84c' }}>공구 요청</div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', color: '#666666', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
            >
              ×
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', display: 'flex', gap: 6, marginBottom: 14 }}>
            {TABS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTab(t.value)
                  setRejectingId(null)
                  setNote('')
                }}
                style={chip(tab === t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ backgroundColor: '#ffffff', fontSize: 12, color: '#666666' }}>불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', fontSize: 12, color: '#666666' }}>요청이 없습니다.</div>
          ) : (
            <div style={{ backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(r => (
                <div key={r.id} style={{ backgroundColor: '#f8f8f8', border: '1px solid #e5e5e5', borderRadius: 10, padding: 12 }}>
                  {(r.products?.brands?.brand_name_kr || r.products?.brands?.name) && (
                    <div style={{ backgroundColor: '#f8f8f8', fontSize: 12, color: '#888888', marginBottom: 2 }}>
                      {r.products?.brands?.brand_name_kr || r.products?.brands?.name}
                    </div>
                  )}
                  <div style={{ backgroundColor: '#f8f8f8', fontSize: 13, color: '#111111' }}>{r.products?.name || '제품 정보 없음'}</div>
                  <div style={{ backgroundColor: '#f8f8f8', fontSize: 11, color: '#666666', marginTop: 4 }}>
                    희망기간 {r.desired_start_at || '-'} ~ {r.desired_end_at || '-'}
                  </div>
                  <div style={{ backgroundColor: '#f8f8f8', fontSize: 12, color: '#111111', marginTop: 8 }}>
                    {names[r.requester_id] || '에디터'}
                    <span style={{ fontSize: 11, color: '#666666', marginLeft: 6 }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {r.message ? (
                    <div style={{ backgroundColor: '#f8f8f8', fontSize: 12, color: '#333333', marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.message}</div>
                  ) : null}
                  {r.status === 'rejected' && r.admin_note ? (
                    <div style={{ backgroundColor: '#f8f8f8', fontSize: 11, color: '#b94a48', marginTop: 6 }}>거절 사유: {r.admin_note}</div>
                  ) : null}

                  {r.status === 'pending' && rejectingId !== r.id ? (
                    <div style={{ backgroundColor: '#f8f8f8', display: 'flex', gap: 6, marginTop: 10 }}>
                      <button type="button" disabled={busyId === r.id} onClick={() => void approve(r)} style={actionBtn('#C9A96E', '#111111')}>
                        승인
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => {
                          setRejectingId(r.id)
                          setNote('')
                        }}
                        style={actionBtn('#ffffff', '#b94a48')}
                      >
                        거절
                      </button>
                    </div>
                  ) : null}

                  {r.status === 'pending' && rejectingId === r.id ? (
                    <div style={{ backgroundColor: '#f8f8f8', marginTop: 10 }}>
                      <input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="큐레이터에게 전달될 거절 사유를 입력하세요"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #e5e5e5', color: '#111111', fontSize: 12, boxSizing: 'border-box' }}
                      />
                      <div style={{ backgroundColor: '#f8f8f8', display: 'flex', gap: 6, marginTop: 6 }}>
                        <button type="button" disabled={busyId === r.id} onClick={() => void reject(r)} style={actionBtn('#b94a48', '#ffffff')}>
                          거절 확정
                        </button>
                        <button type="button" onClick={() => setRejectingId(null)} style={actionBtn('#ffffff', '#111111')}>
                          취소
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {r.status === 'approved' ? (
                    <div style={{ backgroundColor: '#f8f8f8', marginTop: 10 }}>
                      <button type="button" onClick={() => onApprove(r)} style={actionBtn('#ffffff', '#111111')}>
                        공구 등록 열기
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
