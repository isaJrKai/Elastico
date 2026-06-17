import React, { useState, useEffect, useRef } from "react";
import { 
  AlertCircle, Newspaper, Flame, Radio, Volume2, VolumeX, Bookmark, 
  Share2, Play, Pause, RotateCcw, TrendingUp, CloudRain, 
  Thermometer, Wind, Video, MapPin, Eye, Copy, ChevronUp, ChevronDown, 
  Type, Activity, CheckCircle, Ticket, Compass, Plus, Trash2, Heart, Award,
  Sparkles, Globe, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Match } from "../types";


interface StadiumNewsTickerProps {
  user: User;
  selectedMatch: Match | null;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: "Local" | "Global" | "Transfer" | "Tactics";
  time: string;
  thumbnail: string;
  url?: string;
  summarized_headline?: string;
  reactions: {
    bravo: number;
    shock: number;
    genius: number;
    ole: number;
    class: number;
  };
}

export default function StadiumNewsTicker({ user, selectedMatch }: StadiumNewsTickerProps) {
  // States
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2 | 5>(1); // simulation speed dial multiplier
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [savedNews, setSavedNews] = useState<NewsItem[]>(() => {
    try {
      const saved = localStorage.getItem("kickiq_saved_news");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<"news" | "highlights" | "weather" | "seating" | "camera">("news");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [textSizeScale, setTextSizeScale] = useState<"sm" | "base" | "lg">("base");
  const [activeReactions, setActiveReactions] = useState<Record<string, string>>({}); // for triggering reaction bubbles
  const [summariesCache, setSummariesCache] = useState<Record<string, string>>({});
  const [loadingSummaries, setLoadingSummaries] = useState<Record<string, boolean>>({});

  // AI-powered summarize all ticker items & translation states
  const [isGroupSummaryOpen, setIsGroupSummaryOpen] = useState(false);
  const [groupSummaryText, setGroupSummaryText] = useState("");
  const [isLoadingGroupSummary, setIsLoadingGroupSummary] = useState(false);
  const [targetLang, setTargetLang] = useState<string>("en");
  const [translationCache, setTranslationCache] = useState<Record<string, { title: string; summary: string }>>({});
  const [isTranslating, setIsTranslating] = useState<boolean>(false);


  // Virtual seating states
  const [gateId, setGateId] = useState("Gate C");
  const [rowId, setRowId] = useState("12");
  const [seatId, setSeatId] = useState("24");
  const [isPassGenerated, setIsPassGenerated] = useState(false);

  // Weather States
  const [temp, setTemp] = useState(24);
  const [rainProb, setRainProb] = useState(15);
  const [windSpeed, setWindSpeed] = useState(12);
  const [fieldFriction, setFieldFriction] = useState(0.85);

  // Sound Synth Ref
  const audioContextRef = useRef<AudioContext | null>(null);

  // Beep sound generator for alerts (Professional auditory signal)
  const playAlertSound = (type: "new" | "click" | "reaction") => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "new") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "reaction") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn("Audio Context init blocked by browser policies", e);
    }
  };

  // Fetch match occurrences on mount / selection
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch("/matches/stadium-news/articles");
        const data = await res.json();
        if (data && data.events) {
          const initialNews: NewsItem[] = data.events.map((ev: any) => ({
            ...ev,
            reactions: {
              bravo: Math.floor(Math.random() * 45) + 12,
              shock: Math.floor(Math.random() * 18) + 2,
              genius: Math.floor(Math.random() * 32) + 5,
              ole: Math.floor(Math.random() * 60) + 25,
              class: Math.floor(Math.random() * 28) + 8
            }
          }));
          setNews(initialNews);
        }
      } catch (err) {
        console.error("Failed to load stadium articles pool", err);
      }
    };
    fetchArticles();
  }, [selectedMatch]);

  // Escape key global listener for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsGroupSummaryOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  // Auto loop manager simulating real-time updates and 2 hour loop replays
  useEffect(() => {
    if (!isPlaying || news.length === 0) return;

    // Fast-pacing interval based on Speed Dilations (e.g., 6000ms divided by playback ratio)
    const intervalTime = 7000 / playbackSpeed;

    const timer = setInterval(() => {
      setCurrentIdx(prev => {
        const next = (prev + 1) % news.length;
        // When news loop finishes, shuffle and re-loop based on Reaction count!
        if (next === 0) {
          // Re-sort current pool by total reactions to show "Most Reacted" first on repeat!
          setNews(current => {
            const sortedByEngagement = [...current].sort((a, b) => {
              const scoreA = (a.reactions.bravo || 0) + (a.reactions.shock || 0) + (a.reactions.genius || 0) + (a.reactions.ole || 0) + (a.reactions.class || 0);
              const scoreB = (b.reactions.bravo || 0) + (b.reactions.shock || 0) + (b.reactions.genius || 0) + (b.reactions.ole || 0) + (b.reactions.class || 0);
              return scoreB - scoreA;
            });
            return sortedByEngagement;
          });
        }
        return next;
      });
      playAlertSound("click");
    }, intervalTime);

    // Weather fluctuations to make the environment "legit and dynamic"
    const weatherTimer = setInterval(() => {
      setTemp(t => Math.min(34, Math.max(16, t + (Math.random() > 0.5 ? 1 : -1))));
      setRainProb(r => Math.min(100, Math.max(0, r + Math.floor(Math.random() * 6 - 3))));
      setWindSpeed(w => Math.min(35, Math.max(2, w + Math.floor(Math.random() * 4 - 2))));
      setFieldFriction(f => Math.min(1.0, Math.max(0.6, parseFloat((f + (Math.random() * 0.04 - 0.02)).toFixed(2)))));
    }, 12000);

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, [isPlaying, news, currentIdx, playbackSpeed]);

  const activeNews = news[currentIdx] || null;

  // Active translation tracking effect
  useEffect(() => {
    if (activeNews && targetLang !== "en") {
      translateCurrentItem(activeNews, targetLang);
    }
  }, [currentIdx, targetLang, activeNews]);

  // Translate a news item to preferred target language
  const translateCurrentItem = async (item: NewsItem, langCode: string) => {
    if (langCode === "en") return;
    const cacheKey = `${item.id}-${langCode}`;
    if (translationCache[cacheKey]) return;

    setIsTranslating(true);
    try {
      const textToTranslate = `${item.summarized_headline || item.title} ||| ${item.summary}`;
      const langNames: Record<string, string> = {
        es: "Spanish",
        fr: "French",
        de: "German",
        it: "Italian",
        pt: "Portuguese",
        ja: "Japanese"
      };

      const res = await fetch("/matches/stadium-news/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate,
          targetLanguage: langNames[langCode] || "Spanish"
        })
      });
      const data = await res.json();
      if (res.ok && data.translatedText) {
        const parts = data.translatedText.split("|||");
        const translatedTitle = parts[0]?.trim() || item.title;
        const translatedSummary = parts[1]?.trim() || item.summary;

        setTranslationCache(prev => ({
          ...prev,
          [cacheKey]: {
            title: translatedTitle,
            summary: translatedSummary
          }
        }));
      }
    } catch (err) {
      console.error("Failed to translate ticker news item", err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLanguageChange = (langCode: string) => {
    setTargetLang(langCode);
    playAlertSound("click");
  };

  // Summarize all active articles with Gemini AI
  const handleOpenGroupSummary = async () => {
    setIsGroupSummaryOpen(true);
    setIsLoadingGroupSummary(true);
    setGroupSummaryText("");
    try {
      const articlesPayload = news.map(item => ({
        title: item.title,
        summary: item.summary
      }));

      const res = await fetch("/matches/stadium-news/summarize-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: articlesPayload })
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setGroupSummaryText(data.summary);
      } else {
        setGroupSummaryText("Failed to retrieve a comprehensive summary of news ticker articles. Please retry.");
      }
    } catch (err) {
      console.error("Group summary fetch failed", err);
      setGroupSummaryText("Failed to connect with KICKIQ AI summarization services.");
    } finally {
      setIsLoadingGroupSummary(false);
    }
  };


  // Track reaction bubble triggers
  const handleReaction = (type: "bravo" | "shock" | "genius" | "ole" | "class") => {
    if (!activeNews) return;
    
    // Increment reactions local state
    setNews(prev => {
      const copy = [...prev];
      if (copy[currentIdx]) {
        copy[currentIdx].reactions[type] += 1;
      }
      return copy;
    });

    // Trigger standard audit beeping frequency
    playAlertSound("reaction");

    // Spawn a temporary CSS floating bubble
    const reactionEmojis = { bravo: "🔥", shock: "🚨", genius: "💡", ole: "⚽", class: "👏" };
    const emoji = reactionEmojis[type];
    const triggerId = `${Date.now()}-${Math.random()}`;

    setActiveReactions(prev => ({ ...prev, [triggerId]: emoji }));
    setTimeout(() => {
      setActiveReactions(prev => {
        const copy = { ...prev };
        delete copy[triggerId];
        return copy;
      });
    }, 1400);
  };

  // Bookmark / Save feature (microfeature helper)
  const toggleBookmark = (item: NewsItem) => {
    setSavedNews(prev => {
      const isExist = prev.some(n => n.id === item.id);
      let updated;
      if (isExist) {
        updated = prev.filter(n => n.id !== item.id);
      } else {
        updated = [...prev, item];
      }
      localStorage.setItem("kickiq_saved_news", JSON.stringify(updated));
      return updated;
    });
    playAlertSound("click");
  };

  // Copy catchphrase summary to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    playAlertSound("click");
    alert("📢 STADIUM COMMUNICATOR: Copied catchy headline to dashboard clipboard!");
  };

  if (isCollapsed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center">
        <button
          onClick={() => { setIsCollapsed(false); playAlertSound("click"); }}
          className="flex items-center gap-2.5 px-5 py-2 bg-slate-950/90 backdrop-blur-md hover:bg-slate-900 border border-slate-800 rounded-2xl shadow-xl hover:border-emerald-500/40 transition-all duration-300 hover:scale-[1.02] cursor-pointer text-slate-350 hover:text-emerald-400 group"
          id="stadium-news-expand-btn"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <Radio className="w-3.5 h-3.5 text-red-500 group-hover:animate-pulse" />
          <span className="font-mono text-[9px] font-black uppercase tracking-widest">
            Stadium Ticker Minimized • Show Feed
          </span>
          <ChevronUp className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 font-bold transition-transform group-hover:-translate-y-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col items-center">
      
      {/* Floating bubble reactions portal */}
      <div className="absolute -top-16 pointer-events-none flex gap-1 z-50">
        <AnimatePresence>
          {Object.entries(activeReactions).map(([id, emoji]) => (
            <motion.div
              key={id}
              initial={{ y: 20, opacity: 0, scale: 0.5 }}
              animate={{ y: -80, opacity: 1, scale: 1.3 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="text-2xl font-sans font-bold bg-slate-900/90 py-1 px-2.5 rounded-full border border-emerald-500/20 shadow-lg shadow-emerald-500/5"
            >
              {emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Bar Wrapper */}
      <div className="w-full max-w-5xl bg-slate-950/85 backdrop-blur-2xl border-2 border-slate-900/90 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/20 transition-all duration-300">
        
        {/* UPPER STATUS DECK (Interactive switches) */}
        {!isCollapsed && (
          <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Left Nav Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => { setActiveTab("news"); playAlertSound("click"); }}
                className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-mono font-bold uppercase text-[9.5px] transition cursor-pointer ${
                  activeTab === "news" 
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Radio className={`w-3 h-3 ${isPlaying && activeTab === "news" ? "animate-pulse text-red-500" : ""}`} />
                Stadium News
              </button>

              <button
                onClick={() => { setActiveTab("highlights"); playAlertSound("click"); }}
                className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-mono font-bold uppercase text-[9.5px] transition cursor-pointer relative ${
                  activeTab === "highlights" 
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" 
                    : "text-slate-400 hover:text-slate-250"
                }`}
              >
                <Bookmark className="w-3 h-3" />
                Saves Ledger ({savedNews.length})
              </button>

              <button
                onClick={() => { setActiveTab("weather"); playAlertSound("click"); }}
                className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-mono font-bold uppercase text-[9.5px] transition cursor-pointer ${
                  activeTab === "weather" 
                    ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" 
                    : "text-slate-400 hover:text-slate-250"
                }`}
              >
                <CloudRain className="w-3 h-3" />
                Weather Engine
              </button>

              <button
                onClick={() => { setActiveTab("seating"); playAlertSound("click"); }}
                className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-mono font-bold uppercase text-[9.5px] transition cursor-pointer ${
                  activeTab === "seating" 
                    ? "bg-purple-500/10 text-purple-300 border border-purple-500/20" 
                    : "text-slate-400 hover:text-slate-250"
                }`}
              >
                <Ticket className="w-3 h-3" />
                Virtual Seat View
              </button>

              <button
                onClick={() => { setActiveTab("camera"); playAlertSound("click"); }}
                className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-mono font-bold uppercase text-[9.5px] transition cursor-pointer ${
                  activeTab === "camera" 
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" 
                    : "text-slate-400 hover:text-slate-250"
                }`}
              >
                <Video className="w-3 h-3" />
                Drone Camera HUD
              </button>

              <button
                onClick={handleOpenGroupSummary}
                className="flex items-center gap-1.5 py-1 px-3 rounded-lg font-mono font-extrabold uppercase text-[9.5px] transition cursor-pointer bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/5 hover:border-emerald-500/60"
                title="Instant Summarization of all news articles in the log"
              >
                <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                Summarize Ticker
              </button>
            </div>

            {/* Right Quick Controls */}
            <div className="flex items-center gap-2.5 ml-auto text-[8px] font-mono text-slate-500">
              
              {/* Auto-Translate Option Dropdown */}
              <div className="flex items-center bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded-md gap-1">
                <span className="text-slate-500 uppercase flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" /> Translate</span>
                <select 
                  value={targetLang} 
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer text-[8px]"
                >
                  <option value="en">Source (EN)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pt">Português</option>
                  <option value="ja">日本語</option>
                </select>
              </div>

              {/* Dynamic Font Controller */}
              <div className="flex items-center bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded-md gap-1">
                <span className="text-slate-500 uppercase flex items-center gap-0.5"><Type className="w-2.5 h-2.5" /> Scale</span>
                <button 
                  onClick={() => { setTextSizeScale("sm"); playAlertSound("click"); }}
                  className={`px-1 rounded ${textSizeScale === "sm" ? "bg-emerald-500/25 text-emerald-400 font-extrabold" : "hover:text-white"}`}
                >
                  S
                </button>
                <button 
                  onClick={() => { setTextSizeScale("base"); playAlertSound("click"); }}
                  className={`px-1 rounded ${textSizeScale === "base" ? "bg-emerald-500/25 text-emerald-400 font-extrabold" : "hover:text-white"}`}
                >
                  M
                </button>
                <button 
                  onClick={() => { setTextSizeScale("lg"); playAlertSound("click"); }}
                  className={`px-1 rounded ${textSizeScale === "lg" ? "bg-emerald-500/25 text-emerald-400 font-extrabold" : "hover:text-white"}`}
                >
                  L
                </button>
              </div>

              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(prev => !prev)}
                className={`p-1 rounded-md transition cursor-pointer ${
                  soundEnabled 
                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" 
                    : "bg-slate-900 text-slate-500 hover:text-slate-350 border border-slate-850"
                }`}
                title="Toggle Beeping Audio Feeds"
              >
                {soundEnabled ? <Volume2 className="w-3 h-3 animate-bounce" /> : <VolumeX className="w-3 h-3" />}
              </button>

              {/* Play / Pause Cycle slider */}
              <button
                onClick={() => { setIsPlaying(p => !p); playAlertSound("click"); }}
                className={`py-0.5 px-2 rounded-md font-bold uppercase min-w-[50px] cursor-pointer transition ${
                  isPlaying 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse"
                }`}
              >
                {isPlaying ? "📻 ON-AIR" : "⏸️ PLAY"}
              </button>

              {/* Simulation Speed Dilation dial */}
              <div className="flex items-center bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded-md gap-1">
                <span>Speed:</span>
                <select 
                  value={playbackSpeed} 
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value) as any)}
                  className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer text-[8px]"
                >
                  <option value={1}>1.0x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                  <option value={5}>5.0x</option>
                </select>
              </div>

              {/* Minimize/Collapse button */}
              <button
                onClick={() => { setIsCollapsed(true); playAlertSound("new"); }}
                className="p-1 px-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded-md transition cursor-pointer flex items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-wider"
                title="Minimize Stadium News Feed"
                id="stadium-news-minimize-btn"
              >
                <ChevronDown className="w-3 h-3 text-emerald-400" />
                <span>Minimize</span>
              </button>
            </div>
          </div>
        )}

        {/* TRAY BODY SHELF */}
        <div className="relative p-4 md:p-5 flex flex-col md:flex-row items-center gap-4.5 bg-gradient-to-b from-slate-950/50 to-slate-950/90 relative">
          
          {/* GLINT SHIMMER GRADIENT (Visual glow ring) */}
          <div className="absolute inset-px -z-10 rounded-[22px] bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent animate-pulse pointer-events-none" />

          {/* Render Active View Tab */}
          {activeTab === "news" && activeNews && (
            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Ticker Indicator tag */}
              <div className="flex items-start gap-4 flex-1">
                
                {/* Visual Thumbnail */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border-2 border-slate-900 relative bg-slate-900 hidden sm:block">
                  <img 
                    src={activeNews.thumbnail} 
                    alt="stadium_flash" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1 left-1 bg-red-600 rounded-full w-2 h-2 animate-ping" />
                </div>

                <div className="space-y-1.5 text-left flex-1">
                  
                  {/* Category badging */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[7px] font-black tracking-widest uppercase font-mono px-2 py-0.5 rounded ${
                      activeNews.category === "Tactics" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                      activeNews.category === "Transfer" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      activeNews.category === "Global" ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" :
                      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      🏟️ {activeNews.category} FEED
                    </span>
                    
                    <span className="text-[7.5px] font-mono font-bold text-slate-550 flex items-center gap-1 uppercase">
                      <Radio className="w-2.5 h-2.5 animate-pulse text-red-500" />
                      Live Streamed {activeNews.time}
                    </span>

                    {/* Crowd Tension status analyzer indicators */}
                    <span className="text-[7.5px] font-mono bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                      DECIBELS: {(100 + activeNews.reactions.ole % 25).toFixed(1)} dB
                    </span>
                  </div>

                  {/* Catchy translated headline and news text */}
                  <div className="min-h-[44px]">
                    {isTranslating ? (
                      <div className="flex items-center gap-2 py-1 text-slate-450 animate-pulse font-mono text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                        Translating headline and summary via Gemini AI...
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className={`font-semibold tracking-tight leading-snug text-slate-100 ${
                          textSizeScale === "sm" ? "text-xs" : 
                          textSizeScale === "lg" ? "text-base" : "text-sm"
                        }`}>
                          {translationCache[`${activeNews.id}-${targetLang}`]?.title || activeNews.summarized_headline || activeNews.title}
                        </p>
                        <p className="text-[9.5px] text-slate-450 font-sans leading-relaxed tracking-normal line-clamp-1">
                          {translationCache[`${activeNews.id}-${targetLang}`] 
                            ? `Translated: "${translationCache[`${activeNews.id}-${targetLang}`].summary}"`
                            : `Source content: "${activeNews.summary}"`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons deck (reactions & bookmarks) */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap py-2 border-t border-slate-900/40 md:border-t-0 md:py-0">
                
                {/* 5 Reaction buttons */}
                <div className="flex items-center bg-slate-950/80 border border-slate-900 p-1 rounded-2xl gap-1">
                  <button 
                    onClick={() => handleReaction("bravo")}
                    className="flex items-center gap-1 px-2.5 py-1 text-[8px] font-mono text-slate-400 hover:text-amber-400 hover:bg-amber-500/5 rounded-xl transition cursor-pointer"
                    title="Engage Hot Reaction"
                  >
                    <span>🔥</span>
                    <span className="font-extrabold">{activeNews.reactions.bravo}</span>
                  </button>

                  <button 
                    onClick={() => handleReaction("shock")}
                    className="flex items-center gap-1 px-2.5 py-1 text-[8px] font-mono text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition cursor-pointer"
                    title="Engage Shock Alert"
                  >
                    <span>🚨</span>
                    <span className="font-extrabold">{activeNews.reactions.shock}</span>
                  </button>

                  <button 
                    onClick={() => handleReaction("genius")}
                    className="flex items-center gap-1 px-2.5 py-1 text-[8px] font-mono text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/5 rounded-xl transition cursor-pointer"
                    title="Engage Genius Move"
                  >
                    <span>💡</span>
                    <span className="font-extrabold">{activeNews.reactions.genius}</span>
                  </button>

                  <button 
                    onClick={() => handleReaction("ole")}
                    className="flex items-center gap-1 px-2.5 py-1 text-[8px] font-mono text-slate-400 hover:text-blue-450 hover:bg-blue-500/5 rounded-xl transition cursor-pointer"
                    title="Chant Ole Ole"
                  >
                    <span>⚽</span>
                    <span className="font-extrabold">{activeNews.reactions.ole}</span>
                  </button>

                  <button 
                    onClick={() => handleReaction("class")}
                    className="flex items-center gap-1 px-2.5 py-1 text-[8px] font-mono text-slate-400 hover:text-purple-450 hover:bg-purple-500/5 rounded-xl transition cursor-pointer"
                    title="Express Pure Class"
                  >
                    <span>👏</span>
                    <span className="font-extrabold">{activeNews.reactions.class}</span>
                  </button>
                </div>

                {/* Additional Quick Utility Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyToClipboard(activeNews.summarized_headline || activeNews.title)}
                    className="p-1 px-2.5 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-850 text-slate-400 text-[9.5px] font-bold uppercase rounded-xl flex items-center gap-1 transition cursor-pointer"
                    title="Copy catchphrase line"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>

                  <button
                    onClick={() => toggleBookmark(activeNews)}
                    className={`p-1 px-2.5 rounded-xl border text-[9.5px] font-bold uppercase flex items-center gap-1 transition cursor-pointer ${
                      savedNews.some(n => n.id === activeNews.id)
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/35"
                        : "bg-slate-900 border-slate-850 text-slate-400 hover:bg-slate-850"
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* VIEW: HIGHLIGHT DRAW / SAVES LEDGER */}
          {activeTab === "highlights" && (
            <div className="w-full text-left font-mono">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2.5">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                  Your Bookmarked Stadium Alerts ({savedNews.length})
                </span>
                {savedNews.length > 0 && (
                  <button 
                    onClick={() => { setSavedNews([]); localStorage.removeItem("kickiq_saved_news"); playAlertSound("click"); }}
                    className="text-[8px] font-black text-rose-400 hover:text-rose-300 uppercase cursor-pointer flex items-center gap-1 border border-rose-500/15 py-0.5 px-2 rounded bg-rose-500/5 transition"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Clear All Ledger
                  </button>
                )}
              </div>

              {savedNews.length === 0 ? (
                <div className="p-4 bg-slate-900/25 border border-dashed border-slate-850 rounded-2xl text-center">
                  <p className="text-[9.5px] text-slate-500">
                    Saves ledger ledger empty. Hover or expand standard stadium news reports and click "Save" to populate this slot.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {savedNews.map(item => (
                    <div key={item.id} className="p-2 bg-slate-950/65 border border-slate-900 rounded-xl flex items-start gap-2.5 justify-between">
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-[7.5px] text-slate-500 font-extrabold uppercase">{item.category} REPORT • {item.time}</span>
                        <p className="text-[10px] text-slate-200 font-sans leading-tight font-semibold truncate hover:text-white transition">
                          {item.summarized_headline || item.title}
                        </p>
                        <p className="text-[8px] text-slate-450 line-clamp-1">{item.summary}</p>
                      </div>
                      <button 
                        onClick={() => toggleBookmark(item)}
                        className="text-slate-500 hover:text-rose-450 p-1 cursor-pointer shrink-0 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: DYNAMIC WEATHER ENGINE */}
          {activeTab === "weather" && (
            <div className="w-full text-left font-mono">
              <div className="border-b border-slate-900 pb-2 mb-3.5 flex items-center gap-1.5 justify-between">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <CloudRain className="w-3.5 h-[14px] text-blue-500" />
                  Venue Weather & Atmospheric Friction Modifiers
                </span>
                <span className="text-[7.5px] font-extrabold uppercase bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                  🛰️ Direct Satellite Link Live
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/40 p-2 border border-slate-900 rounded-2xl flex items-center gap-2.5">
                  <Thermometer className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="block text-[7.5px] text-slate-500 font-black uppercase">Air Temp</span>
                    <span className="text-sm font-bold text-slate-200">{temp}°C</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-2 border border-slate-900 rounded-2xl flex items-center gap-2.5">
                  <CloudRain className="w-5 h-5 text-blue-400 shrink-0" />
                  <div>
                    <span className="block text-[7.5px] text-slate-500 font-black uppercase">Humidity</span>
                    <span className="text-sm font-bold text-blue-300">{rainProb}%</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-2 border border-slate-900 rounded-2xl flex items-center gap-2.5">
                  <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div>
                    <span className="block text-[7.5px] text-slate-500 font-black uppercase">Wind Velocity</span>
                    <span className="text-sm font-bold text-cyan-300">{windSpeed} km/h</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-2 border border-slate-900 rounded-2xl flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-emerald-400 shrink-0 animate-pulse" />
                  <div>
                    <span className="block text-[7.5px] text-slate-500 font-black uppercase">Turf Friction</span>
                    <span className="text-sm font-bold text-emerald-400">{fieldFriction} Coef</span>
                  </div>
                </div>
              </div>

              <p className="text-[8px] text-slate-500 uppercase mt-2.5 text-center leading-relaxed">
                🔔 TACTICAL ADVISORY: Turf sliding drag index currently locked at {fieldFriction}. 
                High wind shears from Northeast could tilt corner kick trajectory by up to {(windSpeed * 0.12).toFixed(2)} degrees.
              </p>
            </div>
          )}

          {/* VIEW: VIRTUAL SEATING RADIAL PLOTS */}
          {activeTab === "seating" && (
            <div className="w-full text-left font-mono">
              <div className="border-b border-slate-900 pb-2 mb-3.5 flex items-center justify-between">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5 text-purple-500" />
                  Dynamic Seating Sightline projection Coordinates
                </span>
                <span className="text-[7.5px] text-purple-400 font-extrabold uppercase">
                  🏟️ Stadium Deck: East Canopy Block B
                </span>
              </div>

              {!isPassGenerated ? (
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <p className="text-[9.5px] text-slate-400 leading-relaxed max-w-lg font-sans">
                    By plotting your seat coordinates below, KICKIQ will calculate your virtual field perspectives. Generate a customized <strong>FIFA World Cup 2026 digital stadium pass</strong> with exact physical coordinate vectors mapped securely.
                  </p>
                  
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <input 
                      type="text" 
                      value={gateId} 
                      onChange={(e) => setGateId(e.target.value)}
                      placeholder="Gate" 
                      className="w-18 px-2 py-1 bg-slate-900 border border-slate-850 rounded text-[9.5px] font-bold text-slate-205 py-1.5 text-center focus:outline-none focus:border-purple-500"
                    />
                    <input 
                      type="text" 
                      value={rowId} 
                      onChange={(e) => setRowId(e.target.value)}
                      placeholder="Row" 
                      className="w-12 px-2 py-1 bg-slate-900 border border-slate-850 rounded text-[9.5px] font-bold text-slate-205 py-1.5 text-center focus:outline-none focus:border-purple-500"
                    />
                    <input 
                      type="text" 
                      value={seatId} 
                      onChange={(e) => setSeatId(e.target.value)}
                      placeholder="Seat" 
                      className="w-12 px-2 py-1 bg-slate-900 border border-slate-850 rounded text-[9.5px] font-bold text-slate-205 py-1.5 text-center focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={() => { setIsPassGenerated(true); playAlertSound("new"); }}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-[9.5px] uppercase tracking-wider rounded transition cursor-pointer"
                    >
                      🎟️ Map Seat Pass
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 border border-purple-500/20 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                      <Ticket className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-purple-400 uppercase tracking-widest">Digital Match Ticket Ready</span>
                      <span className="block text-xs font-black text-slate-100 uppercase tracking-wide mt-0.5">
                        KICKIQ Arena Seat View Point
                      </span>
                      <span className="block text-[8.5px] text-slate-400 uppercase mt-1">
                        Loc: <strong className="text-slate-100">{gateId}</strong> • Row <strong className="text-slate-100">{rowId}</strong> • Seat <strong className="text-slate-100">{seatId}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(`Match Pass Coordinate Vector: Block ${gateId}, Row ${rowId}, Seat ${seatId} via KickIQ`)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[8px] font-extrabold uppercase rounded transition cursor-pointer"
                    >
                      Copy Coordinates
                    </button>
                    <button
                      onClick={() => { setIsPassGenerated(false); playAlertSound("click"); }}
                      className="px-2.5 py-1 bg-purple-650/40 hover:bg-purple-550 border border-purple-500/35 text-[8px] font-extrabold uppercase rounded transition cursor-pointer text-purple-200"
                    >
                      ✏️ Edit Seat View
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: DRONE PERSPECTIVE SCANNER HUD */}
          {activeTab === "camera" && (
            <div className="w-full text-left font-mono relative">
              <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[7.5px] font-black uppercase text-red-400">RCAM STREAM</span>
              </div>
              
              <div className="border-b border-slate-900 pb-2 mb-3.5">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-cyan-500" />
                  Tactical Aerial Scouting Drone Overlay
                </span>
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                <div className="space-y-1">
                  <div className="text-[9px] text-cyan-400 font-extrabold uppercase flex items-center gap-1">
                    <Compass className="w-3 h-3 animate-spin duration-3000" /> Auto-Track Target Mode Active
                  </div>
                  <p className="text-[9px] text-slate-450 leading-relaxed font-sans mt-1">
                    Sensors tracking ELO distribution levels on physical match lines. Current horizontal pitch coverage angle is locked at <strong>82.4°</strong> on 2X Zoom.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playAlertSound("new")}
                    className="px-3 py-1.5 bg-cyan-950 text-cyan-400 hover:bg-cyan-900 hover:text-white border border-cyan-500/15 text-[8.5px] uppercase font-bold tracking-wider rounded-xl transition cursor-pointer"
                  >
                    🎥 Lock Focal Coordinates
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* GROUP SUMMARY AI MODAL */}
      <AnimatePresence>
        {isGroupSummaryOpen && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-slate-905 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl relative text-left"
            >
              <button
                onClick={() => { setIsGroupSummaryOpen(false); playAlertSound("click"); }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-black font-mono tracking-wider text-slate-100 uppercase">
                  AI Ticker News Summary
                </h3>
              </div>

              <div className="border border-slate-800/60 bg-slate-950/90 rounded-2xl p-4 min-h-[160px] max-h-[350px] overflow-y-auto text-xs text-slate-300 font-sans leading-relaxed space-y-2">
                {isLoadingGroupSummary ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 space-y-3">
                    <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                    <p className="font-mono text-[10px] text-emerald-400/90 tracking-widest uppercase animate-pulse">
                      Synthesizing active news items with Gemini...
                    </p>
                  </div>
                ) : (
                  <div className="whitespace-pre-line max-w-none">
                    {groupSummaryText}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">ESC</kbd> to close</span>
                <button
                  onClick={() => { setIsGroupSummaryOpen(false); playAlertSound("click"); }}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-extrabold text-[#000] rounded-xl text-xs transition cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
