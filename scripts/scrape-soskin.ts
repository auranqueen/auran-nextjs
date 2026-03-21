/**
 * https://soskinkorea.imweb.me (이타카) 상품 목록 스크래핑 → scripts/soskin-products.json
 *
 * 실행: npm run scrape:soskin
 */
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'https://soskinkorea.imweb.me'

type CheerioRoot = ReturnType<typeof cheerio.load>

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Referer: BASE_URL,
}

export type SoskinScrapedProduct = {
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

function listIdxLink($: CheerioRoot, el: unknown, sourceUrl: string): string {
  const $el = $(el)
  const href = $el.find('a[href*="idx="]').first().attr('href')
  const fromHref = absUrl(href)
  if (fromHref) return fromHref

  const raw = $el.attr('data-product-properties')
  if (!raw) return sourceUrl
  let data: ImwebDataProduct
  try {
    data = JSON.parse(raw) as ImwebDataProduct
  } catch {
    return sourceUrl
  }
  const idx = data.idx
  if (idx == null) return sourceUrl

  const pathname = new URL(sourceUrl).pathname.replace(/\/$/, '') || '/'
  return `${BASE_URL}${pathname}/?idx=${idx}`
}

function parseImwebDataProductProps($: CheerioRoot, source: string): SoskinScrapedProduct[] {
  const out: SoskinScrapedProduct[] = []
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
    const link = listIdxLink($, el, source)

    let brand = 'soskin'
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

function extractProductsFallback($: CheerioRoot, sourceUrl: string, baseUrl: string): SoskinScrapedProduct[] {
  const out: SoskinScrapedProduct[] = []
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
        brand: 'soskin',
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
    if (!u.searchParams.has('sort')) u.searchParams.set('sort', 'like')
  }
  return u.toString()
}

function discoverNumericSectionUrls($: CheerioRoot): string[] {
  const set = new Set<string>()
  $('a[href]').each((_, el) => {
    const h = ($(el).attr('href') || '').trim()
    if (!h || h.startsWith('javascript')) return
    const m = h.match(/^\/(\d+)\/?(?:\?|$)/)
    if (!m) return
    const u = absUrl(h.split('?')[0])
    if (u) set.add(u.replace(/\/$/, ''))
  })
  return [...set].slice(0, 40)
}

function dedupeByKey(products: SoskinScrapedProduct[]): SoskinScrapedProduct[] {
  const seen = new Set<string>()
  return products.filter(p => {
    const k = p.productNo ? `id:${p.productNo}` : `link:${p.link}|${p.name}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function scrapeListPages(startUrl: string, label: string): Promise<SoskinScrapedProduct[]> {
  const collected: SoskinScrapedProduct[] = []
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

async function scrapeSoskin() {
  console.log('🌿 soskinkorea.imweb.me 스크래핑 시작 (아임웹 data-product-properties 우선)\n')

  const allProducts: SoskinScrapedProduct[] = []

  console.log('📄 전체 상품 /50')
  allProducts.push(...(await scrapeListPages(`${BASE_URL}/50`, '50')))

  let extraUrls: string[] = []
  try {
    const mainHtml = await fetchPage(`${BASE_URL}/`)
    const $m = cheerio.load(mainHtml)
    extraUrls = discoverNumericSectionUrls($m).filter(u => !u.endsWith('/50') && u !== `${BASE_URL}/50`)
    console.log(`\n🔗 숫자 경로 서브 페이지 ${extraUrls.length}개:`, extraUrls.slice(0, 14), extraUrls.length > 14 ? '...' : '')
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

  console.log(`\n=== 이타카(Soskin) 스크래핑 완료 ===`)
  console.log(`총 ${unique.length}개 제품 (중복 제거 후)`)

  const outPath = path.join(process.cwd(), 'scripts', 'soskin-products.json')
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')
  console.log(`✅ ${outPath} 저장 완료`)
  console.log('\n샘플 3개:')
  console.log(JSON.stringify(unique.slice(0, 3), null, 2))
}

scrapeSoskin().catch(err => {
  console.error(err)
  process.exit(1)
})
