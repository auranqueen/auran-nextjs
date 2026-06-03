import { SupabaseClient } from '@supabase/supabase-js'

export async function addToPurchaseAmount(
  userId: string,
  amount: number,
  supabase: SupabaseClient
): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', userId)
    .maybeSingle()
  if (!user?.auth_id) return
  const { data: p } = await supabase
    .from('profiles')
    .select('total_purchase_amount')
    .eq('auth_id', user.auth_id)
    .maybeSingle()
  await supabase
    .from('profiles')
    .update({ total_purchase_amount: ((p as any)?.total_purchase_amount || 0) + amount })
    .eq('auth_id', user.auth_id)
}

export async function autoUpgradeGrade(
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: user } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', userId)
    .maybeSingle()
  if (!user?.auth_id) return 'PETAL'
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_purchase_amount, grade')
    .eq('auth_id', user.auth_id)
    .maybeSingle()
  const { data: grades } = await supabase
    .from('grade_settings')
    .select('grade_name, min_amount, grade_order, invite_only')
    .order('grade_order', { ascending: true })
  const amount = (profile as any)?.total_purchase_amount || 0
  let newGrade = 'PETAL'
  for (const g of (grades || []) as any[]) {
    if (!g.invite_only && amount >= g.min_amount) {
      newGrade = g.grade_name
    }
  }
  if (newGrade !== (profile as any)?.grade) {
    await supabase
      .from('profiles')
      .update({ grade: newGrade })
      .eq('auth_id', user.auth_id)
    await supabase
      .from('users')
      .update({ customer_grade: newGrade })
      .eq('id', userId)
  }
  return newGrade
}
