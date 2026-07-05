# LUDUS — Design Review & Push-Further Roadmap

A design review of the game as it stands (post Phase 4, with corps/contracts,
cup, patron, traits, morale, difficulty, intel and the neon match view all in),
with concrete proposals for what would push it furthest as a *game*. Each
proposal explains the technique behind it and where it plugs into the
three-layer architecture without breaking the determinism and fairness
invariants.

**The one-line diagnosis:** the management layer is deep and legible, but the
*match* — the thing every management decision funnels into — is still thin in
two ways: it offers little tactical expressiveness (3 postures × 3 focuses ×
3 roles, and every fighter targets the nearest enemy), and it explains itself
only through a moving picture and a final score. The highest-leverage work is
(1) making the match *tell the player what happened and why*, and (2) making
the fighters *behave* differently, not just roll different numbers.

Ranked by leverage:

| # | Proposal | Why it multiplies |
|---|----------|-------------------|
| 1 | Match event log + post-match report + ratings | Feeds morale, news, fog, awards, tactical feedback — one engine change powers six features |
| 2 | In-match fatigue (stamina that matters) | Makes posture a real trade-off, half-time meaningful, bench valuable |
| 3 | Utility-based targeting (replace nearest-enemy) | Focus fire, threat awareness, and mental stats become visible behaviour |
| 4 | Half-time roles + substitutions | Roster depth finally matters inside a match |
| 5 | AI personalities | Rivals become characters, not one shared brain |
| 6 | In-match morale & routs | Temperament (the one permanently-hidden stat) becomes observable |
| 7 | Transfer market & wage demands | Closes the economy's biggest hole |
| 8 | Usage-based fog reveal | Watching matches becomes scouting |
| 9 | Rotationally-symmetric arenas, dynamic hazards | Variety without breaking the fairness invariant |
| 10 | Balance harness (Monte Carlo matrix) | Lets you tune everything above without fear |
| 11 | Commentary booth (toggleable) | Turns the event log into a Blood Bowl-style two-caster broadcast — hype, story, character |

---

## 1. The match must explain itself: an engine event log

**The gap.** FM-likes live on the loop *watch → understand → adjust → be
rewarded*. Right now the engine emits frames and a score. The player can watch
dots, but nothing tells them "your skirmishers dealt 70% of your damage" or
"Vex went down inside the plasma vent twice". The half-time adjustment — the
game's one mid-match decision — is made mostly on vibes.

**The technique: a typed event stream as a first-class engine output.**
The simulation already *knows* every fact worth reporting; it just throws them
away. In `simulateRound`, alongside `frames`, accumulate a `MatchEvent[]`:

```ts
type MatchEvent =
  | { t: number; kind: 'down'; victim: string; credit: string; cause: 'melee' | 'ranged' | 'hazard' }
  | { t: number; kind: 'objective-flip'; side: Side }         // control changed hands
  | { t: number; kind: 'first-blood'; side: Side }
  | { t: number; kind: 'hazard-hit'; fighter: string; hazard: HazardKind };
```

This is pure data-out, so it lives naturally in the engine layer, costs nothing
(the checks already run every tick — e.g. the `hp <= 0` branch in
`simulate.ts` is exactly where `down` is emitted), and is deterministic for
free. Deliberately keep it *coarse*: per-attack events would bloat the
timeline; per-outcome events are the FM commentary granularity.

Also accumulate per-fighter tallies in a `MatchStats` record (damage dealt /
taken, downs scored, times downed, hits landed / attempts, ticks spent in the
objective zone, hazard damage taken). Everything is already at hand inside the
tick loop — `resolveAttack`'s return value, the `hits` array, `tickObjective`'s
zone test.

**What it buys, all downstream and all UI/state-layer work:**

- **A live ticker during playback.** As the frame player advances, show the
  events whose `t` has passed ("⚡ Korr downs Vessia — 12–4"). This is the
  single cheapest way to make watching feel like a broadcast. The renderer
  stays a pure consumer of engine output.
- **A post-match report screen.** A dry FM-style table: per fighter, damage
  in/out, downs, accuracy, zone seconds. This is where a management player
  actually learns whether their lineup works. Use the existing `EstimateBar`
  visual language.
- **Match ratings (0–10 per fighter).** Normalise each fighter's tally against
  the match totals into a familiar FM rating. Ratings then feed: morale
  (personal performance, not just team result — `moraleAfterResult` currently
  treats the whole squad identically), news ("Korr (9.2) dismantles Ferrous
  Dynamic"), a season-awards screen, and free-agent valuation.
- **Tactical feedback at half-time.** Small heuristics over round-one events
  turn into one advisory line: e.g. if your `holdback`s took most of their
  damage from melee, "your back line is getting overrun — consider an
  aggressive press or melee focus". Compute in the state layer from
  `MatchStats`; it's derived data, not a rule.
- **A momentum graph at full-time.** You already record score per frame; a
  tiny sparkline of score-difference-over-time shows *when* the match swung.
  One canvas polyline, pure presentation.

**Architecture note.** `RoundResult` grows `events` and `stats` fields. Save
format: don't persist them per fixture (bloat) — persist only aggregated
career tallies per fighter (a `careerStats` record), which also unlocks a
career-stats block on the Fighter screen and a real Hall of Fame entry.

---

## 2. Fatigue: make stamina a resource, posture a price

**The gap.** `stamina` exists as a sub-stat but only feeds the blended speed
score. Nothing in a match is a *resource*. Consequently `aggressive` posture is
close to strictly-better-until-countered, the bench is dead weight during a
match, and round two plays identically to round one.

**The technique: an energy pool with drain/recovery, carried across the
break.** Give each `Entity` an `energy: 0..1`. Per tick:

- drain proportional to distance actually moved (sprinting costs) plus a
  surcharge per attack; scale drain down with the `stamina` sub-stat (pull it
  out of the speed blend for this purpose, or read it directly off
  `subStats` at `buildEntities` time);
- recover slowly when stationary and out of combat;
- posture multiplies drain: aggressive ≈ 1.3×, defensive ≈ 0.8×.

Low energy applies a soft penalty — multiply move speed and attack power by
`0.6 + 0.4 * energy` (a floor, never zero, so bouts still resolve). That soft
curve matters: hard thresholds create degenerate all-or-nothing play and are
harder to read on screen than a gradual fade.

**Carry end-of-round-one energy into round two.** This is the piece that
transforms half-time. Blitzing round one now has a visible second-round cost;
a defensive round one becomes a legitimate rope-a-dope. The determinism
contract survives intact: round two is already a function of round one's
*outputs* (the score feeds `adjustTactics`); it becomes a function of round
one's end-state too. Since round one is frozen at half-time, "re-run only
round two" still holds exactly. Pass the energy snapshot through
`simulateMatch` into the second `simulateRound`, defaulting to full — the
existing tests keep passing until you opt in.

**Fairness.** Energy rules are side-neutral (they depend only on the entity's
own motion and stats), so the mirror-fairness invariant is untouched. Add one
balance test: aggressive-vs-defensive head-to-head win rate stays inside the
35–65% band *with* fatigue on, which is exactly what `balance.test.ts` is for.

**Renderer.** One more field on `FighterFrame` (`energy`), rendered as dot
saturation or a second, dimmer arc. A tiring fighter visibly dims — legible at
a glance, no legend needed.

---

## 3. Targeting: from "nearest enemy" to a utility score

**The gap.** `nearestEnemy` is the whole of target selection. Every fighter is
a heat-seeking missile for proximity. Effects: no focus fire (damage spreads
evenly, so downs come late and clumped), a fast tank can bait four chasers
forever, and `awareness`/`discipline` — the stats the fiction says govern
reading a fight — do nothing observable.

**The technique: utility-based target scoring.** For each candidate enemy,
compute a weighted score and take the argmax:

```
score(e) = w_dist  * (1 - d / RANGED_RANGE)      // closer is better
         + w_kill  * (1 - e.hp / e.maxHp)         // finish wounded targets
         + w_threat* threat(e)                    // prefer removing damage-dealers
         + w_zone  * inObjective(e)               // under objective focus
```

Weight the *weights* by mentals: a high-`awareness` fighter leans more on
`w_kill`/`w_threat` (it sees the right target); a low-`discipline` one gets a
sticky bonus for its current target flipped around — it over-commits, chasing
its mark even when a better one appears. Now two fighters with identical
melee scores *play* differently, which is design pillar #5 doing work in the
sim rather than only in the stat sheet.

Determinism and fairness are preserved because the score is a pure function of
the tick state and ties keep the existing `seedBase` break. Focus fire emerges
naturally — wounded targets attract attention, downs accelerate, and the
watching player sees genuine "they collapsed on my marksman" moments, which
feeds straight into the section-1 feedback loop.

**Keep it cheap:** 6v6 = 36 evaluations per tick, negligible. Guard against
oscillation (target-flapping every tick reads as jitter) with hysteresis: the
current target keeps a small bonus (that's the discipline hook, ready-made).

**A second behaviour, same technique: cover-seeking.** Obstacles already block
ranged line-of-sight (`lineBlocked`), but nobody *uses* them — cover is a thing
that happens to fighters. Give `skirmisher`/`holdback` roles a positional
utility: sample a handful of deterministic candidate points around the desired
point (the `nextStep` detour machinery already does exactly this pattern) and
prefer points where LoS to the *second*-nearest threats is blocked while LoS
to the current target is open. That single rule creates peeking, flanking and
"my ranged line anchors on the pillars" — visible tactics from dots.

**And a third: separation.** Fighters currently stack into blobs (there's no
mutual collision), which hurts readability more than anything else in the
renderer. A boids-style separation term — a small repulsion from allies within
~2 dot radii, added to the desired point before `nextStep` — is symmetric,
deterministic, and makes every engagement read as a formation instead of a
scrum.

---

## 4. Half-time and the bench: substitutions and role changes

**The gap.** Half-time offers posture and focus only. Roles are locked, and the
three bench fighters (roster 9, squad 6) do nothing on match day. So the
decision space at the game's one interactive mid-match moment is 9 options.

**Proposal.**

- **Allow role re-assignment at the break.** The engine already accepts full
  `Tactics` (with `roles`) for round two — this is purely UI surface plus
  letting `adjustTactics` occasionally re-role for the AI. Cheap, ships first.
- **Allow up to two substitutions at the break.** Fresh legs enter at full
  energy (fatigue makes this *matter* — do it after §2), a battered star can
  be pulled before an injury roll finds them. Engine-side it's just different
  `fighters` in round two's `SquadInput`; `state/matchSetup.ts` owns the swap.
  Post-match settlement (`applyBoutEffects`) already takes `fieldedIds` — it
  becomes the union of both rounds' fielded fighters, with appearances/morale
  credited per round if you want the fine grain.
- **Gate the deeper toys behind the Tactics Board facility** — the design doc
  already reserves it as "a gate on new movement-engine work". A clean ladder:
  level 1 unlocks half-time role changes, level 2 substitutions, level 3 a
  fourth role — **flanker**: holds wide, uses the cover-utility from §3, and
  commits only when its target is engaged (a per-entity state flag; still
  deterministic). That makes the facility the thing it was always meant to be:
  purchased tactical depth, not a multiplier.

This is also where injuries get their missing in-match half: a fighter whose
HP hits zero in round one currently returns at full HP in round two (entities
are rebuilt per round). With substitutions in, consider carrying downs across
the break — a downed fighter is unavailable for round two unless subbed. It
raises the stakes of round one and makes the bench strategic rather than
administrative. (Score balance holds: downs already scored their points.)

---

## 5. Rivals with faces: AI personalities

**The gap.** All AI stables share one brain. `chooseLineup`, `counterTactics`,
`chooseFacilityUpgrade` and the contract functions are well-made, but every
rival plays the same way; only their rosters and corp perks differ. In a
4-team league you meet each rival six times a season across league and cup —
they should be *characters*.

**The technique: a personality vector, sampled once, biasing every choice
function.** At team creation (in `newGame.ts` / rollover), roll each AI team a
persistent profile:

```ts
interface AiPersonality {
  aggression: number;   // 0..1 — posture priors, halftime thresholds
  patience: number;     // hoards cash vs spends instantly (AI_CASH_RESERVE scale)
  scheming: number;     // how hard it counter-picks vs plays its own game
  youthBias: number;    // signs prospects vs proven veterans
}
```

Then thread it through the existing functions as a parameter (they're already
pure, so this is mechanical): `counterTactics` mixes between its counter-read
and `focusFor(squad)` by `scheming`; `adjustTactics`' `±5` margins scale with
`aggression`; `AI_CASH_RESERVE` scales with `patience`; `chooseSigning` sorts
its shortlist by `overall` blended with youth by `youthBias`.

**Make it legible or it doesn't exist:** surface the personality through the
Recon dossier ("Iron Meridian press early and never sit on a lead") and name a
lanista per stable in the news ("Dray Volkov's stable has signed…"). Two lines
of flavour text turn a bias vector into a rival. This pairs perfectly with the
existing intel system — reading the opponent's *manager* becomes part of
pre-match preparation, and the counter-tactics game stops being symmetric.

**Optional extension — grudges:** track a small per-rival heat value that
rises with cup eliminations and title races decided between you; high heat
biases that AI's `scheming` specifically against the player's known focus, and
generates derby-flavoured news. Cheap state, big narrative return.

---

## 6. Close the fog loop: temperament you can watch, reveal you can earn

Two refinements that deepen the game's best pillar.

**(a) In-match morale and routs — temperament made observable.**
Temperament is the one stat that never reveals (`HIDDEN` in `fog.ts`), but it
currently does nothing a player can *see*. Add a per-entity `nerve` that drops
on: taking heavy damage, an ally going down nearby, being outnumbered locally.
High `temperament` resists the drop; `composed` (Neural Governor) nearly
immunises it. A broken fighter doesn't flee the field (that would be
frustrating with no player control) — it *retreats to its holdback line and
fights defensively* until nerve recovers. Implementation is a per-entity state
flag consulted by `desiredPoint`, driven only by side-neutral local facts, so
fairness holds; all thresholds deterministic, no rng needed.

Now the player learns temperament the honest way: watching. "Vex wobbles when
the fight turns" is fog reduction *as gameplay*, and it makes the §1 event log
richer (`{ kind: 'shaken', fighter }` events → post-match "composure" column →
scouting insight).

**(b) Usage-based reveal.** Fog progress is currently a flat function of
`matchesPlayed` and `scoutLevel`. Tie reveal to *what the fighter actually
did*: melee sub-stats sharpen with melee attacks thrown, ranged with shots,
defence with hits absorbed — all available from §1's `MatchStats`. Store a
per-fighter, per-category usage tally and let `progress()` read it. Effect:
how you *deploy* a fighter determines what you learn about them, so fielding a
prospect in a specific role becomes a deliberate scouting act. This also
self-balances: the stats you rely on are the ones you know best.

---

## 7. The economy's missing half: a transfer market

**The gap.** Recruitment is free agents only. Rivals never bid for your
fighters; you can never buy theirs. `contractSeasons` exists on `Fighter` but
there's no negotiation moment. Consequence: once your roster is good, the
economy stops generating decisions — money piles up with nothing to fear.

**Proposals, in ascending scope:**

1. **Wage demands.** At rollover, fighters whose performance (career wins, §1
   ratings) outgrew their wage demand a raise scaled by reputation and morale;
   refusal costs morale, repeated refusal walks them at contract end. This
   alone makes success expensive — the FM pressure of keeping a winning squad
   together. Pure engine function (`renewalDemand(fighter, teamRep)`), state
   applies it at season turn, one Roster-screen banner.
2. **Rival poaching.** At each rollover, AI teams may bid on one *player*
   fighter (weighted toward high `overall`, expiring contracts, low morale).
   The player accepts credits or refuses (morale hit for the flattered
   fighter). Suddenly refusing money is a real decision, and budgets have a
   source besides prizes.
3. **Outbound bids.** Symmetrically, let the player bid on rival-roster
   fighters, price scaled by `overall`, age, contract seasons left, and the
   *seller's* budget pressure (a struggling AI sells; a rich one won't). Reuse
   the sealed-bid mechanics you already built for contracts — the auction code
   and its UI idiom exist.

Fog interacts beautifully here: you're buying rivals' fighters at *your* fog
level, and recon level becomes a transfer-market edge, giving the Scouting
Network a second life after your own roster is fully revealed.

---

## 8. Arena variety without breaking fairness: rotational symmetry

All arenas are left-right mirror-symmetric because the fairness invariant
demands it. But mirror symmetry is not the only fair symmetry: **180°
rotational (point) symmetry** — reflect through the centre point, `(x, y) → (W−x, H−y)` —
also gives both sides congruent terrain, while allowing *diagonal* layouts:
a cover spine running corner-to-corner, offset hazard pairs, an off-centre
double objective. The proof obligation is the same one you already discharge
in `simulate.test.ts` (swap the squads, mirror the arena, expect the mirrored
result); add a rotation variant of that test and the invariant is guarded, not
weakened. Concretely: add `pointSymmetric()` next to `symmetric()` in
`data/arenas.ts` and design two or three arenas with it — they will *feel*
structurally different from the six existing centre-mirror arenas at zero
engine cost.

**Dynamic hazards** are the other cheap variety lever: a plasma vent with a
duty cycle (`on` for N ticks, `off` for M, phase-locked to the tick counter —
deterministic by construction) turns a static no-go zone into a timing
problem, and the fast/manoeuvrable fighters get one more way to be visibly
fast. Render the off-phase dim; the pulse reads instantly. One new field on
`Hazard` (`period?/duty?`), one line in `hazardDamageAt`.

Also worth doing while in here: **hazard/objective interaction as arena
identity**. One arena where the objective ring *is* ringed by a gravwell
(holding it costs mobility), one where vents guard the only two cover lanes.
Arenas stop being texture variants and start dictating tactics — which the
pre-match briefing already knows how to surface.

---

## 9. Presentation: the last 10% of the match view

The renderer is genuinely good (trails, facing, actions, down-bursts). What's
missing is *impact* and *time control*:

- **Hit feedback.** You render attacks (tracer, slash) but not their success.
  A 2-frame white flash on the *victim* on damage taken, scaled by damage —
  requires a `hit?: boolean` (or damage-taken delta) on `FighterFrame`, or
  derive it in the renderer from HP deltas between frames (zero engine
  change). Misses read as whiffs by their absence. This single cue makes the
  causality of a fight readable.
- **Playback speed and scrubbing.** `useFramePlayer` has play/pause/skip.
  Add 1×/2×/4× (multiply `PLAYBACK_FPS`) and a scrub slider (`setIndex`
  directly — the trail-reset logic in `DotField` already tolerates backwards
  jumps). Management players rewatch the moment it went wrong; that's the FM
  highlight-reel instinct, and with a deterministic timeline you get replay
  *for free* — it would be a shame not to expose it.
- **The ticker** (from §1) docked under the field, and **crowd audio** driven
  by event density: the procedural audio bed gains a crowd-swell parameter
  that spikes on `down` events and rises with score proximity late in a round.
  You already have the event stream and a synthesised soundscape; this is a
  multiply, not a build.
- **Score-source clarity.** The score accrues from two sources (downs,
  objective ticks) but the scorebar shows one number. Split the display
  ("12 = 10 downs + 2 zone") or colour the score's tick-up by source. It
  teaches the scoring model passively — right now `objective` focus is the
  tactic whose value is hardest to *see*.

---

## 10. Tune with instruments, not vibes: a balance harness

You already have the right invariant tests (side-fairness, 35–65% tactic
bands, body-type equivalence). The proposals above add many interacting knobs
(fatigue drain, utility weights, nerve thresholds). The technique that keeps
this safe is a **Monte Carlo matchup matrix** as a dev script, not a test:

- Generate the archetype squads you already use in tests; run every
  (tactics × tactics) and (archetype × archetype) pairing across ~2,000 seeds
  (the engine is headless and fast — this is seconds, and trivially
  parallelisable since every match is a pure function).
- Emit a win-rate matrix, mean scoreline, mean match length, downs-vs-zone
  scoring share, and — once §1 lands — mean damage share per role.
- Check it into `scripts/`, print a markdown table, and eyeball it after every
  tuning change; promote any ratio you find yourself re-checking into a proper
  test threshold (e.g. "objective scoring is 20–45% of total points across
  archetypes" would have caught a degenerate all-deathball meta).

The same harness doubles as a *design* instrument: when you add the flanker
role or fatigue, the matrix tells you immediately whether it created a
dominant strategy — before a player ever does.

---

## 11. The commentary booth: a broadcast, not a scoreboard

**The gap.** §1 gives the match a *ticker* — terse, factual event lines ("⚡ Korr
downs Vessia"). What it doesn't give is *character*. The great sports-management
games (and Blood Bowl above all) sell the fantasy that you're watching a
televised event with people in a booth who have opinions, favourites, running
jokes and a sense of the stakes. That texture is what makes a 12–4 scoreline
feel like a *story* instead of a number.

**The technique: two casters over the existing event stream.** The event log
from §1 is already the perfect substrate — every fact worth reacting to is
timestamped and typed. Add a **pure commentary generator** (UI layer, since it
is flavour text, exactly like `labels.ts`) that consumes the round's
`MatchEvent[]` plus the per-frame score and emits `CommentaryLine[]`:

```ts
type Caster = 'play' | 'color';            // play-by-play vs colour analyst
interface CommentaryLine { t: number; speaker: Caster; text: string; }
```

Give the booth two named personalities with distinct voices — a slick
play-by-play caster who calls the action, and a grizzled ex-gladiator colour
commentator who editorialises, second-guesses tactics and plays favourites.
They should:

- **Open with hype** — set the scene at each round start (the arena, the corps
  rivalry, what's on the line).
- **Call the beats** — first blood, downs (phrased by weapon/cause), objective
  swings, phrased with escalating drama.
- **Tell the arc** — read the *scoreline* off the frames: runs ("they're pulling
  away"), comebacks ("clawing one back!"), and late-game tension when it's
  close ("we're into the final stretch and it is *anyone's* match").
- **Fill the lulls** — atmosphere lines when nothing's happening, so the booth
  never goes silent.

**Determinism for free.** The generator is a pure function of already-deterministic
inputs (events + frames). For *variety* without `Math.random`, pick each line
from its template pool via a hash of the event's tick — so a replay of the same
seed produces the same call, word for word. No engine change, no new state.

**Toggleable, persisted.** A booth on/off switch next to the existing sound
toggle, its choice saved in `localStorage` exactly as `audio.ts` does for mute.
Some players want the pure tactical view; some want the broadcast. Ship both.

**Where it plugs in.** It's a strict consumer of §1's output and the frame
timeline — no rules, no randomness in the engine, no new save state. It layers
directly beside the §1 ticker in the match view, and pairs naturally with the
§9 crowd-audio idea (a caster shouting *is* the crowd swell in text form).

---

## Sequencing recommendation

1. **Event log + stats + post-match report + ratings** (§1) — the multiplier;
   everything later gets more legible because of it.
2. **Playback speed/scrub + hit feedback** (§9) — small, immediate feel wins
   while §1's data is fresh.
3. **Fatigue** (§2), then **half-time roles/subs** (§4) — they're one design
   arc: fatigue creates the reason, subs provide the answer.
4. **Utility targeting + separation + cover** (§3) — deepest sim change; do it
   with the §10 harness in hand.
5. **AI personalities** (§5) and **in-match nerve** (§6a) — the character
   layer, cheap after the sim work.
6. **Transfer market** (§7) and **usage-based reveal** (§6b) — season-scale
   depth for the long career game.
7. **New arenas** (§8) — content, whenever a palate cleanser is wanted.

Every item above respects the standing constraints: engine changes are pure
and seeded, all new effects are side-neutral (fairness), renderer changes only
consume new frame/event fields, and each proposal decomposes into modules well
under the 300-line ceiling (`events.ts`, `stamina.ts`, `targeting.ts`,
`nerve.ts`, `personality.ts`, `transfers.ts` are the natural seams).
