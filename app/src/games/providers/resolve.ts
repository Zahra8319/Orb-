import type { Game } from '../types'

// Only these hosts may be framed. Add a host only after you sign
// the partner agreement with that provider.
const ALLOWED_EMBED_HOSTS = ['playgama.com', 'html5.gamedistribution.com']

export function resolveGameUrl(game: Game): string | null {
  const { source } = game
  if (source.kind === 'local') {
    return `${import.meta.env.BASE_URL}games/${source.path.replace(/^\/+/, '')}`
  }
  try {
    const host = new URL(source.url).hostname
    const ok = ALLOWED_EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
    return ok ? source.url : null
  } catch {
    return null
  }
}
