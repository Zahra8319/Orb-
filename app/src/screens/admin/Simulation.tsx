import { DemoControls } from '../../components/DemoDrawer'
import { formatDelay, commsDelaySec } from '../../sim/mission'
import { useStore } from '../../store/store'

/** The demo controls, as a Mission Control page. A real flight surgeon would not have this. */
export function Simulation() {
  const earthDelay = useStore((s) => s.earthDelay)
  const setEarthDelay = useStore((s) => s.setEarthDelay)
  const t = useStore((s) => s.t)

  return (
    <>
      <h1 className="page-title">Simulation</h1>
      <p className="page-intro">
        These change the simulated mission so you can show how Orb and Mission Control respond. They are for the
        demo; a real flight surgeon would not have them.
      </p>

      <div className="sim-panel">
        <h3>Radio delay</h3>
        <p className="muted">
          Mission Control normally sees the crew as they were {formatDelay(commsDelaySec(t))} ago, because that is how long
          the readings take to reach Earth. Switch it off to see everything live.
        </p>
        <div className="seg">
          <button className="btn btn-quiet btn-small" aria-pressed={earthDelay} onClick={() => setEarthDelay(true)}>
            Real radio delay
          </button>
          <button className="btn btn-quiet btn-small" aria-pressed={!earthDelay} onClick={() => setEarthDelay(false)}>
            Live, no delay
          </button>
        </div>

        <DemoControls showTheme={false} />
      </div>
    </>
  )
}
