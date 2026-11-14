import { useEffect, useRef, useState } from 'react'

const TRIALS = 5

type Phase = 'idle' | 'wait' | 'go' | 'early' | 'done'

interface Props {
  baselineMs: number
  onResult: (meanMs: number, falseStarts: number) => void
}

/** A short reaction-time test: wait for the panel to change colour, then tap as fast as you can. */
export function ReactionTest({ baselineMs, onResult }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [times, setTimes] = useState<number[]>([])
  const [falseStarts, setFalseStarts] = useState(0)
  const shownAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function arm() {
    setPhase('wait')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        shownAt.current = performance.now()
        setPhase('go')
      },
      1800 + Math.random() * 3200,
    )
  }

  function press() {
    if (phase === 'idle' || phase === 'done') {
      setTimes([])
      setFalseStarts(0)
      arm()
      return
    }
    if (phase === 'wait') {
      window.clearTimeout(timer.current)
      setFalseStarts((n) => n + 1)
      setPhase('early')
      timer.current = window.setTimeout(arm, 1400)
      return
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - shownAt.current)
      const next = [...times, ms]
      setTimes(next)
      if (next.length >= TRIALS) {
        const mean = Math.round(next.reduce((a, b) => a + b, 0) / next.length)
        setPhase('done')
        onResult(mean, falseStarts)
      } else {
        arm()
      }
    }
  }

  const mean = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
  const diff = mean !== null ? Math.round((mean / baselineMs - 1) * 100) : 0

  let big: string
  let small: string
  if (phase === 'idle') {
    big = 'Start the test'
    small = `${TRIALS} rounds. Tap the moment this panel turns blue.`
  } else if (phase === 'wait') {
    big = 'Wait'
    small = `Round ${times.length + 1} of ${TRIALS}`
  } else if (phase === 'go') {
    big = 'Tap'
    small = `Round ${times.length + 1} of ${TRIALS}`
  } else if (phase === 'early') {
    big = 'Too soon'
    small = 'Wait for the panel to turn blue. This round restarts.'
  } else {
    big = `${mean} ms`
    small =
      diff > 0
        ? `${diff}% slower than your ${baselineMs} ms before launch. Tap to test again.`
        : `${Math.abs(diff)}% faster than your ${baselineMs} ms before launch. Tap to test again.`
  }

  return (
    <div className="pvt">
      <button
        type="button"
        className="pvt-pad"
        data-phase={phase}
        onPointerDown={(e) => {
          e.preventDefault()
          press()
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault()
            press()
          }
        }}
      >
        <span className="pvt-big" aria-live="assertive">
          {big}
        </span>
        <span>{small}</span>
      </button>
      <div className="pvt-foot">
        <span>{times.length ? `Rounds: ${times.map((ms) => `${ms} ms`).join(', ')}` : 'Works with a tap, the space bar or Enter.'}</span>
        <span>{falseStarts > 0 ? `${falseStarts} early ${falseStarts === 1 ? 'tap' : 'taps'}` : ''}</span>
      </div>
    </div>
  )
}
