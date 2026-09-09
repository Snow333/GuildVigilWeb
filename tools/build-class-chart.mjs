#!/usr/bin/env node
/**
 * build-class-chart.mjs
 *
 * Reads  output/reference/class-progression-sheets.md
 * Writes output/reference/class-progression-chart.html
 *
 * The chart is a pure read-out of the sheets markdown, which is itself generated
 * from the live registries in src/content/generated/. Regenerate rather than
 * hand-editing either file:
 *
 *     node tools/build-class-chart.mjs
 *
 * Exit code is non-zero if the parse loses data (row/feat counts are asserted).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'output', 'reference', 'class-progression-sheets.md');
const OUT = join(ROOT, 'output', 'reference', 'class-progression-chart.html');

const EMDASH = '\u2014';
const MIDDOT = '\u00b7';
const TIER_ORDER = { trained: 1, expert: 2, master: 3, legendary: 4 };
const TIER_BONUS = { trained: '+0', expert: '+2', master: '+4', legendary: '+6' };
const ROLE_ACCENT = {
  martial: ['#e0783c', '#3a2418'],
  skill: ['#5fb37a', '#16301f'],
  caster: ['#8f7bd6', '#241f3a'],
  hybrid: ['#4fa3c7', '#152b38'],
};

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const num = (s) => {
  const m = /-?\d+/.exec(s ?? '');
  return m ? parseInt(m[0], 10) : 0;
};
const slotVal = (s) => (/\d/.test(s ?? '') ? num(s) : 0);
const clean = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const slug = (s) => 'p-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cells = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((p) => p.trim());

// ----------------------------------------------------------------- parse

function parse(md) {
  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    if (l.startsWith('## ')) heads.push([i, l.slice(3).trim()]);
  });

  const classes = [];
  for (let hi = 0; hi < heads.length; hi++) {
    const [start, title] = heads[hi];
    if (/^(The shared model|Appendix)/.test(title)) continue;
    const end = hi + 1 < heads.length ? heads[hi + 1][0] : lines.length;
    const body = lines.slice(start, end);

    const prestige = title.includes('(prestige)');
    const name = title.replace('*(prestige)*', '').trim();

    let i = 1;
    while (i < body.length && !body[i].trim()) i++;
    let tagline = '';
    if (body[i] && body[i].trim().startsWith('*')) {
      tagline = body[i].trim().replace(/^\*+|\*+$/g, '').trim();
      i++;
    }
    const blurbParts = [];
    while (i < body.length && body[i].trim() && !body[i].startsWith('|')) {
      blurbParts.push(body[i].trim());
      i++;
    }
    const blurb = blurbParts.join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

    const stats = {};
    const tiers = [];
    const levels = [];
    const slots = [];
    const feats = [];
    const notes = [];
    let mode = null;

    for (const line of body.slice(i)) {
      const s = line.trim();
      if (s === '| | |') { mode = 'statbox'; continue; }
      if (s.startsWith('**Proficiency tiers**')) { mode = 'tiers'; continue; }
      if (s.startsWith('### Level table')) { mode = 'levels'; continue; }
      if (s.startsWith('### Spell slots')) { mode = 'slots'; continue; }
      if (s.startsWith('### Class feats')) { mode = 'feats'; continue; }

      if (s.startsWith('|')) {
        const c = cells(line);
        if (/^[-: ]*$/.test(c.join(''))) continue;
        if (mode === 'statbox' && c.length === 2) stats[clean(c[0])] = clean(c[1]);
        else if (mode === 'tiers' && c.length === 2 && c[0] !== 'Stat') tiers.push([clean(c[0]), clean(c[1])]);
        else if (mode === 'levels' && c.length === 9 && c[0] !== 'Lv') levels.push(c.map(clean));
        else if (mode === 'slots' && c.length === 11 && c[0] !== 'Lv') slots.push(c.map(clean));
        continue;
      }

      if (mode === 'feats') {
        const m = /^- \*\*L(\d+)\*\* \((\d+)\): (.*)$/.exec(s);
        if (m) {
          feats.push({
            level: parseInt(m[1], 10),
            count: parseInt(m[2], 10),
            names: m[3].split(MIDDOT).map((x) => x.trim()).filter(Boolean),
          });
        } else if (s.startsWith('**None authored')) notes.push(clean(s));
      } else if (s.startsWith('**') && (mode === 'slots' || s.startsWith('**Pact energy'))) {
        notes.push(clean(s));
      }
    }
    classes.push({ name, prestige, tagline, blurb, stats, tiers, levels, slots, feats, notes });
  }
  return classes;
}

// ------------------------------------------------------- feature splitting

const LADDER_RE = /^(.+?)_(\+?\d+(?:d\d+)?)$/;

function splitFeatures(cls) {
  const n = cls.levels.length;
  const perLevel = cls.levels.map((r) => {
    const raw = r[8];
    return raw.trim() === EMDASH || raw.trim() === '-' || !raw.trim()
      ? []
      : raw.split(',').map((f) => f.trim()).filter(Boolean);
  });

  const counts = new Map();
  for (const fs of perLevel) for (const f of fs) counts.set(f, (counts.get(f) ?? 0) + 1);
  const constant = [...counts.entries()].filter(([, c]) => c === n && n > 1).map(([f]) => f).sort();
  const constantSet = new Set(constant);

  const stems = new Map(); // stem -> Map(level -> value)
  perLevel.forEach((fs, idx) => {
    for (const f of fs) {
      if (constantSet.has(f)) continue;
      const m = LADDER_RE.exec(f);
      if (m) {
        if (!stems.has(m[1])) stems.set(m[1], new Map());
        stems.get(m[1]).set(idx + 1, m[2]);
      }
    }
  });

  const ladders = new Map();
  for (const [stem, lv] of stems) {
    if (new Set([...lv.values()]).size >= 3) ladders.set(stem, lv);
  }

  const ladderMembers = new Set();
  for (const [stem, lv] of ladders) for (const [level, val] of lv) ladderMembers.add(`${level}|${stem}_${val}`);

  const milestones = [];
  perLevel.forEach((fs, idx) => {
    const keep = fs.filter((f) => !constantSet.has(f) && !ladderMembers.has(`${idx + 1}|${f}`));
    if (keep.length) milestones.push([idx + 1, keep]);
  });

  return { constant, ladders, milestones };
}

const pretty = (f) => f.replace(/_/g, ' ');

const parseTiers = (txt) =>
  [...txt.matchAll(/L(\d+)\s+(trained|expert|master|legendary)/g)]
    .map((m) => [parseInt(m[1], 10), m[2]])
    .sort((a, b) => a[0] - b[0]);

// ----------------------------------------------------------- components

function statBadges(cls) {
  const s = cls.stats;
  const order = ['Role', 'Hit die', 'Key ability', 'Skill points/level', 'Casting'];
  const out = [];
  for (const k of order) {
    if (s[k] && s[k] !== EMDASH) {
      out.push(`<div class="badge"><span class="bk">${esc(k)}</span><span class="bv">${esc(s[k])}</span></div>`);
    }
  }
  if (!s.Casting || s.Casting === EMDASH) {
    out.push('<div class="badge muted"><span class="bk">Casting</span><span class="bv">none</span></div>');
  }
  return out.join('');
}

function barTrack(cls) {
  const rows = cls.levels;
  const n = rows.length;
  const bab = rows.map((r) => num(r[1]));
  const saves = rows.map((r) => r[3].split('/').map(num));
  const maxbab = Math.max(...bab) || 1;
  const maxsave = Math.max(...saves.flat()) || 1;

  const h = [`<div class="track" style="--n:${n}">`];

  h.push('<div class="trow"><div class="tlab">Level</div><div class="tcells">');
  for (const r of rows) h.push(`<div class="tcell lvhead">${esc(r[0])}</div>`);
  h.push('</div></div>');

  h.push('<div class="trow"><div class="tlab">Attack bonus<em>BAB</em></div><div class="tcells">');
  for (const v of bab) {
    h.push(
      `<div class="tcell"><div class="vbar" style="--p:${(v / maxbab).toFixed(3)}" title="BAB +${v}"></div><span class="vnum">${v}</span></div>`
    );
  }
  h.push('</div></div>');

  [['Fortitude', 'fort'], ['Reflex', 'ref'], ['Will', 'will']].forEach(([nm, cl], idx) => {
    h.push(`<div class="trow"><div class="tlab">${nm}</div><div class="tcells">`);
    for (const s of saves) {
      const v = s[idx];
      h.push(
        `<div class="tcell"><div class="vbar ${cl}" style="--p:${(v / maxsave).toFixed(3)}" title="${nm} +${v}"></div><span class="vnum">${v}</span></div>`
      );
    }
    h.push('</div></div>');
  });

  for (const [col, nm, cl] of [
    [4, 'Class feat', 'sf-class'],
    [5, 'General', 'sf-gen'],
    [6, 'Ancestry', 'sf-anc'],
    [7, 'Skill feat', 'sf-skill'],
  ]) {
    const vals = rows.map((r) => slotVal(r[col]));
    if (!vals.some((v) => v)) continue;
    const total = vals.reduce((a, b) => a + b, 0);
    h.push(`<div class="trow slotrow"><div class="tlab">${nm}<em>${total} total</em></div><div class="tcells">`);
    for (const v of vals) {
      if (v === 0) h.push('<div class="tcell"><span class="dot off"></span></div>');
      else if (v === 1) h.push(`<div class="tcell"><span class="dot ${cl}"></span></div>`);
      else h.push(`<div class="tcell"><span class="dot ${cl} dbl">${v}</span></div>`);
    }
    h.push('</div></div>');
  }

  const { constant, ladders, milestones } = splitFeatures(cls);
  for (const stem of [...ladders.keys()].sort()) {
    const lv = ladders.get(stem);
    h.push(`<div class="trow ladrow"><div class="tlab">${esc(pretty(stem))}</div><div class="tcells">`);
    let prev = null;
    for (let i = 1; i <= n; i++) {
      const val = lv.get(i);
      if (val === undefined) h.push('<div class="tcell"><span class="lad hold"></span></div>');
      else if (val === prev) h.push(`<div class="tcell"><span class="lad hold" title="${esc(val)}"></span></div>`);
      else h.push(`<div class="tcell"><span class="lad step">${esc(val)}</span></div>`);
      if (val !== undefined) prev = val;
    }
    h.push('</div></div>');
  }

  h.push('</div>');
  return { track: h.join(''), constant, ladders, milestones };
}

function tierBlock(cls) {
  if (!cls.tiers.length) {
    return '<div class="empty">No proficiency-tier rows authored for this class. Its stats fall back to the flat <code>bab / fort / ref / will</code> columns.</div>';
  }
  const n = cls.levels.length;
  const h = ['<div class="tiers">'];
  for (const [name, txt] of cls.tiers) {
    const steps = parseTiers(txt);
    h.push(`<div class="tierrow"><div class="tiername">${esc(name)}</div><div class="tierbar">`);
    let cur = null;
    for (let i = 1; i <= n; i++) {
      for (const [lvl, t] of steps) if (lvl === i) cur = t;
      let klass = cur ? `tg t-${cur}` : 'tg t-none';
      const isNew = steps.some(([lvl]) => lvl === i);
      let label = '';
      if (isNew) {
        klass += ' tnew';
        label = `<span class="tlabel">${cur[0].toUpperCase()}</span>`;
      }
      h.push(`<div class="${klass}" title="L${i}: ${cur ?? 'untrained'}">${label}</div>`);
    }
    h.push('</div><div class="tierpeak">');
    if (steps.length) {
      const peak = steps.reduce((a, b) => (TIER_ORDER[b[1]] >= TIER_ORDER[a[1]] ? b : a));
      h.push(`${esc(peak[1])} <span class="pk">${TIER_BONUS[peak[1]]}</span> @ L${peak[0]}`);
    }
    h.push('</div></div>');
  }
  h.push('</div>');
  return h.join('');
}

function slotsBlock(cls) {
  if (!cls.slots.length) return '';
  const n = cls.levels.length;
  const ranks = ['Cant', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const src = new Map(cls.slots.map((r) => [parseInt(r[0], 10), r.slice(1)]));
  const filled = new Map();
  let cur = new Array(10).fill(EMDASH);
  for (let i = 1; i <= n; i++) {
    if (src.has(i)) cur = src.get(i);
    filled.set(i, [...cur]);
  }

  const h = ['<div class="slots"><div class="srow shead"><div class="slab"></div><div class="scells">'];
  for (let i = 1; i <= n; i++) h.push(`<div class="scell lvhead">${i}</div>`);
  h.push('</div></div>');

  ranks.forEach((rk, ri) => {
    const vals = [];
    for (let i = 1; i <= n; i++) vals.push(filled.get(i)[ri]);
    if (vals.every((v) => v === EMDASH)) return;
    const label = rk === 'Cant' ? 'Cantrips' : `Rank ${rk}`;
    h.push(`<div class="srow"><div class="slab">${label}</div><div class="scells">`);
    for (const v of vals) {
      if (v === EMDASH) h.push('<div class="scell none"></div>');
      else h.push(`<div class="scell heat h${Math.min(num(v), 5)}">${esc(v)}</div>`);
    }
    h.push('</div></div>');
  });
  h.push('</div>');
  return h.join('');
}

function featsBlock(cls) {
  if (!cls.feats.length) {
    const note = cls.notes.find((x) => x.startsWith('None authored'));
    if (note) {
      return `<div class="empty warn"><strong>Zero class feats authored.</strong> ${esc(
        note.slice('None authored.'.length).trim()
      )}</div>`;
    }
    return '<div class="empty">No class feats authored.</div>';
  }
  const total = cls.feats.reduce((a, f) => a + f.count, 0);
  const mx = Math.max(...cls.feats.map((f) => f.count));
  const h = [`<div class="pool"><div class="poolhead">${total} class feats in the pool, by the level they unlock</div>`];
  for (const f of cls.feats) {
    h.push(
      `<div class="poolrow"><div class="plab">L${f.level}</div><div class="pbarwrap"><div class="pbar" style="--p:${(
        f.count / mx
      ).toFixed(3)}"><span>${f.count}</span></div></div><div class="pnames">${esc(
        f.names.join(` ${MIDDOT} `)
      )}</div></div>`
    );
  }
  h.push('</div>');
  return h.join('');
}

function milestoneBlock({ constant, milestones }, cls) {
  const h = [];
  if (constant.length) {
    h.push(
      '<div class="constant"><span class="ck">Every level</span> ' +
        constant.map((c) => `<span class="chip const">${esc(pretty(c))}</span>`).join(' ') +
        '</div>'
    );
  }
  if (milestones.length) {
    h.push('<div class="miles">');
    for (const [lvl, names] of milestones) {
      h.push(
        `<div class="mile"><div class="mlv">L${lvl}</div><div class="mnames">` +
          names.map((x) => `<span class="chip">${esc(pretty(x))}</span>`).join(' ') +
          '</div></div>'
      );
    }
    h.push('</div>');
  }
  for (const nt of cls.notes) {
    if (!nt.startsWith('None authored')) h.push(`<div class="note">${esc(nt)}</div>`);
  }
  return h.join('');
}

function compareView(classes) {
  const hd = [
    ['Hit die', (c) => c.stats['Hit die'] ?? ''],
    ['Key ability', (c) => c.stats['Key ability'] ?? ''],
    ['Skill pts', (c) => (c.stats['Skill points/level'] ?? '').split(' +')[0]],
    ['Casting', (c) => (c.stats.Casting ?? EMDASH).split(` ${MIDDOT} `)[0]],
  ];
  const h = ['<section class="panel" id="p-compare"><h2>All 13 classes at a glance</h2>'];

  h.push('<div class="cmpgrid">');
  const metrics = [
    ['Hit die', (c) => num(c.stats['Hit die'] ?? 'd0'), 12],
    ['Skill points / level', (c) => num(c.stats['Skill points/level'] ?? '0'), 8],
    ['Class feats authored', (c) => c.feats.reduce((a, f) => a + f.count, 0), 24],
    ['Class feat grants by L20', (c) => c.levels.reduce((a, r) => a + slotVal(r[4]), 0), 30],
  ];
  for (const [label, key, mx] of metrics) {
    h.push(`<div class="cmpcard"><h3>${label}</h3>`);
    for (const c of classes) {
      const v = key(c);
      const acc = (ROLE_ACCENT[c.stats.Role] ?? ROLE_ACCENT.martial)[0];
      h.push(
        `<div class="cmprow"><div class="cname">${esc(c.name)}</div><div class="chbarwrap"><div class="chbar" style="--p:${(
          mx ? v / mx : 0
        ).toFixed(3)};--acc:${acc}"></div></div><div class="cval">${v ? v : EMDASH}</div></div>`
      );
    }
    h.push('</div>');
  }
  h.push('</div>');

  h.push(
    '<div class="cmptablewrap"><table class="cmptable"><thead><tr><th>Class</th>' +
      hd.map(([t]) => `<th>${esc(t)}</th>`).join('') +
      '<th>Levels</th><th>Feats</th></tr></thead><tbody>'
  );
  for (const c of classes) {
    const role = c.stats.Role ?? '';
    const feats = c.feats.reduce((a, f) => a + f.count, 0);
    h.push(
      `<tr><td class="cn"><span class="rdot r-${esc(role)}"></span>${esc(c.name)}` +
        (c.prestige ? ' <span class="pbadge">prestige</span>' : '') +
        '</td>' +
        hd.map(([, fn]) => `<td>${esc(fn(c))}</td>`).join('') +
        `<td>${c.levels.length}</td><td>${feats || '<em>0</em>'}</td></tr>`
    );
  }
  h.push('</tbody></table></div></section>');
  return h.join('');
}

function classPanel(cls) {
  const { track, constant, milestones } = barTrack(cls);
  const role = cls.stats.Role ?? 'martial';
  const [acc, accbg] = ROLE_ACCENT[role] ?? ROLE_ACCENT.martial;
  const h = [`<section class="panel" id="${slug(cls.name)}" style="--acc:${acc};--accbg:${accbg}">`];
  h.push(
    `<header class="chead"><div><h2>${esc(cls.name)}` +
      (cls.prestige ? ` <span class="pbadge">prestige ${MIDDOT} 10 levels</span>` : '') +
      `</h2><p class="tag">${esc(cls.tagline)}</p></div><div class="badges">${statBadges(cls)}</div></header>`
  );
  h.push(`<p class="blurb">${esc(cls.blurb)}</p>`);

  h.push('<div class="kv">');
  for (const k of ['Weapon proficiency', 'Class skills', 'Prerequisites']) {
    if (cls.stats[k]) {
      h.push(`<div class="kvrow"><div class="kvk">${esc(k)}</div><div class="kvv">${esc(cls.stats[k])}</div></div>`);
    }
  }
  h.push('</div>');

  h.push('<h3 class="sh">Level-by-level</h3>');
  h.push(`<div class="scrollx">${track}</div>`);

  h.push('<h3 class="sh">Proficiency tiers <span class="shn">on top of floor(level/2)+1</span></h3>');
  h.push(`<div class="scrollx">${tierBlock(cls)}</div>`);

  const sb = slotsBlock(cls);
  if (sb) {
    h.push('<h3 class="sh">Spell slots <span class="shn">expanded to every level</span></h3>');
    h.push(`<div class="scrollx">${sb}</div>`);
  }

  const ms = milestoneBlock({ constant, milestones }, cls);
  if (ms) h.push(`<h3 class="sh">Class features</h3>${ms}`);

  h.push(`<h3 class="sh">Class feat pool</h3>${featsBlock(cls)}`);
  h.push('</section>');
  return h.join('');
}

const CSS = String.raw`
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:#14110e;color:#ece5da;
 font:15px/1.55 "Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:1320px;margin:0 auto;padding:0 26px 90px}
header.top{padding:44px 0 24px;border-bottom:1px solid #33291f}
header.top h1{margin:0;font-size:32px;letter-spacing:-.4px;font-weight:650}
header.top p{margin:10px 0 0;color:#a99b89;max-width:70ch}
.warnbar{margin:22px 0 0;padding:14px 18px;border-radius:8px;background:#3a2116;
 border:1px solid #7a3f22;color:#f3c9ac}
.warnbar strong{color:#ffb27a}
nav.tabs{position:sticky;top:0;z-index:20;background:#14110ef2;backdrop-filter:blur(8px);
 border-bottom:1px solid #33291f;padding:12px 0;margin-bottom:34px;
 display:flex;flex-wrap:wrap;gap:6px}
nav.tabs button{font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;
 background:#221c16;color:#bdae9b;border:1px solid #3a2f24;border-radius:6px;
 padding:8px 13px;min-height:38px}
nav.tabs button:hover{background:#2c241c;color:#f2e9dc}
nav.tabs button[aria-current=true]{background:var(--tacc,#e0783c);border-color:var(--tacc,#e0783c);color:#17120d}
nav.tabs button.r-martial{--tacc:#e0783c}nav.tabs button.r-caster{--tacc:#8f7bd6}
nav.tabs button.r-skill{--tacc:#5fb37a}nav.tabs button.r-hybrid{--tacc:#4fa3c7}
.panel{display:none;animation:fade .18s ease}
.panel.on{display:block}
@keyframes fade{from{opacity:0}to{opacity:1}}
h2{font-size:27px;margin:0;letter-spacing:-.3px}
.pbadge{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;
 background:#3a2f24;color:#cbb9a2;padding:4px 8px;border-radius:4px;vertical-align:middle}
.chead{display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:flex-start;
 padding:6px 0 18px;border-bottom:2px solid var(--acc)}
.tag{margin:7px 0 0;color:var(--acc);font-size:15px;font-style:italic}
.badges{display:flex;flex-wrap:wrap;gap:8px}
.badge{background:var(--accbg);border:1px solid #ffffff1c;border-radius:7px;padding:7px 12px;min-width:78px}
.badge.muted{opacity:.55}
.bk{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#a2937f}
.bv{display:block;font-size:15px;font-weight:650;margin-top:2px}
.blurb{margin:20px 0 0;max-width:88ch;color:#cfc3b3;font-size:15.5px}
.kv{margin:20px 0 0;display:grid;gap:1px;background:#2b2319;border:1px solid #2b2319;border-radius:8px;overflow:hidden}
.kvrow{display:grid;grid-template-columns:190px 1fr;gap:1px;background:#2b2319}
.kvk{background:#1c1712;padding:10px 14px;font-size:12.5px;text-transform:uppercase;
 letter-spacing:.06em;color:#a2937f}
.kvv{background:#191410;padding:10px 14px}
.sh{margin:42px 0 14px;font-size:14px;text-transform:uppercase;letter-spacing:.11em;
 color:#bdae9b;border-bottom:1px solid #2f271d;padding-bottom:8px;font-weight:700}
.shn{text-transform:none;letter-spacing:0;color:#7e7263;font-weight:400;font-size:12.5px}
.scrollx{overflow-x:auto;padding-bottom:6px}
/* ---- level track ---- */
.track{min-width:calc(190px + var(--n) * 44px)}
.trow{display:grid;grid-template-columns:190px 1fr;align-items:center;
 border-bottom:1px solid #241d15}
.tlab{font-size:12.5px;color:#a2937f;padding:6px 14px 6px 0;text-align:right}
.tlab em{display:block;font-style:normal;font-size:11px;color:#6f6455}
.tcells{display:grid;grid-template-columns:repeat(var(--n),1fr)}
.tcell{height:46px;display:flex;flex-direction:column;justify-content:flex-end;
 align-items:center;border-left:1px solid #241d15;position:relative;padding-bottom:3px}
.lvhead{height:30px;justify-content:center;font-size:12.5px;font-weight:700;color:#ded2c2;
 background:#1b1611}
.vbar{width:60%;background:var(--acc);border-radius:2px 2px 0 0;
 height:calc(4px + var(--p) * 26px);opacity:.9}
.vbar.fort{background:#c9803f}.vbar.ref{background:#5fb37a}.vbar.will{background:#7f8ed6}
.vnum{font-size:10.5px;color:#9a8d7c;line-height:1.2}
.slotrow .tcell{height:32px;justify-content:center}
.dot{width:13px;height:13px;border-radius:3px;display:flex;align-items:center;
 justify-content:center;font-size:9.5px;font-weight:800;color:#17120d}
.dot.off{background:#241d15;border-radius:50%;width:5px;height:5px}
.dot.dbl{width:19px;height:15px;border-radius:3px}
.sf-class{background:#e0783c}.sf-gen{background:#8f8577}.sf-anc{background:#4fa3c7}.sf-skill{background:#5fb37a}
.ladrow .tcell{height:34px;justify-content:center}
.lad{font-size:10.5px;font-weight:700;white-space:nowrap}
.lad.step{background:var(--acc);color:#17120d;padding:3px 5px;border-radius:4px}
.lad.hold{width:100%;height:2px;background:#3a2f24;border-radius:2px}
/* ---- tiers ---- */
.tiers{display:grid;gap:7px;min-width:640px}
.tierrow{display:grid;grid-template-columns:140px 1fr 190px;gap:14px;align-items:center}
.tiername{font-size:13px;color:#cfc3b3;text-align:right}
.tierbar{display:flex;gap:2px}
.tg{flex:1;height:24px;border-radius:2px;background:#221c16;display:flex;align-items:center;
 justify-content:center}
.t-trained{background:#4a3d2d}.t-expert{background:#7d6a3f}
.t-master{background:#b58a3c}.t-legendary{background:#e8b44a}
.tnew{outline:2px solid #ffffff42;outline-offset:-2px}
.tlabel{font-size:10px;font-weight:800;color:#17120d}
.t-trained .tlabel{color:#e6d9c4}
.tierpeak{font-size:12.5px;color:#a2937f}
.tierpeak .pk{color:#e8b44a;font-weight:700}
/* ---- spell slots ---- */
.slots{display:grid;gap:2px;min-width:640px}
.srow{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center}
.slab{font-size:12.5px;color:#a2937f;text-align:right}
.scells{display:grid;grid-template-columns:repeat(20,1fr);gap:2px}
.scell{height:26px;display:flex;align-items:center;justify-content:center;
 font-size:11.5px;font-weight:700;border-radius:3px;color:#17120d}
.scell.lvhead{background:#1b1611;color:#ded2c2;height:22px;font-size:11px}
.scell.none{background:#1c1712}
.h1{background:#3f3a6b;color:#dcd8f5}.h2{background:#56508f}.h3{background:#6f68b5;color:#f1eeff}
.h4{background:#8b83d6;color:#191430}.h5{background:#a9a2ea;color:#191430}
/* ---- features ---- */
.constant{margin:0 0 14px;font-size:14px}
.ck{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a2937f;margin-right:8px}
.chip{display:inline-block;background:#231d16;border:1px solid #3a2f24;border-radius:5px;
 padding:4px 9px;font-size:13px;margin:2px 2px 2px 0}
.chip.const{border-color:var(--acc);color:#f0e6d8}
.miles{display:grid;gap:1px;background:#2b2319;border:1px solid #2b2319;border-radius:8px;overflow:hidden}
.mile{display:grid;grid-template-columns:60px 1fr;gap:1px;background:#2b2319}
.mlv{background:#1c1712;padding:9px 12px;font-weight:700;font-size:13px;color:var(--acc);text-align:right}
.mnames{background:#191410;padding:6px 12px}
.note{margin:14px 0 0;padding:12px 15px;background:#1c1712;border-left:3px solid var(--acc);
 border-radius:0 6px 6px 0;color:#cfc3b3;font-size:14px}
/* ---- feat pool ---- */
.pool{display:grid;gap:7px}
.poolhead{font-size:13px;color:#a2937f;margin-bottom:4px}
.poolrow{display:grid;grid-template-columns:44px 130px 1fr;gap:12px;align-items:center}
.plab{font-size:13px;font-weight:700;color:#cfc3b3;text-align:right}
.pbarwrap{background:#1c1712;border-radius:4px;height:24px}
.pbar{height:24px;background:var(--acc);border-radius:4px;width:calc(var(--p)*100%);
 min-width:24px;display:flex;align-items:center;justify-content:flex-end;padding-right:7px}
.pbar span{font-size:12px;font-weight:800;color:#17120d}
.pnames{font-size:13.5px;color:#cfc3b3}
.empty{padding:14px 16px;background:#1c1712;border-radius:7px;color:#a2937f;font-size:14px}
.empty.warn{background:#3a2116;border:1px solid #7a3f22;color:#f3c9ac}
.empty.warn strong{color:#ffb27a}
.empty code{background:#241d15;padding:1px 5px;border-radius:3px;font-size:12.5px}
/* ---- compare ---- */
.cmpgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:18px;margin:26px 0 34px}
.cmpcard{background:#191410;border:1px solid #2b2319;border-radius:9px;padding:16px 18px}
.cmpcard h3{margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#bdae9b}
.cmprow{display:grid;grid-template-columns:104px 1fr 30px;gap:9px;align-items:center;margin-bottom:5px}
.cname{font-size:12.5px;color:#cfc3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chbarwrap{background:#221c16;height:14px;border-radius:3px}
.chbar{height:14px;width:calc(var(--p)*100%);background:var(--acc);border-radius:3px;min-width:2px}
.cval{font-size:12px;font-weight:700;color:#ded2c2;text-align:right}
.cmptablewrap{overflow-x:auto}
.cmptable{border-collapse:collapse;width:100%;min-width:760px;font-size:14px}
.cmptable th{text-align:left;padding:10px 13px;background:#1b1611;color:#a2937f;
 font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #2f271d}
.cmptable td{padding:10px 13px;border-bottom:1px solid #241d15}
.cmptable tr:hover td{background:#1a1511}
.cmptable td.cn{font-weight:650}
.cmptable em{color:#e07a5f;font-style:normal;font-weight:700}
.rdot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:9px}
.r-martial{background:#e0783c}.r-caster{background:#8f7bd6}.r-skill{background:#5fb37a}.r-hybrid{background:#4fa3c7}
.legend{display:flex;flex-wrap:wrap;gap:16px;margin:18px 0 0;font-size:12.5px;color:#a2937f}
.legend span b{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px}
footer{margin-top:60px;padding-top:20px;border-top:1px solid #33291f;color:#7e7263;font-size:13px}
@media (max-width:760px){
 .trow,.tierrow,.poolrow,.mile,.kvrow{grid-template-columns:1fr}
 .tlab,.tiername,.slab,.plab,.mlv{text-align:left;padding-left:0}
 .tierrow{gap:4px}.poolrow{gap:4px}
}
`;
const SCRIPT = String.raw`
const tabs=[...document.querySelectorAll('nav.tabs button')];
const panels=[...document.querySelectorAll('.panel')];
function show(id){
  panels.forEach(p=>p.classList.toggle('on',p.id===id));
  tabs.forEach(t=>t.setAttribute('aria-current',String(t.dataset.t===id)));
  try{localStorage.setItem('gv-class-chart',id)}catch(e){}
  window.scrollTo({top:0,behavior:'instant'});
}
tabs.forEach(t=>t.addEventListener('click',()=>show(t.dataset.t)));
let start='p-compare';
try{const s=localStorage.getItem('gv-class-chart');if(s&&document.getElementById(s))start=s}catch(e){}
show(start);
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  const i=tabs.findIndex(t=>t.getAttribute('aria-current')==='true');
  if(e.key==='ArrowRight'&&i<tabs.length-1)show(tabs[i+1].dataset.t);
  if(e.key==='ArrowLeft'&&i>0)show(tabs[i-1].dataset.t);
});
`;

function build() {
  const md = readFileSync(SRC, 'utf8');
  const classes = parse(md);

  // --- assertions: the chart must not silently lose data
  const rowTotal = classes.reduce((a, c) => a + c.levels.length, 0);
  const problems = [];
  if (classes.length !== 13) problems.push(`parsed ${classes.length} classes, expected 13`);
  if (rowTotal !== 230) problems.push(`parsed ${rowTotal} progression rows, expected 230`);
  for (const c of classes) {
    if (!c.levels.length) problems.push(`${c.name}: no level table parsed`);
    if (!Object.keys(c.stats).length) problems.push(`${c.name}: no stat box parsed`);
    for (const f of c.feats) {
      if (f.names.length !== f.count) problems.push(`${c.name} L${f.level}: ${f.names.length} names vs count ${f.count}`);
    }
  }
  if (problems.length) {
    console.error('build-class-chart: parse lost data:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  const tabs = ['<button data-t="p-compare">Compare all</button>'];
  for (const c of classes) {
    tabs.push(`<button class="r-${esc(c.stats.Role ?? 'martial')}" data-t="${slug(c.name)}">${esc(c.name)}</button>`);
  }
  const body = [compareView(classes), ...classes.map(classPanel)].join('');

  const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guild Vigil ${EMDASH} class progression charts</title>
<style>${CSS}</style></head><body>
<div class="wrap">
<header class="top">
<h1>Guild Vigil ${EMDASH} class progression charts</h1>
<p>A visual read-out of <code>output/reference/class-progression-sheets.md</code>. Every number is
generated from that file, which is itself generated from the live registries in
<code>src/content/generated/</code>. ${classes.length} classes ${MIDDOT} ${rowTotal} progression rows.</p>
<div class="warnbar"><strong>Almost none of this is reachable by the player today.</strong>
The level-up wizard commits <code>feats: []</code>, and nothing in <code>src/</code> reads the
<code>feat_slot_*</code> or <code>features</code> columns. See
<code>output/briefs/character-workstream.md</code>.</div>
<div class="legend">
<span><b class="sf-class"></b>class feat</span>
<span><b class="sf-gen"></b>general feat</span>
<span><b class="sf-anc"></b>ancestry feat</span>
<span><b class="sf-skill"></b>skill feat</span>
<span><b style="background:#4a3d2d"></b>trained +0</span>
<span><b style="background:#7d6a3f"></b>expert +2</span>
<span><b style="background:#b58a3c"></b>master +4</span>
<span><b style="background:#e8b44a"></b>legendary +6</span>
</div>
</header>
<nav class="tabs" aria-label="Class">${tabs.join('')}</nav>
${body}
<footer>Generated from class-progression-sheets.md by <code>tools/build-class-chart.mjs</code>
&middot; use &larr;/&rarr; to move between classes. Regenerate rather than hand-editing.</footer>
</div>
<script>${SCRIPT}</script>
</body></html>`;

  writeFileSync(OUT, doc, 'utf8');
  console.log(
    `build-class-chart: wrote ${OUT}\n  ${classes.length} classes, ${rowTotal} progression rows, ` +
      `${classes.reduce((a, c) => a + c.feats.reduce((x, f) => x + f.count, 0), 0)} class feats, ${doc.length} chars`
  );
}

build();
