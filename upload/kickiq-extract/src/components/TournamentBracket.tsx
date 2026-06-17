import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Trophy, Shield, Zap, RefreshCw } from "lucide-react";
import { Match } from "../types";

interface TournamentBracketProps {
  onSelectMatch?: (match: Match) => void;
  selectedMatchId?: number;
}

interface BracketSlot {
  id: string;
  stageName: string;
  matchId?: number;
  homePlaceholder: string;
  awayPlaceholder: string;
  match?: Match;
}

export default function TournamentBracket({ onSelectMatch, selectedMatchId }: TournamentBracketProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async () => {
    try {
      const res = await fetch("/matches");
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (err) {
      console.error("[TournamentBracket] error fetching matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter or match based stage helpers
  const getStageMatches = (stageKey: string): Match[] => {
    return matches.filter((m) => {
      const stage = m.stage.toLowerCase();
      if (stageKey === "r32") return stage.includes("round of 32") || stage.includes("r32");
      if (stageKey === "r16") return stage.includes("round of 16") || stage.includes("r16");
      if (stageKey === "qf") return stage.includes("quarter") || stage.includes("qf");
      if (stageKey === "sf") return stage.includes("semi") || stage.includes("sf");
      if (stageKey === "f") return stage === "final" || stage === "finals" || stage.includes("final");
      return false;
    });
  };

  // Build standard slot layouts for 4 rounds bracket
  const r32Matches = getStageMatches("r32");
  const r16Matches = getStageMatches("r16");
  const qfMatches = getStageMatches("qf");
  const sfMatches = getStageMatches("sf");
  const fMatches = getStageMatches("f");

  // Determine champion
  const finalMatch = fMatches[0];
  let championName = "";
  let championCrest = "";

  if (finalMatch && finalMatch.status === "finished") {
    if (finalMatch.home_score > finalMatch.away_score) {
      championName = finalMatch.home_team;
      championCrest = finalMatch.home_crest || "";
    } else {
      championName = finalMatch.away_team;
      championCrest = finalMatch.away_crest || "";
    }
  }

  // Draw connector SVG paths between matching elements
  const renderConnectorLine = (x1: number, y1: number, x2: number, y2: number, isLive = false) => {
    const midX = (x1 + x2) / 2;
    const path = `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${(y1 + y2) / 2} T ${x2} ${y2}`;
    
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ pointerEvents: "none" }}>
        <path
          d={path}
          fill="none"
          stroke={isLive ? "#ff3b3b" : "#1e2d45"}
          strokeWidth={isLive ? "2" : "1.5"}
          strokeDasharray={isLive ? "4,4" : ""}
          className={isLive ? "animate-[dash_1.5s_linear_infinite]" : ""}
        />
      </svg>
    );
  };

  const getTla = (teamName: string) => {
    if (!teamName) return "?";
    return teamName.substring(0, 3).toUpperCase();
  };

  const renderMatchNode = (match: Match | undefined, placeholderHome = "TBD", placeholderAway = "TBD", index = 0) => {
    const isLive = match?.status === "live";
    const isFinished = match?.status === "finished";
    const isSelected = match ? selectedMatchId === match.id : false;

    // Determine winner style
    const isHomeWinner = isFinished && match && match.home_score > match.away_score;
    const isAwayWinner = isFinished && match && match.away_score > match.home_score;

    return (
      <motion.div
        whileHover={{ y: -2, scale: 1.01 }}
        onClick={() => match && onSelectMatch?.(match)}
        className={`relative z-10 w-48 bg-[#131929] border rounded-xl p-2.5 cursor-pointer user-select-none transition-all ${
          isSelected
            ? "border-emerald-500 shadow-[0_0_10px_rgba(0,230,118,0.2)]"
            : isLive
            ? "border-red-500/60 shadow-[0_0_6px_rgba(255,59,59,0.15)] animate-pulse"
            : "border-[#1e2d45] hover:border-slate-600"
        }`}
      >
        {isLive && (
          <span className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-red-600 text-white text-[7px] font-extrabold uppercase tracking-widest rounded-full flex items-center gap-0.5 z-20">
            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
            Live
          </span>
        )}

        <div className="flex flex-col gap-1.5 text-xs text-left">
          {/* Home slot */}
          <div className={`flex items-center justify-between gap-2 ${isFinished && !isHomeWinner ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              {match?.home_crest ? (
                <img
                  src={match.home_crest}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(match?.home_team || "")}.png`;
                  }}
                />
              ) : (
                <Shield className="w-4 h-4 text-slate-600 shrink-0" />
              )}
              <span className={`truncate font-mono font-bold ${isHomeWinner ? "text-emerald-400" : "text-white"}`}>
                {match ? getTla(match.home_team) : placeholderHome}
              </span>
            </div>
            <span className="font-mono font-black text-white bg-black/30 px-1 py-0.5 rounded text-[11px]">
              {match ? match.home_score : "-"}
            </span>
          </div>

          {/* Away slot */}
          <div className={`flex items-center justify-between gap-2 ${isFinished && !isAwayWinner ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              {match?.away_crest ? (
                <img
                  src={match.away_crest}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(match?.away_team || "")}.png`;
                  }}
                />
              ) : (
                <Shield className="w-4 h-4 text-slate-600 shrink-0" />
              )}
              <span className={`truncate font-mono font-bold ${isAwayWinner ? "text-emerald-400" : "text-white"}`}>
                {match ? getTla(match.away_team) : placeholderAway}
              </span>
            </div>
            <span className="font-mono font-black text-white bg-black/30 px-1 py-0.5 rounded text-[11px]">
              {match ? match.away_score : "-"}
            </span>
          </div>
        </div>

        {/* Info footer */}
        {match && (
          <div className="flex items-center justify-between text-[7px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800/50">
            <span>{match.status === "live" ? `Min ${match.simulation_minute}'` : match.status === "finished" ? "FT" : "Scheduled"}</span>
            <span className="text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-0.5">
              <Zap className="w-2 h-2" /> Match IQ
            </span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div id="tournament-bracket-section" className="w-full bg-[#0a0e1a] border border-[#1e2d45] rounded-2xl p-6 relative overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-white tracking-widest uppercase font-mono flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Cup Knockout Bracket
          </h3>
          <p className="text-[10px] text-[#8892a4] font-mono uppercase tracking-wide">
            Real-time live tree progression from World Cup stages
          </p>
        </div>

        <button
          onClick={fetchMatches}
          className="p-1 px-2 text-[10px] font-mono bg-[#131929] border border-[#1e2d45] text-emerald-400 rounded-lg flex items-center gap-1 hover:bg-slate-800"
        >
          <RefreshCw className="w-3 h-3" /> Sync Bracket Table
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center text-xs font-mono text-slate-500 animate-pulse">
          Computing bracket topology map...
        </div>
      ) : (
        <div className="relative w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800 flex flex-col items-center">
          
          {/* CHAMPION CORONA AT THE APEX CENTER */}
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div
              animate={championName ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`p-4 rounded-full border bg-[#131929] flex flex-col items-center justify-center relative ${
                championName 
                  ? "border-amber-400 shadow-[0_0_20px_rgba(255,215,0,0.3)]" 
                  : "border-[#1e2d45]"
              }`}
            >
              <Trophy className={`w-10 h-10 ${championName ? "text-amber-400 animate-bounce" : "text-slate-600"}`} />
              {championName && (
                <div className="absolute -bottom-2 px-3 py-1 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-full shadow-md">
                  CHAMPION
                </div>
              )}
            </motion.div>
            
            <div className="mt-3">
              {championName ? (
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest font-mono">
                    {championName}
                  </h4>
                  <p className="text-[9px] text-[#8892a4] font-mono">WORLD CUP WINNER</p>
                </div>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono font-medium tracking-wide uppercase">
                  Awaiting Final Match Resolution
                </span>
              )}
            </div>
          </div>

          {/* LADDER OF COLUMNS */}
          <div className="flex items-center gap-12 w-max px-4 py-2 relative">
            
            {/* ROUND OF 16 Column */}
            <div className="flex flex-col gap-8 justify-around">
              <span className="text-[9px] font-mono font-bold text-[#8892a4] uppercase tracking-wider text-center">
                Round of 16
              </span>
              {[0, 1, 2, 3].map((idx) => (
                <div key={`r16-${idx}`}>
                  {renderMatchNode(
                    r16Matches[idx],
                    `Winner A${idx * 2 + 1}`,
                    `Runner B${idx * 2 + 1}`,
                    idx
                  )}
                </div>
              ))}
            </div>

            {/* QUARTER-FINALS Column */}
            <div className="flex flex-col gap-12 justify-around py-12">
              <span className="text-[9px] font-mono font-bold text-[#8892a4] uppercase tracking-wider text-center">
                Quarter-Finals
              </span>
              {[0, 1].map((idx) => (
                <div key={`qf-${idx}`}>
                  {renderMatchNode(
                    qfMatches[idx],
                    `W_R16 #${idx * 2 + 1}`,
                    `W_R16 #${idx * 2 + 2}`,
                    idx
                  )}
                </div>
              ))}
            </div>

            {/* SEMI-FINALS Column */}
            <div className="flex flex-col gap-16 justify-around py-24">
              <span className="text-[9px] font-mono font-bold text-[#8892a4] uppercase tracking-wider text-center">
                Semi-Finals
              </span>
              {[0].map((idx) => (
                <div key={`sf-${idx}`}>
                  {renderMatchNode(
                    sfMatches[idx],
                    "W_QF #1",
                    "W_QF #2",
                    idx
                  )}
                </div>
              ))}
            </div>

            {/* FINAL MATCH Column */}
            <div className="flex flex-col gap-24 justify-center py-32">
              <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider text-center flex items-center justify-center gap-1">
                ⭐ Final Match
              </span>
              {renderMatchNode(fMatches[0], "W_SF #1", "W_SF #2", 0)}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
