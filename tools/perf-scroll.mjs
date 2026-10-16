#!/usr/bin/env node
/* global window, document, innerHeight -- these run inside the page via page.evaluate */
/**
 * Scroll-performance probe (Track P). Steven plays dist/index.html from file://
 * in Edge and reported that scrolling the dispatch and after-action screens
 * feels laggy. This opens a build in Chromium, reaches each screen, wheel-scrolls
 * it down and back up, and reports frame timing.
 *
 * Two kinds of number, because they answer different questions:
 *   - rAF frame time (median / p95 / dropped %): how long the main thread
 *     takes to produce a frame while scrolling.
 *   - trace totals (ms of Paint / Raster / Layerize / Composite work per
 *     scroll step): the cost that fixed backgrounds and blend modes add on
 *     the compositor and raster side, which a main-thread sampler can miss.
 *
 * Run (after a build):
 *   node tools/perf-scroll.mjs                       # dist/index.html
 *   node tools/perf-scroll.mjs --html path/to.html --label before --out before.json
 *   node tools/perf-scroll.mjs --scale 1.5 --cpu 4
 *   node tools/perf-scroll.mjs --css '.gv-desk{background-attachment:scroll!important}' --label no-fixed
 * Scenarios: dispatch-playing (fight at ¼×), dispatch-paused, after-action.
 * Edge is Chromium, so this is a proxy. Headless uses software raster, which
 * makes paint cost easier to see, not harder.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const HTML = resolve(arg('html', 'dist/index.html'));
const LABEL = arg('label', 'run');
const OUT = arg('out', '');
const SCALES = arg('scale', '1,1.5').split(',').map(Number);
const CPUS = arg('cpu', '1,4').split(',').map(Number);
const STEPS = Number(arg('steps', '24'));
// Each scenario is measured this many times; the median of each number is reported (one run is noisy).
const REPS = Number(arg('reps', '3'));
// Experiment hook: CSS appended after load, to price one suspect at a time.
const EXTRA_CSS = arg('css', '');
const MAX_WEEKS = 16;

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

/** Same route as e2e/dungeon-playback.spec.ts: take the last posting until a dungeon playback mounts. */
async function reachDungeonPlayback(page) {
  await page.fill('input', 'Perf Probe');
  await page.locator('button:has-text("New campaign")').first().click();
  await page.locator('button:has-text("Sign the charter")').click();
  await page.locator('h1:has-text("Town Hub")').waitFor();
  for (let week = 0; week < MAX_WEEKS; week++) {
    await page.locator('button:has-text("Advance week")').first().click();
    await page.locator('button:has-text("Quest board")').click();
    await page.locator('h1:has-text("Quest board")').waitFor();
    const postings = page.locator('[data-posting]');
    if ((await postings.count()) === 0) {
      await page.locator('button:has-text("◂ Town")').click();
      await page.locator('h1:has-text("Town Hub")').waitFor();
      continue;
    }
    await postings.last().locator('button:has-text("Accept")').click();
    await page.locator('h1:has-text("Dispatch setup")').waitFor();
    await page.locator('button:has-text("Launch dispatch")').click();
    const playback = page.locator('h1:has-text("Dispatch playback")');
    const surface = page.locator('h1:has-text("Dispatch — quest")');
    await playback.or(surface).waitFor();
    if (await playback.isVisible()) return;
    await page.locator('button:has-text("After-action ▸")').click();
    await page.locator('h1:has-text("After-action")').waitFor();
    await page.locator('button:has-text("Return to town")').click();
    await page.locator('h1:has-text("Town Hub")').waitFor();
  }
  throw new Error('no dungeon playback reached');
}

// One sampler per measurement. The generation token matters: a bare on/off flag lets an
// earlier loop come back to life when the next measurement turns the flag on again.
const SAMPLER = `
  window.__gen = (window.__gen || 0) + 1;
  const gen = window.__gen;
  window.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    if (window.__gen !== gen) return;
    window.__frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
`;

const TRACE_NAMES = ['Paint', 'RasterTask', 'ImageDecodeTask', 'Layerize', 'UpdateLayer', 'CompositeLayers', 'Layout', 'UpdateLayoutTree', 'FunctionCall', 'EventDispatch'];

/** Wheel the page down then back up and return frame + trace numbers. */
async function rearm(page) {
  const t = page.locator('[data-transport="combat"]');
  if ((await t.count()) === 0) return;
  const play = t.locator('button:text-is("Play")');
  if ((await play.count()) > 0) await play.click(); // finished or paused: Play restarts a finished fight
}
const combatTick = async (page) => {
  const l = page.locator('[data-transport="combat"] .gv-choice-label');
  return (await l.count()) === 0 ? '' : l.last().innerText();
};

async function measure(page, browser, cdp) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const dy = Math.max(60, Math.min(160, Math.floor(total / STEPS)));
  await page.mouse.move(640, 450);
  await page.evaluate(SAMPLER);
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'viz'] });
  const tick0 = await combatTick(page);
  const m0 = await cdp.send('Performance.getMetrics');
  const t0 = Date.now();
  for (let i = 0; i < STEPS; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(40); }
  for (let i = 0; i < STEPS; i++) { await page.mouse.wheel(0, -dy); await page.waitForTimeout(40); }
  await page.waitForTimeout(250);
  const wall = Date.now() - t0;
  const m1 = await cdp.send('Performance.getMetrics');
  const traceBuf = await browser.stopTracing();
  const tick1 = await combatTick(page);
  const frames = await page.evaluate(() => { window.__gen += 1; return window.__frames; });

  const sorted = [...frames].sort((a, b) => a - b);
  const budget = 1000 / 60;
  const dropped = frames.filter((f) => f > budget * 1.5).length;
  const metric = (n) => (m1.metrics.find((m) => m.name === n)?.value ?? 0) - (m0.metrics.find((m) => m.name === n)?.value ?? 0);
  const trace = JSON.parse(traceBuf.toString());
  const totals = Object.fromEntries(TRACE_NAMES.map((n) => [n, 0]));
  for (const ev of trace.traceEvents ?? trace) {
    if (ev.ph === 'X' && ev.dur && n_in(ev.name)) totals[ev.name] += ev.dur / 1000;
  }
  return {
    pageHeight: total + 900, wheelStep: dy,
    frames: frames.length,
    medianMs: +pct(sorted, 0.5).toFixed(2),
    p95Ms: +pct(sorted, 0.95).toFixed(2),
    maxMs: +Math.max(0, ...frames).toFixed(1),
    droppedPct: +((dropped / Math.max(1, frames.length)) * 100).toFixed(1),
    scriptMs: +(metric('ScriptDuration') * 1000).toFixed(0),
    layoutMs: +(metric('LayoutDuration') * 1000).toFixed(0),
    styleMs: +(metric('RecalcStyleDuration') * 1000).toFixed(0),
    taskMs: +(metric('TaskDuration') * 1000).toFixed(0),
    traceMs: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, +v.toFixed(0)])),
    wallMs: wall,
    fightAnimated: tick0 !== tick1,
  };
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
/** Run measure() REPS times and take the median of every number. */
async function measureMedian(page, browser, cdp) {
  const runs = [];
  for (let i = 0; i < REPS; i++) {
    if (page.__playing) await rearm(page);
    runs.push(await measure(page, browser, cdp));
  }
  const pick = (get) => +med(runs.map(get)).toFixed(2);
  return {
    pageHeight: runs[0].pageHeight, wheelStep: runs[0].wheelStep,
    frames: pick((r) => r.frames), medianMs: pick((r) => r.medianMs), p95Ms: pick((r) => r.p95Ms),
    maxMs: pick((r) => r.maxMs), droppedPct: pick((r) => r.droppedPct), scriptMs: pick((r) => r.scriptMs),
    layoutMs: pick((r) => r.layoutMs), styleMs: pick((r) => r.styleMs), taskMs: pick((r) => r.taskMs),
    traceMs: Object.fromEntries(TRACE_NAMES.map((n) => [n, pick((r) => r.traceMs[n])])),
    wallMs: pick((r) => r.wallMs), reps: REPS, fightAnimatedReps: runs.filter((r) => r.fightAnimated).length,
  };
}
const n_in = (name) => TRACE_NAMES.includes(name);

const results = [];
const browser = await chromium.launch(process.env.GV_CHROMIUM ? { executablePath: process.env.GV_CHROMIUM } : {});
for (const scale of SCALES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(pathToFileURL(HTML).href);
  await reachDungeonPlayback(page);
  if (EXTRA_CSS) await page.addStyleTag({ content: EXTRA_CSS }); // after navigation, so it can't block the clicks above

  const scenarios = [];
  // Playing: the dungeon playhead is running (1×) and the fight viewer is at 1×.
  scenarios.push(['dispatch-playing', async () => {
    // ¼× keeps the fight animating for the whole run (a 1× fight is over in seconds and
    // would turn this scenario into the paused one). rearm() restarts it before each rep.
    await page.locator('[data-transport="combat"] button:has-text("¼×")').click();
  }]);
  scenarios.push(['dispatch-paused', async () => {
    await page.locator('button:has-text("Pause")').first().click();
  }]);
  scenarios.push(['after-action', async () => {
    await page.locator('button:has-text("After-action ▸")').first().click();
    await page.locator('h1:has-text("After-action")').waitFor();
  }]);

  for (const [name, setup] of scenarios) {
    await setup();
    page.__playing = name === 'dispatch-playing';
    await page.waitForTimeout(500);
    for (const cpu of CPUS) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const r = await measureMedian(page, browser, cdp);
      results.push({ label: LABEL, screen: name, scale, cpu, ...r });
      const work = r.traceMs.Paint + r.traceMs.RasterTask + r.traceMs.Layerize;
      console.log(`${LABEL} ${name.padEnd(17)} dsf=${scale} cpu×${cpu}  median ${r.medianMs}ms  p95 ${r.p95Ms}ms  max ${r.maxMs}ms  dropped ${r.droppedPct}%${page.__playing ? ` anim ${r.fightAnimatedReps}/${r.reps}` : ''}  paint ${r.traceMs.Paint}ms raster ${r.traceMs.RasterTask}ms layerize ${r.traceMs.Layerize}ms composite ${r.traceMs.CompositeLayers}ms work ${work}ms (${r.frames} frames)`);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await ctx.close();
}
await browser.close();
if (OUT) writeFileSync(resolve(OUT), JSON.stringify(results, null, 2));
