// THROWAWAY probe: group buff/debuff spells by the SHAPE of their effects JSON.
const Database = require('better-sqlite3');
const db = new Database('data/game_data.db', { readonly: true });

const rows = db.prepare(
  "SELECT id, name, effect_type, effects, target_side, aoe_shape, aoe_size, duration, spell_level, spell_list FROM spells WHERE effect_type IN ('buff','debuff') ORDER BY effect_type, id"
).all();

const byShape = new Map();
for (const r of rows) {
  let fx;
  try { fx = JSON.parse(r.effects || '{}'); } catch { fx = { __PARSE_ERROR__: true }; }
  const keys = Object.keys(fx).sort();
  const shape = `${r.effect_type} {${keys.join(',')}}`;
  if (!byShape.has(shape)) byShape.set(shape, []);
  byShape.get(shape).push({ ...r, fx });
}

const sorted = [...byShape.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`TOTAL buff/debuff rows: ${rows.length}`);
console.log('');
for (const [shape, list] of sorted) {
  console.log(`${String(list.length).padStart(3)}  ${shape}`);
  for (const s of list) {
    console.log(`        [${s.id}] ${s.name} :: ${s.effects}  (aoe=${s.aoe_shape}/${s.aoe_size} dur=${s.duration} lvl=${s.spell_level} lists=${s.spell_list})`);
  }
  console.log('');
}

// Value distributions for the two big shapes
console.log('=== `to` values across {bonus,to} ===');
const toCounts = new Map();
for (const r of rows) {
  let fx; try { fx = JSON.parse(r.effects || '{}'); } catch { continue; }
  if ('to' in fx) toCounts.set(String(fx.to), (toCounts.get(String(fx.to)) || 0) + 1);
}
console.log([...toCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join('  '));

console.log('=== `condition` values ===');
const cCounts = new Map();
for (const r of rows) {
  let fx; try { fx = JSON.parse(r.effects || '{}'); } catch { continue; }
  if ('condition' in fx) cCounts.set(String(fx.condition), (cCounts.get(String(fx.condition)) || 0) + 1);
}
console.log([...cCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join('  '));

console.log('=== duration column distribution (buff/debuff) ===');
const dCounts = new Map();
for (const r of rows) dCounts.set(String(r.duration), (dCounts.get(String(r.duration)) || 0) + 1);
console.log([...dCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join('  '));

console.log('=== effect_type totals (all 218) ===');
for (const r of db.prepare('SELECT effect_type, COUNT(*) n FROM spells GROUP BY effect_type ORDER BY n DESC').all()) {
  console.log(`  ${r.effect_type}: ${r.n}`);
}
