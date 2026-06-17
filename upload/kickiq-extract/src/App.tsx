import React, { useState, useEffect } from "react";
import { Shield, Sparkles, Volume2, LogOut, Award, Layers, Users, Zap, UserCheck, Crown, HelpCircle } from "lucide-react";
import { useTheme } from "./context/ThemeContext";

import { User, Match } from "./types";
import LoginView from "./components/LoginView";
import DashboardView from "./components/DashboardView";
import AdminPanel from "./components/AdminPanel";
import SubscriptionView from "./components/SubscriptionView";
import StadiumNewsTicker from "./components/StadiumNewsTicker";
import GlobalShortcutManager from "./components/GlobalShortcutManager";
import InteractiveTour from "./components/InteractiveTour";
import AutoLogoutWarning from "./components/AutoLogoutWarning";
import { triggerHaptic } from "./utils/haptics";

export default function App() {
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem("kickiq_token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "admin">("dashboard");
  const { theme } = useTheme();
  const [showSubscription, setShowSubscription] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Sync token to persistent localStorage
  useEffect(() => {
    if (authToken) {
      localStorage.setItem("kickiq_token", authToken);
      fetchUserProfile(authToken);
    } else {
      localStorage.removeItem("kickiq_token");
      setUser(null);
    }
  }, [authToken]);

  // Sync matches on active token verification
  useEffect(() => {
    if (authToken && user) {
      fetchMatches();
      const isCompleted = localStorage.getItem("kickiq_tour_completed");
      if (!isCompleted) {
        setShowTour(true);
      }
    }
  }, [authToken, user]);

  const fetchUserProfile = async (token: string) => {
    setIsLoadingUser(true);
    try {
      const res = await fetch("/auth/me", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
      } else {
        // Token stale, flush
        setAuthToken("");
      }
    } catch (e) {
      setAuthToken("");
    } finally {
      setIsLoadingUser(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const res = await fetch("/matches");
      const data = await res.json();
      if (res.ok) {
        setMatches(data);
        
        // Auto select first match if none is active
        if (data.length > 0 && !selectedMatch) {
          setSelectedMatch(data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load match listings", e);
    }
  };

  const handleSignOut = () => {
    if (user?.email) {
      fetch("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      }).catch((err) => console.warn("Failed to notify backend logout trial de-allocation", err));
    }
    setAuthToken("");
    setUser(null);
    setSelectedMatch(null);
  };

  const handleSelectMatch = (m: Match) => {
    setSelectedMatch(m);
  };

  const handleCycleMatch = () => {
    if (matches.length === 0) return;
    const currentIndex = selectedMatch ? matches.findIndex(m => m.id === selectedMatch.id) : -1;
    const nextIndex = (currentIndex + 1) % matches.length;
    setSelectedMatch(matches[nextIndex]);
  };

  const handleToggleCompare = () => {
    const btn = document.getElementById("matches-comparison-mode-btn");
    if (btn) btn.click();
  };

  const handleExportReport = () => {
    const btn = document.getElementById("btn-export-match-analytics");
    if (btn) btn.click();
  };

  const handleOpenTour = () => {
    setShowTour(prev => !prev);
  };

  // If loading user info from token
  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-emerald-400">
        <div className="relative w-10 h-10 border border-emerald-500/30 rounded-xl bg-emerald-500/10 flex items-center justify-center animate-spin mb-4 text-sm font-bold">
          ⚽
        </div>
        Decrypting secure token signatures...
      </div>
    );
  }

  // If unauthenticated, route to login portal
  if (!authToken || !user) {
    return <LoginView onLoginSuccess={setAuthToken} />;
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300 theme-${theme}`}>
    
      {/* Visual Turf Field Overlay Line glow parameters */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[700px] rounded-full theme-bg-glow blur-[150px]" />
      </div>

      {/* Primary Global Navigation Header */}
      <header className="relative z-10 shrink-0 border-b border-slate-900 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16.5 flex items-center justify-between">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 group">
            <span className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-xl theme-bg-emerald-100 border border-emerald-500/20 text-md pixar-ball-bounce hover:scale-115 transition-transform duration-300">
              ⚽
            </span>
            <div>
              <span className="text-sm uppercase tracking-wider font-sans block">
                <span className="kickiq-live-effect mr-1">KICKIQ</span>
                <span className="text-slate-100 font-medium">Analyst</span>
              </span>
              <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest font-mono mt-0.5">
                Cup 2026 Prediction Deck
              </span>
            </div>
          </div>

          {/* Navigation links & tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-450 hover:text-slate-200"
              }`}
            >
              Command Station
            </button>

            {user.role === "admin" && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                    : "text-slate-450 hover:text-slate-200"
                }`}
              >
                Admin Panel
              </button>
            )}

            <button
              onClick={() => {
                triggerHaptic("medium");
                setShowTour(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 transition-all flex items-center gap-1 cursor-pointer"
              title="Start Interactive Tutorial Tour Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Help Guide</span>
            </button>
          </div>

          {/* Active User session controls */}
          <div className="flex items-center gap-3">
            
            {/* Membership plans display badge */}
            <button
              onClick={() => setShowSubscription(true)}
              className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider border cursor-pointer transition flex items-center gap-1.5 ${
                user.plan === "elite"
                  ? "bg-teal-500/10 text-teal-400 border-teal-500/25"
                  : user.plan === "pro"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              <Crown className="w-3 h-3" />
              {user.plan} Recruit
            </button>

            {/* Profile Avatar details */}
            <div className="flex items-center gap-2 border-l border-slate-900 pl-3">
              <img
                src={user.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"}
                alt={user.display_name}
                className="w-7 h-7 rounded-lg border border-slate-850"
              />
              <span className="text-xs font-semibold text-slate-300 hidden md:inline truncate max-w-[80px]">
                {user.display_name}
              </span>
              
              <button
                onClick={handleSignOut}
                title="Log Out Session"
                className="p-1 px-1.5 text-slate-500 hover:text-slate-350 bg-slate-950 rounded-md border border-slate-850 hover:scale-105 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main Viewport Shell */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 overflow-hidden">
        {activeTab === "dashboard" ? (
          <DashboardView
            user={user}
            authToken={authToken}
            onOpenUpgrade={() => setShowSubscription(true)}
            onProfileUpdated={setUser}
            matches={matches}
            onRefreshMatches={fetchMatches}
            selectedMatch={selectedMatch}
            onSelectMatch={handleSelectMatch}
          />
        ) : (
          <AdminPanel authToken={authToken} user={user} />
        )}
      </main>

      {/* Subscriptions PayPal billing upgrade system overlay */}
      {showSubscription && (
        <SubscriptionView
          user={user}
          onUpgradeSuccess={setUser}
          onClose={() => setShowSubscription(false)}
          authToken={authToken}
        />
      )}

      {/* Real-time Stadium News Ticker Console */}
      <StadiumNewsTicker user={user} selectedMatch={selectedMatch} />

      {/* Global Keyboard Short-cut Manager */}
      <GlobalShortcutManager 
        onSwitchTab={setActiveTab}
        onCycleMatch={handleCycleMatch}
        onToggleCompare={handleToggleCompare}
        onExportReport={handleExportReport}
        onOpenTour={handleOpenTour}
      />

      {/* Guided Walkthrough Onboarding Tour */}
      <InteractiveTour 
        isOpen={showTour}
        onClose={() => setShowTour(false)}
      />

      {/* Account Time-to-Live Session automatic logouter warner */}
      <AutoLogoutWarning 
        authToken={authToken}
        onTokenRefresh={setAuthToken}
        onLogOut={handleSignOut}
      />

    </div>
  );
}
