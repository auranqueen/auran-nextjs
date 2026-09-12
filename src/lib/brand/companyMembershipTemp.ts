/**
 * TEMP hardcode - companyId-based membership / grade labels.
 * Replace with DB columns later.
 */

export const CIVASAN_COMPANY_ID = 'c1a78c33-4001-4de9-b22d-e94cf815cf33'
export const VOLAYON_COMPANY_ID = '8932591f-e7bf-40d5-b9ed-f3b7bd3cea43'

/** Civasan-only grades (3-tier; 취급점 abolished). */
export const CIVASAN_OWNER_GRADES = ['메디슈티컬', '프리미엄전문점', '전문점'] as const

export function isCivasanCompany(companyId: string | null | undefined): boolean {
  return companyId === CIVASAN_COMPANY_ID
}

export function isVolayonCompany(companyId: string | null | undefined): boolean {
  return companyId === VOLAYON_COMPANY_ID
}

export function getMembershipClubLabel(companyId: string | null | undefined): string {
  if (isCivasanCompany(companyId) || !companyId) return '아레테클럽'
  if (isVolayonCompany(companyId)) return '볼라욘 멤버십 클럽'
  return '브랜드 멤버십 클럽'
}

export function getMembershipClubManageLabel(companyId: string | null | undefined): string {
  if (isCivasanCompany(companyId) || !companyId) return '아레테클럽관리'
  return getMembershipClubLabel(companyId) + '관리'
}

export function getOwnerGradeOptions(companyId: string | null | undefined): string[] {
  if (isCivasanCompany(companyId) || !companyId) return [...CIVASAN_OWNER_GRADES]
  if (isVolayonCompany(companyId)) return ['볼라욘전문클럽']
  return ['기본 등급']
}

export function getDefaultOwnerGrade(companyId: string | null | undefined): string | null {
  if (isCivasanCompany(companyId) || !companyId) return null
  if (isVolayonCompany(companyId)) return '볼라욘전문클럽'
  return '기본 등급'
}

export function getGradeChipShortLabel(grade: string): string {
  if (grade === '메디슈티컬') return '메디'
  if (grade === '프리미엄전문점') return '프리미엄'
  if (grade === '전문점') return '전문점'
  if (grade === '볼라욘전문클럽') return '볼라욘'
  if (grade === '기본 등급') return '기본'
  return grade
}

export function getLiveTargetGradeOptions(companyId: string | null | undefined): string[] {
  return ['전체', ...getOwnerGradeOptions(companyId), getMembershipClubLabel(companyId)]
}

export function getOrenTalkTargets(companyId: string | null | undefined): { key: string; label: string }[] {
  const club = getMembershipClubLabel(companyId)
  if (isCivasanCompany(companyId) || !companyId) {
    return [
      { key: 'all', label: '전체 원장님' },
      { key: 'medi', label: '메디슈티컬' },
      { key: 'premium', label: '프리미엄전문점' },
      { key: 'spec', label: '전문점' },
      { key: 'arete', label: club },
    ]
  }
  if (isVolayonCompany(companyId)) {
    return [
      { key: 'all', label: '전체 원장님' },
      { key: 'volayon_club', label: '볼라욘전문클럽' },
      { key: 'arete', label: club },
    ]
  }
  return [
    { key: 'all', label: '전체 원장님' },
    { key: 'basic', label: '기본 등급' },
    { key: 'arete', label: club },
  ]
}

export function isMembershipClubGradeLabel(
  label: string,
  companyId: string | null | undefined,
): boolean {
  return label === getMembershipClubLabel(companyId) || label === '아레테클럽'
}