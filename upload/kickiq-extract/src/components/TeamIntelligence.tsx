import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Award, HelpCircle, X, Sparkles, AlertCircle, TrendingUp } from "lucide-react";
import { Match } from "../types";

interface TeamIntelligenceProps {
  teamName: string;
  matches: Match[];
  onClose: () => void;
  onAskAi: (prompt: string) => void;
}

interface TeamStanding {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  crest: string;
  elo: number;
}

export default function TeamIntelligence({ teamName, matches, onClose, onAskAi }: TeamIntelligenceProps) {
  // All 8 core teams seeded in World Cup
  const SEEDED_TEAMS = [
    { name: "Brazil", elo: 1850, crest: "https://crests.football-data.org/BRA.png" },
    { name: "Argentina", elo: 1820, crest: "https://crests.football-data.org/ARG.png" },
    { name: "France", elo: 1800, crest: "https://crests.football-data.org/FRA.png" },
    { name: "Germany", elo: 1780, crest: "https://crests.football-data.org/GER.png" },
    { name: "Spain", elo: 1770, crest: "https://crests.football-data.org/ESP.png" },
    { name: "England", elo: 1750, crest: "https://crests.football-data.org/ENG.png" },
    { name: "Portugal", elo: 1720, crest: "https://crests.football-data.org/POR.png" },
    { name: "Netherlands", elo: 1700, crest: "https://crests.football-data.org/NED.png" },
  ];

  // Determine active team info
  const teamInfo = SEEDED_TEAMS.find((t) => t.name.toLowerCase() === teamName.toLowerCase()) || {
    name: teamName,
    elo: 1600,
    crest: `https://crests.football-data.org/${teamName.substring(0, 3).toUpperCase()}.png`
  };

  // ELO Rankings relative positioning
  const sortedEloList = [...SEEDED_TEAMS].sort((a, b) => b.elo - a.elo);
  const eloRank = sortedEloList.findIndex((t) => t.name.toLowerCase() === teamInfo.name.toLowerCase()) + 1;

  // Calculate Standings dynamically from actual match history
  const calculateStandings = (): TeamStanding[] => {
    const table: Record<string, TeamStanding> = {};

    // Initializing
    SEEDED_TEAMS.forEach((team) => {
      table[team.name] = {
        name: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
        crest: team.crest,
        elo: team.elo
      };
    });

    // Populate calculations
    matches.forEach((m) => {
      // Only process group stage or finished matches for general standing table
      if (m.stage.toLowerCase().includes("group") && m.status === "finished") {
        const home = table[m.home_team];
        const away = table[m.away_team];

        if (home && away) {
          home.played += 1;
          away.played += 1;
          home.gf += m.home_score;
          home.ga += m.away_score;
          away.gf += m.away_score;
          away.ga += m.home_score;

          if (m.home_score > m.away_score) {
            home.won += 1;
            home.points += 3;
            away.lost += 1;
          } else if (m.home_score < m.away_score) {
            away.won += 1;
            away.points += 3;
            home.lost += 1;
          } else {
            home.drawn += 1;
            home.points += 1;
            away.drawn += 1;
            away.points += 1;
          }

          home.gd = home.gf - home.ga;
          away.gd = away.gf - away.ga;
        }
      }
    });

    // Sort by points desc, gd desc, gf desc, ELO desc
    return Object.values(table).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return b.elo - a.elo;
    });
  };

  const standings = calculateStandings();
  const standingsRank = standings.findIndex((t) => t.name.toLowerCase() === teamInfo.name.toLowerCase()) + 1;

  // ELO Progress Radial calculation
  // Base scale: min 1400 ELO to max 2000 ELO is [0, 100]%
  const minElo = 1400;
  const maxElo = 2000;
  const eloPercent = Math.min(100, Math.max(0, ((teamInfo.elo - minElo) / (maxElo - minElo)) * 100));

  // Radial track calculations
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (eloPercent / 100) * circumference;

  const handleAskIntelligence = () => {
    const prompt = `Provide a premium intelligence breakdown for the Ugandan KickIQ broadcast of ${teamInfo.name}. Discuss their squad tactical play, crucial transitions, high-pressing vulnerabilities, and how their ${teamInfo.elo} ELO relates to their World Cup performance. Keep the answer structured and analytical.`;
    onAskAi(prompt);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-[#131929] border border-[#1e2d45] rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)]"
        >
          {/* Top colored background decoration banner */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#00e676] via-[#ffd700] to-sky-500" />

          {/* CLOSE BOX */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-850 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 space-y-6">
            
            {/* BRAND PROFILE TOP HEADER */}
            <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left border-b border-slate-800/60 pb-5">
              <img
                src={teamInfo.crest}
                alt=""
                className="w-16 h-16 object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${teamInfo.name.substring(0, 3).toUpperCase()}.png`;
                }}
              />
              
              <div className="flex-1 min-w-0">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono font-bold uppercase tracking-widest leading-none">
                  Team Intelligence Portal
                </span>
                <h3 className="text-2xl font-black text-white uppercase tracking-wider font-mono mt-1">
                  {teamInfo.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center justify-center md:justify-start gap-1">
                  <span className="text-white">Active Seed Profile</span> | ELO Rank #{eloRank} in Tournament
                </p>
              </div>

              {/* RADIAL ELO GAUGE (Feature 7 relative strength circular visual) */}
              <div className="relative flex items-center justify-center shrink-0 w-28 h-28">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Track */}
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    stroke="#1e2d45"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  {/* Progress Indicator */}
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    stroke="#00e676"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Gauge Core Content */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest leading-none">
                    ELO
                  </span>
                  <span className="text-lg font-mono font-extrabold text-white leading-none mt-1">
                    {teamInfo.elo}
                  </span>
                  <span className="text-[8px] font-mono text-emerald-400 uppercase font-black tracking-tighter mt-0.5">
                    {Math.round(eloPercent)}% RATIO
                  </span>
                </div>
              </div>
            </div>

            {/* LOWER CONTENT: STANDING TABLE & QUICK INTEL ACTION */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* Standings list (Span 7) */}
              <div className="md:col-span-7 space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-widest">
                    Live Tournament Group Standings
                  </h4>
                  <span className="text-[9px] font-mono text-slate-400">
                    Calculated Live
                  </span>
                </div>

                <div className="bg-[#0a0e1a] border border-[#1e2d45] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-1 p-2 bg-slate-900 border-b border-[#1e2d45] text-[9px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                    <span className="col-span-1 text-center">#</span>
                    <span className="col-span-5">Team</span>
                    <span className="col-span-2 text-center">P</span>
                    <span className="col-span-2 text-center">GD</span>
                    <span className="col-span-2 text-center">Pts</span>
                  </div>

                  <div className="divide-y divide-slate-800/50 text-[11px] font-mono text-white">
                    {standings.map((team, index) => {
                      const isActive = team.name.toLowerCase() === teamInfo.name.toLowerCase();
                      return (
                        <div
                          key={team.name}
                          className={`grid grid-cols-12 gap-1 p-2 items-center ${
                            isActive ? "bg-emerald-500/10 font-bold" : ""
                          }`}
                        >
                          <span className={`col-span-1 text-center ${isActive ? "text-emerald-400 font-black" : "text-slate-500"}`}>
                            {index + 1}
                          </span>
                          <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                            <img
                              src={team.crest}
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${team.name.substring(0, 3).toUpperCase()}.png`;
                              }}
                            />
                            <span className="truncate">{team.name}</span>
                          </div>
                          <span className="col-span-2 text-center text-slate-400">{team.played}</span>
                          <span className={`col-span-2 text-center ${team.gd > 0 ? "text-emerald-400" : team.gd < 0 ? "text-red-500" : "text-slate-500"}`}>
                            {team.gd > 0 ? `+${team.gd}` : team.gd}
                          </span>
                          <span className="col-span-2 text-center font-extrabold text-white">{team.points}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick actions Panel (Span 5) */}
              <div className="md:col-span-5 p-4 rounded-2xl bg-[#0a0e1a]/80 border border-[#1e2d45] flex flex-col justify-between text-left">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#ffd700]" />
                    <span className="text-[10px] font-bold text-white uppercase font-mono tracking-widest">
                      AI Tactical Feed
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    Leverage our deep learning neural net to perform historical matchup synthesis, team sheet overloads, and predicted outcome percentages.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                  <button
                    onClick={handleAskIntelligence}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg hover:shadow-emerald-500/10"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Ask Assistant Intel
                  </button>
                  <p className="text-[8px] text-slate-500 text-center font-mono">
                    Auto-prompts your AI console instantly
                  </p>
                </div>
              </div>

            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
