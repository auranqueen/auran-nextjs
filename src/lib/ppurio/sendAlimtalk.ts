/**
 * 뿌리오(비즈뿌리오) 알림톡 API
 * https://www.bizppurio.com — 연동 규격 v2.7 ( /v1/token, /v3/message )
 *
 * 필수: PPURIO_API_KEY, PPURIO_SENDER_KEY (카카오 발신 프로필 키)
 * - PPURIO_API_KEY: API 비밀번호 단독 사용 시 PPURIO_ACCOUNT(계정 ID)와 함께 설정
 *   또는 "계정ID:API비밀번호" 한 줄로 설정
 * 권장(실발송): PPURIO_FROM(등록 발신번호), 템플릿 코드(호출 시 templateCode 또는 env)
 */

import { randomUUID } from 'crypto'

const DEFAULT_BASE = 'https://api.bizppurio.com'

type SendResult = { ok: boolean; skipped?: boolean; raw?: string }

let tokenCache: { token: string; type: string; expMs: number } | null = null

function apiBase() {
  return (process.env.PPURIO_API_BASE || DEFAULT_BASE).replace(/\/$/, '')
}

function getAccountPassword(): { account: string; password: string } | null {
  const key = process.env.PPURIO_API_KEY?.trim()
  if (!key) return null
  const explicitAccount = process.env.PPURIO_ACCOUNT?.trim()
  if (explicitAccount) return { account: explicitAccount, password: key }
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  return { account: key.slice(0, idx), password: key.slice(idx + 1) }
}

async function getAccessToken(account: string, password: string): Promise<string | null> {
  const now = Date.now()
  if (tokenCache && tokenCache.expMs > now + 60_000) {
    return tokenCache.token
  }

  const basic = Buffer.from(`${account}:${password}`, 'utf8').toString('base64')
  const res = await fetch(`${apiBase()}/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${basic}`,
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('[ppurio] token failed', res.status, text)
    return null
  }
  try {
    const j = JSON.parse(text) as { accesstoken?: string; type?: string; expired?: string }
    if (!j.accesstoken) return null
    const type = (j.type || 'Bearer').trim()
    let expMs = now + 23 * 60 * 60 * 1000
    if (j.expired && j.expired.length >= 14) {
      const y = Number(j.expired.slice(0, 4))
      const mo = Number(j.expired.slice(4, 6)) - 1
      const d = Number(j.expired.slice(6, 8))
      const h = Number(j.expired.slice(8, 10))
      const mi = Number(j.expired.slice(10, 12))
      const s = Number(j.expired.slice(12, 14))
      const parsed = new Date(y, mo, d, h, mi, s).getTime()
      if (Number.isFinite(parsed)) expMs = parsed
    }
    tokenCache = { token: j.accesstoken, type, expMs }
    return j.accesstoken
  } catch {
    console.error('[ppurio] token parse failed', text)
    return null
  }
}

function buildAuthHeader(token: string): string {
  const t = tokenCache?.type || 'Bearer'
  return `${t} ${token}`
}

export async function sendPpurioAlimtalk(params: {
  phone: string
  message: string
  title?: string
  /** 비즈뿌리오에 등록·승인된 알림톡 템플릿 코드 */
  templateCode?: string
}): Promise<SendResult> {
  const senderKey = process.env.PPURIO_SENDER_KEY?.trim()
  const hasApiKey = !!process.env.PPURIO_API_KEY?.trim()
  const from = process.env.PPURIO_FROM?.replace(/\D/g, '') || ''
  const templateCode = (params.templateCode || process.env.PPURIO_TEMPLATE_DEFAULT || '').trim()

  if (!hasApiKey || !senderKey) {
    console.log('[ppurio] alimtalk (dry-run: PPURIO_API_KEY or PPURIO_SENDER_KEY unset)', {
      to: params.phone,
      templateCode: templateCode || '(none)',
      title: params.title,
      message: params.message,
    })
    return { ok: true, skipped: true }
  }

  const cred = getAccountPassword()
  if (!cred) {
    console.log(
      '[ppurio] alimtalk (dry-run: need PPURIO_ACCOUNT + PPURIO_API_KEY or PPURIO_API_KEY as "계정:비밀번호")',
      { to: params.phone, messagePreview: params.message.slice(0, 120) }
    )
    return { ok: true, skipped: true }
  }

  if (!from || !templateCode) {
    console.log('[ppurio] alimtalk (dry-run: set PPURIO_FROM and templateCode / PPURIO_TEMPLATE_*)', {
      hasFrom: !!from,
      templateCode: templateCode || '(none)',
      to: params.phone,
      messagePreview: params.message.slice(0, 120),
    })
    return { ok: true, skipped: true }
  }

  const to = String(params.phone || '').replace(/\D/g, '')
  if (!to || to.length < 10) {
    console.log('[ppurio] invalid phone', params.phone)
    return { ok: false, skipped: true }
  }

  const token = await getAccessToken(cred.account, cred.password)
  if (!token) return { ok: false, raw: 'token_failed' }

  const refkey = randomUUID().replace(/-/g, '').slice(0, 32)
  const body = {
    account: cred.account,
    refkey,
    type: 'at',
    from,
    to,
    content: {
      at: {
        senderkey: senderKey,
        templatecode: templateCode,
        message: params.message,
      },
    },
  }

  try {
    const res = await fetch(`${apiBase()}/v3/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: buildAuthHeader(token),
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error('[ppurio] send failed', res.status, text)
      return { ok: false, raw: text }
    }
    return { ok: true, raw: text }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'fetch_failed'
    console.error('[ppurio] send error', msg)
    return { ok: false, raw: msg }
  }
}

/** 기존 호출부 호환: 알리고 대체 후에도 동일 이름 유지 */
export async function sendAlimtalkSms(params: {
  phone: string
  message: string
  title?: string
  templateCode?: string
}): Promise<SendResult> {
  return sendPpurioAlimtalk(params)
}
