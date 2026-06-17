import { Router, Request, Response } from "express";
import { db, User } from "./db";
import { adminMiddleware, AuthenticatedRequest } from "./auth";
import { forceSync } from "./liveData";
import os from "os";

export const adminRouter = Router();

// Secure all admin routes with admin authorization middleware
adminRouter.use(adminMiddleware);

adminRouter.post("/sync", async (req: Request, res: Response) => {
  try {
    const success = await forceSync();
    return res.json({ 
      success, 
      message: success ? "Forced synchronization successfully completed." : "Began degraded mock telemetry synchronization." 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to force synchronization event." });
  }
});

adminRouter.post("/clear-events", (req: Request, res: Response) => {
  try {
    db.match_events.length = 0;
    db.save();
    return res.json({ success: true, message: "Match events telemetry database cache cleared." });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to clear match events." });
  }
});

// ── GET /admin/stats ─────────────────────────────────────────────────────────
adminRouter.get("/stats", (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const totalUsers = db.users.filter((u) => u.role === "user").length;
    const activeToday = db.users.filter((u) => u.last_login && u.last_login >= todayStr).length;
    const proUsers = db.users.filter((u) => u.plan === "pro").length;
    const eliteUsers = db.users.filter((u) => u.plan === "elite").length;
    const totalMatches = db.matches.length;
    const liveMatches = db.matches.filter((m) => m.status === "live").length;
    const totalEvents = db.match_events.length;

    // Signups grouped by day (last 30 days)
    const signupsByDayMap: Record<string, number> = {};
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    db.users.forEach((u) => {
      const date = new Date(u.created_at);
      if (date >= thirtyDaysAgo) {
        const dayKey = date.toISOString().slice(0, 10);
        signupsByDayMap[dayKey] = (signupsByDayMap[dayKey] || 0) + 1;
      }
    });

    const signupsByDay = Object.keys(signupsByDayMap).map((k) => ({
      day: k,
      count: signupsByDayMap[k],
    })).sort((a, b) => a.day.localeCompare(b.day));

    // Request log distribution hourly (last 24h)
    const requestsByHourMap: Record<string, number> = {};
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    db.api_logs.forEach((log) => {
      const date = new Date(log.created_at);
      if (date >= twentyFourHoursAgo) {
        const hour = date.getHours().toString().padStart(2, "0") + ":00";
        requestsByHourMap[hour] = (requestsByHourMap[hour] || 0) + 1;
      }
    });

    const requestsByHour = Object.keys(requestsByHourMap).map((k) => ({
      hour: k,
      count: requestsByHourMap[k],
    })).sort((a, b) => a.hour.localeCompare(b.hour));

    // Compute Error Rate (Percentage of 4xx and 5xx logs in past hour)
    const pastHour = new Date(Date.now() - 60 * 60 * 1000);
    const recentLogs = db.api_logs.filter((l) => new Date(l.created_at) >= pastHour);
    const totalLogCount = recentLogs.length;
    const errorLogCount = recentLogs.filter((l) => l.status >= 400).length;
    const errorRate = totalLogCount > 0 ? ((errorLogCount / totalLogCount) * 100).toFixed(1) : "0.0";

    // Top endpoints
    const endpointHits: Record<string, { hits: number; total_ms: number }> = {};
    db.api_logs.forEach((log) => {
      if (!endpointHits[log.endpoint]) endpointHits[log.endpoint] = { hits: 0, total_ms: 0 };
      endpointHits[log.endpoint].hits++;
      endpointHits[log.endpoint].total_ms += log.duration_ms;
    });

    const topEndpoints = Object.keys(endpointHits).map((k) => ({
      endpoint: k,
      hits: endpointHits[k].hits,
      avg_ms: Math.round(endpointHits[k].total_ms / endpointHits[k].hits),
    })).sort((a, b) => b.hits - a.hits).slice(0, 10);

    const recentUsers = db.users.slice().reverse().slice(0, 15);

    res.json({
      overview: {
        totalUsers,
        activeToday,
        proUsers,
        eliteUsers,
        totalMatches,
        liveMatches,
        totalEvents,
        errorRate,
        requestsLastHour: totalLogCount,
      },
      signupsByDay: signupsByDay.length > 0 ? signupsByDay : [{ day: todayStr, count: totalUsers }],
      requestsByHour: requestsByHour.length > 0 ? requestsByHour : [{ hour: "12:00", count: 12 }],
      topEndpoints,
      recentUsers,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to gather administrative analytics metrics" });
  }
});

// ── GET /admin/users ─────────────────────────────────────────────────────────
adminRouter.get("/users", (req: Request, res: Response) => {
  try {
    const { search = "", plan = "", page = "1", limit = "20" } = req.query;
    const p = parseInt(page as string);
    const lim = parseInt(limit as string);
    const offset = (p - 1) * lim;

    let filtered = db.users.slice();

    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q) ||
          u.display_name.toLowerCase().includes(q)
      );
    }

    if (plan) {
      filtered = filtered.filter((u) => u.plan === plan);
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + lim);

    res.json({
      users: paginated,
      total,
      page: p,
      limit: lim,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve paginated user sets" });
  }
});

// ── PATCH /admin/users/:id ───────────────────────────────────────────────────
adminRouter.patch("/users/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const user = db.users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const { plan, role, is_active } = req.body;

    if (plan) user.plan = plan;
    if (role) user.role = role;
    if (is_active !== undefined) user.is_active = is_active ? 1 : 0;

    db.save();
    res.json({ message: "User profile updated successfully!", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────
adminRouter.delete("/users/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const user = db.users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: "User profile indeed not found" });
    }

    // Rather than hard deletion, de-activate the user account
    user.is_active = 0;
    db.save();

    res.json({ message: "User successfully suspended/deactivated." });
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate user" });
  }
});

// ── GET /admin/logs/export ───────────────────────────────────────────────────
adminRouter.get("/logs/export", (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = db.api_logs.filter((log) => {
      const isWithinLast30Days = new Date(log.created_at) >= thirtyDaysAgo;
      const isAuthEndpoint = log.endpoint.includes("/auth/");
      return isWithinLast30Days && isAuthEndpoint;
    });

    const detailedLogs = logs.map((log) => {
      const u = db.users.find((user) => user.id === log.user_id);
      return {
        id: log.id,
        created_at: log.created_at,
        email: u?.email || u?.phone || "Anonymous Guest",
        endpoint: log.endpoint,
        method: log.method,
        status: log.status,
        ip: log.ip,
        user_agent: log.user_agent,
        duration_ms: log.duration_ms,
      };
    });

    res.json(detailedLogs);
  } catch (err) {
    res.status(500).json({ error: "Failed to export login activity logs" });
  }
});

// ── GET /admin/logs ──────────────────────────────────────────────────────────
adminRouter.get("/logs", (req: Request, res: Response) => {
  try {
    const { status, limit = "100" } = req.query;
    let filteredLogs = db.api_logs.slice();

    if (status) {
      const s = parseInt(status as string);
      filteredLogs = filteredLogs.filter((l) => l.status === s);
    }

    const lim = parseInt(limit as string);
    const logs = filteredLogs.reverse().slice(0, lim).map((log) => {
      const u = db.users.find((user) => user.id === log.user_id);
      return {
        ...log,
        email: u?.email || u?.phone || "Anonymous Guest",
      };
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to load request logs table" });
  }
});

// ── GET /admin/teams ─────────────────────────────────────────────────────────
adminRouter.get("/teams", (req: Request, res: Response) => {
  try {
    res.json(db.teams.slice().sort((a, b) => b.elo_rating - a.elo_rating));
  } catch (err) {
    res.status(500).json({ error: "Failed to load team rankings" });
  }
});

// ── PATCH /admin/teams/:id ───────────────────────────────────────────────────
adminRouter.patch("/teams/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const team = db.teams.find((t) => t.id === id);

    if (!team) return res.status(404).json({ error: "Team not found" });

    const { elo_rating } = req.body;
    if (elo_rating !== undefined) {
      team.elo_rating = parseFloat(elo_rating);
      db.save();
    }

    res.json({ message: "Team information successfully adjusted!", team });
  } catch (err) {
    res.status(500).json({ error: "Failed to adjust team ranking parameters" });
  }
});

// ── GET /admin/health ────────────────────────────────────────────────────────
adminRouter.get("/health", (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status: "healthy",
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      rss_mb: (mem.rss / 1024 / 1024).toFixed(1),
      heap_mb: (mem.heapUsed / 1024 / 1024).toFixed(1),
      heap_max_mb: (mem.heapTotal / 1024 / 1024).toFixed(1),
    },
    node_version: process.version,
    env: process.env.NODE_ENV || "development",
  });
});

// ── GET /admin/security-audit ───────────────────────────────────────────────
adminRouter.get("/security-audit", (req: Request, res: Response) => {
  try {
    const rawSecret = process.env.JWT_SECRET || process.env.SECRET_KEY || "";
    const isFallback = !process.env.JWT_SECRET && !process.env.SECRET_KEY;
    const isWeak = rawSecret.length < 32;

    let jwt_secret_status = "secure";
    if (isFallback || rawSecret === "fallback_kickiq_system_32_characters_secret") {
      jwt_secret_status = "default_fallback";
    } else if (isWeak) {
      jwt_secret_status = "weak";
    }

    const is_gemini_api_key_configured = !!process.env.GEMINI_API_KEY;
    const is_custom_jwt_secret_configured = !isFallback && rawSecret !== "fallback_kickiq_system_32_characters_secret";
    const admin_email_lock_configured = true; // Hardcoded to kaisoisaac@gmail.com

    // Scan failed logins record for locked users
    const active_lockouts: { email: string; locked_at: string; seconds_remaining: number }[] = [];
    const nowMs = Date.now();
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    Object.entries(db.failed_logins).forEach(([email, data]) => {
      if (data.locked_at) {
        const lockedTimeVal = new Date(data.locked_at).getTime();
        const durationPassed = nowMs - lockedTimeVal;
        if (durationPassed < ONE_WEEK_MS) {
          active_lockouts.push({
            email,
            locked_at: data.locked_at,
            seconds_remaining: Math.ceil((ONE_WEEK_MS - durationPassed) / 1000)
          });
        }
      }
    });

    // Calculate vulnerability counts
    let critical = 0;
    let warning = 0;

    if (jwt_secret_status === "default_fallback") {
      critical++;
    } else if (jwt_secret_status === "weak") {
      warning++;
    }

    if (!is_gemini_api_key_configured) {
      warning++; // Missing AI secret keys
    }

    res.json({
      jwt_secret_status,
      jwt_secret_length: rawSecret.length,
      is_gemini_api_key_configured,
      is_custom_jwt_secret_configured,
      admin_email_lock_configured,
      active_lockouts,
      vulnerabilities_count: critical + warning,
      critical_vulnerabilities: critical,
      warning_vulnerabilities: warning,
      last_audit_time: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(550).json({ error: "Failed to perform diagnostic security health analysis" });
  }
});

// ── POST /admin/train-ai ────────────────────────────────────────────────────
adminRouter.post("/train-ai", adminMiddleware, (req: Request, res: Response) => {
  try {
    const finishedMatches = db.matches.filter(m => m.status === "finished");
    let ratingsAdjustmentsCount = 0;
    let totalPredictionsCount = 0;
    let alignmentRatioSum = 0;
    let processedMatchesCount = 0;

    const learningRate = db.settings?.ai_learning_rate || 0.15;

    finishedMatches.forEach(m => {
      const vH = m.votes_home || 0;
      const vD = m.votes_draw || 0;
      const vA = m.votes_away || 0;
      const totalMatchVotes = vH + vD + vA;

      if (totalMatchVotes === 0) return;

      // Filter extreme biased attempts to contaminate AI Continuous Learning ELO bounds
      const maxShare = Math.max(vH, vD, vA) / totalMatchVotes;
      if (maxShare > 0.88 && totalMatchVotes >= 5) {
        return; // Skip skewed match prediction profile
      }

      totalPredictionsCount += totalMatchVotes;
      processedMatchesCount++;

      // Determine actual outcome
      let outcome: "home" | "draw" | "away" = "draw";
      if (m.home_score > m.away_score) outcome = "home";
      else if (m.away_score > m.home_score) outcome = "away";

      // Calculate accuracy ratio
      let alignmentFactor = 0.33;
      if (outcome === "home") alignmentFactor = vH / totalMatchVotes;
      else if (outcome === "away") alignmentFactor = vA / totalMatchVotes;
      else alignmentFactor = vD / totalMatchVotes;

      alignmentRatioSum += alignmentFactor;

      const homeTeam = db.teams.find(t => t.id === m.home_team_id);
      const awayTeam = db.teams.find(t => t.id === m.away_team_id);

      if (homeTeam && awayTeam) {
        // Adjust squad ratings to feed the continuous mathematical loop
        const adjustmentDelta = Math.round(30 * learningRate * (alignmentFactor - 0.33));
        if (adjustmentDelta !== 0) {
          if (outcome === "home") {
            homeTeam.elo_rating += adjustmentDelta;
            awayTeam.elo_rating -= Math.round(adjustmentDelta / 2);
          } else if (outcome === "away") {
            awayTeam.elo_rating += adjustmentDelta;
            homeTeam.elo_rating -= Math.round(adjustmentDelta / 2);
          } else {
            // Draw alignment
            homeTeam.elo_rating += Math.round(adjustmentDelta / 3);
            awayTeam.elo_rating += Math.round(adjustmentDelta / 3);
          }
          ratingsAdjustmentsCount++;
        }
      }
    });

    db.save();

    res.json({
      message: "AI Knowledge Training completed successfully!",
      metrics: {
        processed_matches: processedMatchesCount,
        total_predictions_analyzed: totalPredictionsCount,
        average_user_alignment: processedMatchesCount > 0 ? (alignmentRatioSum / processedMatchesCount) : 0,
        ratings_adjustments_applied: ratingsAdjustmentsCount,
        current_global_learning_rate: learningRate
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process AI model training sequence." });
  }
});

// ── GET /admin/predictions-data ──────────────────────────────────────────────
adminRouter.get("/predictions-data", (req: Request, res: Response) => {
  try {
    // Speed map team entries
    const teamsMap: Record<number, string> = {};
    db.teams.forEach(t => {
      teamsMap[t.id] = t.name;
    });

    const usersMap: Record<string, { email: string; name: string; plan: string }> = {};
    db.users.forEach(u => {
      usersMap[u.id.toString()] = {
        email: u.email || "anonymous@kickiq.ai",
        name: u.display_name,
        plan: u.plan
      };
    });

    const matchPredictions: any[] = [];
    const teamVotesTracker: Record<string, number> = {};
    let totalVotesCountGlobal = 0;
    let correctHalftimes = 0;
    let pendingHalftimes = 0;
    let incorrectHalftimes = 0;

    db.matches.forEach(m => {
      const homeName = teamsMap[m.home_team_id] || `Team #${m.home_team_id}`;
      const awayName = teamsMap[m.away_team_id] || `Team #${m.away_team_id}`;
      const vH = m.votes_home || 0;
      const vD = m.votes_draw || 0;
      const vA = m.votes_away || 0;
      const totalMatchVotes = vH + vD + vA;

      totalVotesCountGlobal += totalMatchVotes;

      // Accumulate team metrics
      teamVotesTracker[homeName] = (teamVotesTracker[homeName] || 0) + vH;
      teamVotesTracker[awayName] = (teamVotesTracker[awayName] || 0) + vA;

      let topOutcome = "Split opinion";
      if (totalMatchVotes > 0) {
        if (vH > vD && vH > vA) topOutcome = `${homeName} Wins`;
        else if (vA > vH && vA > vD) topOutcome = `${awayName} Wins`;
        else if (vD > vH && vD > vA) topOutcome = "Draw Agreed";
      }

      // Halftime metrics
      if (m.halftime_prediction_status === "correct") correctHalftimes++;
      else if (m.halftime_prediction_status === "incorrect") incorrectHalftimes++;
      else if (m.halftime_prediction) pendingHalftimes++;

      matchPredictions.push({
        id: m.id,
        home_team: homeName,
        away_team: awayName,
        status: m.status,
        stage: m.stage,
        votes_home: vH,
        votes_draw: vD,
        votes_away: vA,
        total_votes: totalMatchVotes,
        predicted_outcome: topOutcome,
        halftime_choice: m.halftime_prediction || "None Cast",
        halftime_status: m.halftime_prediction_status || "None"
      });
    });

    // Flatten user cast history
    const userVotesDetail: any[] = [];
    db.matches.forEach(m => {
      if (m.voted_users) {
        const homeName = teamsMap[m.home_team_id] || `Team #${m.home_team_id}`;
        const awayName = teamsMap[m.away_team_id] || `Team #${m.away_team_id}`;
        const matchTitle = `${homeName} v ${awayName}`;

        Object.entries(m.voted_users).forEach(([uid, voteChoice]) => {
          const uInfo = usersMap[uid];
          if (uInfo) {
            userVotesDetail.push({
              user_email: uInfo.email,
              user_name: uInfo.name,
              user_plan: uInfo.plan,
              match_title: matchTitle,
              match_id: m.id,
              vote: voteChoice === "home" ? homeName : voteChoice === "away" ? awayName : "Draw agreed"
            });
          }
        });
      }
    });

    // Identify absolute most backed team
    let backedTeam = "No active votes";
    let maxBackedCount = 0;
    Object.entries(teamVotesTracker).forEach(([team, count]) => {
      if (count > maxBackedCount) {
        maxBackedCount = count;
        backedTeam = team;
      }
    });

    res.json({
      matchPredictions,
      userVotesDetail: userVotesDetail.reverse().slice(0, 50), // Send last 50 individual votes
      summary_metrics: {
        total_predictions_cast: totalVotesCountGlobal,
        most_backed_team: backedTeam,
        most_backed_votes: maxBackedCount,
        halftime_correct: correctHalftimes,
        halftime_incorrect: incorrectHalftimes,
        halftime_pending: pendingHalftimes,
        system_load: os.loadavg ? os.loadavg() : [0.1, 0.2, 0.1],
        active_prediction_matches: db.matches.filter(m => m.status === "live" || m.status === "scheduled").length,
        arrays_sizing: {
          users_count: db.users.length,
          matches_count: db.matches.length,
          events_count: db.match_events.length,
          logs_count: db.api_logs.length
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to build harmonised predictions metrics tabulation." });
  }
});

// ── POST /admin/release-lockout ──────────────────────────────────────────────
adminRouter.post("/release-lockout", (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({ error: "Email parameter link required to lift suspension." });
    }
    const emailLower = email.toLowerCase().trim();
    if (db.failed_logins[emailLower]) {
      delete db.failed_logins[emailLower];
      db.save();
    }
    res.json({ success: true, message: `Suspension successfully lifted for user ${emailLower}. Account re-activated.` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to lift user suspension on server." });
  }
});

// ── GET /admin/whitelist ─────────────────────────────────────────────────────
adminRouter.get("/whitelist", (req: Request, res: Response) => {
  res.json(db.whitelisted_free_emails || []);
});

// ── POST /admin/whitelist ────────────────────────────────────────────────────
adminRouter.post("/whitelist", (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(422).json({ error: "A valid email address is required" });
    }
    const normEmail = email.toLowerCase().trim();
    if (!db.whitelisted_free_emails.includes(normEmail)) {
      db.whitelisted_free_emails.push(normEmail);
    }
    
    // Auto upgrade if user is registered
    const existingUser = db.users.find((u) => u.email?.toLowerCase() === normEmail);
    if (existingUser) {
      existingUser.plan = "elite";
    }
    db.save();
    res.json({ message: `Successfully whitelisted ${normEmail} for free elite access!`, whitelist: db.whitelisted_free_emails });
  } catch (err) {
    res.status(500).json({ error: "Failed to whitelist email parameter link" });
  }
});

// ── DELETE /admin/whitelist ──────────────────────────────────────────────────
adminRouter.delete("/whitelist", (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({ error: "Email is required to remove whitelist parameter." });
    }
    const normEmail = email.toLowerCase().trim();
    const idx = db.whitelisted_free_emails.indexOf(normEmail);
    if (idx > -1) {
      db.whitelisted_free_emails.splice(idx, 1);
    }
    
    // Set matching users back to free trial status
    const existingUser = db.users.find((u) => u.email?.toLowerCase() === normEmail);
    if (existingUser && existingUser.role !== "admin") {
      existingUser.plan = "free";
    }
    db.save();
    res.json({ message: `Removed ${normEmail} from free premium whitelist.`, whitelist: db.whitelisted_free_emails });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear whitelisted email parameter link" });
  }
});

// ── GET /admin/settings ──────────────────────────────────────────────────────
adminRouter.get("/settings", (req: Request, res: Response) => {
  try {
    return res.json(db.settings);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to load administrative application settings" });
  }
});

// ── PATCH /admin/settings ────────────────────────────────────────────────────
adminRouter.patch("/settings", (req: Request, res: Response) => {
  try {
    const { admin_email, game_speed_multiplier, allow_registrations, maintenance_mode, ai_continuous_learning, ai_learning_rate } = req.body;
    
    if (admin_email !== undefined) {
      if (admin_email.toLowerCase().trim() !== "kaisoisaac@gmail.com") {
        return res.status(403).json({ error: "Access Denied: The primary root administrator email is permanently locked for system security." });
      }
      if (!admin_email.includes("@")) {
        return res.status(422).json({ error: "Provide a valid email format for the new Administrator." });
      }
    }

    const payload: any = {};
    if (admin_email !== undefined) payload.admin_email = admin_email.toLowerCase().trim();
    if (game_speed_multiplier !== undefined) payload.game_speed_multiplier = parseFloat(game_speed_multiplier) || 1.0;
    if (allow_registrations !== undefined) payload.allow_registrations = !!allow_registrations;
    if (maintenance_mode !== undefined) payload.maintenance_mode = !!maintenance_mode;
    if (ai_continuous_learning !== undefined) payload.ai_continuous_learning = !!ai_continuous_learning;
    if (ai_learning_rate !== undefined) payload.ai_learning_rate = parseFloat(ai_learning_rate) !== undefined ? parseFloat(ai_learning_rate) : 0.15;

    db.updateSettings(payload);

    return res.json({
      message: "Administrative settings updated successfully.",
      settings: db.settings
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update administrative application settings payload." });
  }
});
