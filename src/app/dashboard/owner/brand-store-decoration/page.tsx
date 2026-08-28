'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StoryManageSection from './StoryManageSection'

const BORDER = '#ECE7DE'
const PURPLE = '#7B5EA7'
const GOLD = '#B08A46'
const TEXT = '#3A3540'
const TEXT_SUB = '#8A7E72'
const BG = '#f8f7fc'
const CARD = '#ffffff'

export default function BrandStoreDecorationPage() {
  const router = useRouter()
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
    <div style={{ background: BG, minHeight: '100vh', padding: 20, color: TEXT }}>
      <div style={{ fontSize: 16, marginBottom: 16, fontWeight: 600 }}>오렌포스팅관리</div>
      {salonId ? (
        <div
          style={{
            background: CARD,
            border: `0.5px solid ${BORDER}`,
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>🎬 오렌씬</div>
            <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 4 }}>관리·홈케어 릴스 영상을 업로드해요</div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/oren-scene/upload?salon_id=${encodeURIComponent(salonId)}`)}
            style={{
              flexShrink: 0,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            오렌씬 업로드
          </button>
        </div>
      ) : null}
      {salonId ? <StoryManageSection salonId={salonId} /> : null}
      <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: TEXT }}>스토어알림받기 고객</span>
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
