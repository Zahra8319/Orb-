# Orb

A personal health monitor for astronauts on a Mars transit. Built for the NASA Space Apps 2026 challenge
"Create Health Monitoring Software for Astronauts on Space Missions".

Orb is a frontend-only app. Every reading is simulated in the browser; there is no backend and no real sensor data.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # simulator and alert-rule tests
npm run build    # production build in dist/
```

## What is in it

| Screen | NASA hazard | Shows |
|---|---|---|
| Today | all five | 24-hour day ring, live vitals, what needs you today, trends since launch |
| Body | Gravity fields | Exercise against the plan, estimated bone and muscle change, resting heart rate, eye checks |
| Sleep and mind | Isolation and confinement | Sleep, sleep owed, body clock, mood check-in, a working reaction-time test |
| Radiation | Space radiation | Career dose against the 600 mSv limit, cabin dose rate, solar storm shelter guidance |
| Ship and Earth | Hostile/closed environments, Distance from Earth | Cabin air, radio delay, delayed messages with the flight surgeon |

**Demo controls** (button in the footer) speed up time and trigger health events: a solar storm, a CO2 scrubber
fault, a week of short sleep, missed exercise and an irregular heart rhythm. Use them to show how the alerts respond.

## How it is built

- `src/sim/` is a deterministic simulator. Every value is a pure function of crew member, mission time and active
  scenarios, so the demo and the tests always see the same numbers.
- `src/rules/alerts.ts` holds the alert rules and their thresholds. Each alert states what was seen and what to do,
  because Earth can be 20 minutes away.
- `src/charts/` has hand-built SVG charts (day ring, line, bar, dose bar). Each chart has a table view.
- `src/styles/tokens.css` holds the design tokens. Colours are the NASA palette (NASA blue `#0B3D91`, NASA red
  `#FC3D21`, white, grey, plus the deep blue and cyan of NASA's web design system). Red is used only for urgent alerts.
  A dimmed "sleep shift" theme switches on two hours before the crew member's bedtime.

The numbers the simulation uses are illustrative; see the Sources page in the app.
