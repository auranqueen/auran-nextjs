/**
 * 안나로자 브랜드사 계정 시드 — 구조 복제 전용 (제네틱/볼라욘 패턴)
 * company / brands(허브1) / Auth·users·profiles / brand_staff(CEO PIN) 만 생성.
 * brand_tier_packages · brand_arete_* 등 비즈니스 데이터는 절대 insert 하지 않음.
 * 실행: node scripts/seed-annarosa-company.cjs
 */
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

dotenv.config({ path: '.env.local' })
dotenv.config()

const COMPANY_NAME = '안나로자'
const EMAIL = 'annarosa@auran.kr'
const PASSWORD = 'annarosa1234'
const HUB_SLUG = 'annarosa'
const LOGIN_ROLE = 'ceo'
const CEO_USERNAME = 'annarosaceo'
const CEO_PIN = '1234'
const CEO_NAME = '안나로자 대표'
const BRAND_NAME = '안나로자'
const BRAND_NAME_KR = '안나로자'

function mustEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error('Missing env: ' + name)
  return v
}

function firstEnv(names) {
  for (const n of names) {
    const v = process.env[n]
    if (v) return v
  }
  throw new Error('Missing env: one of [' + names.join(', ') + ']')
}

async function findAuthUserByEmail(supabase, email) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = (data.users || []).find((u) => (u.email || '').toLowerCase() === target)
    if (found && found.id) return { id: found.id }
    if (!data.users || data.users.length < 200) break
  }
  return null
}

async function main() {
  const url = mustEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = firstEnv(['SUPABASE_SERVICE_ROLE_KEY', 'Supabase_service_key'])
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let companyId
  {
    const { data: existing, error } = await supabase
      .from('brand_companies')
      .select('id, name')
      .eq('name', COMPANY_NAME)
      .maybeSingle()
    if (error) throw error
    if (existing && existing.id) {
      companyId = String(existing.id)
      console.log('OK company exists: ' + COMPANY_NAME + ' (' + companyId + ')')
    } else {
      const { data: created, error: insErr } = await supabase
        .from('brand_companies')
        .insert({ name: COMPANY_NAME })
        .select('id')
        .single()
      if (insErr || !created || !created.id) throw insErr || new Error('company insert failed')
      companyId = String(created.id)
      console.log('CREATED company: ' + COMPANY_NAME + ' (' + companyId + ')')
    }
  }

  let authId
  {
    const existing = await findAuthUserByEmail(supabase, EMAIL)
    if (existing && existing.id) {
      authId = existing.id
      const { error: updErr } = await supabase.auth.admin.updateUserById(authId, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'brand' },
      })
      if (updErr) throw updErr
      console.log('UPDATED auth password: ' + EMAIL)
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'brand' },
      })
      if (createErr || !created.user || !created.user.id) throw createErr || new Error('auth create failed')
      authId = created.user.id
      console.log('CREATED auth user: ' + EMAIL)
    }
  }

  let userPk
  {
    const { data: existingUser, error: uErr } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .maybeSingle()
    if (uErr) throw uErr

    if (existingUser && existingUser.id) {
      userPk = String(existingUser.id)
      const { error } = await supabase
        .from('users')
        .update({
          email: EMAIL,
          name: COMPANY_NAME,
          role: 'brand',
          provider: 'email',
          status: 'active',
        })
        .eq('id', userPk)
      if (error) throw error
      console.log('UPDATED users: ' + EMAIL + ' (' + userPk + ')')
    } else {
      const { data: byEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', EMAIL)
        .maybeSingle()
      if (byEmail && byEmail.id) {
        userPk = String(byEmail.id)
        const { error } = await supabase
          .from('users')
          .update({
            auth_id: authId,
            name: COMPANY_NAME,
            role: 'brand',
            provider: 'email',
            status: 'active',
          })
          .eq('id', userPk)
        if (error) throw error
        console.log('LINKED users by email: ' + EMAIL + ' (' + userPk + ')')
      } else {
        const { data: inserted, error } = await supabase
          .from('users')
          .insert({
            auth_id: authId,
            email: EMAIL,
            name: COMPANY_NAME,
            role: 'brand',
            provider: 'email',
            status: 'active',
            points: 0,
            charge_balance: 0,
          })
          .select('id')
          .single()
        if (error || !inserted || !inserted.id) throw error || new Error('users insert failed')
        userPk = String(inserted.id)
        console.log('CREATED users: ' + EMAIL + ' (' + userPk + ')')
      }
    }

    const { error: profileErr } = await supabase.from('profiles').upsert(
      { auth_id: authId, email: EMAIL, role: 'brand', active_role: 'brand' },
      { onConflict: 'auth_id' },
    )
    if (profileErr) throw profileErr
    console.log('UPSERT profiles: ' + EMAIL)
  }

  let hubBrandId = null
  {
    let rowId = null
    const { data: bySlug, error: slugErr } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', HUB_SLUG)
      .maybeSingle()
    if (slugErr) throw slugErr
    if (bySlug && bySlug.id) rowId = String(bySlug.id)

    if (!rowId) {
      const { data: byName, error: nameErr } = await supabase
        .from('brands')
        .select('id')
        .eq('name', BRAND_NAME)
        .eq('company_id', companyId)
        .maybeSingle()
      if (nameErr) throw nameErr
      if (byName && byName.id) rowId = String(byName.id)
    }

    const payload = {
      name: BRAND_NAME,
      brand_name_kr: BRAND_NAME_KR,
      slug: HUB_SLUG,
      company_id: companyId,
      user_id: userPk,
      status: 'active',
      apply_status: 'approved',
      welcome_shown: true,
      login_role: LOGIN_ROLE,
      origin_country: '대한민국',
    }

    if (rowId) {
      const { error } = await supabase.from('brands').update(payload).eq('id', rowId)
      if (error) throw error
      console.log('UPDATED brand: ' + BRAND_NAME + ' (' + rowId + ')')
    } else {
      const { data: created, error } = await supabase
        .from('brands')
        .insert(payload)
        .select('id')
        .single()
      if (error || !created || !created.id) throw error || new Error('brand insert failed')
      rowId = String(created.id)
      console.log('CREATED brand: ' + BRAND_NAME + ' (' + rowId + ')')
    }
    hubBrandId = rowId

    const { data: member } = await supabase
      .from('brand_members')
      .select('id')
      .eq('brand_id', rowId)
      .eq('user_id', userPk)
      .limit(1)
    if (!member || member.length === 0) {
      const { error: memErr } = await supabase.from('brand_members').insert({
        brand_id: rowId,
        user_id: userPk,
        role: 'owner',
      })
      if (memErr) {
        const { error: memErr2 } = await supabase.from('brand_members').insert({
          brand_id: rowId,
          user_id: userPk,
        })
        if (memErr2) console.warn('WARN brand_members:', memErr2.message)
        else console.log('CREATED brand_members')
      } else {
        console.log('CREATED brand_members')
      }
    }
  }

  if (!hubBrandId) throw new Error('hub brand (slug=' + HUB_SLUG + ') missing after seed')

  {
    const { data: existingStaff, error } = await supabase
      .from('brand_staff')
      .select('id')
      .eq('company_id', companyId)
      .eq('username', CEO_USERNAME)
      .maybeSingle()
    if (error) throw error

    if (existingStaff && existingStaff.id) {
      const { error: updErr } = await supabase
        .from('brand_staff')
        .update({
          name: CEO_NAME,
          role: 'ceo',
          pin: CEO_PIN,
          is_active: true,
          brand_id: hubBrandId,
          company_id: companyId,
        })
        .eq('id', existingStaff.id)
      if (updErr) throw updErr
      console.log('UPDATED brand_staff: ' + CEO_USERNAME)
    } else {
      const { error: insErr } = await supabase.from('brand_staff').insert({
        brand_id: hubBrandId,
        company_id: companyId,
        name: CEO_NAME,
        username: CEO_USERNAME,
        role: 'ceo',
        pin: CEO_PIN,
        is_active: true,
      })
      if (insErr) throw insErr
      console.log('CREATED brand_staff: ' + CEO_USERNAME + ' (PIN ' + CEO_PIN + ')')
    }
  }

  {
    const t = await supabase.from('brand_tier_packages').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    const a = await supabase.from('brand_arete_members').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    const b = await supabase.from('brand_arete_monthly_bundles').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    const g = await supabase.from('brand_owner_grades').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    console.log('\nVERIFY (must be 0)')
    console.log('  brand_tier_packages:', t.count)
    console.log('  brand_owner_grades:', g.count)
    console.log('  brand_arete_members:', a.count)
    console.log('  brand_arete_monthly_bundles:', b.count)
  }

  console.log('\nDONE')
  console.log('  Hub login: /brand/' + HUB_SLUG + '  (id: annarosa / pw: ' + PASSWORD + ')')
  console.log('  PIN gate:  username ' + CEO_USERNAME + ' / PIN ' + CEO_PIN)
  console.log('  company_id: ' + companyId)
  console.log('  hub brand_id: ' + hubBrandId)
  console.log('  NOTE: Hub still shows 등급/아레테 메뉴 (UI hardcoded); data queries are empty for this company_id.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
