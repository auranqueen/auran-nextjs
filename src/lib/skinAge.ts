export const SKIN_AGE_CAP = 10

export interface SkinScores {
  moisture: number
  oil: number
  sensitivity: number
  elasticity: number
  pigmentation: number
  pore: number
}

function clamp100(n: any): number {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(100, x))
}

export function computeComposite(s: SkinScores): number {
  const good = clamp100(s.moisture) + clamp100(s.elasticity)
  const bad = (100 - clamp100(s.sensitivity)) + (100 - clamp100(s.pigmentation)) + (100 - clamp100(s.pore))
  return Math.round((good + bad) / 5)
}

export function computeSkinAge(composite: number, age?: number | null): number | null {
  if (age == null || !Number.isFinite(Number(age)) || Number(age) <= 0) return null
  const delta = Math.round(((composite - 50) / 50) * SKIN_AGE_CAP)
  return Math.max(15, Number(age) - delta)
}
