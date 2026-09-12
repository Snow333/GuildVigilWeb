// THROWAWAY probe: damage spells carrying a condition (blast radius of a duration change)
const Database = require('better-sqlite3');
const db = new Database('data/game_data.db', { readonly: true });
console.log('--- damage spells with a condition key ---');
for (const r of db.prepare("SELECT id,name,spell_level,spell_list,effects,duration,save_type FROM spells WHERE effect_type='damage' AND effects LIKE '%\"condition\"%' ORDER BY spell_level,id").all()) {
  console.log(`  [${r.id}] L${r.spell_level} ${r.name} save=${r.save_type} dur=${r.duration} ${r.effects} lists=${r.spell_list}`);
}
console.log('');
console.log('--- ALL keys used across buff/debuff effects, with counts ---');
const rows = db.prepare("SELECT effects FROM spells WHERE effect_type IN ('buff','debuff')").all();
const k = new Map();
for (const r of rows) { let fx; try { fx = JSON.parse(r.effects||'{}'); } catch { continue; } for (const key of Object.keys(fx)) k.set(key, (k.get(key)||0)+1); }
console.log([...k.entries()].sort((a,b)=>b[1]-a[1]).map(([a,b])=>`${a}:${b}`).join('  '));
console.log('');
console.log('--- arcane L1 spells (the 22) ---');
for (const r of db.prepare("SELECT id,name,effect_type,effects FROM spells WHERE spell_level=1 AND spell_list LIKE '%arcane%' ORDER BY id").all()) {
  console.log(`  [${r.id}] ${r.name.padEnd(28)} ${r.effect_type.padEnd(8)} ${r.effects}`);
}
