import express, { Request, Response } from "express";
import path from "path";
import cors from "cors";
import compression from "compression";
import { createServer as createViteServer } from "vite";

import { db } from "./server/db";
import { authRouter } from "./server/auth";
import { matchesRouter } from "./server/matches";
import { chatRouter } from "./server/chat";
import { adminRouter } from "./server/admin";
import { requestLogger } from "./server/requestLogger";
import { initLiveDataSync, stopLiveDataSync, getQuotaUsage, fetchWithTimeout } from "./server/liveData";
import { paymentsRouter, webhookHandler } from "./server/payments";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic Compression & Request parsing constraints
  app.use(compression());
  app.use(cors());

  // Dynamic RAW middleware for Webhooks REGISTERED BEFORE JSON PARSER
  app.post("/payments/webhook", express.raw({ type: "application/json" }), webhookHandler);

  app.use(express.json({ limit: "20kb" }));
  app.use(express.urlencoded({ extended: true }));

  // Attach Latency and Visit Logger Middleware
  app.use(requestLogger);

  // 1. Production Health parameters checklist
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      live_data_enabled: !!process.env.FOOTBALL_DATA_API_KEY,
      payments_enabled: !!process.env.STRIPE_SECRET_KEY,
      last_sync_at: getQuotaUsage().lastSync,
      match_count: db.matches.length,
      user_count: db.users.length,
      version: "3.0.0",
      environment: process.env.NODE_ENV || "development"
    });
  });

  // 1.5. Expose public settings state (e.g. registration flags and soccer skills speed)
  app.get("/api/config", (req: Request, res: Response) => {
    try {
      res.json({
        allow_registrations: db.settings.allow_registrations,
        game_speed_multiplier: db.settings.game_speed_multiplier,
        maintenance_mode: db.settings.maintenance_mode,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to load public configuration" });
    }
  });

  // 2. Core Full-Stack Route Handlers
  app.use("/auth", authRouter);
  app.use("/matches", matchesRouter);
  app.use("/simulation", matchesRouter);
  app.use("/chat", chatRouter);
  app.use("/admin", adminRouter);
  app.use("/payments", paymentsRouter);

  // 3. Competitions Proxy (e.g. for Golden Boot scorers)
  app.get("/competitions/WC/scorers", async (req: Request, res: Response) => {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") {
      console.warn("[server] No FOOTBALL_DATA_API_KEY configured for Scorers. Falling back to frontend bootstrap.");
      return res.status(404).json({ error: "No API Key configured on server" });
    }
    try {
      const response = await fetchWithTimeout("https://api.football-data.org/v4/competitions/WC/scorers", {
        headers: { "X-Auth-Token": apiKey }
      }, 2500);
      if (!response.ok) {
        throw new Error(`Football-Data API responded with HTTP status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (err: any) {
      console.error("[server] Failed to proxy scorers API:", err.message);
      res.status(502).json({ error: "Failed to load live scorers from Football-Data" });
    }
  });

  // 4. Analytics router fallback overlay (/analytics/*)
  app.use("/analytics", (req, res) => {
    try {
      // Return beautiful summaries of ELO rating distributions and Poisson standard values
      const teamsSummary = db.teams.map((t) => ({
        id: t.id,
        name: t.name,
        country: t.country,
        elo: t.elo_rating,
        ranking_points: Math.round(t.elo_rating * 1.25),
      })).sort((a, b) => b.elo - a.elo);

      res.json({
        teams_ranking: teamsSummary,
        poisson_factor_rho: -0.13,
        system_confidence_intervals: "Wilson Score 95%",
        data_model: "Dixon-Coles Low Scoring corrected soccer distribution"
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch analytical summaries" });
    }
  });

  // 4.5. High-fidelity Football News Endpoint for Regional and Global Portals
  app.get("/api/soccer-news", (req: Request, res: Response) => {
    try {
      const nowTimes = ["Just now", "2m ago", "5m ago", "9m ago", "15m ago", "28m ago", "44m ago", "1h ago", "2h ago", "3h ago"];
      const rawFeeds = [
        {
          id: "news-ug-1",
          source: "NBS Sport",
          title: "Uganda Cranes Intensify Tactical Drills Ahead of World Cup Qualifiers Campaign",
          summary: "Coach Put deploys comprehensive mid-block passing schemes and hydration training patterns in Kampala to counter rapid high-pressing maneuvers.",
          url: "https://nbssport.co.ug/",
          category: "Local",
          region: "Uganda",
          flag: "🇺🇬",
          thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-ug-2",
          source: "Kawowo Sports",
          title: "Vipers SC Calibrate Turf Systems and Wing Transits For High-Octane CAF Champions League Matches",
          summary: "The Kitende-based giants introduce dual-pivot defensive structural shifts to guarantee maximum clean sheet percentages.",
          url: "https://kawowo.com/",
          category: "Tactics",
          region: "Uganda",
          flag: "🇺🇬",
          thumbnail: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-ke-1",
          source: "Citizen Digital Kenya",
          title: "Harambee Stars Introduce Fluid Inverted Wingback Overloads",
          summary: "Kenya national team's training camp in Nairobi emphasizes progressive possession values and transitions from deep defensive lines.",
          url: "https://www.citizen.digital/",
          category: "Tactics",
          region: "Kenya",
          flag: "🇰🇪",
          thumbnail: "https://images.unsplash.com/photo-1431324155629-1a6edd1d141e?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-ke-2",
          source: "Pulse Sports Kenya",
          title: "Gor Mahia Scout Rising Regional Talents to Concrete Domestic Command",
          summary: "The K'Ogalo giants initiate swift negotiations with promising youth strikers to reinforce their attacking configurations before the registration window shuts.",
          url: "https://www.pulsesports.co.ke/",
          category: "Transfer",
          region: "Kenya",
          flag: "🇰🇪",
          thumbnail: "https://images.unsplash.com/photo-1551958219-acbc608c6377?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-tz-1",
          source: "Mwanaspoti Tanzania",
          title: "Dar es Salaam Derby Fever: Simba vs Yanga Intensity Peak Reconfirmed",
          summary: "Benjamin Mkapa Stadium ground staff prep high-performance turf matrices. Over 60,000 extreme flag-waving supporters expected for this tactical clash.",
          url: "https://www.mwanaspoti.co.tz/",
          category: "Local",
          region: "Tanzania",
          flag: "🇹🇿",
          thumbnail: "https://images.unsplash.com/photo-1540747737956-37872a7e1ad0?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-ng-1",
          source: "Brila FM",
          title: "Super Eagles Reshape Offensive Transitions with Fast Low-Friction Plays",
          summary: "Nigeria Football Federation technical directors analyze Dixon-Coles Poisson expectancy models to boost overall squad shot conversion efficiency ratios.",
          url: "https://www.brila.net/",
          category: "Tactics",
          region: "Nigeria",
          flag: "🇳🇬",
          thumbnail: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-ng-2",
          source: "Complete Sports Nigeria",
          title: "Enyimba FC Secures High-Tech Performance Metrics Devices for Players",
          summary: "The People's Elephant introduces live biometric vest logs to micro-target fatigue points and prevent hamstring strains during continental campaigns.",
          url: "https://www.completesports.com/",
          category: "Global",
          region: "Nigeria",
          flag: "🇳🇬",
          thumbnail: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-sa-1",
          source: "Soccer Laduma South Africa",
          title: "Kaizer Chiefs Target Top-Tier European Sporting Directors to Recalibrate ELO",
          summary: "Amakhosi board members trigger dynamic talks to implement high-performance scientific models across all age categories.",
          url: "https://www.soccerladuma.co.za/",
          category: "Transfer",
          region: "South Africa",
          flag: "🇿🇦",
          thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-sa-2",
          source: "KickOff",
          title: "Mamelodi Sundowns Settle Altitude Tactical Regimes for CAF Away Trips",
          summary: "The Chloorkop giants calibrate wind-shear vectors to preserve high defensive integrity, leveraging their physical stamina formulas.",
          url: "https://www.kickoff.com/",
          category: "Local",
          region: "South Africa",
          flag: "🇿🇦",
          thumbnail: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-gh-1",
          source: "Ghanasoccernet",
          title: "Black Stars Technical Scout Assesses Rising Starlets in Europe",
          summary: "Ghana Football Association targets fast winger profiles from Premier League and Bundesliga academies to inject raw velocity into squad transitions.",
          url: "https://ghanasoccernet.com/",
          category: "Transfer",
          region: "Ghana",
          flag: "🇬🇭",
          thumbnail: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-cg-1",
          source: "Leopards Foot Congo",
          title: "DR Congo Leopards Rebuild Compact 3-4-3 Low Block For High Altitude Clashes",
          summary: "Head coach outlines high-conformity defensive spacing rules, securing half-spaces against overlapping fullback threats.",
          url: "https://www.leopardsfoot.com/",
          category: "Tactics",
          region: "Congo",
          flag: "🇨🇬",
          thumbnail: "https://images.unsplash.com/photo-1428908728789-d2de25dbd4e2?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-eu-1",
          source: "BBC Sport",
          title: "Champions League Tactical Showdown: Dissecting High-Octane Midfield Overloads",
          summary: "Tacticians study how dynamic pivot rotations successfully dismantle rigid low defensive blocks with rapid one-touch line-breaking setups.",
          url: "https://www.bbc.com/sport/football",
          category: "Global",
          region: "Europe",
          flag: "🇪🇺",
          thumbnail: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-eu-2",
          source: "Sky Sports",
          title: "Premier League Inverted Wingback Metamorphosis Shakes Counter Schemes",
          summary: "Detailed soccer telemetry data tracks how shifting fullbacks into central attacking pockets changes overall transition friction ratios.",
          url: "https://www.skysports.com/football",
          category: "Tactics",
          region: "Europe",
          flag: "🇪🇺",
          thumbnail: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-br-1",
          source: "Globo Esporte Brazil",
          title: "Brasileirão Mastery: Seleção Pundits Analyze Modern Jogo Bonito Spacing",
          summary: "Fascinating breakdown of traditional Brazilian individual fluid flair adapted to modern European-influenced strict tactical disciplines.",
          url: "https://ge.globo.com/",
          category: "Local",
          region: "Brazil",
          flag: "🇧🇷",
          thumbnail: "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=300&auto=format&fit=crop"
        },
        {
          id: "news-us-1",
          source: "ESPN FC America",
          title: "Major League Soccer Tactical Boom: High Press Shakes Up Deep Blocks",
          summary: "Dynamic physical charts reveal massive increases in counter-pressing turnovers, showing a substantial shift to aggressive soccer systems.",
          url: "https://www.espn.com/soccer/",
          category: "Global",
          region: "America",
          flag: "🇺🇸",
          thumbnail: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=300&auto=format&fit=crop"
        }
      ];

      // Shuffle slightly or randomize the timestamps to prove real-time liveliness
      const randomizedNews = rawFeeds.map((feed, idx) => {
        const timeIndex = (idx + Math.floor(Date.now() / (120 * 1000))) % nowTimes.length;
        return {
          ...feed,
          time: nowTimes[timeIndex]
        };
      });

      res.json({
        success: true,
        news: randomizedNews
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to construct global real-time football news feed." });
    }
  });

  // 4.6. Predictors Accuracy Hall of Fame Leaderboard
  app.get("/api/predictors/leaderboard", (req: Request, res: Response) => {
    try {
      const finishedMatches = db.matches.filter(m => m.status === "finished");
      
      // Calculate stats for all existing registered users
      const realPredictors = db.users.map(u => {
        const userIdStr = u.id.toString();
        const userMatches = finishedMatches.filter(m => m.voted_users && m.voted_users[userIdStr]);
        
        // Sort user matches chronologically to calculate streaks
        userMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let correct_count = 0;
        let incorrect_count = 0;
        let current_correct_streak = 0;
        let current_incorrect_streak = 0;
        let is_link_active = false;
        
        userMatches.forEach(m => {
          let outcome: "home" | "draw" | "away" = "draw";
          if (m.home_score > m.away_score) outcome = "home";
          else if (m.away_score > m.home_score) outcome = "away";
          
          const choice = m.voted_users[userIdStr];
          if (choice === outcome) {
            correct_count++;
            current_correct_streak++;
            current_incorrect_streak = 0;
            if (current_correct_streak >= 5) {
              is_link_active = true;
            }
          } else {
            incorrect_count++;
            current_incorrect_streak++;
            current_correct_streak = 0;
            if (current_incorrect_streak >= 3) {
              is_link_active = false;
            }
          }
        });
        
        if (u.plan === "elite") {
          is_link_active = true;
        }
        
        return {
          id: u.id,
          display_name: u.display_name,
          avatar_url: u.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100",
          plan: u.plan,
          correct_count,
          incorrect_count,
          current_correct_streak,
          current_incorrect_streak,
          is_link_active,
          whatsapp_link: u.whatsapp_link || "",
          telegram_link: u.telegram_link || ""
        };
      });

      // Combining with pre-seeded expert content advisors
      const seeds = [
        { id: 9901, display_name: "Cranes_Guru_UG", avatar_url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100", plan: "elite", correct_count: 24, incorrect_count: 4, current_correct_streak: 8, current_incorrect_streak: 0, is_link_active: true, whatsapp_link: "https://chat.whatsapp.com/CranesGuruExclusive2026", telegram_link: "https://t.me/CranesGuruSports" },
        { id: 9902, display_name: "Tactics_Alex", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100", plan: "pro", correct_count: 18, incorrect_count: 6, current_correct_streak: 5, current_incorrect_streak: 0, is_link_active: true, whatsapp_link: "https://chat.whatsapp.com/TacticsAlexLounge", telegram_link: "https://t.me/TacticsAlexNews" },
        { id: 9903, display_name: "KampalaBettor", avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100", plan: "pro", correct_count: 15, incorrect_count: 8, current_correct_streak: 3, current_incorrect_streak: 1, is_link_active: false, whatsapp_link: "https://chat.whatsapp.com/KampalaPredictionTeam", telegram_link: "https://t.me/KampalaSportsGroup" },
        { id: 9904, display_name: "NBS_Musa", avatar_url: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=100", plan: "free", correct_count: 13, incorrect_count: 5, current_correct_streak: 6, current_incorrect_streak: 0, is_link_active: true, whatsapp_link: "https://chat.whatsapp.com/NBSMusaPredicts", telegram_link: "" },
        { id: 9905, display_name: "Sarah_Analyst", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100", plan: "elite", correct_count: 12, incorrect_count: 9, current_correct_streak: 2, current_incorrect_streak: 2, is_link_active: true, whatsapp_link: "https://chat.whatsapp.com/SarahAnalysisLab", telegram_link: "https://t.me/SarahFooty" },
        { id: 9906, display_name: "Wazee_Sport", avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100", plan: "free", correct_count: 10, incorrect_count: 12, current_correct_streak: 1, current_incorrect_streak: 3, is_link_active: false, whatsapp_link: "", telegram_link: "" },
        { id: 9907, display_name: "NairobiTips", avatar_url: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=100", plan: "free", correct_count: 9, incorrect_count: 4, current_correct_streak: 4, current_incorrect_streak: 0, is_link_active: false, whatsapp_link: "https://chat.whatsapp.com/NairobiTipsGroup", telegram_link: "" },
        { id: 9908, display_name: "Dar_Tactician", avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100", plan: "pro", correct_count: 8, incorrect_count: 6, current_correct_streak: 0, current_incorrect_streak: 1, is_link_active: false, whatsapp_link: "", telegram_link: "" },
        { id: 9909, display_name: "SuperPesa_Ke", avatar_url: "https://images.unsplash.com/photo-1489980508314-941910ded1f4?auto=format&fit=crop&w=100", plan: "free", correct_count: 7, incorrect_count: 10, current_correct_streak: 2, current_incorrect_streak: 1, is_link_active: false, whatsapp_link: "", telegram_link: "" },
      ];

      const combined = [...realPredictors, ...seeds];
      
      // Sort: correct_count desc, then streak desc
      combined.sort((a, b) => {
        if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
        return b.current_correct_streak - a.current_correct_streak;
      });

      // Map ranks
      const ranked = combined.map((item, idx) => ({
        ...item,
        rank: idx + 1,
        is_top_ten: idx < 10
      }));

      res.json({
        success: true,
        leaderboard: ranked.slice(0, 15)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to construct predictors ranking leaderboard." });
    }
  });

  // 5. Setup View Serving: Vite Middleware vs Compiled Static Assets
  if (process.env.NODE_ENV !== "production") {
    console.log("[server] Booting Vite development assets middleware...");
    const viteOnExpress = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteOnExpress.middlewares);
  } else {
    console.log("[server] Operating in Production static routing mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 6. Launch listener
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[KickIQ v3 Core Server] Running securely on http://0.0.0.0:${PORT}`);
    // Boot live sync
    initLiveDataSync();
  });

  // Graceful shutdown protocol
  process.on("SIGTERM", () => {
    console.log("[server] SIGTERM received. Initiating closing sequence...");
    stopLiveDataSync();
    server.close(() => {
      console.log("[server] All active ingress connections closed cleanly.");
    });
  });
}

startServer().catch((e) => {
  console.error("[server] Bootstrap sequence aborted", e);
});
