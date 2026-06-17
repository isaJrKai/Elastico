import { Router, Request, Response } from "express";
import { db, Match, MatchEvent } from "./db";
import { predictMatch, generateTimelineEvents } from "./predictions";
import { authMiddleware, adminMiddleware, AuthenticatedRequest } from "./auth";
import { analyzeAlertWithGemini, generateHalftimeAnalysisWithGemini, summarizeStadiumNewsWithGemini, summarizeAllNewsItemsWithGemini, translateNewsItemWithGemini } from "./gemini";

export const matchesRouter = Router();

// Storage of active intervals for real-time live match simulators
const activeIntervals: Record<number, NodeJS.Timeout> = {};

// ELO K-Factor for World Cup 2026 matches
const ELO_K_FACTOR = 40;

// Update team ELO Ratings based on match outcome
function updateTeamEloRatings(match: Match) {
  const homeTeam = db.teams.find((t) => t.id === match.home_team_id);
  const awayTeam = db.teams.find((t) => t.id === match.away_team_id);

  if (!homeTeam || !awayTeam) return;

  const R_home = homeTeam.elo_rating;
  const R_away = awayTeam.elo_rating;

  // Expected outcome E(A) = 1 / (1 + 10^((Elo_B - Elo_A) / 400))
  const E_home = 1 / (1 + Math.pow(10, (R_away - R_home) / 400));
  const E_away = 1 - E_home;

  // S_home / S_away values (1 = win, 0.5 = draw, 0 = loss)
  let S_home = 0.5;
  let S_away = 0.5;

  if (match.home_score > match.away_score) {
    S_home = 1;
    S_away = 0;
  } else if (match.home_score < match.away_score) {
    S_home = 0;
    S_away = 1;
  }

  // Calculate new ELOs
  homeTeam.elo_rating = Math.round((R_home + ELO_K_FACTOR * (S_home - E_home)) * 10) / 10;
  awayTeam.elo_rating = Math.round((R_away + ELO_K_FACTOR * (S_away - E_away)) * 10) / 10;

  console.log(`[ELO SYSTEM] ${homeTeam.name} ELO updated ${R_home} -> ${homeTeam.elo_rating}`);
  console.log(`[ELO SYSTEM] ${awayTeam.name} ELO updated ${R_away} -> ${awayTeam.elo_rating}`);
}

// Generate continuous past head to head meetings deterministic indexes
export function getPastMeetingsTrend(homeTeamName: string, awayTeamName: string, homeElo: number = 1500, awayElo: number = 1500) {
  const dates = ["2021-06-12", "2022-11-20", "2023-06-25", "2024-10-18", "2025-03-31", "2026-01-14"];
  const stages = ["World Cup QF", "Friendly Cup", "International League", "Euro-Am Cup", "Continental Challenge", "Global Playoff"];
  const sumVal = (homeTeamName.charCodeAt(0) || 65) + (awayTeamName.charCodeAt(0) || 66);

  return Array.from({ length: 6 }).map((_, idx) => {
    const factor = (idx + 1) * sumVal;
    const homeScore = (factor % 3);
    let awayScore = ((factor + idx + 1) % 4);
    if (homeScore === 0 && awayScore === 0 && idx % 2 === 0) {
      awayScore = 1; // avoid excessive boring draws
    }
    const date = dates[idx];
    const stage = stages[idx];
    const scoreText = `${homeScore}-${awayScore}`;

    // Gracefully simulate past ELO Ratings progressing over meetings up to current actual ratings
    const homeEloAtClash = Math.round(homeElo - (6 - idx) * 16 + (homeScore - awayScore) * 12);
    const awayEloAtClash = Math.round(awayElo - (6 - idx) * 14 + (awayScore - homeScore) * 12);

    return {
      meetingNumber: idx + 1,
      date,
      stage,
      score: scoreText,
      homeScore,
      awayScore,
      goalDifference: homeScore - awayScore,
      homePerformanceIndex: 50 + (homeScore - awayScore) * 15 + (idx % 2 === 0 ? 5 : -4),
      awayPerformanceIndex: 50 + (awayScore - homeScore) * 15 + (idx % 2 === 0 ? -5 : 4),
      homeElo: homeEloAtClash,
      awayElo: awayEloAtClash,
    };
  });
}

function generateTeamForm(teamName: string, seed: number): ("W" | "D" | "L")[] {
  const formOptions: ("W" | "D" | "L")[][] = [
    ["W", "D", "L", "W", "W"],
    ["L", "W", "D", "W", "L"],
    ["W", "W", "W", "D", "W"],
    ["L", "L", "D", "W", "D"],
    ["D", "W", "L", "W", "W"],
    ["W", "D", "W", "L", "W"],
    ["L", "W", "L", "W", "D"],
    ["D", "D", "W", "W", "L"],
  ];
  const charCodeSum = Array.from(teamName).reduce((acc, char) => acc + char.charCodeAt(0), 0) + seed;
  return formOptions[charCodeSum % formOptions.length];
}

// Helper to map team primary and secondary jersey colors
export function getTeamJerseyColors(teamName: string): { primary: string; secondary: string } {
  const normalized = teamName.trim().toLowerCase();
  switch (normalized) {
    case "brazil":
      return { primary: "#fbbf24", secondary: "#15803d" }; // Yellow / Green
    case "germany":
      return { primary: "#e2e8f0", secondary: "#0f172a" }; // White / Black (using Slate-200 for visibility)
    case "argentina":
      return { primary: "#38bdf8", secondary: "#f8fafc" }; // Sky Blue / White
    case "france":
      return { primary: "#1d4ed8", secondary: "#dc2626" }; // Blue / Red
    case "england":
      return { primary: "#ffffff", secondary: "#1e3a8a" }; // White / Blue
    case "spain":
      return { primary: "#dc2626", secondary: "#fbbf24" }; // Red / Gold
    case "portugal":
      return { primary: "#991b1b", secondary: "#15803d" }; // Maroon / Green
    case "netherlands":
      return { primary: "#f97316", secondary: "#ffffff" }; // Orange / White
    default:
      return { primary: "#10b981", secondary: "#14b8a6" }; // Default Emerald / Teal
  }
}

// Helper to pre-calculate team profiles for matches
function getMatchWithMetadata(match: Match) {
  const homeTeam = db.teams.find((t) => t.id === match.home_team_id);
  const awayTeam = db.teams.find((t) => t.id === match.away_team_id);

  const homeElo = homeTeam?.elo_rating || 1500;
  const awayElo = awayTeam?.elo_rating || 1500;
  const prediction = predictMatch(homeElo, awayElo, 2000);

  const homeName = homeTeam?.name || "Home Team";
  const awayName = awayTeam?.name || "Away Team";

  // Calculate percentage divisions for analyst public votes
  const votesHome = match.votes_home || 0;
  const votesDraw = match.votes_draw || 0;
  const votesAway = match.votes_away || 0;
  const totalVotes = votesHome + votesDraw + votesAway;

  const votePercentages = {
    home: totalVotes > 0 ? (votesHome / totalVotes) : 0.33,
    draw: totalVotes > 0 ? (votesDraw / totalVotes) : 0.33,
    away: totalVotes > 0 ? (votesAway / totalVotes) : 0.34,
  };

  const homeColors = getTeamJerseyColors(homeName);
  const awayColors = getTeamJerseyColors(awayName);

  return {
    ...match,
    home_team: homeName,
    away_team: awayName,
    home_elo: homeElo,
    away_elo: awayElo,
    home_crest: homeTeam?.crest_url || `https://crests.football-data.org/${homeName.substring(0, 3).toUpperCase()}.png`,
    away_crest: awayTeam?.crest_url || `https://crests.football-data.org/${awayName.substring(0, 3).toUpperCase()}.png`,
    home_jersey_color: homeColors.primary,
    away_jersey_color: awayColors.primary,
    win_probability: prediction.win_probability,
    mu_home: prediction.mu_home,
    mu_away: prediction.mu_away,
    confidence_intervals: prediction.confidence_intervals,
    score_grid: prediction.score_grid,
    votes_distribution: {
      home: votesHome,
      draw: votesDraw,
      away: votesAway,
      total: totalVotes,
      percentages: votePercentages,
    },
    home_form: generateTeamForm(homeName, match.id * 3),
    away_form: generateTeamForm(awayName, match.id * 7),
    historical_clashes: getPastMeetingsTrend(homeName, awayName, homeElo, awayElo),
  };
}

// ── GET /matches ─────────────────────────────────────────────────────────────
matchesRouter.get("/", (req: Request, res: Response) => {
  try {
    const list = db.matches.map((m) => getMatchWithMetadata(m));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve matches" });
  }
});

// ── GET /matches/:id ──────────────────────────────────────────────────────────
matchesRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const origin = db.matches.find((m) => m.id === id);

    if (!origin) {
      return res.status(404).json({ error: "Match not found" });
    }

    const payload = getMatchWithMetadata(origin);
    const events = db.match_events
      .filter((e) => e.match_id === id)
      .sort((a, b) => b.minute - a.minute); // Newest events first

    res.json({
      match: payload,
      events,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load match properties" });
  }
});

// ── POST /matches ─────────────────────────────────────────────────────────────
matchesRouter.post("/", adminMiddleware, (req: Request, res: Response) => {
  try {
    const { home_team_id, away_team_id, date, stadium, stage } = req.body;

    if (!home_team_id || !away_team_id || !date || !stadium) {
      return res.status(422).json({ error: "Home team, away team, date, and stadium are required" });
    }

    const newId = db.matches.length > 0 ? Math.max(...db.matches.map((m) => m.id)) + 1 : 1;

    const newMatch: Match = {
      id: newId,
      home_team_id: parseInt(home_team_id),
      away_team_id: parseInt(away_team_id),
      date,
      stadium,
      stage: stage || "Group Stage",
      status: "scheduled",
      home_score: 0,
      away_score: 0,
      simulation_minute: 0,
      votes_home: Math.floor(20 + Math.random() * 40),
      votes_draw: Math.floor(10 + Math.random() * 20),
      votes_away: Math.floor(15 + Math.random() * 30),
      voted_users: {},
    };

    db.matches.push(newMatch);
    db.save();

    res.status(201).json(getMatchWithMetadata(newMatch));
  } catch (err) {
    res.status(500).json({ error: "Failed to create match" });
  }
});

// Helper local clear
function dbFlushMatchEvents(matchId: number) {
  const filtered = db.match_events.filter((e) => e.match_id !== matchId);
  db.match_events.length = 0;
  db.match_events.push(...filtered);
  db.save();
}

// ── CORE TICKING SIMULATOR INJECTED WITH HALFTIME PAUSE ──────────────────────
function runTickingSimulator(mId: number, startMin: number) {
  const match = db.matches.find((m) => m.id === mId);
  if (!match) return;

  // Clear existing intervals completely
  if (activeIntervals[mId]) {
    clearInterval(activeIntervals[mId]);
  }

  const homeTeam = db.teams.find((t) => t.id === match.home_team_id);
  const awayTeam = db.teams.find((t) => t.id === match.away_team_id);
  const homePlayers = db.players.filter((p) => p.team_id === match.home_team_id).map((p) => p.name);
  const awayPlayers = db.players.filter((p) => p.team_id === match.away_team_id).map((p) => p.name);

  const matchMeta = getMatchWithMetadata(match);
  const mu_home = matchMeta.mu_home;
  const mu_away = matchMeta.mu_away;

  // Generate full potential timeline matching actual intensity
  const fullTimeline = generateTimelineEvents(
    mId,
    match.home_team_id,
    match.away_team_id,
    homePlayers.length > 0 ? homePlayers : ["Striker A", "Midfielder A"],
    awayPlayers.length > 0 ? awayPlayers : ["Striker B", "Midfielder B"],
    mu_home,
    mu_away
  );

  let currentMin = startMin;

  activeIntervals[mId] = setInterval(() => {
    currentMin += 5;

    // Check Halftime Boundary
    if (currentMin === 45 && !match.halftime_prediction) {
      match.simulation_minute = 45;
      match.status = "live";
      
      // Seed a Halftime Break commentary log
      const evId = db.match_events.length > 0 ? Math.max(...db.match_events.map((o) => o.id)) + 1 : 1;
      db.match_events.push({
        id: evId,
        match_id: mId,
        minute: 45,
        event_type: "substitution",
        description: `HALFTIME WHISTLE! Teams march into the locker rooms with scores lock at ${match.home_score} - ${match.away_score}. Match timeline paused for analyst halftime forecasts.`,
        created_at: new Date().toISOString()
      });

      db.save();
      
      // Stop ticking until prediction is saved (which will restart ticking at 45')
      clearInterval(activeIntervals[mId]);
      delete activeIntervals[mId];
      console.log(`[SIMULATOR PAUSED] Match #${mId} paused at Halftime for predictions.`);
      return;
    }

    if (currentMin >= 90) {
      currentMin = 90;
      match.simulation_minute = 90;
      match.status = "finished";

      clearInterval(activeIntervals[mId]);
      delete activeIntervals[mId];

      // Evaluate Halftime prediction if exists
      if (match.halftime_prediction) {
        const hGoals = db.match_events.filter(
          (e) => e.match_id === mId && e.minute > 45 && e.event_type === "goal"
        );
        const homeGoals = hGoals.filter((e) => e.team_id === match.home_team_id).length;
        const awayGoals = hGoals.filter((e) => e.team_id === match.away_team_id).length;
        const totalGoals = homeGoals + awayGoals;

        let isCorrect = false;
        if (match.halftime_prediction === "over15" && totalGoals >= 2) isCorrect = true;
        if (match.halftime_prediction === "under15" && totalGoals < 2) isCorrect = true;
        
        if (match.halftime_prediction === "homeScoreNext" && homeGoals > 0) {
          // Check if home scored before away in second half
          const homeFirst = hGoals.filter(e => e.team_id === match.home_team_id)[0];
          const awayFirst = hGoals.filter(e => e.team_id === match.away_team_id)[0];
          if (!awayFirst || (homeFirst && homeFirst.minute <= awayFirst.minute)) {
            isCorrect = true;
          }
        }
        if (match.halftime_prediction === "awayScoreNext" && awayGoals > 0) {
          const homeFirst = hGoals.filter(e => e.team_id === match.home_team_id)[0];
          const awayFirst = hGoals.filter(e => e.team_id === match.away_team_id)[0];
          if (!homeFirst || (awayFirst && awayFirst.minute <= homeFirst.minute)) {
            isCorrect = true;
          }
        }

        match.halftime_prediction_status = isCorrect ? "correct" : "incorrect";
      }

      // Record final timeline commentary
      const finalEvId = db.match_events.length > 0 ? Math.max(...db.match_events.map((o) => o.id)) + 1 : 1;
      db.match_events.push({
        id: finalEvId,
        match_id: mId,
        minute: 90,
        event_type: "substitution",
        description: `FULL TIME CONCLUDED! The referee has blown the final whistle. Final tactical audit logged.`,
        created_at: new Date().toISOString()
      });

      updateTeamEloRatings(match);
      db.save();
      return;
    }

    match.simulation_minute = currentMin;

    // Filter and insert events up to current minute
    const currentEvents = fullTimeline.filter((e) => e.minute > currentMin - 5 && e.minute <= currentMin);
    currentEvents.forEach((ev) => {
      const evId = db.match_events.length > 0 ? Math.max(...db.match_events.map((o) => o.id)) + 1 : 1;
      const newEv: MatchEvent = {
        id: evId,
        match_id: mId,
        minute: ev.minute,
        event_type: ev.event_type,
        team_id: ev.team_id,
        player_name: ev.player_name,
        description: ev.description,
        created_at: new Date().toISOString(),
      };

      db.match_events.push(newEv);

      // Update score
      if (ev.event_type === "goal") {
        if (ev.team_id === match.home_team_id) {
          match.home_score++;
        } else if (ev.team_id === match.away_team_id) {
          match.away_score++;
        }
      }
    });

    db.save();
  }, 1200); // 5 minute segments every 1.2 seconds
}

// ── POST /simulation/start/:matchId ───────────────────────────────────────────
matchesRouter.post("/simulation/start/:matchId", authMiddleware, (req: Request, res: Response) => {
  try {
    const mId = parseInt(req.params.matchId);
    const match = db.matches.find((m) => m.id === mId);

    if (!match) return res.status(404).json({ error: "Match not found" });

    // Cancel existing interval
    if (activeIntervals[mId]) {
      clearInterval(activeIntervals[mId]);
      delete activeIntervals[mId];
    }

    // Reset parameters to Live
    match.status = "live";
    match.simulation_minute = 0;
    match.home_score = 0;
    match.away_score = 0;
    match.halftime_prediction = undefined;
    match.halftime_prediction_status = undefined;

    // Flush old events
    dbFlushMatchEvents(mId);

    // Seed kickoff timeline log
    db.match_events.push({
      id: db.match_events.length > 0 ? Math.max(...db.match_events.map((o) => o.id)) + 1 : 1,
      match_id: mId,
      minute: 0,
      event_type: "substitution",
      description: `KICK-OFF! The game starts under dramatic stadium floodlights! Analysts are tracking game pace and telemetry.`,
      created_at: new Date().toISOString()
    });

    runTickingSimulator(mId, 0);

    res.json({ message: "Poisson temporal simulator initialized!", match: getMatchWithMetadata(match) });
  } catch (err) {
    res.status(500).json({ error: "Failed to initiate simulation sequence" });
  }
});

// ── GET /simulation/state/:matchId ──────────────────────────────────────────── (Already handled above but keeping mapped)
matchesRouter.get("/simulation/state/:matchId", (req: Request, res: Response) => {
  const mId = parseInt(req.params.matchId);
  const match = db.matches.find((m) => m.id === mId);

  if (!match) return res.status(404).json({ error: "Match not found" });

  const events = db.match_events.filter((e) => e.match_id === mId).sort((a, b) => b.minute - a.minute);
  res.json({
    id: match.id,
    status: match.status,
    home_score: match.home_score,
    away_score: match.away_score,
    simulation_minute: match.simulation_minute,
    halftime_prediction: match.halftime_prediction,
    halftime_prediction_status: match.halftime_prediction_status,
    events,
  });
});

// ── POST /simulation/quick/:matchId ───────────────────────────────────────────
matchesRouter.post("/simulation/quick/:matchId", authMiddleware, (req: Request, res: Response) => {
  try {
    const mId = parseInt(req.params.matchId);
    const match = db.matches.find((m) => m.id === mId);

    if (!match) return res.status(404).json({ error: "Match not found" });

    if (activeIntervals[mId]) {
      clearInterval(activeIntervals[mId]);
      delete activeIntervals[mId];
    }

    match.simulation_minute = 90;
    match.status = "finished";
    match.home_score = 0;
    match.away_score = 0;
    
    // Seed halftime prediction randomly if not made so it resolves fully
    if (!match.halftime_prediction) {
      match.halftime_prediction = "over15";
    }

    const filtered = db.match_events.filter((e) => e.match_id !== mId);
    db.match_events.length = 0;
    db.match_events.push(...filtered);

    const homePlayers = db.players.filter((p) => p.team_id === match.home_team_id).map((p) => p.name);
    const awayPlayers = db.players.filter((p) => p.team_id === match.away_team_id).map((p) => p.name);

    const matchMeta = getMatchWithMetadata(match);
    const mu_home = matchMeta.mu_home;
    const mu_away = matchMeta.mu_away;

    const timeline = generateTimelineEvents(
      mId,
      match.home_team_id,
      match.away_team_id,
      homePlayers.length > 0 ? homePlayers : ["Striker A", "Midfielder A"],
      awayPlayers.length > 0 ? awayPlayers : ["Striker B", "Midfielder B"],
      mu_home,
      mu_away
    );

    // Initial Kick-off log
    db.match_events.push({
      id: db.match_events.length > 0 ? Math.max(...db.match_events.map((o) => o.id)) + 1 : 1,
      match_id: mId,
      minute: 1,
      event_type: "substitution",
      description: "Match simulation resolved instantly via analytical quick sim card.",
      created_at: new Date().toISOString()
    });

    timeline.forEach((ev) => {
      const evId = db.match_events.length > 0 ? Math.max(...db.match_events.map((o) => o.id)) + 1 : 1;
      db.match_events.push({
        id: evId,
        match_id: mId,
        minute: ev.minute,
        event_type: ev.event_type,
        team_id: ev.team_id,
        player_name: ev.player_name,
        description: ev.description,
        created_at: new Date().toISOString(),
      });

      if (ev.event_type === "goal") {
        if (ev.team_id === match.home_team_id) match.home_score++;
        else if (ev.team_id === match.away_team_id) match.away_score++;
      }
    });

    // Evaluate halftime predictions status
    const hGoals = timeline.filter((e) => e.minute > 45 && e.event_type === "goal");
    const totalGoals = hGoals.length;
    match.halftime_prediction_status = (match.halftime_prediction === "over15" && totalGoals >= 2) || (match.halftime_prediction === "under15" && totalGoals < 2) ? "correct" : "incorrect";

    updateTeamEloRatings(match);
    db.save();

    res.json({ message: "Match simulation resolved instantly", match: getMatchWithMetadata(match) });
  } catch (err) {
    res.status(500).json({ error: "Instant simulation failed" });
  }
});

// ── GET/POST INTERACTIVE ANALYST VOTING POLLS ────────────────────────────────
matchesRouter.post("/:id/vote", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const mId = parseInt(req.params.id);
    const match = db.matches.find((m) => m.id === mId);
    
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (!req.user) return res.status(401).json({ error: "Not logged in" });

    const voteChoice = req.body.vote as "home" | "draw" | "away";
    if (!["home", "draw", "away"].includes(voteChoice)) {
      return res.status(422).json({ error: "Vote must be 'home', 'draw', or 'away'" });
    }

    if (!match.voted_users) {
      match.voted_users = {};
    }

    const userIdStr = String(req.user.id);
    const oldVote = match.voted_users[userIdStr];

    if (oldVote === voteChoice) {
      return res.json({ message: "You have already cast this prediction vote!", match: getMatchWithMetadata(match) });
    }

    // Invert previous votes if updating selection
    if (oldVote) {
      if (oldVote === "home") match.votes_home = Math.max(0, (match.votes_home || 0) - 1);
      if (oldVote === "draw") match.votes_draw = Math.max(0, (match.votes_draw || 0) - 1);
      if (oldVote === "away") match.votes_away = Math.max(0, (match.votes_away || 0) - 1);
    }

    // Increment selection
    if (voteChoice === "home") match.votes_home = (match.votes_home || 0) + 1;
    if (voteChoice === "draw") match.votes_draw = (match.votes_draw || 0) + 1;
    if (voteChoice === "away") match.votes_away = (match.votes_away || 0) + 1;

    match.voted_users[userIdStr] = voteChoice;
    db.save();

    res.json({
      message: "Forecast vote logged in successfully!",
      voted: voteChoice,
      match: getMatchWithMetadata(match)
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to post prediction vote" });
  }
});

// ── POST /matches/:id/halftime-prediction ─────────────────────────────────────
matchesRouter.post("/:id/halftime-prediction", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const mId = parseInt(req.params.id);
    const match = db.matches.find((m) => m.id === mId);
    
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const { prediction } = req.body;
    if (!["over15", "homeScoreNext", "awayScoreNext", "under15"].includes(prediction)) {
      return res.status(422).json({ error: "Invalid halftime prediction key" });
    }

    match.halftime_prediction = prediction;
    match.halftime_prediction_status = "pending";
    db.save();

    // Re-launch simulated ticking starting after halftime (minute 45 boundary)
    runTickingSimulator(mId, 45);

    res.json({
      message: "Prediction locked! Ticking temporal simulator has been successfully resumed.",
      match: getMatchWithMetadata(match)
    });
  } catch (err) {
    res.status(500).json({ error: "Halftime prediction locking sequence aborted" });
  }
});

// ── POST /matches/:id/alerts/generate ─────────────────────────────────────────
matchesRouter.post("/:id/alerts/generate", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mId = parseInt(req.params.id);
    const match = db.matches.find((m) => m.id === mId);
    
    if (!match) return res.status(404).json({ error: "Match not found" });

    const metadata = getMatchWithMetadata(match);
    const alertIndex = Math.floor(Math.random() * 100);

    // Call Gemini API analyze tool
    const analyzedAlert = await analyzeAlertWithGemini(alertIndex, metadata.home_team, metadata.away_team);

    res.json({
      alert: analyzedAlert
    });
  } catch (err) {
    res.status(500).json({ error: "Gemini alert evaluation aborted" });
  }
});

// ── POST /matches/:id/halftime-custom-analysis ────────────────────────────────
matchesRouter.post("/:id/halftime-custom-analysis", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mId = parseInt(req.params.id);
    const match = db.matches.find((m) => m.id === mId);
    
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(422).json({ error: "Analysis instruction prompt is required" });
    }

    const metadata = getMatchWithMetadata(match);
    const events = db.match_events.filter((e) => e.match_id === mId && e.minute <= 45);

    const analysis = await generateHalftimeAnalysisWithGemini(
      {
        home_team: metadata.home_team,
        away_team: metadata.away_team,
        home_score: metadata.home_score,
        away_score: metadata.away_score,
        home_elo: metadata.home_elo,
        away_elo: metadata.away_elo,
        mu_home: metadata.mu_home,
        mu_away: metadata.mu_away,
        stadium: metadata.stadium,
        stage: metadata.stage,
      },
      events,
      prompt
    );

    match.halftime_custom_prompt = prompt;
    match.halftime_custom_analysis = analysis;
    db.save();

    res.json({
      prompt,
      analysis,
      match: getMatchWithMetadata(match)
    });
  } catch (err) {
    console.error("[matches] Failed to generate custom halftime analysis", err);
    res.status(500).json({ error: "Failed to generate custom halftime analysis" });
  }
});

// ── GET /matches/stadium-news/articles ──────────────────────────────────────────
matchesRouter.get("/stadium-news/articles", async (req: Request, res: Response) => {
  try {
    // Generates a pool of real-time stadium occurrences that happen in parallel with matches
    const simulatedStadiumEvents = [
      {
        id: "ev-1",
        title: "East Stand Decibel Record Smashed",
        summary: "Stadium audio sensors report wave pressures peaking at 122.4 dB as home fan groups start chanting matching rhythm drums.",
        category: "Local",
        url: "#",
        time: "Just now",
        thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-2",
        title: "Drone Hovering Detected Over MetLife Canopy",
        summary: "Security officials identify a minor authorized aerial analysis drone tracking wind shears over south goal zones.",
        category: "Tactics",
        url: "#",
        time: "3m ago",
        thumbnail: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-3",
        title: "Steward Alert: Pitch Temperature Spikes to 31°C",
        summary: "Rapid thermal heat waves on turf layers might require double hydration breaks at the 30th and 75th minute outlines.",
        category: "Tactics",
        url: "#",
        time: "8m ago",
        thumbnail: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-4",
        title: "Scouts Assemble in VIP Box Row B",
        summary: "Elite representatives from Milan and Munich spotted inspecting the tactical positioning and transition rates of youth starters.",
        category: "Transfer",
        url: "#",
        time: "15m ago",
        thumbnail: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-5",
        title: "Referee Whistle Fluid Dilations Checked",
        summary: "Referee team reports high conformity with standard World Cup protocol limits. Fast yellow-card distributions expected.",
        category: "Global",
        url: "#",
        time: "25m ago",
        thumbnail: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-6",
        title: "Sudden Micro-Rain Cloud approaching Venue Location",
        summary: "Local meteorology units verify a fast-moving moisture cloud could drop pitch slide friction coefficients by 9.4% in 15 mins.",
        category: "Tactics",
        url: "#",
        time: "35m ago",
        thumbnail: "https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-7",
        title: "VIP Lounge Celebrity Spectacle Sparks Media Burst",
        summary: "Legendary retired forwards seen chatting excitedly with supporters in the South Wing, predicting a standard overtime clash.",
        category: "Local",
        url: "#",
        time: "50m ago",
        thumbnail: "https://images.unsplash.com/photo-1540747737956-37872a7e1ad0?q=80&w=300&auto=format&fit=crop"
      },
      {
        id: "ev-8",
        title: "Unprecedented Flag Wave Synchronization",
        summary: "Over 8,000 spectators coordinate their flag crest rotations, creating a stunning visual wind-tunnel grid in seating tier A.",
        category: "Local",
        url: "#",
        time: "1h ago",
        thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop"
      }
    ];

    res.json({
      events: simulatedStadiumEvents
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load simulated stadium occurrences" });
  }
});

// ── POST /matches/stadium-news/summarize ─────────────────────────────────────────
matchesRouter.post("/stadium-news/summarize", async (req: Request, res: Response) => {
  try {
    const { title, summary, category } = req.body;
    if (!title || !summary) {
      return res.status(422).json({ error: "Title and Summary parameter values required for AI journalism summaries" });
    }

    const catchyLine = await summarizeStadiumNewsWithGemini(title, summary, category || "Local");

    res.json({
      success: true,
      news_title: title,
      category: category || "Local",
      summarized_headline: catchyLine,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[matches] Stadium news summary crashed", err);
    res.status(500).json({ error: "Server-side Gemini summary sequence aborted" });
  }
});

// ── POST /matches/stadium-news/summarize-all ─────────────────────────────────────
matchesRouter.post("/stadium-news/summarize-all", async (req: Request, res: Response) => {
  try {
    const { articles } = req.body;
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(422).json({ error: "Articles array is required" });
    }

    const combinedSummary = await summarizeAllNewsItemsWithGemini(articles);

    res.json({
      success: true,
      summary: combinedSummary,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[matches] Summarize all news items failed", err);
    res.status(500).json({ error: "Server-side Gemini multi-summary sequence aborted" });
  }
});

// ── POST /matches/stadium-news/translate ─────────────────────────────────────────
matchesRouter.post("/stadium-news/translate", async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(422).json({ error: "Text and targetLanguage values are required" });
    }

    const translatedText = await translateNewsItemWithGemini(text, targetLanguage);

    res.json({
      success: true,
      translatedText,
      targetLanguage,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("[matches] Translation of news item failed", err);
    res.status(500).json({ error: "Server-side Gemini translation sequence aborted" });
  }
});



