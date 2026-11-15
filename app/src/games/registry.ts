import catalog from './catalog.json'
import type { Game } from './types'

const games = catalog.games as Game[]

export const listGames = (): Game[] => games

export const getGame = (id: string): Game | undefined =>
  games.find((g) => g.id === id)

export const listCategories = (): string[] =>
  [...new Set(games.map((g) => g.category))].sort()
