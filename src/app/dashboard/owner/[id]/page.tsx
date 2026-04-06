'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OwnerProfilePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const supabase = createClient()
  const ownerId = params?.id
  const [owner, setOwner] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('처방전 미발행')
  const [detail, setDetail] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    const run = async () => {
      if (!ownerId) return
      const { data } = await supabase.from('users').select('id,name').eq('id', ownerId).maybeSingle()
      setOwner(data)
    }
    void run()
  }, [ownerId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const submit = async () => {
    if (!ownerId) return
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    let photoUrl = ''
    if (photo) {
      const path = `owner-reports/${user.id}/${Date.now()}`
      const { error } = await supabase.storage.from('community').upload(path, photo, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('community').getPublicUrl(path)
        photoUrl = data.publicUrl || ''
      }
    }
    await supabase.from('owner_reports').insert({
      owner_id: ownerId,
      reporter_id: user.id,
      reason,
      detail,
      photo_url: photoUrl || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    } as any)
    const { data: admins } = await supabase.from('users').select('id').in('role', ['admin', 'master'])
    if ((admins || []).length > 0) {
      await supabase.from('notifications').insert(
        (admins || []).map((a: any) => ({
          user_id: a.id,
          type: 'promo',
          title: '⚠️ 원장님 신고 접수',
          body: `${owner?.name || '원장님'} 신고 접수됐어요`,
          icon: '⚠️',
          is_read: false,
        })) as any
      )
    }
    setOpen(false)
    setToast('신고가 접수됐어요\n검토 후 처리해드려요 💜')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0B09', color: '#fff', maxWidth: 420, margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18 }}>←</button>
        <div style={{ fontSize: 15 }}>원장님 프로필</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 16 }}>{owner?.name || '원장님'}</div>
        <button onClick={() => setOpen(true)} style={{ marginTop: 14, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
          신고하기
        </button>
      </div>
      {open ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '92%', maxWidth: 360, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>원장님 신고</div>
            {['처방전 미발행', '제품 강매', '불친절', '비위생', '기타'].map((r) => (
              <label key={r} style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}
              </label>
            ))}
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="상세 내용" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '8px 10px', fontSize: 12 }} />
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} style={{ marginTop: 8, fontSize: 12 }} />
            <button onClick={() => void submit()} style={{ marginTop: 10, width: '100%', border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 12 }}>
              신고하기
            </button>
          </div>
        </div>
      ) : null}
      {toast ? <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 20, background: 'rgba(123,94,167,0.95)', borderRadius: 10, padding: '10px 14px', fontSize: 12, whiteSpace: 'pre-line' }}>{toast}</div> : null}
    </div>
  )
}
