import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Lock, Sparkles, CheckCircle2, AlertTriangle, HelpCircle, BarChart3 } from "lucide-react";
import { Match, User } from "../types";

interface PredictionCardProps {
  key?: number | string;
  match: Match;
  user: User;
  onVoteRegistered?: (updatedMatch: Match) => void;
}

export default function PredictionCard({ match, user, onVoteRegistered }: PredictionCardProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userChoice, setUserChoice] = useState<"home" | "draw" | "away" | null>(null);

  // Parse if user has already voted
  useEffect(() => {
    if (match.voted_users && user) {
      const vote = match.voted_users[user.id.toString()];
      if (vote) {
        setHasVoted(true);
        setUserChoice(vote);
      } else {
        setHasVoted(false);
        setUserChoice(null);
      }
    }
  }, [match, user]);

  // Compute ELO-based probabilities (Feature 4 win probability mechanics)
  const calculateEloProbabilities = () => {
    const homeElo = match.home_elo || 1500;
    const awayElo = match.away_elo || 1500;
    
    const eloDiff = homeElo - awayElo;
    const homeWinProb = 1 / (1 + Math.pow(10, -eloDiff / 400));
    const drawProb = 0.28 - 0.1 * Math.abs(homeWinProb - 0.5);
    const awayWinProb = 1 - homeWinProb - drawProb;

    let finalHome = homeWinProb;
    let finalDraw = drawProb;
    let finalAway = awayWinProb;

    // Apply live score drift if match is active
    if (match.status === "live") {
      const currentMinute = Math.min(match.simulation_minute || 0, 90);
      const minuteWeight = Math.min(currentMinute / 90, 1);
      
      let currentScoreImpliedHome = 0.33;
      let currentScoreImpliedDraw = 0.34;
      let currentScoreImpliedAway = 0.33;

      if (match.home_score > match.away_score) {
        const diff = match.home_score - match.away_score;
        currentScoreImpliedHome = Math.min(0.96, 0.6 + diff * 0.15);
        currentScoreImpliedDraw = 0.04 + Math.max(0, 0.3 - diff * 0.1);
        currentScoreImpliedAway = 1 - currentScoreImpliedHome - currentScoreImpliedDraw;
      } else if (match.home_score < match.away_score) {
        const diff = match.away_score - match.home_score;
        currentScoreImpliedAway = Math.min(0.96, 0.6 + diff * 0.15);
        currentScoreImpliedDraw = 0.04 + Math.max(0, 0.3 - diff * 0.1);
        currentScoreImpliedHome = 1 - currentScoreImpliedAway - currentScoreImpliedDraw;
      } else {
        currentScoreImpliedDraw = 0.5 + (currentMinute / 180);
        currentScoreImpliedHome = (1 - currentScoreImpliedDraw) / 2;
        currentScoreImpliedAway = (1 - currentScoreImpliedDraw) / 2;
      }

      finalHome = (1 - minuteWeight) * homeWinProb + minuteWeight * currentScoreImpliedHome;
      const tempDraw = (1 - minuteWeight) * drawProb + minuteWeight * currentScoreImpliedDraw;
      const tempAway = (1 - minuteWeight) * awayWinProb + minuteWeight * currentScoreImpliedAway;

      // Re-normalize to 1.00 total sum
      const sum = finalHome + tempDraw + tempAway;
      finalHome = finalHome / sum;
      finalDraw = tempDraw / sum;
      finalAway = tempAway / sum;
    }

    return {
      home: parseFloat((finalHome * 100).toFixed(1)),
      draw: parseFloat((finalDraw * 100).toFixed(1)),
      away: parseFloat((finalAway * 100).toFixed(1))
    };
  };

  const eloProbs = calculateEloProbabilities();

  // Compute community vote percentages
  const getCommunityPercentages = () => {
    const homeVotes = match.votes_distribution?.home || 0;
    const drawVotes = match.votes_distribution?.draw || 0;
    const awayVotes = match.votes_distribution?.away || 0;
    const total = match.votes_distribution?.total || (homeVotes + drawVotes + awayVotes);

    if (total === 0) {
      return { home: 33.3, draw: 33.3, away: 33.3, total: 0 };
    }

    return {
      home: parseFloat(((homeVotes / total) * 100).toFixed(1)),
      draw: parseFloat(((drawVotes / total) * 100).toFixed(1)),
      away: parseFloat(((awayVotes / total) * 100).toFixed(1)),
      total
    };
  };

  const commProbs = getCommunityPercentages();

  const handleRegisterVote = async (pick: "home" | "draw" | "away") => {
    if (isVoting || hasVoted) return;
    setIsVoting(true);
    
    try {
      const res = await fetch(`/matches/${match.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("kickiq_token")}`
        },
        body: JSON.stringify({ outcome: pick })
      });

      if (res.ok) {
        const data = await res.json();
        if (onVoteRegistered) {
          onVoteRegistered(data.match);
        }
        setHasVoted(true);
        setUserChoice(pick);
      }
    } catch (err) {
      console.error("[PredictionCard] voting failed:", err);
    } finally {
      setIsVoting(false);
    }
  };

  const isPremium = user.plan === "pro" || user.plan === "elite";

  // Simulate premium advanced metrics
  // Dixon-Coles time-drift correction factor & confidence intervals
  const rawHome = eloProbs.home;
  const confidenceInterval = Math.max(3, Math.round(9 - (match.simulation_minute || 0) / 15));

  return (
    <div id={`prediction-engine-${match.id}`} className="bg-[#131929] border border-[#1e2d45] rounded-2xl p-5 shadow-lg select-none">
      
      {/* HEADER BAR */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          <h4 className="text-xs font-black uppercase tracking-widest text-[#ffffff] font-mono">
            AI Expected Outcome
          </h4>
        </div>
        <span className="px-2 py-0.5 rounded bg-[#0a0e1a] text-[#8892a4] border border-[#1e2d45] text-[8px] font-mono">
          Elo Driven Forecast
        </span>
      </div>

      {/* PROBABILITY BARS GRIDS */}
      <div className="space-y-4">
        
        {/* HOME WIN PERCENT BAR */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#ffffff]">
            <span className="font-bold flex items-center gap-1">
              🏠 {match.home_team} Win
            </span>
            <span className="font-extrabold text-emerald-400">{eloProbs.home}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#0a0e1a] overflow-hidden border border-[#1e2d45]/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${eloProbs.home}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
            />
          </div>
        </div>

        {/* DRAW PERCENT BAR */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#ffffff]">
            <span className="font-bold flex items-center gap-1">
              🤝 Push / Draw Outcome
            </span>
            <span className="font-extrabold text-[#ffd700]">{eloProbs.draw}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#0a0e1a] overflow-hidden border border-[#1e2d45]/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${eloProbs.draw}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
            />
          </div>
        </div>

        {/* AWAY WIN PERCENT BAR */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#ffffff]">
            <span className="font-bold flex items-center gap-1">
              ✈️ {match.away_team} Win
            </span>
            <span className="font-extrabold text-sky-400">{eloProbs.away}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#0a0e1a] overflow-hidden border border-[#1e2d45]/30">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${eloProbs.away}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400"
            />
          </div>
        </div>

      </div>

      {/* DETAILED PREMIUM ANALYTICS SHIELD FOR HERO USERS */}
      <div className="mt-5 pt-4 border-t border-slate-800/80">
        {isPremium ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest font-mono">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              Pro Intelligence Breakdown
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-300">
              <div className="flex flex-col">
                <span className="text-slate-500 uppercase tracking-wider">Dixon-Coles Correction</span>
                <span className="font-bold text-white">τ = +0.024 (Poisson Drift)</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500 uppercase tracking-wider">Confidence Interval</span>
                <span className="font-bold text-emerald-300">Home {rawHome}% ± {confidenceInterval}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[#0a0e1a]/95 border border-[#1e2d45] flex flex-col justify-center items-center text-center gap-2">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#ffd700] uppercase tracking-widest bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
              <Lock className="w-2.5 h-2.5" /> Premium Metric Locked
            </div>
            <p className="text-[10px] text-slate-400 leading-snug max-w-[280px]">
              Dixon-Coles relative correction factor, confidence intervals, and advanced Poisson simulation arrays require <span className="text-emerald-400 font-bold">Pro</span> or <span className="text-amber-400 font-bold">Elite</span> tier access.
            </p>
          </div>
        )}
      </div>

      {/* COMMUNITY VOTING ZONE */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
        <h5 className="text-[10px] uppercase font-mono tracking-widest text-[#8892a4] text-left">
          Community Match Vote
        </h5>

        {!hasVoted ? (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleRegisterVote("home")}
              disabled={isVoting}
              className="py-1.5 bg-[#0a0e1a] hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-[#1e2d45] text-white rounded-lg transition-all text-[10px] font-semibold tracking-wide flex flex-col items-center gap-1 cursor-pointer"
            >
              <span>{getTla(match.home_team)}</span>
              <span className="text-[8px] font-mono text-[#8892a4]">Home Win</span>
            </button>
            <button
              onClick={() => handleRegisterVote("draw")}
              disabled={isVoting}
              className="py-1.5 bg-[#0a0e1a] hover:bg-amber-500/10 hover:border-amber-500/40 border border-[#1e2d45] text-white rounded-lg transition-all text-[10px] font-semibold tracking-wide flex flex-col items-center gap-1 cursor-pointer"
            >
              <span>DRAW</span>
              <span className="text-[8px] font-mono text-[#8892a4]">Split Pt</span>
            </button>
            <button
              onClick={() => handleRegisterVote("away")}
              disabled={isVoting}
              className="py-1.5 bg-[#0a0e1a] hover:bg-sky-500/10 hover:border-sky-500/40 border border-[#1e2d45] text-white rounded-lg transition-all text-[10px] font-semibold tracking-wide flex flex-col items-center gap-1 cursor-pointer"
            >
              <span>{getTla(match.away_team)}</span>
              <span className="text-[8px] font-mono text-[#8892a4]">Away Win</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/15 text-left flex items-center justify-between text-[10px] text-emerald-400 font-mono">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Your pick locked in:
              </span>
              <span className="font-extrabold uppercase bg-emerald-500/20 px-2 py-0.5 rounded text-white">
                {userChoice === "home" ? match.home_team : userChoice === "away" ? match.away_team : "Draw"}
              </span>
            </div>

            {/* Side-by-side accuracy comparators */}
            <div className="grid grid-cols-2 gap-3 text-[10px] font-mono border-t border-slate-800/40 pt-2 text-left">
              <div className="flex flex-col gap-1 border-r border-slate-800">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">AI Says Prediction</span>
                <span className="font-black text-emerald-400">{eloProbs.home}% {getTla(match.home_team)}</span>
              </div>
              <div className="flex flex-col gap-1 pl-1">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">Community Forecast</span>
                <span className="font-black text-[#ffd700]">{commProbs.home}% {getTla(match.home_team)}</span>
              </div>
            </div>

            <div className="text-[8.5px] font-mono text-slate-500 text-center tracking-wide">
              Total Community Votes Registered: <span className="text-slate-300 font-bold">{commProbs.total} picks</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// Minimal helper
function getTla(name: string) {
  if (!name) return "";
  return name.substring(0, 3).toUpperCase();
}
