'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const ProductDetailEditor = dynamic(() => import('@/components/admin/ProductDetailEditor'), { ssr: false })

interface Props {
  companyId: string
  staffId: string | null
  category: 'treatment' | 'material'
  /** 있으면 일반/아레테 선택 UI 숨기고 등록 source 고정 */
  fixedSource?: 'general' | 'arete'
}

type Source = 'general' | 'arete'

interface ArchiveItem {
  id: string
  title: string
  source: string
  body_html?: string | null
  asset_url?: string | null
  created_at?: string
}

const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
}
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const INPUT: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function BrandArchiveManage({ companyId, staffId, category, fixedSource }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [assetUrl, setAssetUrl] = useState('')
  const [source, setSource] = useState<Source>(fixedSource || 'general')
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [preview, setPreview] = useState<ArchiveItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/brand/archive/list?company_id=${encodeURIComponent(companyId)}&category=${encodeURIComponent(category)}`,
      )
      const json = await res.json()
      if (json?.ok) setItems(json.items || [])
      else showToast(json?.error || '목록 불러오기 실패')
    } catch {
      showToast('목록 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [companyId, category])

  useEffect(() => {
    setPreview(null)
    void load()
  }, [load])

  useEffect(() => {
    if (fixedSource) setSource(fixedSource)
  }, [fixedSource])

  const uploadToBrandAssets = async (file: File, forceExt?: string) => {
    const ext = forceExt || (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `archive/${companyId}-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
    if (error || !data) throw new Error(error?.message || 'upload_failed')
    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return urlData.publicUrl
  }

  const onImageUpload = async (file: File) => {
    setUploading(true)
    try {
      let uploadFile = file
      try {
        uploadFile = await compressImage(file, 'product_detail')
      } catch {
        uploadFile = file
      }
      const ext = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase()
      return await uploadToBrandAssets(uploadFile, ext)
    } finally {
      setUploading(false)
    }
  }

  const onVideoUpload = async (file: File) => {
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
      return await uploadToBrandAssets(file, ext)
    } finally {
      setUploading(false)
    }
  }

  const onAssetFile = async (file: File) => {
    setUploading(true)
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      let uploadFile = file
      if (!isPdf && file.type.startsWith('image/')) {
        try {
          uploadFile = await compressImage(file, 'product_detail')
        } catch {
          uploadFile = file
        }
      }
      const ext = (uploadFile.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg')).toLowerCase()
      const url = await uploadToBrandAssets(uploadFile, ext)
      setAssetUrl(url)
      showToast('파일 업로드 완료')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  const attachFileToItem = async (itemId: string, file: File) => {
    setAttachingId(itemId)
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      let uploadFile = file
      if (!isPdf && file.type.startsWith('image/')) {
        try {
          uploadFile = await compressImage(file, 'product_detail')
        } catch {
          uploadFile = file
        }
      }
      const ext = (uploadFile.name.split('.').pop() || (isPdf ? 'pdf' : 'jpg')).toLowerCase()
      const path = `archive/${companyId}-${itemId}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, uploadFile, { upsert: true })
      if (error || !data) throw new Error(error?.message || 'upload_failed')
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const res = await fetch('/api/brand/archive/attach-file', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemId,
          company_id: companyId,
          staff_id: staffId || '',
          asset_url: urlData.publicUrl,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '첨부 저장 실패')
        return
      }
      showToast('파일 첨부 완료')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '첨부 실패')
    } finally {
      setAttachingId(null)
    }
  }

  const onRegister = async () => {
    if (!title.trim()) {
      showToast('제목을 입력하세요')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/brand/archive/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          staff_id: staffId || '',
          category,
          source: fixedSource || source,
          title: title.trim(),
          body_html: bodyHtml,
          asset_url: assetUrl || null,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '등록 실패')
        return
      }
      setTitle('')
      setBodyHtml('')
      setAssetUrl('')
      setSource(fixedSource || 'general')
      showToast('등록 완료')
      await load()
    } catch {
      showToast('등록 실패')
    } finally {
      setSaving(false)
    }
  }

  const catLabel = category === 'treatment' ? '트리트먼트 프로그램' : '제품교육자료'

  return (
    <div>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '7px 18px',
            borderRadius: 20,
            zIndex: 999,
          }}
        >
          {toast}
        </div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>{catLabel} 등록</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>제목</div>
          <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>본문</div>
          <ProductDetailEditor value={bodyHtml} onChange={setBodyHtml} onImageUpload={onImageUpload} onVideoUpload={onVideoUpload} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>첨부 (이미지/PDF)</div>
          <input
            type="file"
            accept="image/*,.pdf"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onAssetFile(f)
              e.target.value = ''
            }}
            style={{ fontSize: 12, color: TEXT }}
          />
          {assetUrl && (
            <div style={{ fontSize: 11, color: PURPLE, marginTop: 6, wordBreak: 'break-all' }}>{assetUrl}</div>
          )}
        </div>
        {!fixedSource && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setSource('general')}
              style={{
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 8,
                border: source === 'general' ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.1)',
                background: source === 'general' ? 'rgba(123,94,167,0.25)' : 'transparent',
                color: TEXT,
                cursor: 'pointer',
              }}
            >
              일반
            </button>
            <button
              type="button"
              onClick={() => setSource('arete')}
              style={{
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 8,
                border: source === 'arete' ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.1)',
                background: source === 'arete' ? 'rgba(123,94,167,0.25)' : 'transparent',
                color: TEXT,
                cursor: 'pointer',
              }}
            >
              ⭐아레테전용
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={saving || uploading}
          onClick={() => void onRegister()}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            border: 'none',
            background: PURPLE,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving || uploading ? 0.7 : 1,
          }}
        >
          {saving ? '등록 중…' : '등록'}
        </button>
      </div>

      {preview ? (
        <div style={CARD}>
          <button
            type="button"
            onClick={() => setPreview(null)}
            style={{
              background: 'none',
              border: 'none',
              color: PURPLE,
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              marginBottom: 12,
            }}
          >
            ← 목록으로
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>{preview.title}</div>
            {preview.source === 'arete' && (
              <span
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(201,169,110,0.15)',
                  color: '#C9A96E',
                  whiteSpace: 'nowrap',
                }}
              >
                ⭐아레테전용
              </span>
            )}
          </div>
          {preview.body_html ? (
            <div
              style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: preview.body_html }}
            />
          ) : (
            <div style={{ fontSize: 12, color: SUB }}>본문이 없어요.</div>
          )}
          {preview.asset_url && (
            <a
              href={preview.asset_url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 12, fontSize: 12, color: PURPLE }}
            >
              첨부 파일 열기
            </a>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>등록된 자료</div>
          {loading ? (
            <div style={{ color: SUB, fontSize: 12 }}>불러오는 중…</div>
          ) : items.length === 0 ? (
            <div style={{ color: SUB, fontSize: 12 }}>아직 등록된 자료가 없어요.</div>
          ) : (
            items.map((it) => (
              <div key={it.id} style={{ ...CARD, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setPreview(it)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'block',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{it.title}</div>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: it.source === 'arete' ? 'rgba(201,169,110,0.15)' : 'rgba(123,94,167,0.15)',
                        color: it.source === 'arete' ? '#C9A96E' : PURPLE,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {it.source === 'arete' ? '⭐아레테전용' : '일반'}
                    </span>
                  </div>
                </button>
                <div
                  style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {it.asset_url ? (
                      <>
                        <span style={{ fontSize: 11, color: '#C9A96E' }}>📄 첨부됨</span>
                        <label
                          style={{
                            fontSize: 11,
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: `1px solid ${PURPLE}`,
                            color: '#c4a7e7',
                            cursor: attachingId === it.id ? 'wait' : 'pointer',
                            opacity: attachingId === it.id ? 0.6 : 1,
                          }}
                        >
                          {attachingId === it.id ? '업로드 중…' : '교체'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            disabled={attachingId === it.id}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              e.target.value = ''
                              if (f) void attachFileToItem(it.id, f)
                            }}
                          />
                        </label>
                      </>
                    ) : (
                      <label
                        style={{
                          fontSize: 11,
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: `1px solid ${PURPLE}`,
                          color: '#c4a7e7',
                          cursor: attachingId === it.id ? 'wait' : 'pointer',
                          opacity: attachingId === it.id ? 0.6 : 1,
                        }}
                      >
                        {attachingId === it.id ? '업로드 중…' : '📎 파일 첨부'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          disabled={attachingId === it.id}
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            e.target.value = ''
                            if (f) void attachFileToItem(it.id, f)
                          }}
                        />
                      </label>
                    )}
                    <span
                      title="💰 원장님이 바로 뽑아 써서 관리권 매출을 팡팡 올릴 수 있는 완성 자료를 넣어주세요! (본문에 쓴 사진이랑은 또 달라요 🙈)"
                      style={{ fontSize: 12, color: SUB, cursor: 'help' }}
                    >
                      ❓
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: SUB, marginTop: 6, lineHeight: 1.45 }}>
                    💰 원장님이 바로 뽑아 써서 관리권 매출을 팡팡 올릴 수 있는 완성 자료를 넣어주세요! (본문에 쓴 사진이랑은 또 달라요 🙈)
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}