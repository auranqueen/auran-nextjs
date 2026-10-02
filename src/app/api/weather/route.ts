import { NextRequest, NextResponse } from 'next/server'

const LAT_LNG_TO_SIDO: { name: string; lat: number; lng: number }[] = [
  { name: '서울', lat: 37.5665, lng: 126.9780 },
  { name: '부산', lat: 35.1796, lng: 129.0756 },
  { name: '대구', lat: 35.8714, lng: 128.6014 },
  { name: '인천', lat: 37.4563, lng: 126.7052 },
  { name: '광주', lat: 35.1595, lng: 126.8526 },
  { name: '대전', lat: 36.3504, lng: 127.3845 },
  { name: '울산', lat: 35.5384, lng: 129.3114 },
  { name: '경기', lat: 37.4138, lng: 127.5183 },
  { name: '강원', lat: 37.8228, lng: 128.1555 },
  { name: '충북', lat: 36.6357, lng: 127.4917 },
  { name: '충남', lat: 36.5184, lng: 126.8000 },
  { name: '전북', lat: 35.7175, lng: 127.1530 },
  { name: '전남', lat: 34.8679, lng: 126.9910 },
  { name: '경북', lat: 36.4919, lng: 128.8889 },
  { name: '경남', lat: 35.4606, lng: 128.2132 },
  { name: '제주', lat: 33.4996, lng: 126.5312 },
  { name: '세종', lat: 36.4800, lng: 127.2890 },
]
function getSidoName(lat: number, lng: number): string {
  let closest = '대구'
  let minDist = Infinity
  for (const s of LAT_LNG_TO_SIDO) {
    const d = Math.sqrt((s.lat - lat) ** 2 + (s.lng - lng) ** 2)
    if (d < minDist) { minDist = d; closest = s.name }
  }
  return closest
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat') || '35.8714'  // 대구 기본값
  const lon = searchParams.get('lon') || '128.6014'

  try {
    const owKey = process.env.OPENWEATHER_API_KEY
    const akKey = process.env.AIRKOREA_API_KEY

    // OpenWeatherMap - 날씨/기온/습도/자외선
    const [weatherRes, uvRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${owKey}&units=metric&lang=kr`),
      fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${owKey}`),
    ])

    const weather = await weatherRes.json()
    const uv = await uvRes.json()

    // 에어코리아 - 미세먼지 (위치 기반)
    const dustRes = await fetch(
      `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${akKey}&returnType=json&numOfRows=1&pageNo=1&sidoName=${encodeURIComponent(getSidoName(Number(lat), Number(lon)))}&ver=1.0`
    )
    const dustData = await dustRes.json()
    const dustItem = dustData?.response?.body?.items?.[0]

    const uvValue = uv?.value || 0
    const uvLevel = uvValue <= 2 ? '낮음' : uvValue <= 5 ? '보통' : uvValue <= 7 ? '높음' : uvValue <= 10 ? '매우높음' : '위험'

    const pm10Value = Number(dustItem?.pm10Value || 0)
    const pm25Value = Number(dustItem?.pm25Value || 0)
    const pm10Level = pm10Value <= 30 ? '좋음' : pm10Value <= 80 ? '보통' : pm10Value <= 150 ? '나쁨' : '매우나쁨'
    const pm25Level = pm25Value <= 15 ? '좋음' : pm25Value <= 35 ? '보통' : pm25Value <= 75 ? '나쁨' : '매우나쁨'

    const toWeatherEmoji = (icon: string): string => {
      if (icon.startsWith('01')) return '☀️'
      if (icon.startsWith('02')) return '🌤'
      if (icon.startsWith('03')) return '🌥'
      if (icon.startsWith('04')) return '☁️'
      if (icon.startsWith('09')) return '🌧'
      if (icon.startsWith('10')) return '🌦'
      if (icon.startsWith('11')) return '⛈'
      if (icon.startsWith('13')) return '❄️'
      if (icon.startsWith('50')) return '🌫'
      return '🌈'
    }

    return NextResponse.json({
      temp: Math.round(weather?.main?.temp ?? 0),
      feel: Math.round(weather?.main?.feels_like ?? 0),
      humidity: weather?.main?.humidity || 0,
      condition: toWeatherEmoji(weather?.weather?.[0]?.icon || '01d'),
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
