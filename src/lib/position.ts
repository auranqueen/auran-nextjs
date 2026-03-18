export type Position = 'customer' | 'partner' | 'salon' | 'brand'

export const POSITION_STORAGE_KEY = 'auran_position'

export function normalizePosition(input: string | null | undefined): Position | null {
  if (!input) return null
  const v = input.toLowerCase()
  if (v === 'customer' || v === 'partner' || v === 'salon' || v === 'brand') return v
  if (v === 'owner') return 'salon'
  return null
}

export function positionToDashboardPath(position: Position): string {
  switch (position) {
    case 'customer':
      return '/dashboard/customer'
    case 'partner':
      return '/dashboard/partner'
    case 'salon':
      // owner dashboard entry route
      return '/dashboard/owner'
    case 'brand':
      return '/dashboard/brand'
  }
}

