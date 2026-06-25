'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(76,175,80,0.8)'
const GRADES = ['메디슈티컬', '프리미엄전문점', '전문점', '취급점', '아레테클럽']
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: '대기중',   color: 'rgba(255,193,7,0.8)' },
  sent:      { label: '발송완료', color: GREEN },
  confirmed: { label: '수령확인', color: 'rgba(100,181,246,0.8)' },
}
interface Sample {
  id: string
  product_name: string
  description: string | null
  target_grades: string[]
  auto_welcome: boolean
  send_count: number
}
interface SendRow {
  id: string
  owner_name: string | null
  salon_name: string | null
  status: string
  sent_at: string | null
  created_at: string
}
interface Props {
  brandName: string
  brandId: string | null
}
export default function BrandTabSample({ brandName, brandId }: Props) {
  const supabase = createClient()
  const [samples, setSamples] = useState<Sample[]>([])
  const [sends, setSends] = useState<SendRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [productName, setProductName] = useState('')
  const [desc, setDesc] = useState('')
  const [targetGrades, setTargetGrades] = useState<string[]>(['메디슈티컬', '프리미엄전문점'])
  const [autoWelcome, setAutoWelcome] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedSample, setSelectedSample] = useState<string | null>(null)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const fetchData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const [{ data: sData }, { data: sendData }] = await Promise.all([
      supabase
        .from('brand_samples')
        .select('id, product_name, description, target_grades, auto_welcome, send_count')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }),
      supabase
        .from('brand_sample_sends')
        .select('id, owner_name, salon_name, status, sent_at, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setSamples((sData || []) as Sample[])
    setSends((sendData || []) as SendRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void fetchData() }, [fetchData])
  const toggleGrade = (g: string) => {
    setTargetGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    )
  }
  const submitSample = async () => {
    if (!productName.trim()) { showToast('제품명을 입력해주세요'); return }
    if (!brandId) { showToast('브랜드 정보가 없습니다'); return }
    setSaving(true)
    const { data, error } = await supabase
      .from('brand_samples')
      .insert({
        brand_id: brandId,
        product_name: productName.trim(),
        description: desc.trim() || null,
        target_grades: targetGrades,
        auto_welcome: autoWelcome,
      })
      .select('id, product_name, description, target_grades, auto_welcome, send_count')
      .single()
    if (!error && data) {
      setSamples(prev => [data as Sample, ...prev])
      setProductName(''); setDesc('')
      setTargetGrades(['메디슈티컬', '프리미엄전문점'])
      setAutoWelcome(false); setShowForm(false)
      showToast('샘플 등록 완료!')
    } else {
      showToast('저장 실패: ' + (error?.message || ''))
    }
    setSaving(false)
  }
  const sendSample = async (sampleId: string) => {
    if (!brandId) return
    setSelectedSample(sampleId)
    const { error } = await supabase
      .from('brand_sample_sends')
      .insert({
        sample_id: sampleId,
        brand_id: brandId,
        status: 'pending',
      })
    if (!error) {
      setSamples(prev => prev.map(s =>
        s.id === sampleId ? { ...s, send_count: s.send_count + 1 } : s
      ))
      await supabase
        .from('brand_samples')
        .update({ send_count: (samples.find(s => s.id === sampleId)?.send_count || 0) + 1 })
        .eq('id', sampleId)
      showToast('발송 요청 완료!')
    } else {
      showToast('발송 실패: ' + (error?.message || ''))
    }
    setSelectedSample(null)
  }
  const deleteSample = async (id: string) => {
    const { error } = await supabase.from('brand_samples').delete().eq('id', id)
    if (!error) {
      setSamples(prev => prev.filter(s => s.id !== id))
      showToast('삭제됨')
    }
  }
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      {/* 샘플 목록 */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: SUB }}>🎁 샘플 제품 관리</div>
          <button type="button" onClick={() => setShowForm(v => !v)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer' }}>
            + 샘플 추가
          </button>
        </div>
        {showForm && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="제품명 *"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }} />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="설명 (선택)"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }} />
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>발송 대상 등급</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {GRADES.map(g => (
                <button key={g} type="button" onClick={() => toggleGrade(g)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${targetGrades.includes(g) ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: targetGrades.includes(g) ? 'rgba(123,94,167,0.2)' : 'transparent', color: targetGrades.includes(g) ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
                  {g}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div onClick={() => setAutoWelcome(v => !v)}
                style={{ width: 32, height: 18, borderRadius: 9, background: autoWelcome ? PURPLE : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: '#fff', top: 3, left: autoWelcome ? 17 : 3, transition: 'left .2s' }} />
              </div>
              <span style={{ fontSize: 11, color: SUB }}>신규 원장님 웰컴 키트 자동 발송</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={submitSample} disabled={saving}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: saving ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? '저장 중...' : '등록하기'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : samples.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12, lineHeight: 1.7 }}>
            등록된 샘플이 없어요.<br />신제품 샘플을 추가해보세요!
          </div>
        ) : (
          samples.map((s, i) => (
            <div key={s.id} style={{ padding: '12px 0', borderBottom: i < samples.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TEXT, marginBottom: 3 }}>{s.product_name}</div>
                  {s.description && <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>{s.description}</div>}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    {s.target_grades.map(g => (
                      <span key={g} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(123,94,167,0.12)', color: '#a07fd4', border: '0.5px solid rgba(123,94,167,0.25)' }}>{g}</span>
                    ))}
                    {s.auto_welcome && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(76,175,80,0.1)', color: GREEN }}>웰컴 자동</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: SUB }}>발송 {s.send_count}건</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button type="button"
                    onClick={() => sendSample(s.id)}
                    disabled={selectedSample === s.id}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: selectedSample === s.id ? 'rgba(123,94,167,0.3)' : PURPLE, color: '#fff', cursor: selectedSample === s.id ? 'not-allowed' : 'pointer' }}>
                    발송
                  </button>
                  <button type="button" onClick={() => showToast('오렌톡 안내 발송!')}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', cursor: 'pointer' }}>오렌톡</button>
                  <button type="button" onClick={() => deleteSample(s.id)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.7)', cursor: 'pointer' }}>삭제</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* 발송 이력 */}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📋 발송 이력</div>
        {sends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>아직 발송 이력이 없습니다</div>
        ) : (
          sends.map((s, i) => {
            const st = STATUS_MAP[s.status] || { label: s.status, color: SUB }
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < sends.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{s.owner_name || '원장님'}</div>
                  <div style={{ fontSize: 11, color: SUB }}>{s.salon_name || '-'} · {timeAgo(s.created_at)}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: `${st.color}22`, color: st.color, border: `0.5px solid ${st.color}55`, flexShrink: 0 }}>{st.label}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
