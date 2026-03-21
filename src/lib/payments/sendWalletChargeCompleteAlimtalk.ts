import { sendAlimtalkSms } from '@/lib/ppurio/sendAlimtalk'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 페이앱 결제요청 단계 알림은 끄고(smsuse=n), 결제 완료(feedback) 후에만 선택 발송.
 * admin_settings: alimtalk / wallet_charge_alimtalk = 1 일 때만 (기본 1)
 */
export async function sendWalletChargeCompleteAlimtalkIfEnabled(
  client: SupabaseClient,
  params: { userId: string; amount: number; pointsAdded: number }
): Promise<void> {
  const { data: master } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'alimtalk')
    .eq('key', 'enabled')
    .maybeSingle()
  if (Number(master?.value ?? 1) !== 1) return

  const { data: onRow } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'alimtalk')
    .eq('key', 'wallet_charge_alimtalk')
    .maybeSingle()
  if (Number(onRow?.value ?? 0) !== 1) return

  const { data: u } = await client.from('users').select('phone,name').eq('id', params.userId).maybeSingle()
  const phone = (u as { phone?: string } | null)?.phone?.replace(/\D/g, '')
  if (!phone || phone.length < 10) return

  const name = ((u as { name?: string } | null)?.name || '고객').trim()
  const amt = params.amount.toLocaleString()
  const pts = params.pointsAdded.toLocaleString()
  const tpl = process.env.PPURIO_TEMPLATE_WALLET_CHARGE?.trim()
  const msg = `${name}님,\n토스트 충전이 완료되었습니다.\n\n■ 충전 금액: ₩${amt}\n■ 적립 포인트: ${pts}P\n\n앱에서 지갑 잔액을 확인해 주세요.`

  await sendAlimtalkSms({
    phone,
    message: msg,
    title: 'AURAN 충전 완료',
    templateCode: tpl || undefined,
  })
}
