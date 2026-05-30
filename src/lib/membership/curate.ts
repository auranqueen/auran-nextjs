// src/lib/membership/curate.ts
// 멤버십 리추얼 큐레이션 — page.tsx의 skinRecList 점수 규칙을 서버용으로 복제.
// ⚠️ 기존 인라인 로직(홈 피드)은 건드리지 않음. 이 파일은 신규.
// 어드민 자동 큐레이션 + 고객 "이번 리추얼 미리보기" 공용.

type AnyClient = { from: (table: string) => any }

const PHASE_MAP: Record<string, string> = {
  달빛기: '생리기',
  황금기: '여포기',
  만개기: '배란기',
  물들기: '황체기',
}

function parseHormoneTiming(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : []
  return arr.flatMap((v) => {
    if (typeof v !== 'string') return []
    const s = v.trim()
    try {
      const parsed = JSON.parse(s)
      return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
    } catch {
      return s ? [s] : []
    }
  })
}

export type CurationParams = {
  bundleProductIds: string[]
  userConcerns: string[]
  userSkinType: string
  hormonePhase: string
  topN?: number
}

export type ScoredProduct = {
  id: string
  name: string
  retail_price: number | null
  _score: number
  _reasons: string[]
}

export function scoreProduct(
  p: any,
  opts: { userConcerns: string[]; userSkinType: string; hormonePhase: string }
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const pConcerns: string[] = Array.isArray(p.concern_tags) ? p.concern_tags : []
  const concernMatch = pConcerns.filter((c) => opts.userConcerns.includes(c)).length
  if (concernMatch > 0) {
    score += concernMatch * 3
    reasons.push(`+${concernMatch * 3} 고민 일치`)
  }
  if (pConcerns.includes('barrier') || pConcerns.includes('sensitivity')) {
    score += 2
    reasons.push('+2 진정/장벽')
  }
  if (pConcerns.includes('acne')) {
    score += 1
    reasons.push('+1 트러블')
  }

  const dbPhase = PHASE_MAP[opts.hormonePhase] ?? opts.hormonePhase ?? ''
  const pHormone = parseHormoneTiming(p.hormone_timing)
  if (dbPhase && pHormone.includes(dbPhase)) {
    score += 3
    reasons.push(`+3 ${opts.hormonePhase}`)
  } else if (pHormone.length > 0) {
    score += 1
    reasons.push('+1 시기 적합')
  }

  const quiz: string[] = Array.isArray(p.quiz_match) ? p.quiz_match : []
  if (opts.userSkinType && quiz.some((q) => String(q).includes(opts.userSkinType))) {
    score += 2
    reasons.push('+2 피부타입')
  }

  return { score, reasons }
}

export async function curateBundle(
  supabase: AnyClient,
  params: CurationParams
): Promise<ScoredProduct[]> {
  const { bundleProductIds, userConcerns, userSkinType, hormonePhase, topN = 6 } = params
  if (!bundleProductIds || bundleProductIds.length === 0) return []

  const { data: products } = await supabase
    .from('products')
    .select('id,name,retail_price,concern_tags,hormone_timing,quiz_match,is_active,deleted_at')
    .in('id', bundleProductIds)

  const pool = (products ?? []).filter((p: any) => p.is_active !== false && !p.deleted_at)

  return pool
    .map((p: any) => {
      const { score, reasons } = scoreProduct(p, { userConcerns, userSkinType, hormonePhase })
      return {
        id: p.id,
        name: p.name,
        retail_price: p.retail_price ?? null,
        _score: score,
        _reasons: reasons,
      }
    })
    .sort((a: ScoredProduct, b: ScoredProduct) => b._score - a._score)
    .slice(0, topN)
}
