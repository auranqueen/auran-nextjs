export type AuranTheme = 'dark' | 'light'

const STORAGE_KEY = 'auran_theme'

export function getStoredTheme(): AuranTheme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function setStoredTheme(theme: AuranTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}
