/**
 * https://civasan.com (아임웹) 상품 목록 스크래핑 → scripts/civasan-products.json
 *
 * 실행: npm run scrape:civasan
 */
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'https://civasan.com'
const PRODUCT_URL = `${BASE_URL}/product`

type CheerioRoot = ReturnType<typeof cheerio.load>

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Referer: BASE_URL,
}

export type CivasanScrapedProduct = {
  productNo: string | null
  code: string | null
  name: string
  img: string | null
  price: string | null
  priceWon: number | null
  link: string
  description: string | null
  brand: string
  source: string
}

type ImwebDataProduct = {
  idx?: number
  code?: string
  name?: string
  original_price?: number
  price?: number
  image_url?: string
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

function absUrl(href: string | undefined | null): string | null {
  if (!href) return null
  const h = href.trim()
  if (!h || h === '#' || h.startsWith('javascript')) return null
  if (h.startsWith('http://') || h.startsWith('https://')) return h
  if (h.startsWith('//')) return `https:${h}`
  if (h.startsWith('/')) return `${BASE_URL}${h}`
  return `${BASE_URL}/${h}`
}

function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

function parsePriceWonFromText(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/([\d,]+)\s*원/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 아임웹: [data-product-properties] JSON */
function parseImwebDataProductProps($: CheerioRoot, source: string): CivasanScrapedProduct[] {
  const out: CivasanScrapedProduct[] = []
  $('[data-product-properties]').each((_, el) => {
    const raw = $(el).attr('data-product-properties')
    if (!raw) return
    let data: ImwebDataProduct
    try {
      data = JSON.parse(raw) as ImwebDataProduct
    } catch {
      return
    }
    const idx = data.idx
    const name = (data.name || '').trim()
    if (!name) return
    const priceNum = typeof data.price === 'number' ? data.price : null
    const link = idx != null ? `${BASE_URL}/product/?idx=${idx}` : absUrl($(el).find('a[href*="idx="]').first().attr('href')) || source

    let brand = 'CIVASAN'
    const brandText = $(el).find('.shop-brand').first().text().trim()
    if (brandText) brand = brandText

    const desc = $(el).find('.item-detail .text, .item_detail, .summary').first().text().trim() || null

    out.push({
      productNo: idx != null ? String(idx) : null,
      code: data.code ?? null,
      name,
      img: data.image_url?.trim() || null,
      price: priceNum != null ? formatWon(priceNum) : null,
      priceWon: priceNum,
      link,
      description: desc,
      brand,
      source,
    })
  })
  return out
}

function getMaxPage($: CheerioRoot): number {
  let max = 1
  $('.pagination a[href*="page="], ul.pagination a[href*="page="]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const m = href.match(/page=(\d+)/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  })
  return max
}

/** 셀렉터 폴백 (구 카페24·일반 리스트) */
function extractProductsFallback($: CheerioRoot, sourceUrl: string, baseUrl: string): CivasanScrapedProduct[] {
  const out: CivasanScrapedProduct[] = []
  const selectors = [
    'ul.prdList > li[id^="anchorBoxId_"]',
    '.prdList li',
    '.shop-item',
    '.product-item',
    '.xans-product-listnormal li',
  ]

  for (const selector of selectors) {
    const items = $(selector)
    if (items.length === 0) continue

    items.each((_, el) => {
      const $el = $(el)
      const name =
        $el.find('.shop-title, .prdName, .name, h2, h3, h4, [class*="title"]').first().text().trim() ||
        $el.find('img').first().attr('alt')?.trim() ||
        ''
      if (!name || name.length < 2) return

      let img =
        $el.find('img').first().attr('src') ||
        $el.find('img').first().attr('data-src') ||
        $el.find('img').first().attr('ec-data-src')
      if (img && img.startsWith('//')) img = 'https:' + img
      if (img && img.startsWith('/')) img = baseUrl + img

      const priceText = $el.find('.pay, [class*="price"], .price').first().text().trim()
      const priceWon = parsePriceWonFromText(priceText)

      const link = $el.find('a[href*="product"], a[href*="idx="]').first().attr('href') || $el.find('a').first().attr('href')
      const fullLink = absUrl(link) || sourceUrl

      const desc = $el.find('[class*="desc"], .description, p.summary').first().text().trim() || null

      const idAttr = $el.attr('id') || ''
      const productNo = idAttr.startsWith('anchorBoxId_') ? idAttr.replace('anchorBoxId_', '') : null

      out.push({
        productNo,
        code: null,
        name,
        img: img || null,
        price: priceText || null,
        priceWon,
        link: fullLink,
        description: desc,
        brand: 'civasan',
        source: sourceUrl,
      })
    })
    if (out.length) break
  }
  return out
}

function buildListUrl(base: string, page: number): string {
  const u = new URL(base.startsWith('http') ? base : `${BASE_URL}${base}`)
  if (u.pathname === '/product' || u.pathname === '/product/') {
    u.searchParams.set('sort', 'recent')
    if (page > 1) u.searchParams.set('page', String(page))
  } else if (page > 1) {
    u.searchParams.set('page', String(page))
  }
  return u.toString()
}

/** 회사·소개 등 비상품 페이지 (숫자 URL이어도 제외) */
const EXCLUDE_NUMERIC_SLUGS = new Set<string>(['33'])

/** 메인 /product 1페이지에서 숫자 경로(브랜드·서브) 링크 수집 */
function discoverNumericSectionUrls($: CheerioRoot): string[] {
  const set = new Set<string>()
  $('a[href]').each((_, el) => {
    const h = ($(el).attr('href') || '').trim()
    if (!h || h.startsWith('javascript')) return
    const m = h.match(/^\/(\d+)\/?$/)
    if (!m) return
    if (EXCLUDE_NUMERIC_SLUGS.has(m[1])) return
    const u = absUrl(h)
    if (u) set.add(u)
  })
  return [...set].slice(0, 30)
}

function dedupeByKey(products: CivasanScrapedProduct[]): CivasanScrapedProduct[] {
  const seen = new Set<string>()
  return products.filter(p => {
    const k = p.productNo ? `id:${p.productNo}` : `link:${p.link}|${p.name}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function scrapeListPages(startUrl: string, label: string): Promise<CivasanScrapedProduct[]> {
  const collected: CivasanScrapedProduct[] = []
  const firstHtml = await fetchPage(startUrl)
  const $first = cheerio.load(firstHtml)
  const maxPage = Math.max(1, getMaxPage($first))

  for (let page = 1; page <= maxPage; page++) {
    const url = page === 1 ? startUrl : buildListUrl(startUrl, page)
    const html = page === 1 ? firstHtml : await fetchPage(url)
    const $ = cheerio.load(html)

    let batch = parseImwebDataProductProps($, url)
    if (batch.length === 0) batch = extractProductsFallback($, url, BASE_URL)

    console.log(`  → [${label}] ${url} : ${batch.length}개`)
    collected.push(...batch)
    await new Promise(r => setTimeout(r, 400))
  }
  return collected
}

async function scrapeCivasan() {
  console.log('💙 civasan.com 스크래핑 시작 (아임웹 data-product-properties 우선)\n')

  const allProducts: CivasanScrapedProduct[] = []

  console.log('📄 전체 상품 /product')
  allProducts.push(...(await scrapeListPages(PRODUCT_URL, 'product')))

  let extraUrls: string[] = []
  try {
    const mainHtml = await fetchPage(PRODUCT_URL)
    const $m = cheerio.load(mainHtml)
    extraUrls = discoverNumericSectionUrls($m)
    console.log(`\n🔗 숫자 경로 서브 페이지 ${extraUrls.length}개:`, extraUrls.slice(0, 12), extraUrls.length > 12 ? '...' : '')
  } catch (e) {
    console.log('서브 URL 수집 스킵', e)
  }

  for (const u of extraUrls) {
    try {
      allProducts.push(...(await scrapeListPages(u, new URL(u).pathname)))
    } catch (e) {
      console.log(`  ❌ 실패 ${u}`, e)
    }
    await new Promise(r => setTimeout(r, 350))
  }

  const unique = dedupeByKey(allProducts)

  console.log(`\n=== 시바산 스크래핑 완료 ===`)
  console.log(`총 ${unique.length}개 제품 (중복 제거 후)`)

  const outPath = path.join(process.cwd(), 'scripts', 'civasan-products.json')
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')
  console.log(`✅ ${outPath} 저장 완료`)
  console.log('\n샘플 3개:')
  console.log(JSON.stringify(unique.slice(0, 3), null, 2))
}

scrapeCivasan().catch(err => {
  console.error(err)
  process.exit(1)
})
