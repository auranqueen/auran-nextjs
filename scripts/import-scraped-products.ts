/**
 * scripts/*-products.json → Supabase products (tag: scraped:{brand}:{id})
 *
 * 실행: npm run import:products
 */
import { createHash } from 'crypto'
import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const BRAND_MAP: Record<string, string> = {
  gernetic: '41f4a012-d777-4ebd-a95c-04444a2ff799',
  civasan: 'cc7a51be-caef-46b6-b161-6c4a804d0856',
  soskin: 'b35fe63d-c747-404f-a77e-2556cbbbaaf2',
  thalac: '1ac8ee57-892a-43dd-b55f-b3ea01275164',
}

const FILE_MAP: Record<string, string> = {
  gernetic: 'gernetic-products.json',
  civasan: 'civasan-products.json',
  soskin: 'soskin-products.json',
  thalac: 'thalac-products.json',
}

type BrandKey = 'gernetic' | 'civasan' | 'soskin' | 'thalac'

function priceWonFromRow(row: Record<string, unknown>): number {
  const pw = row.priceWon
  if (typeof pw === 'number' && Number.isFinite(pw) && pw > 0) return Math.floor(pw)
  const p = String(row.price ?? '')
  const n = Number(p.replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function thumbFromRow(row: Record<string, unknown>): string | null {
  const img = row.img
  if (typeof img === 'string' && img.trim()) return img.trim()
  return null
}

function descriptionFromRow(brand: BrandKey, row: Record<string, unknown>): string | null {
  const d = row.description
  if (typeof d === 'string' && d.trim()) return d.trim()
  if (brand === 'thalac') {
    const en = row.nameEn
    if (typeof en === 'string' && en.trim()) return en.trim()
  }
  return null
}

function stableIdPart(brand: BrandKey, row: Record<string, unknown>): string {
  const link = String(row.link || '')
  const no = row.productNo ?? row.code ?? row.detailCode
  if (no != null && String(no).length > 0) return String(no)
  const name = String(row.name || '')
  const h = createHash('sha256')
    .update(`${brand}|${name}|${link}`)
    .digest('hex')
    .slice(0, 24)
  return `h${h}`
}

async function importBrand(brand: BrandKey) {
  const brandId = BRAND_MAP[brand]!
  const fileName = FILE_MAP[brand]!
  const filePath = path.join(process.cwd(), 'scripts', fileName)

  if (!fs.existsSync(filePath)) {
    console.warn(`[${brand}] skip — 파일 없음: ${filePath}`)
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.Supabase_service_key
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>[]
  if (!Array.isArray(raw) || raw.length === 0) {
    console.log(`[${brand}] 항목 0개`)
    return
  }

  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const row of raw) {
    const name = String(row.name || '').trim()
    if (!name) {
      failed++
      continue
    }

    const idPart = stableIdPart(brand, row)
    const tag = `scraped:${brand}:${idPart}`

    const { data: exists } = await supabase.from('products').select('id').eq('tag', tag).maybeSingle()
    if (exists?.id) {
      skipped++
      continue
    }

    const retailPrice = priceWonFromRow(row)
    const thumb = thumbFromRow(row)
    const description = descriptionFromRow(brand, row)

    const { error } = await supabase.from('products').insert({
      brand_id: brandId,
      name,
      description,
      detail_html: '',
      retail_price: retailPrice,
      supply_price: 0,
      stock: 0,
      thumb_img: thumb,
      detail_imgs: [] as string[],
      icon: '🧴',
      tag,
      category: 'scraped',
      status: 'pending',
    })

    if (error) {
      failed++
      console.warn(`[${brand}] FAIL ${name.slice(0, 40)}: ${error.message}`)
    } else {
      inserted++
    }
  }

  console.log(`[${brand}] 완료 — 삽입 ${inserted}, 스킵(기존 tag) ${skipped}, 실패 ${failed}`)
}

async function main() {
  await importBrand('gernetic')
  await importBrand('civasan')
  await importBrand('soskin')
  await importBrand('thalac')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
