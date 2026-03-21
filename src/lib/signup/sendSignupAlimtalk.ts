import { sendAlimtalkSms } from '@/lib/ppurio/sendAlimtalk'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function fmtDate(d: Date) {
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** 가입 축하 + 쿠폰 안내 알림 (전화번호 있을 때만, 1회) */
export async function sendSignupAlimtalkIfNeeded(authUserId: string): Promise<void> {
  const client = tryCreateServiceClient()
  if (!client) return

  const { data: enabled } = await client.from('admin_settings').select('value').eq('category', 'alimtalk').eq('key', 'enabled').maybeSingle()
  if (Number(enabled?.value ?? 1) !== 1) return

  const { data: u } = await client
    .from('users')
    .select('id,name,phone,provider,signup_alimtalk_sent_at')
    .eq('auth_id', authUserId)
    .maybeSingle()
  if (!u?.phone?.trim() || u.signup_alimtalk_sent_at) return

  const phone = u.phone.trim()
  const name = u.name || '회원'
  const provider = u.provider === 'kakao' ? '카카오' : u.provider === 'email' ? '이메일' : u.provider || '기타'
  const joinDate = fmtDate(new Date())

  const { data: sSignup } = await client.from('admin_settings').select('value').eq('category', 'alimtalk').eq('key', 'signup_enabled').maybeSingle()
  const { data: sCoupon } = await client.from('admin_settings').select('value').eq('category', 'alimtalk').eq('key', 'coupon_enabled').maybeSingle()

  const { data: welcomePointsRow } = await client.from('admin_settings').select('value').eq('category', 'points_action').eq('key', 'signup_welcome').maybeSingle()
  const welcomePts = Number(welcomePointsRow?.value ?? 8888)

  const { data: wc } = await client.from('coupons').select('name,end_at,discount_amount,min_order').eq('code', 'APP-WELCOME-5000').maybeSingle()
  const wcName = wc?.name || '웰컴 쿠폰 5,000원'
  const wcAmt = Number(wc?.discount_amount ?? 5000)
  const wcMin = Number(wc?.min_order ?? 50000)
  const wcEnd = wc?.end_at ? fmtDate(new Date(String(wc.end_at))) : '2026.12.31까지'

  const tplSignup = process.env.PPURIO_TEMPLATE_SIGNUP?.trim()
  const tplCoupon = process.env.PPURIO_TEMPLATE_COUPON?.trim()

  if (Number(sSignup?.value ?? 1) === 1) {
    const msg1 = `${name}님,\nAURAN 회원가입이 완료되었습니다!\n\n안녕하세요, ${name}님 🎉\nAURAN 가입을 환영해요.\n✨ ${welcomePts.toLocaleString()}P 즉시 적립 완료\n🎫 ${wcName} 발급 완료\n■ 가입일: ${joinDate}\n■ 가입방법: ${provider}\n\n나의 혜택은 앱에서 확인하세요.`
    await sendAlimtalkSms({ phone, message: msg1, title: 'AURAN 가입 완료', templateCode: tplSignup })
  }

  if (Number(sCoupon?.value ?? 1) === 1) {
    const msg2 = `${name}고객님께\nAURAN 웰컴 쿠폰이 발행되었습니다.\n■ 쿠폰명: ${wcName}\n■ 할인금액: ${wcAmt.toLocaleString()}원\n■ 사용조건: ${wcMin.toLocaleString()}원 이상 구매시\n■ 유효기간: ${wcEnd}\n\nAURAN 앱 → 나 → 쿠폰함에서 확인하세요!`
    await sendAlimtalkSms({ phone, message: msg2, title: 'AURAN 웰컴 쿠폰', templateCode: tplCoupon })
  }

  await client.from('users').update({ signup_alimtalk_sent_at: new Date().toISOString() }).eq('id', u.id)
}
