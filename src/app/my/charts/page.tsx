'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'

export default function MyChartsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [ownerMap, setOwnerMap] = useState<Record<string, any>>({})
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return
      const { data: charts } = await supabase
        .from('treatment_charts')
        .select('*')
        .eq('customer_id', user.id)
        .eq('status', 'completed')
        .order('treatment_date', { ascending: false })
      const list = (charts as any[]) || []
      const ids = list.map((x) => x.id).filter(Boolean)
      let pMap: Record<string, any> = {}
      if (ids.length) {
        const { data: ps } = await supabase.from('prescriptions').select('*').in('chart_id', ids)
        pMap = Object.fromEntries(((ps as any[]) || []).map((x) => [x.chart_id, x]))
      }
      const ownerIds = Array.from(new Set(list.map((x) => x.owner_id).filter(Boolean)))
      let oMap: Record<string, any> = {}
      if (ownerIds.length) {
        const { data: owners } = await supabase.from('users').select('id,name').in('id', ownerIds)
        oMap = Object.fromEntries(((owners as any[]) || []).map((o) => [o.id, o]))
      }
      setOwnerMap(oMap)
      setRows(list.map((c) => ({ ...c, _prescription: pMap[c.id] || null })))
    }
    void run()
  }, [supabase])

  const addToCart = async (productId: string) => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    try {
      await supabase.from('carts').insert({ user_id: auth.user.id, product_id: productId, quantity: 1 } as any)
      setToast('장바구니에 담겼어요 🛍️')
    } catch {
      // ignore
    }
  }

  const buyNow = (productId: string, ownerId?: string) => {
    if (ownerId) localStorage.setItem('prescription_owner_id', String(ownerId))
    router.push(`/products/${productId}?prescription_owner_id=${encodeURIComponent(String(ownerId || ''))}`)
  }

  const changeShareType = async (row: any, next: 'private' | 'friends' | 'public') => {
    await supabase.from('treatment_charts').update({ share_type: next } as any).eq('id', row.id)
    if (next === 'public') {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        await supabase.from('posts').insert({
          user_id: auth.user.id,
          category: 'salon',
          title: '전문가 관리 받았어요 💜',
          content: row.management_tips || '',
          image_urls: [...(row.before_photos || []), ...(row.after_photos || [])],
          hashtags: ['전문가관리', '피부케어', '처방전'],
          is_expert_answered: true,
        } as any)
      }
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, share_type: next } : r)))
    setToast('공개 설정이 변경됐어요')
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 420, margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(13,11,9,0.95)', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18 }}>←</button>
        <div style={{ fontSize: 15 }}>💆 내 관리 히스토리</div>
      </div>
      <div style={{ padding: 14 }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-line' as const }}>
            {'아직 관리 기록이 없어요\n원장님께 관리 받으면\n히스토리가 쌓여요 💜'}
            <div>
              <button onClick={() => router.push('/salon')} style={{ marginTop: 10, border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 10, padding: '6px 10px', fontSize: 12 }}>
                원장님 찾기
              </button>
            </div>
          </div>
        ) : (
          rows.map((r) => {
            const ai = (r._prescription?.ai_products || []) as any[]
            const ownerP = (r._prescription?.owner_products || []) as any[]
            return (
              <div key={r.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{r.treatment_date ? new Date(r.treatment_date).toLocaleString('ko-KR') : '-'}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: '#c4a7e7' }}>
                  {ownerMap[r.owner_id]?.name || '원장님'} · <button onClick={() => router.push(`/dashboard/owner/${r.owner_id}`)} style={{ border: 'none', background: 'transparent', color: '#c4a7e7', textDecoration: 'underline', fontSize: 11 }}>케어룸 링크</button>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#fff' }}>{(r.treatment_items || []).map((x: string) => `#${x}`).join(' ')}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
                  {((r.before_photos || []) as string[]).slice(0, 1).map((u, i) => <img key={`b${i}`} src={u} alt="" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover' }} />)}
                  {((r.after_photos || []) as string[]).slice(0, 1).map((u, i) => <img key={`a${i}`} src={u} alt="" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover' }} />)}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#c4a7e7' }}>원장님의 관리팁 💜</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap' }}>{r.management_tips || '-'}</div>

                <div style={{ marginTop: 10, fontSize: 12, color: '#c4a7e7' }}>✨ AI 맞춤 추천</div>
                {ai.map((p, i) => (
                  <div key={`ai-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8 }}>
                    <img src={p.thumb_img || ''} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#222' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: '#C9A96E' }}>{Number(p.retail_price || 0).toLocaleString()}원</div>
                    </div>
                    <button onClick={() => void addToCart(p.id)} style={{ fontSize: 10, borderRadius: 8, border: '1px solid rgba(201,169,110,0.3)', background: 'rgba(201,169,110,0.12)', color: '#C9A96E', padding: '4px 8px' }}>담기</button>
                    <button onClick={() => buyNow(p.id, r.owner_id)} style={{ fontSize: 10, borderRadius: 8, border: 'none', background: '#7B5EA7', color: '#fff', padding: '4px 8px' }}>구매하기</button>
                  </div>
                ))}

                <div style={{ marginTop: 10, fontSize: 12, color: '#C9A96E' }}>👩‍⚕️ 원장님 직접 추천</div>
                {ownerP.map((p, i) => (
                  <div key={`ow-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8 }}>
                    <img src={p.thumb_img || ''} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#222' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: '#C9A96E' }}>{Number(p.retail_price || 0).toLocaleString()}원</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{p.reason}</div>
                    </div>
                    <button onClick={() => void addToCart(p.id)} style={{ fontSize: 10, borderRadius: 8, border: '1px solid rgba(201,169,110,0.3)', background: 'rgba(201,169,110,0.12)', color: '#C9A96E', padding: '4px 8px' }}>담기</button>
                    <button onClick={() => buyNow(p.id, r.owner_id)} style={{ fontSize: 10, borderRadius: 8, border: 'none', background: '#7B5EA7', color: '#fff', padding: '4px 8px' }}>구매하기</button>
                  </div>
                ))}

                {r.next_visit_date ? (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                    다음 방문 권장일: {new Date(r.next_visit_date).toLocaleDateString('ko-KR')} · D-{Math.max(0, Math.ceil((new Date(r.next_visit_date).getTime() - Date.now()) / 86400000))}
                    <button style={{ marginLeft: 8, border: '1px solid rgba(123,94,167,0.3)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '3px 8px', fontSize: 10 }}>예약하기</button>
                  </div>
                ) : null}
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  {[
                    ['private', '🔒 비공개'],
                    ['friends', '👯 일촌만'],
                    ['public', '🌍 전체공개'],
                  ].map(([k, l]) => (
                    <button key={k} onClick={() => void changeShareType(r, k as any)} style={{ border: r.share_type === k ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)', background: r.share_type === k ? 'rgba(123,94,167,0.18)' : 'rgba(255,255,255,0.04)', color: '#fff', borderRadius: 8, padding: '5px 8px', fontSize: 10 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
      {toast ? <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 20, background: 'rgba(123,94,167,0.95)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>{toast}</div> : null}
    </div>
  )
}
