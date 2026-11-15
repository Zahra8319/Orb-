# Games module (not connected yet)

Nothing here is imported by the app. To connect:

1. Add a route in `App.tsx`, e.g. `/games`, rendering a list from `listGames()`.
2. Add `/games/:id` rendering `<GameFrame id={id} />`.
3. Add a nav link in `Shell.tsx`.

## Adding a game
- Bundled: put files in `app/public/games/<id>/`, add entry to `catalog.json`
  with `source: { "kind": "local", "path": "<id>/index.html" }`, and add the license to `app/public/games/LICENSES.md`.
- Partner embed: sign the provider's publisher agreement first, add its host to
  `ALLOWED_EMBED_HOSTS` in `providers/resolve.ts`, then use `source: { "kind": "embed", ... }`.

Only add games you have a license or partner agreement for.
