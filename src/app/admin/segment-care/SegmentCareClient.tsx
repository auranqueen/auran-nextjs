'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  purple: '#7B5EA7', gold: '#C9A96E', goldDark: '#A07F4A',
  ink: '#2A2433', muted: '#8A7E92', line: 'rgba(123,94,167,0.18)', bg: '#FAF6F0',
}
const input: React.CSSProperties = {
  background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 8,
  padding: '8px 10px', fontSize: 13, color: '#111', fontFamily: 'inherit', outline: 'none',
}
const tab = (on: boolean): React.CSSProperties => ({
  background: on ? C.purple : '#fff', color: on ? '#fff' : C.muted,
  border: `0.5px solid ${on ? C.purple : C.line}`, borderRadius: 8,
  padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
})
const mini = (color: string): React.CSSProperties => ({
  background: 'transparent', color, border: `0.5px solid ${color}`,
  borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
})

export default function SegmentCareClient() {
  const [section, setSection] = useState<'routine' | 'symptom' | 'mention'>('routine')
  const [routines, setRoutines] = useState<any[]>([])
  const [symptoms, setSymptoms] = useState<any[]>([])
  const [mentions, setMentions] = useState<any[]>([])
  const [mSeg, setMSeg] = useState<'transition' | 'male' | 'cycle'>('transition')
  const [editR, setEditR] = useState<any>(null)
  const [editS, setEditS] = useState<any>(null)
  const [editM, setEditM] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const sb = createClient()
    const [r, s, m] = await Promise.all([
      sb.from('segment_routines').select('*').order('sort_order', { ascending: true }),
      sb.from('segment_symptom_care').select('*').order('sort_order', { ascending: true }),
      sb.from('segment_mentions').select('*').order('sort_order', { ascending: true }),
    ])
    setRoutines(r.data || [])
    setSymptoms(s.data || [])
    setMentions(m.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveRoutine = async (d: any) => {
    const sb = createClient()
    const payload = { segment: 'male', name: d.name || '새 루틴', concern: d.concern || '', steps: d.steps || [], is_active: d.is_active ?? true }
    if (d.id) await sb.from('segment_routines').update(payload).eq('id', d.id)
    else await sb.from('segment_routines').insert({ ...payload, sort_order: routines.length + 1 })
    setEditR(null); await load()
  }
  const saveSymptom = async (d: any) => {
    const sb = createClient()
    const payload = { segment: 'transition', symptom: d.symptom || '', sub_options: d.sub_options || [], care: d.care || [], is_active: d.is_active ?? true }
    if (d.id) await sb.from('segment_symptom_care').update(payload).eq('id', d.id)
    else await sb.from('segment_symptom_care').insert({ ...payload, sort_order: symptoms.length + 1 })
    setEditS(null); await load()
  }
  const saveMention = async (d: any) => {
    const sb = createClient()
    const payload = { segment: d.segment || mSeg, text: d.text || '', is_active: d.is_active ?? true }
    if (d.id) await sb.from('segment_mentions').update(payload).eq('id', d.id)
    else await sb.from('segment_mentions').insert({ ...payload, sort_order: mentions.length + 1 })
    setEditM(null); await load()
  }
  const toggleActive = async (table: string, row: any) => {
    const sb = createClient()
    await sb.from(table).update({ is_active: !row.is_active }).eq('id', row.id)
    await load()
  }
  const del = async (table: string, id: string) => {
    if (!confirm('삭제할까요?')) return
    const sb = createClient()
    await sb.from(table).delete().eq('id', id)
    await load()
  }

  const wrap: React.CSSProperties = { background: C.bg, minHeight: '100vh', padding: '20px 16px 60px', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.ink }
  const card: React.CSSProperties = { background: '#fff', border: `0.5px solid ${C.line}`, borderRadius: 12, padding: 14, marginTop: 10 }

  if (loading) return <div style={{ ...wrap, color: C.muted }}>불러오는 중...</div>

  return (
    <div style={wrap}>
      <div style={{ fontSize: 20, color: C.purple }}>세그먼트 케어</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>홈 슬롯에 들어가는 남성 루틴 · 갱년기 케어 · 멘트를 편집해요</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button style={tab(section === 'routine')} onClick={() => setSection('routine')}>남성 루틴</button>
        <button style={tab(section === 'symptom')} onClick={() => setSection('symptom')}>갱년기 매핑</button>
        <button style={tab(section === 'mention')} onClick={() => setSection('mention')}>멘트 풀</button>
      </div>

      {section === 'routine' && (
        <div style={{ marginTop: 12 }}>
          {routines.length === 0 && <div style={{ color: C.muted, fontSize: 13, marginTop: 10 }}>아직 루틴이 없어요. 아래에서 추가하세요.</div>}
          {routines.map((r) => (
            <div key={r.id} style={{ ...card, opacity: r.is_active ? 1 : 0.5 }}>
              {editR?.id === r.id ? (
                <RoutineEditor draft={editR} setDraft={setEditR} onSave={() => saveRoutine(editR)} onCancel={() => setEditR(null)} />
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15, color: C.purple }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{r.concern}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.ink, marginTop: 8, lineHeight: 1.7 }}>
                    {(r.steps || []).map((s: any, i: number) => (
                      <div key={i}>{s.time === 'am' ? '아침' : '밤'} · {s.label} — {s.product_name}</div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button style={mini(C.purple)} onClick={() => setEditR(JSON.parse(JSON.stringify(r)))}>편집</button>
                    <button style={mini(C.muted)} onClick={() => toggleActive('segment_routines', r)}>{r.is_active ? '비활성' : '활성'}</button>
                    <button style={mini('#A33')} onClick={() => del('segment_routines', r.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!editR && <button style={{ ...tab(false), marginTop: 12 }} onClick={() => setEditR({ name: '', concern: '', steps: [], is_active: true })}>+ 루틴 추가</button>}
          {editR && !editR.id && (
            <div style={card}>
              <RoutineEditor draft={editR} setDraft={setEditR} onSave={() => saveRoutine(editR)} onCancel={() => setEditR(null)} />
            </div>
          )}
        </div>
      )}

      {section === 'symptom' && (
        <div style={{ marginTop: 12 }}>
          {symptoms.length === 0 && <div style={{ color: C.muted, fontSize: 13, marginTop: 10 }}>아직 매핑이 없어요. 아래에서 추가하세요.</div>}
          {symptoms.map((s) => (
            <div key={s.id} style={{ ...card, opacity: s.is_active ? 1 : 0.5 }}>
              {editS?.id === s.id ? (
                <SymptomEditor draft={editS} setDraft={setEditS} onSave={() => saveSymptom(editS)} onCancel={() => setEditS(null)} />
              ) : (
                <div>
                  <div style={{ fontSize: 15, color: C.purple }}>{s.symptom}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>세분화: {(s.sub_options || []).join(', ')}</div>
                  <div style={{ fontSize: 12, color: C.ink, marginTop: 8, lineHeight: 1.7 }}>
                    {(s.care || []).map((c: any, i: number) => (<div key={i}>[{c.tag}] {c.product_name}</div>))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button style={mini(C.purple)} onClick={() => setEditS(JSON.parse(JSON.stringify(s)))}>편집</button>
                    <button style={mini(C.muted)} onClick={() => toggleActive('segment_symptom_care', s)}>{s.is_active ? '비활성' : '활성'}</button>
                    <button style={mini('#A33')} onClick={() => del('segment_symptom_care', s.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!editS && <button style={{ ...tab(false), marginTop: 12 }} onClick={() => setEditS({ symptom: '', sub_options: [], care: [], is_active: true })}>+ 증상 추가</button>}
          {editS && !editS.id && (
            <div style={card}>
              <SymptomEditor draft={editS} setDraft={setEditS} onSave={() => saveSymptom(editS)} onCancel={() => setEditS(null)} />
            </div>
          )}
        </div>
      )}

      {section === 'mention' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tab(mSeg === 'transition')} onClick={() => setMSeg('transition')}>갱년기</button>
            <button style={tab(mSeg === 'male')} onClick={() => setMSeg('male')}>남성</button>
            <button style={tab(mSeg === 'cycle')} onClick={() => setMSeg('cycle')}>월경</button>
          </div>
          {mentions.filter((m) => m.segment === mSeg).length === 0 && <div style={{ color: C.muted, fontSize: 13, marginTop: 12 }}>이 세그먼트엔 아직 멘트가 없어요.</div>}
          {mentions.filter((m) => m.segment === mSeg).map((m) => (
            <div key={m.id} style={{ ...card, opacity: m.is_active ? 1 : 0.5 }}>
              {editM?.id === m.id ? (
                <div>
                  <textarea value={editM.text} onChange={(e) => setEditM({ ...editM, text: e.target.value })} rows={2} style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button style={mini(C.purple)} onClick={() => saveMention(editM)}>저장</button>
                    <button style={mini(C.muted)} onClick={() => setEditM(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.ink }}>{m.text}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={mini(C.purple)} onClick={() => setEditM({ ...m })}>편집</button>
                    <button style={mini(C.muted)} onClick={() => toggleActive('segment_mentions', m)}>{m.is_active ? '끄기' : '켜기'}</button>
                    <button style={mini('#A33')} onClick={() => del('segment_mentions', m.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <button style={{ ...tab(false), marginTop: 12 }} onClick={() => saveMention({ segment: mSeg, text: '새 멘트', is_active: true })}>+ 멘트 추가</button>
        </div>
      )}
    </div>
  )
}

function RoutineEditor({ draft, setDraft, onSave, onCancel }: any) {
  const setStep = (i: number, key: string, val: string) => {
    const steps = [...(draft.steps || [])]; steps[i] = { ...steps[i], [key]: val }; setDraft({ ...draft, steps })
  }
  const addStep = () => setDraft({ ...draft, steps: [...(draft.steps || []), { time: 'am', label: '', product_name: '', product_id: null }] })
  const rmStep = (i: number) => { const steps = [...(draft.steps || [])]; steps.splice(i, 1); setDraft({ ...draft, steps }) }
  return (
    <div>
      <input value={draft.name} placeholder="루틴 이름 (예: 모공·피지형)" onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
      <input value={draft.concern || ''} placeholder="대상/설명 (예: 지성·번들거림)" onChange={(e) => setDraft({ ...draft, concern: e.target.value })} style={{ ...input, width: '100%', boxSizing: 'border-box', marginTop: 8 }} />
      <div style={{ marginTop: 10 }}>
        {(draft.steps || []).map((s: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setStep(i, 'time', s.time === 'am' ? 'pm' : 'am')} style={tab(false)}>{s.time === 'am' ? '아침' : '밤'}</button>
            <input value={s.label} placeholder="단계" onChange={(e) => setStep(i, 'label', e.target.value)} style={{ ...input, width: 70 }} />
            <input value={s.product_name} placeholder="제품명" onChange={(e) => setStep(i, 'product_name', e.target.value)} style={{ ...input, flex: 1, minWidth: 120 }} />
            <button onClick={() => rmStep(i)} style={mini('#A33')}>×</button>
          </div>
        ))}
        <button onClick={addStep} style={{ ...mini('#7B5EA7'), marginTop: 10 }}>+ 스텝</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={{ ...tab(true) }} onClick={onSave}>저장</button>
        <button style={{ ...tab(false) }} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

function SymptomEditor({ draft, setDraft, onSave, onCancel }: any) {
  const setCare = (i: number, key: string, val: string) => { const care = [...(draft.care || [])]; care[i] = { ...care[i], [key]: val }; setDraft({ ...draft, care }) }
  const addCare = () => setDraft({ ...draft, care: [...(draft.care || []), { tag: '', product_name: '', product_id: null }] })
  const rmCare = (i: number) => { const care = [...(draft.care || [])]; care.splice(i, 1); setDraft({ ...draft, care }) }
  return (
    <div>
      <input value={draft.symptom} placeholder="증상 (예: 열감)" onChange={(e) => setDraft({ ...draft, symptom: e.target.value })} style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
      <input value={(draft.sub_options || []).join(', ')} placeholder="세분화 (쉼표로 구분)" onChange={(e) => setDraft({ ...draft, sub_options: e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean) })} style={{ ...input, width: '100%', boxSizing: 'border-box', marginTop: 8 }} />
      <div style={{ marginTop: 10 }}>
        {(draft.care || []).map((c: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={c.tag} placeholder="태그 (예: 아로마·수면)" onChange={(e) => setCare(i, 'tag', e.target.value)} style={{ ...input, width: 120 }} />
            <input value={c.product_name} placeholder="제품명" onChange={(e) => setCare(i, 'product_name', e.target.value)} style={{ ...input, flex: 1, minWidth: 120 }} />
            <button onClick={() => rmCare(i)} style={mini('#A33')}>×</button>
          </div>
        ))}
        <button onClick={addCare} style={{ ...mini('#7B5EA7'), marginTop: 10 }}>+ 케어</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={{ ...tab(true) }} onClick={onSave}>저장</button>
        <button style={{ ...tab(false) }} onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}
