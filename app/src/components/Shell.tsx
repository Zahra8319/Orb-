import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CREW } from '../sim/crew'
import { MISSION_DAYS, commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../sim/mission'
import { useAlerts, useSimClock, useSleepShift } from '../store/hooks'
import { useSession } from '../store/session'
import { useStore } from '../store/store'
import { ClockText } from './bits'
import { DemoDrawer } from './DemoDrawer'
import { AIAdvisor } from './AIAdvisor'
import {
  BookOpen,
  ChevronDown,
  FlaskConical,
  Gamepad2,
  HeartPulse,
  LayoutGrid,
  Moon,
  MoreHorizontal,
  Orbit,
  Radiation,
  Satellite,
  Stethoscope,
  Sun,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

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

interface NavItem {
  to: string
  label: string
  /** Shorter label for the phone tab bar. */
  short?: string
  icon: LucideIcon
}

const CREW_NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/body', label: 'Body', icon: HeartPulse },
  { to: '/sleep', label: 'Sleep and mind', short: 'Sleep', icon: Moon },
  { to: '/radiation', label: 'Radiation', icon: Radiation },
  { to: '/ship', label: 'Ship and Earth', icon: Satellite },
  { to: '/consult', label: 'Consult Earth', icon: Stethoscope },
  { to: '/eva', label: 'EVA Monitor', icon: Orbit },
  { to: '/scenarios', label: 'Scenarios', icon: FlaskConical },
  { to: '/games', label: 'Games', icon: Gamepad2 },
]

const COMMANDER_NAV: NavItem[] = [...CREW_NAV, { to: '/command', label: 'Command', icon: Users }]

const SOURCES: NavItem = { to: '/sources', label: 'Sources', icon: BookOpen }

/** Tabs on the phone tab bar; everything else is in its More sheet. */
const PHONE_TABS = 4
/** Room kept for the More button when the top tabs do not all fit. */
const MORE_WIDTH = 120

/**
 * How many top tabs fit in the bar. Measures a hidden copy of every label, so
 * it follows the real font and width instead of guessing per breakpoint.
 */
function useFittingTabs(count: number, enabled: boolean) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(count)
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const measure = measureRef.current
    if (!enabled || !wrap || !measure) return
    const update = () => {
      const widths = [...measure.children].map((el) => (el as HTMLElement).offsetWidth)
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 0
      const total = (n: number) => widths.slice(0, n).reduce((a, w) => a + w + gap, 0)
      const room = wrap.clientWidth
      if (total(widths.length) <= room) return setFit(widths.length)
      let n = widths.length - 1
      while (n > 1 && total(n) + MORE_WIDTH > room) n--
      setFit(n)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [count, enabled])
  return { wrapRef, measureRef, fit }
}

function isActive(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

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
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = sleepShift ? 'sleep' : 'day'
  }, [sleepShift])

  const crew = CREW.find((c) => c.id === crewId) ?? CREW[0]
  const isCommander = crew.role === 'Commander'
  const navItems = isCommander ? COMMANDER_NAV : CREW_NAV

  // Phones get a bottom tab bar plus a More sheet. Tablets and desktops keep the
  // top tabs, with a More menu once the tabs no longer fit.
  const isPhone = useMediaQuery('(max-width: 767px)')
  const { wrapRef, measureRef, fit: maxTop } = useFittingTabs(navItems.length, !isPhone)
  const visibleTabs = isPhone ? navItems.slice(0, PHONE_TABS) : navItems.slice(0, maxTop)
  const moreTabs = isPhone ? navItems.slice(PHONE_TABS) : navItems.slice(maxTop)
  const moreActive = moreTabs.some((n) => isActive(n.to, location.pathname))

  const top = alerts.find((a) => a.level !== 'watch')

  const closeMore = () => setMoreOpen(false)

  // The More menu closes on a route change, on Escape, and on a tap outside it.
  const [menuPath, setMenuPath] = useState(location.pathname)
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname)
    setMoreOpen(false)
  }
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (!isPhone && moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [moreOpen, isPhone])

  return (
    <>
      <header className="topbar">
        <div className="page topbar-inner">
          <Link className="wordmark" to="/" aria-label="Orb, go to Today">
            Orb<span className="wordmark-plus">+</span>
          </Link>
          {!isPhone && (
            <div className="nav-wrap" ref={wrapRef}>
              <div className="nav nav-measure" ref={measureRef} aria-hidden="true">
                {navItems.map((n) => (
                  <span key={n.to}>{n.label}</span>
                ))}
              </div>
              <nav className="nav" aria-label="Main">
                {visibleTabs.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                    {n.label}
                  </NavLink>
                ))}
              </nav>
              {moreTabs.length > 0 && (
                <div className="nav-more" ref={moreRef}>
                  <button
                    type="button"
                    className={`nav-more-trigger${moreActive ? ' is-current' : ''}`}
                    aria-haspopup="true"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen(!moreOpen)}
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                    <span>More</span>
                    <ChevronDown size={14} aria-hidden="true" className={moreOpen ? 'open' : ''} />
                  </button>
                  {moreOpen && (
                    <div className="nav-more-panel">
                      {moreTabs.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-more-item" onClick={closeMore}>
                          {n.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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

      {isPhone && (
        <>
          <nav className="tabbar" aria-label="Main">
            {visibleTabs.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className="tabbar-item">
                <n.icon size={22} aria-hidden="true" />
                <span>{n.short ?? n.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              className={`tabbar-item${moreActive || moreOpen ? ' is-current' : ''}`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(!moreOpen)}
            >
              <LayoutGrid size={22} aria-hidden="true" />
              <span>More</span>
            </button>
          </nav>

          {moreOpen && (
            <div className="sheet-backdrop" onClick={closeMore}>
              <div
                className="sheet"
                role="dialog"
                aria-modal="true"
                aria-label="More screens"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sheet-head">
                  <h2>More</h2>
                  <button type="button" className="sheet-close" onClick={closeMore} aria-label="Close">
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <div className="sheet-grid">
                  {[...moreTabs, SOURCES].map((n) => (
                    <NavLink key={n.to} to={n.to} className="sheet-item">
                      <n.icon size={22} aria-hidden="true" />
                      <span>{n.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {drawer && <DemoDrawer onClose={() => setDrawer(false)} />}
      <AIAdvisor />
    </>
  )
}
