import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat') || '35.8714'  // 대구 기본값
  const lon = searchParams.get('lon') || '128.6014'

  try {
    const owKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
    const akKey = process.env.AIRKOREA_API_KEY

    // OpenWeatherMap - 날씨/기온/습도/자외선
    const [weatherRes, uvRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owKey}&units=metric&lang=kr`),
      fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${owKey}`),
    ])

    const weather = await weatherRes.json()
    const uv = await uvRes.json()

    // 에어코리아 - 미세먼지 (대구 기준)
    const dustRes = await fetch(
      `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${akKey}&returnType=json&numOfRows=1&pageNo=1&sidoName=대구&ver=1.0`
    )
    const dustData = await dustRes.json()
    const dustItem = dustData?.response?.body?.items?.[0]

    const uvValue = uv?.value || 0
    const uvLevel = uvValue <= 2 ? '낮음' : uvValue <= 5 ? '보통' : uvValue <= 7 ? '높음' : uvValue <= 10 ? '매우높음' : '위험'

    const pm10Value = Number(dustItem?.pm10Value || 0)
    const pm25Value = Number(dustItem?.pm25Value || 0)
    const pm10Level = pm10Value <= 30 ? '좋음' : pm10Value <= 80 ? '보통' : pm10Value <= 150 ? '나쁨' : '매우나쁨'
    const pm25Level = pm25Value <= 15 ? '좋음' : pm25Value <= 35 ? '보통' : pm25Value <= 75 ? '나쁨' : '매우나쁨'

    return NextResponse.json({
      temp: Math.round(weather?.main?.temp || 0),
      feel: Math.round(weather?.main?.feels_like || 0),
      humidity: weather?.main?.humidity || 0,
      condition: weather?.weather?.[0]?.description || '맑음',
      icon: weather?.weather?.[0]?.icon || '01d',
      city: weather?.name || '대구',
      uv: { value: uvValue, level: uvLevel },
      dust: { value: pm10Value, level: pm10Level },
      fineDust: { value: pm25Value, level: pm25Level },
    })
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
