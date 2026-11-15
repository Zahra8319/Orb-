# Orb+

**A personal health monitor for astronauts on long deep-space missions.**

Orb+ is our entry for the NASA Space Apps 2026 challenge
[*Create Health Monitoring Software for Astronauts on Space Missions*](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).
Each crew member signs in to their own health: heart, sleep, radiation dose, exercise, cabin air and spacesuit, in
one calm view. When something drifts, Orb says what it saw and what to do, because Earth can be twenty minutes away
by radio.

> Orb+ is a prototype. The crew's readings are simulated in the browser; there is no backend, no real sensor data, and
> it is not a medical device. Two parts talk to outside services: the Radiation screen reads recent solar particle
> events from NASA DONKI, and the optional AI advisor can ask a Groq-hosted model.

**Live demo:** [orbplus.vercel.app](https://orbplus.vercel.app/welcome)

## Try it

```bash
cd app
npm ci
npm run dev        # http://localhost:5173
```

- **Front page:** `http://localhost:5173/welcome`, a scroll-driven hero with links to sign in and to Mission Control.
- **Sign in:** pick one of the demo crew on the sign-in screen. The password is not checked.
- **Mission Control:** `http://localhost:5173/admin`, also linked from the front page. The Earth side: missions, crew
  roster, and messages with each crew member that cross the same radio delay as everything else. No sign-in needed.
- **Demo controls:** the button in the footer of every crew screen. Speed up time, reset the demo, and start events
  to see the alerts respond: a solar storm, a CO2 scrubber fault, an irregular heart rhythm, a week of short sleep or
  missed exercise. The clinical case files (appendicitis, kidney stone and others) are there too; they add a full
  write-up for training but do not change the readings.

| Demo crew | Email | Role |
|---|---|---|
| Amara Okafor | `amara.okafor@orb.mission` | Commander (also sees the Command dashboard) |
| Jonas Lindqvist | `jonas.lindqvist@orb.mission` | Flight engineer |
| Sofia Reyes | `sofia.reyes@orb.mission` | Medical officer |
| Kenji Tanaka | `kenji.tanaka@orb.mission` | Mission scientist |

The mission is a 210-day deep-space transit with a crew of four. Each person has their own baselines (resting heart rate,
sleep need, reaction time, prior radiation dose), so the same day looks different for each of them.

## What is inside

The screens follow NASA's five hazards of human spaceflight.

| Screen | NASA hazard | What it shows |
|---|---|---|
| Today | All five | A 24-hour day ring, live vitals and ECG, what needs you today, trends since launch |
| Body | Gravity fields | Blood glucose and nutrition logs, exercise against the plan, estimated bone and muscle change, resting heart rate, eye checks |
| Sleep and mind | Isolation and confinement | Sleep and sleep owed, body clock, a daily mood check-in, a reaction-time test, readings from games |
| Radiation | Space radiation | Career dose against the 600 mSv limit, cabin dose rate, storm shelter guidance, real solar particle events from NASA DONKI over the last 30 days |
| Ship and Earth | Hostile environments, distance from Earth | Cabin air, the radio delay, messages with the flight surgeon and Mission Control |
| Consult Earth | Distance from Earth | Medical questions to the flight surgeon, answered after the light-time delay |
| EVA Monitor | Hostile environments | Pre-spacewalk checklist, live suit physiology, abort criteria |
| Scenarios | — | Start live events (they change readings and alerts) or open clinical case files for training |
| Games | Isolation and confinement | Ten short games for breaks between tasks |
| Command | — | The commander's view of all four crew, most urgent first |
| Sources | — | The NASA and CSA pages behind what Orb measures |
| Orb Medical | — | The button on every crew screen: onboard protocols matched to your alerts, plus optional AI answers |

**Games.** Reaction Rush and Simon Says also count toward Sleep and mind as reaction and memory readings. Games you can
lose ease off after a losing streak and harden again as you win; see
[`app/src/games/ASSIST.md`](app/src/games/ASSIST.md).

**Sleep shift.** Two hours before each crew member's bedtime the whole app dims to a deep-blue theme, games included.

## How it works

- **Simulator** (`app/src/sim/`). Every value is a pure function of crew member, mission time and active scenarios, so
  the demo and the tests always see the same numbers.
- **Alert rules** (`app/src/rules/alerts.ts`). Each alert has a threshold, a level (watch, act, urgent) and the action
  to take. A crew member's own entries (reaction tests, eye checks, the storm shelter switch) feed their alerts, on
  their own screens and on Command alike.
- **Saved in the browser.** The demo survives a page reload: mission clock, scenarios, test results, game rounds,
  moods, glucose and nutrition logs, messages and each crew member's consultations. "Reset demo" clears it.
- **Orb Medical** (`app/src/components/AIAdvisor.tsx`). Matches your alerts and what you type to onboard protocols,
  with no network needed. With `VITE_GROQ_API_KEY` set in `app/.env` it also asks a Groq-hosted model about anything
  the protocols do not cover, and labels those answers as AI-generated. Vite builds that key into the JavaScript sent
  to every visitor, so use it for local demos only and leave it unset on a public deployment.
- **NASA data** (`app/src/services/`). The Radiation screen fetches solar particle events from the
  [NASA DONKI API](https://ccmc.gsfc.nasa.gov/tools/DONKI/) and shows any from the last 30 days; if the request fails,
  the rest of the screen still works. The alert rules carry references to NASA OSDR studies and NTRS reports, and
  the Curiosity RAD cruise measurement (1.8 mSv a day) sets the simulated cabin dose rate.
- **Phones.** On a phone the screens are reached from a bottom tab bar with a More sheet, and Orb Medical opens full
  screen.
- **Installable.** A web app manifest lets the app be added to a home screen.
- **Charts** (`app/src/charts/`) are hand-built SVG, each with a table view for screen readers.
- **Design.** NASA blue `#0B3D91`, NASA red `#FC3D21`, white and grey, in `app/src/styles/tokens.css`. Red is kept
  for urgent alerts.

Built with React 19, TypeScript, Vite, Tailwind CSS, Zustand and d3-shape; tested with Vitest.

## Repository

| Path | What it is |
|---|---|
| [`app/`](app/) | The Orb+ web app ([app README](app/README.md)) |
| [`OrbPLUS.pptx`](OrbPLUS.pptx) | The team's presentation |
| [`space-health-resources/`](space-health-resources/) | Material scraped from the challenge's Resources tab and the NASA/CSA pages it links to (about 127 MB) |
| [`scripts/spaceapps-scraper/`](scripts/spaceapps-scraper/) | The scraper that collected it |
| [`vercel.json`](vercel.json) | Deploy settings when the Vercel project root is the repo: builds in `app/`, serves `app/dist`, sends every route to the app |
| [`app/vercel.json`](app/vercel.json) | The same when the Vercel project's Root Directory is set to `app` |

## Checks

```bash
cd app
npm test           # simulator, alert rules, games, saved demo
npx tsc -b         # type-check
npm run lint
npm run build      # production build in app/dist
```

## Credits

- Mission data and what to measure: NASA Human Research Program and the Canadian Space Agency, via the challenge's
  resources. Their content belongs to them; see the Sources screen for each page.
- Five games (Lights Out, Simon Says, Tower of Hanoi, Connect Four, Nonogram) are by mashukui under the MIT License;
  see [`app/public/games/LICENSES.md`](app/public/games/LICENSES.md). The other five were made for Orb.
- The front-page hero footage is AI generated.
- The mobile sign-in photos `cipher-spacewalk`, `dyson` and `iss069e018537-1` are NASA images (the first two from
  the challenge resources' NASA pages).
- Orb+ uses NASA's colours but is not affiliated with or endorsed by NASA, and does not use the NASA insignia.
