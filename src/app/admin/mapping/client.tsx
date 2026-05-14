'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CONCERNS = ['수분','장벽','탄력','미백','기미/색소','모공','민감성']
const MONTHS = Array.from({length:12},(_,i)=>i+1)

export default function MappingClient({ rows, products }: { rows: any[], products: any[] }) {
  const supabase = createClient()
  const [list, setList] = useState(rows)
  const [form, setForm] = useState({
    month: 4, concern_tag: '수분',
    score_range_min: 0, score_range_max: 60,
    product_id: '', priority: 1
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [prodSearch, setProdSearch] = useState('')
  const [showProdList, setShowProdList] = useState(false)
  const filteredProds = products.filter(p =>
    String(p.name ?? '').toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 20)

  const add = async () => {
    if (!form.product_id) return setMsg('제품을 선택해주세요')
    setSaving(true)
    const { data, error } = await supabase
      .from('season_product_mapping')
      .insert({ ...form, is_active: true })
      .select('*, products(name, category)')
      .single()
    setSaving(false)
    if (error) return setMsg(error.message)
    setList([...list, data])
    setMsg('추가됐어요 ✦')
  }

  const remove = async (id: string) => {
    await supabase.from('season_product_mapping').delete().eq('id', id)
    setList(list.filter(r => r.id !== id))
  }

  const toggle = async (id: string, cur: boolean) => {
    await supabase.from('season_product_mapping')
      .update({ is_active: !cur }).eq('id', id)
    setList(list.map(r => r.id === id ? { ...r, is_active: !cur } : r))
  }

  return (
    <div>
      {/* 추가 폼 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hdr">
          <div className="card-title">+ 매핑 추가</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 16px 16px' }}>
          <select value={form.month} onChange={e => setForm({...form, month: +e.target.value})}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
            {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <select value={form.concern_tag} onChange={e => setForm({...form, concern_tag: e.target.value})}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }}>
            {CONCERNS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="점수 최소" value={form.score_range_min}
            onChange={e => setForm({...form, score_range_min: +e.target.value})}
            style={{ width: 80, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }} />
          <input type="number" placeholder="점수 최대" value={form.score_range_max}
            onChange={e => setForm({...form, score_range_max: +e.target.value})}
            style={{ width: 80, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }} />
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input
              value={prodSearch}
              onChange={e => { setProdSearch(e.target.value); setShowProdList(true) }}
              onFocus={() => setShowProdList(true)}
              placeholder="제품명 검색..."
              style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', boxSizing: 'border-box' }}
            />
            {showProdList && prodSearch && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 9999 }}>
                {filteredProds.length === 0
                  ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>검색 결과 없음</div>
                  : filteredProds.map(p => (
                    <div key={p.id}
                      onClick={() => { setForm({...form, product_id: p.id}); setProdSearch(String(p.name ?? '')); setShowProdList(false) }}
                      style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{p.name}</div>
                  ))
                }
              </div>
            )}
          </div>
          <input type="number" placeholder="우선순위" value={form.priority}
            onChange={e => setForm({...form, priority: +e.target.value})}
            style={{ width: 70, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)' }} />
          <button onClick={add} disabled={saving}
            style={{ padding: '6px 18px', borderRadius: 8, background: 'var(--purple)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {saving ? '...' : '추가'}
          </button>
          {msg && <span style={{ color: 'var(--green)', fontSize: 12, alignSelf: 'center' }}>{msg}</span>}
        </div>
      </div>

      {/* 목록 */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-title">📋 매핑 목록 ({list.length}개)</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>월</th><th>고민</th><th>점수범위</th><th>제품명</th><th>우선순위</th><th>활성</th><th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id}>
                <td><span className="b b-pu">{r.month}월</span></td>
                <td>{r.concern_tag}</td>
                <td className="mono">{r.score_range_min}~{r.score_range_max}</td>
                <td>{r.products?.name || r.product_id}</td>
                <td>P{r.priority}</td>
                <td>
                  <button onClick={() => toggle(r.id, r.is_active)}
                    style={{ padding: '2px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: r.is_active ? 'var(--green)' : 'var(--bg3)', color: r.is_active ? '#fff' : 'var(--text3)' }}>
                    {r.is_active ? 'on' : 'off'}
                  </button>
                </td>
                <td>
                  <button onClick={() => remove(r.id)}
                    style={{ padding: '2px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'var(--red)', color: '#fff' }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
