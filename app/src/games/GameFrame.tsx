import { getGame } from './registry'
import { resolveGameUrl } from './providers/resolve'

export function GameFrame({ id }: { id: string }) {
  const game = getGame(id)
  const url = game ? resolveGameUrl(game) : null
  if (!game || !url) return <p>Game not available.</p>
  return (
    <iframe
      title={game.title}
      src={url}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-fullscreen"
      allow="fullscreen; gamepad"
      loading="lazy"
    />
  )
}
