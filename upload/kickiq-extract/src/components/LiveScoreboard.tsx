import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, Play, Calendar, Zap, AlertCircle, RefreshCw } from "lucide-react";
import { Match } from "../types";

interface LiveScoreboardProps {
  onSelectMatch?: (match: Match) => void;
  selectedMatchId?: number;
  onSelectTeam?: (team: string) => void;
}

export default function LiveScoreboard({ onSelectMatch, selectedMatchId, onSelectTeam }: LiveScoreboardProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // For goal scoring flash indicator
  const [flashingMatches, setFlashingMatches] = useState<Record<string, "home" | "away" | "both">>({});
  const prevScoresRef = useRef<Record<number, { home: number; away: number }>>({});

  const fetchMatches = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/matches");
      if (!res.ok) throw new Error("Could not retrieve live score feed");
      const data: Match[] = await res.json();
      
      // Check for score changes to trigger neon goal flashes
      const newFlashing: Record<string, "home" | "away" | "both"> = {};
      
      data.forEach((match) => {
        const prev = prevScoresRef.current[match.id];
        if (prev) {
          const homeChanged = match.home_score > prev.home;
          const awayChanged = match.away_score > prev.away;
          
          if (homeChanged && awayChanged) {
            newFlashing[match.id] = "both";
          } else if (homeChanged) {
            newFlashing[match.id] = "home";
          } else if (awayChanged) {
            newFlashing[match.id] = "away";
          }
        }
        // Always store latest score in ref
        prevScoresRef.current[match.id] = {
          home: match.home_score,
          away: match.away_score
        };
      });

      // If any matches registered a goal flash, trigger state and clear after 800ms
      if (Object.keys(newFlashing).length > 0) {
        setFlashingMatches((prev) => ({ ...prev, ...newFlashing }));
        setTimeout(() => {
          setFlashingMatches((prev) => {
            const next = { ...prev };
            Object.keys(newFlashing).forEach((key) => {
              delete next[key];
            });
            return next;
          });
        }, 800);
      }

      setMatches(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Network issue connecting to server");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    fetchMatches();
    const interval = setInterval(() => {
      fetchMatches(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleForceRefresh = () => {
    setIsRefreshing(true);
    fetchMatches(false);
  };

  // Split into categories
  const liveMatches = matches.filter((m) => m.status === "live");
  
  // Under upcoming/scheduled, let's filter those that are "scheduled"
  const upcomingMatches = matches.filter((m) => m.status === "scheduled");
  
  // Under finished matches
  const finishedMatches = matches.filter((m) => m.status === "finished");

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("default", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch {
      return dateString;
    }
  };

  // Helper helper to format team name to 3 letter TLA on mobile
  const getTla = (teamName: string) => {
    if (!teamName) return "";
    return teamName.substring(0, 3).toUpperCase();
  };

  return (
    <div id="live-scoreboard-section" className="w-full flex flex-col gap-4 select-none">
      
      {/* DESKTOP TICKER ROW AT THE TOP */}
      <div className="hidden md:flex items-center gap-3 bg-[#0a0e1a]/80 backdrop-blur-md p-2 rounded-xl border border-[#1e2d45] overflow-x-auto select-none scrollbar-thin scrollbar-thumb-slate-800">
        <div className="flex items-center gap-1 bg-red-600/15 border border-red-500/30 text-[#ff3b3b] px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest animate-pulse shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b3b] inline-block animate-ping mr-1" />
          Live Ticker
        </div>

        <div className="flex items-center gap-4 flex-1">
          {liveMatches.length === 0 ? (
            <span className="text-xs text-[#8892a4] font-medium tracking-wide">
              No World Cup games active right now. Simulated fallback telemetry auto-triggers above.
            </span>
          ) : (
            <div className="flex items-center gap-3">
              {liveMatches.map((m) => {
                const isFlashingHome = flashingMatches[m.id] === "home" || flashingMatches[m.id] === "both";
                const isFlashingAway = flashingMatches[m.id] === "away" || flashingMatches[m.id] === "both";
                
                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectMatch?.(m)}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border bg-[#131929]/90 hover:border-emerald-500/40 cursor-pointer transition-all ${
                      selectedMatchId === m.id ? "border-emerald-500/50 shadow-[0_0_8px_rgba(0,230,118,0.15)]" : "border-[#1e2d45]"
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-red-500 animate-pulse shrink-0">
                      {m.simulation_minute}'
                    </span>
                    <span className="text-xs font-bold text-white uppercase">{getTla(m.home_team)}</span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-[#1e2d45]">
                      <span className={`text-xs font-mono font-extrabold px-1 transition-all rounded ${
                        isFlashingHome ? "bg-[#00e676] text-slate-950 font-black scale-110" : "text-white"
                      }`}>
                        {m.home_score}
                      </span>
                      <span className="text-[#8892a4] text-[10px]">:</span>
                      <span className={`text-xs font-mono font-extrabold px-1 transition-all rounded ${
                        isFlashingAway ? "bg-[#00e676] text-slate-950 font-black scale-110" : "text-white"
                      }`}>
                        {m.away_score}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-white uppercase">{getTla(m.away_team)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleForceRefresh}
          className="p-1 px-2.5 bg-[#131929] hover:bg-slate-800 border border-[#1e2d45] text-[#8892a4] hover:text-white rounded-lg transition-all text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          Force Sync
        </button>
      </div>

      {/* DETAILED SCOREBOARD & LIVE/UPCOMING CARD GRID */}
      {loading && matches.length === 0 ? (
        <div className="p-8 bg-[#131929] border border-[#1e2d45] rounded-2xl flex flex-col justify-center items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-[#8892a4] font-mono uppercase tracking-widest animate-pulse">
            Connecting telemetry livewire...
          </p>
        </div>
      ) : error && matches.length === 0 ? (
        <div className="p-6 bg-[#131929] border border-[#1e2d45] rounded-2xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-xs text-white uppercase tracking-wider font-mono">Telemetry link failed</p>
          <p className="text-[10px] text-[#8892a4]">{error}</p>
          <button
            onClick={() => fetchMatches()}
            className="px-3 py-1.5 bg-[#0a0e1a] border border-[#1e2d45] text-xs text-emerald-400 font-mono rounded-lg hover:bg-slate-800"
          >
            Reconnect Feed
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* LIVE FIXTURES SECTION (SPAN 5) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <h4 className="text-[10px] font-bold text-[#8892a4] uppercase font-mono tracking-widest flex items-center gap-1.5 text-left pl-1">
              <span className="w-2 h-2 rounded-full bg-[#ff3b3b] animate-ping" />
              In Play Live Stream
            </h4>

            {liveMatches.length === 0 ? (
              <div className="flex-1 bg-[#131929]/50 border border-[#1e2d45]/60 rounded-2xl p-6 flex flex-col justify-center items-center text-center gap-2">
                <Play className="w-6 h-6 text-slate-600" />
                <span className="text-[10px] text-[#8892a4] font-bold uppercase tracking-widest font-mono">
                  No Active Broadcasts
                </span>
                <p className="text-[9px] text-slate-500 max-w-[200px]">
                  All group stage matches registered as scheduled. Trigger or wait for simulation sync kickoff.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {liveMatches.map((m) => {
                  const isSelected = selectedMatchId === m.id;
                  const isFlashingHome = flashingMatches[m.id] === "home" || flashingMatches[m.id] === "both";
                  const isFlashingAway = flashingMatches[m.id] === "away" || flashingMatches[m.id] === "both";

                  return (
                    <motion.div
                      key={m.id}
                      onClick={() => onSelectMatch?.(m)}
                      layoutId={`match-card-${m.id}`}
                      className={`relative overflow-hidden bg-[#131929] border rounded-2xl p-4 transition-all duration-300 cursor-pointer select-none group focus:outline-none flex flex-col gap-3 ${
                        isSelected 
                          ? "border-emerald-500 shadow-[0_0_12px_rgba(0,230,118,0.18)]" 
                          : "border-[#1e2d45] hover:border-slate-700 hover:shadow-lg"
                      }`}
                    >
                      {/* Live pulsing decoration */}
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#ff3b3b]" />

                      {/* Top bar info */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#8892a4]">
                        <span className="font-bold text-[#ff3b3b] uppercase flex items-center gap-1 tracking-widest">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b3b] animate-pulse shrink-0 inline-block" />
                          Live {m.simulation_minute}'
                        </span>
                        <span className="uppercase tracking-wider">{m.stage}</span>
                      </div>

                      {/* Main visual scoreboard block */}
                      <div className="grid grid-cols-7 items-center gap-2">
                        {/* Home team */}
                        <div className="col-span-2 flex flex-col items-center gap-1.5 text-center">
                          <img
                            src={m.home_crest}
                            alt=""
                            className="w-8 h-8 object-contain shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(m.home_team)}.png`;
                            }}
                          />
                          <p className="text-xs font-extrabold text-[#ffffff] uppercase font-mono tracking-tight block md:hidden">
                            {getTla(m.home_team)}
                          </p>
                          <p className="text-[10px] font-extrabold text-[#ffffff] uppercase tracking-tight hidden md:block leading-snug">
                            {m.home_team}
                          </p>
                          <span className="text-[8px] font-mono text-[#8892a4] font-semibold">
                            Elo {Math.round(m.home_elo)}
                          </span>
                        </div>

                        {/* Scores */}
                        <div className="col-span-3 flex flex-col items-center justify-center gap-1">
                          <div className="flex items-center gap-2 px-3 py-1 bg-black/50 border border-[#1e2d45] rounded-xl self-center">
                            <span className={`text-xl font-mono font-black transition-all px-2 py-0.5 rounded ${
                              isFlashingHome ? "bg-[#00e676] text-slate-950 font-black scale-125" : "text-[#ffffff]"
                            }`}>
                              {m.home_score}
                            </span>
                            <span className="text-[#8892a4] font-bold text-sm">:</span>
                            <span className={`text-xl font-mono font-black transition-all px-2 py-0.5 rounded ${
                              isFlashingAway ? "bg-[#00e676] text-slate-950 font-black scale-125" : "text-[#ffffff]"
                            }`}>
                              {m.away_score}
                            </span>
                          </div>
                          
                          {flashingMatches[m.id] && (
                            <span className="text-[8.5px] font-black text-[#00e676] uppercase tracking-widest font-mono animate-bounce mt-1">
                              ⚽ GOAL FLASH!
                            </span>
                          )}
                        </div>

                        {/* Away team */}
                        <div className="col-span-2 flex flex-col items-center gap-1.5 text-center">
                          <img
                            src={m.away_crest}
                            alt=""
                            className="w-8 h-8 object-contain shrink-0"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(m.away_team)}.png`;
                            }}
                          />
                          <p className="text-xs font-extrabold text-[#ffffff] uppercase font-mono tracking-tight block md:hidden">
                            {getTla(m.away_team)}
                          </p>
                          <p className="text-[10px] font-extrabold text-[#ffffff] uppercase tracking-tight hidden md:block leading-snug">
                            {m.away_team}
                          </p>
                          <span className="text-[8px] font-mono text-[#8892a4] font-semibold">
                            Elo {Math.round(m.away_elo)}
                          </span>
                        </div>
                      </div>

                      {/* Mini venue label */}
                      <div className="text-[8.5px] text-slate-500 font-mono border-t border-slate-800/60 pt-2 flex items-center justify-between">
                        <span>🏟️ {m.stadium.replace(/\[fd:\d+\]/, "").trim()}</span>
                        <span className="text-[8px] text-emerald-400 uppercase font-black tracking-widest flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          Tap to Analyze
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* UPCOMING & RECENT SCHEDULE FIRESTREAMS (SPAN 7) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between pl-1">
              <h4 className="text-[10px] font-bold text-[#8892a4] uppercase font-mono tracking-widest flex items-center gap-1.5 text-left">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                Fixtures & Recent Audits
              </h4>
              <span className="text-[9px] font-mono text-slate-500">
                {upcomingMatches.length + finishedMatches.length} matches mapped
              </span>
            </div>

            <div className="bg-[#131929]/40 border border-[#1e2d45] rounded-2xl p-2 max-h-[460px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 space-y-2">
              {upcomingMatches.length === 0 && finishedMatches.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-mono">
                  No other matches scheduled or simulated.
                </div>
              ) : (
                <>
                  {/* Map Upcoming first */}
                  {upcomingMatches.map((m) => {
                    const isSelected = selectedMatchId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMatch?.(m)}
                        className={`p-3 rounded-xl border bg-[#131929]/80 transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                          isSelected ? "border-emerald-500 bg-[#131929] shadow-md" : "border-[#1e2d45]/60 hover:border-slate-700"
                        }`}
                      >
                        {/* Teams flags & names */}
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                          {/* Home Row */}
                          <div className="flex items-center gap-2">
                            <img 
                              src={m.home_crest} 
                              alt="" 
                              className="w-4 h-4 object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(m.home_team)}.png`;
                              }}
                            />
                            <span className="text-[11px] font-extrabold text-white uppercase tracking-tight truncate">
                              {m.home_team}
                            </span>
                            <span className="text-[8px] font-mono text-[#8892a4]">({Math.round(m.home_elo)})</span>
                          </div>
                          
                          {/* Away Row */}
                          <div className="flex items-center gap-2">
                            <img 
                              src={m.away_crest} 
                              alt="" 
                              className="w-4 h-4 object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(m.away_team)}.png`;
                              }}
                            />
                            <span className="text-[11px] font-extrabold text-white uppercase tracking-tight truncate">
                              {m.away_team}
                            </span>
                            <span className="text-[8px] font-mono text-[#8892a4]">({Math.round(m.away_elo)})</span>
                          </div>
                        </div>

                        {/* Kickoff timing */}
                        <div className="text-right shrink-0 flex flex-col justify-center items-end gap-1 font-mono">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[#00e676] text-[8.5px] font-bold uppercase tracking-widest">
                            Scheduled
                          </span>
                          <span className="text-[#8892a4] text-[9.5px] tracking-tighter">
                            {formatDate(m.date)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Finished Match Audits */}
                  {finishedMatches.map((m) => {
                    const isSelected = selectedMatchId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectMatch?.(m)}
                        className={`p-3 rounded-xl border bg-black/20 hover:bg-black/40 transition-all cursor-pointer flex items-center justify-between gap-3 text-left ${
                          isSelected ? "border-emerald-500 bg-[#131929] shadow-md" : "border-[#1e2d45]/40"
                        }`}
                      >
                        {/* Teams flags & names */}
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0 opacity-75">
                          {/* Home Row */}
                          <div className="flex items-center gap-2">
                            <img 
                              src={m.home_crest} 
                              alt="" 
                              className="w-4 h-4 object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(m.home_team)}.png`;
                              }}
                            />
                            <span className="text-[11px] font-extrabold text-[#ffffff] uppercase tracking-tight truncate">
                              {m.home_team}
                            </span>
                            <span className="text-[8px] font-mono text-[#8892a4]">({Math.round(m.home_elo)})</span>
                          </div>
                          
                          {/* Away Row */}
                          <div className="flex items-center gap-2">
                            <img 
                              src={m.away_crest} 
                              alt="" 
                              className="w-4 h-4 object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://crests.football-data.org/${getTla(m.away_team)}.png`;
                              }}
                            />
                            <span className="text-[11px] font-extrabold text-[#ffffff] uppercase tracking-tight truncate">
                              {m.away_team}
                            </span>
                            <span className="text-[8px] font-mono text-[#8892a4]">({Math.round(m.away_elo)})</span>
                          </div>
                        </div>

                        {/* FT Box */}
                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center font-mono py-1.5 px-2.5 bg-black/40 border border-[#1e2d45] rounded-lg">
                            <span className="text-white text-xs font-black tracking-widest">
                              {m.home_score} - {m.away_score}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[#8892a4] text-[8.5px] font-mono font-bold uppercase tracking-wider">
                            FT
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
