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

export async function compressImage(
  file: File,
  ruleKey: ImageRuleKey
): Promise<File> {
  const rule = IMAGE_RULES[ruleKey]
  const compressed = await imageCompression(file, {
    maxSizeMB: rule.maxSizeMB,
    maxWidthOrHeight: Math.max(rule.maxWidth, rule.maxHeight),
    useWebWorker: true,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
  })
  return new File([compressed], file.name, { type: compressed.type })
}

export function getImageHint(ruleKey: ImageRuleKey): string {
  return IMAGE_RULES[ruleKey].hint
}
