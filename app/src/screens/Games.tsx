import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assistFor, MAX_ASSIST } from '../games/assist'
import { GameFrame } from '../games/GameFrame'
import { getGame, listCategories, listGames } from '../games/registry'
import { formatScore, summarize } from '../games/stats'
import { useMyGamePlays } from '../store/hooks'
import { useStore } from '../store/store'
import '../games/games.css'

const HEALTH_NOTE = {
  reaction: 'Counts toward Sleep and mind: five or more taps in a day give a reaction reading.',
  memory: 'Counts toward Sleep and mind: your longest sequence each day is a memory reading.',
} as const

export function Games() {
  const games = listGames()
  const mine = useMyGamePlays()
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Games</h1>
        <p className="page-intro">
          Short breaks between tasks. Pick one and play. Reaction Rush and Simon Says also count toward Sleep and mind.
        </p>
      </header>
      {games.length === 0 ? (
        <p>No games yet.</p>
      ) : (
        listCategories().map((cat) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="games-cat">{cat}</h2>
            <ul className="games-grid">
              {games.filter((g) => g.category === cat).map((g) => {
                const plays = mine.filter((p) => p.gameId === g.id)
                return (
                  <li key={g.id} className="game-card">
                    <Link to={`/games/play/${g.id}`}>
                      <strong>{g.title}</strong>
                      <span>{g.description}</span>
                      <span className="game-card-meta">
                        <span>{summarize(g, plays)}</span>
                        {g.health && <span className="game-tag">Sleep and mind</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </>
  )
}

export function GamePlay() {
  const { id = '' } = useParams()
  const game = getGame(id)
  const crewId = useStore((s) => s.crewId)
  const allPlays = useStore((s) => s.gamePlays)
  const mine = useMyGamePlays()
  const plays = useMemo(() => mine.filter((p) => p.gameId === id), [mine, id])
  const assist = game ? assistFor(game, allPlays, crewId) : 0

  if (!game) {
    return (
      <header className="page-header">
        <h1 className="page-title">Game not found</h1>
        <p className="page-intro"><Link to="/games">Back to games</Link></p>
      </header>
    )
  }

  const recent = plays.slice(-5).reverse()

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">{game.title}</h1>
        <p className="page-intro"><Link to="/games">Back to games</Link></p>
      </header>

      <div className="game-layout">
        <div className="game-stage"><GameFrame game={game} assist={assist} /></div>

        <aside className="game-side">
          <section aria-labelledby="game-rules">
            <h2 id="game-rules" className="game-side-title">How to play</h2>
            <ol className="game-rules">
              {game.rules.map((r) => <li key={r}>{r}</li>)}
            </ol>
          </section>

          {assist > 0 && (
            <p className="game-assist" role="status">
              <strong>Easier mode, level {assist} of {MAX_ASSIST}.</strong> After a few tough rounds the game has eased off. It
              goes back to normal as you win.
            </p>
          )}

          {game.health && <p className="game-health">{HEALTH_NOTE[game.health]}</p>}

          <section aria-labelledby="game-results">
            <h2 id="game-results" className="game-side-title">Your results</h2>
            <p className="game-best">{summarize(game, plays)}</p>
            {recent.length > 0 && (
              <ul className="game-recent">
                {recent.map((p, i) => (
                  <li key={`${p.t}-${i}`}>
                    <span>Day {p.day}</span>
                    <span>{p.detail ?? formatScore(game, p.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="game-credit">{game.credit} · {game.license}</p>
        </aside>
      </div>
    </>
  )
}
