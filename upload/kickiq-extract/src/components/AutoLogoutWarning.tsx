import React, { useState, useEffect } from "react";
import { ShieldAlert, RefreshCw, LogOut, Clock, Layers } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface AutoLogoutWarningProps {
  authToken: string;
  onTokenRefresh: (newToken: string) => void;
  onLogOut: () => void;
}

export default function AutoLogoutWarning({
  authToken,
  onTokenRefresh,
  onLogOut
}: AutoLogoutWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Custom developer-friendly simulator parameters to easily preview the modal
  const [useSimulation, setUseSimulation] = useState(false);
  const [simExpiryTime, setSimExpiryTime] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Helper function to decode JWT expiration
  const getJwtExpiryMs = (token: string): number | null => {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.exp ? payload.exp * 1000 : null;
    } catch (e) {
      return null;
    }
  };

  // Primary effect to poll or count down the session lifetime
  useEffect(() => {
    if (!authToken) return;

    let intervalId: any = null;

    const checkSessionExpiry = () => {
      const currentTime = Date.now();
      let expireTime = getJwtExpiryMs(authToken);

      // If simulated mode is active, use the simulated expiry timestamp instead
      if (useSimulation) {
        if (!simExpiryTime) {
          // Set simulated 6 minutes session (modal shows in 1 minute, 5 minutes countdown)
          const newSimExpiry = currentTime + 360000; // 6 minutes
          setSimExpiryTime(newSimExpiry);
          expireTime = newSimExpiry;
        } else {
          expireTime = simExpiryTime;
        }
      }

      if (!expireTime) return;

      const msRemaining = expireTime - currentTime;
      const secsRemaining = Math.max(0, Math.floor(msRemaining / 1000));

      setSecondsLeft(secsRemaining);

      // Warning triggers exactly at or below 5 minutes (300 seconds)
      if (secsRemaining > 0 && secsRemaining <= 300) {
        if (!showWarning) {
          setShowWarning(true);
          triggerHaptic("heavy");
        }
      } else if (secsRemaining <= 0) {
        // Automatically logout once session is fully expired
        clearInterval(intervalId);
        onLogOut();
      } else {
        setShowWarning(false);
      }
    };

    // run initial check immediately
    checkSessionExpiry();

    // Check every second to drive fluid clock ticking animations
    intervalId = setInterval(checkSessionExpiry, 1000);

    return () => clearInterval(intervalId);
  }, [authToken, useSimulation, simExpiryTime, showWarning]);

  // Handle Token Renew Extend action
  const handleExtendSession = async () => {
    setIsRefreshing(true);
    triggerHaptic("medium");
    try {
      const res = await fetch("/auth/extend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.token) {
        // Reset simulation parameters
        setSimExpiryTime(null);
        setShowWarning(false);
        onTokenRefresh(data.token);
      } else {
        throw new Error(data.error || "Failed to renew authorization scope.");
      }
    } catch (err) {
      console.error(err);
      onLogOut(); // Logout if refresh fails for safety constraints
    } finally {
      setIsRefreshing(false);
    }
  };

  // Standard clean display formats
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Invisible or styled diagnostic configuration options to let users test this instantly */}
      {isMinimized ? (
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            triggerHaptic("light");
          }}
          className="fixed bottom-20 left-4 z-50 bg-slate-900/95 hover:bg-slate-850 border border-slate-800 p-2 text-amber-400 rounded-xl font-mono text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer max-w-[120px] select-none"
          title="Restore Session Monitor"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="font-extrabold tracking-tight">
            {useSimulation ? formatTime(secondsLeft) : "JWT Active"}
          </span>
          <span className="text-[8px] text-slate-500 font-bold bg-slate-950 px-1 rounded hover:text-slate-300">
            Show
          </span>
        </button>
      ) : (
        <div className="fixed bottom-20 left-4 z-50 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl text-[10px] font-mono shadow-xl max-w-[210px] hover:scale-102 transition duration-200">
          <div className="flex items-center justify-between gap-2.5 mb-1.5">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Session Monitor
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setUseSimulation(prev => !prev);
                  setSimExpiryTime(null);
                  setShowWarning(false);
                  triggerHaptic("light");
                }}
                className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-extrabold cursor-pointer border ${
                  useSimulation
                    ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
                    : "bg-slate-950 text-slate-500 border-slate-855"
                }`}
              >
                {useSimulation ? "Sim" : "Live"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(true);
                  triggerHaptic("light");
                }}
                className="hover:text-slate-200 text-slate-500 p-0.5 text-xs font-black select-none cursor-pointer rounded bg-slate-950 border border-slate-850 hover:bg-slate-850 h-5 w-5 flex items-center justify-center font-sans"
                title="Minimize Monitor"
              >
                —
              </button>
            </div>
          </div>
          <p className="text-slate-400 leading-normal text-[9px]">
            {useSimulation 
              ? `Simulated 6-min session. Modal displays at 5:00. Time Left: ${formatTime(secondsLeft)}` 
              : `Real Session JWT. Expires in 7d. Time Left: ~${Math.ceil(secondsLeft / 3600)} hrs`}
          </p>
        </div>
      )}

      {/* Warning Overlay Warning Modal display popup */}
      {showWarning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-slate-900 border border-red-500/20 max-w-sm w-full p-6 rounded-3xl space-y-5 shadow-2xl relative overflow-hidden">
            {/* Field Boundary design glow */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
            
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-red-500/15 border border-red-500/25 text-red-400 rounded-2xl animate-pulse">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-[10px] uppercase font-bold text-red-500 tracking-wider font-mono">
                  Active Account Security Action
                </span>
                <h3 className="text-sm font-extrabold tracking-tight text-slate-100 uppercase">
                  Session Expiration Warning
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-450 leading-relaxed">
              Your active predicting session is about to expire because of security time-to-live restrictions. Unsaved changes or predict queries may be interrupted to protect your workspace parameters.
            </p>

            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Lockout Timeout In:</span>
              <span className="text-lg font-black font-mono text-red-400 tracking-widest animate-pulse flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-red-500" />
                {formatTime(secondsLeft)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  onLogOut();
                }}
                className="py-3 px-4 bg-slate-950 hover:bg-slate-850 text-slate-400 border border-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 hover:text-slate-200 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                Sign Out Now
              </button>
              
              <button
                onClick={handleExtendSession}
                disabled={isRefreshing}
                className="py-3 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-550/10 active:scale-98 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-950 ${isRefreshing ? 'animate-spin' : ''}`} />
                Extend Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
