'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeComposite, computeSkinAge } from '@/lib/skinAge'

const G = '#C9A96E'
const P = '#7B5EA7'
const CARD = '#2D2740'
const W = 'rgba(255,255,255,0.92)'
const W6 = 'rgba(255,255,255,0.6)'
const W4 = 'rgba(255,255,255,0.45)'
const LP = '#D8C4F0'

const GOOD: [string, string][] = [['moisture_score', '수분'], ['elasticity_score', '탄력']]
const BAD: [string, string][] = [['sensitivity_score', '민감'], ['pigmentation_score', '색소'], ['pore_score', '모공']]
const INFO: [string, string][] = [['oil_score', '유분']]

function skinAgeOf(r: any): number | null {
  if (r.skin_age != null) return r.skin_age
  const comp = r.skin_score != null ? r.skin_score : computeComposite({
    moisture: r.moisture_score, oil: r.oil_score, sensitivity: r.sensitivity_score,
    elasticity: r.elasticity_score, pigmentation: r.pigmentation_score, pore: r.pore_score,
  } as any)
  return computeSkinAge(comp, r.age_at_analysis)
}

export default function SkinReportCard() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setRows([]); return }
      const { data: prof } = await sb.from('profiles').select('full_name, username').eq('auth_id', user.id).maybeSingle()
      const nm = (((prof as any)?.full_name || (prof as any)?.username || '') as string).trim()
      setName(nm || null)
      const { data } = await sb.from('skin_analyses')
        .select('created_at, skin_age, skin_score, moisture_score, oil_score, sensitivity_score, elasticity_score, pigmentation_score, pore_score, age_at_analysis')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12)
      setRows(data || [])
    }
    load()
  }, [])

  if (rows === null) return null

  const wrap: React.CSSProperties = { margin: '10px 16px 0', background: CARD, borderRadius: 14, padding: '16px' }
  const header = name ? (name + '님의 피부 리포트') : '내 피부 리포트'

  if (rows.length === 0) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 12, color: W6, marginBottom: 4 }}>{header}</div>
        <div style={{ fontSize: 13, color: W, marginBottom: 12 }}>{name ? (name + '님, 첫 피부 분석을 해볼까요?') : '아직 피부 분석이 없어요.'}</div>
        <a href="/skin-analysis" style={{ display: 'inline-block', fontSize: 12, color: '#221C2E', background: G, borderRadius: 10, padding: '8px 14px', textDecoration: 'none' }}>피부 분석하러 가기</a>
      </div>
    )
  }

  const latest = rows[0]
  const latestAge = skinAgeOf(latest)
  const realAge = latest.age_at_analysis
  const delta = (latestAge != null && realAge != null) ? realAge - latestAge : null
  const series = rows.slice().reverse().map((r) => skinAgeOf(r)).filter((a): a is number => a != null)

  const careMsg = name == null ? null
    : (delta != null && delta > 0) ? (name + '님, 요즘 피부가 좋아지고 있어요.')
    : (delta != null && delta < 0) ? (name + '님, 요즘 조금 지쳤나 봐요. 같이 챙겨요.')
    : (name + '님, 꾸준히 기록해볼까요.')

  let spark: any = null
  if (series.length >= 2) {
    const min = Math.min(...series), max = Math.max(...series)
    const span = max - min || 1
    const n = series.length
    const X = (i: number) => 8 + (i / (n - 1)) * 284
    const Y = (a: number) => 12 + ((a - min) / span) * 56
    const pts = series.map((a, i) => X(i) + ',' + Y(a).toFixed(1)).join(' ')
    spark = (
      <svg viewBox="0 0 300 80" width="100%" height="74" role="img" aria-label="피부나이 추이">
        <polyline points={pts} fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((a, i) => <circle key={i} cx={X(i)} cy={Y(a)} r={i === n - 1 ? 4 : 2.5} fill={i === n - 1 ? G : '#A07F4A'} />)}
      </svg>
    )
  }

  const renderBar = (k: string, label: string) => {
    const v = (latest as any)[k]
    return (
      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: W6, width: 30 }}>{label}</div>
        <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: (v != null ? v : 0) + '%', background: P, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 12, color: W6, width: 22, textAlign: 'right' }}>{v != null ? v : '-'}</div>
      </div>
    )
  }

  const groupLabel: React.CSSProperties = { fontSize: 10.5, color: W4, margin: '4px 0 6px' }

  return (
    <div style={wrap}>
      <div style={{ fontSize: 12, color: W6, marginBottom: 12 }}>{header}</div>
      <div style={{ textAlign: 'center', paddingBottom: 6 }}>
        <div style={{ fontSize: 11, color: W4 }}>피부나이</div>
        {latestAge != null ? (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 46, color: '#fff', lineHeight: 1.1 }}>{latestAge}<span style={{ fontSize: 16, color: W4 }}>세</span></div>
        ) : (
          <div style={{ fontSize: 13, color: W6, padding: '8px 0' }}>나이 정보가 없어 계산하지 못했어요.</div>
        )}
        {delta != null && delta !== 0 && (
          <div style={{ display: 'inline-block', fontSize: 11, color: G, background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.4)', borderRadius: 999, padding: '3px 10px', marginTop: 4 }}>
            실제 {realAge}세 · {delta > 0 ? delta + '세 어려요' : (-delta) + '세 더 나와요'}
          </div>
        )}
        {careMsg && <div style={{ fontSize: 12, color: LP, marginTop: 10 }}>{careMsg}</div>}
      </div>
      {spark && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: W4, marginBottom: 4 }}>추이 (최근 {series.length}회)</div>
          {spark}
        </div>
      )}
      {series.length < 2 && (
        <div style={{ fontSize: 11, color: W4, textAlign: 'center', marginTop: 8 }}>분석이 쌓이면 추이가 보여요.</div>
      )}
      <div style={{ marginTop: 14 }}>
        <div style={groupLabel}>높을수록 좋아요</div>
        {GOOD.map(([k, label]) => renderBar(k, label))}
        <div style={groupLabel}>낮을수록 좋아요</div>
        {BAD.map(([k, label]) => renderBar(k, label))}
        <div style={groupLabel}>참고</div>
        {INFO.map(([k, label]) => renderBar(k, label))}
      </div>
      <div style={{ fontSize: 10.5, color: W4, marginTop: 10, lineHeight: 1.5 }}>설문·사진 기반 추정치예요. 의료·진단이 아니에요.</div>
    </div>
  )
}
