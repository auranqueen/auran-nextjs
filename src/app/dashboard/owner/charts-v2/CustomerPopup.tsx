'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const BG = '#ffffff'
const CARD = '#f9f8fc'
const BORDER = '#ede9f7'
const POINT = '#7B5EA7'
const TEXT = '#1A1A2E'
const SUB = '#888888'

const SKIN_TYPES = ['지성', '복합성', '건성', '민감성', '중성']
const SKIN_CONCERNS = ['청소년여드름', '성인여드름', '홍조', '색소침착', '주름·탄력', '모공', '각질', '트러블', '아토피']
const SPECIALS = ['갱년기', '임신 중', '수유 중']

type Props = {
  open: boolean
  onClose: () => void
  onSaved: (customer: any) => void
  ownerId: string
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

function chip(active: boolean): React.CSSProperties {
  return {
    height: 44,
    padding: '0 16px',
    borderRadius: 22,
    fontSize: 14,
    fontWeight: 400,
    border: active ? '1.5px solid #7B5EA7' : `1px solid ${BORDER}`,
    background: active ? '#EDE9F7' : BG,
    color: active ? POINT : TEXT,
    cursor: 'pointer',
  }
}

export default function CustomerPopup({ open, onClose, onSaved, ownerId }: Props) {
  const supabaseRef = useRef(createClient())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [menstruation, setMenstruation] = useState('')
  const [specials, setSpecials] = useState<string[]>([])
  const [skinTypes, setSkinTypes] = useState<string[]>([])
  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [allergies, setAllergies] = useState('')
  const [memo, setMemo] = useState('')
  const [nameErr, setNameErr] = useState('')
  const [phoneErr, setPhoneErr] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setPhone('')
    setBirthDate('')
    setGender('')
    setMenstruation('')
    setSpecials([])
    setSkinTypes([])
    setSkinConcerns([])
    setAllergies('')
    setMemo('')
    setNameErr('')
    setPhoneErr('')
  }, [open])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  if (!open) return null

  const fieldStyle = (err: boolean): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    height: 48,
    border: err ? '1px solid #e74c3c' : `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: '0 14px',
    fontSize: 15,
    background: BG,
  })

  const cardStyle: React.CSSProperties = {
    background: CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, color: SUB, marginBottom: 6, display: 'block' }

  const save = async () => {
    let ok = true
    if (!name.trim()) {
      setNameErr('이름을 입력해주세요')
      ok = false
    } else setNameErr('')
    if (!phone.trim()) {
      setPhoneErr('연락처를 입력해주세요')
      ok = false
    } else setPhoneErr('')
    if (!ok) return

    setSaving(true)
    const memoPayload = {
      birth_date: birthDate || null,
      gender,
      menstruation,
      menopause: specials.includes('갱년기'),
      pregnancy: specials.includes('임신 중'),
      breastfeeding: specials.includes('수유 중'),
      skin_type: skinTypes,
      skin_concerns: skinConcerns,
      allergies,
      memo,
    }
    const { data, error } = await supabaseRef.current
      .from('external_customers')
      .insert({
        name: name.trim(),
        phone: phone.trim(),
        owner_id: ownerId,
        memo: JSON.stringify(memoPayload),
        auran_joined: false,
        visit_count: 0,
      } as any)
      .select('*')
      .single()

    setSaving(false)
    if (error || !data) {
      setToast('등록에 실패했습니다')
      return
    }
    setToast('고객 등록 완료 💜')
    setTimeout(() => {
      onSaved(data)
      onClose()
    }, 400)
  }

  return (
    <>
      <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.35)', zIndex: 200 }} />
      <div
        className="charts-v2-customer-popup"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100vh',
          width: 480,
          maxWidth: '100%',
          background: BG,
          zIndex: 210,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(26,26,46,0.12)',
        }}
      >
        <style>{`@media (max-width:768px){.charts-v2-customer-popup{width:100%!important}}`}</style>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 500 }}>내방 고객 등록</span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, minWidth: 44, minHeight: 44, cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>기본 정보</div>
            <label style={labelStyle}>이름 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...fieldStyle(!!nameErr), marginBottom: nameErr ? 4 : 12 }} />
            {nameErr ? <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 12 }}>{nameErr}</div> : null}
            <label style={labelStyle}>연락처 *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-XXXX-XXXX" style={{ ...fieldStyle(!!phoneErr), marginBottom: phoneErr ? 4 : 12 }} />
            {phoneErr ? <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 12 }}>{phoneErr}</div> : null}
            <label style={labelStyle}>생년월일</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={fieldStyle(false)} />
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>성별 · 호르몬 상태</div>
            <label style={labelStyle}>성별</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {['여성', '남성'].map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)} style={chip(gender === g)}>
                  {g}
                </button>
              ))}
            </div>
            <label style={labelStyle}>생리</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {['있음', '없음'].map((m) => (
                <button key={m} type="button" onClick={() => setMenstruation(m)} style={chip(menstruation === m)}>
                  {m}
                </button>
              ))}
            </div>
            <label style={labelStyle}>특이사항</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SPECIALS.map((s) => (
                <button key={s} type="button" onClick={() => setSpecials((p) => toggle(p, s))} style={chip(specials.includes(s))}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>피부 정보</div>
            <label style={labelStyle}>피부타입 (복수 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SKIN_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setSkinTypes((p) => toggle(p, t))} style={chip(skinTypes.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>피부 고민 (복수 선택)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {SKIN_CONCERNS.map((t) => (
                <button key={t} type="button" onClick={() => setSkinConcerns((p) => toggle(p, t))} style={chip(skinConcerns.includes(t))}>
                  {t}
                </button>
              ))}
            </div>
            <label style={labelStyle}>알레르기</label>
            <input value={allergies} onChange={(e) => setAllergies(e.target.value)} style={fieldStyle(false)} />
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>원장님 메모</div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${BORDER}`, padding: 12, fontSize: 15, background: BG, resize: 'vertical' }}
            />
          </div>
        </div>
        <div style={{ position: 'sticky', bottom: 0, background: BG, padding: 16, borderTop: '1px solid #f0edf8', display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 10, border: `1px solid ${BORDER}`, background: BG, fontSize: 15, cursor: 'pointer' }}>
            취소
          </button>
          <button type="button" disabled={saving} onClick={() => void save()} style={{ flex: 1, height: 48, borderRadius: 10, border: 'none', background: POINT, color: '#fff', fontSize: 15, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '등록 중…' : '등록 완료'}
          </button>
        </div>
      </div>
      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: POINT, color: '#fff', borderRadius: 12, padding: '12px 18px', fontSize: 13, zIndex: 300 }}>
          {toast}
        </div>
      ) : null}
    </>
  )
}
