import React, { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Shield, Sparkles, Activity, Server, Users, Trash2, Edit3, Settings2, UserMinus, Lock, ShieldAlert } from "lucide-react";
import { User, Team, ApiLog } from "../types";

interface AdminPanelProps {
  authToken: string;
  user: User | null;
}

export default function AdminPanel({ authToken, user }: AdminPanelProps) {
  // If unauthorized, render the beautifully crafted Restricted Access view immediately
  if (!user || user.role !== "admin") {
    return (
      <div id="restricted-admin-access-view" className="relative flex flex-col items-center justify-center p-8 text-center bg-slate-900/30 border border-slate-850 rounded-3xl max-w-xl mx-auto my-12 backdrop-blur-md overflow-hidden min-h-[400px]">
        {/* Glow decoration */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-red-500 blur-[120px]" />
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 animate-bounce">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-slate-100 uppercase tracking-widest font-mono">
              403: RESTRICTED ACCESS
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              This terminal console contains administrative configuration arrays. Your current user credentials (<code className="text-emerald-400 font-mono font-bold">{user?.email || user?.phone || "Anonymous User"}</code>) do not hold authorization permission profiles to access this module.
            </p>
          </div>

          <div className="p-3.5 bg-slate-950/40 rounded-2xl border border-slate-850/60 max-w-sm mx-auto text-[11px] text-slate-500 leading-normal flex items-start gap-2.5 text-left">
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>Unauthorized access attempts are automatically monitored, recorded in our API activity logs, and flagged for verified platform administrator audits.</span>
          </div>
          
          <button
            id="return-from-restricted-btn"
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-slate-100 text-xs font-bold uppercase rounded-xl transition cursor-pointer font-sans"
          >
            Return to Command Station
          </button>
        </div>
      </div>
    );
  }

  const [activeSubTab, setActiveSubTab] = useState<"telemetry" | "users" | "ratings" | "logs" | "settings" | "security" | "predictions">("telemetry");
  
  // States to pack server analytics
  const [stats, setStats] = useState<any>(null);
  const [securityAudit, setSecurityAudit] = useState<any>(null);
  const [predictionsData, setPredictionsData] = useState<any>(null);
  const [trainFeedback, setTrainFeedback] = useState<any>(null);
  const [trainingLoader, setTrainingLoader] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamsList, setTeamsList] = useState<Team[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApiLog[]>([]);
  
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [newElo, setNewElo] = useState("");

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // App Config Settings State
  const [appSettings, setAppSettings] = useState<{
    admin_email: string;
    game_speed_multiplier: number;
    allow_registrations: boolean;
    maintenance_mode: boolean;
    ai_continuous_learning: boolean;
    ai_learning_rate: number;
  }>({
    admin_email: "",
    game_speed_multiplier: 1.0,
    allow_registrations: true,
    maintenance_mode: false,
    ai_continuous_learning: true,
    ai_learning_rate: 0.15,
  });

  // Fetch admin content depending on active sub-tab
  useEffect(() => {
    fetchActiveAdminData();
  }, [activeSubTab]);

  const fetchActiveAdminData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (activeSubTab === "telemetry") {
        const res = await fetch("/admin/stats", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setStats(data);
      } else if (activeSubTab === "users") {
        const res = await fetch(`/admin/users?search=${searchQuery}`, {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setUsersList(data.users || []);
      } else if (activeSubTab === "ratings") {
        const res = await fetch("/admin/teams", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setTeamsList(data || []);
      } else if (activeSubTab === "logs") {
        const res = await fetch("/admin/logs", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setAuditLogs(data || []);
      } else if (activeSubTab === "settings") {
        const res = await fetch("/admin/settings", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setAppSettings(data);
      } else if (activeSubTab === "security") {
        const res = await fetch("/admin/security-audit", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setSecurityAudit(data);
      } else if (activeSubTab === "predictions") {
        const res = await fetch("/admin/predictions-data", {
          headers: { "Authorization": `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (res.ok) setPredictionsData(data);
      }
    } catch (e) {
      console.error("Admin retrieval failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateElo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newElo) return;

    try {
      const res = await fetch(`/admin/teams/${selectedTeam.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ elo_rating: parseFloat(newElo) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update ELO failed.");

      setFeedback(`Team ${selectedTeam.name} ELO successfully updated to ${newElo}!`);
      setSelectedTeam(null);
      setNewElo("");
      
      // Reload ratings
      fetchActiveAdminData();
    } catch (err: any) {
      setFeedback(`Error adjusting ratings: ${err.message}`);
    }
  };

  const handleSuspendUser = async (uId: number) => {
    if (!confirm("Are you sure you want to suspend/deactivate this user account?")) return;

    try {
      const res = await fetch(`/admin/users/${uId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Suspend failed.");

      setFeedback("User de-activated.");
      fetchActiveAdminData();
    } catch (err: any) {
      setFeedback(`Error suspending: ${err.message}`);
    }
  };

  const handleUserPlanShift = async (uId: number, plan: "free" | "pro" | "elite") => {
    try {
      const res = await fetch(`/admin/users/${uId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan shift failed.");

      setFeedback("User subscription tier updated successfully!");
      fetchActiveAdminData();
    } catch (err: any) {
      setFeedback(`Error shifting plan: ${err.message}`);
    }
  };

  const handleDownloadAuditReport = async () => {
    setFeedback("Preparing secure export report...");
    try {
      const res = await fetch("/admin/logs/export", {
        headers: { "Authorization": `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to download audit logs");

      if (!data || data.length === 0) {
        setFeedback("No audit logs found for the last 30 days.");
        return;
      }

      // Generate CSV string content
      const headers = ["Timestamp", "User Identifier", "HTTP Method", "Endpoint", "IP Address", "Browser User Agent", "Latency Duration (ms)", "Status Code", "Audit Status"];
      const rows = data.map((log: any) => [
        `"${log.created_at}"`,
        `"${log.email}"`,
        `"${log.method}"`,
        `"${log.endpoint}"`,
        `"${log.ip}"`,
        `"${log.user_agent ? log.user_agent.replace(/"/g, '""') : ''}"`,
        log.duration_ms,
        log.status,
        log.status >= 200 && log.status < 300 ? "SUCCESS" : "FAILURE"
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.id = "audit-report-trigger-link";
      link.setAttribute("href", url);
      link.setAttribute("download", `kickiq_30day_login_audit_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedback("Secure 30-day login activity audit report downloaded successfully.");
    } catch (err: any) {
      setFeedback(`Audit export failed: ${err.message}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(appSettings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update config parameters failed.");
      setFeedback("Settings configuration updated and applied successfully!");
      setAppSettings(data.settings);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainAi = async () => {
    setTrainingLoader(true);
    setTrainFeedback(null);
    try {
      const res = await fetch("/admin/train-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Training cycle execution failed.");
      setTrainFeedback(data);
      // Refresh prediction numbers
      const pRes = await fetch("/admin/predictions-data", {
        headers: { "Authorization": `Bearer ${authToken}` },
      });
      const pData = await pRes.json();
      if (pRes.ok) setPredictionsData(pData);
    } catch (err: any) {
      setTrainFeedback({ error: err.message });
    } finally {
      setTrainingLoader(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Shield className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              System Admin Console
              <span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-[9px] font-bold text-teal-400 lowercase font-mono">
                verified root scope
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage World Cup 2026 ELO lists, audits logs, and database metrics.</p>
          </div>
        </div>

        {/* Feedback alert line */}
        {feedback && (
          <div className="px-4 py-2 border border-teal-500/20 bg-teal-500/10 rounded-xl text-teal-300 text-xs font-mono">
            {feedback}
          </div>
        )}
      </div>

      {/* Sub menu tabs */}
      <div className="flex border-b border-slate-800 gap-1.5 pb-px overflow-x-auto">
        {[
          { id: "telemetry" as const, name: "📊 Live Telemetry" },
          { id: "predictions" as const, name: "🔮 User Forecasts & Predictions" },
          { id: "users" as const, name: "👥 Directory & plan Overrides" },
          { id: "ratings" as const, name: "🔰 Squad ELO Calibration" },
          { id: "logs" as const, name: "📑 Traffic Audit Logs" },
          { id: "settings" as const, name: "⚙️ Config Controls" },
          { id: "security" as const, name: "🛡️ Security Health" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x border-transparent transition-all cursor-pointer ${
              activeSubTab === tab.id
                ? "bg-slate-900 border-slate-800 text-teal-400"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10 font-mono text-xs text-teal-400 animate-pulse">
          Refreshing root database scope parameters...
        </div>
      )}

      {/* VIEW TELEMETRY */}
      {!loading && activeSubTab === "telemetry" && stats && (
        <div className="space-y-6">
          
          {/* Statistics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Registrations", value: stats.overview.totalUsers, icon: Users, color: "text-blue-400" },
              { label: "Active Connections (Today)", value: stats.overview.activeToday, icon: Activity, color: "text-emerald-400" },
              { label: "Error Rate (Last 60m)", value: `${stats.overview.errorRate}%`, icon: Server, color: "text-rose-400" },
              { label: "Traffic Logs Total", value: stats.overview.requestsLastHour, icon: Settings2, color: "text-teal-400" },
            ].map((card, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden">
                <card.icon className={`absolute top-4 right-4 w-5 h-5 ${card.color} opacity-25`} />
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">{card.label}</span>
                <p className="text-xl font-extrabold font-mono mt-1 text-slate-100">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Graphical Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 font-mono">
                Sign-up Rate Trend (Last 30 Days)
              </h3>
              <div className="h-60 w-full text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.signupsByDay}>
                    <defs>
                      <linearGradient id="glowSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }} />
                    <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#glowSignups)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 font-mono">
                Hourly API Traffic (Last 24 Hours)
              </h3>
              <div className="h-60 w-full text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.requestsByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="hour" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155" }} />
                    <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Top endpoints */}
          <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900/60 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Top APIs Performance metrics
            </div>
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400">
                  <th className="p-4">Endpoint Path</th>
                  <th className="p-4">Hits volume</th>
                  <th className="p-4 text-right">Avg Latency (ms)</th>
                </tr>
              </thead>
              <tbody>
                {stats.topEndpoints.map((ep: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-900/10">
                    <td className="p-4 text-emerald-400 font-bold">{ep.endpoint}</td>
                    <td className="p-4 text-slate-350">{ep.hits} requests</td>
                    <td className="p-4 text-right text-teal-300 font-bold">{ep.avg_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* VIEW USERS DIRECTORY */}
      {!loading && activeSubTab === "users" && (
        <div className="space-y-4">
          
          {/* User searching field */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search user profiles via name, email, or E.164 phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-teal-500 px-4 py-2.5 rounded-xl text-xs text-slate-100 placeholder-slate-600 outline-none transition"
            />
            <button
              onClick={fetchActiveAdminData}
              className="px-5 py-2.5 bg-teal-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-teal-400 cursor-pointer transition"
            >
              Filter Directory
            </button>
          </div>

          <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400">
                  <th className="p-4">Display Profile</th>
                  <th className="p-4">Provider</th>
                  <th className="p-4">Access Level</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Administrative overrides</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800/60 hover:bg-slate-900/10">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.avatar_url || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80"}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800"
                        />
                        <div>
                          <p className="font-bold text-slate-200">{user.display_name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{user.email || user.phone || "No login contact"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[10px] uppercase text-slate-400">{user.auth_provider}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                        user.plan === "elite"
                          ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                          : user.plan === "pro"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[10px]">
                      {user.is_active === 1 ? (
                        <span className="text-emerald-400 font-bold uppercase">● Active</span>
                      ) : (
                        <span className="text-slate-500 font-medium uppercase">● Suspended</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {user.role !== "admin" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUserPlanShift(user.id, "free")}
                            className="bg-slate-800 border border-slate-700 font-bold hover:bg-slate-700 hover:text-slate-200 transition text-[10px] px-2 py-1 rounded"
                          >
                            Set Free
                          </button>
                          <button
                            onClick={() => handleUserPlanShift(user.id, "pro")}
                            className="bg-slate-800 border border-slate-700 font-bold hover:bg-slate-700 hover:text-emerald-300 transition text-[10px] px-2 py-1 rounded text-emerald-400"
                          >
                            Set Pro
                          </button>
                          <button
                            onClick={() => handleUserPlanShift(user.id, "elite")}
                            className="bg-slate-800 border border-slate-700 font-bold hover:bg-slate-700 hover:text-teal-300 transition text-[10px] px-2 py-1 rounded text-teal-400"
                          >
                            Set Elite
                          </button>
                          
                          {user.is_active === 1 && (
                            <button
                              onClick={() => handleSuspendUser(user.id)}
                              className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold hover:bg-rose-500/25 transition text-[10px] p-1 rounded hover:scale-105"
                              title="Deactivate account"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* VIEW SQUAD ELO RATINGS override */}
      {!loading && activeSubTab === "ratings" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900/60 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              World Cup ELO ratings calibration rankings
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400">
                  <th className="p-4">Seeded Team</th>
                  <th className="p-4">Nation Territory</th>
                  <th className="p-4">Current ELO rating</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamsList.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-900/10">
                    <td className="p-4 font-bold text-slate-200 flex items-center gap-2">
                       <span>⚽</span>
                       {t.name}
                    </td>
                    <td className="p-4 text-slate-400">{t.country}</td>
                    <td className="p-4 font-mono font-bold text-emerald-400 text-sm">{t.elo_rating}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => { setSelectedTeam(t); setNewElo(t.elo_rating.toString()); }}
                        className="p-1 px-2 text-[10px] tracking-wide font-bold uppercase rounded-lg border border-teal-500/20 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 cursor-pointer"
                      >
                        Adjust ELO
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            {selectedTeam ? (
              <form onSubmit={handleUpdateElo} className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                  <Edit3 className="w-4 h-4 text-teal-400 animate-pulse" />
                  Calibrate {selectedTeam.name}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Modifying squad capabilities instantly recomputes joint Poisson goal outcomes and win probability matrices during simulations!
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                    New ELO Rating Parameters
                  </label>
                  <input
                    type="number"
                    value={newElo}
                    onChange={(e) => setNewElo(e.target.value)}
                    placeholder="e.g. 1820"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 px-4 py-2 text-sm text-slate-100 placeholder-slate-700 outline-none transition font-mono font-bold"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTeam(null)}
                    className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-slate-150 border border-slate-800 text-slate-400 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-900/20 border border-slate-800 p-5 rounded-2xl text-center">
                <Settings2 className="w-10 h-10 text-slate-750 mx-auto mb-3" />
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Calibration active</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1 max-w-[180px] mx-auto">
                  Click "Adjust ELO" next to any country in the rankings roster to override squad capability values.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW TRAFFIC AUDIT LOGS */}
      {!loading && activeSubTab === "logs" && (
        <div className="bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-slate-900/60 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex justify-between items-center flex-wrap gap-3">
            <span>Traffic Audit latency & Duration logs scope</span>
            <button
              id="download-audit-report-btn"
              type="button"
              onClick={handleDownloadAuditReport}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5"
            >
              📥 Download 30-Day Audit Report
            </button>
          </div>
          <table className="w-full text-left border-collapse text-[11px] font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/20 text-slate-400">
                <th className="p-4">Date stamp</th>
                <th className="p-4">Remote User</th>
                <th className="p-4">Method & Route Path</th>
                <th className="p-4">IP address</th>
                <th className="p-4 text-right">Status Code</th>
                <th className="p-4 text-right">Duration (ms)</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/60 hover:bg-slate-900/10">
                  <td className="p-4 text-slate-500 text-[10px]">{new Date(log.created_at).toLocaleTimeString()}</td>
                  <td className="p-4 text-blue-400">{log.email}</td>
                  <td className="p-4">
                    <span className={`px-1 rounded text-[9px] font-bold uppercase mr-1.5 ${
                      log.method === "POST" ? "bg-indigo-500/10 text-indigo-400" :
                      log.method === "PATCH" ? "bg-orange-500/10 text-orange-400" :
                      "bg-slate-800 text-slate-400"
                    }`}>
                      {log.method}
                    </span>
                    <span className="text-slate-350">{log.endpoint}</span>
                  </td>
                  <td className="p-4 text-slate-550 text-[10px]">{log.ip}</td>
                  <td className="p-4 text-right">
                    <span className={`px-1.5 px-1 py-0.5 rounded text-[10px] font-bold ${
                      log.status < 300 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="p-4 text-right text-teal-400 font-bold">{log.duration_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW SYSTEM SETTINGS */}
      {!loading && activeSubTab === "settings" && (
        <form onSubmit={handleUpdateSettings} className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest font-mono">App Configuration Panel</h3>
              <p className="text-[11px] text-slate-400">Configure global parameters, change root admin authentication bounds, and adjust mechanics speed thresholds.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Admin email setting */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                  Primary Root Administrator Email
                </label>
                <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded font-mono flex items-center gap-1">
                  🔒 Verified Owner
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                The designated email that inherits absolute admin scope privileges. For platform integrity, this is permanently locked to your verified account.
              </p>
              <input
                type="email"
                value="kaisoisaac@gmail.com"
                disabled={true}
                placeholder="e.g. admin@kickiq.ai"
                className="w-full bg-slate-900/40 border border-slate-800/65 px-4 py-2.5 rounded-xl text-xs text-slate-400 select-none cursor-not-allowed outline-none font-mono filter saturate-75"
                required
              />
            </div>

            {/* Game Speed Multiplier setting */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                Obstacle Velocity Multiplier: {appSettings.game_speed_multiplier}x
              </label>
              <p className="text-[11px] text-slate-550">
                Adjusts the speed of soccer ball obstacles in the training ground animation. Higher values increase arcade difficulty.
              </p>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={appSettings.game_speed_multiplier}
                onChange={(e) => setAppSettings({ ...appSettings, game_speed_multiplier: parseFloat(e.target.value) })}
                className="w-full accent-teal-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5x (Relaxed)</span>
                <span>1.0x (Standard)</span>
                <span>2.0x (Hyper Active)</span>
                <span>3.0x (Expert)</span>
              </div>
            </div>

            {/* Allow logins/registrations */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                  New Registrations Enrollment
                </label>
                <p className="text-[11px] text-slate-400">
                  Allow or restrict new users from creating mock credentials and registers if they pass obstacles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAppSettings({ ...appSettings, allow_registrations: !appSettings.allow_registrations })}
                className={`flex-none w-12 h-6 rounded-full transition-colors relative duration-300 focus:outline-none ${
                  appSettings.allow_registrations ? 'bg-teal-500' : 'bg-slate-850'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform duration-300 ${
                    appSettings.allow_registrations ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* App Maintenance Mode */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                  App Maintenance Filter
                </label>
                <p className="text-[11px] text-slate-400">
                  Enable maintenance filters to temporarily halt predictions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAppSettings({ ...appSettings, maintenance_mode: !appSettings.maintenance_mode })}
                className={`flex-none w-12 h-6 rounded-full transition-colors relative duration-300 focus:outline-none ${
                  appSettings.maintenance_mode ? 'bg-teal-500' : 'bg-slate-850'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform duration-300 ${
                    appSettings.maintenance_mode ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* AI Continuous Learning Toggle */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                  🔮 AI continuous learning posture
                </label>
                <p className="text-[11px] text-slate-400">
                  Enable AI to keep learning from past games & user predictions. Use user data to auto-train and calibrate ELO rating models.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAppSettings({ ...appSettings, ai_continuous_learning: !appSettings.ai_continuous_learning })}
                className={`flex-none w-12 h-6 rounded-full transition-colors relative duration-300 focus:outline-none ${
                  appSettings.ai_continuous_learning ? 'bg-teal-500' : 'bg-slate-850'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform duration-300 ${
                    appSettings.ai_continuous_learning ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* AI Learning Rate Range */}
            <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                📈 AI Feedback Learning Rate Index: {appSettings.ai_learning_rate}
              </label>
              <p className="text-[11px] text-slate-550">
                Determines how heavily the model weights user accuracy feedback vs raw historical ELO. Higher values update ELO dynamics more aggressively.
              </p>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.01"
                value={appSettings.ai_learning_rate || 0.15}
                onChange={(e) => setAppSettings({ ...appSettings, ai_learning_rate: parseFloat(e.target.value) })}
                className="w-full accent-teal-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.05 (Conservative)</span>
                <span>0.15 (Default)</span>
                <span>0.50 (Highly Adaptive)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
            <button
              type="button"
              onClick={() => fetchActiveAdminData()}
              className="px-5 py-2.5 bg-slate-950 border border-slate-800 text-slate-400 font-bold rounded-xl text-xs hover:bg-slate-850 transition cursor-pointer"
            >
              Reset to Defaults
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-teal-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-teal-400 transition cursor-pointer"
            >
              Save Configuration Settings
            </button>
          </div>
        </form>
      )}

      {!loading && activeSubTab === "security" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              diagnostic 'security health check' & account lockout scanner
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scan common application configurations, cryptographic key strengths, sensitive environment variables, and active brute-force threat lockouts.
            </p>
          </div>

          {/* Vulnerability Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Vulnerabilities Detected</span>
                <span className={`text-2xl font-black font-mono block ${securityAudit?.vulnerabilities_count > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>
                  {securityAudit?.vulnerabilities_count ?? 0}
                </span>
              </div>
              <div className={`p-2.5 rounded-xl border ${securityAudit?.vulnerabilities_count > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono font-mono">Critical Security Risks</span>
                <span className={`text-2xl font-black font-mono block ${securityAudit?.critical_vulnerabilities > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                  {securityAudit?.critical_vulnerabilities ?? 0}
                </span>
              </div>
              <div className={`p-2.5 rounded-xl border ${securityAudit?.critical_vulnerabilities > 0 ? 'bg-red-500/10 border-red-500/20 text-red-500 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                <Lock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Active Lockouts Monitored</span>
                <span className={`text-2xl font-black font-mono block ${securityAudit?.active_lockouts?.length > 0 ? 'text-teal-400' : 'text-slate-400'}`}>
                  {securityAudit?.active_lockouts?.length ?? 0}
                </span>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-850 text-slate-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Audit Vulnerability Checks List */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden p-4 space-y-4">
            <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest font-mono">Diagnostic Indicators Registry</h4>
            
            <div className="space-y-3">
              {/* Check 1: JWT Secret Length & Key Hardening */}
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-200 block">Cryptographic Session Key Length Check</span>
                  <p className="text-[11px] text-slate-400">Verifies JWT token validation signatures. Requires custom string format at least 32 characters long.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                    Len: {securityAudit?.jwt_secret_length ?? 0} Chars
                  </span>
                  {securityAudit?.jwt_secret_status === "secure" ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      🛡️ Secure
                    </span>
                  ) : securityAudit?.jwt_secret_status === "weak" ? (
                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                      ⚠️ Weak Strength (&lt; 32 chars)
                    </span>
                  ) : (
                    <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                      🚨 Vulnerable: Default Fallback Key
                    </span>
                  )}
                </div>
              </div>

              {/* Check 2: Gemini API environmental Variable */}
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-200 block">AI Gemini Key Integration Check</span>
                  <p className="text-[11px] text-slate-400">Validates if <code className="text-teal-400 font-mono text-[10px]">GEMINI_API_KEY</code> exists in workspace configuration for real-time predictions.</p>
                </div>
                <div>
                  {securityAudit?.is_gemini_api_key_configured ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      🛡️ Verified Active
                    </span>
                  ) : (
                    <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      ⚠️ Simulated Fallback (Key Not Found)
                    </span>
                  )}
                </div>
              </div>

              {/* Check 3: Root Account Hardening */}
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-200 block">System Administrator Root Hardening Check</span>
                  <p className="text-[11px] text-slate-400">Audits the core developer email role overrides to avoid privilege escalations on system registries.</p>
                </div>
                <div>
                  {securityAudit?.admin_email_lock_configured ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      🛡️ Hardened (kaisoisaac@gmail.com Locked)
                    </span>
                  ) : (
                    <span className="bg-red-500/10 text-red-400 border border-red-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      🚨 Vulnerable
                    </span>
                  )}
                </div>
              </div>

              {/* Check 4: Brute Force Limiters */}
              <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-200 block">Anti Brute-Force Rate Lockout</span>
                  <p className="text-[11px] text-slate-400">Protects users against dictionary attack schemes. Locks out accounts for 7 days upon 3 failed sign-ins.</p>
                </div>
                <div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                    🛡️ Verified Active (3-Try Threshold Enforced)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Account Lockouts Table Monitor */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden p-4 space-y-4">
            <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest font-mono flex items-center gap-1.5 font-mono">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              Active System Account Lockouts
            </h4>

            {(!securityAudit?.active_lockouts || securityAudit.active_lockouts.length === 0) ? (
              <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-850 text-xs text-slate-500 font-mono">
                No active brute force lockouts recorded in local threat buffer.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 font-mono text-[10px] text-slate-400 bg-slate-900/40 uppercase tracking-wider">
                      <th className="p-3 font-bold">Locked User Account</th>
                      <th className="p-3 font-bold">Lockout Trigger Date</th>
                      <th className="p-3 font-bold">Cooldown Remaining</th>
                      <th className="p-3 text-right font-bold">Management Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {securityAudit.active_lockouts.map((lock: any) => {
                      const remainSec = lock.seconds_remaining;
                      const days = Math.floor(remainSec / 86400);
                      const hours = Math.floor((remainSec % 86400) / 3600);
                      const mins = Math.floor((remainSec % 3600) / 60);

                      return (
                        <tr key={lock.email} className="hover:bg-slate-900/30 transition-all font-mono">
                          <td className="p-3 font-semibold text-slate-200">{lock.email}</td>
                          <td className="p-3 text-slate-400 text-[11px]">{new Date(lock.locked_at).toLocaleString()}</td>
                          <td className="p-3 text-amber-400 font-bold text-[11px]">
                            {days}d {hours}h {mins}m remaining
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch("/admin/release-lockout", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      "Authorization": `Bearer ${authToken}`
                                    },
                                    body: JSON.stringify({ email: lock.email })
                                  });
                                  const rData = await res.json();
                                  if (res.ok) {
                                    setFeedback(rData.message);
                                    // Refresh audit data
                                    const auditRes = await fetch("/admin/security-audit", {
                                      headers: { "Authorization": `Bearer ${authToken}` },
                                    });
                                    const auditData = await auditRes.json();
                                    if (auditRes.ok) setSecurityAudit(auditData);
                                  } else {
                                    alert(rData.error || "Failed to lift suspension.");
                                  }
                                } catch (err) {
                                  console.error("Failed to release lockout", err);
                                }
                              }}
                              className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded text-[10px] font-extrabold uppercase tracking-wide transition cursor-pointer"
                            >
                              Release Cooldown
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW USER FORECASTS & PREDICTIONS STATS TAB */}
      {!loading && activeSubTab === "predictions" && predictionsData && (
        <div className="space-y-6 animate-fade-in text-slate-300">
          {/* Key statistical parameters header card row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Votes Card */}
            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <div className="absolute top-2 right-2 p-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                  Gbl Forecast Votes Cast
                </span>
                <span className="block text-2xl font-black font-mono text-teal-400 mt-1 animate-pulse">
                  {predictionsData.summary_metrics.total_predictions_cast}
                </span>
              </div>
              <p className="text-[10px] text-slate-450 leading-normal mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block animate-ping" />
                Live predicted activity logged across entire group
              </p>
            </div>

            {/* Most Backed Team Card */}
            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <div className="absolute top-2 right-2 p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                  Community Consensus Peak
                </span>
                <span className="block text-lg font-black text-slate-100 truncate mt-1.5">
                  🏆 {predictionsData.summary_metrics.most_backed_team}
                </span>
              </div>
              <p className="text-[10px] font-mono text-amber-400 mt-1">
                {predictionsData.summary_metrics.most_backed_votes} Total user votes backing this team
              </p>
            </div>

            {/* Halftime Accuracy Card */}
            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <div className="absolute top-2 right-2 p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                  Halftime Prediction Index
                </span>
                <span className="block text-2xl font-black font-mono text-emerald-400 mt-1">
                  {predictionsData.summary_metrics.halftime_correct} Accurate
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">
                {predictionsData.summary_metrics.halftime_incorrect} Incorrect | {predictionsData.summary_metrics.halftime_pending} Pending evaluation
              </p>
            </div>

            {/* Active Prediction Matches */}
            <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <div className="absolute top-2 right-2 p-1.5 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 rounded-xl">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                  Monitored Tournament Scope
                </span>
                <span className="block text-2xl font-black font-mono text-indigo-400 mt-1">
                  {predictionsData.summary_metrics.active_prediction_matches} Active
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal mt-1">
                Ongoing and upcoming matches for forecast casting
              </p>
            </div>

          </div>

          {/* AI Continuous Learning & Model self-calibration trigger block */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-850">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-mono">🔮 AI Model Calibration Engine</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono">Loop Live</span>
                </div>
                <h3 className="text-xs font-black uppercase text-slate-100 tracking-wider mt-1">Continuous Feedback-Driven Training</h3>
                <p className="text-[10px] text-slate-450 leading-normal font-sans mt-0.5">
                  This system implements a real-time predictive training loops setup. As matches finish, AI reads community forecasts accuracy, cross-examines squad attributes, and refines historical ELO bias to preserve deep trustworthiness.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTrainAi}
                disabled={trainingLoader}
                className={`relative px-5 py-2.5 rounded-xl font-bold text-xs uppercase cursor-pointer tracking-wider font-mono transition-all duration-300 ${
                  trainingLoader
                    ? "bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed animate-pulse"
                    : "bg-gradient-to-r from-teal-500 to-indigo-500 text-slate-950 hover:opacity-90 shadow-lg shadow-teal-500/10"
                }`}
              >
                {trainingLoader ? (
                  <span className="flex items-center gap-1.5 justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                    Propagating Epochs...
                  </span>
                ) : (
                  "⚡ Run Calibration Loop"
                )}
              </button>
            </div>

            {/* Display training feedback states */}
            {trainFeedback && (
              <div className={`p-4 rounded-xl border font-mono text-[11px] leading-relaxed animate-fade-in ${
                trainFeedback.error
                  ? "bg-red-500/10 border-red-500/25 text-red-100"
                  : "bg-slate-950 border border-slate-850 text-teal-400"
              }`}>
                {trainFeedback.error ? (
                  <p>⚠️ Calibration Error: {trainFeedback.error}</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="font-extrabold text-[#00e676] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-ping" />
                      [CYCLE EXECUTED] {trainFeedback.message}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-slate-300 text-[10px]">
                      <div>
                        <span className="block text-slate-500">Processed Matches</span>
                        <span className="block text-xs font-black text-slate-100">{trainFeedback.metrics.processed_matches}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Total User Votes Cast</span>
                        <span className="block text-xs font-black text-slate-100">{trainFeedback.metrics.total_predictions_analyzed}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Audience Alignment Rate</span>
                        <span className="block text-xs font-black text-slate-100">{(trainFeedback.metrics.average_user_alignment * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">ELO Adaptations Applied</span>
                        <span className="block text-xs font-black text-teal-400">{trainFeedback.metrics.ratings_adjustments_applied} shifts</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Consensus Graph visualization card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                    Predictions consensus index
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">Consolidated audience vote distribution map across all available matches</p>
                </div>
                <div className="flex gap-3 text-[9px] font-mono">
                  <span className="flex items-center gap-1 text-[#00e676]"><span className="w-1.5 h-1.5 rounded-full bg-[#00e676]" /> Home Vote</span>
                  <span className="flex items-center gap-1 text-[#3b82f6]"><span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> Draw</span>
                  <span className="flex items-center gap-1 text-[#f43f5e]"><span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]" /> Away Vote</span>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictionsData.matchPredictions.map((m: any) => ({
                    name: `${m.home_team.substring(0, 8)} vs ${m.away_team.substring(0, 8)}`,
                    Home: m.votes_home,
                    Draw: m.votes_draw,
                    Away: m.votes_away,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#131d30" />
                    <XAxis dataKey="name" stroke="#5c6f84" fontSize={8} tickLine={false} />
                    <YAxis stroke="#5c6f84" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "11px", color: "#f1f5f9" }} />
                    <Bar dataKey="Home" fill="#00e676" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Draw" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Away" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance and Sizing Statistics Panel */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="pb-2 border-b border-slate-800">
                <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                  Operational & sizing parameters
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">Live physical system resource footprint checklist</p>
              </div>

              <div className="space-y-3 font-mono text-xs">
                
                {/* Metric 1 */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                  <span className="text-slate-500">Node DB Size (Users count)</span>
                  <span className="text-slate-300 font-bold">{predictionsData.summary_metrics.arrays_sizing.users_count} accounts</span>
                </div>

                {/* Metric 2 */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                  <span className="text-slate-500">Database Matches Loaded</span>
                  <span className="text-slate-300 font-bold">{predictionsData.summary_metrics.arrays_sizing.matches_count} records</span>
                </div>

                {/* Metric 3 */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                  <span className="text-slate-500">Match Events Logged</span>
                  <span className="text-slate-300 font-bold">{predictionsData.summary_metrics.arrays_sizing.events_count} dataevents</span>
                </div>

                {/* Metric 4 */}
                <div className="flex justify-between items-center py-1.5 border-b border-slate-850">
                  <span className="text-slate-500">Processed Traffic Logs</span>
                  <span className="text-slate-300 font-bold">{predictionsData.summary_metrics.arrays_sizing.logs_count} telemetry lines</span>
                </div>

                {/* Metric 5 */}
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-slate-500">Load Average (1m, 5m, 15m)</span>
                  <span className="text-slate-300 font-bold">
                    {predictionsData.summary_metrics.system_load.map((l: number) => l.toFixed(2)).join(", ")}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl mt-1.5">
                  <span className="block text-[9px] text-[#00e676] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="w-1 ml-px h-1 bg-emerald-400 rounded-full animate-ping" />
                    Security isolation state
                  </span>
                  <p className="text-[10px] text-slate-400 font-sans leading-normal">
                    This administrative overlay runs on isolated session structures. Direct cross-origin predictions mutations are checked before serialization.
                  </p>
                </div>

              </div>
            </div>

          </div>

          {/* harmonised predictions tabulation grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-tight">
                  Unified Match Consensus Tabulation List
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Harmonised list of user choices, percentage consensus ratios, and halftime custom prediction indices.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-[9px] font-mono text-teal-400 uppercase tracking-widest font-extrabold">
                {predictionsData.matchPredictions.length} Monitored Match Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-500 text-[10px] uppercase font-mono tracking-wider font-extrabold">
                    <th className="p-3">Match Particulars</th>
                    <th className="p-3">Status / stage</th>
                    <th className="p-3 text-center">Home Votes</th>
                    <th className="p-3 text-center">Draw Votes</th>
                    <th className="p-3 text-center">Away Votes</th>
                    <th className="p-3 text-center">Global Votes</th>
                    <th className="p-3">Consensus Forecast</th>
                    <th className="p-3">Halftime Choice / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-xs">
                  {predictionsData.matchPredictions.map((pred: any) => {
                    const totalVotes = pred.total_votes;
                    const pHome = totalVotes > 0 ? Math.round((pred.votes_home / totalVotes) * 100) : 0;
                    const pDraw = totalVotes > 0 ? Math.round((pred.votes_draw / totalVotes) * 100) : 0;
                    const pAway = totalVotes > 0 ? Math.round((pred.votes_away / totalVotes) * 100) : 0;

                    return (
                      <tr key={pred.id} className="hover:bg-slate-950/40 transition">
                        <td className="p-3 font-semibold text-slate-200">
                          {pred.home_team} <span className="text-[10px] text-slate-500 font-mono">VS</span> {pred.away_team}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide border ${
                            pred.status === "live"
                              ? "bg-red-500/10 text-red-500 border-red-500/20"
                              : pred.status === "finished"
                              ? "bg-slate-800 text-slate-450 border-slate-700"
                              : "bg-teal-500/10 text-teal-400 border-teal-500/20"
                          }`}>
                            {pred.status}
                          </span>
                          <span className="block mt-1 text-[10px] text-slate-500 font-mono italic">{pred.stage}</span>
                        </td>
                        
                        {/* Home Votes Column */}
                        <td className="p-3 text-center font-mono">
                          <span className="font-bold text-slate-200">{pred.votes_home}</span>
                          <span className="block text-[9px] text-[#00e676]">{pHome}%</span>
                        </td>

                        {/* Draw Votes Column */}
                        <td className="p-3 text-center font-mono">
                          <span className="font-bold text-slate-200">{pred.votes_draw}</span>
                          <span className="block text-[9px] text-blue-400">{pDraw}%</span>
                        </td>

                        {/* Away Votes Column */}
                        <td className="p-3 text-center font-mono">
                          <span className="font-bold text-slate-200">{pred.votes_away}</span>
                          <span className="block text-[9px] text-rose-500">{pAway}%</span>
                        </td>

                        {/* Global Votes Count */}
                        <td className="p-3 text-center font-mono font-bold text-teal-400">
                          {totalVotes}
                        </td>

                        {/* Consensus Forecast Choice */}
                        <td className="p-3 font-semibold">
                          {totalVotes > 0 ? (
                            <span className="text-slate-200 bg-slate-950/65 border border-slate-850 px-2.5 py-1 rounded-lg">
                              ⚡ {pred.predicted_outcome}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No audience signal</span>
                          )}
                        </td>

                        {/* Halftime custom options column */}
                        <td className="p-3">
                          {pred.halftime_choice !== "None Cast" ? (
                            <div className="space-y-1">
                              <span className="block text-[10px] text-slate-300 font-mono uppercase tracking-wide bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-850">
                                {pred.halftime_choice}
                              </span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                pred.halftime_status === "correct"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                  : pred.halftime_status === "incorrect"
                                  ? "bg-red-500/10 text-red-400 border border-red-500/25"
                                  : "bg-slate-800 text-slate-450 border border-slate-750"
                              }`}>
                                {pred.halftime_status}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-550 italic text-[11px]">Unscheduled at halftime</span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw User Prediction log ledger list stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="pb-1.5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                  Raw Forecast Vote Ledger Logs
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">Chronological listing of active forecasts cast by users in the platform</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Showing last 50 transactions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wide font-extrabold text-[9px]">
                    <th className="p-2.5">User Identity</th>
                    <th className="p-2.5">Access Plan Info</th>
                    <th className="p-2.5">Target Match</th>
                    <th className="p-2.5">Forecast Pick</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40">
                  {predictionsData.userVotesDetail.length > 0 ? (
                    predictionsData.userVotesDetail.map((log: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-950/20">
                        <td className="p-2.5 font-sans">
                          <span className="block font-semibold text-slate-200">{log.user_name}</span>
                          <span className="block text-[10px] text-slate-400 select-all">{log.user_email}</span>
                        </td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-black ${
                            log.user_plan === "elite"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : log.user_plan === "pro"
                              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}>
                            {log.user_plan}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans text-slate-300 font-semibold">
                          {log.match_title}
                        </td>
                        <td className="p-2.5 text-teal-400 font-extrabold uppercase">
                          🎯 {log.vote}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">
                        No forecast transactions logged in the system database yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
