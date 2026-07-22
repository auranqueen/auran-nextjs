import type { SupabaseClient } from '@supabase/supabase-js'

export type CreateSecondBrandParams = {
  addBrandName: string
  addBrandNameEn: string
  addBrandCountry: string
  userPk: string
  addBrandContact: string
  currentBrandId: string
}

export type CreateSecondBrandResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string }

/**
 * 세컨브랜드 생성. 허브 brands.company_id를 그대로 상속.
 * 허브 company_id가 없으면 생성하지 않음(자동 company 생성 금지).
 */
export async function createSecondBrand(
  supabase: SupabaseClient,
  params: CreateSecondBrandParams,
): Promise<CreateSecondBrandResult> {
  const { data: hubBrand, error: hubError } = await supabase
    .from('brands')
    .select('company_id')
    .eq('id', params.currentBrandId)
    .single()

  if (hubError) {
    return { success: false, error: hubError.message }
  }

  if (!hubBrand?.company_id) {
    return {
      success: false,
      error:
        '허브 브랜드에 회사 연결(company_id)이 없어 서브브랜드를 추가할 수 없습니다. 먼저 회사 연결을 설정해주세요.',
    }
  }

  const { data, error } = await supabase
    .from('brands')
    .insert({
      name: params.addBrandName,
      name_en: params.addBrandNameEn || null,
      origin_country: params.addBrandCountry || '대한민국',
      user_id: params.userPk,
      apply_status: 'approved',
      status: 'active',
      welcome_shown: true,
      manager_phone: params.addBrandContact || null,
      company_id: hubBrand.company_id,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { success: false, error: error?.message || '브랜드 추가에 실패했어요' }
  }

  return { success: true, data: { id: String(data.id) } }
}
