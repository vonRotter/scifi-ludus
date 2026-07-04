# LUDUS — audio guide

A shortlist of tracks the game wants, with ready-to-paste prompts for AI music
generators (Suno, Udio, and similar). It also documents the **built-in
procedural match audio** so you know what's already covered.

## The sound of LUDUS

Aim for a coherent palette across everything:

- **Genre:** dark ambient / cinematic synth / cold electronica. Think
  *Blade Runner 2049*, *Ghost in the Shell*, *Frozen Synapse*, *Dune* (the quiet
  parts) — brooding, textural, spacious.
- **Mood:** a corporate-dystopian **broadcast blood-sport**. Cold neon, restraint,
  tension held rather than released. This is a cerebral management game first —
  the music should sit **under** the numbers, never bombard.
- **Instrumentation:** analogue synth pads, sub bass, granular textures, sparse
  metallic percussion, filtered noise, occasional detuned arps. Minimal melody.
- **Loudness:** master everything **quiet and headroom-rich** (around −16 to
  −20 LUFS). The game is played for long sessions; nothing should fatigue.
- **Format:** export loopable tracks as seamless loops (no fade at the seam);
  stings as one-shots. WAV or high-bitrate OGG/MP3; keep files small.

Use `[instrumental]` (no vocals) in every prompt.

---

## Loopable beds

### 1. Main menu theme
*Purpose:* first impression; sets the world. Plays on the title / stable-pick.
*Length:* 60–120s, seamless loop.

> [instrumental] Dark cinematic sci-fi ambient. A slow, brooding synth pad in a
> minor key over a deep sub bass drone; distant metallic reverberations and a
> faint, cold arpeggio that never resolves. Corporate-dystopian, neon-noir,
> restrained and mysterious. ~65 BPM, spacious, loopable, no drums. Blade Runner
> 2049 meets Frozen Synapse.

### 2. Management ambience (between matches)
*Purpose:* the long background loop for roster, tactics, contracts, tables. Must
be almost subliminal — you'll hear it for minutes at a time.
*Length:* 2–4 min, seamless loop.

> [instrumental] Minimal dark-ambient bed for a strategy interface. Slow evolving
> synth drone, soft filtered noise washes, a single low pulse every few bars,
> tiny granular details. No melody, no percussion, no build — calm, cold,
> focused, unobtrusive. ~60 BPM feel, very quiet, seamless loop. Sound design more
> than music.

*(Optional variant 2b — a slightly warmer version for the off-season / youth
intake screens: same as above but "a touch warmer, a faint hopeful major-key
pad underneath.")*

### 3. Pre-match tension
*Purpose:* the briefing / walk-out moment; builds anticipation without payoff.
*Length:* 30–60s loop, or a one-shot that settles into a loop.

> [instrumental] Rising tension bed before a fight. A low pulsing synth ostinato,
> tightening filtered noise, a slow swelling pad, sparse metallic hits marking
> time. Cold, coiled, anticipatory — held tension, no release. ~90 BPM, dark
> electronica, loopable.

### 4. Match combat layer (optional — see note below)
*Purpose:* an optional fuller track to lay over the built-in procedural bed for
big matches (finals, cup).
*Length:* 1–2 min loop.

> [instrumental] Driving but minimal dark techno for a futuristic arena bout.
> Relentless sub-bass pulse, tight muted percussion, a cold detuned synth stab
> on the off-beat, industrial metallic textures. Tense and propulsive but not
> melodic or heroic — clinical violence. ~120 BPM, loopable, no vocals.

---

## Stings & one-shots (2–6 seconds)

### 5. Victory
> [instrumental] Short cold-triumph sting, ~4s. A rising synth swell resolving to
> a bright metallic chord with a sub-bass drop; restrained, not fanfare — a
> corporate win, not a hero's. Dark sci-fi.

### 6. Defeat
> [instrumental] Short defeat sting, ~4s. A descending detuned synth figure
> collapsing into a low drone; muted, cold, resigned. Dark sci-fi, no drums.

### 7. Contract won / research breakthrough
> [instrumental] Short positive UI sting, ~3s. A clean ascending synth arpeggio
> with a soft bright bell and a subtle sub thump; hopeful but understated,
> hi-tech. Dark electronica.

### 8. Sacked / game over
*Purpose:* the career-ending screen. This one can breathe.
*Length:* 15–30s, one-shot (may settle into a bleak loop).

> [instrumental] Bleak, final game-over piece, ~20s. A slow minor synth pad
> deflating over a hollow sub drone, a single distant tolling metallic note, cold
> reverb, then silence. Corporate-dystopian, resigned, the end of a career.

### 9. Champion / season title
> [instrumental] Cold-victory cue for winning a league, ~8s. A slow triumphant
> synth pad swell with a bright arpeggio and a deep sub, dignified and expensive-
> sounding rather than joyful. Dark cinematic sci-fi.

---

## UI SFX (short, designed rather than generated)

AI music tools are weak at these; a free SFX library (or a synth) is better.
Keep them dry, short, and quiet:

- **Click / navigate:** a soft, short digital tick (~30–60ms).
- **Confirm / buy:** a two-note ascending blip.
- **Cancel / invalid:** a single low muted thunk.
- **Bid placed:** a short "commit" swell.
- **New message / news:** a faint single soft chime.

---

## Note: the match already has built-in audio

Matches ship with **procedural, synthesised audio** (`src/ui/matchView/audio.ts`)
— no files required:

- A **subtle ambient drone bed** plays while a round is live (a quiet detuned
  low drone through a slowly drifting lowpass filter).
- A **soft "down" cue** fires each time a fighter falls.
- A **🔊 / 🔇 toggle** in the match top bar mutes it; the choice is remembered.

So tracks **2, 3, and 4** above are optional enhancements for the match, while the
menu, management, sting, and game-over tracks are the ones most worth sourcing.

### Wiring generated tracks in later

If you add real audio files, follow the same pattern as `matchView/audio.ts`:
create a tiny playback module that respects the existing mute toggle
(`isSoundOn` / `setSoundOn`), start/stop loops from the relevant screen's
`useEffect`, and keep master volume low. Put files in `src/assets/audio/` and
import them so Vite fingerprints them.
