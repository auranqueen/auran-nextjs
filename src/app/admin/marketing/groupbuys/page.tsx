'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GroupBuysAdminPage() {
  const [items, setItems] = useState<any[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('group_buys')
      .select('*, product:products(id, name, thumb_img)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [])

  const updateGift = async (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const saveGift = async (item: any) => {
    setSaving(item.id)
    await supabase
      .from('group_buys')
      .update({
        gift_title: item.gift_title,
        gift_description: item.gift_description,
        gift_points: item.gift_points,
      })
      .eq('id', item.id)
    setSaving(null)
    alert('저장됐어요!')
  }

  return (
    <div style={{ padding: 24, background: '#0D0B09', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ color: '#C9A96E', fontSize: 20, marginBottom: 24 }}>공동구매 선물 설정</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 20
          }}>
            {/* 제품 정보 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {item.product?.thumb_img && (
                <img src={item.product.thumb_img} alt="" style={{
                  width: 48, height: 48, borderRadius: 8, objectFit: 'cover'
                }} />
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.product?.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {item.current_count}/{item.target_count}명 · {item.discount_rate}% 할인
                </div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {item.current_count >= item.target_count
                    ? <span style={{ color: '#4CAF85' }}>✅ 목표 달성!</span>
                    : <span style={{ color: '#C9A96E' }}>⏳ 진행중</span>
                  }
                </div>
              </div>
            </div>

            {/* 선물 설정 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>선물 제목</div>
                <input
                  value={item.gift_title || ''}
                  onChange={e => updateGift(item.id, 'gift_title', e.target.value)}
                  placeholder="예: 깜짝 선물이 도착했어요! 🎁"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>선물 내용</div>
                <input
                  value={item.gift_description || ''}
                  onChange={e => updateGift(item.id, 'gift_description', e.target.value)}
                  placeholder="예: 미니 수분 앰플 증정"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>토스트 포인트 지급</div>
                <input
                  type="number"
                  value={item.gift_points || 0}
                  onChange={e => updateGift(item.id, 'gift_points', Number(e.target.value))}
                  placeholder="500"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 13
                  }}
                />
              </div>
              <button
                onClick={() => saveGift(item)}
                disabled={saving === item.id}
                style={{
                  padding: '12px', borderRadius: 10,
                  background: '#C9A96E', border: 'none',
                  color: '#000', fontWeight: 700,
                  fontSize: 13, cursor: 'pointer'
                }}
              >
                {saving === item.id ? '저장 중...' : '💾 저장'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

