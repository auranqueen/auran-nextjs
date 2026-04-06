'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Cat = {
  id: string
  name: string
  parent_id: string | null
  level: number
  sort_order: number | null
  target_tracks?: string[] | null
  banner_image_url?: string | null
  banner_text?: string | null
  banner_link?: string | null
}

type FlatRow = Cat & { depth: number }

export default function AdminCategoriesPage() {
  const supabase = createClient()
  const [committedRows, setCommittedRows] = useState<Cat[]>([])
  const [rows, setRows] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<Cat | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [sheetSort, setSheetSort] = useState('0')
  const [sheetTracks, setSheetTracks] = useState<string[]>([])
  const [sheetBannerImage, setSheetBannerImage] = useState('')
  const [sheetBannerText, setSheetBannerText] = useState('')
  const [sheetBannerLink, setSheetBannerLink] = useState('')
  const [viewTab, setViewTab] = useState<'category' | 'skin' | 'natural' | 'questions'>('category')
  const [selL1, setSelL1] = useState('')
  const [selL2, setSelL2] = useState('')
  const [selL3, setSelL3] = useState('')
  const [selL4, setSelL4] = useState('')
  const [selL5, setSelL5] = useState('')
  const [naturalRows, setNaturalRows] = useState<{ keyword: string; total: number; promoted: boolean }[]>([])
  const [questionRows, setQuestionRows] = useState<any[]>([])
  const [questionSaving, setQuestionSaving] = useState(false)
  const [questionSheet, setQuestionSheet] = useState<any | null>(null)

  const loadRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,parent_id,level,sort_order,target_tracks,banner_image_url,banner_text,banner_link')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
    if (error) {
      setToast(error.message)
      setCommittedRows([])
      setRows([])
      return
    }
    const list = (data || []) as Cat[]
    setCommittedRows(list)
    setRows(list)
  }, [])

  const loadNatural = useCallback(async () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data } = await supabase
      .from('customer_search_logs')
      .select('search_keyword,count,is_promoted,created_at,source')
      .eq('source', '검색')
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(400)
    const map = new Map<string, { total: number; promoted: boolean }>()
    for (const r of data || []) {
      const k = String((r as any).search_keyword || '').trim()
      if (!k) continue
      const cur = map.get(k) || { total: 0, promoted: false }
      cur.total += Math.max(1, Number((r as any).count || 1))
      cur.promoted = cur.promoted || Boolean((r as any).is_promoted)
      map.set(k, cur)
    }
    const merged = Array.from(map.entries())
      .map(([keyword, v]) => ({ keyword, total: v.total, promoted: v.promoted }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
    setNaturalRows(merged)
  }, [])

  const loadQuestions = useCallback(async () => {
    const { data } = await supabase
      .from('customer_questions')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setQuestionRows(data || [])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await loadRows()
      await loadNatural()
      await loadQuestions()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadRows, loadQuestions])

  const flatRows = useMemo(() => {
    const byParent = new Map<string | null, Cat[]>()
    for (const c of rows) {
      const k = c.parent_id == null || c.parent_id === '' ? null : String(c.parent_id)
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(c)
    }
    byParent.forEach(arr => {
      arr.sort((a: Cat, b: Cat) => {
        const sa = a.sort_order ?? 0
        const sb = b.sort_order ?? 0
        if (sa !== sb) return sa - sb
        return (a.name || '').localeCompare(b.name || '', 'ko')
      })
    })
    const out: FlatRow[] = []
    const walk = (parentId: string | null, depth: number) => {
      const ch = byParent.get(parentId) || []
      for (const c of ch) {
        out.push({ ...c, depth })
        walk(String(c.id), depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [rows])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const sa = a.sort_order ?? 0
      const sb = b.sort_order ?? 0
      if (sa !== sb) return sa - sb
      return (a.name || '').localeCompare(b.name || '', 'ko')
    })
  }, [rows])

  const l1Rows = useMemo(
    () => sortedRows.filter(r => (r.parent_id == null || r.parent_id === '') && Number(r.level || 0) === 1),
    [sortedRows]
  )
  const l2Rows = useMemo(() => (selL1 ? sortedRows.filter(r => String(r.parent_id || '') === selL1) : []), [sortedRows, selL1])
  const l3Rows = useMemo(() => (selL2 ? sortedRows.filter(r => String(r.parent_id || '') === selL2) : []), [sortedRows, selL2])
  const l4Rows = useMemo(() => (selL3 ? sortedRows.filter(r => String(r.parent_id || '') === selL3) : []), [sortedRows, selL3])
  const l5Rows = useMemo(() => (selL4 ? sortedRows.filter(r => String(r.parent_id || '') === selL4) : []), [sortedRows, selL4])
  const skinTagRows = useMemo(
    () => sortedRows.filter(r => Number(r.level || 0) === 5 && (r.parent_id == null || r.parent_id === '')),
    [sortedRows]
  )

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const openSheet = (c: Cat) => {
    setSheet(c)
    setSheetName(c.name || '')
    setSheetSort(String(c.sort_order ?? 0))
    setSheetTracks(Array.isArray(c.target_tracks) ? c.target_tracks.map(x => String(x)) : ['all'])
    setSheetBannerImage(String(c.banner_image_url || ''))
    setSheetBannerText(String(c.banner_text || ''))
    setSheetBannerLink(String(c.banner_link || ''))
  }

  const closeSheet = () => {
    setSheet(null)
    setSheetName('')
    setSheetSort('0')
    setSheetTracks([])
    setSheetBannerImage('')
    setSheetBannerText('')
    setSheetBannerLink('')
  }

  const confirmSheet = () => {
    if (!sheet) return
    const so = Math.floor(Number(sheetSort) || 0)
    const nm = sheetName.trim() || '이름 없음'
    setRows(prev =>
      prev.map(r =>
        r.id === sheet.id
          ? {
              ...r,
              name: nm,
              sort_order: so,
              target_tracks: sheetTracks,
              banner_image_url: sheetBannerImage.trim() || null,
              banner_text: sheetBannerText.trim() || null,
              banner_link: sheetBannerLink.trim() || null,
            }
          : r
      )
    )
    closeSheet()
  }

  const deleteSheetSubtree = () => {
    if (!sheet) return
    const root = sheet.id
    const ids = new Set<string>([root])
    let grow = true
    while (grow) {
      grow = false
      for (const r of rows) {
        const pid = r.parent_id == null || r.parent_id === '' ? '' : String(r.parent_id)
        if (pid && ids.has(pid) && !ids.has(r.id)) {
          ids.add(r.id)
          grow = true
        }
      }
    }
    setRows(prev => prev.filter(r => !ids.has(r.id)))
    closeSheet()
  }

  const addRoot = () => {
    const siblings = rows.filter(r => r.parent_id == null || r.parent_id === '')
    const maxSort = siblings.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1)
    const id = crypto.randomUUID()
    setRows(prev => [
      ...prev,
      { id, name: '새 대분류', parent_id: null, level: 1, sort_order: maxSort + 1, target_tracks: ['all'] },
    ])
  }

  const addChild = (parent: Cat) => {
    if ((parent.level ?? 1) >= 5) return
    const siblings = rows.filter(r => String(r.parent_id || '') === String(parent.id))
    const maxSort = siblings.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1)
    const nextLevel = (parent.level ?? 1) + 1
    const id = crypto.randomUUID()
    setRows(prev => [
      ...prev,
      {
        id,
        name: '새 하위',
        parent_id: parent.id,
        level: nextLevel,
        sort_order: maxSort + 1,
        target_tracks: ['all'],
      },
    ])
  }

  const moveRow = (c: Cat, dir: -1 | 1) => {
    const pid = c.parent_id == null || c.parent_id === '' ? null : String(c.parent_id)
    const siblings = rows
      .filter(r => {
        const rp = r.parent_id == null || r.parent_id === '' ? null : String(r.parent_id)
        return rp === pid
      })
      .sort((a, b) => {
        const sa = a.sort_order ?? 0
        const sb = b.sort_order ?? 0
        if (sa !== sb) return sa - sb
        return (a.name || '').localeCompare(b.name || '', 'ko')
      })
    const i = siblings.findIndex(s => s.id === c.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= siblings.length) return
    const a = siblings[i]
    const b = siblings[j]
    const sa = a.sort_order ?? i
    const sb = b.sort_order ?? j
    setRows(prev =>
      prev.map(r => {
        if (r.id === a.id) return { ...r, sort_order: sb }
        if (r.id === b.id) return { ...r, sort_order: sa }
        return r
      })
    )
  }

  const applyDraft = async () => {
    if (applying) return
    setApplying(true)
    try {
      const serverById = new Map(committedRows.map(r => [r.id, r]))
      const draftById = new Map(rows.map(r => [r.id, r]))

      const pidEq = (a: string | null | undefined, b: string | null | undefined) =>
        (a == null || a === '' ? '' : String(a)) === (b == null || b === '' ? '' : String(b))

      const toDelete = committedRows
        .filter(cr => !draftById.has(cr.id))
        .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
      for (const r of toDelete) {
        const { error } = await supabase.from('categories').delete().eq('id', r.id)
        if (error) throw new Error(error.message)
      }

      const toInsert = rows.filter(dr => !serverById.has(dr.id)).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      for (const r of toInsert) {
        const { error } = await supabase.from('categories').insert({
          id: r.id,
          name: r.name,
          parent_id: r.parent_id,
          level: r.level,
          sort_order: r.sort_order ?? 0,
          target_tracks: Array.isArray(r.target_tracks) && r.target_tracks.length > 0 ? r.target_tracks : ['all'],
          banner_image_url: r.banner_image_url ?? null,
          banner_text: r.banner_text ?? null,
          banner_link: r.banner_link ?? null,
        } as any)
        if (error) throw new Error(error.message)
      }

      for (const r of rows) {
        if (!serverById.has(r.id)) continue
        const prev = serverById.get(r.id)!
        if (
          prev.name === r.name &&
          (prev.sort_order ?? 0) === (r.sort_order ?? 0) &&
          pidEq(prev.parent_id, r.parent_id) &&
          (prev.level ?? 0) === (r.level ?? 0) &&
          JSON.stringify((prev.target_tracks || []).slice().sort()) === JSON.stringify((r.target_tracks || []).slice().sort()) &&
          String(prev.banner_image_url || '') === String(r.banner_image_url || '') &&
          String(prev.banner_text || '') === String(r.banner_text || '') &&
          String(prev.banner_link || '') === String(r.banner_link || '')
        ) {
          continue
        }
        const { error } = await supabase
          .from('categories')
          .update({
            name: r.name,
            sort_order: r.sort_order ?? 0,
            parent_id: r.parent_id,
            level: r.level,
            target_tracks: Array.isArray(r.target_tracks) && r.target_tracks.length > 0 ? r.target_tracks : ['all'],
            banner_image_url: r.banner_image_url ?? null,
            banner_text: r.banner_text ?? null,
            banner_link: r.banner_link ?? null,
          } as any)
          .eq('id', r.id)
        if (error) throw new Error(error.message)
      }

      await loadRows()
      await loadNatural()
      showToast('적용되었습니다')
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : '적용 실패')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div style={{ padding: '18px 16px 100px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>카테고리 관리</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, lineHeight: 1.5 }}>
          대 → 중 → 소 → 세부 → 스킨태그 (5단계) · 수정·추가·삭제·순서 변경 후 하단{' '}
          <span style={{ color: '#c9a84c', fontWeight: 800 }}>적용</span>을 눌러 DB에 반영합니다
        </div>
      </div>

      {toast ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.35)',
            color: '#e8d4a8',
            fontSize: 12,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {([
          ['category', '카테고리 선택'],
          ['skin', '스킨태그'],
          ['natural', '고객 자연어'],
          ['questions', '고객 질문'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setViewTab(k)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: viewTab === k ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.12)',
              background: viewTab === k ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
              color: viewTab === k ? '#c9a84c' : '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>불러오는 중…</div>
      ) : (
        <>
          {viewTab === 'category' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  { title: '1단계', list: l1Rows, sel: selL1, setSel: setSelL1, parent: null as string | null },
                  { title: '2단계', list: l2Rows, sel: selL2, setSel: setSelL2, parent: selL1 || null },
                  { title: '3단계', list: l3Rows, sel: selL3, setSel: setSelL3, parent: selL2 || null },
                  { title: '4단계', list: l4Rows, sel: selL4, setSel: setSelL4, parent: selL3 || null },
                  { title: '5단계', list: l5Rows, sel: selL5, setSel: setSelL5, parent: selL4 || null },
                ].map(col => (
                  <div
                    key={col.title}
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      minHeight: 320,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: '10px 10px 8px', fontSize: 12, color: '#fff', fontWeight: 800 }}>{col.title}</div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', display: 'grid', gap: 6 }}>
                      {col.list.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '8px 4px' }}>항목 없음</div>
                      ) : (
                        col.list.map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              borderRadius: 8,
                              border: '1px solid rgba(255,255,255,0.1)',
                              background: col.sel === item.id ? 'rgba(201,168,76,0.16)' : 'rgba(255,255,255,0.03)',
                              padding: '8px 8px',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                col.setSel(item.id)
                                if (col.title === '1단계') {
                                  setSelL2('')
                                  setSelL3('')
                                  setSelL4('')
                                  setSelL5('')
                                }
                                if (col.title === '2단계') {
                                  setSelL3('')
                                  setSelL4('')
                                  setSelL5('')
                                }
                                if (col.title === '3단계') {
                                  setSelL4('')
                                  setSelL5('')
                                }
                                if (col.title === '4단계') setSelL5('')
                              }}
                              style={{
                                flex: 1,
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              {item.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => openSheet(item)}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: '1px solid rgba(123,94,167,0.4)',
                                background: 'rgba(123,94,167,0.18)',
                                color: '#d2b8ff',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = new Set<string>([item.id])
                                let grow = true
                                while (grow) {
                                  grow = false
                                  for (const r of rows) {
                                    const pid = r.parent_id == null || r.parent_id === '' ? '' : String(r.parent_id)
                                    if (pid && ids.has(pid) && !ids.has(r.id)) {
                                      ids.add(r.id)
                                      grow = true
                                    }
                                  }
                                }
                                setRows(prev => prev.filter(r => !ids.has(r.id)))
                              }}
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                border: '1px solid rgba(239,83,80,0.38)',
                                background: 'rgba(239,83,80,0.14)',
                                color: '#ef9a9a',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              🗑
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!col.parent && col.title === '1단계') {
                          addRoot()
                          return
                        }
                        const parent = rows.find(r => r.id === String(col.parent))
                        if (parent) addChild(parent)
                      }}
                      style={{
                        margin: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(76,173,126,0.38)',
                        background: 'rgba(76,173,126,0.12)',
                        color: '#7dce9a',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      + 추가
                    </button>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.03)',
                  fontSize: 12,
                  color: '#e8d4a8',
                }}
              >
                선택 경로:{' '}
                {([selL1, selL2, selL3, selL4, selL5] as string[])
                  .filter(Boolean)
                  .map(id => rows.find(r => r.id === id)?.name || '')
                  .filter(Boolean)
                  .join(' > ') || '미선택'}
              </div>
            </div>
          ) : null}

          {viewTab === 'skin' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {skinTagRows.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>스킨태그가 없습니다.</div>
              ) : (
                skinTagRows.map(row => (
                  <div
                    key={row.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 10px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ flex: 1, fontSize: 13, color: '#fff' }}>{row.name}</div>
                    <button
                      type="button"
                      onClick={() => openSheet(row)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: '1px solid rgba(123,94,167,0.4)',
                        background: 'rgba(123,94,167,0.18)',
                        color: '#d2b8ff',
                        cursor: 'pointer',
                      }}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = new Set<string>([row.id])
                        let grow = true
                        while (grow) {
                          grow = false
                          for (const r of rows) {
                            const pid = r.parent_id == null || r.parent_id === '' ? '' : String(r.parent_id)
                            if (pid && ids.has(pid) && !ids.has(r.id)) {
                              ids.add(r.id)
                              grow = true
                            }
                          }
                        }
                        setRows(prev => prev.filter(r => !ids.has(r.id)))
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        border: '1px solid rgba(239,83,80,0.38)',
                        background: 'rgba(239,83,80,0.14)',
                        color: '#ef9a9a',
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() => {
                  const siblings = rows.filter(r => Number(r.level || 0) === 5 && (r.parent_id == null || r.parent_id === ''))
                  const maxSort = siblings.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1)
                  const id = crypto.randomUUID()
                  setRows(prev => [...prev, { id, name: '새 스킨태그', parent_id: null, level: 5, sort_order: maxSort + 1, target_tracks: ['all'] }])
                }}
                style={{
                  marginTop: 6,
                  alignSelf: 'flex-start',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(76,173,126,0.38)',
                  background: 'rgba(76,173,126,0.12)',
                  color: '#7dce9a',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + 추가
              </button>
            </div>
          ) : null}

          {viewTab === 'natural' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {naturalRows.length === 0 ? (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>이번 달 검색 키워드가 없습니다.</div>
              ) : (
                naturalRows.map((r, idx) => (
                  <div
                    key={r.keyword}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      padding: '10px 10px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ width: 28, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{idx + 1}</div>
                    <div style={{ flex: 1, fontSize: 13, color: '#fff' }}>{r.keyword}</div>
                    <div style={{ fontSize: 11, color: '#c9a84c', minWidth: 52, textAlign: 'right' }}>{r.total}회</div>
                    <button
                      type="button"
                      onClick={async () => {
                        const exists = rows.some(
                          x => Number(x.level || 0) === 5 && (x.parent_id == null || x.parent_id === '') && x.name === r.keyword
                        )
                        if (!exists) {
                          const maxSort = rows
                            .filter(x => Number(x.level || 0) === 5 && (x.parent_id == null || x.parent_id === ''))
                            .reduce((m, x) => Math.max(m, x.sort_order ?? 0), -1)
                          const id = crypto.randomUUID()
                          setRows(prev => [...prev, { id, name: r.keyword, parent_id: null, level: 5, sort_order: maxSort + 1 }])
                        }
                        await supabase
                          .from('customer_search_logs')
                          .update({ is_promoted: true })
                          .eq('search_keyword', r.keyword)
                          .eq('source', '검색')
                        await loadNatural()
                        showToast('공식 태그풀로 승격했습니다')
                      }}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 8,
                        border: '1px solid rgba(201,168,76,0.4)',
                        background: 'rgba(201,168,76,0.16)',
                        color: '#e8d4a8',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      승격
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase
                          .from('customer_search_logs')
                          .update({ is_promoted: false })
                          .eq('search_keyword', r.keyword)
                          .eq('source', '검색')
                        await loadNatural()
                        showToast('비활성 처리했습니다')
                      }}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      비활성
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.from('customer_search_logs').delete().eq('search_keyword', r.keyword).eq('source', '검색')
                        await loadNatural()
                        showToast('삭제했습니다')
                      }}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 8,
                        border: '1px solid rgba(239,83,80,0.4)',
                        background: 'rgba(239,83,80,0.14)',
                        color: '#ef9a9a',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
          {viewTab === 'questions' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    setQuestionRows(prev => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        question_text: '새 질문',
                        question_type: 'daily',
                        target_tracks: ['all'],
                        answer_type: 'options',
                        options: ['선택지1', '선택지2'],
                        post_purchase_days: null,
                        sort_order: prev.length,
                        is_active: true,
                      },
                    ])
                  }
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(76,173,126,0.38)', background: 'rgba(76,173,126,0.12)', color: '#7dce9a', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  + 질문 추가
                </button>
                <button
                  type="button"
                  disabled={questionSaving}
                  onClick={async () => {
                    setQuestionSaving(true)
                    try {
                      for (const q of questionRows) {
                        const payload = {
                          id: q.id,
                          question_text: q.question_text,
                          question_type: q.question_type,
                          target_tracks: Array.isArray(q.target_tracks) && q.target_tracks.length > 0 ? q.target_tracks : ['all'],
                          answer_type: q.answer_type,
                          options: Array.isArray(q.options) ? q.options : String(q.options || '').split(',').map((s: string) => s.trim()).filter(Boolean),
                          post_purchase_days: q.question_type === 'post_purchase' ? Math.max(0, Number(q.post_purchase_days || 0)) : null,
                          sort_order: Number(q.sort_order || 0),
                          is_active: q.is_active !== false,
                        }
                        await supabase.from('customer_questions').upsert(payload as any, { onConflict: 'id' })
                      }
                      await loadQuestions()
                      showToast('질문 적용 완료')
                    } finally {
                      setQuestionSaving(false)
                    }
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.42)', background: 'rgba(201,168,76,0.15)', color: '#e8d4a8', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  적용
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.from('customer_questions').upsert([
                      { question_text: '오늘 잠을 몇 시간 주무셨어요?', question_type: 'daily', target_tracks: ['all'], answer_type: 'options', options: ['4시간이하', '5~6시간', '7~8시간', '9시간이상'], sort_order: 1, is_active: true },
                      { question_text: '이번 주 스트레스 어때요?', question_type: 'daily', target_tracks: ['all'], answer_type: 'options', options: ['매우높음', '높음', '보통', '낮음'], sort_order: 2, is_active: true },
                      { question_text: '이 제품 사용 후 피부 변화 느끼셨나요?', question_type: 'post_purchase', target_tracks: ['all'], answer_type: 'options', options: ['좋아졌어요', '그대로예요', '안맞아요'], post_purchase_days: 3, sort_order: 3, is_active: true },
                      { question_text: '이번 달 피부 전반적으로 어떠셨나요?', question_type: 'monthly', target_tracks: ['all'], answer_type: 'options', options: ['좋았어요', '보통이었어요', '힘들었어요'], sort_order: 4, is_active: true },
                    ] as any)
                    await loadQuestions()
                    showToast('기본 질문 INSERT 완료')
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.42)', background: 'rgba(123,94,167,0.15)', color: '#d7c4f2', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  기본 질문 INSERT
                </button>
              </div>
              {questionRows.map((q, i) => (
                <div key={q.id || i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ width: 22, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.question_text}
                  </div>
                  <div style={{ fontSize: 11, color: '#c9a84c' }}>{q.question_type}</div>
                  <button
                    type="button"
                    onClick={() => setQuestionSheet({ ...q, idx: i, optionsText: Array.isArray(q.options) ? q.options.join('\n') : String(q.options || '') })}
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.18)', color: '#d2b8ff', cursor: 'pointer' }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionRows(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,83,80,0.38)', background: 'rgba(239,83,80,0.14)', color: '#ef9a9a', cursor: 'pointer' }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {viewTab === 'natural' ? (
            <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: '#fff', marginBottom: 8 }}>툴팁 키 관리</div>
              <button
                type="button"
                onClick={async () => {
                  await supabase.from('help_tooltips').upsert([
                    { key: 'period_start', content: '생리 시작 기록 안내' },
                    { key: 'hormone_phase', content: '호르몬 단계 설명' },
                    { key: 'checkin', content: '체크인 안내' },
                    { key: 'golden_period', content: '황금기란?' },
                    { key: 'points', content: '포인트란?' },
                    { key: 'grade', content: '등급 안내' },
                    { key: 'routine_step', content: '루틴 단계 안내' },
                  ] as any, { onConflict: 'key' })
                  showToast('기본 툴팁 데이터를 넣었습니다')
                }}
                style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.15)', color: '#e8d4a8', fontSize: 11, cursor: 'pointer' }}
              >
                기본 툴팁 INSERT
              </button>
              {['period_start','hormone_phase','checkin','golden_period','points','grade','routine_step'].map(k => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{k}</div>
                  <input
                    defaultValue=""
                    placeholder="툴팁 텍스트"
                    onBlur={async e => {
                      const v = e.target.value.trim()
                      if (!v) return
                      await supabase.from('help_tooltips').upsert({ key: k, content: v } as any, { onConflict: 'key' })
                      showToast('툴팁 저장')
                    }}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const { data } = await supabase.from('help_tooltips').select('content,text,value').eq('key', k).maybeSingle()
                      showToast(String((data as any)?.content || (data as any)?.text || (data as any)?.value || '미등록'))
                    }}
                    style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.15)', color: '#e8d4a8', fontSize: 11, cursor: 'pointer' }}
                  >
                    조회
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: 'none' }}>
            {flatRows.length}
          </div>
        </>
      )}

      {false ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {flatRows.map(row => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: '10px 10px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                paddingLeft: 10 + row.depth * 14,
              }}
            >
              <button
                type="button"
                onClick={() => !applying && openSheet(row)}
                disabled={applying}
                style={{
                  flex: 1,
                  minWidth: 120,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: applying ? 'not-allowed' : 'pointer',
                  opacity: applying ? 0.55 : 1,
                  padding: '4px 0',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginRight: 6 }}>L{row.level}</span>
                {row.name}
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => moveRow(row, -1)}
                  disabled={applying}
                  style={{
                    width: 36,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: 14,
                    cursor: applying ? 'not-allowed' : 'pointer',
                    opacity: applying ? 0.55 : 1,
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(row, 1)}
                  disabled={applying}
                  style={{
                    width: 36,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: 14,
                    cursor: applying ? 'not-allowed' : 'pointer',
                    opacity: applying ? 0.55 : 1,
                  }}
                >
                  ↓
                </button>
                {(row.level ?? 1) < 5 ? (
                  <button
                    type="button"
                    onClick={() => addChild(row)}
                    disabled={applying}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(76,173,126,0.35)',
                      background: 'rgba(76,173,126,0.12)',
                      color: '#7dce9a',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: applying ? 'not-allowed' : 'pointer',
                      opacity: applying ? 0.55 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    하위 추가
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {sheet ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={closeSheet}
            style={{
              flex: 1,
              minHeight: 48,
              border: 'none',
              cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)',
            }}
          />
          <div
            style={{
              background: '#141414',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              borderBottom: 'none',
              padding: '18px 16px 24px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.15)',
                margin: '0 auto 16px',
              }}
            />
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
              카테고리 수정 · L{sheet.level}
            </div>
            <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>이름</span>
              <input
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0c0c0c',
                  color: '#fff',
                  fontSize: 15,
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>정렬 순서 (숫자 작을수록 위)</span>
              <input
                value={sheetSort}
                onChange={e => setSheetSort(e.target.value.replace(/[^0-9-]/g, ''))}
                inputMode="numeric"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: '#0c0c0c',
                  color: '#fff',
                  fontSize: 15,
                }}
              />
            </label>
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>배너 이미지 URL</span>
              <input value={sheetBannerImage} onChange={e => setSheetBannerImage(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }} />
            </div>
            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>배너 텍스트</span>
              <input value={sheetBannerText} onChange={e => setSheetBannerText(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }} />
            </div>
            <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>배너 링크</span>
              <input value={sheetBannerLink} onChange={e => setSheetBannerLink(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>노출 트랙 (target_tracks)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['general','menopause_peri','menopause_post','pregnant','postpartum','male','male_menopause','all'].map(t => {
                  const on = sheetTracks.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSheetTracks(prev => (on ? prev.filter(x => x !== t) : [...prev, t]))}
                      style={{
                        padding: '5px 8px',
                        borderRadius: 999,
                        border: on ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.15)',
                        background: on ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.05)',
                        color: on ? '#e8d4a8' : 'rgba(255,255,255,0.75)',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={deleteSheetSubtree}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: '12px 12px',
                borderRadius: 12,
                border: '1px solid rgba(239,83,80,0.45)',
                background: 'rgba(239,83,80,0.12)',
                color: '#ef9a9a',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              삭제 (하위 포함)
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={closeSheet}
                style={{
                  padding: '14px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => confirmSheet()}
                style={{
                  padding: '14px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(201,168,76,0.45)',
                  background: 'rgba(201,168,76,0.2)',
                  color: '#c9a84c',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {questionSheet ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setQuestionSheet(null)} style={{ flex: 1, border: 'none', background: 'rgba(0,0,0,0.45)', cursor: 'pointer' }} />
          <div style={{ background: '#141414', borderTopLeftRadius: 18, borderTopRightRadius: 18, border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none', padding: '16px 16px 24px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>질문 편집</div>
            <label style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>질문 텍스트</span>
              <input value={questionSheet.question_text || ''} onChange={e => setQuestionSheet((p: any) => ({ ...p, question_text: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>질문 유형</span>
                <select value={questionSheet.question_type || 'daily'} onChange={e => setQuestionSheet((p: any) => ({ ...p, question_type: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }}>
                  <option value="daily">daily</option><option value="post_purchase">post_purchase</option><option value="monthly">monthly</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>답변 유형</span>
                <select value={questionSheet.answer_type || 'options'} onChange={e => setQuestionSheet((p: any) => ({ ...p, answer_type: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }}>
                  <option value="options">선택지</option><option value="yesno">예스노</option><option value="text">텍스트</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>대상 트랙</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['general','menopause_peri','menopause_post','pregnant','postpartum','male','male_menopause','all'].map(t => {
                  const arr = Array.isArray(questionSheet.target_tracks) ? questionSheet.target_tracks.map((x: any) => String(x)) : []
                  const on = arr.includes(t)
                  return <button key={t} type="button" onClick={() => setQuestionSheet((p: any) => ({ ...p, target_tracks: on ? arr.filter((x: string) => x !== t) : [...arr, t] }))} style={{ padding: '5px 8px', borderRadius: 999, border: on ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.15)', background: on ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.05)', color: on ? '#e8d4a8' : 'rgba(255,255,255,0.75)', fontSize: 11, cursor: 'pointer' }}>{t}</button>
                })}
              </div>
            </label>
            {questionSheet.answer_type === 'options' ? (
              <label style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>선택지 (줄바꿈)</span>
                <textarea value={questionSheet.optionsText || ''} onChange={e => setQuestionSheet((p: any) => ({ ...p, optionsText: e.target.value }))} rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13, resize: 'vertical' }} />
              </label>
            ) : null}
            {questionSheet.question_type === 'post_purchase' ? (
              <label style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>구매후 N일째</span>
                <input value={String(questionSheet.post_purchase_days ?? '')} onChange={e => setQuestionSheet((p: any) => ({ ...p, post_purchase_days: Number(e.target.value || 0) }))} inputMode="numeric" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0c0c0c', color: '#fff', fontSize: 13 }} />
              </label>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              <input type="checkbox" checked={questionSheet.is_active !== false} onChange={e => setQuestionSheet((p: any) => ({ ...p, is_active: e.target.checked }))} />
              활성
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button type="button" onClick={() => setQuestionSheet(null)} style={{ padding: '12px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={() => {
                setQuestionRows(prev => prev.map((x, idx) => idx === Number(questionSheet.idx) ? {
                  ...x,
                  question_text: questionSheet.question_text,
                  question_type: questionSheet.question_type,
                  target_tracks: questionSheet.target_tracks,
                  answer_type: questionSheet.answer_type,
                  options: questionSheet.answer_type === 'options' ? String(questionSheet.optionsText || '').split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
                  post_purchase_days: questionSheet.question_type === 'post_purchase' ? Number(questionSheet.post_purchase_days || 0) : null,
                  is_active: questionSheet.is_active !== false,
                } : x))
                setQuestionSheet(null)
              }} style={{ padding: '12px 12px', borderRadius: 12, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.2)', color: '#c9a84c', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>확인</button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 80,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, transparent, rgba(10,10,10,0.97) 28%)',
          borderTop: '1px solid rgba(201,168,76,0.25)',
          maxWidth: 720,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          disabled={applying || loading}
          onClick={() => void applyDraft()}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 14,
            border: '1px solid rgba(201,168,76,0.55)',
            background: applying ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.28)',
            color: '#c9a84c',
            fontSize: 15,
            fontWeight: 900,
            cursor: applying || loading ? 'not-allowed' : 'pointer',
            opacity: applying || loading ? 0.65 : 1,
          }}
        >
          {applying ? '적용 중…' : '적용 (DB 저장)'}
        </button>
      </div>
    </div>
  )
}
