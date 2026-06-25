# LUDUS

A single-player sci-fi gladiator management game. You run one *ludus* (a
gladiator school) through a short arena season against two rival schools:
pick your fighters, set your tactics, watch the bouts play out as moving dots,
and chase the league title. Dry tables and numbers, in the spirit of the old
*Football Manager* games.

This is **Phase 1** — a complete, playable single season.

---

## For players — how to run the game

You only need [Node.js](https://nodejs.org/) installed (the LTS version is
fine). You do **not** need to know how to program. Open a terminal (Terminal on
Mac, or "Node.js command prompt" / PowerShell on Windows), then:

### 1. The first time only — install

Go into the game's folder and install it once. Type this and press Enter:

```
cd path/to/scifi-ludus
npm install
```

(Replace `path/to/scifi-ludus` with wherever this folder lives. You can drag the
folder onto the terminal window to fill in the path.)

This downloads what the game needs. It can take a minute. You only do it once.

### 2. Start the game

```
npm run dev
```

After a moment it prints a web address, usually:

```
http://localhost:5173/
```

Open that address in your web browser. The game is now running.

### 3. Stop the game

Click back on the terminal window and press **Ctrl + C**. That shuts the game
down. You can close the terminal afterwards.

### 4. Play again next time

Open a terminal, go to the folder, and just run:

```
cd path/to/scifi-ludus
npm run dev
```

then open `http://localhost:5173/` again. (No need to install again.)

### Saving

- Your season **saves automatically** in your browser, so if you come back to
  the same browser it picks up where you left off.
- Browsers can lose this if you clear data, so for a backup go to the **Save**
  tab and click **Export Save File**. That downloads a small `.json` file you
  can keep. Use **Load Save File** on the menu or Save tab to load it back.

### How a season works

- Four schools, including yours. Everyone plays everyone home and away — you
  have six matches.
- Between matches: review your **Roster**, study each fighter's **attribute
  sheet**, set your **Lineup & Tactics**, and maybe **Recruit** a free agent.
- For each of your matches, set your six fighters and tactics, then **Play**.
  Watch round one, make a **half-time** adjustment, watch round two, and see the
  result. You can press **Skip** at any time to jump to the outcome.
- Weeks that don't involve you are simulated when you press **Simulate Week**.
- The **Table** tracks standings; whoever leads after every match is champion.
- Every match week, your ludus pays its roster's wages and banks prize money
  for the result — a win pays more than a draw, a draw more than a loss.
  Your running budget is shown in the top bar, on the Roster screen, and on
  the Table. Free agents cost no signing fee, but add to your weekly wage bill.

### Imperfect information

You never see the exact truth about a fighter. Values are shown as estimates
with a band, and they sharpen the more a fighter competes. Temperament is hidden
entirely, and potential is only a rough star rating. Build a balanced team
rather than chasing a single big number — different body types (a brute, a
duellist, a marksman…) reach the same effectiveness by different routes.

---

## For developers / Claude Code

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the hard rules. The short
version: there are three layers and they must not bleed into each other.

```
src/
  engine/   PURE game logic. No React, no DOM, no Math.random. Deterministic.
    rng.ts                seedable PRNG (mulberry32) + seed derivation
    attributes.ts         15 sub-stats -> 5 category scores (diminishing returns)
    fog.ts                estimate bands that narrow with experience
    season.ts             fixtures, league table, standings
    ai.ts                 AI opponent lineup/role/tactics choices
    constants.ts          tuning numbers
    types.ts              shared domain types
    match/                the match engine, decomposed:
      simulate.ts         orchestrates two rounds -> MatchResult + frame timeline
      setup.ts            place entities, posture multipliers
      movement.ts         targeting + per-tick repositioning
      combat.ts           damage/cooldown resolution
      scoring.ts          downs + objective control
      geometry.ts         distance, obstacle/line-of-sight maths
      internal.ts         engine-only entity types
  state/    Holds the one GameState and changes it. May touch storage; no rules.
    gameState.ts          GameState shape + pure update functions
    gameStore.ts          the store (subscribe/actions/autosave), no React
    newGame.ts            new-season composition
    matchSetup.ts         GameState + Fixture -> engine match inputs
    save.ts               serialise, localStorage, JSON export/import
  ui/       React. Renders state and the engine's output. No rules.
    App.tsx               screen routing
    useGame.ts            React binding to the store
    screens/              one file per screen
    components/           small presentational pieces
    matchView/            the dot renderer; consumes the engine's frame timeline
  data/     Static + generated Phase-1 content.
    seedFighters.ts       LEAGUE_SIZE teams of archetype fighters + free agents
    arenas.ts             terrain definitions
    names.ts              name pools
```

### The cardinal rule

The simulation could be re-skinned without touching the engine, and the
dot-renderer could be swapped for a text log without touching the rules. The
engine takes data in and returns data out, deterministically. If a game rule
ever lives inside a React component, that is a defect.

### Determinism

Every match is a pure function of `(squads, arena, tactics, seed)`. The engine
never calls `Math.random()` — all randomness flows through `engine/rng.ts`.
Round two is re-seeded from the match seed, so a half-time tactics change
re-runs only the second round, and **Skip** is honest (it shows the
already-determined result).

### Running tests

```
npm test          # engine determinism, attribute equivalence, balance, fairness
npm run typecheck # strict TypeScript across all module boundaries
npm run build     # production build
```

### Phase 2 progress

- **Done:** finances (`engine/finance.ts` — starting budget, weekly wages,
  win/draw/loss prize money), training (`engine/training.ts` — pick a
  category each week, fighters grow its sub-stats toward their hidden
  `potential`, applied whenever a fixture is recorded), scouting
  (`engine/scouting.ts` — pay a rising credit cost to commission a report on
  a free agent, narrowing its fog in `engine/fog.ts` before you sign it), and
  a four-team league (`engine/constants.ts`'s `LEAGUE_SIZE`, with a generic
  double round-robin schedule in `engine/season.ts` so the team count isn't
  hardcoded).
- Phase 2 is complete.

### Where Phase 3+ plug in (do not build these yet)

- **Phase 3 (base building, beasts):** new facilities are state + UI on top of a
  Phase-2 economy; beasts are roster assets that become extra `Fighter`-like
  entities the engine already knows how to simulate.
- **Phase 4 (multi-season careers):** wrap the season in a career loop; add aging
  to fighters and a youth intake to the content generator.

Every phase must extend this structure and honour the rules in ARCHITECTURE.md,
not bypass them.
