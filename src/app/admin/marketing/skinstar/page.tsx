'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SkinstarVideosPage() {
  const supabase = createClient()
  const [videos, setVideos] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from('skinstar_videos').select('*').order('sort_order').order('created_at', { ascending: false })
    setVideos(data ?? [])
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMsg('')
    try {
      const ext = file.name.split('.').pop()
      const path = `skinstar/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('product-videos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('product-videos').getPublicUrl(path)
      await supabase.from('skinstar_videos').insert({ video_url: urlData.publicUrl, is_active: true, sort_order: 0 })
      setMsg('업로드 완료!')
      load()
    } catch (err: any) {
      setMsg('업로드 실패: ' + err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('skinstar_videos').update({ is_active: !current }).eq('id', id)
    load()
  }

  const deleteVideo = async (id: string) => {
    await supabase.from('skinstar_videos').delete().eq('id', id)
    load()
  }

  return (
    <div style={{ padding: 24, color: '#fff' }}>
      <div style={{ fontSize: 18, marginBottom: 20 }}>스킨스타 영상 관리</div>
      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: '#C9A96E' }}>{msg}</div>}
      <div style={{ marginBottom: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>영상 업로드 (mp4, mov)</div>
        <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} disabled={uploading} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
        {uploading && <div style={{ marginTop: 8, fontSize: 12, color: '#7B5EA7' }}>업로드 중...</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {videos.map(v => (
          <div key={v.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <video src={v.video_url} style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover' }} controls muted playsInline />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <div
                  onClick={() => toggleActive(v.id, v.is_active)}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, cursor: 'pointer', background: v.is_active ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.06)', color: v.is_active ? '#5DCAA5' : 'rgba(255,255,255,0.3)', border: `1px solid ${v.is_active ? 'rgba(29,158,117,0.3)' : 'rgba(255,255,255,0.1)'}` }}
                >{v.is_active ? '노출 중' : '숨김'}</div>
                <div onClick={() => deleteVideo(v.id)} style={{ fontSize: 11, color: '#F09595', cursor: 'pointer' }}>삭제</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
