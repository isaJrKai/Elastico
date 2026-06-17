import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Bell, CheckCircle, Clock, Heart, ToggleLeft, ToggleRight, XCircle, ChevronRight } from "lucide-react";
import { Match, User } from "../types";

interface PersonalizedDashboardProps {
  user: User;
  matches: Match[];
  onSelectMatch?: (match: Match) => void;
}

export default function PersonalizedDashboard({ user, matches, onSelectMatch }: PersonalizedDashboardProps) {
  // Pinned teams stored in local storage
  const [pinnedTeams, setPinnedTeams] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("kickiq_pinned_teams");
      return stored ? JSON.parse(stored) : ["Brazil", "Argentina"];
    } catch {
      return ["Brazil", "Argentina"];
    }
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [countdownString, setCountdownString] = useState("00:00:00");
  const [upcomingMatch, setUpcomingMatch] = useState<Match | null>(null);

  // Sync pinned teams
  const togglePinTeam = (teamName: string) => {
    let next: string[];
    if (pinnedTeams.includes(teamName)) {
      next = pinnedTeams.filter((t) => t !== teamName);
    } else {
      next = [...pinnedTeams, teamName];
    }
    setPinnedTeams(next);
    localStorage.setItem("kickiq_pinned_teams", JSON.stringify(next));
  };

  // Find next upcoming match and calculate countdown
  useEffect(() => {
    const scheduled = matches
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (scheduled.length > 0) {
      const nextMatch = scheduled[0];
      setUpcomingMatch(nextMatch);

      const updateTimer = () => {
        const diffMs = new Date(nextMatch.date).getTime() - Date.now();
        if (diffMs <= 0) {
          setCountdownString("00:00:00 - Kickoff!");
          return;
        }

        const hrs = Math.floor(diffMs / (3600 * 1000));
        const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        const secs = Math.floor((diffMs % (60 * 1000)) / 1000);

        setCountdownString(
          `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        );
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdownString("00:00:00");
      setUpcomingMatch(null);
    }
  }, [matches]);

  // Compute voting statistics
  const calculateVotingStats = () => {
    let totalVotes = 0;
    let correctVotes = 0;
    let incorrectVotes = 0;

    matches.forEach((m) => {
      if (m.voted_users && m.voted_users[user.id.toString()]) {
        totalVotes += 1;
        if (m.status === "finished") {
          const userVote = m.voted_users[user.id.toString()];
          const homeWon = m.home_score > m.away_score && userVote === "home";
          const awayWon = m.away_score > m.home_score && userVote === "away";
          const drawWon = m.home_score === m.away_score && userVote === "draw";

          if (homeWon || awayWon || drawWon) {
            correctVotes += 1;
          } else {
            incorrectVotes += 1;
          }
        }
      }
    });

    const accuracyRate = totalVotes > 0 ? ((correctVotes / (correctVotes + incorrectVotes || 1)) * 100).toFixed(1) : "0.0";

    return { totalVotes, correctVotes, incorrectVotes, accuracyRate };
  };

  const voteStats = calculateVotingStats();

  const handleToggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    if (!notificationsEnabled && "Notification" in window) {
      Notification.requestPermission();
    }
  };

  // 8 seeded teams selection
  const SEEDED_LIST = ["Brazil", "Argentina", "France", "Germany", "Spain", "England", "Portugal", "Netherlands"];

  return (
    <div id="personalized-dashboard-panel" className="bg-[#131929] border border-[#1e2d45] rounded-2xl p-5 shadow-lg space-y-5 text-left select-none">
      
      {/* COUNTDOWN CARD ROW */}
      <div className="p-4 rounded-xl bg-[#0a0e1a]/80 border border-emerald-500/30 shadow-[0_0_12px_rgba(0,230,118,0.06)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-[#00e676] rounded-xl">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-widest leading-none">
              Countdown to Kickoff
            </h4>
            <span className="text-xl font-mono font-black text-white tracking-widest block mt-1.5 selection:bg-emerald-500 selection:text-black">
              {countdownString}
            </span>
            {upcomingMatch && (
              <p className="text-[9px] text-[#8892a4] font-mono mt-0.5 uppercase">
                {upcomingMatch.home_team} vs {upcomingMatch.away_team}
              </p>
            )}
          </div>
        </div>

        {upcomingMatch && (
          <button
            onClick={() => onSelectMatch?.(upcomingMatch)}
            className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-0.5 transition"
          >
            Tune In <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* QUICK STATS & PUSH SETTINGS GRIDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* VOTE STATS HISTORIES (Feature 9 voting stats indicator) */}
        <div className="p-4 bg-[#0a0e1a]/50 border border-[#1e2d45]/60 rounded-xl space-y-3">
          <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
            Prediction Accuracy Tracker
          </h4>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-black/40 border border-slate-800 rounded-lg">
              <span className="text-[9px] text-slate-500 font-mono block uppercase">Hits</span>
              <span className="text-sm font-black text-emerald-400 font-mono">{voteStats.correctVotes}</span>
            </div>
            <div className="p-2 bg-black/40 border border-slate-800 rounded-lg">
              <span className="text-[9px] text-slate-500 font-mono block uppercase">Misses</span>
              <span className="text-sm font-black text-red-500 font-mono">{voteStats.incorrectVotes}</span>
            </div>
            <div className="p-2 bg-[#00e676]/10 border border-[#00e676]/20 rounded-lg">
              <span className="text-[8px] text-[#00e676] font-mono block uppercase font-bold">Accuracy</span>
              <span className="text-xs font-black text-[#ffffff] font-mono leading-none block mt-1">
                {voteStats.accuracyRate}%
              </span>
            </div>
          </div>
        </div>

        {/* NOTIFICATION PREFERENCES */}
        <div className="p-4 bg-[#0a0e1a]/50 border border-[#1e2d45]/60 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                Browser Event Push Alerts
              </h4>
              <p className="text-[9px] text-slate-400 pr-2">
                Simulate flash live-match goals & score push signals.
              </p>
            </div>
            
            <button
              onClick={handleToggleNotifications}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              {notificationsEnabled ? (
                <ToggleRight className="w-8 h-8 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-500" />
              )}
            </button>
          </div>

          <div className="text-[8.5px] font-mono text-slate-500 mt-2">
            Status: {notificationsEnabled ? "🟢 BROADCAST CONNECTION ACTIVE" : "⚫ POLLING MODE ONLY"}
          </div>
        </div>

      </div>

      {/* PINNED TEAMS TRACKER */}
      <div className="space-y-3">
        <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-red-500 animate-pulse fill-red-500" />
          Seeded Pinned Favorites
        </h4>

        <div className="flex flex-wrap gap-2">
          {SEEDED_LIST.map((team) => {
            const isPinned = pinnedTeams.includes(team);
            return (
              <button
                key={team}
                type="button"
                onClick={() => togglePinTeam(team)}
                className={`px-3 py-1.5 rounded-xl border font-mono text-[9.5px] font-bold uppercase tracking-tight flex items-center gap-1.5 cursor-pointer transition ${
                  isPinned 
                    ? "bg-slate-900 border-[#ffd700] text-white shadow-sm" 
                    : "bg-[#0a0e1a] border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
                }`}
              >
                <img
                  src={`https://crests.football-data.org/${team.substring(0, 3).toUpperCase()}.png`}
                  alt=""
                  className="w-3.5 h-3.5 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "https://crests.football-data.org/FRA.png";
                  }}
                />
                {team}
                {isPinned && <span className="text-[#ffd700] text-[9px]">★</span>}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
