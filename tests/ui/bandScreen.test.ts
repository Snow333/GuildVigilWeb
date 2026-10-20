/**
 * The band screen (M4) — the component, rendered from a REAL `readBands` view
 * of a REAL session. (There is no jsdom in this repo, so this renders to static
 * markup and reads it back; the e2e spec clicks the same screen in a browser.)
 *
 * What this file guards that bandPicks.test.ts cannot: that the SCREEN actually
 * draws what the module decided — a Send button only where `canSend`, each
 * band's own word and reason verbatim, the out band locked, the sim's error
 * printed untouched — and that the component carries no rule of its own.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BandBoard, type BandBoardProps } from '../../src/ui/screens/BandBoard';
import { oddsKey, readBands } from '../../src/ui/screens/bandPicks';
import { realGuild, levelUp } from './bandFixtures';
import type { CampaignSession } from '@sim/campaign/session';

const noop = (): void => undefined;

function render(s: CampaignSession, over: Partial<BandBoardProps> = {}): { html: string; view: ReturnType<typeof readBands> } {
  const view = readBands(s);
  const props: BandBoardProps = {
    view, rosterOpen: false, odds: {}, error: null,
    onBack: noop, onSend: noop, onOdds: noop, onMove: noop, onToggleRoster: noop, onLaunchHeld: noop, onCallBack: noop,
    ...over,
  };
  return { html: renderToStaticMarkup(createElement(BandBoard, props)), view };
}

/** Every `<td …>…</td>` — cells never nest, so a lazy match is exact. */
const cells = (html: string): string[] => html.match(/<td[^>]*data-cell=[\s\S]*?<\/td>/g) ?? [];
const cellOf = (html: string, quest: number, band: number): string =>
  cells(html).find((c) => c.includes(`data-cell="${quest}"`) && c.includes(`data-band="${band}"`))!;
const count = (html: string, needle: string | RegExp): number =>
  needle instanceof RegExp ? (html.match(needle) ?? []).length : html.split(needle).length - 1;
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('1 band: a locked second column and no Send for a band that does not exist', () => {
  const { html, view } = render(realGuild({ bands: 1, hall: 2, gains: [2] }));

  it('draws one band column and the locked teaser', () => {
    expect(count(html, 'data-bandhead=')).toBe(1);
    expect(html).toContain('data-locked-band="1"');
    expect(text(html)).toContain('Band 2 locked · upgrade the Barracks');
    expect(count(html, '<col ')).toBe(3); // job + 1 band + locked
  });

  it('every posting has exactly one Send, for Band 1', () => {
    const sends = html.match(/data-send="(\d+):(\d+)"/g) ?? [];
    expect(sends.length).toBe(view.jobs.length);
    expect(sends.every((x) => x.startsWith('data-send="0:'))).toBe(true);
    expect(text(html)).not.toContain('Send Band 2');
  });

  it('shows the plates with the Barracks and Guild Hall numbers kept apart', () => {
    expect(html).toMatch(/BANDS <b data-plate-bands="">1 of 3<\/b>/);
    expect(html).toContain(`${view.plates.heroes} of ${view.plates.beds}`);
    expect(text(html)).toContain(`MARCH ${view.plates.march} per band`);
  });
});

describe('2 bands: each cell is that band\'s own reading, verbatim', () => {
  // Band 1 level 7, Band 2 level 1: the same posting reads differently
  const s = realGuild({ bands: 2, hall: 2, gains: [6, 0], hallLevels: [3, 0], weeks: 8 });
  const { html, view } = render(s);

  it("prints each band's own word AND reason, exactly as board(i) gave them", () => {
    let checked = 0;
    for (const b of [0, 1]) {
      for (const e of s.board(b)) {
        const c = cellOf(html, e.questId, b);
        expect(c, `job ${e.questId} band ${b + 1}`).toContain(`>${e.difficulty.label}<`);
        expect(c).toContain(`data-reason="">${e.difficulty.reason}<`);
        expect(c).toContain(`gv-difficulty--s${e.difficulty.tier}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(4);
    // coverage: the two bands do NOT read every job alike
    const differing = view.jobs.filter((j) => j.cells[0]!.word?.id !== j.cells[1]!.word?.id).length;
    expect(differing).toBeGreaterThan(0);
  });

  it('stars exactly the cells the module starred, and no cell twice per band', () => {
    const starred = view.jobs.flatMap((j) => j.cells.filter((c) => c.best).map((c) => `${c.questId}:${c.band}`));
    const drawn = (html.match(/data-best-fit/g) ?? []).length;
    expect(drawn).toBe(starred.length);
    expect(starred.length).toBe(view.bestByBand.filter((x) => x !== null).length);
    for (const key of starred) {
      const [q, b] = key.split(':').map(Number);
      expect(cellOf(html, q!, b!)).toContain('data-best-fit');
    }
  });

  it('warns on a Beyond-us Send without hiding it', () => {
    const risky = view.jobs.flatMap((j) => j.cells).filter((c) => c.risky);
    expect(risky.length).toBeGreaterThan(0);
    for (const c of risky) expect(cellOf(html, c.questId, c.band)).toContain('title="Beyond them. Expect losses."');
    const safe = view.jobs.flatMap((j) => j.cells).find((c) => c.kind === 'send' && !c.risky)!;
    expect(cellOf(html, safe.questId, safe.band)).not.toContain('Expect losses');
  });

  it('prints the hall strip with the sim\'s own level hints', () => {
    expect(view.hall).toHaveLength(2);
    for (const h of view.hall) {
      const li = html.match(new RegExp(`<li class="gv-bd-hh"[^>]*data-hall-hero="${h.id}"[\\s\\S]*?</li>`))![0];
      for (const m of h.moves) {
        expect(li).toContain(`data-move="${h.id}:${m.to}"`);
        expect(li).toContain(`(level ${m.hint})`);
      }
    }
    const t = text(html);
    expect(t).toMatch(/level stays \d+/);
    expect(t).toMatch(/level \d+ → \d+/);
  });

  it('draws free seats up to the Guild Hall cap', () => {
    expect(count(html, 'gv-bd-freeslot')).toBe(view.bands.reduce((n, b) => n + b.freeSlots, 0));
  });
});

describe('3 bands, one out on a job', () => {
  const s = realGuild({ bands: 3, seats: [4, 4, 2], hall: 1, gains: [5, 2, 0], weeks: 6 });
  const job = s.board(1)[0]!.questId;
  s.acceptQuest(job, 1);
  const { html, view } = render(s);

  it('greys the out band and draws NO Send in its column', () => {
    expect(count(html, 'data-bandhead=')).toBe(3);
    expect(html).toMatch(/data-bandhead="1" data-out=""/);
    for (const c of cells(html).filter((x) => x.includes('data-band="1"'))) {
      expect(c).not.toContain('data-send');
      expect(c).not.toContain('data-odds');
    }
    // the other two bands still send
    expect(count(html, /data-send="0:/g)).toBeGreaterThan(0);
    expect(count(html, /data-send="2:/g)).toBeGreaterThan(0);
  });

  it('says what the band is out on, and offers to launch or call it back', () => {
    const head = html.match(/<th[^>]*data-bandhead="1"[\s\S]*?<\/th>/)![0];
    expect(head).toContain('OUT ON A JOB');
    expect(head).toContain(s.questName(job));
    expect(head).toContain('data-launch-held="1"');
    expect(head).toContain('data-call-back="1"');
    // …and only the out band gets those buttons
    expect(count(html, 'data-launch-held=')).toBe(1);
  });

  it('shows the held job as a row: "on this job" for the holder, "taken" for the rest', () => {
    expect(cellOf(html, job, 1)).toContain('Band 2 is on this job');
    expect(cellOf(html, job, 0)).toContain('Taken by Band 2');
    expect(cellOf(html, job, 2)).toContain('Taken by Band 2');
    expect(text(html)).toContain('On the road. Not on the board.');
  });

  it('three bands means no locked teaser and three even band columns', () => {
    expect(html).not.toContain('data-locked-band');
    const widths = (html.match(/<col style="width:([\d.]+)%"/g) ?? []).map((x) => Number(x.replace(/[^\d.]/g, '')));
    expect(widths).toEqual([25, 25, 25, 25]);
  });

  it('locks the out band in the roster editor: no move buttons, a "locked" tag', () => {
    const open = render(s, { rosterOpen: true }).html;
    const col = (b: string) => open.match(new RegExp(`<div class="gv-bd-col" data-roster-col="${b}">[\\s\\S]*?</ul>`))![0];
    expect(col('1')).toContain('data-locked');
    expect(col('1')).not.toContain('data-move');
    expect(count(col('1'), 'data-roster-hero=')).toBe(4);
    // the others keep their buttons
    expect(col('0')).toContain('data-move');
    expect(col('2')).toContain('data-move');
  });

  it('disables a hall hero\'s move into the out band, with the reason as a tooltip', () => {
    const hero = view.hall[0]!;
    const li = html.match(new RegExp(`<li class="gv-bd-hh"[^>]*data-hall-hero="${hero.id}"[\\s\\S]*?</li>`))![0];
    const btn = li.match(new RegExp(`<button[^>]*data-move="${hero.id}:1"[^>]*>`))![0];
    expect(btn).toContain('disabled=""');
    expect(btn).toContain('title="Band 2 is out on a job"');
    const live = li.match(new RegExp(`<button[^>]*data-move="${hero.id}:2"[^>]*>`))![0]; // Band 3 has room
    expect(live).not.toContain('disabled');
  });
});

describe('an EMPTY band', () => {
  const s = realGuild({ bands: 2, seats: [4, 0], hall: 2, gains: [3] });
  const { html, view } = render(s);

  it('has no Send and no odds button in any cell, and says nobody is there', () => {
    for (const c of cells(html).filter((x) => x.includes('data-band="1"'))) {
      expect(c).not.toContain('data-send');
      expect(c).not.toContain('data-odds');
      expect(c).toContain('Band 2 has no heroes');
    }
    const head = html.match(/<th[^>]*data-bandhead="1"[\s\S]*?<\/th>/)![0];
    expect(head).toContain('Nobody yet');
    expect(head).toContain('EMPTY');
    expect(head).not.toContain('data-level-value');
    expect(view.bands[1]!.empty).toBe(true);
  });

  it('offers the hall heroes a way in, worded "starts at N"', () => {
    expect(text(html)).toMatch(/\+ Band 2 \(level starts at \d+\)/);
  });
});

describe('the rest of the screen', () => {
  it("prints the sim's refusal VERBATIM", () => {
    const sentence = 'acceptQuest: party 2 has no heroes — assign someone before taking a job';
    const { html } = render(realGuild({ bands: 2 }), { error: sentence });
    expect(html).toContain(`<b>!</b> ${sentence}`);
    expect(render(realGuild({ bands: 2 })).html).not.toContain('data-bd-error');
  });

  it('keeps the roster editor folded until asked, then shows every band and the hall', () => {
    const s = realGuild({ bands: 2, hall: 1, gains: [2, 0] });
    const shut = render(s).html;
    expect(shut).not.toContain('data-roster-open');
    expect(shut).toContain('aria-expanded="false"');
    expect(text(shut)).toMatch(/Band 1: 4 · Band 2: 4 · Hall: 1/);
    const open = render(s, { rosterOpen: true }).html;
    expect(open).toContain('data-roster-open');
    expect(open).toContain('aria-expanded="true"');
    expect(count(open, 'data-roster-col=')).toBe(3); // two bands + the hall
  });

  it('words wounded and down heroes (never colour alone)', () => {
    const s = realGuild({ bands: 1, hall: 1 });
    const id = s.partyRosters()[0]![0]!;
    s.heroState(id).wounded = 3;
    const { html } = render(s);
    expect(html).toMatch(/data-wounded="3">Wounded 3</);
  });

  it('shows a cached forecast under its cell and the button until then', () => {
    const s = realGuild({ bands: 2, gains: [3, 0] });
    const view = readBands(s);
    const job = view.jobs[0]!.questId;
    const bare = render(s).html;
    expect(cellOf(bare, job, 0)).toContain(`data-odds="0:${job}"`);
    const shown = render(s, { odds: { [oddsKey(view, 0, job)]: { text: 'Wins 17 of 20 · no wipes', bad: false } } }).html;
    expect(cellOf(shown, job, 0)).toContain('Wins 17 of 20 · no wipes');
    expect(cellOf(shown, job, 0)).not.toContain('data-odds=');
    // another band's cell for the same job is untouched
    expect(cellOf(shown, job, 1)).toContain(`data-odds="1:${job}"`);
  });

  it('says so when the board is bare', () => {
    const s = realGuild({ bands: 1 });
    const view = readBands(s);
    const bare = { ...view, jobs: [], postedCount: 0 };
    const html = renderToStaticMarkup(createElement(BandBoard, {
      view: bare, rosterOpen: false, odds: {}, error: null,
      onBack: noop, onSend: noop, onOdds: noop, onMove: noop, onToggleRoster: noop, onLaunchHeld: noop, onCallBack: noop,
    }));
    expect(html).toContain('data-board-empty');
    expect(html).toContain('0 jobs posted');
  });
});

describe('the component owns no rules', () => {
  const src = (f: string): string => readFileSync(join(process.cwd(), 'src', 'ui', 'screens', f), 'utf8');

  it('BandBoard.tsx imports nothing from the sim and computes no difficulty, level, rank or cap', () => {
    const code = src('BandBoard.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const banned of ['@sim/', 'difficultyFor', 'partyLevel', 'maxPartySize', 'heroCapacity', '.sort(', '.full', '.empty &&']) {
      expect(code, `BandBoard.tsx must not contain ${banned}`).not.toContain(banned);
    }
  });

  it('the Bands button, screen union entry and router case exist', () => {
    expect(src('TownHub.tsx')).toMatch(/data-nav-bands=""[\s\S]{0,60}nav\(\{ kind: 'bands' \}\)[\s\S]{0,12}>Bands</);
    expect(readFileSync(join(process.cwd(), 'src', 'ui', 'state', 'GameProvider.tsx'), 'utf8')).toContain("{ kind: 'bands' }");
    expect(readFileSync(join(process.cwd(), 'src', 'ui', 'App.tsx'), 'utf8')).toMatch(/case 'bands':\s+return <BandScreen \/>/);
  });

  it('a level-up does move the printed level (the plate is read from the session, not cached)', () => {
    const s = realGuild({ bands: 1, gains: [1] });
    const before = text(render(s).html).match(/LEVEL (\d+)/)![1];
    for (const id of s.partyRosters()[0]!) levelUp(s, id, 2);
    const after = text(render(s).html).match(/LEVEL (\d+)/)![1];
    expect(Number(after)).toBeGreaterThan(Number(before));
  });
});
