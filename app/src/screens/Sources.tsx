const SOURCES: { feature: string; why: string; title: string; url: string }[] = [
  {
    feature: 'The five screens',
    why: 'Orb is organised around the five hazards NASAâ€™s Human Research Program names for human spaceflight.',
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
    why: 'A deep-space crew faces a delay of up to 20 minutes each way, so they must be able to act alone.',
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

const NUMBERS: { value: string; why: string; title: string; url: string }[] = [
  {
    value: 'Dose rate in transit: about 1.8 mSv a day',
    why: 'Average galactic cosmic ray dose equivalent measured by the radiation detector on the Curiosity rover during its cruise to deep space.',
    title: 'Southwest Research Institute: radiation exposure associated with deep-space transit',
    url: 'https://www.swri.org/press-release/swri-led-team-calculates-radiation-exposure-associated-trip-mars',
  },
  {
    value: 'Career radiation limit: 600 mSv',
    why: 'NASAâ€™s standard sets a career effective dose limit of 600 mSv for all astronauts.',
    title: 'NASA: Radiation Protection technical brief',
    url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf',
  },
  {
    value: 'Bone loss without countermeasures: 1 to 1.5% a month',
    why: 'Astronauts can lose up to 1.5% of bone mass each month in space.',
    title: 'Canadian Space Agency: The TBone studies',
    url: 'https://www.asc-csa.gc.ca/eng/sciences/tbone.asp',
  },
  {
    value: 'Cabin CO2 target: 3 mmHg',
    why: 'NASAâ€™s spaceflight standard limits the one-hour average CO2 level to 3 mmHg, after crews reported headaches at higher levels.',
    title: 'NASA Technical Reports Server: CO2 on the space station',
    url: 'https://ntrs.nasa.gov/citations/20150021777',
  },
]

export function Sources() {
  return (
    <>
      <h1 className="page-title">Sources</h1>
      <p className="page-intro">
        Every reading in Orb is simulated. What Orb measures, and why, comes from the NASA and Canadian Space Agency pages listed for the
        Space Apps challenge &ldquo;Create Health Monitoring Software for Astronauts on Space Missions&rdquo;.
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
        <ul className="sources section-body">
          {NUMBERS.map((n) => (
            <li key={n.url}>
              <b>{n.value}</b>
              <div>
                <p>{n.why}</p>
                <a className="link" href={n.url} target="_blank" rel="noreferrer">
                  {n.title}
                </a>
              </div>
            </li>
          ))}
        </ul>
        <p className="section-note" style={{ marginTop: 16 }}>
          The simulation uses these as round figures to make a believable demo. It is not a model of any real mission.
        </p>
      </section>
    </>
  )
}
