import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Cpu, Trash2, HelpCircle, TrendingUp, ChevronRight, X, Layout } from "lucide-react";
import { ChatMessage } from "../types";

interface ChatPanelProps {
  matchId?: number;
  authToken: string;
  onCollapse?: () => void;
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

export default function ChatPanel({
  matchId,
  authToken,
  onCollapse,
  externalPrompt,
  onClearExternalPrompt
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "assistant",
      content: "Awaiting match selection... Select any fixture on the deck, and I will parse its ELO profiles, Dixon-Coles expected goals, and run live Monte Carlo projections for you!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus and trigger greeting adjust on matchId shift
  useEffect(() => {
    if (matchId) {
      setMessages([
        {
          id: "match-ready",
          role: "assistant",
          content: `Match context initialized! Ask me about favorite win expectancies, projected correct score frequencies, Wilson 95% boundaries, or custom tactical matchups. I will parse the Poisson Dixon-Coles model live!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [matchId]);

  // Effect to handle incoming external prompt instructions
  useEffect(() => {
    if (externalPrompt) {
      submitQuery(externalPrompt);
      if (onClearExternalPrompt) {
        onClearExternalPrompt();
      }
    }
  }, [externalPrompt]);

  // Handle auto scrolling
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleClearHistory = () => {
    setMessages([
      {
        id: "cleared",
        role: "assistant",
        content: "Dialogue history flushed. Let's run a brand new predictive analysis!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const [trendInput, setTrendInput] = useState("");
  const [showTrendsBox, setShowTrendsBox] = useState(false);

  const handleQuickQuestion = (qn: string) => {
    setInput(qn);
  };

  const submitQuery = async (userText: string) => {
    if (!userText || typing) return;

    const newMsg: ChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setTyping(true);

    try {
      // Map previous 8 messages for memory context matching
      const historyPayload = messages
        .filter((m) => m.id !== "init" && m.id !== "match-ready")
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          matchId,
          message: userText,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Commentary engine error.");

      setMessages((prev) => [
        ...prev,
        {
          id: "ai-" + Date.now(),
          role: "assistant",
          content: data.message,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: `Connection issue: ${err.message}. Please verify your Gemini API key inside the Secrets panel.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || typing) return;
    const userText = input.trim();
    setInput("");
    await submitQuery(userText);
  };

  const handleAnalyzeTrendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trendInput.trim() || typing) return;
    const userText = `Analyze this specific game trend under KICKIQ's Poisson predictive model: "${trendInput.trim()}". Explain potential tactical momentum shifts, formation changes, and expected score variance deviations.`;
    setTrendInput("");
    await submitQuery(userText);
  };

  // Simple clean local parser formatting bold text and bullets nicely
  const formatCommentaryText = (txt: string) => {
    const lines = txt.split("\n");
    return lines.map((line, lIdx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={lIdx} className="h-2" />;

      // Match lists
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const payloadText = trimmed.substring(1).trim();
        return (
          <li key={lIdx} className="ml-4 list-disc text-slate-300 text-xs leading-relaxed mb-1">
            {parseBoldText(payloadText)}
          </li>
        );
      }

      // Match headings
      if (trimmed.startsWith("###")) {
        return (
          <h4 key={lIdx} className="text-sm font-bold text-emerald-400 mt-2 mb-1.5 font-sans">
            {trimmed.replace("###", "").trim()}
          </h4>
        );
      }

      return (
        <p key={lIdx} className="text-xs leading-relaxed text-slate-300 mb-1.5">
          {parseBoldText(trimmed)}
        </p>
      );
    });
  };

  const parseBoldText = (str: string) => {
    const parts = str.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, pIdx) => {
      if (pIdx % 2 === 1) {
        return <strong key={pIdx} className="font-bold text-emerald-300 font-mono">{part}</strong>;
      }
      return part;
    });
  };

  // Pre-configured questions
  const SUGGESTED_PROMPTS = [
    "Who is the favorite to win?",
    "Show Expected Goals (xG) analysis",
    "Explain the Dixon-Coles model correction",
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg relative">
      
      {/* Header Panel */}
      <div className="p-4 bg-slate-800/50 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Cpu className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-100 tracking-tight leading-none flex items-center gap-1.5">
              KickIQ AI Analyst
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-bold text-emerald-400 uppercase tracking-widest font-mono scale-90">
                ACTIVE
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">FIFA World Cup 2026 intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            title="Clear dialog logs"
            className="p-2 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800/80 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {onCollapse && (
            <button
              onClick={onCollapse}
              title="Collapse AI Panel"
              className="p-2 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-slate-800/80 transition cursor-pointer flex items-center justify-center"
            >
              <Layout className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Match Trend Analyzer Accordion panel */}
      {matchId && (
        <div className="bg-slate-950/65 border-b border-slate-850 p-3.5 space-y-2" id="game-trend-analyzer-panel">
          <button 
            type="button"
            onClick={() => setShowTrendsBox(!showTrendsBox)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-slate-300 hover:text-emerald-400 transition focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="uppercase tracking-wider font-mono text-slate-200">Live Game Trend Analyzer</span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">
              {showTrendsBox ? "[ HIDE ]" : "[ SHOW ]"}
            </span>
          </button>
          
          {showTrendsBox && (
            <form onSubmit={handleAnalyzeTrendSubmit} className="space-y-2.5 pt-1.5 animate-in fade-in duration-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 4-4-2 low-block fatigue, midfielder pressing shift"
                  value={trendInput}
                  onChange={(e) => setTrendInput(e.target.value)}
                  disabled={typing}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 px-3 py-2 rounded-lg text-[10px] text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-45"
                />
                <button
                  type="submit"
                  disabled={!trendInput.trim() || typing}
                  className="px-3 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-mono font-black text-[9px] uppercase tracking-wide rounded-lg transition disabled:opacity-40"
                >
                  Analyze
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  "High defensive line pressing",
                  "Late game stamina depletion",
                  "Wing play overload tactical shift"
                ].map((s, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setTrendInput(s)}
                    className="text-[8px] font-mono text-slate-500 bg-slate-900 hover:bg-slate-800 hover:text-emerald-400 border border-slate-850 px-2 py-0.5 rounded transition"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </form>
          )}
        </div>
      )}

      {/* Chat scrollbox */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} fade-in`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3.5 shadow-md flex flex-col ${
                m.role === "user"
                  ? "bg-slate-820 border border-slate-750 text-slate-100 rounded-tr-none"
                  : "bg-slate-950/50 border border-slate-850/60 rounded-tl-none text-slate-200"
              }`}
            >
              {m.role === "assistant" && (
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-400 font-bold mb-1.5 font-mono">
                  <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                  Football Intel Engine
                </div>
              )}
              
              <div className="space-y-0.5">
                {formatCommentaryText(m.content)}
              </div>

              <span className="text-[9px] text-slate-500/85 self-end mt-1.5 font-mono">
                {m.timestamp}
              </span>
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-slate-950/30 border border-slate-850/40 rounded-2xl rounded-tl-none px-4 py-3 text-slate-400">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-emerald-500 font-mono font-bold mb-1">
                <Sparkles className="w-3 h-3 animate-spin text-emerald-400" />
                Crunching Poisson Simulations...
              </div>
              <div className="flex gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggested chips if match is loaded */}
      {matchId && (
        <div className="px-4 py-2 border-t border-slate-850 bg-slate-950/20 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleQuickQuestion(prompt)}
              className="text-[10px] font-semibold text-slate-400 bg-slate-850 hover:bg-slate-800 hover:text-emerald-400 border border-slate-750 px-2 py-1 rounded-md transition cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Enter Chat box */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-850 flex gap-2">
        <input
          type="text"
          placeholder={matchId ? "Ask the KickIQ Intel analyst..." : "Ask general World Cup questions..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={typing}
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 px-4 py-3 rounded-xl text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="w-11 h-11 bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center justify-center hover:bg-emerald-400 transition cursor-pointer shadow disabled:opacity-40"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
      
    </div>
  );
}
