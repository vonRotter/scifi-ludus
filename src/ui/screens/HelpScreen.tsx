/**
 * Help: a standing reference for how the game works, reachable from the nav any
 * time. Presentation only — static explanatory content, no rules, no actions.
 */

export function HelpScreen() {
  return (
    <div>
      <h2>How it works</h2>
      <p className="muted">
        You manage a combat stable through a season on the LUDUS circuit. You never
        see exact truth about a fighter — values show as estimates that sharpen with
        appearances and scouting, and faster for the stats a fighter actually uses in
        the arena. Hover any ⓘ for specifics.
      </p>

      <h3>Matches</h3>
      <p className="muted">
        Everyone plays everyone home and away. For your games, set six fighters and
        tactics, then watch two rounds of dot-combat. Between them you get one
        <strong> half-time</strong> adjustment (posture &amp; focus); your opponent
        adjusts too. <strong>Posture</strong> trades damage for protection;
        <strong> focus</strong> pushes the squad toward melee, ranged, or the central
        objective. Each fighter's <strong>role</strong> (front line / skirmisher /
        hold back) sets how it moves. Points come from two sources — downing opponents
        and holding the objective zone — and the scorebar splits them so you can see
        which is winning it. Some <strong>arenas</strong> add hazards: ion vents that
        burn (some pulse on a cycle — cross while they're dark) and grav-shear that
        drags. A pre-match <strong>briefing</strong> reads the opponent — sharpen it by
        upgrading your Recon Network.
      </p>

      <h3>Your squad</h3>
      <p className="muted">
        Field a balance of body types — a brute, a marksman, a sentinel all reach
        effectiveness by different routes. Fighters carry hidden <strong>augments</strong>,
        gain from weekly <strong>training</strong>, can be <strong>injured</strong>, and
        <strong> age</strong> toward retirement. To <strong>recruit</strong>, send your
        scout into the field — they turn up free agents over a few weeks; scout a prospect
        further to narrow the fog before you sign. The <strong>Genelab</strong> decants
        gene-forged war-forms. <strong>Facilities</strong> permanently improve training,
        scouting, combat kit, recovery, roster size, and gate income — but build one at a
        time, over several match weeks.
      </p>

      <h3>The transfer market</h3>
      <p className="muted">
        Prove a fighter and their wage climbs; <strong>re-sign</strong> them before their
        contract lapses or they walk to free agency. Rivals notice your best and will
        <strong> bid</strong> for them — bank the credits by selling, or refuse and take a
        small morale hit. You can <strong>poach</strong> a rival's fighter too, for a
        premium fee. Handle all of it on the Recruit screen.
      </p>

      <h3>Corporations &amp; contracts</h3>
      <p className="muted">
        Every stable is backed by a <strong>corporation</strong> with a specialty, a
        perk, and rivals it won't arm. On <strong>Contracts</strong> you bid against rival
        stables for procurement work (credits + standing + corp favour decide it). Fulfil
        a contract by spending <strong>research</strong> (build the R&amp;D Lab, or
        commission prototypes) and <strong>winning bouts</strong> before its deadline. The
        reward is a permanent <strong>specialization</strong> — and it's conditional: a
        melee specialization only sharpens melee attacks. Deliver for a corp and it
        favours you next time; its rivals cool on you.
      </p>

      <h3>Your career</h3>
      <p className="muted">
        You answer to a <strong>sponsor</strong>. Each season they set an objective and
        their confidence rises when you deliver and falls when you don't. Let it reach
        zero and you're <strong>sacked</strong> — the career ends. The Fixtures screen
        warns you when your seat is under threat. Money matters every week: wages go out,
        prize money and gate receipts come in. Spend on the squad, or bank it for a
        contract bid — but don't go broke.
      </p>
    </div>
  );
}
