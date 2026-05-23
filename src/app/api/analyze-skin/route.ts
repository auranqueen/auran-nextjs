import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageBase64 } = body

    if (!imageBase64) {
      return NextResponse.json({ error: '분석 실패' }, { status: 400 })
    }

    const base64Data = String(imageBase64).replace(/^data:image\/jpeg;base64,/, '')

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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: '이 얼굴 사진을 피부 전문가 관점에서 분석해줘. 반드시 JSON만 반환. 다른 텍스트 없이:\n{"moisture":숫자,"oil":숫자,"sensitivity":숫자,"elasticity":숫자,"pigmentation":숫자,"pore":숫자}\n각 항목은 0~100 정수. moisture=수분, oil=유분, sensitivity=민감도, elasticity=탄력, pigmentation=색소침착, pore=모공.',
              },
            ],
          }],
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || '분석 실패' }, { status: res.status })

    const text = data.content?.[0]?.text || ''
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json({ error: '분석 실패' }, { status: 500 })
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || '분석 실패' },
      { status: 500 }
    )
  }
}
