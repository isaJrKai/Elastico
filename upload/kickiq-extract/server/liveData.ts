import { db } from "./db";
import { Team, Match, MatchEvent } from "./db";

// Baseline Elo Ratings for all 48 nations in FIFA World Cup 2026
export const BASELINE_ELO: Record<string, number> = {
  "Argentina": 1920, "France": 1895, "Brazil": 1880, "England": 1855,
  "Spain": 1845, "Portugal": 1830, "Germany": 1820, "Netherlands": 1800,
  "Italy": 1780, "Belgium": 1770, "Croatia": 1760, "Uruguay": 1750,
  "Morocco": 1740, "Colombia": 1730, "USA": 1710, "Mexico": 1700,
  "Senegal": 1690, "Japan": 1680, "Switzerland": 1670, "Denmark": 1660,
  "Iran": 1650, "South Korea": 1640, "Sweden": 1630, "Ukraine": 1620,
  "Austria": 1610, "Poland": 1600, "Turkey": 1590, "Tunisia": 1580,
  "Chile": 1570, "Ecuador": 1560, "Peru": 1550, "Wales": 1540,
  "Canada": 1530, "Algeria": 1520, "Egypt": 1510, "Nigeria": 1500,
  "Cameroon": 1490, "Australia": 1480, "Mali": 1470, "Costa Rica": 1465,
  "Ivory Coast": 1460, "Saudi Arabia": 1450, "Scotland": 1440, "Hungary": 1430,
  "Ghana": 1420, "Paraguay": 1410, "New Zealand": 1400, "Panama": 1390
};

let syncInterval: NodeJS.Timeout | null = null;
let standingsInterval: NodeJS.Timeout | null = null;
let lastSyncTimestamp: Date | null = null;
let apiRequestsThisMinute = 0;
let requestCounterReset: NodeJS.Timeout | null = null;

// Track processed finished match Elo recalculations to avoid double-processing
const processedEloMatchIds = new Set<number>();

// Rate limit helper resetting every 60s
function incrementApiQuota() {
  apiRequestsThisMinute++;
  if (!requestCounterReset) {
    requestCounterReset = setTimeout(() => {
      apiRequestsThisMinute = 0;
      requestCounterReset = null;
    }, 60000);
  }
}

export function getQuotaUsage() {
  return {
    requestsThisMinute: apiRequestsThisMinute,
    limit: 10,
    lastSync: lastSyncTimestamp?.toISOString() || null
  };
}

// Durable fetch with explicit AbortSignal timeout to resolve iframe / container networking blockages immediately
export async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Find team by name or create a new one
export function ensureTeam(name: string, countryCode?: string, crestUrl?: string): Team {
  const normalized = (name && typeof name === "string" ? name : "TBD").trim();
  let team = db.teams.find(t => t.name.toLowerCase() === normalized.toLowerCase());
  
  if (!team) {
    const nextId = db.teams.reduce((max, t) => t.id > max ? t.id : max, 0) + 1;
    const baseElo = BASELINE_ELO[normalized] || 1500;
    
    team = {
      id: nextId,
      name: normalized,
      country: countryCode || normalized,
      elo_rating: baseElo,
      crest_url: crestUrl || `https://crests.football-data.org/${normalized.substring(0, 3).toUpperCase()}.png`
    };
    db.teams.push(team);
    db.save();
  } else if (crestUrl && !team.crest_url) {
    team.crest_url = crestUrl;
    db.save();
  }
  return team;
}

// Recalculate Elo after finished match
export function recalculateElo(match: Match) {
  if (processedEloMatchIds.has(match.id)) return;
  
  const home = db.teams.find(t => t.id === match.home_team_id);
  const away = db.teams.find(t => t.id === match.away_team_id);
  
  if (!home || !away) return;
  
  const K = 40;
  const eloDiff = home.elo_rating - away.elo_rating;
  const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const expectedAway = 1 / (1 + Math.pow(10, eloDiff / 400));
  
  let actualHome = 0.5;
  let actualAway = 0.5;
  
  if (match.home_score > match.away_score) {
    actualHome = 1;
    actualAway = 0;
  } else if (match.home_score < match.away_score) {
    actualHome = 0;
    actualAway = 1;
  }
  
  home.elo_rating = Math.round(home.elo_rating + K * (actualHome - expectedHome));
  away.elo_rating = Math.round(away.elo_rating + K * (actualAway - expectedAway));
  
  // Also incorporate AI feedback-driven Continuous Learning Loop based on User predictions
  if (db.settings?.ai_continuous_learning) {
    const vH = match.votes_home || 0;
    const vD = match.votes_draw || 0;
    const vA = match.votes_away || 0;
    const totalVotes = vH + vD + vA;
    if (totalVotes > 0) {
      // Shunning extreme skewed patterns used intentionally to dumb/bias the AI model
      const maxShare = Math.max(vH, vD, vA) / totalVotes;
      const isSkewedDumbingAttempt = maxShare > 0.88 && totalVotes >= 5;
      
      if (isSkewedDumbingAttempt) {
        console.log(`[AI LEARNING SHIELD] Ignore heavily biased prediction distribution (~${Math.round(maxShare * 100)}% on one option) to prevent tactical AI contamination.`);
      } else {
        let alignmentFactor = 0.33;
        if (actualHome === 1) alignmentFactor = vH / totalVotes;
        else if (actualAway === 1) alignmentFactor = vA / totalVotes;
        else alignmentFactor = vD / totalVotes;

        const learningRate = db.settings.ai_learning_rate || 0.15;
        const adjustmentDelta = Math.round(30 * learningRate * (alignmentFactor - 0.33));
        if (adjustmentDelta !== 0) {
          if (actualHome === 1) {
            home.elo_rating += adjustmentDelta;
            away.elo_rating -= Math.round(adjustmentDelta / 2);
          } else if (actualAway === 1) {
            away.elo_rating += adjustmentDelta;
            home.elo_rating -= Math.round(adjustmentDelta / 2);
          } else {
            home.elo_rating += Math.round(adjustmentDelta / 3);
            away.elo_rating += Math.round(adjustmentDelta / 3);
          }
          console.log(`[AI LEARNING LOOP INJECTED] Adjusted ${home.name}/${away.name} ratings with alignment delta: ${adjustmentDelta}`);
        }
      }
    }
  }

  processedEloMatchIds.add(match.id);
  db.save();
  console.log(`[ELO Calibrated] ${home.name} (${home.elo_rating}) - ${away.name} (${away.elo_rating})`);
}

// Main sync from Football Data API
export async function forceSync(): Promise<boolean> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  lastSyncTimestamp = new Date();
  
  if (!apiKey) {
    console.warn("[liveData] FOOTBALL_DATA_API_KEY is missing. Degrading gracefully into progressive simulation mode.");
    runGracefulDegradationSimulation();
    return false;
  }

  try {
    console.log("[liveData] Fetching matches from football-data.org WC endpoint...");
    incrementApiQuota();
    
    const res = await fetchWithTimeout("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": apiKey }
    }, 2500);
    
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }
    
    const data = await res.json();
    if (!data.matches || !Array.isArray(data.matches)) {
      throw new Error("Invalid match structure response");
    }

    const liveMatchIdsToFetchEvents: number[] = [];

    for (const apiMatch of data.matches) {
      const homeTeamInfo = apiMatch.homeTeam;
      const awayTeamInfo = apiMatch.awayTeam;
      if (!homeTeamInfo || !awayTeamInfo) continue;

      const homeTeam = ensureTeam(homeTeamInfo.name, homeTeamInfo.tla, homeTeamInfo.crest);
      const awayTeam = ensureTeam(awayTeamInfo.name, awayTeamInfo.tla, awayTeamInfo.crest);

      // Map match status
      let mappedStatus: "scheduled" | "live" | "finished" = "scheduled";
      if (apiMatch.status === "IN_PLAY" || apiMatch.status === "PAUSED") {
        mappedStatus = "live";
        liveMatchIdsToFetchEvents.push(apiMatch.id);
      } else if (apiMatch.status === "FINISHED") {
        mappedStatus = "finished";
      }

      const fdTag = `[fd:${apiMatch.id}]`;
      
      // Look for match with FD tag in stadium or match parameters
      let match = db.matches.find(m => m.stadium.includes(fdTag));
      
      const homeScore = apiMatch.score?.fullTime?.home ?? 0;
      const awayScore = apiMatch.score?.fullTime?.away ?? 0;

      if (!match) {
        // Create new match
        const nextId = db.matches.reduce((max, m) => m.id > max ? m.id : max, 0) + 1;
        match = {
          id: nextId,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id,
          date: apiMatch.utcDate,
          stadium: `${apiMatch.venue || "Stadium"} ${fdTag}`,
          stage: apiMatch.stage || "Group Stage",
          status: mappedStatus,
          home_score: homeScore,
          away_score: awayScore,
          simulation_minute: apiMatch.minute || 0,
          votes_home: Math.floor(Math.random() * 40) + 10,
          votes_draw: Math.floor(Math.random() * 20) + 5,
          votes_away: Math.floor(Math.random() * 30) + 8,
          voted_users: {}
        };
        db.matches.push(match);
      } else {
        // Update in place
        match.home_score = homeScore;
        match.away_score = awayScore;
        match.status = mappedStatus;
        if (apiMatch.minute) {
          match.simulation_minute = apiMatch.minute;
        }
      }

      if (match.status === "finished") {
        recalculateElo(match);
      }
    }
    
    db.save();

    // Secondary deep synchronization for events if live requests are within limit budget
    if (liveMatchIdsToFetchEvents.length > 0 && apiRequestsThisMinute < 8) {
      for (const fdMatchId of liveMatchIdsToFetchEvents) {
        try {
          console.log(`[liveData] Syncing live match metrics for ref: ${fdMatchId}`);
          incrementApiQuota();
          const matchRes = await fetchWithTimeout(`https://api.football-data.org/v4/matches/${fdMatchId}`, {
            headers: { "X-Auth-Token": apiKey }
          }, 2000);
          if (matchRes.ok) {
            const matchDetail = await matchRes.json();
            processApiMatchEvents(fdMatchId, matchDetail);
          }
        } catch (e: any) {
          console.warn(`[liveData] Single live match grab failed or timed out: ${fdMatchId} (${e?.message || e})`);
        }
      }
    }

    return true;
  } catch (err: any) {
    console.warn(`[liveData] External Synchronization request failed (${err?.message || err}). Running offline simulation fallback.`);
    runGracefulDegradationSimulation();
    return false;
  }
}

// Map Match Events from details
function processApiMatchEvents(fdMatchId: number, matchDetail: any) {
  const fdTag = `[fd:${fdMatchId}]`;
  const match = db.matches.find(m => m.stadium.includes(fdTag));
  if (!match) return;

  const apiGoals = matchDetail.goals || [];
  const apiBookings = matchDetail.bookings || [];
  const apiSubstitutions = matchDetail.substitutions || [];

  // Re-sync goals
  apiGoals.forEach((g: any, index: number) => {
    const eventId = 100000 + fdMatchId * 10 + index;
    const exists = db.match_events.some(e => e.id === eventId);
    if (!exists) {
      const nextMinute = g.minute || 1;
      db.match_events.push({
        id: eventId,
        match_id: match.id,
        minute: nextMinute,
        event_type: "goal",
        player_name: g.scorer?.name || "Player",
        description: `Goal! Scored by ${g.scorer?.name || "Player"} for ${g.team?.name || "Team"}.`,
        created_at: new Date().toISOString()
      });
    }
  });

  // Re-sync bookings for red cards
  apiBookings.forEach((b: any, index: number) => {
    if (b.card === "RED" || b.card === "YELLOW_RED") {
      const eventId = 200000 + fdMatchId * 10 + index;
      const exists = db.match_events.some(e => e.id === eventId);
      if (!exists) {
        db.match_events.push({
          id: eventId,
          match_id: match.id,
          minute: b.minute || 45,
          event_type: "red_card",
          player_name: b.player?.name || "Player",
          description: `Red Card! Sent off: ${b.player?.name || "Player"}.`,
          created_at: new Date().toISOString()
        });
      }
    }
  });

  db.save();
}

// Fetch standings every 5 minutes to calibrate ELO
export async function syncStandings(): Promise<boolean> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) return false;

  try {
    console.log("[liveData] Calibrating Elo baseline against official Standings...");
    incrementApiQuota();
    const res = await fetchWithTimeout("https://api.football-data.org/v4/competitions/WC/standings", {
      headers: { "X-Auth-Token": apiKey }
    }, 2500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    if (data.standings && Array.isArray(data.standings)) {
      for (const st of data.standings) {
        if (!st.table) continue;
        for (const row of st.table) {
          const teamName = row.team?.name;
          if (teamName) {
            const team = ensureTeam(teamName, row.team.tla, row.team.crest);
            // Apply slight calibration nudges to ELO based on table points (+12 Elo points per table point)
            const expectedBase = BASELINE_ELO[team.name] || 1500;
            const tablePointsBonus = (row.points || 0) * 12;
            team.elo_rating = expectedBase + tablePointsBonus;
          }
        }
      }
      db.save();
      console.log("[liveData] Standing-based Elo Efficacy calibrated successfully.");
    }
    return true;
  } catch (err: any) {
    console.warn(`[liveData] Standing ELO calibration failed (${err?.message || err}). Skipping standing-based calibration.`);
    return false;
  }
}

// PROGRESSIVE DEGRADED FALLBACK MATCH SIMULATION ENGINE
// When API keys or net resources are unavailable, we progress live matches to mock real action
function runGracefulDegradationSimulation() {
  const liveMatches = db.matches.filter(m => m.status === "live");
  
  // If there are no live matches, let's randomly start one of the scheduled ones so the user has immediate visualization
  if (liveMatches.length === 0) {
    const scheduled = db.matches.filter(m => m.status === "scheduled");
    if (scheduled.length > 0) {
      const matchToStart = scheduled[Math.floor(Math.random() * scheduled.length)];
      matchToStart.status = "live";
      matchToStart.simulation_minute = 15;
      matchToStart.home_score = 0;
      matchToStart.away_score = 0;
      db.save();
      console.log(`[liveData Fallback] Began simulating matching: ${matchToStart.id}`);
    }
  }

  liveMatches.forEach(m => {
    // Increment minute
    m.simulation_minute = (m.simulation_minute || 0) + 1.5;
    
    // Check goal probability
    if (Math.random() < 0.08) {
      const isHome = Math.random() < 0.52;
      if (isHome) {
        m.home_score++;
      } else {
        m.away_score++;
      }

      // Add goal event
      const eventId = db.match_events.reduce((max, ev) => ev.id > max ? ev.id : max, 0) + 1;
      const team = isHome ? db.teams.find(t => t.id === m.home_team_id) : db.teams.find(t => t.id === m.away_team_id);
      db.match_events.push({
        id: eventId,
        match_id: m.id,
        minute: Math.floor(m.simulation_minute),
        event_type: "goal",
        team_id: isHome ? m.home_team_id : m.away_team_id,
        player_name: isHome ? "Forward A" : "Striker B",
        description: `⚽ GOAL! Scored for ${team?.name || "Squad"}. Expected scoreline drifts immediately!`,
        created_at: new Date().toISOString()
      });
      console.log(`[liveData MockGoal] Match ${m.id} score is now ${m.home_score} - ${m.away_score}`);
    } else if (Math.random() < 0.015) {
      // Red card event
      const eventId = db.match_events.reduce((max, ev) => ev.id > max ? ev.id : max, 0) + 1;
      const isHome = Math.random() < 0.5;
      const team = isHome ? db.teams.find(t => t.id === m.home_team_id) : db.teams.find(t => t.id === m.away_team_id);
      db.match_events.push({
        id: eventId,
        match_id: m.id,
        minute: Math.floor(m.simulation_minute),
        event_type: "red_card",
        team_id: isHome ? m.home_team_id : m.away_team_id,
        player_name: "Hothead Player",
        description: `🟥 RED CARD! Dismissal charged against ${team?.name}. Defensive dynamics compromised.`,
        created_at: new Date().toISOString()
      });
      console.log(`[liveData MockRed] Match ${m.id} red card!`);
    }

    if (m.simulation_minute >= 90) {
      m.status = "finished";
      recalculateElo(m);
      console.log(`[liveData MockFinish] Match ${m.id} finished! Final: ${m.home_score} - ${m.away_score}`);
    }
  });

  db.save();
}

// Initializer export
export function initLiveDataSync() {
  console.log("[liveData] Booting up World Cup live sync framework...");
  
  // Initial kickoff force sync
  forceSync().catch(err => {
    console.error("[liveData] Warm start match sync failed", err);
  });

  // Sync matches and live status every 60 seconds
  if (!syncInterval) {
    syncInterval = setInterval(() => {
      forceSync().catch(err => console.error("[liveData] Recurrent match sync error", err));
    }, 60000);
  }

  // Calibration sync of standings and ELO every 5 minutes
  if (!standingsInterval) {
    standingsInterval = setInterval(() => {
      syncStandings().catch(err => console.error("[liveData] Recurrent standings check error", err));
    }, 300000);
  }
}

export function stopLiveDataSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (standingsInterval) {
    clearInterval(standingsInterval);
    standingsInterval = null;
  }
  console.log("[liveData] World Cup live sync framework shut down clean.");
}
