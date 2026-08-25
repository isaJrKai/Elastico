/**
 * clean-demo-data.ts
 *
 * Finds Matches that have fabricated xG values (homeXg = 0 with no real source)
 * and marks them clearly as demo/placeholder data instead of silently misleading.
 *
 * Run:  npx tsx scripts/clean-demo-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== ELASTICO Demo Data Cleanup ===");
  console.log("");

  // ---- 1. Find matches with demo xG ----
  // Criteria:
  //   source is 'unknown' or null or empty
  //   AND homeXg IS NOT NULL
  //   AND homeXg == 0
  const demoMatches = await prisma.match.findMany({
    where: {
      OR: [
        { source: "unknown" },
        { source: null },
        { source: "" },
      ],
      homeXg: { not: null },
      homeXg: 0,
    },
    select: {
      id: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      homeXg: true,
      awayXg: true,
      homeXgSource: true,
      awayXgSource: true,
      homeXgTruthClass: true,
      awayXgTruthClass: true,
      source: true,
    },
  });

  if (demoMatches.length === 0) {
    console.log("No demo xG matches found. Database is clean.");
    return;
  }

  console.log(`Found ${demoMatches.length} match(es) with demo xG data:\n`);

  for (const m of demoMatches) {
    console.log(
      `  ${m.homeTeam.name} vs ${m.awayTeam.name}  |  ` +
        `xG: ${m.homeXg} - ${m.awayXg}  |  ` +
        `src: ${m.homeXgSource ?? "null"} / ${m.awayXgSource ?? "null"}  |  ` +
        `truth: ${m.homeXgTruthClass ?? "null"} / ${m.awayXgTruthClass ?? "null"}  |  ` +
        `matchSrc: ${m.source}`
    );
  }
  console.log("");

  // ---- 2. Update ----
  const ids = demoMatches.map((m) => m.id);

  const result = await prisma.match.updateMany({
    where: { id: { in: ids } },
    data: {
      homeXg: null,
      awayXg: null,
      homeXgTruthClass: "DEMO",
      awayXgTruthClass: "DEMO",
      homeXgSource: "demo-seed",
      awayXgSource: "demo-seed",
    },
  });

  console.log(`Updated ${result.count} match(es):`);
  console.log("  - homeXg       → null");
  console.log("  - awayXg       → null");
  console.log("  - homeXgTruthClass  → DEMO");
  console.log("  - awayXgTruthClass  → DEMO");
  console.log("  - homeXgSource      → demo-seed");
  console.log("  - awayXgSource      → demo-seed");
  console.log("");
  console.log("=== Cleanup complete ===");
}

main()
  .catch((error: unknown) => {
    console.error("[clean-demo-data] Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
