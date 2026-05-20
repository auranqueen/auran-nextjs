import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ingredients, name, messages: clientMessages, systemPrompt: clientSystemPrompt } = body

    // ===== [AI 성분 분석 systemPrompt] =====
    // 변경 시 반드시 Claude와 협의 후 수정할 것
    // 호르몬 페이즈 저장값: 달빛기|황금기|만개기|물들기 (DB 기준값)
    const systemPrompt = clientSystemPrompt || `너는 AURAN 뷰티 플랫폼의 화장품 전성분 분석 전문가야.
20년 경력 피부 전문가(맑원장) 기준으로 분석해.
전성분 또는 제품명을 분석해서 아래 JSON 형식으로만 반환해. 설명 없이 JSON만.

{
  "concern_tags": [],
  "skin_tags": [],
  "hormone_timing": [],
  "caution_tags": [],
  "owner_analysis": ""
}

concern_tags 선택값 (해당하는 것만):
트러블 | 건조 | 탄력 | 미백 | 홍조 | 진정 | 모공 | 장벽 | 재생 | 노화 | 붓기 | 색소침착

skin_tags 선택값 (해당하는 것만):
건성 | 지성 | 복합성 | 민감성 | 탄력 | 미백 | 수분 | 트러블 | 모공 | 홍조 | 재생 | 장벽강화

hormone_timing 선택값 (DB 저장값 그대로 사용):
달빛기 | 황금기 | 만개기 | 물들기
- 달빛기(생리기 1~5일): 레티놀/AHA/BHA/강한향료/알코올 포함 → 제외. 진정·보습 위주 → 포함
- 황금기(여포기 6~13일): 활성 성분(비타민C/나이아신아마이드/펩타이드) → 우선 포함
- 만개기(배란기 14~16일): 미백·브라이트닝·가벼운 제형 → 우선 포함
- 물들기(황체기 17~28일): 보습·장벽강화·진정 성분 위주 → 포함

caution_tags 선택값 (해당하는 것만):
임산부주의 | 수유중주의 | 갱년기추천 | 남성추천 | 민감성주의 | 레티놀함유 | AHA함유 | BHA함유 | 알코올함유 | 향료함유

owner_analysis: 맑원장 말투로 이 제품 한 줄 핵심 설명 (50자 이내)
예시: "황금기에 쓰면 비타민C 흡수가 극대화돼요 💜"
예시: "달빛기엔 잠시 쉬어가고, 황금기부터 다시 써보세요"
예시: "갱년기 피부에 콜라겐 펩타이드가 특히 도움돼요"

주의사항:
- 전성분 없고 제품명만 있으면 제품명 기반으로 최선 분석
- 확실하지 않은 건 caution_tags에 넣지 말 것
- owner_analysis 무조건 1문장 50자 이내`

    const messages = clientMessages || [
      {
        role: 'user',
        content: ingredients
          ? `제품명: ${name}\n전성분: ${ingredients}`
          : `제품명: ${name}`,
      },
    ]

    const res = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages,
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || '분석 실패' }, { status: res.status })
    const text = data.content?.[0]?.text || ''
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      // ai_recommendation_logs insert (fire and forget)
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const customerId = body.customer_id || null
        if (customerId) {
          await supabase.from('ai_recommendation_logs').insert({
            customer_id: customerId,
            recommended_product_ids: parsed.concern_tags || [],
            hormone_phase: parsed.hormone_timing?.[0] || null,
            skin_type: body.skin_type || null,
            concerns: parsed.concern_tags || [],
            prompt_version: 'v1',
          })
        }
      } catch (_) {}
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ error: '응답 파싱 실패', raw: text }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'AI 분석 실패' },
      { status: 500 }
    )
  }
}
