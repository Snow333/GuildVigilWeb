// THROWAWAY probe: does buff/debuff content author save_type / target_side?
const Database = require('better-sqlite3');
const db = new Database('data/game_data.db', { readonly: true });
console.log('--- save_type by effect_type ---');
for (const r of db.prepare("SELECT effect_type, COALESCE(save_type,'NULL') st, COUNT(*) n FROM spells GROUP BY effect_type, st ORDER BY effect_type, n DESC").all()) {
  console.log(`  ${r.effect_type.padEnd(8)} ${r.st.padEnd(6)} ${r.n}`);
}
console.log('--- target_side non-null ---');
console.log(db.prepare("SELECT COUNT(*) n FROM spells WHERE target_side IS NOT NULL").get());
console.log('--- buff/debuff with condition key AND save_type ---');
for (const r of db.prepare("SELECT id,name,effect_type,save_type,effects FROM spells WHERE effect_type IN ('buff','debuff') AND effects LIKE '%\"condition\"%' ORDER BY id").all()) {
  console.log(`  [${r.id}] ${r.name} ${r.effect_type} save=${r.save_type} ${r.effects}`);
}
console.log('--- buff/debuff with bonus+to AND save_type ---');
for (const r of db.prepare("SELECT id,name,effect_type,save_type,effects,aoe_shape,aoe_size FROM spells WHERE effect_type IN ('buff','debuff') AND effects LIKE '%\"to\"%' ORDER BY id").all()) {
  console.log(`  [${r.id}] ${r.name} ${r.effect_type} save=${r.save_type} aoe=${r.aoe_shape}/${r.aoe_size} ${r.effects}`);
}
console.log('--- spells table columns ---');
console.log(db.prepare('PRAGMA table_info(spells)').all().map(c => c.name).join(', '));
