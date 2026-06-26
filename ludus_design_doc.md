# Design Document: *LUDUS* — A Sci-Fi Gladiator Management Sim

## Purpose of this document

This is a build specification for Claude Code. It describes a single-player management game inspired by the texture and loop of *Football Manager 98*: a dry, text-and-numbers interface; a season structure; and a short, non-interactive 2D match simulation rendered as colored dots, which the player watches (or skips) but does not directly control.

The fiction is a **sci-fi gladiator school (a *ludus*)**. The player owns and manages one team of gladiators competing in an arena league against AI-controlled rival schools. There is no sport being borrowed; the "match" is an arena bout, but mechanically it behaves like a team sport with a scoreline.

**Build the phases in order. Phase 1 must be a complete, playable season before any later phase is started.** The single most important constraint in this document is that Phase 1 ships finished and small. Do not begin Phase 2 features, or scaffold for them, until Phase 1 is playable end to end.

---

## Core design pillars

These are the non-negotiable feel targets. Every implementation decision should serve them.

1. **Dry, legible, text-and-numbers presentation.** Tables, lists, attribute sheets. Not slick, not animated beyond the match view. Information density over polish.
2. **A season with a rhythm.** Fixtures, a league table, results, standings, week-to-week management between matches.
3. **A short autonomous match simulation.** Two rounds of up to one minute each, colored dots on a simple field with terrain, no player control during a round, a half-time adjustment between rounds, and a skip button.
4. **Imperfect information.** The player never sees the complete truth about their own fighters or opponents. Scouting reduces fog but never eliminates it. This is what makes team-building, not superstar-hunting, the point.
5. **Team composition over single stats.** Different fighter body-types reach the same combat effectiveness by different stat compositions. A skinny, agile fighter and a giant brute can be equally good in melee.

---

## Technical target

- **Platform:** A **local Vite + React project** that the player runs on their own computer. No server, no account, no network calls, no cost. The player has Node.js installed already.
- **Stack:** Vite + React (matches the player's prior projects). TypeScript strongly preferred — it pays for itself on a project with a non-trivial data model and a simulation engine, by catching errors at the boundaries between modules. If TypeScript is used, type every module boundary (engine inputs/outputs, state shape, save format).
- **How the player runs it:** Standard Vite flow — `npm install` once, then `npm run dev`, which serves the game at a local address (e.g. `http://localhost:5173`) that opens in the browser. Include a short, plain-language `README.md` at the project root with exactly these steps written for someone who is not a developer: how to install dependencies, how to start the game, how to stop it, and how to start it again next time. Do not assume the player remembers terminal commands between sessions.
- **Persistence:** Because this is a real local project (not the artifact sandbox), browser `localStorage` works and is acceptable for saving a season across sessions. Additionally provide explicit **export/import of a JSON save file** (download a save, load it back) so the player has a portable, inspectable save they can't lose to a cleared browser cache. Keep the save format a single well-typed serialisable object.
- **Determinism:** The match engine is a **seeded deterministic simulation.** Given the same fighters, terrain, tactics, and seed, it always produces the same match. A fresh seed is generated per match. The half-time adjustment re-seeds round two. This makes the skip button honest (it fast-forwards to the already-determined result) and makes bugs reproducible. Match variety comes from the per-match seed, the matchup, and the fog — not from non-determinism. Use a small seedable PRNG (e.g. mulberry32 or similar); never call `Math.random()` inside the engine.

---

## Code architecture and documentation standards

This project must be built clean from the first commit. The player has previously inherited single files tens of thousands of lines long and explicitly does not want that. The following are **hard constraints**, not suggestions.

### The cardinal rule: separate the engine from everything else

There are three layers, and they must not bleed into each other:

1. **The simulation/rules layer** (the game logic): the match engine, the attribute math, season progression, fog calculation, AI opponent decisions. **This layer contains zero React, zero JSX, zero DOM, and zero browser APIs.** It is pure TypeScript: data in, data out, deterministic. It must be runnable and testable without a browser. If any rule of the game lives inside a React component, that is a defect.
2. **The state layer**: how the current game (roster, season, table, save) is held and updated. Keep game state in one well-defined store/shape, mutated only through clearly named functions. The UI reads from it; it does not scatter game state across component `useState` hooks.
3. **The UI layer** (React): renders the state and the engine's output, and captures player input (lineup, tactics, button presses). **This layer contains zero game rules.** A component may decide *how a fighter's stats look on screen*; it must never decide *how a fighter's stats are calculated*.

The single best test of whether this separation holds: *you could throw away the entire UI and rebuild it differently without touching the engine, and you could swap the dot-renderer for a text log without touching the rules.* Build so that this is true.

### File and module size

- **No file over ~300 lines.** If a file approaches that, it is doing too much; split it by responsibility. This is a firm ceiling, not an average to drift past.
- One module = one responsibility, with a name that says what it does. Prefer many small, clearly-named files over a few large ones.
- The match engine in particular must be decomposed (e.g. separate modules for movement, combat resolution, scoring, the event-timeline producer) rather than one giant `simulate()` function.

### Suggested project structure

Adapt as sensible, but keep the engine/state/UI separation visible in the folder layout:

```
src/
  engine/            # PURE game logic, no React, independently testable
    rng.ts           # seedable PRNG (mulberry32 or similar)
    attributes.ts    # category-blend math, effectiveness curves
    match/
      simulate.ts    # orchestrates a match -> MatchResult + event timeline
      movement.ts
      combat.ts
      scoring.ts
    season.ts        # fixtures, table, standings, progression
    ai.ts            # AI opponent team/tactics decisions
    fog.ts           # hidden-value estimation and reveal logic
    types.ts         # shared domain types (Fighter, Team, MatchResult, etc.)
  state/
    gameStore.ts     # the single game-state shape and update functions
    save.ts          # serialise/deserialise, export/import JSON, localStorage
  ui/
    screens/         # one file per screen (Roster, Fixtures, Table, Match, ...)
    components/       # small reusable presentational pieces
    matchView/        # the dot renderer, consumes an engine event timeline
  data/
    seedFighters.ts  # the Phase-1 starting content (3 teams, fighters)
    arenas.ts        # terrain definitions
  App.tsx
  main.tsx
```

### Documentation

- Every module starts with a short comment stating its single responsibility and what it must NOT do (e.g. "Pure match-resolution. No React, no randomness except via the injected rng.").
- Every exported function has a brief doc comment: what it takes, what it returns, and any invariant it relies on (especially determinism).
- The **`README.md`** covers two audiences in two sections: (a) the player, with the plain-language run instructions described above; and (b) a developer/Claude-Code section documenting the architecture, the engine/state/UI rule, and where to add things for each future phase.
- Maintain a short **`ARCHITECTURE.md`** (or a top section in the README) that states the three-layer rule and the file-size ceiling, so that any future phase work — by Claude Code or the player — is held to the same standard. Future phases must extend this structure, not bypass it.

### Testing the engine

- The engine is pure and deterministic, so it is cheap to test. Include a small set of tests asserting: the same seed + inputs always yields the same `MatchResult`; differently-composed fighters reach comparable category effectiveness (the brute-vs-duellist target); and a match produces a sensible, varied scoreline distribution across many seeds. These tests are the safety net that lets later phases change things without silently breaking the feel.

### What "done cleanly" means for Phase 1

Phase 1 is finished when the season is playable *and* the codebase honours the three-layer separation, the file-size ceiling, and the documentation standard above. A playable-but-tangled Phase 1 is not done, because the tangle is exactly what makes Phases 2–4 collapse.

---

## The gladiator attribute model

Each fighter has **five top-level categories**, each composed of **three subcategories**, for **fifteen sub-stats total.** A category's effective value is derived from its three subcategories (a weighted blend, see below). This is what lets two differently-composed fighters be equally effective in a category.

| Category | Subcategory 1 | Subcategory 2 | Subcategory 3 |
|---|---|---|---|
| **Melee** | Strength | Technique | Agility |
| **Ranged** | Eyesight | Steadiness | Reload/handling |
| **Defence** | Toughness | Reflexes | Armour-use |
| **Mental** | Temperament | Awareness | Discipline |
| **Speed** | Acceleration | Stamina | Manoeuvre |

Notes for implementation:
- Sub-stats are integers, suggested range 1–20 (FM-like).
- A category's effective score is a blend of its three sub-stats. Use a non-trivial blend (not a flat average) so that composition matters — e.g. Melee effectiveness might be `0.4*Strength + 0.4*Technique + 0.2*Agility` but with diminishing returns on any single sub-stat, so that a balanced 12/12/12 and a lopsided 18/14/4 land near each other. The brute (high Strength, low Agility) and the duellist (high Technique and Agility, modest Strength) should reach comparable Melee, but behave differently in the sim (the agile one repositions; the brute trades blows).
- **Hidden attributes (the fog):** Temperament, and a hidden **Potential** value (governing growth, Phase 2), are never shown as exact numbers. The player sees ranges or scout-estimated bands that narrow with scouting. Visible combat sub-stats are also shown as estimates with error bands until the fighter has competed enough to "reveal" them. Calibrate so that the player is regularly surprised but not blind.

---

## The match simulation

- **Field:** A 2D arena, top-down, simple. Colored dots for fighters (player's team one color, opponent another). Simple terrain: a handful of obstacles/cover blocks and possibly a central hazard or objective zone. Terrain varies by arena.
- **Squad size:** 6 fighters per side on the field.
- **Structure:** Two rounds, up to ~60 seconds each. Between rounds, a half-time screen where the player makes **limited tactical adjustments** (see below). The match has a scoreline; decide a simple scoring model (suggested: points for downing opponents and/or controlling the objective zone; first round and second round both contribute; higher total wins).
- **Player control:** None during a round. The player sets tactics before the match and adjusts at half-time only. They watch, or press **Skip** to jump to the result.
- **What the player watches:** Dots moving, engaging, going down. It should be legible enough that the player can see *why* things are going well or badly (e.g. "my ranged fighters keep getting caught in the open") so the half-time adjustment feels informed. This is the FM "see the fruits of your labour" payoff. Keep it minimal — readability over spectacle.
- **Resolution:** Seeded, deterministic, as specified above.

### Pre-match and half-time tactics (keep small)

A short list of high-level tactical levers, not micromanagement. Suggested for Phase 1:
- Formation/posture (e.g. Aggressive / Balanced / Defensive).
- Focus (e.g. prioritise melee engagement / hold ranged lines / contest the objective).
- Maybe per-fighter role assignment (front line / skirmisher / hold back) — only if it stays simple.

Half-time lets the player change posture and focus and re-assign roles. That re-seeds and re-runs round two.

---

## The management layer

This is where the player spends most of their time. Phase 1 includes a deliberately reduced set; the rest is later phases. **All of the following are in the eventual design, but only the Phase 1 subset is built first.**

Full intended scope (do NOT build all of this in Phase 1):
- Recruitment and scouting (with fog).
- Training and fighter development across a season and across seasons.
- Contracts and finances.
- Base building (the *ludus* itself — facilities that unlock features).
- Beast-handling (a future facility: a stable of trained creatures that can join bouts).

---

## Phase 1 — the playable vertical slice

**Goal:** A complete season the player can finish in one sitting, then judge whether they like the game. Limited content is fine and expected.

Includes:
- **3 teams total** (the player's ludus plus 2 AI rivals). A small league.
- A **single season**: a round-robin fixture list (each team plays the others home and away, or however many fixtures gives a satisfying short season — aim for roughly 4–8 matches for the player), a **league table** (W/D/L, points, standings), and a champion at the end.
- A **roster** for the player's ludus and for each AI team: enough fighters to field 6 and have a few on the bench (suggest 8–10 per team).
- The **fifteen-sub-stat attribute model** with **fog** (estimated/hidden values).
- The **two-round match simulation** with colored-dot rendering, terrain, half-time adjustment, and skip.
- **Pre-match and half-time tactics** (the small lever set above).
- A **basic recruitment/transfer step** between matches OR a simple "scout the free agent pool and sign one" loop — kept minimal. If this risks bloating the slice, cut it to "view your roster and set your lineup/tactics" only, and move recruitment to Phase 2. Lineup selection and tactics are the irreducible core; recruitment is desirable but droppable.
- A **dry FM-style UI**: roster table, fighter attribute sheet, fixture list, league table, results screen, match screen.

Explicitly NOT in Phase 1: base building, beast-handling, finances/contracts, training/development, multi-season play, fighter aging, more than 3 teams.

**Build order within Phase 1 (this sequence matters):**
1. Project skeleton with the folder structure above, plus the seedable PRNG and the `types.ts` domain types. Establish the engine/state/UI separation before writing features.
2. Data model: fighters, teams, the attribute system and category-blend math (`engine/attributes.ts`), with its tests.
3. The match engine as a headless, seeded, deterministic module: inputs (two squads, terrain, tactics, seed) → a `MatchResult` plus a timeline of events. Test it produces sensible, varied, reproducible results *before building any visuals.* This is the part most likely to be abandoned if left late; build it first, as pure logic with no UI.
4. The match view: a renderer in `ui/matchView/` that consumes the engine's event timeline and draws moving dots, with skip. It reads the timeline; it does not compute anything.
5. The season scaffold (`engine/season.ts`): fixtures, table, results, progression.
6. The management screens: roster, attribute sheets with fog, lineup and tactics selection.
7. (If time) the minimal recruitment loop.
8. The `README.md` and `ARCHITECTURE.md`, and the player-facing run instructions.

---

## Phase 2 — depth for the management layer

Added only after Phase 1 is playable and the player has decided they like it.
- **Training and fighter development**, using the hidden Potential stat: fighters improve (or plateau) over time based on training focus and match experience. Fog narrows as fighters reveal their true stats through play.
- **Full recruitment and scouting** as a proper subsystem: a scouting action that spends a resource (time/money) to narrow the fog on prospects before signing.
- **Finances and contracts**: a budget, wages, prize money, the economic pressure that makes recruitment a real decision.
- **More teams** in the league (expand beyond 3).

---

## Phase 3 — base building (the ludus itself)

- The player upgrades facilities of their gladiator school, each unlocking or improving a feature.
- Base building is a resource sink tied to the Phase 2 economy.
- **Built so far:** Training Ground (faster development), Scouting Network (less fog), Armoury (defensive equipment), Weaponsmith (offensive equipment), Housing (mental-stat boost), Stadium (gate-receipt income for home fixtures) — all match-time, weekly-roll, or result-settlement bonuses on top of existing systems, no new subsystem required.
- **Beast-handling** lives here: a facility (a menagerie/kennel) that lets the player acquire and train creatures with wild stat variance, which can be fielded in bouts. This satisfies the "every fighter is a project" instinct without drifting into pet-customization; creatures are roster assets, not companions.
- **Housing**: two effects were bundled here — a mental boost (less strain) and a larger roster cap. The mental half is built (a match-time lift to the visible mental sub-stats). The roster-cap half is still open: signing is currently uncapped, so a cap has to exist first, with `ROSTER_SIZE` becoming per-team state rather than a global constant — a small structural change, not just a stat bonus.
- **Stadium**: the income half is built — home fixtures now bank gate receipts that scale with stadium level. The remaining half, a small home-advantage modifier in the match simulation, is deliberately deferred: the engine has a tested no-home/away-bias fairness invariant, so any home edge must be a deliberate modifier layered in `state/matchSetup.ts` (never engine bias), and the invariant's intent should be revisited before doing so.
- **Tactics Board**: not a stat bonus — a facility that unlocks more tactical depth (e.g. a fourth movement role, or new Focus/Posture options) once the match engine supports more than the three current roles. Treat the facility as a gate on new movement-engine work, not as something to fake with a multiplier.
- **Medical Bay / Hospital**: explicitly depends on an injury system existing first. There is no injury mechanic in the engine today — fighters never come out of a match worse for wear. Build the injury system (when fighters can be hurt, sidelined, and recover over time) as its own piece of work, and only then add the Hospital facility as the lever that speeds recovery. Don't stub a fake "recovery speed" facility ahead of the mechanic it's supposed to affect.

---

## Phase 4 — multi-season careers

- Persistent careers across multiple seasons.
- Fighter **aging, decline, and retirement.**
- **Youth intake / new prospects** entering the pool each season.
- Long-arc progression of the player's ludus reputation and standing.

---

## Open questions / decisions deferred to build time

These can be settled by Claude Code during implementation with reasonable defaults; flagged so they aren't forgotten:
- Exact match scoring model (downs vs. objective control vs. both).
- Exact category-blend formulas and diminishing-returns curve (tune for the "different bodies, equal effectiveness" target).
- Fog representation in the UI (estimated bands vs. star ratings vs. fuzzy ranges).
- Number of fixtures in the Phase 1 season (target a satisfying short season, ~4–8 player matches).

## Anti-scope reminder

This document deliberately lists future phases so the architecture can anticipate them, but Phase 1 is the deliverable. A finished, small, playable season beats a sprawling unfinished sandbox. Build Phase 1 to completion first.
