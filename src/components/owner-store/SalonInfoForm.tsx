'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const CARD = '#181520'
const BORDER = 'rgba(255,255,255,0.07)'
const P = '#7B5EA7'
const TEXT_MAIN = 'rgba(255,255,255,0.9)'
const TEXT_SUB = 'rgba(255,255,255,0.45)'

const PHASE_OPTIONS = ['달빛기', '황금기', '만개기', '물들기', '갱년기'] as const

const DEFAULT_OPEN_HOURS: Record<string, string> = {
  mon: '10:00-20:00',
  tue: '10:00-20:00',
  wed: '10:00-20:00',
  thu: '10:00-20:00',
  fri: '10:00-20:00',
  sat: '10:00-20:00',
  sun: '10:00-20:00',
}

type MenuItem = {
  name: string
  duration_min: number
  price: number
  description: string
  is_signature: boolean
  phase_tags: string[]
}

const emptyMenu = (): MenuItem => ({
  name: '',
  duration_min: 60,
  price: 0,
  description: '',
  is_signature: false,
  phase_tags: [],
})

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.03)',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: 10,
  color: TEXT_MAIN,
  fontSize: 13,
  outline: 'none',
}

function parseMenus(raw: unknown): MenuItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [emptyMenu()]
  return raw.map((row: any) => ({
    name: String(row?.name || ''),
    duration_min: Number(row?.duration_min) || 60,
    price: Number(row?.price) || 0,
    description: String(row?.description || ''),
    is_signature: Boolean(row?.is_signature),
    phase_tags: Array.isArray(row?.phase_tags) ? row.phase_tags.map(String) : [],
  }))
}

export default function SalonInfoForm() {
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [salonId, setSalonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [menus, setMenus] = useState<MenuItem[]>([emptyMenu()])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setOwnerUserId(null)
          setLoading(false)
        }
        return
      }
      const { data: urow } = await sb.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!cancelled) setOwnerUserId(urow?.id ? String(urow.id) : null)
    }
    void run()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!ownerUserId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const sb = createClient()
      const { data } = await sb
        .from('salons')
        .select('id,name,description,area,address,phone,status,services,open_hours')
        .eq('owner_id', ownerUserId)
        .maybeSingle()

      if (cancelled) return
      if (data) {
        setSalonId(String(data.id))
        setName(String(data.name || ''))
        setDescription(String(data.description || ''))
        setArea(String(data.area || ''))
        setAddress(String(data.address || ''))
        setPhone(String(data.phone || ''))
        setStatus(data.status === 'inactive' ? 'inactive' : 'active')
        setMenus(parseMenus(data.services))
      } else {
        setSalonId(null)
        setName('')
        setDescription('')
        setArea('')
        setAddress('')
        setPhone('')
        setStatus('active')
        setMenus([emptyMenu()])
      }
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [ownerUserId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const updateMenu = (idx: number, patch: Partial<MenuItem>) => {
    setMenus(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }

  const togglePhase = (idx: number, phase: string) => {
    setMenus(prev => prev.map((m, i) => {
      if (i !== idx) return m
      const has = m.phase_tags.includes(phase)
      return { ...m, phase_tags: has ? m.phase_tags.filter(t => t !== phase) : [...m.phase_tags, phase] }
    }))
  }

  const handleSave = async () => {
    if (!ownerUserId) return
    if (!name.trim()) {
      setToast('살롱명을 입력해주세요')
      return
    }
    setSaving(true)
    const sb = createClient()
    const services = menus
      .filter(m => m.name.trim())
      .map(m => ({
        name: m.name.trim(),
        duration_min: Number(m.duration_min) || 0,
        price: Number(m.price) || 0,
        description: m.description.trim() || null,
        is_signature: m.is_signature,
        phase_tags: m.phase_tags,
      }))

    const payload = {
      owner_id: ownerUserId,
      name: name.trim(),
      description: description.trim() || null,
      area: area.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      status,
      services,
      open_hours: DEFAULT_OPEN_HOURS,
    }

    const { error } = salonId
      ? await sb.from('salons').update(payload).eq('id', salonId)
      : await sb.from('salons').insert(payload)

    setSaving(false)
    if (error) {
      setToast('저장에 실패했어요')
      return
    }
    if (!salonId) {
      const { data: created } = await sb.from('salons').select('id').eq('owner_id', ownerUserId).maybeSingle()
      if (created?.id) setSalonId(String(created.id))
    }
    setToast('저장되었어요 💜')
  }

  if (loading) {
    return <div style={{ fontSize: 12, color: TEXT_SUB, padding: '16px 0' }}>불러오는 중...</div>
  }

  if (!ownerUserId) {
    return <div style={{ fontSize: 12, color: TEXT_SUB, padding: '16px 0' }}>로그인이 필요해요</div>
  }

  return (
    <div style={{ background: BG, color: TEXT_MAIN }}>
      {toast ? (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: TEXT_MAIN }}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>살롱 기본 정보</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="살롱명" style={fieldStyle} />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="설명" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="지역 (예: 대구 수성구)" style={fieldStyle} />
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="주소" style={fieldStyle} />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="전화" style={fieldStyle} />
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: TEXT_SUB }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="salon-status" checked={status === 'active'} onChange={() => setStatus('active')} />
                영업중
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="salon-status" checked={status === 'inactive'} onChange={() => setStatus('inactive')} />
                비영업
              </label>
            </div>
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: TEXT_SUB }}>시술 메뉴</div>
            <button
              type="button"
              onClick={() => setMenus(prev => [...prev, emptyMenu()])}
              style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px', fontSize: 11, color: TEXT_MAIN, cursor: 'pointer' }}
            >
              메뉴 추가
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {menus.map((menu, idx) => (
              <div key={idx} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={menu.name} onChange={e => updateMenu(idx, { name: e.target.value })} placeholder="메뉴명" style={fieldStyle} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={menu.duration_min} onChange={e => updateMenu(idx, { duration_min: Number(e.target.value) || 0 })} placeholder="시간(분)" style={{ ...fieldStyle, flex: 1 }} />
                    <input type="number" value={menu.price} onChange={e => updateMenu(idx, { price: Number(e.target.value) || 0 })} placeholder="가격" style={{ ...fieldStyle, flex: 1 }} />
                  </div>
                  <input value={menu.description} onChange={e => updateMenu(idx, { description: e.target.value })} placeholder="설명 (선택)" style={fieldStyle} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT_SUB, cursor: 'pointer' }}>
                    <input type="checkbox" checked={menu.is_signature} onChange={e => updateMenu(idx, { is_signature: e.target.checked })} />
                    시그니처 메뉴
                  </label>
                  <div>
                    <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 6 }}>호르몬 페이즈 태그</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {PHASE_OPTIONS.map(phase => {
                        const on = menu.phase_tags.includes(phase)
                        return (
                          <button
                            key={phase}
                            type="button"
                            onClick={() => togglePhase(idx, phase)}
                            style={{
                              fontSize: 10,
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: `1px solid ${on ? 'rgba(123,94,167,0.5)' : BORDER}`,
                              background: on ? 'rgba(123,94,167,0.2)' : 'transparent',
                              color: on ? P : TEXT_SUB,
                              cursor: 'pointer',
                            }}
                          >
                            {phase}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {menus.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setMenus(prev => prev.filter((_, i) => i !== idx))}
                      style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(220,80,80,0.4)', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#e07070', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 12,
            background: P,
            color: '#fff',
            padding: '12px 0',
            fontSize: 14,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
