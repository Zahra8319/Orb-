export type GameSource =
  | { kind: 'local'; path: string }
  | { kind: 'embed'; url: string; provider: 'playgama' | 'gamedistribution' | 'other' }

export interface Game {
  id: string
  title: string
  description: string
  category: string
  thumbnail: string
  source: GameSource
  license: string
  credit: string
}
