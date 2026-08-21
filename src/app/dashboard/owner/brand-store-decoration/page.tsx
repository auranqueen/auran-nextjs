'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import StoryManageSection from './StoryManageSection'

const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

export default function BrandStoreDecorationPage() {
  const supabaseRef = useRef(createClient())
  const [salonId, setSalonId] = useState<string | null>(null)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [notifying, setNotifying] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = supabaseRef.current
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!me) return
    const { data: salon } = await supabase.from('salons').select('id').eq('owner_id', me.id).maybeSingle()
    if (!salon) return
    setSalonId(salon.id)
    const { count } = await supabase
      .from('brand_product_salon_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salon.id)
    setSubscriberCount(count || 0)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleNotify = async () => {
    setNotifying(true)
    setNotifyMsg(null)
    const res = await fetch('/api/brand-product-orders/notify-customers', { method: 'POST' }).then((r) => r.json())
    setNotifying(false)
    if (res.ok) setNotifyMsg(`${res.notified}명에게 알림을 보냈어요`)
    else setNotifyMsg(res.error === 'cooldown_active' ? '하루에 한 번만 보낼 수 있어요' : '발송에 실패했어요')
  }

  return (
    <div style={{ background: '#0a0c0f', minHeight: '100vh', padding: 20, color: '#fff' }}>
      <div style={{ fontSize: 16, marginBottom: 16 }}>브랜드 스토어 꾸미기</div>
      {salonId ? <StoryManageSection salonId={salonId} /> : null}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>스토어알림받기 고객</span>
          <span style={{ fontSize: 16, color: GOLD }}>{subscriberCount}명</span>
        </div>
        <button
          onClick={handleNotify}
          disabled={notifying}
          style={{
            width: '100%',
            border: 'none',
            background: PURPLE,
            color: '#fff',
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            marginTop: 8,
          }}
        >
          {notifying ? '보내는 중...' : '알림받기 고객에게 알리기'}
        </button>
        {notifyMsg && <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 8 }}>{notifyMsg}</div>}
      </div>
    </div>
  )
}
