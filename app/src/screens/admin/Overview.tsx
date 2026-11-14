import { useFleet } from '../../store/hooks'
import { AlertList, CrewCard } from './parts'

/** Mission Control's first page: who needs the flight surgeon, and why. */
export function Overview() {
  const fleet = useFleet()
  const urgent = fleet.crew.filter((c) => c.worst === 'urgent').length
  const act = fleet.crew.filter((c) => c.worst === 'act').length
  const unseen = fleet.alerts.filter((a) => !a.seen).length

  const headline =
    urgent > 0
      ? `${urgent === 1 ? 'One crew member needs' : `${urgent} crew members need`} you now.`
      : act > 0
        ? `${act === 1 ? 'One crew member has' : `${act} crew members have`} something to act on today.`
        : 'The whole crew is well.'

  return (
    <>
      <h1 className="headline">{headline}</h1>
      <p className="headline-sub">
        {fleet.alerts.length === 0
          ? 'No alerts for anyone on board. Readings are within their normal ranges.'
          : unseen > 0
            ? `${unseen} alert${unseen === 1 ? '' : 's'} you have not seen yet. Each crew member already has the same guidance on board.`
            : 'You have seen every alert. Each crew member has the same guidance on board.'}
      </p>

      <section className="section" aria-labelledby="crew-title">
        <h2 className="section-title" id="crew-title">
          Crew
        </h2>
        <p className="section-note">Ordered by who needs attention most. Open a card for their full readings.</p>
        <div className="section-body mc-grid">
          {fleet.crew.map((s) => (
            <CrewCard key={s.crew.id} status={s} />
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="alerts-title">
        <h2 className="section-title" id="alerts-title">
          All alerts
        </h2>
        <p className="section-note">
          Most serious first. Marking one seen dims it here; it comes back if it gets worse.
        </p>
        <div className="section-body">
          <AlertList alerts={fleet.alerts} empty="No alerts for anyone on board." />
        </div>
      </section>
    </>
  )
}
