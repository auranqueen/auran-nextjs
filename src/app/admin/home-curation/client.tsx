'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const curMonth = new Date().getMonth() + 1

export default function HomeCurationClient({
  initialMappings, initialIssueButtons, products, initialConcerns
}: {
  initialMappings: any[], initialIssueButtons: any[], products: any[], initialConcerns: any[]
}) {
  const supabase = createClient()
  const [tab, setTab] = useState(0)
  const [month, setMonth] = useState(curMonth)
  const [mappings, setMappings] = useState(initialMappings)
  const [issueButtons, setIssueButtons] = useState(initialIssueButtons.map((r: any) => ({ key: r.key, ...JSON.parse(r.value) })))
  const [concerns, setConcerns] = useState(initialConcerns.map((r: any) => ({ key: r.key, ...JSON.parse(r.value) })))
  const [prodSearch, setProdSearch] = useState('')
  const [showProdDrop, setShowProdDrop] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState('전체')
  const [newBtnLabel, setNewBtnLabel] = useState('')
  const [newConcern, setNewConcern] = useState('')
  const [selectedConcern, setSelectedConcern] = useState<string | null>(null)
  const [concernProdSearch, setConcernProdSearch] = useState('')
  const [showConcernDrop, setShowConcernDrop] = useState(false)
  const [sectionSettings, setSectionSettings] = useState({
    ownerPick: true, concernBest: false, timesale: true, newProduct: true, moisture: false, magazine: true
  })

  const filteredProds = products.filter((p: any) =>
    p.name?.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 20)

  const filteredConcernProds = products.filter((p: any) =>
    p.name?.toLowerCase().includes(concernProdSearch.toLowerCase())
  ).slice(0, 20)

  const monthMappings = mappings.filter((m: any) => m.month === month)

  const addMapping = async (product: any) => {
    const { data } = await supabase.from('season_product_mapping').insert({
      month, product_id: product.id,
      func_tag: selectedIssue !== '전체' ? selectedIssue : null,
      priority: monthMappings.length + 1, is_active: true,
    }).select('*, products(id,name,thumb_img,storage_thumb_url)').maybeSingle()
    if (data) { setMappings(prev => [...prev, data]); setProdSearch(''); setShowProdDrop(false) }
  }

  const removeMapping = async (id: string) => {
    await supabase.from('season_product_mapping').delete().eq('id', id)
    setMappings(prev => prev.filter((m: any) => m.id !== id))
  }

  const addIssueBtn = async () => {
    if (!newBtnLabel.trim()) return
    const key = `${month}_${Date.now()}`
    const value = JSON.stringify({ key, label: newBtnLabel })
    await supabase.from('admin_settings').insert({ category: 'monthly_issue', key, value })
    setIssueButtons(prev => [...prev, { key, label: newBtnLabel }])
    setNewBtnLabel('')
  }

  const removeIssueBtn = async (key: string) => {
    await supabase.from('admin_settings').delete().eq('key', key).eq('category', 'monthly_issue')
    setIssueButtons(prev => prev.filter((b: any) => b.key !== key))
  }

  const addConcern = async () => {
    if (!newConcern.trim()) return
    const key = `concern_${Date.now()}`
    const value = JSON.stringify({ key, label: newConcern })
    await supabase.from('admin_settings').insert({ category: 'concern_best', key, value })
    setConcerns(prev => [...prev, { key, label: newConcern }])
    setNewConcern('')
  }

  const removeConcern = async (key: string) => {
    await supabase.from('admin_settings').delete().eq('key', key).eq('category', 'concern_best')
    setConcerns(prev => prev.filter((c: any) => c.key !== key))
  }

  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }
  const lbl = { fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 8, display: 'block' as const }
  const chip = (on: boolean) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, background: on ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${on ? '#7B5EA7' : 'rgba(255,255,255,0.1)'}`, color: on ? '#9B7EC8' : 'rgba(255,255,255,0.5)', margin: 3, cursor: 'pointer' })

  const TABS = ['원장픽 & 이슈버튼', '고민별 BEST', '신제품', '섹션 노출']

  return (
    <div style={{ padding: 24, background: '#0d0b12', minHeight: '100vh', color: '#fff' }}>
      <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 3, fontFamily: 'monospace', marginBottom: 16 }}>홈 큐레이션 통합 관리</div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map((t, i) => (
          <div key={i} onClick={() => setTab(i)} style={{ padding: '8px 16px', fontSize: 12, cursor: 'pointer', color: tab === i ? '#9B7EC8' : 'rgba(255,255,255,0.4)', borderBottom: tab === i ? '2px solid #7B5EA7' : '2px solid transparent', marginBottom: -1 }}>{t}</div>
        ))}
      </div>

      {tab === 0 && (
        <div>
          <div style={card}>
            <span style={lbl}>월 선택</span>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: '#fff', fontSize: 12 }}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>

          <div style={card}>
            <span style={lbl}>이슈 버튼 관리</span>
            <div style={{ marginBottom: 10 }}>
              {issueButtons.filter((b: any) => b.key?.startsWith(`${month}_`)).map((b: any) => (
                <span key={b.key} style={chip(false)}>
                  {b.label}
                  <span onClick={() => removeIssueBtn(b.key)} style={{ color: 'rgba(255,100,100,0.7)', cursor: 'pointer' }}>×</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newBtnLabel} onChange={e => setNewBtnLabel(e.target.value)} placeholder="새 버튼 라벨 (예: ☀️ 자외선 시즌)" style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: '#fff', fontSize: 12, outline: 'none' }} />
              <button onClick={addIssueBtn} style={{ padding: '6px 14px', borderRadius: 8, background: '#7B5EA7', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>+ 추가</button>
            </div>
          </div>

          <div style={card}>
            <span style={lbl}>원장픽 제품 큐레이션 · {month}월</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <select value={selectedIssue} onChange={e => setSelectedIssue(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: '#fff', fontSize: 12 }}>
                <option>전체</option>
                {issueButtons.filter((b: any) => b.key?.startsWith(`${month}_`)).map((b: any) => (
                  <option key={b.key}>{b.label}</option>
                ))}
              </select>
              <div style={{ flex: 1, position: 'relative' }}>
                <input value={prodSearch} onChange={e => { setProdSearch(e.target.value); setShowProdDrop(true) }} onFocus={() => setShowProdDrop(true)} placeholder="제품명 검색..." style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                {showProdDrop && prodSearch && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1625', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 9999 }}>
                    {filteredProds.length === 0
                      ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>검색 결과 없음</div>
                      : filteredProds.map((p: any) => (
                        <div key={p.id} onClick={() => addMapping(p)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >{p.name}</div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
            {monthMappings.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                  {m.products?.thumb_img && <img src={m.products.thumb_img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: '#fff' }}>{m.products?.name || '제품명 없음'}</div>
                <span style={{ fontSize: 10, color: '#C9A96E' }}>{m.func_tag || '전체'}</span>
                <button onClick={() => removeMapping(m.id)} style={{ fontSize: 11, color: 'rgba(255,100,100,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
              </div>
            ))}
            {monthMappings.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '12px 0' }}>제품을 추가해주세요</div>}
          </div>
        </div>
      )}

      {tab === 1 && (
        <div>
          <div style={card}>
            <span style={lbl}>고민 카테고리 관리 · 추가/삭제 가능</span>
            <div style={{ marginBottom: 12 }}>
              {concerns.map((c: any) => (
                <div key={c.key} onClick={() => setSelectedConcern(c.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: selectedConcern === c.key ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: `1px solid ${selectedConcern === c.key ? '#7B5EA7' : 'rgba(255,255,255,0.08)'}` }}>
                  <div style={{ flex: 1, fontSize: 12, color: '#fff' }}>{c.label}</div>
                  <button onClick={e => { e.stopPropagation(); removeConcern(c.key) }} style={{ fontSize: 11, color: 'rgba(255,100,100,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newConcern} onChange={e => setNewConcern(e.target.value)} placeholder="새 고민 (예: 💧 수분·건조)" style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: '#fff', fontSize: 12, outline: 'none' }} />
              <button onClick={addConcern} style={{ padding: '6px 14px', borderRadius: 8, background: '#7B5EA7', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>+ 추가</button>
            </div>
          </div>

          {selectedConcern && (
            <div style={card}>
              <span style={lbl}>{concerns.find((c: any) => c.key === selectedConcern)?.label} · 제품 매핑</span>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input value={concernProdSearch} onChange={e => { setConcernProdSearch(e.target.value); setShowConcernDrop(true) }} onFocus={() => setShowConcernDrop(true)} placeholder="제품명 검색..." style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                {showConcernDrop && concernProdSearch && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1625', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto', zIndex: 9999 }}>
                    {filteredConcernProds.map((p: any) => (
                      <div key={p.id} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#fff' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >{p.name}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>제품을 검색해서 추가해주세요</div>
            </div>
          )}
        </div>
      )}

      {tab === 2 && (
        <div style={card}>
          <span style={lbl}>신제품 섹션</span>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>최근 30일 내 등록된 제품 자동 표시</div>
        </div>
      )}

      {tab === 3 && (
        <div style={card}>
          <span style={lbl}>홈 섹션 노출 on/off</span>
          {[
            { key: 'ownerPick', label: '오랜 픽 (원장픽)', desc: '이슈 버튼 + 제품 큐레이션' },
            { key: 'concernBest', label: '고민별 BEST', desc: '제품 매핑된 고민만 표시' },
            { key: 'timesale', label: '타임세일 · 공동구매', desc: '' },
            { key: 'newProduct', label: '새로 나왔어요', desc: '신제품 섹션' },
            { key: 'moisture', label: '수분부족 BEST (단독)', desc: '고민별 BEST로 통합 예정' },
            { key: 'magazine', label: '매거진', desc: '' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 12, color: '#fff' }}>{item.label}</div>
                {item.desc && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{item.desc}</div>}
              </div>
              <div onClick={() => setSectionSettings(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, cursor: 'pointer', background: sectionSettings[item.key as keyof typeof sectionSettings] ? 'rgba(80,200,100,0.15)' : 'rgba(255,255,255,0.06)', color: sectionSettings[item.key as keyof typeof sectionSettings] ? 'rgba(80,200,120,0.9)' : 'rgba(255,255,255,0.4)', border: `1px solid ${sectionSettings[item.key as keyof typeof sectionSettings] ? 'rgba(80,200,100,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                {sectionSettings[item.key as keyof typeof sectionSettings] ? '노출' : '숨김'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
