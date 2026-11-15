# Orb+ app

The Orb+ web app: React 19, TypeScript, Vite, Tailwind CSS, Zustand and d3-shape, tested with Vitest. Everything is
simulated in the browser; there is no backend.

What the app does, the screens, the demo crew and how it is built are in the [root README](../README.md).

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # simulator, alert rules, games, saved demo
npx tsc -b         # type-check
npm run lint
npm run build      # production build in dist/
```

Optional: copy `.env.example` to `.env` to turn on AI answers in Orb Medical. Read the note in that file first.

## Where things are

| Path | What it is |
|---|---|
| `src/sim/` | The deterministic simulator: crew, mission clock, vitals, cabin, radiation, scenarios |
| `src/rules/alerts.ts` | Alert rules and thresholds |
| `src/store/` | Saved demo state, session and hooks |
| `src/screens/` | One file per screen, including Mission Control (`Admin.tsx`) |
| `src/charts/` | Hand-built SVG charts, each with a table view |
| `src/games/` and `public/games/` | The games catalogue and the games themselves |
| `src/styles/tokens.css` | Design tokens: NASA blue, NASA red, white and grey |
| `scripts/` | Image compression and app icon generation |
