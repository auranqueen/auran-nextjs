import 'dotenv/config'
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

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function main() {
  const url = mustEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = mustEnv('SUPABASE_SERVICE_ROLE_KEY')

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

    if (!authId) {
      console.warn(`WARN no auth_id for ${u.email}, skipping profile upsert`)
      continue
    }

    // Upsert into profiles table for role lookup
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        { auth_id: authId, email: u.email, role: u.role },
        { onConflict: 'auth_id' }
      )
    if (profileErr) throw profileErr

    console.log(`UPSERT profiles: ${u.email} -> ${u.role}`)
  }

  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

