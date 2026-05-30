'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  purple: '#7B5EA7', purpleSoft: '#F1ECF8', gold: '#C9A96E', goldDark: '#A07F4A', goldSoft: '#F6EFE3',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5', line: 'rgba(123,94,167,0.15)', fieldBg: '#FAF8FC',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"
const PHASES = ['달빛기', '황금기', '만개기', '물들기'] as const

type Template = {
  id: string; theme_name: string; target_phase: string | null; product_ids: string[]
  usage_guide: string | null; owner_tip: string | null; is_active: boolean; display_order: number
}

const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: C.fieldBg, border: `0.5px solid rgba(123,94,167,0.3)`,
  borderRadius: 8, padding: '9px 11px', fontFamily: 'inherit', fontSize: 13, color: '#111', outline: 'none',
}

export default function TemplatesClient({ initialTemplates, productMap }: { initialTemplates: Template[]; productMap: Record<string, string> }) {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [names, setNames] = useState<Record<string, string>>(productMap)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Template | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)

  const startEdit = (t: Template) => { setEditingId(t.id); setDraft({ ...t, product_ids: [...t.product_ids] }); setQuery(''); setResults([]) }
  const cancel = () => { setEditingId(null); setDraft(null); setQuery(''); setResults([]) }

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 1) { setResults([]); return }
    const { data } = await supabase.from('products').select('id,name').ilike('name', `%${q.trim()}%`).limit(8)
    setResults((data ?? []) as any)
  }

  const addProduct = (p: { id: string; name: string }) => {
    if (!draft || draft.product_ids.includes(p.id)) return
    setNames((n) => ({ ...n, [p.id]: p.name }))
    setDraft({ ...draft, product_ids: [...draft.product_ids, p.id] })
    setQuery(''); setResults([])
  }
  const removeProduct = (id: string) => { if (!draft) return; setDraft({ ...draft, product_ids: draft.product_ids.filter((x) => x !== id) }) }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    const { error } = await supabase.from('bundle_templates').update({
      theme_name: draft.theme_name, target_phase: draft.target_phase, product_ids: draft.product_ids,
      usage_guide: draft.usage_guide, owner_tip: draft.owner_tip, is_active: draft.is_active, updated_at: new Date().toISOString(),
    }).eq('id', draft.id)
    setSaving(false)
    if (error) { alert('저장 실패: ' + error.message); return }
    setTemplates((ts) => ts.map((t) => (t.id === draft.id ? { ...draft } : t)))
    cancel()
  }

  const addNew = async () => {
    const order = templates.length ? Math.max(...templates.map((t) => t.display_order)) + 1 : 1
    const { data, error } = await supabase.from('bundle_templates')
      .insert({ theme_name: '새 리추얼', target_phase: null, product_ids: [], display_order: order })
      .select('id,theme_name,target_phase,product_ids,usage_guide,owner_tip,is_active,display_order').single()
    if (error || !data) { alert('추가 실패: ' + (error?.message ?? '')); return }
    setTemplates((ts) => [...ts, data as Template])
    startEdit(data as Template)
  }

  const remove = async (id: string) => {
    if (!confirm('이 리추얼 템플릿을 삭제할까요?')) return
    const { error } = await supabase.from('bundle_templates').delete().eq('id', id)
    if (error) { alert('삭제 실패: ' + error.message); return }
    setTemplates((ts) => ts.filter((t) => t.id !== id))
    if (editingId === id) cancel()
  }

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, cursor: 'pointer', color: active ? '#fff' : C.muted, background: active ? C.purple : '#fff',
    border: active ? 'none' : `0.5px solid rgba(123,94,167,0.22)`, borderRadius: 17, padding: '6px 13px', fontFamily: 'inherit',
  })

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '22px 16px 48px', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontFamily: SERIF, fontSize: 20, color: C.ink }}>리추얼 템플릿</span>
        <button onClick={addNew} style={{ background: C.purple, border: 'none', color: '#fff', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>신규 추가</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {templates.map((t) => {
          const editing = editingId === t.id
          const d = editing ? draft! : t
          return (
            <div key={t.id} style={{ background: '#fff', border: `0.5px solid ${editing ? C.purple : C.line}`, borderRadius: 12, padding: 16 }}>
              {!editing ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 15, color: C.plum }}>{t.theme_name}</span>
                      {t.target_phase && <span style={{ fontSize: 11, color: C.purple, background: C.purpleSoft, borderRadius: 5, padding: '2px 8px' }}>{t.target_phase}</span>}
                      {!t.is_active && <span style={{ fontSize: 11, color: C.faint }}>비활성</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <span onClick={() => startEdit(t)} style={{ fontSize: 13, color: C.goldDark, cursor: 'pointer' }}>편집</span>
                      <span onClick={() => remove(t.id)} style={{ fontSize: 12, color: C.faint, cursor: 'pointer' }}>삭제</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                    {t.product_ids.length === 0 ? '제품 없음 — 편집에서 추가하세요' : `제품 ${t.product_ids.length} · ` + t.product_ids.map((id) => names[id] || '제품').join(' · ')}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: C.purple, marginBottom: 12 }}>수정 중</div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 5 }}>테마명</div>
                  <input value={d.theme_name} onChange={(e) => setDraft({ ...d, theme_name: e.target.value })} style={{ ...field, marginBottom: 14 }} />
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 7 }}>타겟 호르몬 페이즈</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
                    {PHASES.map((ph) => (<button key={ph} onClick={() => setDraft({ ...d, target_phase: d.target_phase === ph ? null : ph })} style={pill(d.target_phase === ph)}>{ph}</button>))}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 7 }}>상태</div>
                  <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
                    <button onClick={() => setDraft({ ...d, is_active: true })} style={pill(d.is_active)}>활성</button>
                    <button onClick={() => setDraft({ ...d, is_active: false })} style={pill(!d.is_active)}>비활성</button>
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 7 }}>제품</div>
                  {d.product_ids.map((id) => (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.fieldBg, border: `0.5px solid rgba(123,94,167,0.12)`, borderRadius: 8, padding: '8px 11px', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#111' }}>{names[id] || '제품'}</span>
                      <span onClick={() => removeProduct(id)} style={{ fontSize: 12, color: C.faint, cursor: 'pointer' }}>✕</span>
                    </div>
                  ))}
                  <div style={{ position: 'relative', marginTop: 6, marginBottom: 14 }}>
                    <input value={query} onChange={(e) => search(e.target.value)} placeholder="제품 검색해서 추가" style={{ ...field, background: '#fff' }} />
                    {results.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#fff', border: `0.5px solid rgba(123,94,167,0.3)`, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                        {results.map((r) => (<div key={r.id} onClick={() => addProduct(r)} style={{ padding: '9px 11px', fontSize: 13, color: '#111', cursor: 'pointer', borderBottom: `0.5px solid rgba(123,94,167,0.08)` }}>{r.name}</div>))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 5 }}>사용법</div>
                  <textarea value={d.usage_guide ?? ''} onChange={(e) => setDraft({ ...d, usage_guide: e.target.value })} rows={2} style={{ ...field, marginBottom: 14, resize: 'vertical' }} />
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 5 }}>원장 팁</div>
                  <textarea value={d.owner_tip ?? ''} onChange={(e) => setDraft({ ...d, owner_tip: e.target.value })} rows={2} style={{ ...field, marginBottom: 16, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={save} disabled={saving} style={{ flex: 1, background: C.purple, border: 'none', color: '#fff', borderRadius: 8, padding: 11, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>{saving ? '저장 중...' : '저장'}</button>
                    <button onClick={cancel} style={{ flex: 1, background: 'transparent', border: `0.5px solid rgba(123,94,167,0.3)`, color: C.muted, borderRadius: 8, padding: 11, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>취소</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
