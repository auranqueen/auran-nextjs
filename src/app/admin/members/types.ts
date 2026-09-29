export type Member = {
  id: string
  auth_id: string
  name: string
  email: string
  role: string
  status: string
  points?: number
  is_founder?: boolean
  created_at: string
  last_login_at?: string | null
  customer_grade?: string | null
}

export type Plan = { id: string; name: string; price: number }

export type DetailTab = 'summary' | 'orders' | 'points' | 'logs'

export const GRADES = ['PETAL', 'BLOOM', 'VELVET', 'LUMIÈRE', 'REINE', 'NOIR', 'CÉLESTE']
