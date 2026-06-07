import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const client = tryCreateAdminClient() || supabase
  const ip = getClientIp(req)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

  // 유저 row 조회
  const { data: userRow } = await client
    .from('users')
    .select('id, points, consecutive_checkin_days, last_checkin_at, total_checkin_days')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!userRow) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })

  // 오늘 이미 출석했는지 확인
  const { data: existCheckin } = await client
    .from('daily_checkin')
    .select('id')
    .eq('user_id', userRow.id)
    .eq('checked_at', today)
    .maybeSingle()
  if (existCheckin) return NextResponse.json({ ok: true, already: true, message: '오늘 이미 출석했어요' })

  // IP 중복 체크
  const { data: ipCheck } = await client
    .from('daily_checkin')
    .select('id')
    .eq('ip_address', ip)
    .eq('checked_at', today)
    .neq('user_id', userRow.id)
    .maybeSingle()
  const ipBlocked = !!ipCheck && ip !== 'unknown'

  // admin_settings에서 출석 설정 조회
  const { data: settings } = await client
    .from('admin_settings')
    .select('key, value')
    .eq('category', 'checkin')
  const settingMap = Object.fromEntries((settings || []).map((s: any) => [s.key, Number(s.value)]))
  const dailyAmount = settingMap['daily_amount'] ?? 100
  const bonus7 = settingMap['streak_7_bonus'] ?? 500
  const bonus30 = settingMap['streak_30_bonus'] ?? 3000
  const noOrderCap = 1000

  // 이번달 구매 이력 확인 (D안: 구매 없으면 월 1,000T 상한)
  const monthStart = today.slice(0, 7) + '-01'
  const { count: orderCount } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', userRow.id)
    .eq('payment_applied', true)
    .gte('created_at', monthStart)
  const hasOrderThisMonth = (orderCount || 0) > 0

  // 이번달 출석 토스트 합계
  const { data: monthToast } = await client
    .from('toast_transactions')
    .select('amount')
    .eq('user_id', userRow.id)
    .eq('source_type', 'attendance')
    .gte('created_at', monthStart)
  const monthAttendanceTotal = (monthToast || []).reduce((s: number, t: any) => s + (t.amount || 0), 0)

  // 스트릭 계산
  const lastCheckin = (userRow as any).last_checkin_at
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const isConsecutive = lastCheckin === yesterdayStr
  const newStreak = isConsecutive ? ((userRow as any).consecutive_checkin_days || 0) + 1 : 1
  const newTotal = ((userRow as any).total_checkin_days || 0) + 1

  // 출석 기록 저장
  await client.from('daily_checkin').insert({
    user_id: userRow.id,
    checked_at: today,
    ip_address: ip,
  } as any)

  // 스트릭 업데이트
  await client.from('users').update({
    consecutive_checkin_days: newStreak,
    last_checkin_at: today,
    total_checkin_days: newTotal,
  } as any).eq('id', userRow.id)

  // IP 차단 시 토스트 미지급
  if (ipBlocked) {
    return NextResponse.json({ ok: true, toast_earned: 0, blocked_by_ip: true, streak: newStreak, message: '출석 완료! (토스트는 하루 1IP 1회)' })
  }

  // 토스트 계산
  let totalEarned = dailyAmount
  const bonusMessages: string[] = []
  if (newStreak === 7) { totalEarned += bonus7; bonusMessages.push(`7일 연속 보너스 +${bonus7}T 🎉`) }
  if (newStreak === 30) { totalEarned += bonus30; bonusMessages.push(`30일 개근 보너스 +${bonus30}T 🎊`) }

  // D안: 구매 이력 없으면 월 1,000T 상한 적용
  if (!hasOrderThisMonth) {
    const remaining = Math.max(0, noOrderCap - monthAttendanceTotal)
    if (remaining <= 0) {
      return NextResponse.json({ ok: true, toast_earned: 0, capped: true, streak: newStreak, message: '출석 완료! (이번달 구매 후 풀 적립 가능)' })
    }
    totalEarned = Math.min(totalEarned, remaining)
  }

  // 토스트 지급
  await client.from('toast_transactions').insert({
    user_id: userRow.id,
    amount: totalEarned,
    transaction_type: 'earn',
    source_type: 'attendance',
  } as any)
  await client.from('users').update({
    points: (userRow.points || 0) + totalEarned,
  } as any).eq('id', userRow.id)

  // 알림
  await client.from('notifications').insert({
    user_id: userRow.id,
    type: 'toast',
    title: `출석 체크 +${totalEarned}T 💜`,
    body: bonusMessages.length > 0
      ? bonusMessages.join(' ')
      : !hasOrderThisMonth
      ? `${newStreak}일째 출석 중 · 이번달 구매 시 풀 적립!`
      : `${newStreak}일 연속 출석 중이에요!`,
    is_read: false,
  } as any)

  return NextResponse.json({
    ok: true,
    toast_earned: totalEarned,
    streak: newStreak,
    total_checkin_days: newTotal,
    bonus_messages: bonusMessages,
    capped: !hasOrderThisMonth,
    message: `출석 완료! +${totalEarned}T`,
  })
}
