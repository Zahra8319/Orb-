import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Orbit } from 'lucide-react'

import { useSession } from '@/store/session'

/** Where the astronaut sits across the frame (0 left, 1 right). Kept in view when the frame is cropped. */
const FOCUS_X = 0.68
/** The clip finishes a little before the end of the scroll, so the last beat holds on a still frame. */
const FRAMES_END = 0.92
/** How quickly the picture catches up with the scrollbar, per 60 Hz frame. 1 would be instant. */
const EASE = 0.18
/** Frames downloading at once. */
const PARALLEL = 8
/** Frames either side of the current position that are fetched before anything else. */
const AHEAD = 6

const FRAME_SETS = {
  lg: { dir: 'lg', count: 121 },
  sm: { dir: 'sm', count: 61 },
} as const

/** When each block of copy fades in and out, as a share of the hero's scroll. */
const BEATS = [
  { inFrom: -1, inTo: -0.5, outFrom: 0.2, outTo: 0.3, anchor: 0 },
  { inFrom: 0.36, inTo: 0.46, outFrom: 0.62, outTo: 0.72, anchor: 0.54 },
  { inFrom: 0.78, inTo: 0.88, outFrom: 2, outTo: 3, anchor: 1 },
] as const

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** 0 before `from`, 1 after `to`, eased in between. */
const ramp = (p: number, from: number, to: number) => {
  const t = clamp01((p - from) / (to - from))
  return t * t * (3 - 2 * t)
}

/**
 * Download order for the clip: a frame from every part of it first (every 16th,
 * then every 8th, 4th, 2nd), then the rest. Wherever the visitor scrolls, a frame
 * close to that point arrives within the first second or two, so the picture
 * follows the scrollbar from the start and only gets smoother as the gaps fill.
 */
function coarseToFine(count: number): number[] {
  const order: number[] = []
  const seen = new Set<number>()
  for (const step of [16, 8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i)
        order.push(i)
      }
    }
  }
  if (!seen.has(count - 1)) order.splice(1, 0, count - 1)
  return order
}

const frameSrc = (dir: string, i: number) =>
  `${import.meta.env.BASE_URL}hero/${dir}/f-${String(i + 1).padStart(3, '0')}.webp`

/**
 * Public front page. The hero is pinned while the page scrolls, and the scroll
 * position plays a short clip frame by frame: the astronaut turns to face you
 * as three blocks of copy pass.
 *
 * The clip is drawn to a canvas from still frames, which scrubs smoothly in
 * every browser (seeking a <video> does not). With reduced motion on, the
 * picture stays on its first frame and the copy only cross-fades.
 */
export function Landing() {
  const signedIn = useSession((s) => s.crewId)
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beatRefs = useRef<(HTMLDivElement | null)[]>([])
  const railRef = useRef<HTMLSpanElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = 'sleep'
    window.scrollTo(0, 0)
    return () => window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!track || !stage || !canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData
    const small = window.matchMedia('(max-width: 767px)').matches || saveData
    const { dir, count } = small ? FRAME_SETS.sm : FRAME_SETS.lg

    const frames: (HTMLImageElement | undefined)[] = new Array(count)
    let cancelled = false
    let raf = 0
    let target = 0
    let current = 0
    let wanted = 0
    let drawn = -1
    let beatShown = -1

    /** The loaded frame closest to `i`, so the picture never blanks while frames arrive. */
    const nearest = (i: number) => {
      for (let d = 0; d < count; d++) {
        if (frames[i - d]) return i - d
        if (frames[i + d]) return i + d
      }
      return -1
    }

    const draw = (force = false) => {
      const i = nearest(wanted)
      if (i < 0 || (i === drawn && !force)) return
      const img = frames[i]!
      const cw = canvas.width
      const ch = canvas.height
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (cw - w) * FOCUS_X, (ch - h) / 2, w, h)
      drawn = i
    }

    const render = () => {
      wanted = reduced ? 0 : Math.round(clamp01(current / FRAMES_END) * (count - 1))
      draw()

      let active = 0
      BEATS.forEach((b, i) => {
        const el = beatRefs.current[i]
        if (!el) return
        const fadeIn = ramp(current, b.inFrom, b.inTo)
        const fadeOut = ramp(current, b.outFrom, b.outTo)
        const opacity = fadeIn * (1 - fadeOut)
        el.style.opacity = opacity.toFixed(3)
        el.style.transform = reduced ? '' : `translate3d(0, ${((1 - fadeIn) * 28 - fadeOut * 28).toFixed(1)}px, 0)`
        el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none'
        if (current >= b.inFrom) active = i
      })
      if (railRef.current) railRef.current.style.transform = `scaleX(${current.toFixed(4)})`
      if (active !== beatShown && countRef.current) {
        countRef.current.textContent = `0${active + 1}`
        beatShown = active
      }
    }

    // Eases towards the scroll position at the same pace on 60 Hz and 120 Hz screens.
    let lastTime = 0
    const tick = (now: number) => {
      const dt = lastTime ? Math.min(now - lastTime, 100) : 16.7
      lastTime = now
      const gap = target - current
      const step = 1 - Math.pow(1 - EASE, dt / 16.7)
      current = reduced || Math.abs(gap) < 0.0005 ? target : current + gap * step
      render()
      if (current === target) {
        raf = 0
        lastTime = 0
      } else {
        raf = requestAnimationFrame(tick)
      }
    }

    const onScroll = () => {
      const rect = track.getBoundingClientRect()
      // The stage, not the window: on phones the window grows and shrinks as the
      // address bar slides, which would make the picture jump.
      const span = rect.height - stage.clientHeight
      target = span > 0 ? clamp01(-rect.top / span) : 0
      if (!raf) raf = requestAnimationFrame(tick)
      // Fetch the frames around where the visitor is now before anything else.
      if (!reduced) pump()
    }

    const resize = new ResizeObserver(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(stage.clientWidth * dpr)
      canvas.height = Math.round(stage.clientHeight * dpr)
      draw(true)
      onScroll()
    })
    resize.observe(stage)

    // Frames load coarse to fine, the ones near the current position first. With
    // reduced motion only the first is needed.
    const order = reduced ? [0] : coarseToFine(count)
    const requested = new Set<number>()
    let inFlight = 0
    let cursor = 0

    const nextFrame = (): number | undefined => {
      const at = Math.round(clamp01(target / FRAMES_END) * (count - 1))
      for (let d = 0; d <= AHEAD; d++) {
        for (const i of d ? [at + d, at - d] : [at]) {
          if (i >= 0 && i < count && !requested.has(i)) return i
        }
      }
      while (cursor < order.length && requested.has(order[cursor])) cursor++
      return order[cursor]
    }

    const pump = () => {
      while (!cancelled && inFlight < PARALLEL) {
        const i = reduced ? (requested.has(0) ? undefined : 0) : nextFrame()
        if (i === undefined) return
        requested.add(i)
        inFlight++
        const img = new Image()
        img.decoding = 'async'
        const done = () => {
          inFlight--
          pump()
        }
        img.onload = () => {
          if (cancelled) return
          frames[i] = img
          if (drawn < 0 || Math.abs(i - wanted) < Math.abs(drawn - wanted)) draw()
          done()
        }
        img.onerror = done
        img.src = frameSrc(dir, i)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      resize.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  /** Tabbing to a link in a block that is faded out scrolls that block into view. */
  const revealBeat = (i: number) => {
    const track = trackRef.current
    if (!track) return
    const span = track.offsetHeight - window.innerHeight
    const top = track.getBoundingClientRect().top + window.scrollY
    const p = clamp01((window.scrollY - top) / span)
    const b = BEATS[i]
    if (p < b.inTo || p > b.outFrom) window.scrollTo({ top: top + span * b.anchor })
  }

  const cta = signedIn ? { to: '/', label: 'Open Orb+' } : { to: '/login', label: 'Sign in' }

  return (
    <div className="landing">
      <header className="landing-bar">
        <Link to="/welcome" className="landing-mark" aria-label="Orb+ home">
          <span className="landing-mark-badge">
            <Orbit size={16} aria-hidden="true" />
          </span>
          <span>
            Orb<span className="wordmark-plus">+</span>
          </span>
        </Link>
        <Link to={cta.to} className="landing-btn landing-btn--ghost">
          {cta.label}
        </Link>
      </header>

      <main>
        <div className="hero-track" ref={trackRef}>
          <div className="hero-stage" ref={stageRef}>
            <canvas className="hero-canvas" ref={canvasRef} aria-hidden="true" />
            <div className="hero-scrim" aria-hidden="true" />

            <div className="hero-beats">
              <div
                className="hero-beat hero-beat--lead"
                ref={(el) => { beatRefs.current[0] = el }}
                onFocus={() => revealBeat(0)}
              >
                <p className="hero-eyebrow">Deep space · crew of four</p>
                <h1 className="hero-title">Know your body, all the way.</h1>
                <p className="hero-copy">
                  Orb+ is a personal health monitor for astronauts. Heart, sleep, radiation and suit, in one calm
                  view that is yours.
                </p>
                <div className="hero-actions">
                  <Link to={cta.to} className="landing-btn">
                    {cta.label}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                  <span className="hero-hint" aria-hidden="true">
                    <span className="hero-hint-line" />
                    Scroll
                  </span>
                </div>
              </div>

              <div
                className="hero-beat"
                ref={(el) => { beatRefs.current[1] = el }}
                onFocus={() => revealBeat(1)}
              >
                <p className="hero-eyebrow">Your signals</p>
                <h2 className="hero-title">Every signal, one view.</h2>
                <p className="hero-copy">
                  Heart rhythm, sleep, radiation dose and EVA readiness sit side by side, so a change is easy to
                  spot early.
                </p>
                <ul className="hero-tags">
                  <li>Body</li>
                  <li>Sleep &amp; Mind</li>
                  <li>Radiation</li>
                  <li>EVA</li>
                </ul>
              </div>

              <div
                className="hero-beat"
                ref={(el) => { beatRefs.current[2] = el }}
                onFocus={() => revealBeat(2)}
              >
                <p className="hero-eyebrow">Mission Control</p>
                <h2 className="hero-title">Earth stays in the loop.</h2>
                <p className="hero-copy">
                  Your flight surgeon sees the whole crew from Mission Control and can consult with you across the
                  delay.
                </p>
                <div className="hero-actions">
                  <Link to={cta.to} className="landing-btn">
                    {cta.label}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="hero-progress" aria-hidden="true">
              <span ref={countRef}>01</span>
              <span className="hero-progress-track">
                <span className="hero-progress-fill" ref={railRef} />
              </span>
              <span>03</span>
            </div>
          </div>
        </div>

        <section className="landing-more">
          <h2 className="landing-more-title">Built for the long way out.</h2>
          <dl className="landing-points">
            <div>
              <dt>Yours first</dt>
              <dd>Each crew member signs in to their own health. It is a personal view, not a crew scoreboard.</dd>
            </div>
            <div>
              <dt>Calm by default</dt>
              <dd>Red is kept for urgent alerts. Everything else stays quiet until it matters.</dd>
            </div>
            <div>
              <dt>Shown working</dt>
              <dd>Simulated telemetry and scripted scenarios show how Orb+ reacts when something changes.</dd>
            </div>
          </dl>
          <Link to={cta.to} className="landing-btn">
            {cta.label}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className="landing-foot">A NASA Space Apps 2026 project. Hero footage is AI generated.</p>
        </section>
      </main>
    </div>
  )
}
