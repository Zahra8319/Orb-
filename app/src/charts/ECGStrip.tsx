import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useWidth } from './useWidth'

interface Props {
  /** Current rate in beats per minute - sets the spacing between beats. */
  bpm: number
  /** Irregular rhythm: beat intervals wobble, like an arrhythmia strip. */
  irregular?: boolean
  /** Alarm state: the trace turns red, the way a monitor changes colour. */
  abnormal?: boolean
  height?: number
}

/** Deterministic pseudo-random in [0, 1) so re-renders never jitter the trace. */
function hash(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const r = (n: number) => Math.round(n * 10) / 10

/** One beat: flat baseline, small P wave, sharp QRS spike, broad T wave. */
function beat(x: number, w: number, amp: number, y0: number): string {
  const p = (f: number) => r(x + f * w)
  return [
    `Q${p(0.1)} ${r(y0 - amp * 0.28)} ${p(0.2)} ${r(y0)}`, // P wave
    `L${p(0.26)} ${r(y0 + amp * 0.12)}`, // Q dip
    `L${p(0.33)} ${r(y0 - amp)}`, // R spike
    `L${p(0.4)} ${r(y0 + amp * 0.24)}`, // S trough
    `L${p(0.46)} ${r(y0)}`, // back to baseline
    `Q${p(0.6)} ${r(y0 - amp * 0.55)} ${p(0.76)} ${r(y0)}`, // T wave
    `L${p(1)} ${r(y0)}`, // flat until the next beat
  ].join(' ')
}

/**
 * A hospital-monitor rhythm strip. Like a bedside monitor in sweep mode, the
 * pen sweeps across the full width writing five seconds of rhythm at real
 * speed (5 s per pass), then wraps back to the left edge and keeps sweeping.
 */
export function ECGStrip({ bpm, irregular = false, abnormal = false, height = 44 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(240)
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLen, setPathLen] = useState(0)
  const rate = Math.max(30, Math.min(220, bpm))
  const pxPerSec = width / 5 // a five-second strip, like a bedside monitor
  const interval = (60 / rate) * pxPerSec
  const y0 = height * 0.72
  const amp = Math.min(y0 - 4, (height - 4 - y0) / 0.24)

  const parts = [`M0 ${r(y0)}`]
  let x = 0
  let beats = 0
  if (irregular) {
    while (x < width) {
      const w = interval * (0.72 + 0.56 * hash(beats))
      if (x + w > width) {
        parts.push(`L${r(width)} ${r(y0)}`)
        break
      }
      parts.push(beat(x, w, amp, y0))
      x += w
      beats += 1
    }
  } else {
    // Whole beats that fit exactly, so the trace fills the strip edge to edge.
    const n = Math.max(2, Math.round(width / interval))
    const w = width / n
    for (let i = 0; i < n; i += 1) {
      parts.push(beat(x, w, amp, y0))
      x += w
      beats += 1
    }
  }
  const wave = parts.join(' ')

  // Measure the path for the write-in animation.
  useEffect(() => {
    if (pathRef.current) setPathLen(pathRef.current.getTotalLength())
  }, [wave])

  const stroke = abnormal ? 'var(--urgent)' : 'var(--series-1)'
  const style = { '--ecg-pathlen': pathLen || undefined } as CSSProperties

  return (
    <div className="chart ecg" ref={ref} aria-hidden="true">
      <svg width={width} height={height}>
        <path
          ref={pathRef}
          className="ecg-wave"
          style={style}
          d={wave}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pen tip: sweeps the strip like a monitor cursor, wrapping with it. */}
        {pathLen > 0 && (
          <circle
            className="ecg-pen"
            r={3}
            fill={stroke}
            style={{
              offsetPath: `path('${wave}')`,
              offsetRotate: '0deg',
            } as CSSProperties}
          />
        )}
      </svg>
    </div>
  )
}
