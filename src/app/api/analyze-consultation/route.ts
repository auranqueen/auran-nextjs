import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const PHASE_MAP: Record<string, string> = {
  menstrual: '달빛기',
  follicular: '황금기',
  ovulation: '만개기',
  luteal: '물들기',
  달빛기: '달빛기',
  황금기: '황금기',
  만개기: '만개기',
  물들기: '물들기',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chat_log, phase, source_type, session_id, mode, learning_data } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const systemPrompt =
      mode === 'generate_comment'
        ? `당신은 AURAN 피부 전문 원장님의 AI 어시스턴트입니다.
호르몬 페이즈별 피부 추천 코멘트를 생성합니다.
아래 학습 데이터를 바탕으로 고객에게 도움이 되는 실용적인 코멘트를 작성하세요.
반드시 JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요:
{
  "comment": "추천 코멘트 내용 (150자 이내, 구체적이고 실용적으로)"
}`
        : `당신은 AURAN 피부 전문 원장님의 AI 어시스턴트입니다.
고객 상담 내용을 분석하여 호르몬 페이즈 특성과 피부 케어 인사이트를 추출합니다.
phase는 반드시 달빛기/황금기/만개기/물들기 중 하나로만 반환하세요.
반드시 JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요:
{
  "phase": "달빛기|황금기|만개기|물들기 중 하나",
  "phase_confidence": 0.0~1.0 사이 숫자,
  "ai_summary": "상담 내용 핵심 요약 (50자 이내)",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "skin_concerns": ["피부고민1", "피부고민2"],
  "recommended_care": "추천 케어 방향 (30자 이내)"
}`

    const userContent =
      mode === 'generate_comment'
        ? `페이즈: ${phase}\n\n학습 데이터:\n${learning_data || chat_log}`
        : `상담 내용:\n${chat_log}\n\n페이즈 힌트: ${phase || '모름'}\n출처: ${source_type || 'auran_chat'}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.error || '분석 실패' }, { status: res.status })
    }

    const text = data.content?.[0]?.text || ''
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      if (parsed.phase) {
        parsed.phase = PHASE_MAP[parsed.phase] || parsed.phase
      }

      if (session_id && mode !== 'generate_comment') {
        await supabase
          .from('consultation_sessions')
          .update({
            ai_summary: parsed.ai_summary,
            analyzed_keywords: { keywords: parsed.keywords, concerns: parsed.skin_concerns },
            phase: parsed.phase,
            confidence_score: parsed.phase_confidence,
            status: 'analyzed',
          })
          .eq('id', session_id)

        await supabase.from('hormone_phase_learnings').insert({
          phase: parsed.phase || PHASE_MAP[phase || ''] || '달빛기',
          source_type: source_type || 'auran_chat',
          content: parsed.ai_summary,
          ai_extracted_keywords: {
            keywords: parsed.keywords,
            concerns: parsed.skin_concerns,
            recommended_care: parsed.recommended_care,
          },
          status: 'pending',
        })
      }

      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ error: '응답 파싱 실패', raw: text }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'AI 분석 실패' }, { status: 500 })
  }
}
