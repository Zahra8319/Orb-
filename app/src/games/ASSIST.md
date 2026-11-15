# Losing-streak assist

Orb's games are short breaks between tasks. Losing round after round turns a break into
a source of stress, which is the opposite of what they are for. The assist notices a
losing streak and quietly makes the game easier, then hands the difficulty back once the
player is winning again.

Code: [`assist.ts`](assist.ts) · tests: [`assist.test.ts`](assist.test.ts)

## The level

Each player has an **assist level from 0 to 3** for each game:

| Level | Meaning |
|---|---|
| 0 | Normal game |
| 1 | A little easier |
| 2 | Clearly easier |
| 3 | Easiest (the cap) |

The level is not stored. It is worked out every time by replaying that player's rounds of
that game, oldest first, with three counters: `level`, `losses` (current losing streak)
and `wins` (current winning streak). For each round:

- **Loss:** `losses` goes up by one and `wins` resets to 0. From the second loss in a row
  onward, every loss raises `level` by one, up to 3.
- **Win:** `wins` goes up by one and `losses` resets to 0. When `wins` reaches 2 and
  `level` is above 0, `level` drops by one and `wins` starts counting again from 0.
- **Draw:** nothing changes. A draw neither extends nor breaks a streak.

```ts
for (const o of outcomes) {
  if (o === 'loss') {
    losses++; wins = 0
    if (losses >= 2) level = Math.min(3, level + 1)
  } else if (o === 'win') {
    wins++; losses = 0
    if (wins >= 2 && level > 0) { level--; wins = 0 }
  }
}
```

### Why these rules

- **One loss is normal.** A single loss never changes anything, so the game is not
  patronising.
- **A streak is the signal.** The second loss in a row starts the climb, and each loss
  after it adds a step, so four losses in a row reach the easiest setting. A player cannot
  lose more than four rounds in a row at normal difficulty before the game is at its
  gentlest.
- **It eases off slowly.** Coming back down takes two wins in a row per step, twice as
  long as going up. One lucky win does not snap the game back to full strength.
- **Win/lose patterns stay put.** A player who alternates wins and losses never triggers
  it. That is a fair match, not a struggle.

### Worked example

| Round | Result | Losing streak | Winning streak | Level after |
|---|---|---|---|---|
| 1 | Loss | 1 | 0 | 0 |
| 2 | Loss | 2 | 0 | **1** |
| 3 | Loss | 3 | 0 | **2** |
| 4 | Win | 0 | 1 | 2 |
| 5 | Win | 0 | 0 (reset) | **1** |
| 6 | Loss | 1 | 0 | 1 |
| 7 | Loss | 2 | 0 | **2** |
| 8 | Draw | 2 | 0 | 2 |
| 9 | Win | 0 | 1 | 2 |
| 10 | Win | 0 | 0 (reset) | **1** |
| 11 | Win | 0 | 1 | 1 |
| 12 | Win | 0 | 0 (reset) | **0** |

## What counts as a loss

Each game reports a number at the end of a round. `outcomeOf()` turns it into a win, loss
or draw using the game's entry in [`catalog.json`](catalog.json):

| Game | Loss | Win | Draw |
|---|---|---|---|
| Tic-Tac-Toe, Connect Four | Computer wins (0) | You win (1) | Board fills (0.5) |
| Snake | Under 5 points | 5 points or more | — |
| Merge | Under 600 points | 600 points or more | — |

Snake and Merge always end in a game over, so a round only counts as a loss when the score
is weak (`assist.lossBelow`).

## What gets easier

Orb sends the level into the game through `public/games/orb-bridge.js`, and the game reads
`OrbBridge.assist` when it makes its next move or starts its next round.

| Game | Level 0 | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| Tic-Tac-Toe | Computer plays a random move 25% of the time, otherwise perfectly | 45% | 65% | 85% |
| Connect Four (Easy) | 55% random moves, looks 2 moves ahead | 75%, 1 ahead | 95%, 1 ahead | Always random |
| Connect Four (Medium) | 12% random, looks 4 ahead | 32%, 3 ahead | 52%, 2 ahead | 72%, 1 ahead |
| Connect Four (Hard) | Never random, looks 6 ahead | 20%, 5 ahead | 40%, 4 ahead | 60%, 3 ahead |
| Snake | One step every 110 ms | 140 ms | 170 ms | 200 ms |
| Merge | New tile is a 4 one time in 10 | One in 20 | Always a 2 | Always a 2, placed next to a matching 2 when possible |

## Games without an assist

- **Reaction Rush and Simon Says** feed health readings on Sleep and mind (reaction time
  and working memory). Making them easier would hide the slowdown those readings exist to
  catch, so they never get an assist. `outcomeOf()` returns `null` for any game with a
  `health` field, even if someone adds an `assist` entry by mistake.
- **Memory Match, Lights Out, Tower of Hanoi and Nonogram** are puzzles that can only be
  finished, not lost, so there is no losing streak to break.

## The player is told

When the level is above 0, the game page shows: *"Easier mode, level N of 3. After a few
tough rounds the game has eased off. It goes back to normal as you win."* The assist helps
quietly, but it is never hidden.

## Scope and limits

- **Per player, per game.** Losing at Snake does not make Tic-Tac-Toe easier, and one
  crew member's streak does not affect another's.
- **Resets on reload.** Rounds live in Orb's in-memory store like the rest of the demo, so
  reloading the page starts every game at level 0.
- **Outside Orb**, for example a game file opened directly, the bridge is not connected
  and the level stays 0.

## Adding the assist to a new game

1. In `catalog.json`, give the game an `assist` entry: `{}` for a win/draw/loss game
   (scoring kind `wins`), or `{ "lossBelow": N }` for a points game.
2. In the game, read `window.OrbBridge ? OrbBridge.assist : 0` wherever difficulty is
   decided, and make each level noticeably easier than the one before.
3. Report each round with `OrbBridge.result(value)` so Orb can count it.
