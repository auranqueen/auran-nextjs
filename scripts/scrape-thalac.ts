/**
 * https://www.thalac.kr (탈라) 상품 목록 스크래핑 → scripts/thalac-products.json
 *
 * product.php의 #productGrid .p-card 구조 (서버 렌더)
 * 상세: GET product_detail.php?a=... (goDetail과 동일)
 *
 * 실행: npm run scrape:thalac
 */
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'https://www.thalac.kr'
const PRODUCT_URL = `${BASE_URL}/product.php`

type CheerioRoot = ReturnType<typeof cheerio.load>

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: BASE_URL,
}

export type ThalacScrapedProduct = {
  name: string
  nameEn: string | null
  img: string | null
  price: string | null
  priceWon: number | null
  link: string
  detailCode: string | null
  brand: string
  source: string
  category: string | null
  subCategory: string | null
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

function absUrl(href: string | undefined | null, baseUrl: string): string | null {
  if (!href) return null
  const h = href.trim()
  if (!h || h === '#') return null
  if (h.startsWith('http://') || h.startsWith('https://')) return h
  if (h.startsWith('//')) return `https:${h}`
  if (h.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${h}`
  return `${baseUrl.replace(/\/$/, '')}/${h}`
}

function parsePriceWonFromThalac(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

/** goDetail('...') → GET 가능한 상세 URL */
function detailLinkFromOnClick(onclick: string | undefined): { code: string | null; link: string } {
  if (!onclick) return { code: null, link: PRODUCT_URL }
  const m = onclick.match(/goDetail\(\s*['"]([^'"]+)['"]\s*\)/)
  const code = m ? m[1] : null
  if (!code) return { code: null, link: PRODUCT_URL }
  const q = new URLSearchParams({ a: code })
  return { code, link: `${BASE_URL}/product_detail.php?${q.toString()}` }
}

function extractThalacProducts($: CheerioRoot, sourceUrl: string, baseUrl: string): ThalacScrapedProduct[] {
  const out: ThalacScrapedProduct[] = []
  $('#productGrid .p-card').each((_, el) => {
    const $el = $(el)
    const name = $el.find('.p-card-info h3').first().text().trim()
    const nameEn = $el.find('.en-name').first().text().trim() || null
    const priceText = $el.find('.price').first().text().trim()
    const priceWon = parsePriceWonFromThalac(priceText)

    let img =
      $el.find('.p-card-img img').first().attr('src') ||
      $el.find('img').first().attr('src') ||
      null
    if (img) img = absUrl(img, baseUrl)

    const anchor = $el.find('a.p-card-anchor').first()
    const oc = anchor.attr('onclick') || anchor.attr('onClick') || ''
    const { code, link } = detailLinkFromOnClick(oc)

    const cat = $el.attr('data-cat') || null
    const sub = $el.attr('data-sub') || null

    if (name && name.length > 1) {
      out.push({
        name,
        nameEn,
        img,
        price: priceText || null,
        priceWon,
        link,
        detailCode: code,
        brand: 'thalac',
        source: sourceUrl,
        category: cat,
        subCategory: sub,
      })
    }
  })
  return out
}

function dedupe(products: ThalacScrapedProduct[]): ThalacScrapedProduct[] {
  const seen = new Set<string>()
  return products.filter(p => {
    const k = p.detailCode ? `code:${p.detailCode}` : `name:${p.name}|${p.link}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function scrapeThalac() {
  console.log('🌊 thalac.kr 스크래핑 시작...\n')

  console.log(`📄 ${PRODUCT_URL}`)
  const html = await fetchPage(PRODUCT_URL)
  const $ = cheerio.load(html)
  const allProducts = extractThalacProducts($, PRODUCT_URL, BASE_URL)
  console.log(`  → ${allProducts.length}개`)

  const unique = dedupe(allProducts)

  console.log(`\n=== 탈라(Thalac) 완료: ${unique.length}개 ===`)
  const outPath = path.join(process.cwd(), 'scripts', 'thalac-products.json')
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')
  console.log(`✅ ${outPath} 저장`)
  console.log(JSON.stringify(unique.slice(0, 3), null, 2))
}

scrapeThalac().catch(err => {
  console.error(err)
  process.exit(1)
})
