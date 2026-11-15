import { useEffect, useRef } from 'react'
import { getAvailableScenarios } from '../sim/scenarios'
import { SPEEDS, useStore, type ThemeMode } from '../store/store'

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Follow the schedule' },
  { value: 'day', label: 'Day shift' },
  { value: 'sleep', label: 'Sleep shift' },
]

/** Controls for presenting the app: speed up time and trigger health events. */
export function DemoDrawer({ onClose }: { onClose: () => void }) {
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const scenarios = useStore((s) => s.scenarios)
  const toggleScenario = useStore((s) => s.toggleScenario)
  const themeMode = useStore((s) => s.themeMode)
  const setThemeMode = useStore((s) => s.setThemeMode)
  const resetDemo = useStore((s) => s.resetDemo)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside className="drawer" role="dialog" aria-label="Demo controls">
      <div className="drawer-head">
        <h2>Demo controls</h2>
        <button ref={closeRef} className="btn btn-quiet btn-small" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">These change the simulation so you can show how Orb responds. A real crew would not see this panel.</p>

      <h3>Time</h3>
      <div className="seg">
        {SPEEDS.map((s) => (
          <button key={s.label} className="btn btn-quiet btn-small" type="button" aria-pressed={speed === s.value} onClick={() => setSpeed(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      <h3>Health events</h3>
      <ul>
        {getAvailableScenarios().map((sc) => {
          const on = scenarios[sc.id as keyof typeof scenarios] !== null
          return (
            <li key={sc.id} className="scenario">
              <div>
                <b>{sc.name}</b>
                <span>{sc.description}</span>
              </div>
              <button className="btn btn-quiet btn-small" type="button" aria-pressed={on} onClick={() => toggleScenario(sc.id as any)}>
                {on ? 'Stop' : 'Start'}
              </button>
            </li>
          )
        })}
      </ul>

      <h3>Cabin lighting theme</h3>
      <div className="seg" style={{ gridTemplateColumns: '1fr' }}>
        {THEMES.map((th) => (
          <button key={th.value} className="btn btn-quiet btn-small" type="button" aria-pressed={themeMode === th.value} onClick={() => setThemeMode(th.value)}>
            {th.label}
          </button>
        ))}
      </div>

      <h3>Start over</h3>
      <button className="btn btn-small" type="button" onClick={resetDemo}>
        Reset to day 143, 09:40
      </button>
    </aside>
  )
}
