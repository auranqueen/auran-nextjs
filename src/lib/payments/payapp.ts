export type PayAppCreateInput = {
  kind: string
  amount: number
  target_id?: string
}

export type PayAppCreateResult =
  | { ok: true; intent_id: string; pay_url: string; mul_no: string }
  | { ok: false; error?: string; reason?: string }

export async function createPayAppPayment(input: PayAppCreateInput): Promise<PayAppCreateResult> {
  const res = await fetch('/api/payments/payapp/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json().catch(() => ({}))
  return json as PayAppCreateResult
}

