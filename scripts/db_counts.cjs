const Database = require('better-sqlite3');
const db = new Database('/home/z/my-project/db/custom.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
for (const t of tables) {
  try {
    const { cnt } = db.prepare(`SELECT COUNT(*) as cnt FROM "${t.name}"`).get();
    console.log(t.name + ': ' + cnt);
  } catch(e) {
    console.log(t.name + ': ERROR');
  }
  }
db.close();
