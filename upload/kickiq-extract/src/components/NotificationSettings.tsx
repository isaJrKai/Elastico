import React, { useState, useEffect } from "react";
import { 
  Bell, Check, ShieldAlert, Sparkles, Volume2, 
  Settings, HelpCircle, AlertTriangle, Play, Goal, Flag, RefreshCw, Palette
} from "lucide-react";
import { User, Match } from "../types";
import { triggerHaptic } from "../utils/haptics";
import { useTheme } from "../context/ThemeContext";

export interface NotificationSettingsConfig {
  favoriteTeams: string[];
  goals: boolean;
  redCards: boolean;
  subs: boolean;
  statusChanges: boolean;
  browserPush: boolean;
  soundChime: boolean;
}

const DEFAULT_CONFIG: NotificationSettingsConfig = {
  favoriteTeams: [],
  goals: true,
  redCards: true,
  subs: false,
  statusChanges: true,
  browserPush: true,
  soundChime: true
};

const TEAMS_POOL = ["Brazil", "Germany", "Argentina", "France", "Netherlands"];

interface NotificationSettingsProps {
  user: User;
  onOpenUpgrade: () => void;
  matches: Match[];
  onTriggerDemoAlert?: (title: string, body: string, type: "live" | "follow" | "system") => void;
}

export default function NotificationSettings({ 
  user, 
  onOpenUpgrade, 
  matches, 
  onTriggerDemoAlert 
}: NotificationSettingsProps) {
  
  const { theme, setTheme } = useTheme();
  const isPremium = user.plan === "pro" || user.plan === "elite";
  
  const [config, setConfig] = useState<NotificationSettingsConfig>(() => {
    try {
      const stored = localStorage.getItem("kickiq_notif_config");
      return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [savingStatus, setSavingStatus] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem("kickiq_notif_config", JSON.stringify(config));
    } catch (e) {
      console.error(e);
    }
  }, [config]);

  const toggleTeam = (team: string) => {
    if (!isPremium) return;
    triggerHaptic("light");
    setConfig(prev => {
      const exists = prev.favoriteTeams.includes(team);
      const favoriteTeams = exists 
        ? prev.favoriteTeams.filter(t => t !== team)
        : [...prev.favoriteTeams, team];
      return { ...prev, favoriteTeams };
    });
  };

  const toggleToggle = (key: keyof Omit<NotificationSettingsConfig, "favoriteTeams">) => {
    if (!isPremium) return;
    triggerHaptic("light");
    setConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleTestDemo = (typeName: "goal" | "red_card" | "match_kickoff") => {
    if (!isPremium) return;
    triggerHaptic("medium");
    setSavingStatus(true);
    setTimeout(() => setSavingStatus(false), 900);

    let title = "";
    let body = "";

    if (typeName === "goal") {
      title = "⚽ GOAL! Brazil 1 - 0 Germany";
      body = "Poisson expectation deviation: Match state transitions to dynamic high-fatigue. Expected draw probability dropped to 14.5%!";
    } else if (typeName === "red_card") {
      title = "🟥 RED CARD! France Disciplinary Charge";
      body = "Tactical Shift: Mbappe low-block containment now activated. Defensive workload multiplier spiked to 2.45x.";
    } else {
      title = "⏱️ Match Kickoff Active";
      body = "Your favorite squad Argentina is now online in South American Qualifiers. Telemetry stream is hot.";
    }

    if (onTriggerDemoAlert) {
      onTriggerDemoAlert(title, body, "live");
    }

    // Trigger browser notification if enabled
    if (config.browserPush && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      } else {
        Notification.requestPermission();
      }
    }

    // Sound alert
    if (config.soundChime) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(typeName === "red_card" ? 330 : 523.25, audioCtx.currentTime); // Sound note C5
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-xl flex flex-col gap-4 relative overflow-hidden h-[540px]">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" />
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-850 pb-3">
        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-350 font-mono flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-emerald-400" />
          Alarm Subscriptions
        </h3>
        {isPremium && (
          <span className="text-[7.5px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold uppercase">
            ACTIVE FEED
          </span>
        )}
      </div>

      {/* RENDER PREMIUM BLOCK LOCK SCREEN FOR FREE USERS */}
      {!isPremium && (
        <div className="absolute inset-x-0 bottom-0 top-[45px] z-30 bg-slate-950/85 backdrop-blur-md p-5 flex flex-col justify-center items-center text-center space-y-4">
          <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center relative animate-pulse">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1 -right-1" />
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-100 uppercase tracking-widest font-mono">
              Pro Notification Broker
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal max-w-[210px] mx-auto">
              Real-time push notifications, sound alarms, and favorite team filters are reserved for premium plan strategists.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              onOpenUpgrade();
            }}
            className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-505 hover:opacity-90 active:scale-98 text-slate-950 font-black text-[9.5px] uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            Upgrade to Subscribe Alerts
          </button>
        </div>
      )}

      {/* Main Form content, scrollable */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[85%] text-left select-none scrollbar-thin scrollbar-thumb-slate-800">
        
        {/* Section E: UI Theming */}
        <div className="space-y-2">
          <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            🎨 UI AESTHETIC THEMES
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "emerald", label: "Emerald Turf", bg: "bg-emerald-500" },
              { id: "blue", label: "Royal Blue", bg: "bg-blue-600" },
              { id: "crimson", label: "Deep Crimson", bg: "bg-rose-700" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id as any)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[8px] font-bold uppercase gap-1 cursor-pointer transition-all ${
                  theme === t.id
                    ? "border-emerald-500/50 bg-slate-850"
                    : "border-slate-850 bg-slate-950 hover:border-slate-800"
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${t.bg}`} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section A: Favorite Squad Filtering */}
        <div className="space-y-2 pt-2 border-t border-slate-850">
          <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            👤 FAVORITE SQUAD FILTERS
          </span>
          <p className="text-[8px] text-slate-450 leading-normal mb-2">
            Bind alerts strictly to specific favorite squads. Leave completely empty to audit all standard fixtures.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {TEAMS_POOL.map((team) => {
              const isSelected = config.favoriteTeams.includes(team);
              return (
                <button
                  key={team}
                  type="button"
                  onClick={() => toggleTeam(team)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[8.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm"
                      : "bg-slate-950 border-slate-850 text-slate-450 hover:text-slate-300"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  {team}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section B: Alerts types toggle */}
        <div className="space-y-2 pt-2 border-t border-slate-850">
          <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            🔔 EVENT CLASSIFICATIONS
          </span>

          <div className="space-y-2">
            {[
              { key: "goals" as const, label: "⚽ Real-time Goals", desc: "Instantly broadcast scored goals & updated Poisson values." },
              { key: "redCards" as const, label: "🟥 Red Cards", desc: "Report direct red dismissals & defensive pressure adjustments." },
              { key: "subs" as const, label: "🔄 Substitutions", desc: "Watch tactical switches and structural squad refreshes." },
              { key: "statusChanges" as const, label: "⏱️ Kickoffs & Finals", desc: "Notify when match states drift between Scheduled, Live, or Finished." },
            ].map((ev) => (
              <div 
                key={ev.key}
                onClick={() => toggleToggle(ev.key)}
                className="flex items-start justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-850 hover:border-slate-800 transition cursor-pointer gap-4"
              >
                <div className="space-y-0.5">
                  <p className="text-[10px] font-extrabold text-slate-250 uppercase font-mono">{ev.label}</p>
                  <p className="text-[8px] text-slate-500 leading-tight">{ev.desc}</p>
                </div>
                
                <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 shrink-0 mt-0.5 ${
                  config[ev.key] ? "bg-emerald-500" : "bg-slate-800"
                }`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-slate-950 transition-transform duration-200 transform ${
                    config[ev.key] ? "translate-x-3.5" : "translate-x-0"
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section C: Alert Node delivery channels */}
        <div className="space-y-2 pt-2 border-t border-slate-850">
          <span className="text-[8.5px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            📡 DISPATCH MECHANISMS
          </span>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "browserPush" as const, label: "Web Notifications", desc: "HTML5 Notification popup" },
              { key: "soundChime" as const, label: "Audio Claxon Chime", desc: "Play oscillator chord sound" },
            ].map((delivery) => (
              <div 
                key={delivery.key}
                onClick={() => toggleToggle(delivery.key)}
                className={`p-2 rounded-xl transition border text-left cursor-pointer space-y-1 ${
                  config[delivery.key] 
                    ? "bg-slate-950/80 border-emerald-500/20 text-emerald-400" 
                    : "bg-slate-950/40 border-slate-850 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black uppercase font-mono">{delivery.label}</span>
                </div>
                <p className="text-[7.5px] text-slate-500 leading-tight block">{delivery.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section D: LIVE ALERT DEMO BOARD */}
        <div className="bg-slate-950 border border-slate-850/80 p-3 rounded-xl space-y-2 pt-2">
          <div className="flex items-center gap-1 text-slate-400 font-mono text-[8px] font-black uppercase">
            <Play className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Interactive Alert Sandbox</span>
          </div>
          <p className="text-[7.5px] text-slate-500 leading-normal">
            Simulate live telemetries immediately to test sound chord resonances, state-shifts and notifications!
          </p>

          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => handleTestDemo("goal")}
              className="py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-emerald-400 font-mono text-[8px] font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              ⚽ Go! Goal
            </button>
            <button
              type="button"
              onClick={() => handleTestDemo("red_card")}
              className="py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-emerald-450 font-mono text-[8px] font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              🟥 Go! Red
            </button>
            <button
              type="button"
              onClick={() => handleTestDemo("match_kickoff")}
              className="py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-teal-400 font-mono text-[8px] font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              🚀 Kickoff
            </button>
          </div>
        </div>

      </div>

      <div className="text-[7px] text-slate-500 leading-normal font-mono text-center">
        *Settings auto-persist to your local secure workspace vault. Simulated telemetry polling triggers push alerts based on active ELO modifications.
      </div>
    </div>
  );
}
