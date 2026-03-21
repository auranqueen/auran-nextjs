export const CUSTOMER_GRADES = [
  { value: 'welcome', label: '웰컴' },
  { value: 'silver', label: '실버' },
  { value: 'gold', label: '골드' },
  { value: 'vip', label: 'VIP' },
  { value: 'influencer', label: '인플루언서' },
] as const

/** 어드민 타겟 발급 UI용 (DB customer_grade 값과 동일) */
export const TARGET_ISSUE_GRADES = [
  { value: 'welcome', label: '새싹 회원' },
  { value: 'silver', label: '글로우 회원' },
  { value: 'gold', label: '뷰티스타 회원' },
  { value: 'influencer', label: '인플루언서' },
  { value: 'vip', label: 'AURAN퀸' },
] as const

export type CustomerGradeValue = (typeof CUSTOMER_GRADES)[number]['value']

const GRADE_SET = new Set<string>(CUSTOMER_GRADES.map((g) => g.value))

export function isValidCustomerGrade(v: string | null | undefined): v is CustomerGradeValue {
  return typeof v === 'string' && GRADE_SET.has(v)
}

export function getCustomerGradeLabel(v: string | null | undefined): string {
  if (!v) return '웰컴'
  const row = CUSTOMER_GRADES.find((g) => g.value === v)
  return row?.label ?? '웰컴'
}
