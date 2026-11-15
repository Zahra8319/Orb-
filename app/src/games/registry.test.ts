import { describe, expect, it } from 'vitest'
import { listGames } from './registry'
import { resolveGameUrl } from './providers/resolve'
import type { Game } from './types'

describe('game catalog', () => {
  it('has unique ids and a license for every game', () => {
    const games = listGames()
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length)
    for (const g of games) expect(g.license.length).toBeGreaterThan(0)
  })
})

describe('resolveGameUrl', () => {
  const base = {
    id: 'x', title: 'X', description: '', category: 'arcade', thumbnail: '', license: 'MIT', credit: '',
    rules: [], scoring: { kind: 'max' as const, format: '{v}' },
  }
  it('resolves local games under /games/', () => {
    const g: Game = { ...base, source: { kind: 'local', path: 'snake/index.html' } }
    expect(resolveGameUrl(g)).toBe('/games/snake/index.html')
  })
  it('blocks embeds from hosts not on the allowlist', () => {
    const g: Game = { ...base, source: { kind: 'embed', provider: 'other', url: 'https://evil.example/game' } }
    expect(resolveGameUrl(g)).toBeNull()
  })
})
