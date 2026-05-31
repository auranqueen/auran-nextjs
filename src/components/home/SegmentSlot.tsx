'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackToSegment } from '@/lib/segment'

const G = '#C9A96E'
const CARD = '#2D2740'
const W = 'rgba(255,255,255,0.92)'
const W6 = 'rgba(255,255,255,0.6)'
const W4 = 'rgba(255,255,255,0.45)'

const TRIGGERS: Record<string, string> = {
  '면도함': '면도한 날 — 밤엔 진정에 더 신경 쓰세요',
  '운동·땀': '땀 많은 날 — 모공·산뜻 케어 강조',
  '잠 부족': '잠 부족 — 보습·톤 보정 강조',
  '음주': '음주 다음 날 — 수분·진정 강조',
  '햇빛': '햇빛 많은 날 — 선케어·진정 강조',
}

function pickDaily(arr: any[]) {
  if (!arr.length) return null
  const d = new Date()
  const day = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  return arr[day % arr.length]
}

export default function SegmentSlot({ track }: { track?: string | null }) {
  const segment = trackToSegment(track)
  const [mentions, setMentions] = useState<any[]>([])
  const [routines, setRoutines] = useState<any[]>([])
  const [symptoms, setSymptoms] = useState<any[]>([])
  const [sym, setSym] = useState<any>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [trig, setTrig] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      const seg = trackToSegment(track)
      if (seg === 'cycle') { setLoaded(true); return }
      const m = await sb.from('segment_mentions').select('*').eq('segment', seg).eq('is_active', true).order('sort_order', { ascending: true })
      setMentions(m.data || [])
      if (seg === 'male') {
        const r = await sb.from('segment_routines').select('*').eq('segment', 'male').eq('is_active', true).order('sort_order', { ascending: true })
        setRoutines(r.data || [])
      } else {
        const s = await sb.from('segment_symptom_care').select('*').eq('segment', 'transition').eq('is_active', true).order('sort_order', { ascending: true })
        setSymptoms(s.data || [])
        if ((s.data || []).length) setSym(s.data![0])
      }
      setLoaded(true)
    }
    load()
  }, [])

  if (segment === 'cycle' || !loaded) return null

  const mention = pickDaily(mentions)
  const wrap: React.CSSProperties = { marginTop: 14 }
  const card: React.CSSProperties = { background: CARD, borderRadius: 14, padding: '14px 14px' }

  if (segment === 'male') {
    const r = routines[0]
    const am = r ? (r.steps || []).filter((s: any) => s.time === 'am') : []
    const pm = r ? (r.steps || []).filter((s: any) => s.time === 'pm') : []
    const Step = ({ s, k }: any) => {
      const on = !!checked[k]
      return (
        <div onClick={() => setChecked({ ...checked, [k]: !on })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 0', cursor: 'pointer' }}>
          <span style={{ fontSize: 16, color: on ? G : W4 }}>{on ? '☑' : '☐'}</span>
          <span style={{ fontSize: 13, color: W }}>{s.label}</span>
          <span style={{ fontSize: 12, color: W4, marginLeft: 'auto' }}>{s.product_name}</span>
        </div>
      )
    }
    return (
      <div style={wrap}>
        {mention && <div style={{ fontSize: 14, color: W, marginBottom: 10 }}>{mention.text}</div>}
        {!r && <div style={{ fontSize: 12, color: W6 }}>루틴을 준비 중이에요.</div>}
        {r && (
          <>
            <div style={{ fontSize: 12, color: W6 }}>내 루틴 · {r.name}</div>
            <div style={{ ...card, marginTop: 8 }}>
              <div style={{ fontSize: 13, color: G }}>아침</div>
              {am.map((s: any, i: number) => <Step key={'am' + i} s={s} k={'am' + i} />)}
            </div>
            <div style={{ ...card, marginTop: 10 }}>
              <div style={{ fontSize: 13, color: G }}>밤</div>
              {pm.map((s: any, i: number) => <Step key={'pm' + i} s={s} k={'pm' + i} />)}
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: W6, marginTop: 14 }}>오늘 이런 일 있었나요?</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {Object.keys(TRIGGERS).map((t) => {
            const on = trig === t
            return <span key={t} onClick={() => setTrig(on ? null : t)} style={{ fontSize: 12, color: on ? G : W6, border: `0.5px solid ${on ? 'rgba(201,169,110,0.6)' : 'rgba(255,255,255,0.2)'}`, borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>{t}</span>
          })}
        </div>
        {trig && <div style={{ fontSize: 11, color: 'rgba(201,169,110,0.85)', marginTop: 10 }}>{TRIGGERS[trig]}</div>}
      </div>
    )
  }

  // transition
  return (
    <div style={wrap}>
      {mention && <div style={{ fontSize: 16, color: W }}>{mention.text}</div>}
      <div style={{ fontSize: 12, color: W6, marginTop: 14 }}>오늘 어땠어요?</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {symptoms.map((s) => {
          const on = sym && sym.id === s.id
          return <span key={s.id} onClick={() => setSym(s)} style={{ fontSize: 12, color: on ? G : W6, border: `0.5px solid ${on ? 'rgba(201,169,110,0.6)' : 'rgba(255,255,255,0.2)'}`, borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>{s.symptom}</span>
        })}
      </div>
      {sym && (sym.sub_options || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {(sym.sub_options || []).map((x: string, i: number) => <span key={i} style={{ fontSize: 11, color: W6, border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '4px 10px' }}>{x}</span>)}
        </div>
      )}
      {sym && (
        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ fontSize: 13, color: G }}>오늘의 회복 케어</div>
          <div style={{ fontSize: 11, color: W6, marginTop: 3 }}>{sym.symptom} · 아로마 먼저, 그다음 케어</div>
          {(sym.care || []).map((c: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 0' }}>
              <span style={{ fontSize: 11, color: G, background: 'rgba(201,169,110,0.12)', borderRadius: 10, padding: '2px 9px' }}>{c.tag}</span>
              <span style={{ fontSize: 13, color: W }}>{c.product_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
