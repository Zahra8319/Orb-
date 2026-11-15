import type { CSSProperties } from 'react'
import { useWidth } from './useWidth'

interface Props {
  /** Current rate in beats per minute — sets the spacing between beats. */
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

/** A hospital-monitor rhythm strip: the ECG drawn at this person's heart rate. */
export function ECGStrip({ bpm, irregular = false, abnormal = false, height = 44 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(240)
  const rate = Math.max(30, Math.min(220, bpm))
  const pxPerSec = width / 5 // a five-second strip, like a bedside monitor
  const interval = (60 / rate) * pxPerSec
  const y0 = height * 0.72
  const amp = Math.min(y0 - 4, (height - 4 - y0) / 0.24)

  const parts = [`M0 ${r(y0)}`]
  let x = 0
  let beats = 0
  while (x < width + interval) {
    const w = irregular ? interval * (0.72 + 0.56 * hash(beats)) : interval
    parts.push(beat(x, w, amp, y0))
    x += w
    beats += 1
  }

  // A regular rhythm scrolls left at real speed, the way a monitor redraws.
  const scrolling = !irregular && beats > 2
  const style: CSSProperties | undefined = scrolling
    ? ({ '--ecg-shift': `${r(-interval)}px`, '--ecg-dur': `${r((interval / pxPerSec) * 1000) / 1000}s` } as CSSProperties)
    : undefined

  return (
    <div className="chart ecg" ref={ref} aria-hidden="true">
      <svg width={width} height={height}>
        <path
          className={scrolling ? 'ecg-scroll' : undefined}
          style={style}
          d={parts.join(' ')}
          fill="none"
          stroke={abnormal ? 'var(--urgent)' : 'var(--series-1)'}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
