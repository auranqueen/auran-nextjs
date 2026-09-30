'use client'

import { useState } from 'react'
import type { Tpl } from './types'

async function apiPost(action: string, extra?: Record<string, unknown>) {
  const res = await fetch('/api/admin/membership/curate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  return res.json().catch(() => ({}))
}

export function useTemplates(initialTemplates: Tpl[]) {
  const [templates, setTemplates] = useState<Tpl[]>(initialTemplates)
  const [showTplPanel, setShowTplPanel] = useState(false)
  const [editTpl, setEditTpl] = useState<Tpl | null>(null)
  const [tplSearch, setTplSearch] = useState('')
  const [tplSearchResults, setTplSearchResults] = useState<{ id: string; name: string }[]>([])
  const [savingTpl, setSavingTpl] = useState(false)
  const [tplMsg, setTplMsg] = useState('')

  const searchProducts = async (q: string) => {
    if (q.length < 2) { setTplSearchResults([]); return }
    const res = await fetch(`/api/admin/membership/curate?type=product_search&q=${encodeURIComponent(q)}`)
    const json = await res.json().catch(() => ({}))
    setTplSearchResults(json.data || [])
  }

  const saveTpl = async () => {
    if (!editTpl) return
    setSavingTpl(true); setTplMsg('')
    const json = await apiPost('save_tpl', {
      id: editTpl.id,
      theme_name: editTpl.theme_name,
      target_phase: editTpl.target_phase,
      product_ids: editTpl.product_ids,
      usage_guide: editTpl.usage_guide,
      owner_tip: editTpl.owner_tip,
      is_active: editTpl.is_active,
      target_gender: editTpl.target_gender || 'all',
    })
    setSavingTpl(false)
    if (!json.ok) { setTplMsg('저장 실패: ' + (json.error || '')); return }
    setTemplates(ts => ts.map(t => t.id === editTpl.id ? editTpl : t))
    setTplMsg('저장됐어요 ✓'); setEditTpl(null)
  }

  const addTpl = async () => {
    const json = await apiPost('add_tpl')
    if (json.ok && json.data) {
      const newTpl = json.data as Tpl
      setTemplates(ts => [...ts, newTpl])
      setEditTpl(newTpl)
    }
  }

  const deleteTpl = async (id: string) => {
    if (!confirm('템플릿을 삭제할까요?')) return
    const json = await apiPost('delete_tpl', { id })
    if (!json.ok) { setTplMsg('삭제 실패'); return }
    setTemplates(ts => ts.filter(t => t.id !== id))
    setTplMsg('✓ 삭제됐어요')
  }

  return {
    templates, setTemplates,
    showTplPanel, setShowTplPanel,
    editTpl, setEditTpl,
    tplSearch, setTplSearch,
    tplSearchResults, setTplSearchResults,
    savingTpl, tplMsg, setTplMsg,
    searchProducts, saveTpl, addTpl, deleteTpl,
  }
}
