# Games module

Games run in a frame at `/games/:id` (list at `/games`, nav link in `Shell.tsx`).
They talk to Orb through `public/games/orb-bridge.js`:

- **Up:** `OrbBridge.result(value, detail)` after each finished round. Orb stores it for the
  signed-in crew member (`gamePlays` in the store) and shows it on the game cards.
- **Down:** the day/sleep shift (the game is dimmed before bed) and an assist level.

## Catalog fields (`catalog.json`)

- `rules`: how to play, shown beside the game.
- `scoring`: what `value` means. `max` higher is better, `min` lower is better,
  `wins` 1 win / 0.5 draw / 0 loss, `count` one per puzzle solved. `format` uses `{v}`.
- `assist`: only on games you can lose. The second loss in a row raises the level (0 to 3)
  and two wins in a row lower it. `lossBelow` marks a weak points round as a loss. Full
  explanation in [ASSIST.md](ASSIST.md).
- `health`: results feed Sleep and mind (`health.ts`). `reaction`: five or more Reaction Rush
  taps in a day give a reaction reading (median), unless the reaction test was taken that day.
  `memory`: longest Simon Says sequence. Health games never get an assist.

## Adding a game

- Bundled: put files in `app/public/games/<id>/`, load `../orb-bridge.js`, call
  `OrbBridge.result(...)` when a round ends, and add an entry to `catalog.json` with
  `source: { "kind": "local", "path": "<id>/index.html" }`. Add the license to
  `app/public/games/LICENSES.md`. Games made for Orb also load `../orb-kit.css` and
  `../orb-kit.js` for the shared look, sounds and saved bests.
- Partner embed: sign the provider's publisher agreement first, add its host to
  `ALLOWED_EMBED_HOSTS` in `providers/resolve.ts`, then use `source: { "kind": "embed", ... }`.
  Embedded games cannot report results.

Only add games you have a license or partner agreement for.
