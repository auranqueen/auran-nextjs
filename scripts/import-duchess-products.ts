import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://won.duchess.kr'

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

function absUrl(url: string) {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${BASE}${url}`
  return `${BASE}/${url}`
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AURAN Importer/1.0 (+https://www.auran.kr)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`)
  return await res.text()
}

function parseCategoryIds(html: string) {
  const ids = Array.from(html.matchAll(/list\.php\?ca_id=([0-9]+)/g)).map(m => m[1])
  return uniq(ids)
}

function parseGsIdsFromList(html: string) {
  const ids = Array.from(html.matchAll(/view\.php\?gs_id=([0-9]+)/g)).map(m => m[1])
  return uniq(ids)
}

function parseMeta(html: string, property: string) {
  const re = new RegExp(`<meta\\s+property=\\"${property}\\"\\s+content=\\"([^\\"]*)\\"`, 'i')
  const m = html.match(re)
  return m?.[1]?.trim() || ''
}

function parsePrice(html: string) {
  // <span class="spr">120,000<span>원</span></span>
  const m = html.match(/class="spr"\s*>\s*([0-9][0-9,]*)\s*<span/i)
  if (!m?.[1]) return 0
  const n = Number(m[1].replaceAll(',', ''))
  return Number.isFinite(n) ? n : 0
}

function parseThumb(html: string) {
  const og = parseMeta(html, 'og:image')
  if (og) return absUrl(og.split('?')[0])
  const m = html.match(/data\/goods\/[^"]+\/thumb-[^"]+\.(jpg|png|webp)/i)
  return m?.[0] ? absUrl(m[0]) : ''
}

function parseDetailImages(html: string) {
  const urls = Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/gi))
    .map(m => m[1])
    .map(u => u.split('?')[0])
    .map(absUrl)

  // Prefer editor images as detail images
  const editor = urls.filter(u => u.includes('/data/editor/'))
  const filtered = editor.length > 0 ? editor : urls.filter(u => u.includes('/data/goods/'))
  return uniq(filtered)
}

function decodeSomeKoreanGarble(s: string) {
  // In some environments the HTML may already be decoded; keep safe.
  return (s || '').replace(/\s+/g, ' ').trim()
}

function parseBrandName(html: string) {
  // Example (rendered):
  // <li class='tlst'>브랜드</li><li class='trst'>셀버트더말</li>
  const m1 = html.match(/브랜드<\/li>\s*<li[^>]*class=['"]trst['"][^>]*>\s*([^<]+)\s*</i)
  if (m1?.[1]) return decodeSomeKoreanGarble(m1[1])
  const m2 = html.match(/<li[^>]*class=['"]tlst['"][^>]*>\s*브랜드\s*<\/li>\s*<li[^>]*>\s*([^<]+)\s*</i)
  if (m2?.[1]) return decodeSomeKoreanGarble(m2[1])
  return ''
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.Supabase_service_key
  if (!url || !key) throw new Error('Missing SUPABASE service role env')
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  // 1) Discover categories from brand page (has most category links)
  const brandHtml = await fetchText(`${BASE}/m/shop/brand.php`)
  const categoryIds = parseCategoryIds(brandHtml)
  if (categoryIds.length === 0) throw new Error('No category ids discovered')

  console.log(`Discovered categories: ${categoryIds.length}`)

  // 2) Collect gs_ids from each category (first page only; many categories are empty)
  const gsIds: string[] = []
  for (const caId of categoryIds) {
    try {
      const listHtml = await fetchText(`${BASE}/m/shop/list.php?ca_id=${encodeURIComponent(caId)}`)
      const ids = parseGsIdsFromList(listHtml)
      if (ids.length > 0) console.log(`ca_id=${caId} -> ${ids.length} items`)
      gsIds.push(...ids)
    } catch (e: any) {
      console.warn(`WARN category fetch failed ca_id=${caId}: ${e?.message || e}`)
    }
  }
  const uniqueGs = uniq(gsIds)
  console.log(`Discovered products: ${uniqueGs.length}`)

  // 3) Upsert-like insert by tag (duchess:gs_id:<id>)
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const gsId of uniqueGs) {
    const tag = `duchess:gs_id:${gsId}`
    const { data: exists } = await supabase.from('products').select('id').eq('tag', tag).maybeSingle()
    if (exists?.id) {
      skipped++
      continue
    }

    try {
      const html = await fetchText(`${BASE}/m/shop/view.php?gs_id=${encodeURIComponent(gsId)}`)

      const name = parseMeta(html, 'og:title') || `Duchess 상품 #${gsId}`
      const description = parseMeta(html, 'og:description') || ''
      const brandName = parseBrandName(html) || 'DUCHESS'
      const price = parsePrice(html)
      const thumb = parseThumb(html)
      const detailImgs = parseDetailImages(html)

      // ensure brand exists
      let brandId: string | null = null
      {
        const { data: b } = await supabase.from('brands').select('id').eq('name', brandName).maybeSingle()
        if (b?.id) brandId = b.id
        else {
          const { data: created, error: berr } = await supabase
            .from('brands')
            .insert({ name: brandName, status: 'active' })
            .select('id')
            .single()
          if (berr) throw berr
          brandId = created?.id || null
        }
      }

      const { error } = await supabase.from('products').insert({
        brand_id: brandId,
        name,
        description,
        detail_html: '',
        retail_price: price,
        supply_price: 0,
        stock: 0,
        thumb_img: thumb,
        detail_imgs: detailImgs,
        icon: '🧴',
        tag,
        category: 'duchess',
        status: 'pending',
      })
      if (error) throw error
      inserted++
    } catch (e: any) {
      failed++
      console.warn(`FAIL gs_id=${gsId}: ${e?.message || e}`)
    }
  }

  console.log({ inserted, skipped, failed })
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

