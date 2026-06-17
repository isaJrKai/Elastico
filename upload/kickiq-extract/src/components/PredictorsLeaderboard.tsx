import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Award, 
  MessageSquare, 
  Send, 
  Lock, 
  Unlock, 
  CheckCircle, 
  Flame, 
  Zap, 
  TrendingUp, 
  Crown, 
  Globe, 
  RefreshCw, 
  Check, 
  ExternalLink,
  Users
} from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface Predictor {
  id: number;
  display_name: string;
  avatar_url: string;
  plan: "free" | "pro" | "elite";
  correct_count: number;
  incorrect_count: number;
  current_correct_streak: number;
  current_incorrect_streak: number;
  is_link_active: boolean;
  whatsapp_link?: string;
  telegram_link?: string;
  rank: number;
  is_top_ten: boolean;
}

interface PredictorsLeaderboardProps {
  user: {
    id: number;
    display_name: string;
    avatar_url?: string;
    plan: "free" | "pro" | "elite";
    email?: string;
    whatsapp_link?: string;
    telegram_link?: string;
  };
  authToken: string;
  onProfileUpdated?: (updatedUser: any) => void;
}

export default function PredictorsLeaderboard({
  user,
  authToken,
  onProfileUpdated
}: PredictorsLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<Predictor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states links addition
  const [whatsappVal, setWhatsappVal] = useState(user.whatsapp_link || "");
  const [telegramVal, setTelegramVal] = useState(user.telegram_link || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/predictors/leaderboard");
      if (!res.ok) throw new Error("Could not index top predictors list");
      const data = await res.json();
      if (data && data.success) {
        setLeaderboard(data.leaderboard);
      } else {
        throw new Error("Invalid schema");
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse system predictors stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  // Sync state values with active user changes
  useEffect(() => {
    setWhatsappVal(user.whatsapp_link || "");
    setTelegramVal(user.telegram_link || "");
  }, [user.whatsapp_link, user.telegram_link]);

  // Identify logged in user's position and locks status
  const currentUserEntry = leaderboard.find(p => p.id === user.id);
  const isEliteUser = user.plan === "elite";
  const userRank = currentUserEntry?.rank || 99;
  const inTopTen = userRank <= 10;
  
  // Requirement check: 5 consecutive predictions (wins)
  const userStreak = currentUserEntry?.current_correct_streak || 0;
  const isStreakQualified = userStreak >= 5;
  
  // Unified lock check: Elite VIP is free unconditionally, otherwise must be top 10 and keep 5 win streak
  const isLinkUnlockedForSelf = isEliteUser || (inTopTen && isStreakQualified);

  const handleUpdateSocialLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    triggerHaptic("medium");

    try {
      const res = await fetch("/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          whatsapp_link: whatsappVal.trim(),
          telegram_link: telegramVal.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(true);
        if (onProfileUpdated) {
          onProfileUpdated(data.user);
        }
        setTimeout(() => setSaveSuccess(false), 3000);
        // Refresh rankings list
        await fetchLeaderboard();
      } else {
        throw new Error(data.error || "Failed to update profile linkages");
      }
    } catch (err: any) {
      alert(err.message || "Something went wrong updating social links.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden text-left bg-slate-950/40 p-4 border border-slate-900 rounded-3xl backdrop-blur-md">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 font-mono">
              Predictors Hall Of Fame
            </h3>
            <p className="text-[9px] text-slate-500">
              Top analysts and consecutive correct forecasts.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic("light");
            fetchLeaderboard();
          }}
          className="p-1 px-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-white transition flex items-center gap-1 text-[9px] font-mono uppercase font-black"
          title="Refresh rankings"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Sync
        </button>
      </div>

      {/* GAMIFICATION BRIEF GUIDE BANNER */}
      <div className="bg-gradient-to-r from-purple-500/10 via-slate-900 to-emerald-500/10 border border-slate-800/60 p-3 rounded-2xl flex flex-col gap-1.5 shrink-0 text-[10px]">
        <div className="flex items-center gap-1">
          <Zap className="w-3.5 h-[#e91e63] text-amber-400 fill-amber-400/20" />
          <span className="font-extrabold text-slate-200">How to advertise your prediction group link:</span>
        </div>
        <p className="text-slate-400 leading-normal text-[9px]">
          Secure a spot in the <strong className="text-amber-400">Top 10 Predictors</strong> and hit <strong className="text-emerald-400">5 consecutive wins (Streak)</strong>. If you subsequently suffer <strong className="text-rose-400">3 consecutive losses</strong>, your link goes inactive.
        </p>
        <div className="flex items-center gap-1.5 pt-1 text-[8px] font-black uppercase tracking-wider font-mono">
          <span className="text-teal-400 flex items-center gap-1 bg-teal-500/5 px-1.5 py-0.5 rounded border border-teal-500/25">
            <Crown className="w-2.5 h-2.5" />
            Elite tier has it active forever for free!
          </span>
        </div>
      </div>

      {/* LEADERS LIST GRID */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 pr-1 space-y-2 min-h-[220px]">
        {loading && leaderboard.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 font-mono tracking-widest animate-pulse">
            CALIBRATING FORECAST RANKINGS FLOW...
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[10px] text-rose-400 font-mono text-center">
            {error}
          </div>
        ) : (
          <div className="space-y-1.5">
            {leaderboard.map((item) => {
              const belongsToSelf = item.id === user.id;
              
              return (
                <div 
                  key={item.id} 
                  className={`p-2.5 rounded-2xl border transition duration-200 flex items-center justify-between gap-3 ${
                    belongsToSelf
                      ? "bg-slate-900 border-yellow-500/30 shadow-lg shadow-yellow-500/[0.02]"
                      : "bg-slate-900/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/70"
                  }`}
                >
                  {/* Left info: rank and username */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank Badge */}
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black font-mono shrink-0 select-none ${
                      item.rank === 1 
                        ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10" 
                        : item.rank === 2 
                        ? "bg-slate-300 text-slate-950" 
                        : item.rank === 3 
                        ? "bg-orange-400 text-slate-950"
                        : "bg-slate-950 text-slate-450 border border-slate-850"
                    }`}>
                      {item.rank}
                    </span>

                    {/* Avatar */}
                    <img 
                      src={item.avatar_url} 
                      alt={item.display_name} 
                      className={`w-7 h-7 rounded-lg border object-cover ${belongsToSelf ? 'border-yellow-500/40' : 'border-slate-800'}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=50`;
                      }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-bold truncate max-w-[100px] ${belongsToSelf ? 'text-yellow-400 font-semibold' : 'text-slate-200'}`}>
                          {item.display_name}
                        </span>
                        {belongsToSelf && (
                          <span className="text-[7.5px] uppercase font-black px-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                            ME
                          </span>
                        )}
                        {item.plan === "elite" && (
                          <Crown className="w-3 h-3 text-teal-400 shrink-0" title="Elite Pro User Tier" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono mt-0.5">
                        <span className="text-emerald-500 font-bold">{item.correct_count}W</span>
                        <span>•</span>
                        <span className="text-slate-450">{item.incorrect_count}L</span>
                        {item.current_correct_streak > 0 && (
                          <span className="text-amber-400 font-black flex items-center gap-0.5 ml-1 animate-pulse">
                            <Flame className="w-2.5 h-2.5 text-orange-500 fill-orange-500/30" />
                            {item.current_correct_streak} Str
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right hand side action buttons (social buttons) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Active assigned chatroom link state display button */}
                    {item.is_link_active && (item.whatsapp_link || item.telegram_link) ? (
                      <div className="flex items-center gap-1">
                        {item.whatsapp_link && (
                          <a
                            href={item.whatsapp_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => triggerHaptic("medium")}
                            className="bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600 hover:text-slate-950 p-1 px-2.5 rounded-lg border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 font-mono hover:scale-105"
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-400" />
                            Wa Group
                          </a>
                        )}
                        {item.telegram_link && (
                          <a
                            href={item.telegram_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => triggerHaptic("medium")}
                            className="bg-sky-600/15 text-sky-400 hover:bg-sky-600 hover:text-slate-950 p-1 px-2.5 rounded-lg border border-sky-500/30 text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1 font-mono hover:scale-105"
                          >
                            <Send className="w-3 h-3 text-sky-400" />
                            Tg Group
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[8px] font-extrabold uppercase text-slate-500 bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg select-none">
                        <Lock className="w-2.5 h-2.5 text-slate-600 mr-0.5" />
                        {item.plan === "elite"
                          ? "No Link Added"
                          : !item.is_top_ten
                          ? "Out of Top 10"
                          : `Win Streak (${item.current_correct_streak}/5)`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT PERSONAL LINKS PANEL (FOR LOGGED IN USER) */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shrink-0 mt-2 space-y-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isLinkUnlockedForSelf ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500" />
            )}
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-200 font-mono">
              📢 Advertise Your Chat Link
            </h4>
          </div>
          
          {/* Status Badge */}
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
            isLinkUnlockedForSelf 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
              : "bg-slate-950 text-slate-500 border border-slate-850"
          }`}>
            {isEliteUser 
              ? "Elite Recruits VIP Access" 
              : isLinkUnlockedForSelf 
              ? "Streak Active - Unlocked" 
              : `Locked (${userActiveStatusLabel(userRank, userStreak)})`}
          </span>
        </div>

        <form onSubmit={handleUpdateSocialLinks} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[8px] uppercase tracking-wider font-extrabold text-slate-450 font-mono">
                WhatsApp Invitation URL
              </label>
              <input
                type="url"
                value={whatsappVal}
                onChange={(e) => setWhatsappVal(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-[10px] p-2 rounded-lg focus:outline-none focus:border-purple-500 text-xs text-left"
                disabled={!isLinkUnlockedForSelf}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] uppercase tracking-wider font-extrabold text-slate-450 font-mono">
                Telegram Invitation URL
              </label>
              <input
                type="url"
                value={telegramVal}
                onChange={(e) => setTelegramVal(e.target.value)}
                placeholder="https://t.me/..."
                className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-[10px] p-2 rounded-lg focus:outline-none focus:border-purple-500 text-xs text-left"
                disabled={!isLinkUnlockedForSelf}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[8.5px] text-slate-500 leading-normal max-w-[70%] sm:max-w-[75%]">
              {!isLinkUnlockedForSelf 
                ? "🚀 Lock active. Achieve top 10 & a 5-win streak to showcase your link on user lists." 
                : "🚀 Links are broadcasted live to all users on the predictors leaderboard."
              }
            </p>

            <button
              type="submit"
              disabled={isSaving || !isLinkUnlockedForSelf}
              className={`py-2 px-4 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-black tracking-wider ${
                isLinkUnlockedForSelf
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:opacity-90 active:scale-98"
                  : "bg-slate-950 text-slate-655 border border-slate-850 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Synced
                </>
              ) : (
                "Publish Link"
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

// Utility text helper
function userActiveStatusLabel(rank: number, streak: number) {
  if (rank > 10) return `Rank #${rank} (Requires top 10)`;
  if (streak < 5) return `Streak ${streak}/5`;
  return "Locked";
}
