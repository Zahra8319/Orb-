import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { MISSION_DAYS, commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../sim/mission'
import { useAwaitingReply, useFleet, useSimClock } from '../store/hooks'
import { useSession } from '../store/session'
import { useStore } from '../store/store'

const NAV = [
  { to: '/admin', label: 'Crew' },
  { to: '/admin/ship', label: 'Ship and radiation' },
  { to: '/admin/messages', label: 'Messages' },
  { to: '/admin/simulation', label: 'Simulation' },
]

/** Mission Control: the flight surgeon on Earth, looking after the whole crew. */
export function AdminShell() {
  useSimClock()
  const fleet = useFleet()
  const t = useStore((s) => s.t)
  const earthDelay = useStore((s) => s.earthDelay)
  const signOut = useSession((s) => s.signOut)
  const viewAs = useSession((s) => s.viewAs)
  const navigate = useNavigate()
  const awaiting = useAwaitingReply().size

  useEffect(() => {
    // Mission Control is on Earth: day colours, and not "viewing as" anyone.
    document.documentElement.dataset.theme = 'day'
    document.title = 'Mission Control · Orb'
    viewAs(null)
    return () => {
      document.title = 'Orb'
    }
  }, [viewAs])

  return (
    <>
      <header className="topbar">
        <div className="page topbar-inner">
          <Link className="wordmark" to="/admin" aria-label="Orb Mission Control, go to Crew">
            Orb <span className="wordmark-sub">Mission Control</span>
          </Link>
          <nav className="nav" aria-label="Mission Control">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/admin'}>
                {n.label}
                {n.to === '/admin/messages' && awaiting > 0 && (
                  <span className="count" aria-label={`, ${awaiting} waiting for a reply`}>
                    {awaiting}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="page">
        <div className="statusline">
          <span>
            <strong>Day {dayOf(t)}</strong> of {MISSION_DAYS} to Mars, ship time {formatClock(minuteOfDay(t))}
          </span>
          <span>
            {earthDelay ? (
              <>
                Readings are <strong>{formatDelay(commsDelaySec(t))}</strong> old, the radio delay from the ship
                {' '}(as of {formatClock(minuteOfDay(fleet.asOf))})
              </>
            ) : (
              <>
                <strong>Live readings</strong>: radio delay switched off in Simulation
              </>
            )}
          </span>
        </div>

        <main>
          <Outlet />
        </main>

        <footer className="footer">
          <span>Simulated data for a NASA Space Apps entry. Not a medical device. Not affiliated with NASA.</span>
          <span className="footer-actions">
            <button
              className="btn btn-quiet btn-small"
              onClick={() => {
                signOut()
                navigate('/login', { replace: true })
              }}
            >
              Sign out
            </button>
          </span>
        </footer>
      </div>
    </>
  )
}
