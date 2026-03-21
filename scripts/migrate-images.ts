/**
 * duchess.kr 등 원격 thumb_img → Supabase Storage `product-images` 업로드 후 products.thumb_img 갱신
 *
 * 필요: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 실행: npm run migrate:images
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  FAILED_JSON,
  isAlreadyOnSupabaseStorage,
  normalizeImageUrl,
  uploadAndUpdateProduct,
  writeFailedJson,
  type FailedImageRecord,
} from './lib/product-image-migrate-shared'

dotenv.config({ path: '.env.local' })
dotenv.config()

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function firstEnv(names: string[]): string {
  for (const n of names) {
    const v = process.env[n]
    if (v) return v
  }
  throw new Error(`Missing env: one of [${names.join(', ')}]`)
}

const DELAY_MS = 100

async function main() {
  const supabaseUrl = mustEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = firstEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY'])

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: products, error } = await supabase
    .from('products')
    .select('id, thumb_img, name')
    .not('thumb_img', 'is', null)

  if (error) throw error

  const list = products || []
  console.log(`총 ${list.length}개 제품 이미지 마이그레이션 시작\n`)

  let success = 0
  let skipped = 0
  let failed = 0
  const failedRecords: FailedImageRecord[] = []

  for (const product of list) {
    try {
      if (isAlreadyOnSupabaseStorage(product.thumb_img)) {
        skipped++
        continue
      }

      const imgUrl = normalizeImageUrl(product.thumb_img)
      if (!imgUrl) {
        failed++
        failedRecords.push({
          id: product.id,
          name: product.name || '',
          thumb_img: product.thumb_img,
          reason: '유효한 http(s) URL 아님',
          at: new Date().toISOString(),
        })
        continue
      }

      await uploadAndUpdateProduct(supabase, supabaseUrl, product, imgUrl)
      success++
      console.log(`✅ (${success}) ${product.name}`)

      await new Promise(r => setTimeout(r, DELAY_MS))
    } catch (err: unknown) {
      failed++
      const e = err as Error & { status?: number }
      const reason = e.message || String(err)
      console.log(`❌ ${product.name}: ${reason}`)
      failedRecords.push({
        id: product.id,
        name: product.name || '',
        thumb_img: product.thumb_img,
        reason,
        status: e.status,
        at: new Date().toISOString(),
      })
    }
  }

  if (failedRecords.length > 0) {
    writeFailedJson(failedRecords)
  } else if (failed === 0) {
    console.log(`\n📝 실패 없음 — ${FAILED_JSON} 은 생성하지 않았습니다.`)
  }

  console.log(`\n=== 마이그레이션 완료 ===`)
  console.log(`✅ 성공: ${success}`)
  console.log(`⏭ 스킵(이미 Storage): ${skipped}`)
  console.log(`❌ 실패: ${failed}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
