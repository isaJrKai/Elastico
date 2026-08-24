const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function inspect() {
  const ct = await p.canonicalTeam.count();
  const si = await p.sourceIdentity.count();
  const ta = await p.teamAnalytic.count();
  const tm = await p.team.count();
  const ma = await p.match.count();
  const sl = await p.syncLog.findMany({orderBy:{createdAt:'desc'}, take:5});
  console.log('=== DB STATE ===');
  console.log('CanonicalTeams:', ct);
  console.log('SourceIdentities:', si);
  console.log('TeamAnalytics:', ta);
  console.log('Teams:', tm);
  console.log('Matches:', ma);
  console.log('Recent SyncLogs:', JSON.stringify(sl.map(s => s.source+'|'+s.action+'|'+s.status+'|'+s.recordsProcessed), null, 2));
  await p.$disconnect();
}
inspect().catch(e => { console.error(e.message.substring(0,500)); p.$disconnect(); });
