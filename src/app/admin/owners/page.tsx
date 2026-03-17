'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Salon = {
  id: string
  owner_id: string
  name: string
  area?: string | null
  address?: string | null
  phone?: string | null
  status: string
  created_at: string
}

type Owner = {
  id: string
  name: string
  email: string
  status: string
}

export default function AdminOwnersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [salons, setSalons] = useState<Salon[]>([])
  const [owners, setOwners] = useState<Record<string, Owner>>({})

  const pending = useMemo(() => salons.filter(s => (s.status || '').toLowerCase() === 'pending'), [salons])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: s } = await supabase
        .from('salons')
        .select('id,owner_id,name,area,address,phone,status,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      const list = (s || []) as Salon[]
      setSalons(list)

      const ownerIds = Array.from(new Set(list.map(x => x.owner_id).filter(Boolean)))
      if (ownerIds.length) {
        const { data: u } = await supabase
          .from('users')
          .select('id,name,email,status')
          .in('id', ownerIds)
        const m: Record<string, Owner> = {}
        ;(u || []).forEach((x: any) => (m[x.id] = x))
        setOwners(m)
      } else {
        setOwners({})
      }
      setLoading(false)
    }
    run()
  }, [supabase])

  const updateStatus = async (salon: Salon, status: string) => {
    const { error } = await supabase.from('salons').update({ status }).eq('id', salon.id)
    if (error) {
      alert(error.message)
      return
    }

    // 승인 시: 원장님 권한 반영 (users.role = 'owner', status = 'active')
    if (status === 'active' && salon.owner_id) {
      const { error: uerr } = await supabase.from('users').update({ role: 'owner', status: 'active' }).eq('id', salon.owner_id)
      if (uerr) {
        // 살롱 승인과 유저 권한 반영을 동시에 처리하지만, 유저 업데이트 실패는 안내만 하고 UI는 진행
        alert(`살롱 승인 완료. (유저 권한 업데이트 실패: ${uerr.message})`)
      }
    }

    setSalons(prev => prev.map(s => (s.id === salon.id ? { ...s, status } : s)))
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>원장님 관리</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>입점 승인/거절</div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>입점 신청 대기</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{pending.length}건</div>
        </div>

        {loading ? (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>대기 중인 입점 신청이 없습니다.</div>
        ) : (
          pending.map(s => (
            <div key={s.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{s.name}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                    {s.area || ''} {s.address ? `· ${s.address}` : ''}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                    owner: {owners[s.owner_id]?.name || s.owner_id?.slice(0, 6)} · {owners[s.owner_id]?.email || ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => updateStatus(s, 'active')}
                    style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.30)', color: '#4cad7e', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                  >
                    승인
                  </button>
                  <button
                    onClick={() => updateStatus(s, 'rejected')}
                    style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(217,79,79,0.12)', border: '1px solid rgba(217,79,79,0.30)', color: '#d94f4f', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                  >
                    거절
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

