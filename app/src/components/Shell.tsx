import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CREW } from '../sim/crew'
import { MISSION_DAYS, commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../sim/mission'
import { useAlerts, useSimClock, useSleepShift } from '../store/hooks'
import { useSession } from '../store/session'
import { useStore } from '../store/store'
import { ClockText } from './bits'
import { DemoDrawer } from './DemoDrawer'
import { AIAdvisor } from './AIAdvisor'
import { MoreHorizontal, ChevronDown } from 'lucide-react'

/** Simple media query hook */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const handler = () => setMatches(media.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])
  return matches
}

const CREW_NAV = [
  { to: '/', label: 'Today' },
  { to: '/body', label: 'Body' },
  { to: '/sleep', label: 'Sleep and mind' },
  { to: '/radiation', label: 'Radiation' },
  { to: '/ship', label: 'Ship and Earth' },
  { to: '/consult', label: 'Consult Earth' },
  { to: '/eva', label: 'EVA Monitor' },
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/games', label: 'Games' },
]

const COMMANDER_NAV = [...CREW_NAV, { to: '/command', label: 'Command' }]

export function Shell() {
  useSimClock()
  const t = useStore((s) => s.t)
  const crewId = useStore((s) => s.crewId)
  const sheltered = useStore((s) => s.sheltered)
  const setSheltered = useStore((s) => s.setSheltered)
  const alerts = useAlerts()
  const sleepShift = useSleepShift()
  const [drawer, setDrawer] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const signOut = useSession((s) => s.signOut)
  const location = useLocation()
  const navRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = sleepShift ? 'sleep' : 'day'
  }, [sleepShift])

  const crew = CREW.find((c) => c.id === crewId) ?? CREW[0]
  const isCommander = crew.role === 'Commander'
  const navItems = isCommander ? COMMANDER_NAV : CREW_NAV

  // On mobile, show first 5 tabs, rest go in "More" dropdown
  // On desktop, show more tabs
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const MAX_VISIBLE_TABS = isMobile ? 5 : isTablet ? 8 : 10
  const visibleTabs = navItems.slice(0, MAX_VISIBLE_TABS)
  const moreTabs = navItems.slice(MAX_VISIBLE_TABS)

  const top = alerts.find((a) => a.level !== 'watch')

  const closeMore = () => setMoreOpen(false)

  return (
    <>
      <header className="topbar">
        <div className="page topbar-inner">
          <Link className="wordmark" to="/" aria-label="Orb, go to Today">
            Orb<span className="wordmark-plus">+</span>
          </Link>
          <nav className="nav" aria-label="Main" ref={navRef}>
            {visibleTabs.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={closeMore}>{n.label}</NavLink>
            ))}
            {moreTabs.length > 0 && (
              <div className="nav-more" role="menu">
                <button
                  className="nav-more-trigger"
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                  aria-label="More navigation items"
                  onClick={() => setMoreOpen(!moreOpen)}
                >
                  <MoreHorizontal size={18} aria-hidden="true" />
                  <span className="nav-more-label">More</span>
                  <ChevronDown size={14} aria-hidden="true" className={moreOpen ? 'open' : ''} />
                </button>
                {moreOpen && (
                  <div className="nav-more-panel" role="menu">
                    {moreTabs.map((n) => (
                      <NavLink
                        key={n.to}
                        to={n.to}
                        end={n.to === '/'}
                        className="nav-more-item"
                        role="menuitem"
                        onClick={closeMore}
                      >
                        {n.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
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
              <button className="btn" type="button" onClick={() => setSheltered(!sheltered)}>
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
            <strong>Day {dayOf(t)}</strong> of {MISSION_DAYS}, ship time <ClockText time={formatClock(minuteOfDay(t))} />
            {sleepShift ? ', sleep shift' : ''}
          </span>
          <span>
            Earth is <strong>{formatDelay(commsDelaySec(t))}</strong> away by radio
          </span>
        </div>

        <main>
          {/* Keyed by route so each screen enters with the same short rise. */}
          <div className="page-enter" key={location.pathname}>
            {/* Screens that load on demand keep the bar and footer on screen meanwhile. */}
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="footer">
          <span className="footer-actions">
            <Link className="link" to="/sources">
              Sources
            </Link>
            <button className="btn btn-quiet btn-small" type="button" onClick={() => setDrawer(true)} aria-expanded={drawer}>
              Demo controls
            </button>
            <button className="btn btn-quiet btn-small" type="button" onClick={signOut}>
              Sign out
            </button>
          </span>
        </footer>
      </div>

      {drawer && <DemoDrawer onClose={() => setDrawer(false)} />}
      <AIAdvisor />
    </>
  )
}
