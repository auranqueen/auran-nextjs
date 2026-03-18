import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

type Target = { email: string; role: 'partner' | 'owner' | 'brand' }

// 개발/테스트용: pending 계정을 active로 올려서 대시보드 진입 가능하게 함
const TARGETS: Target[] = [
  { email: 'partner-pending@auran.kr', role: 'partner' },
  { email: 'owner-pending@auran.kr', role: 'owner' },
  { email: 'brand-pending@auran.kr', role: 'brand' },
]

dotenv.config({ path: '.env.local' })
dotenv.config()

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function firstEnv(names: string[]): string {
  for (const n of names) {
    const v = process.env[n]
    if (v) return v
  }
  throw new Error(`Missing env: one of [${names.join(', ')}]`)
}

async function main() {
  const url = mustEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = firstEnv(['SUPABASE_SERVICE_ROLE_KEY', 'Supabase_service_key'])
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr
  const byEmail = new Map((list.users || []).map((u) => [u.email?.toLowerCase() || '', u]))

  for (const t of TARGETS) {
    const auth = byEmail.get(t.email.toLowerCase())
    if (!auth?.id) {
      console.log(`SKIP not found: ${t.email}`)
      continue
    }

    const { error: uerr } = await supabase
      .from('users')
      .update({ status: 'active', role: t.role })
      .eq('auth_id', auth.id)
    if (uerr) throw uerr

    console.log(`APPROVED active: ${t.email} -> ${t.role}`)
  }

  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

