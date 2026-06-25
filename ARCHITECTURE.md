# Architecture & code standards

These are **hard constraints** for this project, not suggestions. They exist so
that later phases extend the game cleanly instead of collapsing it into a
tangle. Any future work — by a person or by Claude Code — is held to them.

## The three layers

The codebase has three layers, and they **must not bleed into each other**:

1. **Engine (`src/engine/`, `src/data/`)** — the game logic: the match engine,
   attribute math, season progression, fog calculation, AI decisions, and the
   content. **Zero React, zero JSX, zero DOM, zero browser APIs, and no
   `Math.random()`.** Pure TypeScript: data in, data out, deterministic.
   Runnable and testable without a browser.

2. **State (`src/state/`)** — how the current game is held and changed. One
   well-defined `GameState` shape, mutated only through clearly named functions.
   This layer may touch storage (localStorage, file export) but holds **no game
   rules**. It orchestrates engine calls; it does not reimplement them.

3. **UI (`src/ui/`)** — React. Renders the state and the engine's output and
   captures player input. **Zero game rules.** A component may decide *how a
   value looks on screen*; it must never decide *how that value is calculated*.

The test of whether the separation holds: *you could throw away the entire UI
and rebuild it differently without touching the engine, and you could swap the
dot-renderer for a text log without touching the rules.* Keep this true.

## Determinism

The match engine is a **seeded deterministic simulation**. Given the same
fighters, terrain, tactics, and seed it always produces the same `MatchResult`.

- All randomness flows through `engine/rng.ts` (mulberry32). The engine never
  calls `Math.random()`.
- A fresh seed is generated per match; round two is re-seeded from it so a
  half-time adjustment re-runs only the second round.
- This makes **Skip** honest (it fast-forwards to an already-determined result)
  and makes bugs reproducible.

Determinism is covered by tests (`engine/match/simulate.test.ts`) — same seed +
inputs ⇒ identical result. Don't regress it.

## File and module size

- **No file over ~300 lines.** This is a firm ceiling, not an average. If a file
  approaches it, split by responsibility.
- One module = one responsibility, named for what it does. Prefer many small,
  clearly-named files over a few large ones.
- The match engine in particular stays decomposed (movement, combat, scoring,
  setup, geometry, the orchestrator) rather than one giant `simulate()`.

## Documentation

- Every module starts with a short comment stating its single responsibility and
  what it must NOT do.
- Every exported function has a brief doc comment: what it takes, what it
  returns, and any invariant it relies on (especially determinism).
- Type every module boundary (engine inputs/outputs, state shape, save format).

## Balance & fairness (tested invariants)

These properties are asserted by tests and must not silently regress:

- **Different bodies, equal effectiveness** — a brute and a duellist reach
  comparable melee by different stat routes (`attributes.test.ts`).
- **No side bias** — home and away are mirror-fair; arenas are left-right
  symmetric, combat resolves simultaneously, and each fighter draws from its own
  RNG stream (`simulate.test.ts`).
- **No dominant tactic** — no single focus wins head-to-head outside 35–65%
  (`balance.test.ts`).

## What "done" means for a phase

A phase is finished only when it is playable **and** the codebase still honours
the three-layer separation, the file-size ceiling, and the documentation
standard above. A playable-but-tangled phase is not done, because the tangle is
exactly what makes the next phase collapse.
