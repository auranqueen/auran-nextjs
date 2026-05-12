'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MyAddressesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login')
        return
      }
      supabase
        .from('users')
        .select('id')
        .eq('auth_id', data.user.id)
        .maybeSingle()
        .then(({ data: u }) => {
          if (!u?.id) {
            setLoading(false)
            return
          }
          supabase
            .from('shipping_addresses')
            .select('*')
            .eq('user_id', u.id)
            .order('is_default', { ascending: false })
            .then(({ data: addrs }) => {
              setAddresses(addrs || [])
              setLoading(false)
            })
        })
    })
  }, [router])

  const setDefault = async (id: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: u } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!u?.id) return
    await supabase.from('shipping_addresses').update({ is_default: false }).eq('user_id', u.id)
    await supabase.from('shipping_addresses').update({ is_default: true }).eq('id', id)
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })))
  }

  const deleteAddress = async (id: string) => {
    await supabase.from('shipping_addresses').delete().eq('id', id)
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0b12', color: '#fff', padding: '20px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div onClick={() => router.back()} style={{ fontSize: 20, cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
          ‹
        </div>
        <div style={{ fontSize: 16 }}>배송지 관리</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>불러오는 중...</div>
      ) : addresses.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>
          등록된 배송지가 없어요
          <br />
          <span style={{ fontSize: 11, marginTop: 8, display: 'block' }}>결제 시 배송지를 추가해주세요</span>
        </div>
      ) : (
        addresses.map((a) => (
          <div
            key={a.id}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${a.is_default ? 'rgba(123,94,167,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#fff' }}>{a.recipient_name}</span>
                {a.is_default && (
                  <span style={{ fontSize: 9, background: '#7B5EA7', color: '#fff', padding: '2px 7px', borderRadius: 20 }}>
                    기본
                  </span>
                )}
                {a.label && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{a.label}</span>}
              </div>
              <div onClick={() => deleteAddress(a.id)} style={{ fontSize: 11, color: 'rgba(255,100,100,0.7)', cursor: 'pointer' }}>
                삭제
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{a.phone}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              {a.address}
              {a.address_detail ? ` ${a.address_detail}` : ''}
            </div>
            {!a.is_default && (
              <div
                onClick={() => setDefault(a.id)}
                style={{
                  marginTop: 10,
                  padding: '6px',
                  borderRadius: 8,
                  background: 'rgba(123,94,167,0.1)',
                  border: '1px solid rgba(123,94,167,0.2)',
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#9B7EC8',
                  cursor: 'pointer',
                }}
              >
                기본 배송지로 설정
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
