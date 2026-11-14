import { useEffect, useRef } from 'react'

/**
 * Occasional shooting stars across the whole screen, and what a black hole
 * does to them.
 *
 * They all fall from one direction, the way a real meteor shower streams out
 * of one point in the sky. Given the black hole's camera (`hole`), each one is
 * also pulled toward it: passing close, its path bends round the hole and its
 * trail follows the curve; falling in, it speeds up and stretches, reddens and
 * dims as it nears the shadow, and is swallowed at the shadow's edge with a
 * brief flash while its trail drains in after it. Trails are never drawn over
 * the shadow itself.
 *
 * A cheap 2D canvas. Nothing is drawn when the reader asks for reduced motion,
 * and the loop stops while the tab is hidden.
 */

export interface HoleCamera {
  /** Where the hole sits, as fractions of width and height (same as the black hole's `focus`). */
  focus: [number, number]
  /** Vertical field of view in degrees (the black hole's `fov`). */
  fov: number
  /** Camera distance in horizon radii (the black hole's `distance`). */
  distance: number
}

export interface ShootingStarsProps {
  /** Average seconds between meteors. */
  every?: number
  /** Direction of travel in degrees, 0 = right, 90 = down. */
  angle?: number
  /** The black hole to bend meteors around. Omit for straight meteors. */
  hole?: HoleCamera
  /** Share of meteors aimed to pass close to the hole, 0 to 1. */
  aimed?: number
  className?: string
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  /** Recent head positions, newest last: the trail follows the real path. */
  trail: Array<[number, number]>
  length: number
  width: number
  age: number
  life: number
  /** Seconds since it crossed the shadow's edge, or -1. */
  swallowed: number
}

interface Flash {
  x: number
  y: number
  age: number
}

/** Radius of the black hole's shadow, in horizon radii: 3√3/2. */
const SHADOW = 2.598

export function ShootingStars({
  every = 1.6,
  angle = 152,
  hole,
  aimed = 0.35,
  className = '',
}: ShootingStarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const holeKey = hole ? `${hole.focus[0]},${hole.focus[1]},${hole.fov},${hole.distance}` : ''

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    /** Hole centre and shadow radius in CSS pixels; r = 0 means no hole. */
    let hx = 0
    let hy = 0
    let hr = 0
    /** Gravity, px³/s², set so a meteor skimming at two shadow radii turns about 30°. */
    let gm = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (hole) {
        // Same projection as the black hole's shader: screen offset per unit of
        // tan(angle) is height / (2 tan(fov/2)).
        const tanHalf = Math.tan(((hole.fov * Math.PI) / 180) / 2)
        const tanShadow = SHADOW / Math.sqrt(Math.max(1, hole.distance ** 2 - SHADOW ** 2))
        hx = hole.focus[0] * width
        hy = hole.focus[1] * height
        // Lensing makes the shadow look about 12% wider than its straight-line
        // projection; this matches the edge the black hole actually draws.
        hr = 1.12 * (tanShadow / (2 * tanHalf)) * height
        gm = 1.0 * hr * 1000 * 1000
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const meteors: Meteor[] = []
    const flashes: Flash[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    let untilNext = rand(0.3, 1.2)

    const spawn = () => {
      const a = ((angle + rand(-7, 7)) * Math.PI) / 180
      const speed = rand(700, 1300) * Math.max(0.6, Math.min(1.4, width / 1400))
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      let x: number
      let y: number
      if (hr > 0 && Math.random() < aimed) {
        // Keep the shower's direction but line the path up to pass the hole at
        // a chosen distance: some skim past and bend, some fall straight in.
        const miss = rand(-3.2, 3.2) * hr
        x = hx - dx * 10 + -dy * miss
        y = hy - dy * 10 + dx * miss
        // Walk back along the path until the start is just off screen.
        for (let i = 0; i < 400; i++) {
          if (x < -30 || x > width + 30 || y < -30 || y > height + 30) break
          x -= dx * 10
          y -= dy * 10
        }
      } else {
        // Enter from the edge the shower comes from: top, or the side it flies away from.
        const fromTop = Math.random() < width / (width + height)
        x = fromTop ? rand(0, width * 1.1) : dx < 0 ? width + 20 : -20
        y = fromTop ? rand(-40, height * 0.15) : rand(0, height * 0.55)
      }
      meteors.push({
        x,
        y,
        vx: dx * speed,
        vy: dy * speed,
        trail: [[x, y]],
        length: rand(110, 260),
        width: rand(1, 1.9),
        age: 0,
        // Aimed ones start off screen further away, so give them longer to arrive.
        life: rand(0.9, 1.6) + (hr > 0 ? 0.9 : 0),
        swallowed: -1,
      })
    }

    /** Pull toward the hole, in small steps so close passes stay smooth. */
    const move = (m: Meteor, dt: number) => {
      const steps = hr > 0 ? 4 : 1
      const h = dt / steps
      for (let s = 0; s < steps; s++) {
        if (hr > 0) {
          const rx = hx - m.x
          const ry = hy - m.y
          const r2 = rx * rx + ry * ry
          const r = Math.sqrt(r2)
          if (r <= hr) {
            m.swallowed = 0
            flashes.push({ x: m.x, y: m.y, age: 0 })
            return
          }
          const acc = gm / (r2 + hr * hr * 0.25)
          m.vx += (rx / r) * acc * h
          m.vy += (ry / r) * acc * h
        }
        m.x += m.vx * h
        m.y += m.vy * h
      }
    }

    /** Drop trail points beyond the trail's length, measured along the path. */
    const trim = (m: Meteor, maxLen: number) => {
      let len = 0
      for (let i = m.trail.length - 1; i > 0; i--) {
        const [ax, ay] = m.trail[i]
        const [bx, by] = m.trail[i - 1]
        len += Math.hypot(ax - bx, ay - by)
        if (len > maxLen) {
          m.trail.splice(0, i - 1)
          return
        }
      }
    }

    let raf = 0
    let last = 0
    let running = true

    const frame = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now

      untilNext -= dt
      if (untilNext <= 0) {
        spawn()
        // Now and then a second one close behind, as showers do.
        if (Math.random() < 0.3) setTimeout(() => running && spawn(), rand(120, 380))
        untilNext = rand(every * 0.4, every * 1.6)
      }

      ctx.clearRect(0, 0, width, height)
      ctx.save()
      if (hr > 0) {
        // Everything is drawn outside the shadow only.
        ctx.beginPath()
        ctx.rect(0, 0, width, height)
        ctx.arc(hx, hy, hr, 0, Math.PI * 2, true)
        ctx.clip('evenodd')
      }
      ctx.lineCap = 'round'

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.age += dt

        if (m.swallowed < 0) {
          move(m, dt)
          if (m.swallowed < 0) m.trail.push([m.x, m.y])
        }
        if (m.swallowed >= 0) m.swallowed += dt

        const t = m.age / m.life
        const drained = m.swallowed >= 0 ? Math.min(1, m.swallowed / 0.35) : 0
        if (t >= 1 || drained >= 1) {
          meteors.splice(i, 1)
          continue
        }

        // Flare in quickly, burn out slowly.
        let alpha = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88
        // Near the shadow: dimmer and redder, the way light climbing out of a
        // well loses energy.
        let heat = 1
        if (hr > 0) {
          const d = Math.hypot(m.x - hx, m.y - hy)
          heat = Math.max(0, Math.min(1, (d - hr) / (1.6 * hr)))
          alpha *= 0.7 + 0.3 * heat
        }
        alpha *= 1 - drained

        // Falling in it stretches: the trail grows with speed.
        const speed = Math.hypot(m.vx, m.vy)
        const stretch = Math.min(2.2, Math.max(1, speed / 1000))
        trim(m, m.length * stretch * (1 - drained) + 1)
        if (m.trail.length < 2) continue

        // Trail: newest segment brightest, fading to nothing at the tail. The
        // colour cools from warm white to orange, and to ember near the hole.
        const n = m.trail.length
        const headR = Math.round(255)
        const headG = Math.round(246 - 60 * (1 - heat))
        const headB = Math.round(228 - 120 * (1 - heat))
        for (let k = n - 1; k > 0; k--) {
          const f = k / (n - 1) // 1 at the head, 0 at the tail
          const [ax, ay] = m.trail[k]
          const [bx, by] = m.trail[k - 1]
          const g = Math.round(headG * f + 152 * (1 - f))
          const b = Math.round(headB * f + 56 * (1 - f))
          ctx.strokeStyle = `rgba(${headR}, ${g}, ${b}, ${alpha * f * f * 0.95})`
          ctx.lineWidth = m.width * (0.35 + 0.65 * f)
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.stroke()
        }

        if (m.swallowed < 0) {
          const r = m.width * 3.2
          const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r)
          glow.addColorStop(0, `rgba(${headR}, ${headG + 4}, ${headB + 12}, ${alpha})`)
          glow.addColorStop(1, `rgba(${headR}, ${headG}, ${headB}, 0)`)
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(m.x, m.y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Where a meteor crossed the edge: a short flare on the ring.
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]
        f.age += dt
        const k = f.age / 0.6
        if (k >= 1) {
          flashes.splice(i, 1)
          continue
        }
        const r = 8 + 30 * k
        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
        glow.addColorStop(0, `rgba(255, 236, 205, ${1 - k})`)
        glow.addColorStop(1, 'rgba(255, 152, 56, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // holeKey stands in for `hole`, so a new object with the same values does not restart the sky.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [every, angle, aimed, holeKey])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // `screen` adds the meteors' light to the disc behind instead of painting over it.
      className={`pointer-events-none fixed inset-0 h-full w-full mix-blend-screen ${className}`}
    />
  )
}
