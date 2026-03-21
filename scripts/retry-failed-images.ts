/**
 * failed-images.json 에 기록된 항목만 재시도
 *
 * 실행: npm run migrate:images:retry
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  FAILED_JSON,
  isAlreadyOnSupabaseStorage,
  normalizeImageUrl,
  readFailedJson,
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

  const items = readFailedJson()
  console.log(`재시도: ${items.length}건 (${FAILED_JSON})\n`)

  let success = 0
  let skipped = 0
  let failed = 0
  const stillFailed: FailedImageRecord[] = []

  for (const row of items) {
    const product = { id: row.id, name: row.name, thumb_img: row.thumb_img }
    try {
      if (isAlreadyOnSupabaseStorage(row.thumb_img)) {
        skipped++
        console.log(`⏭ 이미 Storage: ${row.name}`)
        continue
      }

      const imgUrl = normalizeImageUrl(row.thumb_img)
      if (!imgUrl) {
        failed++
        stillFailed.push({
          ...row,
          reason: '유효한 http(s) URL 아님',
          at: new Date().toISOString(),
        })
        continue
      }

      await uploadAndUpdateProduct(supabase, supabaseUrl, product, imgUrl)
      success++
      console.log(`✅ (${success}) ${row.name}`)

      await new Promise(r => setTimeout(r, DELAY_MS))
    } catch (err: unknown) {
      failed++
      const e = err as Error & { status?: number }
      const reason = e.message || String(err)
      console.log(`❌ ${row.name}: ${reason}`)
      stillFailed.push({
        id: row.id,
        name: row.name,
        thumb_img: row.thumb_img,
        reason,
        status: e.status,
        at: new Date().toISOString(),
      })
    }
  }

  if (stillFailed.length > 0) {
    writeFailedJson(stillFailed)
  } else {
    console.log(`\n📝 모든 재시도 성공 — ${FAILED_JSON} 은 삭제해도 됩니다.`)
  }

  console.log(`\n=== 재시도 완료 ===`)
  console.log(`✅ 성공: ${success}`)
  console.log(`⏭ 스킵: ${skipped}`)
  console.log(`❌ 여전히 실패: ${stillFailed.length}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
