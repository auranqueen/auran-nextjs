import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  let body: { content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content } = body
  if (content === undefined || content === null) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5'

  const userContent =
    typeof content === 'string' || Array.isArray(content)
      ? content
      : null

  if (userContent === null) {
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
      messages: [{ role: 'user', content: userContent }],
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
