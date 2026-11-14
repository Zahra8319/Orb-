import { Link } from 'react-router-dom'
import { Readout, Section } from '../../components/bits'
import { THRESHOLDS } from '../../rules/alerts'
import { CAREER_LIMIT_MSV } from '../../sim/mission'
import { stormHoursLeft } from '../../sim/model'
import { useFleet } from '../../store/hooks'
import { useStore } from '../../store/store'

/** What the whole crew shares: the air they breathe and the radiation outside. */
export function Ship() {
  const fleet = useFleet()
  const scenarios = useStore((s) => s.scenarios)
  const sheltered = useStore((s) => s.sheltered)
  const snap = fleet.crew[0].snap
  const { cabin } = snap
  const factor = snap.doseRate / snap.baseDoseRate
  const storm = stormHoursLeft(fleet.asOf, scenarios)
  const shipAlert = (id: string) => fleet.alerts.find((a) => a.id === id)?.level ?? null

  const roster = [...fleet.crew].sort((a, b) => b.snap.careerDose - a.snap.careerDose)

  return (
    <>
      <h1 className="page-title">Ship and radiation</h1>
      <p className="page-intro">The cabin and the space weather are the same for everyone on board, so a problem here is a problem for the whole crew.</p>

      <Section title="Cabin air">
        <div className="readouts">
          <Readout
            label="Carbon dioxide"
            value={cabin.co2.toFixed(1)}
            unit="mmHg"
            note={`target is under ${THRESHOLDS.co2.watch}`}
            level={shipAlert('co2')}
          />
          <Readout
            label="Oxygen"
            value={cabin.o2.toFixed(1)}
            unit="kPa"
            note={`normal is ${THRESHOLDS.o2.watch} to 23`}
            level={shipAlert('o2')}
          />
          <Readout label="Pressure" value={cabin.pressure.toFixed(1)} unit="kPa" />
          <Readout label="Temperature" value={cabin.temperature.toFixed(1)} unit="°C" />
          <Readout label="Humidity" value={cabin.humidity} unit="%" />
          <Readout label="Noise" value={cabin.noise} unit="dBA" />
        </div>
      </Section>

      <Section
        title="Space weather"
        note={
          storm > 0
            ? `Solar storm under way, about ${Math.ceil(storm)} hours left. ${sheltered ? 'The crew has reported being in the storm shelter.' : 'The crew has not reported being in the storm shelter.'}`
            : 'No solar storm. The dose rate is the usual background from galactic cosmic rays.'
        }
      >
        <div className="readouts">
          <Readout
            label="Dose rate"
            value={snap.doseRate.toFixed(1)}
            unit="mSv/day"
            note={factor > 1.5 ? `${Math.round(factor)} times normal` : 'normal'}
            level={shipAlert('solar-storm')}
          />
          <Readout label="Storm shelter" value={sheltered ? 'In use' : 'Empty'} level={storm > 0 && !sheltered ? 'urgent' : null} />
        </div>
      </Section>

      <Section title="Radiation dose by crew member" note={`Career limit is ${CAREER_LIMIT_MSV} mSv. Earlier flights count toward it.`}>
        <table className="mc-table">
          <thead>
            <tr>
              <th scope="col">Crew member</th>
              <th scope="col">This mission</th>
              <th scope="col">Career</th>
              <th scope="col">Of the limit</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(({ crew, snap: s }) => {
              const share = s.careerDose / CAREER_LIMIT_MSV
              return (
                <tr key={crew.id}>
                  <th scope="row">
                    <Link to={`/admin/crew/${crew.id}`}>{crew.name}</Link>
                  </th>
                  <td>{Math.round(s.missionDose)} mSv</td>
                  <td>{Math.round(s.careerDose)} mSv</td>
                  <td>
                    <span className="mc-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, share * 100)}%` }} data-high={share >= THRESHOLDS.careerDoseShare || undefined} />
                    </span>
                    {Math.round(share * 100)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>
    </>
  )
}
