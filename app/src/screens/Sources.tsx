const SOURCES: { feature: string; why: string; title: string; url: string }[] = [
  {
    feature: 'The five screens',
    why: 'Orb is organised around the five hazards NASA’s Human Research Program names for human spaceflight.',
    title: 'NASA: 5 Hazards of Human Spaceflight',
    url: 'https://www.nasa.gov/hrp/hazards/',
  },
  {
    feature: 'What each alert watches',
    why: 'The alert rules follow the specific health risks NASA lists for each hazard.',
    title: 'NASA: Risks of Human Spaceflight',
    url: 'https://www.nasa.gov/hrp/risks/',
  },
  {
    feature: 'Daily measures: activity, light, sleep, reaction test',
    why: 'These are the measures NASA collects from every crew member in its Spaceflight Standard Measures study.',
    title: 'NASA: Standard Measures',
    url: 'https://www.nasa.gov/reference/standard-measures/',
  },
  {
    feature: 'Radiation dose and neutron share',
    why: 'Neutrons make up about 30% of the radiation dose on the space station, and Canada is building a continuous neutron monitor.',
    title: 'Canadian Space Agency: Monitoring radiation for astronaut health',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  {
    feature: 'Radiation hazard',
    why: 'Background on why deep-space radiation is the hardest hazard to see.',
    title: 'NASA: Hazard, Space Radiation',
    url: 'https://www.nasa.gov/hrp/hazard-space-radiation/',
  },
  {
    feature: 'Radio delay and advice that does not wait for Earth',
    why: 'A Mars crew faces a delay of up to 20 minutes each way, so they must be able to act alone.',
    title: 'NASA: Hazard, Distance From Earth',
    url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/',
  },
  {
    feature: 'Exercise, bone and muscle',
    why: 'Bones and muscles weaken without gravity; daily exercise is the main countermeasure.',
    title: 'NASA: Risk of Spaceflight-Induced Bone Changes',
    url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/',
  },
  {
    feature: 'Eye checks',
    why: 'The structure of the eyes and brain can change in spaceflight.',
    title: 'NASA: Risk of Spaceflight Associated Neuro-ocular Syndrome',
    url: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/',
  },
  {
    feature: 'Sleep and body clock',
    why: 'Chronic sleep loss and irregular schedules affect crew health and safety.',
    title: 'NASA: Risk from Inadequate Sleep and Irregular Schedules',
    url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/',
  },
  {
    feature: 'Mood check-in',
    why: 'Isolation and confinement can take a toll on mental health over a long mission.',
    title: 'NASA: Hazard, Isolation and Confinement',
    url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/',
  },
  {
    feature: 'Cabin air',
    why: 'Temperature, pressure, lighting, noise and air quality all shape crew health in a closed spacecraft.',
    title: 'NASA: Hazard, Hostile/Closed Environments',
    url: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/',
  },
  {
    feature: 'Heart monitoring',
    why: 'Weightlessness changes how the heart and blood vessels work.',
    title: 'NASA: Risk of Cardiovascular Adaptations',
    url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/',
  },
]

export function Sources() {
  return (
    <>
      <h1 className="page-title">Sources</h1>
      <p className="page-intro">
        Every reading in Orb is simulated. What Orb measures, and why, comes from the NASA and Canadian Space Agency pages listed for the
        Space Apps challenge &ldquo;Create Health Monitoring Software for Astronauts on Space Missions&rdquo;. Orb is a hackathon entry. It
        is not a medical device and is not affiliated with or endorsed by NASA.
      </p>
      <section className="section">
        <h2 className="section-title">Where each part comes from</h2>
        <ul className="sources section-body">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <b>{s.feature}</b>
              <div>
                <p>{s.why}</p>
                <a className="link" href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="section">
        <h2 className="section-title">Numbers the simulation uses</h2>
        <p className="section-note">
          Dose rate in transit of about 1.8 mSv a day, from the radiation detector on NASA&rsquo;s Curiosity rover during its cruise to Mars.
          A career limit of 600 mSv, NASA&rsquo;s current standard. Bone loss of roughly 1 to 1.5% a month without exercise. A cabin CO2
          target of 3 mmHg. These are illustrative and should be checked against the primary sources before any real use.
        </p>
      </section>
    </>
  )
}
