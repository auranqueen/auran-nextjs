import type { SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

export type FailedImageRecord = {
  id: string
  name: string
  thumb_img: string | null
  reason: string
  status?: number
  at: string
}

export const FAILED_JSON = path.join(process.cwd(), 'failed-images.json')

export function isAlreadyOnSupabaseStorage(url: string | null | undefined): boolean {
  if (!url) return false
  return url.includes('supabase.co') && url.includes('/storage/v1/object/public/product-images/')
}

export function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const u = String(raw).trim()
  if (!u) return null
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return null
}

export function extensionFromUrl(imgUrl: string): string {
  try {
    const pathname = new URL(imgUrl).pathname
    const base = pathname.split('/').pop() || 'image.jpg'
    const ext = base.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg'
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
    return 'jpg'
  } catch {
    const noQuery = imgUrl.split('?')[0] || ''
    const ext = noQuery.split('.').pop()?.toLowerCase() || 'jpg'
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
    return 'jpg'
  }
}

export function contentTypeForExt(ext: string): string {
  const e = ext.toLowerCase()
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
  if (e === 'png') return 'image/png'
  if (e === 'webp') return 'image/webp'
  if (e === 'gif') return 'image/gif'
  return 'image/jpeg'
}

export function publicObjectUrl(supabaseUrl: string, fileName: string): string {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/product-images/${fileName}`
}

export async function downloadRemoteImage(imgUrl: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const res = await fetch(imgUrl, {
    headers: {
      Referer: 'https://duchess.kr/',
      'User-Agent': 'AURAN-ImageMigrate/1.0 (+https://www.auran.kr)',
      Accept: 'image/*,*/*;q=0.8',
    },
  })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  const buffer = await res.arrayBuffer()
  const ct = res.headers.get('content-type')?.split(';')[0]?.trim()
  const ext = extensionFromUrl(imgUrl)
  const contentType =
    ct && ct.startsWith('image/') ? ct : contentTypeForExt(ext)
  return { buffer, contentType }
}

export async function uploadAndUpdateProduct(
  supabase: SupabaseClient,
  supabaseUrl: string,
  product: { id: string; name: string; thumb_img: string | null },
  imgUrl: string
): Promise<void> {
  const { buffer, contentType } = await downloadRemoteImage(imgUrl)
  const ext = extensionFromUrl(imgUrl)
  const fileName = `${product.id}.${ext}`

  const body = Buffer.from(buffer)

  const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, body, {
    contentType,
    upsert: true,
  })

  if (uploadError) throw new Error(uploadError.message)

  const newUrl = publicObjectUrl(supabaseUrl, fileName)
  const { error: updateError } = await supabase.from('products').update({ thumb_img: newUrl }).eq('id', product.id)
  if (updateError) throw new Error(updateError.message)
}

export function writeFailedJson(items: FailedImageRecord[]): void {
  const payload = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  }
  fs.writeFileSync(FAILED_JSON, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`\n📝 실패 목록 저장: ${FAILED_JSON} (${items.length}건)`)
}

export function readFailedJson(): FailedImageRecord[] {
  if (!fs.existsSync(FAILED_JSON)) {
    throw new Error(`파일이 없습니다: ${FAILED_JSON} (먼저 migrate-images를 실행하세요)`)
  }
  const raw = JSON.parse(fs.readFileSync(FAILED_JSON, 'utf8')) as { items?: FailedImageRecord[] }
  if (!Array.isArray(raw.items)) throw new Error('failed-images.json 형식이 올바르지 않습니다 (items 배열 필요)')
  return raw.items
}
