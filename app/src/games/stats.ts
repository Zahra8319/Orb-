import type { Game, GamePlay } from './types'

export const formatScore = (game: Game, value: number) =>
  game.scoring.format.replace('{v}', String(Math.round(value * 10) / 10))

/** One line for a game card: best result, win record or puzzles solved. */
export function summarize(game: Game, plays: readonly GamePlay[]): string {
  if (!plays.length) return 'Not played yet'
  const values = plays.map((p) => p.value)
  switch (game.scoring.kind) {
    case 'max':
      return `Best ${formatScore(game, Math.max(...values))}`
    case 'min':
      return `Best ${formatScore(game, Math.min(...values))}`
    case 'wins': {
      const won = values.filter((v) => v >= 1).length
      return `Won ${won} of ${plays.length}`
    }
    case 'count':
      return formatScore(game, plays.length)
  }
}
