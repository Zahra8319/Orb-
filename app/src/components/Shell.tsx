import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { CREW } from '../sim/crew'
import { MISSION_DAYS, commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../sim/mission'
import { useAlerts, useSimClock, useSleepShift } from '../store/hooks'
import { useSession } from '../store/session'
import { useStore } from '../store/store'
import { DemoDrawer } from './DemoDrawer'

const NAV = [
  { to: '/', label: 'Today' },
  { to: '/body', label: 'Body' },
  { to: '/sleep', label: 'Sleep and mind' },
  { to: '/radiation', label: 'Radiation' },
  { to: '/ship', label: 'Ship and Earth' },
  { to: '/consult', label: 'Consult Earth' },
  { to: '/eva', label: 'EVA Monitor' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/command', label: 'Command' },
]

export function Shell() {
  useSimClock()
  const t = useStore((s) => s.t)
  const crewId = useStore((s) => s.crewId)
  const setCrew = useStore((s) => s.setCrew)
  const sheltered = useStore((s) => s.sheltered)
  const setSheltered = useStore((s) => s.setSheltered)
  const alerts = useAlerts()
  const sleepShift = useSleepShift()
  const [drawer, setDrawer] = useState(false)
  const signOut = useSession((s) => s.signOut)

  useEffect(() => {
    document.documentElement.dataset.theme = sleepShift ? 'sleep' : 'day'
  }, [sleepShift])

  const top = alerts.find((a) => a.level !== 'watch')

  return (
    <>
      <header className="topbar">
        <div className="page topbar-inner">
          <Link className="wordmark" to="/" aria-label="Orb, go to Today">
            Orb
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <label className="crew-pick">
            <span className="visually-hidden">Crew member</span>
            <select value={crewId} onChange={(e) => setCrew(e.target.value)}>
              {CREW.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {top && (
        <div className="alert-band" data-level={top.level} role="alert">
          <div className="page alert-band-inner">
            <div className="alert-band-text">
              <div className="alert-band-title">{top.title}</div>
              <div className="alert-band-action">{top.action}</div>
            </div>
            {top.id === 'solar-storm' && (
              <button className="btn" onClick={() => setSheltered(!sheltered)}>
                {sheltered ? 'I have left the shelter' : 'I am in the shelter'}
              </button>
            )}
            <Link className="btn btn-band-quiet" to={top.to}>
              See the readings
            </Link>
          </div>
        </div>
      )}

      <div className="page">
        <div className="statusline">
          <span>
            <strong>Day {dayOf(t)}</strong> of {MISSION_DAYS} to Mars, ship time {formatClock(minuteOfDay(t))}
            {sleepShift ? ', sleep shift' : ''}
          </span>
          <span>
            Earth is <strong>{formatDelay(commsDelaySec(t))}</strong> away by radio
          </span>
        </div>

        <main>
          <Outlet />
        </main>

        <footer className="footer">
          <span>Simulated data for a NASA Space Apps entry. Not a medical device. Not affiliated with NASA.</span>
          <span className="footer-actions">
            <Link className="link" to="/sources">
              Sources
            </Link>
            <button className="btn btn-quiet btn-small" onClick={() => setDrawer(true)} aria-expanded={drawer}>
              Demo controls
            </button>
            <button className="btn btn-quiet btn-small" onClick={signOut}>
              Sign out
            </button>
          </span>
        </footer>
      </div>

      {drawer && <DemoDrawer onClose={() => setDrawer(false)} />}
    </>
  )
}
