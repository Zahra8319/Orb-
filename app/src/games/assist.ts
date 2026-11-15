import type { Game, GamePlay } from './types'

/**
 * Keeps a player from losing too many rounds in a row.
 *
 * Each game the player can lose reads an assist level from 0 (normal) to 3
 * (easiest) and goes easier as it rises: the computer makes more random moves,
 * the snake slows down, merges come easier.
 *
 * The level comes from replaying the player's rounds of that game, oldest first:
 * - A second loss in a row raises it by one, and so does every loss after that,
 *   so a losing streak of four reaches the easiest setting.
 * - A win ends the losing streak. Two wins in a row lower the level by one, so
 *   the game hardens again once the player is on top of it.
 * - A draw changes nothing.
 *
 * Games that feed health readings (Reaction Rush, Simon Says) never get an
 * assist: an easier game would hide the slowdown those readings are there to catch.
 */

export type Outcome = 'win' | 'loss' | 'draw'

export const MAX_ASSIST = 3

export function assistLevel(outcomes: readonly Outcome[]): number {
  let level = 0
  let losses = 0
  let wins = 0
  for (const o of outcomes) {
    if (o === 'loss') {
      losses++
      wins = 0
      if (losses >= 2) level = Math.min(MAX_ASSIST, level + 1)
    } else if (o === 'win') {
      wins++
      losses = 0
      if (wins >= 2 && level > 0) {
        level--
        wins = 0
      }
    }
  }
  return level
}

/** How a round counts toward the assist, or null if this game has no assist. */
export function outcomeOf(game: Game, value: number): Outcome | null {
  if (!game.assist || game.health) return null
  if (game.scoring.kind === 'wins') return value >= 1 ? 'win' : value <= 0 ? 'loss' : 'draw'
  if (game.assist.lossBelow !== undefined) return value < game.assist.lossBelow ? 'loss' : 'win'
  return null
}

/** The assist level for one player in one game, from their rounds so far. */
export function assistFor(game: Game, plays: readonly GamePlay[], crewId: string): number {
  const outcomes: Outcome[] = []
  for (const p of plays) {
    if (p.crewId !== crewId || p.gameId !== game.id) continue
    const o = outcomeOf(game, p.value)
    if (o) outcomes.push(o)
  }
  return assistLevel(outcomes)
}
