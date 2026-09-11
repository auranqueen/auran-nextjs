import imageCompression from 'browser-image-compression'

export const IMAGE_RULES = {
  product_thumb: { maxWidth: 600, maxHeight: 600, maxSizeMB: 0.2, label: '제품 썸네일', hint: '600×600px, 200KB 이하 권장' },
  product_detail: { maxWidth: 1200, maxHeight: 1200, maxSizeMB: 0.5, label: '제품 상세', hint: '1200×1200px, 500KB 이하 권장' },
  brand_logo: { maxWidth: 400, maxHeight: 400, maxSizeMB: 0.1, label: '브랜드 로고', hint: '400×400px, 100KB 이하 권장' },
  community: { maxWidth: 1080, maxHeight: 1080, maxSizeMB: 0.3, label: '커뮤니티', hint: '1080×1080px, 300KB 이하 권장' },
  magazine: { maxWidth: 800, maxHeight: 600, maxSizeMB: 0.2, label: '매거진', hint: '800×600px, 200KB 이하 권장' },
  diary: { maxWidth: 1080, maxHeight: 1920, maxSizeMB: 0.4, label: '다이어리', hint: '1080×1920px, 400KB 이하 권장' },
  avatar: { maxWidth: 400, maxHeight: 400, maxSizeMB: 0.1, label: '프로필 사진', hint: '400×400px, 100KB 이하 권장' },
  owner_store: { maxWidth: 800, maxHeight: 800, maxSizeMB: 0.2, label: '샵 이미지', hint: '800×800px, 200KB 이하 권장' },
} as const

export type ImageRuleKey = keyof typeof IMAGE_RULES

const COMPRESS_TIMEOUT_MS = 10000

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('compress_timeout')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function compressImage(
  file: File,
  ruleKey: ImageRuleKey
): Promise<File> {
  const mime = (file.type || '').toLowerCase()
  const fname = (file.name || '').toLowerCase()
  if (mime.includes('image/heic') || mime.includes('image/heif') || fname.endsWith('.heic') || fname.endsWith('.heif')) {
    try {
      const heic2any = (await import('heic2any')).default
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
      const blob = (Array.isArray(converted) ? converted[0] : converted) as Blob
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'
      file = new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
    } catch {
      // 변환 실패 시 원본 file을 기존 압축 로직에 전달
    }
  }

  const rule = IMAGE_RULES[ruleKey]
  const asPng = (file.type || '').toLowerCase() === 'image/png'
  try {
    const compressed = await withTimeout(
      imageCompression(file, {
        maxSizeMB: rule.maxSizeMB,
        maxWidthOrHeight: Math.max(rule.maxWidth, rule.maxHeight),
        useWebWorker: false,
        fileType: asPng ? 'image/png' : 'image/jpeg',
      }),
      COMPRESS_TIMEOUT_MS,
    )
    const outType = compressed.type || (asPng ? 'image/png' : 'image/jpeg')
    const base = file.name.replace(/\.[^.]+$/, '') || 'image'
    const ext = outType === 'image/png' ? 'png' : 'jpg'
    return new File([compressed], `${base}.${ext}`, { type: outType })
  } catch {
    try {
      const originalMax = Math.max(rule.maxWidth, rule.maxHeight)
      const retryMax = Math.min(originalMax, Math.max(300, Math.floor(originalMax / 2)))
      const compressed = await withTimeout(
        imageCompression(file, {
          maxSizeMB: rule.maxSizeMB,
          maxWidthOrHeight: retryMax,
          useWebWorker: false,
          fileType: asPng ? 'image/png' : 'image/jpeg',
        }),
        COMPRESS_TIMEOUT_MS,
      )
      const outType = compressed.type || (asPng ? 'image/png' : 'image/jpeg')
      const base = file.name.replace(/\.[^.]+$/, '') || 'image'
      const ext = outType === 'image/png' ? 'png' : 'jpg'
      return new File([compressed], `${base}.${ext}`, { type: outType })
    } catch {
      return file
    }
  }
}

export function getImageHint(ruleKey: ImageRuleKey): string {
  return IMAGE_RULES[ruleKey].hint
}
