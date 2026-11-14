import { useEffect, useRef } from 'react'

/**
 * Occasional shooting stars across the whole screen.
 *
 * They all fall from one direction, the way a real meteor shower streams out
 * of one point in the sky, so the sky reads as one event rather than random
 * scratches. The trail fades from a warm white head to nothing, matching the
 * black hole's palette. A cheap 2D canvas: a handful of lines per frame.
 *
 * Nothing is drawn when the reader asks for reduced motion, and the loop
 * stops while the tab is hidden.
 */

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  width: number
  age: number
  life: number
}

export interface ShootingStarsProps {
  /** Average seconds between meteors. */
  every?: number
  /** Direction of travel in degrees, 0 = right, 90 = down. */
  angle?: number
  className?: string
}

export function ShootingStars({ every = 1.6, angle = 152, className = '' }: ShootingStarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const meteors: Meteor[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    let untilNext = rand(0.3, 1.2)

    const spawn = () => {
      // A small spread around the shower's direction.
      const a = ((angle + rand(-7, 7)) * Math.PI) / 180
      const speed = rand(700, 1300) * Math.max(0.6, Math.min(1.4, width / 1400))
      const vx = Math.cos(a) * speed
      const vy = Math.sin(a) * speed
      // Enter from the edge the shower comes from: top, or the side it flies away from.
      const fromTop = Math.random() < width / (width + height)
      const x = fromTop ? rand(0, width * 1.1) : vx < 0 ? width + 20 : -20
      const y = fromTop ? rand(-40, height * 0.15) : rand(0, height * 0.55)
      meteors.push({
        x,
        y,
        vx,
        vy,
        length: rand(110, 260),
        width: rand(1, 1.9),
        age: 0,
        life: rand(0.7, 1.4),
      })
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
        if (Math.random() < 0.3) setTimeout(spawn, rand(120, 380))
        untilNext = rand(every * 0.4, every * 1.6)
      }

      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.age += dt
        m.x += m.vx * dt
        m.y += m.vy * dt
        const t = m.age / m.life
        if (t >= 1) {
          meteors.splice(i, 1)
          continue
        }
        // Flare in quickly, burn out slowly.
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
        const speed = Math.hypot(m.vx, m.vy)
        const tailX = m.x - (m.vx / speed) * m.length * (0.4 + 0.6 * Math.min(1, t * 3))
        const tailY = m.y - (m.vy / speed) * m.length * (0.4 + 0.6 * Math.min(1, t * 3))

        const g = ctx.createLinearGradient(m.x, m.y, tailX, tailY)
        g.addColorStop(0, `rgba(255, 246, 228, ${0.95 * alpha})`)
        g.addColorStop(0.25, `rgba(255, 196, 128, ${0.45 * alpha})`)
        g.addColorStop(1, 'rgba(255, 152, 56, 0)')
        ctx.strokeStyle = g
        ctx.lineWidth = m.width
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(tailX, tailY)
        ctx.stroke()

        // The head: a soft point of light.
        const r = m.width * 3.2
        const h = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r)
        h.addColorStop(0, `rgba(255, 250, 240, ${alpha})`)
        h.addColorStop(1, 'rgba(255, 250, 240, 0)')
        ctx.fillStyle = h
        ctx.beginPath()
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
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
  }, [every, angle])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 h-full w-full ${className}`}
    />
  )
}
