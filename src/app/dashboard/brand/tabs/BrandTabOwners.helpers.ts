export interface OwnerRow {
  id: string
  name: string
  salon_name: string
  region: string
  grade: string
  arete: boolean
  last_order: string | null
  monthly: number
  point_balance: number
}

export type CsvRowResult = {
  line: number
  store_name: string
  amount?: number
  status: 'ok' | 'skipped' | 'no_match' | 'conflict' | 'error'
  reason?: string
  owner_id?: string
  matched_owner_name?: string
  matched_store_name?: string
  conflict_owners?: { profile_id: string; owner_store_name: string; owner_name: string }[]
}

export type BulkImportResult = {
  imported: number
  skipped: number
  failed: number
  conflicts: number
  dry_run: boolean
  eligible_owners?: number
  results?: CsvRowResult[]
}

export interface BrandOwnerLinkRow {
  id: string
  owner_id: string
  status: string
  approved_at: string | null
  name: string
  email: string
}

export interface Props {
  brandId: string | null
  brandName: string
  authId: string | null
  staffId?: string | null
}

export function downloadCsvTemplate() {
  const sample = '매장명,금액,메모\n스킨파우더룸,10000,초기 적립\n'
  const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'owner_points_init_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}