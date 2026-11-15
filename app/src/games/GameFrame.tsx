import { useEffect, useRef } from 'react'
import { useSleepShift } from '../store/hooks'
import { useStore } from '../store/store'
import { resolveGameUrl } from './providers/resolve'
import type { Game } from './types'

type Down = { type: 'theme'; theme: 'day' | 'sleep' } | { type: 'assist'; level: number }

/**
 * Frames a game and talks to it through public/games/orb-bridge.js.
 * Up: finished rounds, stored for the signed-in crew member.
 * Down: the day/sleep shift and the assist level.
 * Only messages from this frame and this origin are accepted.
 */
export function GameFrame({ game, assist }: { game: Game; assist: number }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const addGamePlay = useStore((s) => s.addGamePlay)
  const theme: 'day' | 'sleep' = useSleepShift() ? 'sleep' : 'day'
  const url = resolveGameUrl(game)

  // The latest values, for when the game says it is ready.
  const latest = useRef({ theme, assist })
  latest.current = { theme, assist }

  const post = (msg: Down) => frame.current?.contentWindow?.postMessage({ orb: 1, ...msg }, window.location.origin)
  const sendAll = () => {
    post({ type: 'theme', theme: latest.current.theme })
    post({ type: 'assist', level: latest.current.assist })
  }

  useEffect(() => post({ type: 'theme', theme }), [theme])
  useEffect(() => post({ type: 'assist', level: assist }), [assist])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      const d = e.data as { orb?: number; type?: string; value?: unknown; detail?: unknown } | null
      if (!d || d.orb !== 1) return
      if (d.type === 'ready') sendAll()
      if (d.type === 'result' && typeof d.value === 'number' && Number.isFinite(d.value)) {
        addGamePlay(game.id, d.value, typeof d.detail === 'string' ? d.detail.slice(0, 80) : undefined)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
    // sendAll reads refs, so it does not need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, addGamePlay])

  if (!url) return <p>Game not available.</p>
  return (
    <iframe
      ref={frame}
      title={game.title}
      src={url}
      onLoad={sendAll}
      className="game-frame"
      sandbox="allow-scripts allow-same-origin allow-pointer-lock"
      allow="fullscreen; gamepad"
    />
  )
}
