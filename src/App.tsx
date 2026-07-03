/**
 * App shell: routing between screens and the main menu.
 *
 * Single responsibility: hold the current view (UI-only navigation state) and
 * render the matching screen. Contains no game rules — it reads game state via
 * the store hook and delegates everything else to screens.
 */

import { useState } from 'react';
import { useGame } from './ui/useGame';
import { MainMenu } from './ui/screens/MainMenu';
import { RosterScreen } from './ui/screens/RosterScreen';
import { FighterScreen } from './ui/screens/FighterScreen';
import { LineupScreen } from './ui/screens/LineupScreen';
import { FixturesScreen } from './ui/screens/FixturesScreen';
import { TableScreen } from './ui/screens/TableScreen';
import { CupScreen } from './ui/screens/CupScreen';
import { TrainingScreen } from './ui/screens/TrainingScreen';
import { RecruitScreen } from './ui/screens/RecruitScreen';
import { NewsScreen } from './ui/screens/NewsScreen';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { FacilitiesScreen } from './ui/screens/FacilitiesScreen';
import { ContractsScreen } from './ui/screens/ContractsScreen';
import { MenagerieScreen } from './ui/screens/MenagerieScreen';
import { SaveScreen } from './ui/screens/SaveScreen';
import { MatchScreen } from './ui/screens/MatchScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';
import { playerTeam } from './state/gameState';
import { reputationTier } from './engine/reputation';

export type Route =
  | { name: 'roster' }
  | { name: 'lineup' }
  | { name: 'training' }
  | { name: 'fixtures' }
  | { name: 'news' }
  | { name: 'table' }
  | { name: 'cup' }
  | { name: 'history' }
  | { name: 'recruit' }
  | { name: 'facilities' }
  | { name: 'contracts' }
  | { name: 'menagerie' }
  | { name: 'save' }
  | { name: 'fighter'; id: string }
  | { name: 'match'; fixtureId: string };

export type Navigate = (route: Route) => void;

const TABS: { name: Route['name']; label: string }[] = [
  { name: 'roster', label: 'Roster' },
  { name: 'lineup', label: 'Lineup & Tactics' },
  { name: 'training', label: 'Training' },
  { name: 'fixtures', label: 'Fixtures' },
  { name: 'news', label: 'News' },
  { name: 'table', label: 'Table' },
  { name: 'cup', label: 'Cup' },
  { name: 'history', label: 'History' },
  { name: 'recruit', label: 'Recruit' },
  { name: 'menagerie', label: 'Genelab' },
  { name: 'contracts', label: 'Contracts' },
  { name: 'facilities', label: 'Facilities' },
  { name: 'save', label: 'Save' },
];

export default function App() {
  const game = useGame();
  const [route, setRoute] = useState<Route>({ name: 'fixtures' });

  if (!game) return <MainMenu />;
  // A sacked manager's career is over — the game-over screen takes the whole view.
  if (game.careerOver) return <GameOverScreen game={game} />;

  const navigate: Navigate = (r) => setRoute(r);
  const team = playerTeam(game);

  // The match screen takes over the whole view (no nav) until it's finished.
  if (route.name === 'match') {
    return <MatchScreen game={game} fixtureId={route.fixtureId} navigate={navigate} />;
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>LUDUS</h1>
        <span
          className="sub"
          title={`Your stable's standing across seasons (${team.reputation} rep). Win silverware to climb the tiers and attract better youth.`}
        >
          {team.name.toUpperCase()} — SEASON {game.season} — {reputationTier(team.reputation).toUpperCase()}
        </span>
        <span
          className="sub"
          style={{ marginLeft: 'auto' }}
          title="Your credits on hand. Wages are paid and prize money banked every match week."
        >
          {team.budget}c
        </span>
      </div>
      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.name}
            className={route.name === t.name ? 'active' : ''}
            onClick={() => navigate({ name: t.name } as Route)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="screen">
        {route.name === 'roster' && <RosterScreen game={game} navigate={navigate} />}
        {route.name === 'fighter' && <FighterScreen game={game} fighterId={route.id} navigate={navigate} />}
        {route.name === 'lineup' && <LineupScreen game={game} />}
        {route.name === 'training' && <TrainingScreen game={game} />}
        {route.name === 'fixtures' && <FixturesScreen game={game} navigate={navigate} />}
        {route.name === 'news' && <NewsScreen game={game} />}
        {route.name === 'table' && <TableScreen game={game} />}
        {route.name === 'cup' && <CupScreen game={game} />}
        {route.name === 'history' && <HistoryScreen game={game} />}
        {route.name === 'recruit' && <RecruitScreen game={game} navigate={navigate} />}
        {route.name === 'facilities' && <FacilitiesScreen game={game} />}
        {route.name === 'contracts' && <ContractsScreen game={game} />}
        {route.name === 'menagerie' && <MenagerieScreen game={game} navigate={navigate} />}
        {route.name === 'save' && <SaveScreen game={game} />}
      </div>
    </div>
  );
}
