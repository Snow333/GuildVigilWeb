const Database = require('better-sqlite3');
const db = new Database('data/game_data.db', { readonly: true });
for (const r of db.prepare("SELECT id,name,effects FROM feats WHERE effects LIKE '%conditions_removable%' OR effects LIKE '%immobilized%' OR effects LIKE '%warded%' OR effects LIKE '%emboldened%' OR effects LIKE '%steeled%' OR effects LIKE '%honed%'").all()) console.log(r.id, r.name, r.effects);
