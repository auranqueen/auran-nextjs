/**
 * https://gerneticshop.com (Cafe24) 제품 목록 스크래핑 → scripts/gernetic-products.json
 *
 * 실행: npm run scrape:gernetic
 */
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'https://gerneticshop.com'

type CheerioRoot = ReturnType<typeof cheerio.load>

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Referer: `${BASE_URL}/`,
}

export type GerneticScrapedProduct = {
  productNo: string | null
  name: string
  img: string | null
  price: string | null
  /** 숫자(원) — 파싱 실패 시 null */
  priceWon: number | null
  link: string
  source: string
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

function absUrl(href: string | undefined | null): string | null {
  if (!href) return null
  const h = href.trim()
  if (!h || h === '#') return null
  if (h.startsWith('http://') || h.startsWith('https://')) return h
  if (h.startsWith('//')) return `https:${h}`
  if (h.startsWith('/')) return `${BASE_URL}${h}`
  return `${BASE_URL}/${h}`
}

function normalizeImg(src: string | undefined | null): string | null {
  return absUrl(src)
}

/** Cafe24 카테고리 번호 */
function extractCateNo(href: string): string | null {
  const q = href.match(/[?&]cate_no=(\d+)/)
  if (q) return q[1]
  const pretty = href.match(/\/category\/[^/]+\/(\d+)\/?/)
  if (pretty) return pretty[1]
  return null
}

function listUrl(cateNo: string, page: number): string {
  if (page <= 1) return `${BASE_URL}/product/list.html?cate_no=${cateNo}`
  return `${BASE_URL}/product/list.html?cate_no=${cateNo}&page=${page}`
}

function parsePriceWon(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/([\d,]+)\s*원/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Cafe24 목록: ul.prdList > li[id^=anchorBoxId_] */
function parseCafe24ListItems($: CheerioRoot, source: string): GerneticScrapedProduct[] {
  const out: GerneticScrapedProduct[] = []
  $('ul.prdList > li[id^="anchorBoxId_"]').each((_, el) => {
    const $li = $(el)
    const idAttr = $li.attr('id') || ''
    const productNo = idAttr.replace(/^anchorBoxId_/, '') || null

    const $img = $li.find('.prdImg img').first()
    const imgRaw = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original')
    const img = normalizeImg(imgRaw)

    const nameFromSpan = $li.find('.description strong.name a span').last().text().trim()
    const nameFromAlt = $img.attr('alt')?.trim() || ''
    const name = nameFromSpan || nameFromAlt
    if (!name || name.length < 2) return

    const linkRaw = $li.find('.prdImg a').first().attr('href') || $li.find('.description strong.name a').first().attr('href')
    const link = absUrl(linkRaw)
    if (!link) return

    let price: string | null = null
    const specLis = $li.find('ul.spec li, .description ul li')
    for (const specLi of specLis.toArray()) {
      const t = $(specLi).text().replace(/\s+/g, ' ')
      if (!t.includes('판매가')) continue
      const m = t.match(/([\d,]+)\s*원/)
      if (m) {
        price = `${m[1]}원`
        break
      }
    }
    const priceWon = price ? parsePriceWon(price) : null

    out.push({
      productNo,
      name,
      img,
      price,
      priceWon,
      link,
      source,
    })
  })
  return out
}

/** 메인에서 카테고리( cate_no ) URL 수집 */
function discoverCategoryNumbers(mainHtml: string): string[] {
  const $ = cheerio.load(mainHtml)
  const set = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const no = extractCateNo(href)
    if (no) set.add(no)
  })
  return [...set].sort((a, b) => Number(a) - Number(b))
}

/** Cafe24가 아닌 경우를 위한 느슨한 폴백 (메인 등) */
function parseGenericProductCards($: CheerioRoot, source: string): GerneticScrapedProduct[] {
  const out: GerneticScrapedProduct[] = []
  const selectors = ['.product-item', '.product-card', '.grid-item', 'li.xans-record-', 'li.product']
  for (const sel of selectors) {
    const items = $(sel)
    if (items.length === 0) continue
    items.each((_, el) => {
      const $el = $(el)
      const name = $el.find('h2, h3, h4, .product-title, .title, strong.name').first().text().trim()
      if (!name || name.length < 2) return
      let img =
        $el.find('img').first().attr('src') ||
        $el.find('img').first().attr('data-src') ||
        $el.find('img').first().attr('data-lazy-src')
      const link = $el.find('a').first().attr('href')
      const price = $el.find('[class*="price"], .spec').first().text().trim()
      out.push({
        productNo: null,
        name,
        img: normalizeImg(img),
        price: price || null,
        priceWon: price ? parsePriceWon(price) : null,
        link: absUrl(link) || source,
        source,
      })
    })
    if (out.length) break
  }
  return out
}

/** 폴백: 공식몰 네비에 나오는 대표 cate_no (메인에서 링크 못 찾을 때) */
const FALLBACK_CATE_NOS = [
  '47', '51', '52', '60', '54', '55', '56', '57', '58', '59', '63', '64', '65', '66', '67',
]

async function scrapeCategoryAllPages(cateNo: string): Promise<GerneticScrapedProduct[]> {
  const collected: GerneticScrapedProduct[] = []
  for (let page = 1; page <= 500; page++) {
    const url = listUrl(cateNo, page)
    let html: string
    try {
      html = await fetchPage(url)
    } catch (e) {
      console.log(`  ⚠ 페이지 로드 실패 page=${page}`, e)
      break
    }
    const $ = cheerio.load(html)
    const items = parseCafe24ListItems($, url)
    if (items.length === 0) {
      if (page === 1) {
        // Cafe24 마크업 변경 시 빈 결과
        console.log(`  ⚠ cate_no=${cateNo}: 목록 항목 0 (마크업 확인)`)
      }
      break
    }
    collected.push(...items)
    console.log(`  → cate_no=${cateNo} page=${page} : ${items.length}개`)

    await new Promise(r => setTimeout(r, 500))
    // 다음 페이지: 빈 목록이면 루프 종료 (상단 items.length === 0)
  }
  return collected
}

async function scrapeGernetic() {
  console.log('🌿 gerneticshop.com 스크래핑 시작 (Cafe24 목록 기준)...\n')

  const mainHtml = await fetchPage(BASE_URL + '/index.html')
  let cateNos = discoverCategoryNumbers(mainHtml)
  console.log(`메인에서 발견한 cate_no: ${cateNos.length}개`, cateNos)

  if (cateNos.length === 0) {
    cateNos = [...FALLBACK_CATE_NOS]
    console.log(`폴백 cate_no 사용: ${cateNos.join(', ')}`)
  }

  const allProducts: GerneticScrapedProduct[] = []

  for (const cateNo of cateNos) {
    console.log(`\n📂 카테고리 cate_no=${cateNo}`)
    const part = await scrapeCategoryAllPages(cateNo)
    allProducts.push(...part)
  }

  // 메인에만 있는 모듈 상품 (보조)
  const $main = cheerio.load(mainHtml)
  const mainExtras = parseCafe24ListItems($main, `${BASE_URL}/index.html`)
  if (mainExtras.length) {
    console.log(`\n📄 메인 페이지 목록 ${mainExtras.length}개 병합`)
    allProducts.push(...mainExtras)
  }
  if (allProducts.length === 0) {
    const generic = parseGenericProductCards($main, `${BASE_URL}/index.html`)
    if (generic.length) {
      console.log(`\n📄 제네릭 셀렉터로 ${generic.length}개 (폴백)`)
      allProducts.push(...generic)
    }
  }

  const seen = new Set<string>()
  const unique = allProducts.filter(p => {
    const key = p.link || `${p.productNo}|${p.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`\n=== 스크래핑 완료 ===`)
  console.log(`총 ${unique.length}개 제품 (중복 제거 후)`)

  const outPath = path.join(process.cwd(), 'scripts', 'gernetic-products.json')
  fs.writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf-8')
  console.log(`✅ ${outPath} 저장 완료`)
  console.log('\n샘플 3개:')
  console.log(JSON.stringify(unique.slice(0, 3), null, 2))
}

scrapeGernetic().catch(err => {
  console.error(err)
  process.exit(1)
})
