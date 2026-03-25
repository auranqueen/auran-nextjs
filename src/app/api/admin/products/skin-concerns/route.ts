import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SKIN_CONCERN_RULES: Record<string, string[]> = {
  '수분부족': ['수분', '모이스처', '하이드라', '토너', '에센스', '세럼', '앰플', '크림', '로션', 'moisture', 'hydra', 'hydrating'],
  '미백·톤업': ['미백', '브라이트', '화이트', '비타민C', '나이아신', '톤업', 'bright', 'white', 'vitamin'],
  '모공·각질': ['모공', '각질', '필링', '클렌징', '스크럽', '엑스폴', 'pore', 'peeling', 'exfol', 'cleansing', '고마쥬', '젤필'],
  '민감·진정': ['진정', '민감', '센시티브', '카밍', '수딩', '알로에', 'calm', 'sooth', 'sensitive', '마린'],
  '안티에이징': ['안티에이징', '리프팅', '주름', '탄력', '콜라겐', '레티놀', 'anti-aging', 'lifting', 'firming', 'collagen'],
  '자외선차단': ['선크림', 'SPF', 'PA', '자외선', 'UV', 'sun'],
}

export async function POST() {
  const supabase = createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, description')

  if (!products) return NextResponse.json({ error: '제품 없음' }, { status: 404 })

  let updated = 0
  for (const product of products) {
    const text = `${product.name} ${product.description || ''}`.toLowerCase()
    const concerns: string[] = []

    for (const [concern, keywords] of Object.entries(SKIN_CONCERN_RULES)) {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        concerns.push(concern)
      }
    }

    if (concerns.length > 0) {
      await supabase
        .from('products')
        .update({ skin_concerns: concerns })
        .eq('id', product.id)
      updated++
    }
  }

  return NextResponse.json({ success: true, updated, total: products.length })
}

