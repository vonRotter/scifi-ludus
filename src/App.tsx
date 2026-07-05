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
import { IntroScreen } from './ui/screens/IntroScreen';
import { HelpScreen } from './ui/screens/HelpScreen';
import { TutorialCoach } from './ui/screens/TutorialCoach';
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
  | { name: 'help' }
  | { name: 'fighter'; id: string }
  | { name: 'match'; fixtureId: string };

export type Navigate = (route: Route) => void;

interface NavTab { name: Route['name']; label: string; title: string }

/**
 * The nav, grouped into plain-language sections so it reads as four small
 * clusters instead of fourteen loose tabs. "Squad" is everyone you employ;
 * "Line-up" is the six you actually field. "Schedule" (was Fixtures) is where
 * you play your next match.
 */
const NAV_GROUPS: { label: string; tabs: NavTab[] }[] = [
  {
    label: 'Team',
    tabs: [
      { name: 'roster', label: 'Squad', title: 'Every fighter in your stable' },
      { name: 'lineup', label: 'Line-up', title: 'Pick the six who take the field next match, and set tactics' },
      { name: 'training', label: 'Training', title: 'Choose what your squad works on each week' },
      { name: 'recruit', label: 'Recruit', title: 'Sign free agents to your stable' },
    ],
  },
  {
    label: 'Season',
    tabs: [
      { name: 'fixtures', label: 'Schedule', title: 'Your match schedule — play your next match here' },
      { name: 'table', label: 'Table', title: 'League standings' },
      { name: 'cup', label: 'Cup', title: 'The knockout cup bracket' },
      { name: 'news', label: 'News', title: 'Latest results and headlines' },
      { name: 'history', label: 'History', title: 'Past seasons, champions and your hall of fame' },
    ],
  },
  {
    label: 'Stable',
    tabs: [
      { name: 'facilities', label: 'Facilities', title: 'Upgrade your ludus — training, medbay, stadium and more' },
      { name: 'contracts', label: 'Contracts', title: 'Bid on corporation R&D contracts for permanent combat edges' },
      { name: 'menagerie', label: 'Menagerie', title: 'Acquire and tame beasts (needs the Menagerie facility)' },
    ],
  },
  {
    label: 'More',
    tabs: [
      { name: 'save', label: 'Save', title: 'Save or export your game' },
      { name: 'help', label: 'Help', title: 'How to play' },
    ],
  },
];

export default function App() {
  const game = useGame();
  const [route, setRoute] = useState<Route>({ name: 'fixtures' });

  if (!game) return <MainMenu />;
  // A sacked manager's career is over — the game-over screen takes the whole view.
  if (game.careerOver) return <GameOverScreen game={game} />;
  // First run: a one-time intro takes over until the manager dismisses it.
  if (!game.introSeen) return <IntroScreen game={game} />;

  const navigate: Navigate = (r) => setRoute(r);
  const team = playerTeam(game);

  // The match screen takes over the whole view (no nav) until it's finished.
  const coach = game.tutorial ? <TutorialCoach game={game} route={route} navigate={navigate} /> : null;

  if (route.name === 'match') {
    return (
      <>
        <MatchScreen game={game} fixtureId={route.fixtureId} navigate={navigate} />
        {coach}
      </>
    );
  }

  return (
    <>
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
        {NAV_GROUPS.map((g) => {
          // The Menagerie only appears once its facility is built — no dead tab.
          const tabs = g.tabs.filter((t) => t.name !== 'menagerie' || team.facilities.menagerie > 0);
          if (tabs.length === 0) return null;
          return (
            <div className="nav-group" key={g.label}>
              <span className="nav-group-head">{g.label}</span>
              {tabs.map((t) => (
                <button
                  key={t.name}
                  title={t.title}
                  className={route.name === t.name ? 'active' : ''}
                  onClick={() => navigate({ name: t.name } as Route)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        })}
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
        {route.name === 'help' && <HelpScreen />}
      </div>
    </div>
    {coach}
    </>
  );
}
