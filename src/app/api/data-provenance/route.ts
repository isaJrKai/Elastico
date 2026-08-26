import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from '@/lib/auth';

/**
 * Table-level provenance report for one table.
 */
interface TableReport {
  total: number;
  withProvenance: number;
  withoutProvenance: number;
}

/**
 * Extended report for the Match table.
 */
interface MatchTableReport extends TableReport {
  realXg: number;
  demoXg: number;
  nullXg: number;
}

/**
 * Response shape returned by the data-provenance endpoint.
 */
interface DataProvenanceResponse {
  timestamp: string;
  tables: Record<string, TableReport>;
  blockers: string[];
  completionPct: number;
}

// ---------- constants ----------

const UNPROVENANCED_SOURCES = ["unknown", ""];
const REAL_TRUTH_CLASSES = ["REAL", "DERIVED", "PROXY"];

/**
 * Where clause for tables whose provenance is determined by a `source` field.
 * All source fields in our schema are non-nullable (they have defaults),
 * so we only need to exclude placeholder values.
 */
function sourceProvenanceWhere() {
  return { source: { notIn: UNPROVENANCED_SOURCES } };
}

// ---------- GET handler ----------

export async function GET(request: Request): Promise<NextResponse<DataProvenanceResponse>> {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth as any

    const timestamp = new Date().toISOString();

    // ---- Team ----
    const teamTotal = await db.team.count();
    const teamWith = await db.team.count({
      where: sourceProvenanceWhere(),
    });

    // ---- Player ----
    const playerTotal = await db.player.count();
    const playerWith = await db.player.count({
      where: sourceProvenanceWhere(),
    });

    // ---- StandingEntry ----
    const standingTotal = await db.standingEntry.count();
    const standingWith = await db.standingEntry.count({
      where: sourceProvenanceWhere(),
    });

    // ---- Match (extended report) ----
    const matchTotal = await db.match.count();
    const matchWith = await db.match.count({
      where: sourceProvenanceWhere(),
    });

    // xG classification
    const realXg = await db.match.count({
      where: {
        homeXg: { not: null },
        homeXgSource: { not: null },
      },
    });
    const demoXg = await db.match.count({
      where: {
        homeXg: 0,
        homeXgSource: null,
      },
    });
    const nullXg = await db.match.count({
      where: { homeXg: null },
    });

    // ---- TeamAnalytic ----
    const analyticTotal = await db.teamAnalytic.count();
    const analyticWith = await db.teamAnalytic.count({
      where: {
        truthClass: { in: REAL_TRUTH_CLASSES },
      },
    });

    // ---- OddsSnapshot ----
    const oddsTotal = await db.oddsSnapshot.count();
    const oddsWith = await db.oddsSnapshot.count({
      where: sourceProvenanceWhere(),
    });

    // ---- NewsArticle ----
    // NewsArticle uses `sourceName` instead of `source`
    const newsTotal = await db.newsArticle.count();
    const newsWith = await db.newsArticle.count({
      where: { sourceName: { notIn: UNPROVENANCED_SOURCES } },
    });

    // ---- Prediction ----
    // User-generated content with no source/truthClass field.
    // All rows count as "without provenance" in the data-sourcing sense.
    const predictionTotal = await db.prediction.count();
    const predictionWith = 0;

    // ---- CanonicalTeam ----
    // Internal canonical entity — no source field.
    const canonicalTotal = await db.canonicalTeam.count();
    const canonicalWith = 0;

    // ---- SourceIdentity ----
    const identityTotal = await db.sourceIdentity.count();
    const identityWith = await db.sourceIdentity.count({
      where: sourceProvenanceWhere(),
    });

    // ---- SyncLog ----
    const syncTotal = await db.syncLog.count();
    const syncWith = await db.syncLog.count({
      where: sourceProvenanceWhere(),
    });

    // ---- Assemble table reports ----
    const tables: Record<string, TableReport> = {
      Team: {
        total: teamTotal,
        withProvenance: teamWith,
        withoutProvenance: teamTotal - teamWith,
      },
      Match: {
        total: matchTotal,
        withProvenance: matchWith,
        withoutProvenance: matchTotal - matchWith,
        realXg,
        demoXg,
        nullXg,
      } as MatchTableReport,
      Player: {
        total: playerTotal,
        withProvenance: playerWith,
        withoutProvenance: playerTotal - playerWith,
      },
      StandingEntry: {
        total: standingTotal,
        withProvenance: standingWith,
        withoutProvenance: standingTotal - standingWith,
      },
      TeamAnalytic: {
        total: analyticTotal,
        withProvenance: analyticWith,
        withoutProvenance: analyticTotal - analyticWith,
      },
      OddsSnapshot: {
        total: oddsTotal,
        withProvenance: oddsWith,
        withoutProvenance: oddsTotal - oddsWith,
      },
      NewsArticle: {
        total: newsTotal,
        withProvenance: newsWith,
        withoutProvenance: newsTotal - newsWith,
      },
      Prediction: {
        total: predictionTotal,
        withProvenance: predictionWith,
        withoutProvenance: predictionTotal - predictionWith,
      },
      CanonicalTeam: {
        total: canonicalTotal,
        withProvenance: canonicalWith,
        withoutProvenance: canonicalTotal - canonicalWith,
      },
      SourceIdentity: {
        total: identityTotal,
        withProvenance: identityWith,
        withoutProvenance: identityTotal - identityWith,
      },
      SyncLog: {
        total: syncTotal,
        withProvenance: syncWith,
        withoutProvenance: syncTotal - syncWith,
      },
    };

    // ---- Blockers ----
    const blockers: string[] = [];

    if (analyticTotal === 0) {
      blockers.push("TeamAnalytic: 0 rows (xG pipeline not operational)");
    }
    if (oddsTotal === 0) {
      blockers.push("OddsSnapshot: 0 rows (odds sync never triggered)");
    }
    if (newsTotal === 0) {
      blockers.push("NewsArticle: 0 rows (news sync never triggered)");
    }
    if (demoXg > 0) {
      blockers.push(
        `Match: ${demoXg} rows with demo xG=0 and null source (run clean-demo-data.ts)`
      );
    }
    if (nullXg > 0 && matchTotal > 0) {
      blockers.push(
        `Match: ${nullXg} rows with null xG (xG data not yet imported)`
      );
    }
    if (teamTotal > 0 && teamWith === 0) {
      blockers.push(
        "Team: all rows have source='unknown' (team sync incomplete)"
      );
    }
    if (playerTotal > 0 && playerWith === 0) {
      blockers.push(
        "Player: all rows have source='unknown' (player sync incomplete)"
      );
    }
    if (standingTotal > 0 && standingWith === 0) {
      blockers.push(
        "StandingEntry: all rows have source='unknown' (standings sync incomplete)"
      );
    }
    if (realXg === 0 && matchTotal > 0) {
      blockers.push(
        "Match: 0 rows with real xG (no xG source has been imported)"
      );
    }

    // ---- Completion % ----
    // Weighted rough estimate across key data pillars.
    const weights: Record<string, number> = {
      Team: 15,
      Player: 10,
      StandingEntry: 10,
      Match: 25,
      TeamAnalytic: 15,
      OddsSnapshot: 10,
      NewsArticle: 5,
      Prediction: 5,
      CanonicalTeam: 3,
      SourceIdentity: 2,
      SyncLog: 0,
    };

    let totalWeight = 0;
    let earnedWeight = 0;

    for (const [tableName, report] of Object.entries(tables)) {
      const w = weights[tableName] ?? 0;
      totalWeight += w;

      if (w === 0) continue;
      if (report.total === 0) continue;

      if (tableName === "Match") {
        const matchReport = report as MatchTableReport;
        if (matchReport.realXg > 0) {
          earnedWeight +=
            w * Math.min(matchReport.realXg / matchReport.total, 1);
        }
      } else if (tableName === "Prediction") {
        // User-generated; existence counts as complete
        earnedWeight += w;
      } else {
        earnedWeight += w * (report.withProvenance / report.total);
      }
    }

    const completionPct =
      totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    // ---- Build response ----
    const response: DataProvenanceResponse = {
      timestamp,
      tables,
      blockers,
      completionPct,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "[data-provenance] Failed to compute provenance report:",
      error
    );
    return NextResponse.json(
      {
        error: "Failed to compute data provenance report",
        timestamp: new Date().toISOString(),
        tables: {},
        blockers: ["Unexpected error computing provenance"],
        completionPct: 0,
      },
      { status: 500 }
    );
  }
}
