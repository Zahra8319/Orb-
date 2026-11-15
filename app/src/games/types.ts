export type GameSource =
  | { kind: 'local'; path: string }
  | { kind: 'embed'; url: string; provider: 'playgama' | 'gamedistribution' | 'other' }

/**
 * What the number a game reports means.
 * max: higher is better. min: lower is better. wins: 1 win, 0.5 draw, 0 loss.
 * count: every report is one finished puzzle.
 * `format` turns a value into words, with {v} standing for the value.
 */
export interface GameScoring {
  kind: 'max' | 'min' | 'wins' | 'count'
  format: string
}

/**
 * Present only on games the player can lose. A wins game counts a 0 as a loss;
 * a points game counts a round under `lossBelow` as a loss and anything else as a win.
 */
export interface GameAssist {
  lossBelow?: number
}

export interface Game {
  id: string
  title: string
  description: string
  category: string
  thumbnail: string
  source: GameSource
  license: string
  credit: string
  /** How to play, one rule per line. */
  rules: string[]
  scoring: GameScoring
  assist?: GameAssist
  /** Results also count toward Sleep and mind. These games are never made easier. */
  health?: 'reaction' | 'memory'
}

/** One finished round, as Orb stores it. */
export interface GamePlay {
  crewId: string
  gameId: string
  /** Mission day and minute it was played. */
  day: number
  t: number
  value: number
  detail?: string
}
