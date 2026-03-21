/** 오늘 기준 다음 생일까지 남은 일수 (0 = 오늘이 생일) */
export function daysUntilNextBirthday(birthDate: string | Date): number {
  const today = new Date()
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const birth = new Date(birthDate)
  const m = birth.getMonth()
  const d = birth.getDate()
  let target = new Date(today.getFullYear(), m, d).getTime()
  if (target < t0) {
    target = new Date(today.getFullYear() + 1, m, d).getTime()
  }
  return Math.ceil((target - t0) / (1000 * 60 * 60 * 24))
}
