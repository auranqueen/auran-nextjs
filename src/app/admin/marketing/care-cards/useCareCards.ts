'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BodyCareCardRow, Draft, ProductPick } from './types'
import { rowToDraft, emptyDraft, buildCategoryTags, PHASES } from './types'

const API = '/api/admin/marketing/care-cards'

async function apiGet(query: string) {
  try {
    const res = await fetch(`${API}?${query}`)
    return await res.json()
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

async function apiPost(body: Record<string, unknown>) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export function useCareCards() {
  const [rows, setRows] = useState<BodyCareCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKey, setExpandedKey] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [pq, setPq] = useState('')
  const [picks, setPicks] = useState<ProductPick[]>([])
  const [productMeta, setProductMeta] = useState<Record<string, string>>({})

  const loadRows = useCallback(async () => {
    setLoading(true)
    const json = await apiGet('type=list')
    if (json.ok && json.data) setRows(json.data as BodyCareCardRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const loadMeta = useCallback(async (ids: string[]) => {
    const uniq = Array.from(new Set(ids.filter(Boolean)))
    if (uniq.length === 0) {
      setProductMeta({})
      return
    }
    const json = await apiGet(`type=product_names&ids=${encodeURIComponent(uniq.join(','))}`)
    const m: Record<string, string> = {}
    for (const r of (json.data as unknown[]) || []) {
      const p = r as ProductPick & { clean_name?: string | null }
      m[p.id] = p.clean_name || p.name
    }
    setProductMeta(m)
  }, [])

  useEffect(() => {
    if (!expandedKey) return
    void loadMeta(draft.product_ids)
  }, [expandedKey, draft.product_ids, loadMeta])

  useEffect(() => {
    const q = pq.trim()
    if (q.length < 1) {
      setPicks([])
      return
    }
    const t = setTimeout(() => {
      void apiGet(`type=product_search&q=${encodeURIComponent(q.slice(0, 80))}`)
        .then((json) => setPicks((json.data as ProductPick[]) || []))
    }, 220)
    return () => clearTimeout(t)
  }, [pq])

  const openRow = (row: BodyCareCardRow) => {
    if (expandedKey === row.id) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(row.id)
    setDraft(rowToDraft(row))
    setPq('')
    setPicks([])
  }

  const openNew = () => {
    if (expandedKey === 'new') {
      setExpandedKey(null)
      return
    }
    setExpandedKey('new')
    setDraft(emptyDraft())
    setPq('')
    setPicks([])
  }

  const phaseTagsPayload = (phase: (typeof PHASES)[number]): string[] => {
    if (phase === 'all') return ['all']
    return [phase]
  }

  const save = async () => {
    setSaving(true)
    try {
      const category_tags = buildCategoryTags(
        draft.extra_category_tags,
        draft.track,
        draft.skin_type,
        draft.skin_concern,
        draft.category
      )
      const payload = {
        title: draft.title.trim(),
        phase_tags: phaseTagsPayload(draft.phase),
        category: draft.category,
        category_tags,
        care: draft.care,
        quote: draft.quote,
        product_ids: draft.product_ids,
        is_active: draft.is_active,
        updated_at: new Date().toISOString(),
      }
      if (expandedKey === 'new' || !draft.id) {
        const json = await apiPost({ action: 'add', payload })
        if (!json.ok) {
          alert(json.error || 'error')
          return
        }
      } else {
        const json = await apiPost({ action: 'update', id: draft.id, payload })
        if (!json.ok) {
          alert(json.error || 'error')
          return
        }
      }
      await loadRows()
      setExpandedKey(null)
      setDraft(emptyDraft())
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft.id) return
    if (!window.confirm('이 카드를 삭제할까요?')) return
    const json = await apiPost({ action: 'delete', id: draft.id })
    if (!json.ok) {
      alert(json.error || 'error')
      return
    }
    await loadRows()
    setExpandedKey(null)
    setDraft(emptyDraft())
  }

  const addProduct = (p: ProductPick) => {
    if (draft.product_ids.includes(p.id)) return
    setDraft(prev => ({ ...prev, product_ids: [...prev.product_ids, p.id] }))
    setProductMeta(prev => ({ ...prev, [p.id]: (p as ProductPick & { clean_name?: string | null }).clean_name || p.name }))
    setPq('')
    setPicks([])
  }

  const removeProduct = (id: string) => {
    setDraft(prev => ({ ...prev, product_ids: prev.product_ids.filter(x => x !== id) }))
  }

  return {
    rows, loading, expandedKey, draft, setDraft, saving,
    pq, setPq, picks, productMeta,
    loadRows, openRow, openNew, save, remove, addProduct, removeProduct,
  }
}
