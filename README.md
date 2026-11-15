# Orb+

**A personal health monitor for astronauts on the way to Mars.**

Orb+ is our entry for the NASA Space Apps 2026 challenge
[*Create Health Monitoring Software for Astronauts on Space Missions*](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).
Each crew member signs in to their own health: heart, sleep, radiation dose, exercise, cabin air and spacesuit, in
one calm view. When something drifts, Orb says what it saw and what to do, because Earth can be twenty minutes away
by radio.

> Orb+ is a prototype. Every reading is simulated in the browser; there is no backend, no real sensor data, and it is
> not a medical device.

## Try it

```bash
cd app
npm ci
npm run dev        # http://localhost:5173
```

- **Front page:** `http://localhost:5173/#/welcome`, a scroll-driven hero that leads to sign-in.
- **Sign in:** pick one of the demo crew on the sign-in screen. The password is not checked.
- **Mission Control:** `http://localhost:5173/#/admin`, the Earth-side roster of missions and crew.
- **Demo controls:** the button in the footer of every crew screen. Speed up time, pause it, reset the demo, and
  trigger events such as a solar storm, a CO2 scrubber fault or an irregular heart rhythm to see the alerts respond.

| Demo crew | Email | Role |
|---|---|---|
| Amara Okafor | `amara.okafor@orb.mission` | Commander (also sees the Command dashboard) |
| Jonas Lindqvist | `jonas.lindqvist@orb.mission` | Flight engineer |
| Sofia Reyes | `sofia.reyes@orb.mission` | Medical officer |
| Kenji Tanaka | `kenji.tanaka@orb.mission` | Mission scientist |

The mission is a 210-day Mars transit with a crew of four. Each person has their own baselines (resting heart rate,
sleep need, reaction time, prior radiation dose), so the same day looks different for each of them.

## What is inside

The screens follow NASA's five hazards of human spaceflight.

| Screen | NASA hazard | What it shows |
|---|---|---|
| Today | All five | A 24-hour day ring, live vitals and ECG, what needs you today, trends since launch |
| Body | Gravity fields | Exercise against the plan, estimated bone and muscle change, resting heart rate, eye checks |
| Sleep and mind | Isolation and confinement | Sleep and sleep owed, body clock, a daily mood check-in, a reaction-time test, readings from games |
| Radiation | Space radiation | Career dose against the 600 mSv limit, cabin dose rate, storm shelter guidance |
| Ship and Earth | Hostile environments, distance from Earth | Cabin air, the radio delay to Earth |
| Consult Earth | Distance from Earth | Medical questions to the flight surgeon, answered after the light-time delay |
| EVA Monitor | Hostile environments | Pre-spacewalk checklist, live suit physiology, abort criteria |
| Scenarios | — | Inject clinical and environmental events for training or a demo |
| Games | Isolation and confinement | Ten short games for breaks between tasks |
| Command | — | The commander's view of all four crew, most urgent first |
| Sources | — | The NASA and CSA pages behind what Orb measures |

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
  moods and messages. "Reset demo" clears it.
- **Charts** (`app/src/charts/`) are hand-built SVG, each with a table view for screen readers.
- **Design.** NASA blue `#0B3D91`, NASA red `#FC3D21`, white and grey, in `app/src/styles/tokens.css`. Red is kept
  for urgent alerts.

Built with React 19, TypeScript, Vite, Tailwind CSS, Zustand and d3-shape; tested with Vitest.

## Repository

| Path | What it is |
|---|---|
| [`app/`](app/) | The Orb+ web app ([app README](app/README.md)) |
| [`space-health-resources/`](space-health-resources/) | Material scraped from the challenge's Resources tab and the NASA/CSA pages it links to (about 127 MB) |
| [`scripts/spaceapps-scraper/`](scripts/spaceapps-scraper/) | The scraper that collected it |
| [`vercel.json`](vercel.json) | Deploy settings: installs and builds in `app/`, serves `app/dist` |

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
- Orb+ uses NASA's colours but is not affiliated with or endorsed by NASA, and does not use the NASA insignia.
