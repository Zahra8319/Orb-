import { Link, useParams } from 'react-router-dom'
import { GameFrame } from '../games/GameFrame'
import { getGame, listCategories, listGames } from '../games/registry'
import '../games/games.css'

export function Games() {
  const games = listGames()
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Games</h1>
        <p className="page-intro">Short breaks between tasks. Pick one and play.</p>
      </header>
      {games.length === 0 ? (
        <p>No games yet.</p>
      ) : (
        listCategories().map((cat) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="games-cat">{cat}</h2>
            <ul className="games-grid">
              {games.filter((g) => g.category === cat).map((g) => (
                <li key={g.id} className="game-card">
                  <Link to={`/games/${g.id}`}>
                    <strong>{g.title}</strong>
                    <span>{g.description}</span>
                  </Link>
                </li>
              ))}
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
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">{game?.title ?? 'Game not found'}</h1>
        <p className="page-intro"><Link to="/games">Back to games</Link></p>
      </header>
      <div className="game-stage"><GameFrame id={id} /></div>
      {game && <p className="game-credit">{game.credit} · {game.license}</p>}
    </>
  )
}
