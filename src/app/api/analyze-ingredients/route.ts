import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  let body: { content?: unknown; ingredients?: unknown; name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, ingredients, name } = body

  const ing =
    typeof ingredients === 'string'
      ? ingredients.trim()
      : ingredients != null && String(ingredients).trim() !== ''
        ? String(ingredients).trim()
        : ''

  const nameStr = typeof name === 'string' ? name.trim() : ''

  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

  let userContent: string | unknown[] | null = null

  if (Array.isArray(content)) {
    userContent = content
  } else if (ing) {
    if (typeof content === 'string' && content.trim() !== '') {
      userContent = content
    } else {
      userContent = `전성분: ${ing}\n아래 JSON만 반환해. 설명 없이.\n{"concern_tags":[],"skin_tags":[],"hormone_timing":[]}`
    }
  } else if (nameStr) {
    userContent = `제품명: ${nameStr}
제품명만 보고 AURAN 뷰티 플랫폼 분류 기준으로 JSON만 반환해. 설명 없이.
{
  concern_tags: [트러블/건조/탄력/미백/홍조/진정/호르몬케어 중 해당],
  skin_tags: [#건성 #지성 #복합성 #민감성 #탄력 #미백 #수분 #트러블 #모공 #홍조 #재생 #각질 #갱년기 #열감 #호르몬밸런스 #30대 #40대 #50대 #장벽강화 중 해당],
  hormone_timing: [생리기/여포기/배란기/황체기 중 해당]
}`
  } else if (typeof content === 'string' && content.trim() !== '') {
    userContent = content
  }

  if (userContent === null) {
    return NextResponse.json({ error: 'content, ingredients, or name is required' }, { status: 400 })
  }

  const normalized =
    typeof userContent === 'string' || Array.isArray(userContent) ? userContent : null

  if (normalized === null) {
    return NextResponse.json({ error: 'content must be a string or array' }, { status: 400 })
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system:
        '너는 AURAN 뷰티 플랫폼 성분 분석 전문가야. 전성분 분석해서 JSON만 반환해. 절대 설명 추가하지 마.',
      messages: [{ role: 'user', content: normalized }],
    }),
  })

  const raw = (await res.json()) as { content?: { type?: string; text?: string }[]; error?: { message?: string } }
  if (!res.ok) {
    return NextResponse.json(
      { error: raw?.error?.message || 'Anthropic request failed', detail: raw },
      { status: 502 }
    )
  }

  const text = raw?.content?.[0]?.text
  if (typeof text !== 'string') {
    return NextResponse.json({ error: 'No assistant text in response', detail: raw }, { status: 502 })
  }

  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : trimmed)
  } catch {
    return NextResponse.json({ error: 'Failed to parse JSON from model output', text }, { status: 502 })
  }

  return NextResponse.json(parsed)
}
