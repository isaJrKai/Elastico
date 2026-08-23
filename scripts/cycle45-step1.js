const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const tables = await p.
    if (tables.length > 0) {
      console.log('TABLES:');
      tables.forEach(t => console.log('  -', t.tablename));
    } else {
      console.log('NO TABLES FOUND');
    }

    // Check specific tables
    const counts = {};
    const tableNames = ['Team', 'Match', 'Player', 'CanonicalTeam', 'SourceIdentity', 'TeamAnalytic', 'StandingEntry', 'OddsSnapshot', 'NewsArticle', 'Prediction'];
    for (const name of tableNames) {
      try {
        const model = p[name];
        if (model && model.count) {
          counts[name] = await model.count();
        } else {
          counts[name] = 'MODEL_NOT_FOUND';
        }
      } catch(e) {
        counts[name] = 'ERROR: ' + e.message;
      }
    }
    console.log('\nROW COUNTS:');
    for (const [k,v] of Object.entries(counts)) {
      console.log('  ' + k + ':', v);
    }

  } catch(e) {
    console.error('DB CONNECTION ERROR:', e.message);
  } finally {
    await p.$disconnect();
  }
}

main();
