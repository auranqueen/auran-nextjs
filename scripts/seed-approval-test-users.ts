import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

type U = { role: 'partner' | 'owner' | 'brand'; email: string; password: string }

// 승인 전 로그인 차단 테스트용 (status=pending)
const USERS: U[] = [
  { role: 'partner', email: 'partner-pending@auran.kr', password: 'auran1234!' },
  { role: 'owner', email: 'owner-pending@auran.kr', password: 'auran1234!' },
  { role: 'brand', email: 'brand-pending@auran.kr', password: 'auran1234!' },
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

  for (const u of USERS) {
    const existing = byEmail.get(u.email.toLowerCase())
    let authId: string | undefined

    if (existing?.id) {
      console.log(`SKIP auth user exists: ${u.email}`)
      authId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role },
      })
      if (createErr) throw createErr
      authId = created.user?.id
      console.log(`CREATED auth user: ${u.email}`)
    }

    if (!authId) continue

    const { error: usersErr } = await supabase
      .from('users')
      .upsert(
        {
          auth_id: authId,
          email: u.email,
          name: u.role === 'owner' ? '원장님(승인대기)' : u.role === 'brand' ? '브랜드사(승인대기)' : '파트너스(승인대기)',
          role: u.role,
          provider: 'email',
          status: 'pending',
          points: 0,
          charge_balance: 0,
        },
        { onConflict: 'auth_id' }
      )
    if (usersErr) throw usersErr
    console.log(`UPSERT users pending: ${u.email} -> ${u.role}`)

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({ auth_id: authId, email: u.email, role: u.role }, { onConflict: 'auth_id' })
    if (profileErr && (profileErr as any).code !== 'PGRST205') throw profileErr
  }

  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

