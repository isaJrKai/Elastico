const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });
(async () => {
  try {
    const tables = ['Team','Player','Match','StandingEntry','TeamAnalytic','OddsSnapshot','NewsArticle','CanonicalTeam','SourceIdentity','Prediction','User','MatchEvent','SyncLog','Bookmark','Vote','Activity','SystemSetting','Announcement','FeatureFlag','UserPreference','Session'];
    const results = [];
    for (const t of tables) {
      try {
        const r = await p[t].count();
        results.push(t + ': ' + r);
      } catch(e) { results.push(t + ': ERROR - ' + e.message.slice(0,80)); }
    }
    console.log(results.join('\n'));
  } catch(e) { console.error(e.message); } finally { await p.$disconnect(); }
})();
