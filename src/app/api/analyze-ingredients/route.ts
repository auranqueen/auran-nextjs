import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ingredients, name, messages: clientMessages, systemPrompt: clientSystemPrompt } = body

    const systemPrompt = clientSystemPrompt || `너는 AURAN 뷰티 플랫폼의 성분 분석 전문가야.
전성분 또는 제품명을 분석해서 아래 AURAN 분류 기준으로 JSON만 반환해. 설명 없이.

{
  "concern_tags": ["트러블","건조","탄력","미백","홍조","진정"] 중 해당,
  "skin_tags": ["건성","지성","복합성","민감성","탄력","미백","수분","트러블","모공","홍조","재생","장벽강화"] 중 해당,
  "hormone_timing": ["달빛기","황금기","만개기","물들기"] 중 해당
}`

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
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'AI 분석 실패' },
      { status: 500 }
    )
  }
}
