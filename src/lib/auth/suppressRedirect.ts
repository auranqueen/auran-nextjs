export function suppressAuthRedirect() {
  sessionStorage.setItem('auth_redirect_suppressed', String(Date.now()))
}
export function isAuthRedirectSuppressed() {
  const t = sessionStorage.getItem('auth_redirect_suppressed')
  if (!t) return false
  const fresh = Date.now() - Number(t) < 3000
  if (!fresh) sessionStorage.removeItem('auth_redirect_suppressed')
  return fresh
}
