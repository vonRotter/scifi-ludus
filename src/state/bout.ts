/**
 * Shared bout effects: what a single match does to the fighters who took part.
 *
 * Single responsibility: apply one bout's per-fighter consequences —
 * appearances, healing (league weeks only), fresh injuries (with the squad-floor
 * guard and difficulty scaling), morale, and career wins — and report the
 * injuries and career-enders back to the caller. The league settlement and the
 * cup both build on this, so the rules live in exactly one place.
 *
 * It never touches team budgets, the league table, training, or the news feed —
 * those belong to the specific competition that calls it.
 */

import { SQUAD_SIZE } from '../engine/constants';
import { corpByKey, medicalPerkBonus } from '../engine/corporations';
import { difficultyInjuryMult } from '../engine/difficulty';
import { applyInjuryOutcome, isInjured, recover, rollInjury } from '../engine/injury';
import { moraleAfterBenched, moraleAfterInjury, moraleAfterResult, moraleOf } from '../engine/morale';
import { deriveSeed, makeRng } from '../engine/rng';
import { Fighter, Lineup, Team } from '../engine/types';
import type { GameState, HallOfFamer } from './gameState';

/** One injury a bout produced, for the caller to phrase into news. */
export interface BoutInjury {
  id: string;
  name: string;
  kind: 'serious' | 'ending';
  /** True when the hurt fighter belongs to the player. */
  isPlayer: boolean;
}

export interface BoutEffects {
  /** The updated fighter pool (career-enders are still present; prune separately). */
  fighters: Record<string, Fighter>;
  /** Ids of fighters whose careers ended in this bout. */
  ended: Set<string>;
  /** Snapshots of the player's fallen, for the hall of fame. */
  fallen: HallOfFamer[];
  /** Serious and career-ending injuries, for the caller to report. */
  injuries: BoutInjury[];
}

export interface BoutParams {
  seed: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  fieldedIds: string[];
  /** League weeks heal existing injuries a notch; extra bouts (the cup) do not. */
  heal: boolean;
  /** Fighters to start from (e.g. an already-trained roster); defaults to state's. */
  baseFighters?: Record<string, Fighter>;
}

/**
 * Apply a bout's effects to the fighter pool and report what happened. Pure:
 * returns a fresh fighter map plus the derived facts; the passed state is
 * untouched.
 */
export function applyBoutEffects(state: GameState, params: BoutParams): BoutEffects {
  const { seed, homeTeamId, awayTeamId, homeScore, awayScore, fieldedIds, heal } = params;
  const fighters = { ...(params.baseFighters ?? state.fighters) };

  // Ownership, squad sizes, and medbay levels, read once from the current teams.
  const ownerOf: Record<string, string> = {};
  const headcount: Record<string, number> = {};
  const medbay: Record<string, number> = {};
  for (const t of state.teams) {
    headcount[t.id] = t.fighterIds.length;
    // A Med-Division corp speeds recovery on top of the medbay facility.
    const recovery = t.facilities.medbay + medicalPerkBonus(corpByKey(t.corpKey).perk);
    for (const id of t.fighterIds) {
      ownerOf[id] = t.id;
      medbay[id] = recovery;
    }
  }

  // Appearances for everyone who took the field.
  for (const id of fieldedIds) {
    const f = fighters[id];
    if (f) fighters[id] = { ...f, matchesPlayed: f.matchesPlayed + 1 };
  }

  // A league week's healing (the cup passes heal:false).
  if (heal) {
    for (const id of Object.keys(fighters)) {
      fighters[id] = recover(fighters[id], medbay[id] ?? 0);
    }
  }

  // Fresh injuries for the fielded — with the squad-floor guard so no team is
  // ever left unable to field six mid-season.
  const injRng = makeRng(deriveSeed(seed, 0x1273));
  const injuryMult = difficultyInjuryMult(state.difficulty);
  const ended = new Set<string>();
  const fallen: HallOfFamer[] = [];
  const injuries: BoutInjury[] = [];
  const seriouslyHurt = new Set<string>();
  const note = (id: string, kind: 'serious' | 'ending') =>
    injuries.push({ id, name: fighters[id].name, kind, isPlayer: ownerOf[id] === state.playerTeamId });

  for (const id of fieldedIds) {
    const f = fighters[id];
    if (!f || isInjured(f)) continue;
    const outcome = rollInjury(f, injRng, injuryMult);
    if (outcome.kind === 'ending') {
      const owner = ownerOf[id];
      if (owner && headcount[owner] <= SQUAD_SIZE) {
        fighters[id] = applyInjuryOutcome(f, { kind: 'serious', weeks: 6, statLoss: 'stamina' });
        seriouslyHurt.add(id);
        note(id, 'serious');
      } else {
        ended.add(id);
        if (owner) headcount[owner]--;
        note(id, 'ending');
        if (owner === state.playerTeamId) {
          fallen.push({
            id, name: f.name, bodyType: f.bodyType, apps: f.matchesPlayed,
            wins: f.wins ?? 0, season: state.season, cause: 'fell',
          });
        }
      }
    } else {
      fighters[id] = applyInjuryOutcome(f, outcome);
      if (outcome.kind === 'serious') {
        seriouslyHurt.add(id);
        note(id, 'serious');
      }
    }
  }

  // Morale and career wins: the fielded ride the result (worse if hurt); fit
  // fighters left on the bench chafe for want of action.
  const homeOutcome = outcomeFor(homeScore, awayScore);
  const awayOutcome = outcomeFor(awayScore, homeScore);
  const fieldedSet = new Set(fieldedIds);
  for (const teamId of [homeTeamId, awayTeamId]) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) continue;
    const outcome = teamId === homeTeamId ? homeOutcome : awayOutcome;
    for (const id of team.fighterIds) {
      const f = fighters[id];
      if (!f) continue;
      if (fieldedSet.has(id)) {
        let m = moraleAfterResult(moraleOf(f), outcome);
        if (seriouslyHurt.has(id)) m = moraleAfterInjury(m);
        fighters[id] = { ...f, morale: m, wins: (f.wins ?? 0) + (outcome === 'win' ? 1 : 0) };
      } else if (!isInjured(f)) {
        fighters[id] = { ...f, morale: moraleAfterBenched(moraleOf(f)) };
      }
    }
  }

  return { fighters, ended, fallen, injuries };
}

/** The result ('win'|'draw'|'loss') for a side, given its score and the other's. */
export function outcomeFor(forScore: number, against: number): 'win' | 'draw' | 'loss' {
  return forScore > against ? 'win' : forScore < against ? 'loss' : 'draw';
}

/**
 * Remove career-ended fighters from the pool, every squad, and the player's
 * saved lineup. Mutates the passed (already-cloned) fighter map for the delete;
 * returns fresh teams and lineup.
 */
export function pruneEnded(
  fighters: Record<string, Fighter>,
  teams: Team[],
  lineup: Lineup,
  ended: Set<string>,
): { teams: Team[]; playerLineup: Lineup } {
  if (ended.size === 0) return { teams, playerLineup: lineup };
  for (const id of ended) delete fighters[id];
  return {
    teams: teams.map((t) => ({ ...t, fighterIds: t.fighterIds.filter((id) => !ended.has(id)) })),
    playerLineup: {
      ...lineup,
      fighterIds: lineup.fighterIds.filter((id) => !ended.has(id)),
      tactics: {
        ...lineup.tactics,
        roles: Object.fromEntries(Object.entries(lineup.tactics.roles).filter(([id]) => !ended.has(id))),
      },
    },
  };
}
