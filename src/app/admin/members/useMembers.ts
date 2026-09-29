'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Member, Plan } from './types'

export async function membersApi(action: string, extra?: Record<string, unknown>) {
  try {
    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok && !json?.error) return { error: `request_failed (${res.status})` }
    return json
  } catch (e: any) {
    return { error: e?.message || 'network_error' }
  }
}

export function useMembers() {
  const sp = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [planList, setPlanList] = useState<Plan[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [approving, setApproving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const json = await membersApi('init')
    if (json?.error) console.error('[admin/members] init:', json.error)
    setMembers((json?.members || []) as Member[])
    setPlanList((json?.plans || []) as Plan[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const urlQ = (sp.get('q') || '').trim()
    if (urlQ) setQ(urlQ)
  }, [sp])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const role = (sp.get('role') || '').trim().toLowerCase()
    const roleFiltered = role ? members.filter(m => (m.role || '').toLowerCase() === role) : members
    if (!s) return roleFiltered
    return roleFiltered.filter(m =>
      (m.name || '').toLowerCase().includes(s) ||
      (m.email || '').toLowerCase().includes(s) ||
      (m.role || '').toLowerCase().includes(s)
    )
  }, [members, q, sp])

  const patchMember = useCallback((id: string, patch: Partial<Member>) => {
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)))
    setSelected(prev => (prev?.id === id ? { ...prev, ...patch } : prev))
  }, [])

  const suspend = async (m: Member) => {
    if (!confirm(`${m.name} (${m.email}) 계정을 정지할까요?`)) return
    const { error } = await membersApi('setStatus', { memberId: m.id, status: 'suspended' })
    if (error) {
      alert(error)
      return
    }
    patchMember(m.id, { status: 'suspended' })
  }

  const activate = async (m: Member) => {
    const { error } = await membersApi('setStatus', { memberId: m.id, status: 'active' })
    if (error) {
      alert(error)
      return
    }
    patchMember(m.id, { status: 'active' })
  }

  const toggleFounder = async (m: Member) => {
    const next = !m.is_founder
    const { error } = await membersApi('toggleFounder', { memberId: m.id, value: next })
    if (error) {
      alert(error)
      return
    }
    patchMember(m.id, { is_founder: next })
  }

  const approvePending = async (m: Member) => {
    if (!confirm(`${m.name} (${m.email}) 계정을 승인(활성화)할까요?`)) return
    setApproving(true)
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_id: m.auth_id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) throw new Error(json?.error || json?.reason || 'approve_failed')
      patchMember(m.id, { status: 'active' })
      alert('✅ 승인 완료')
    } catch (e: any) {
      alert(e?.message || '승인 중 오류가 발생했습니다.')
    } finally {
      setApproving(false)
    }
  }

  return {
    members, filtered, loading, q, setQ, planList, approving,
    selected, setSelected, load, patchMember, suspend, activate, toggleFounder, approvePending,
  }
}
