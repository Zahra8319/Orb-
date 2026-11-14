import { DoseBar } from '../charts/DoseBar'
import { LineChart } from '../charts/LineChart'
import { Readout, Section } from '../components/bits'
import { CAREER_LIMIT_MSV, DOSE_PER_DAY_MSV, MIN_PER_DAY, MISSION_DAYS, NEUTRON_SHARE, formatClock, formatHours, minuteOfDay } from '../sim/mission'
import { doseRateAt, missionDose, stormHoursLeft } from '../sim/model'
import { useCrew, useSnapshot } from '../store/hooks'
import { useStore } from '../store/store'

export function Radiation() {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const sheltered = useStore((s) => s.sheltered)
  const setSheltered = useStore((s) => s.setSheltered)
  const snap = useSnapshot()

  const factor = snap.doseRate / snap.baseDoseRate
  const storm = factor > 5
  const hoursLeft = stormHoursLeft(t, scenarios)
  const daysLeft = Math.max(0, MISSION_DAYS - t / MIN_PER_DAY)
  const projected = snap.careerDose + daysLeft * DOSE_PER_DAY_MSV * crew.doseFactor
  const share = Math.round((snap.careerDose / CAREER_LIMIT_MSV) * 100)

  // Last 24 hours of cabin dose rate, one reading every 20 minutes.
  const rate = Array.from({ length: 73 }, (_, i) => {
    const at = t - (72 - i) * 20
    return { x: at, y: doseRateAt(at, scenarios) }
  })

  const since = Array.from({ length: 30 }, (_, i) => {
    const at = t - (29 - i) * MIN_PER_DAY
    return { x: at / MIN_PER_DAY, y: missionDose(crew, at, scenarios) + crew.priorDoseMsv }
  })

  return (
    <>
      <h1 className="page-title">Radiation</h1>
      <p className="page-intro">
        Outside Earth&rsquo;s magnetic field the dose builds every day and cannot be undone. Orb counts it against your career limit and
        tells you when to shelter.
      </p>

      <Section
        title="Your career dose"
        note={`You have used ${share}% of the ${CAREER_LIMIT_MSV} mSv career limit. At the current rate you will reach Mars at about ${Math.round(projected)} mSv.`}
      >
        <DoseBar prior={crew.priorDoseMsv} mission={snap.missionDose} projected={projected} limit={CAREER_LIMIT_MSV} />
      </Section>

      <Section title="In the cabin now">
        <div className="split">
          <div>
            <div className="readouts">
              <Readout
                big
                label="Dose rate"
                value={snap.doseRate.toFixed(1)}
                unit="mSv a day"
                note={storm ? `${Math.round(factor)} times normal` : 'normal for deep space'}
                level={storm ? (sheltered ? 'act' : 'urgent') : null}
              />
            </div>
            <dl className="facts" style={{ marginTop: 24 }}>
              <div>
                <dt>From neutrons, about {Math.round(NEUTRON_SHARE * 100)}% of the dose</dt>
                <dd>
                  {(snap.doseRate * NEUTRON_SHARE).toFixed(1)} <small>mSv a day</small>
                </dd>
              </div>
              <div>
                <dt>This mission so far</dt>
                <dd>
                  {Math.round(snap.missionDose)} <small>mSv</small>
                </dd>
              </div>
              <div>
                <dt>Earlier flights</dt>
                <dd>
                  {crew.priorDoseMsv} <small>mSv</small>
                </dd>
              </div>
            </dl>
            {storm && (
              <p style={{ marginTop: 24 }}>
                <button className="btn" onClick={() => setSheltered(!sheltered)}>
                  {sheltered ? 'I have left the shelter' : 'I am in the shelter'}
                </button>
                <span className="muted" style={{ display: 'block', marginTop: 8 }}>
                  The storm should ease in about {formatHours(hoursLeft)}.
                </span>
              </p>
            )}
          </div>
          <LineChart
            label="Cabin dose rate over the last 24 hours"
            series={[{ name: 'Dose rate', points: rate }]}
            xFormat={(x) => formatClock(minuteOfDay(x))}
            yFormat={(y) => `${y.toFixed(1)}`}
            xHeader="Ship time"
            yDomain={[0, Math.max(11, ...rate.map((p) => p.y)) * 1.08]}
            xTicks={[t - 1440, t - 960, t - 480, t]}
            refs={[{ y: DOSE_PER_DAY_MSV * 5, label: 'Shelter above 5 times normal', tone: 'urgent' }]}
            height={300}
          />
        </div>
      </Section>

      <Section title="Last 30 days" note="Career dose in mSv. It only ever goes up, so the slope is what matters.">
        <LineChart
          label="Career radiation dose over the last 30 days"
          series={[{ name: 'Career dose', points: since }]}
          xFormat={(x) => `Day ${Math.floor(x) + 1}`}
          yFormat={(y) => `${Math.round(y)}`}
          xHeader="Mission day"
          height={220}
        />
      </Section>
    </>
  )
}
