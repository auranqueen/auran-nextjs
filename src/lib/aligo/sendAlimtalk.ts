/**
 * 알리고 문자/알림톡 (템플릿 승인 전에는 SMS 대체 발송 가능)
 * https://smartsms.aligo.in — 실제 필드명은 계정·템플릿에 맞게 조정하세요.
 */
export async function sendAlimtalkSms(params: {
  phone: string
  message: string
  title?: string
}): Promise<{ ok: boolean; raw?: string; skipped?: boolean }> {
  const apiKey = process.env.ALIGO_API_KEY
  const userId = process.env.ALIGO_USER_ID
  const sender = process.env.KAKAO_SENDER_PHONE
  if (!apiKey || !userId || !sender) {
    return { ok: false, skipped: true }
  }
  const receiver = String(params.phone || '').replace(/\D/g, '')
  if (!receiver || receiver.length < 10) {
    return { ok: false, skipped: true }
  }

  const body = new URLSearchParams({
    key: apiKey,
    user_id: userId,
    sender: sender.replace(/\D/g, ''),
    receiver,
    msg: params.message,
    msg_type: 'SMS',
    title: params.title || 'AURAN',
  })

  try {
    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: body.toString(),
    })
    const text = await res.text()
    return { ok: res.ok, raw: text }
  } catch (e: any) {
    return { ok: false, raw: e?.message || 'fetch_failed' }
  }
}
