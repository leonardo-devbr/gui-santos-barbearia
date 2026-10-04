const fallbackAppPath = '/app'

export function getLoginHref(nextPath: string = fallbackAppPath) {
  return `/login?next=${encodeURIComponent(nextPath)}`
}

export function getSafeAppPath(value: string | null, fallback: string = fallbackAppPath) {
  if (!value) return fallback

  try {
    const baseUrl = new URL('https://local.invalid')
    const targetUrl = new URL(value, baseUrl)
    const isAppRoute = targetUrl.pathname === '/app' || targetUrl.pathname.startsWith('/app/')

    if (targetUrl.origin !== baseUrl.origin || !isAppRoute) return fallback

    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
  } catch {
    return fallback
  }
}
