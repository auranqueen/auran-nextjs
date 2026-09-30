export const fmtScheduleDate = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ko-KR')
}

export const calcCycleDate = (startedAt: string | null | undefined, cycle: number): string => {
  if (!startedAt || cycle < 1) return ''
  const raw = String(startedAt)
  const base = new Date(raw.length >= 10 ? `${raw.slice(0, 10)}T12:00:00` : raw)
  if (Number.isNaN(base.getTime())) return ''
  const d = new Date(base)
  d.setDate(d.getDate() + (cycle - 1) * 30)
  return d.toISOString().slice(0, 10)
}
