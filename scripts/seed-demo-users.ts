import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

type DemoUser = {
  role: 'customer' | 'owner' | 'partner' | 'brand' | 'admin'
  email: string
  password: string
}

const DEMO_USERS: DemoUser[] = [
  { role: 'customer', email: 'guest@auran.kr', password: 'auran1234!' },
  { role: 'owner', email: 'shop@auran.kr', password: 'auran1234!' },
  { role: 'partner', email: 'partner@auran.kr', password: 'auran1234!' },
  { role: 'brand', email: 'brand@auran.kr', password: 'auran1234!' },
  { role: 'admin', email: 'admin@auran.kr', password: 'auran1234!' },
]

// Load envs from .env.local first, then .env (if present)
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

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch up to first 1000 users to detect existing demo emails (cheap for 5 demo users)
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr
  const byEmail = new Map((list.users || []).map((u) => [u.email?.toLowerCase() || '', u]))

  for (const u of DEMO_USERS) {
    const existing = byEmail.get(u.email.toLowerCase())
    let authId: string | undefined

    if (existing?.id) {
      authId = existing.id
      // Ensure demo users are always usable: reset password + confirm email
      const { error: updErr } = await supabase.auth.admin.updateUserById(authId, {
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role },
      })
      if (updErr) throw updErr
      console.log(`UPDATED auth user password: ${u.email}`)
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

    if (!authId) {
      console.warn(`WARN no auth_id for ${u.email}, skipping profile upsert`)
      continue
    }

    // Upsert into users table as well (current app login reads role from users)
    const { error: usersErr } = await supabase
      .from('users')
      .upsert(
        {
          auth_id: authId,
          email: u.email,
          name:
            u.role === 'admin' ? '관리자' :
            u.role === 'owner' ? '원장님' :
            u.role === 'partner' ? '파트너스' :
            u.role === 'brand' ? '브랜드사' : '고객',
          role: u.role,
          provider: 'email',
          status: 'active',
          points: 0,
          charge_balance: 0,
        },
        { onConflict: 'auth_id' }
      )
    if (usersErr) throw usersErr
    console.log(`UPSERT users: ${u.email} -> ${u.role}`)

    // Upsert into profiles table for role lookup
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({ auth_id: authId, email: u.email, role: u.role }, { onConflict: 'auth_id' })

    if (profileErr) {
      if ((profileErr as any).code === 'PGRST205') {
        console.warn(`WARN profiles table missing. Apply migration 003_profiles.sql then re-run. (${u.email})`)
      } else {
        throw profileErr
      }
    } else {
      console.log(`UPSERT profiles: ${u.email} -> ${u.role}`)
    }
  }

  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

