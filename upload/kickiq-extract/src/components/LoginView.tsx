import React, { useState, useEffect } from "react";
import { Mail, Phone, Lock, User, ArrowRight, Shield, Sparkles, Server, Eye, EyeOff, Check, X } from "lucide-react";
import SoccerSkillsAnimator from "./SoccerSkillsAnimator";

interface LoginViewProps {
  onLoginSuccess: (token: string) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [tab, setTab] = useState<"email" | "sms">("email");
  const [showAuthTips, setShowAuthTips] = useState(false);

  // Input states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminSecretCode, setAdminSecretCode] = useState("");
  const [showSecretCode, setShowSecretCode] = useState(false);

  // Request logs states
  const [otpSent, setOtpSent] = useState(false);
  const [sandboxOtp, setSandboxOtp] = useState<string | null>(null);
  const [sandboxResetToken, setSandboxResetToken] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Support resuming the shared Web Audio API context upon initial user interaction on the login screen
  React.useEffect(() => {
    const resumeSharedContext = () => {
      try {
        const globalCtx = (window as any).__kickiq_audio_context__;
        if (globalCtx && globalCtx.state === "suspended") {
          globalCtx.resume().then(() => {
            console.log("[KICKIQ AUDIO] Suspended audio context resumed on container page interaction.");
          }).catch((err: any) => {
            console.log("[KICKIQ AUDIO] Error resuming context:", err);
          });
        }
      } catch (e) {
        // quiet fail
      }
    };
    window.addEventListener("click", resumeSharedContext);
    window.addEventListener("touchstart", resumeSharedContext);
    window.addEventListener("keydown", resumeSharedContext);
    return () => {
      window.removeEventListener("click", resumeSharedContext);
      window.removeEventListener("touchstart", resumeSharedContext);
      window.removeEventListener("keydown", resumeSharedContext);
    };
  }, []);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Handle Real Google Login Response ────────────────────────────────────
  const handleGoogleCredentialResponse = async (response: any) => {
    resetAllMessages();
    setLoading(true);
    try {
      const res = await fetch("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          admin_secret_code: adminSecretCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google identity verification failed.");

      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initGoogle = () => {
      if (!(window as any).google) return;
      
      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      const parent = document.getElementById("google-signin-btn-container");
      if (parent) {
        (window as any).google.accounts.id.renderButton(parent, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          logo_alignment: "left",
          width: "100%"
        });
      }
    };

    // Wait for script to load
    const interval = setInterval(() => {
      if ((window as any).google) {
        initGoogle();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [adminSecretCode, mode]);

  const resetAllMessages = () => {
    setError(null);
    setSuccess(null);
    setSandboxOtp(null);
    setSandboxResetToken(null);
  };

  // ── Handle Email Login ───────────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllMessages();
    if (!email || !password) return setError("Please input both email and password.");

    setLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, admin_secret_code: adminSecretCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed.");

      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Email Register ────────────────────────────────────────────────
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllMessages();
    if (!email || !password) return setError("Please input required email and password credentials.");
    if (password.length < 8) return setError("Password security constraints require at least 8 characters.");

    setLoading(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, display_name: displayName, admin_secret_code: adminSecretCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration request failed.");

      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle SMS Send OTP ──────────────────────────────────────────────────
  const handleSendOtp = async () => {
    resetAllMessages();
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    if (!phone || !e164Regex.test(phone)) {
      return setError("Please input a valid E.164 formatted phone number, e.g., +2348012345678");
    }

    setLoading(true);
    try {
      const res = await fetch("/auth/sms/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "login" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed raw SMS dispatch.");

      setOtpSent(true);
      setSuccess(`Security verification OTP successfully dispatched to ${phone}.`);
      if (data.dev_otp) {
        setSandboxOtp(data.dev_otp);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle SMS OTP Verify ────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllMessages();
    if (!otp) return setError("Please input the 6-digit SMS code.");

    setLoading(true);
    try {
      const res = await fetch("/auth/sms/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp, purpose: "login", display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid validation code.");

      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Password Reset Send link ──────────────────────────────────────
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllMessages();
    if (!forgotEmail) return setError("Please enter your registered email address.");

    setLoading(true);
    try {
      const res = await fetch("/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset dispatch failed.");

      setSuccess("If that email exists, a password reset token has been processed.");
      if (data.dev_token) {
        setSandboxResetToken(data.dev_token);
        setResetToken(data.dev_token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm Password Reset ──────────────────────────────────────────────
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetAllMessages();
    if (!resetToken || !newPassword) return setError("Please fill in both the token code and new password.");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters long.");

    setLoading(true);
    try {
      const res = await fetch("/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password restoration failed.");

      setResetSuccess(true);
      setSuccess("Your account password has been successfully restored!");
      setTimeout(() => {
        setMode("login");
        setResetSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-100">
      {/* Visual Ambiance / Turf Grass Grid glow backdrops */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-green-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Pitch Branding Banner */}
        <div className="bg-gradient-to-b from-emerald-950/40 p-8 pb-4 text-center border-b border-slate-800/60 relative">
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] uppercase tracking-wider text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Cup 2026 Live
          </div>
          <div 
            className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-2xl mb-3 shadow-[0_0_20px_rgba(16,185,129,0.15)] select-none transition-all duration-300 ${
              loading ? "ball-roll-faster" : "pixar-ball-bounce hover:scale-110"
            }`}
          >
            ⚽
          </div>
          <h1 className="font-sans text-3xl tracking-tight">
            <span className="kickiq-live-effect">KICKIQ</span>{" "}
            <span className="text-slate-100 font-medium">Analyst</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
            World Cup 2026 Analytical Intelligence Engine & Live Dixon-Coles Poisson Predictor.
          </p>
        </div>

        {/* Messaging Logs */}
        <div className="px-8 mt-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2.5">
              <span>⚠</span>
              <p className="flex-1">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2.5">
              <span>✓</span>
              <p className="flex-1">{success}</p>
            </div>
          )}

          {/* Sandbox Development OTP Helper alerts */}
          {sandboxOtp && (
            <div className="mt-2.5 p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-xs text-teal-300 font-mono text-center relative overflow-hidden">
              <span className="absolute top-1 left-1.5 text-[8px] bg-teal-500/20 px-1 py-0.5 rounded text-teal-400 font-sans font-bold uppercase tracking-widest">
                Developer Sandbox
              </span>
              <p className="mt-1">Generated OTP: <strong className="text-emerald-300 text-lg tracking-wider font-semibold">{sandboxOtp}</strong></p>
            </div>
          )}

          {sandboxResetToken && (
            <div className="mt-2.5 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-orange-300 font-mono text-center relative">
              <span className="absolute top-1 left-1.5 text-[8px] bg-orange-500/20 px-1 py-0.5 rounded text-orange-400 font-sans font-bold uppercase tracking-widest">
                Sandbox Token
              </span>
              <p className="mt-2">Use recovery token code: <strong className="text-orange-200 select-all underline">{sandboxResetToken}</strong></p>
            </div>
          )}
        </div>

        <div className="px-8 mt-2">
          <button
            id="toggle-auth-tips-btn"
            type="button"
            onClick={() => setShowAuthTips(true)}
            className="w-full py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 rounded-2xl text-[11px] font-bold tracking-wide uppercase transition flex items-center justify-center gap-2 cursor-pointer"
          >
            🔑 Platform Access & Sign-Up Tips Guide
          </button>
        </div>

        {/* Dynamic Views Switcher */}
        <div className="p-8">
          {/* Premium Animated Soccer Skills Logo */}
          <div className="mb-5">
            <SoccerSkillsAnimator />
          </div>

          {mode === "login" && (
            <>
              {/* Login Tabs Selector */}
              <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => { setTab("email"); resetAllMessages(); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    tab === "email" ? "bg-slate-800 text-emerald-400 shadow" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Mail className="inline w-3.5 h-3.5 mr-1.5" />
                  Email Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("sms"); resetAllMessages(); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    tab === "sms" ? "bg-slate-800 text-emerald-400 shadow" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Phone className="inline w-3.5 h-3.5 mr-1.5" />
                  SMS verification
                </button>
              </div>

              {tab === "email" ? (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        placeholder="analyst@kickiq.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); resetAllMessages(); }}
                        className="text-xs text-emerald-400 hover:underline hover:text-emerald-300"
                      >
                        Reset Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  {email.toLowerCase().trim() === "kaisoisaac@gmail.com" && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2 animate-pulse mt-3">
                      <div className="flex justify-between">
                        <label className="block text-[11px] font-bold text-red-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-red-500" />
                          Security Code Verification
                        </label>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400/80" />
                        <input
                          id="login-admin-security-code-input"
                          type={showSecretCode ? "text" : "password"}
                          placeholder="Enter Enforced 090/;dk23.3 Code"
                          value={adminSecretCode}
                          onChange={(e) => setAdminSecretCode(e.target.value)}
                          className="w-full bg-slate-950/80 border border-red-500/30 focus:border-red-500 rounded-xl pl-11 pr-12 py-2.5 text-xs text-red-200 placeholder-red-900/60 outline-none transition font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecretCode(!showSecretCode)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300 transition cursor-pointer"
                          title={showSecretCode ? "Hide administrative secret code" : "Unmask administrative secret code"}
                        >
                          {showSecretCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] text-slate-950 font-bold tracking-wide transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Verifying..." : "Access Analytics Board"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">E.164 Phone Number</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="tel"
                          placeholder="+2348012345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                          disabled={otpSent}
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading || otpSent}
                        className="px-4 py-3 text-xs font-bold rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        {otpSent ? "Sent" : "Send OTP"}
                      </button>
                    </div>
                  </div>

                  {otpSent && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Verification Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="e.g. 123456"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full text-center bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-lg font-mono tracking-widest text-slate-100 placeholder-slate-700 outline-none transition"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? "Confirming..." : "Verify & Start Analyzing"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </form>
              )}

              {/* Account conversion navigation */}
              <div className="mt-6 text-center text-xs">
                <span className="text-slate-400">New analyst recruit? </span>
                <button
                  type="button"
                  onClick={() => { setMode("register"); resetAllMessages(); }}
                  className="text-emerald-400 font-semibold hover:underline"
                >
                  Create free account
                </button>
              </div>
            </>
          )}

          {mode === "register" && (
            <form onSubmit={handleEmailRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Display Name (Optional)</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Striker99"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Create Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                    required
                  />
                </div>

                {/* Real-time Password Strength Validation Indicators */}
                {password.length > 0 && (
                  <div className="mt-2.5 p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                        Password Integrity:
                      </span>
                      <span className={`text-[10px] uppercase font-extrabold tracking-wider font-mono ${
                        password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)
                          ? "text-emerald-400"
                          : password.length >= 8 && (/[A-Z]/.test(password) || /[0-9]/.test(password))
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}>
                        {password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)
                          ? "Strong / Fully Hardened"
                          : password.length >= 8 && (/[A-Z]/.test(password) || /[0-9]/.test(password))
                          ? "Moderate Security Check"
                          : "Weak / Vulnerable Strength"}
                      </span>
                    </div>

                    {/* Colored visual health segments */}
                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      <div className={`rounded-full transition-all duration-300 ${password.length >= 1 ? 'bg-red-500' : 'bg-slate-850'}`} />
                      <div className={`rounded-full transition-all duration-300 ${password.length >= 8 ? 'bg-amber-500' : 'bg-slate-850'}`} />
                      <div className={`rounded-full transition-all duration-300 ${password.length >= 8 && (/[A-Z]/.test(password) || /[0-9]/.test(password)) ? 'bg-teal-500' : 'bg-slate-850'}`} />
                      <div className={`rounded-full transition-all duration-300 ${password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 'bg-emerald-400' : 'bg-slate-850'}`} />
                    </div>

                    {/* Dynamic checklist requirements */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5">
                        {password.length >= 8 ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        <span className={password.length >= 8 ? "text-slate-300" : "text-slate-500"}>
                          8+ Characters
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/[A-Z]/.test(password) ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        <span className={/[A-Z]/.test(password) ? "text-slate-300" : "text-slate-500"}>
                          Uppercase letter
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/[0-9]/.test(password) ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        <span className={/[0-9]/.test(password) ? "text-slate-300" : "text-slate-500"}>
                          Number digit (0-9)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/[^A-Za-z0-9]/.test(password) ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        <span className={/[^A-Za-z0-9]/.test(password) ? "text-slate-300" : "text-slate-500"}>
                          Symbol (!@#_...)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {email.toLowerCase().trim() === "kaisoisaac@gmail.com" && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2 animate-pulse mt-3">
                  <div className="flex justify-between">
                    <label className="block text-[11px] font-bold text-red-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-red-500" />
                      Security Code Verification
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400/80" />
                    <input
                      id="register-admin-security-code-input"
                      type={showSecretCode ? "text" : "password"}
                      placeholder="Enter Enforced 090/;dk23.3 Code"
                      value={adminSecretCode}
                      onChange={(e) => setAdminSecretCode(e.target.value)}
                      className="w-full bg-slate-950/80 border border-red-500/30 focus:border-red-500 rounded-xl pl-11 pr-12 py-2.5 text-xs text-red-200 placeholder-red-900/60 outline-none transition font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretCode(!showSecretCode)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 transition cursor-pointer"
                      title={showSecretCode ? "Hide registration admin security code" : "Unmask registration admin security code"}
                    >
                      {showSecretCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? "Creating..." : "Sign Up & Start Predicting"}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center text-xs mt-4">
                <span className="text-slate-400">Already registered? </span>
                <button
                  type="button"
                  onClick={() => { setMode("login"); resetAllMessages(); }}
                  className="text-emerald-400 font-semibold hover:underline"
                >
                  Sign in instead
                </button>
              </div>
            </form>
          )}

          {mode === "forgot" && (
            <div className="space-y-4">
              {!sandboxResetToken ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Registered Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        placeholder="you@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-slate-800 border border-slate-700 font-bold hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Processing..." : "Generate Reset Code"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Copy Reset Token Code</label>
                    <input
                      type="text"
                      placeholder="Input token from notification box above"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full text-center bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm font-mono tracking-wider text-orange-400 outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">New Security Password</label>
                    <input
                      type="password"
                      placeholder="Min 8 characters requirement"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-700 outline-none transition"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || resetSuccess}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold transition text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? "Updating..." : "Establish New Password"}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setMode("login"); resetAllMessages(); }}
                className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-200 mt-2 hover:underline text-center block font-semibold"
              >
                ← Return to main entrance
              </button>
            </div>
          )}

          {/* Social Sign-In Integrator panel */}
          <div className="mt-8 pt-6 border-t border-slate-850/60 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-950/50 border border-slate-850/60">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest font-mono">
                Official Google Identity Sync
              </span>
              <Shield className="w-3 h-3 text-emerald-500 ml-auto" />
            </div>

            <div id="google-signin-btn-container" className="w-full flex justify-center min-h-[44px]">
              {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <div className="text-[10px] text-rose-400 font-mono text-center p-3 border border-rose-500/20 rounded-xl bg-rose-500/5">
                  GOOGLE_CLIENT_ID NOT CONFIGURED
                </div>
              )}
            </div>
            
            <p className="text-[9px] text-slate-500 text-center px-4 leading-relaxed">
              Authenticate securely with your real Google account to access elite Cup 2026 analytical dashboards.
            </p>
          </div>

        </div>
      </div>

      {showAuthTips && (
        <div id="auth-tips-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              id="close-auth-tips-btn"
              type="button"
              onClick={() => setShowAuthTips(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-150 p-1.5 rounded-lg hover:bg-slate-850 transition cursor-pointer font-bold border border-slate-800 bg-slate-900"
            >
              ✕
            </button>
            <div className="flex items-center gap-2.5 mb-4 text-emerald-400 border-b border-slate-800/80 pb-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold tracking-tight">KICKIQ Authentication Platform Guide</h2>
            </div>

            <div className="space-y-4 text-xs text-slate-300 font-sans">
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                <h3 className="text-slate-100 font-bold mb-1 flex items-center gap-1.5 font-mono">
                  <span className="text-emerald-400">1.</span> Quick Sign-Up Flow
                </h3>
                <p className="leading-relaxed">
                  Toggle the <span className="text-emerald-400 font-bold">Create free account</span> mode link below the sign-in form. Fill in your preferred email address, any optional display nickname, and secure password.
                </p>
              </div>

              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                <h3 className="text-slate-100 font-bold mb-1 flex items-center gap-1.5 font-mono">
                  <span className="text-teal-400">2.</span> Strict Password Requirements
                </h3>
                <p className="leading-relaxed">
                  Your security password MUST contain at least <span className="text-teal-400 font-bold text-sm">8 characters</span>. Inputting shorter passwords will prompt an error warning to uphold platform safety configurations.
                </p>
              </div>

              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                <h3 className="text-slate-100 font-bold mb-1 flex items-center gap-1.5 font-mono">
                  <span className="text-orange-400">3.</span> Restricted Admin Role Verification
                </h3>
                <p className="leading-relaxed">
                  Access control to the full <span className="text-slate-100 font-semibold">Admin Panel</span> is strictly restricted to verified owner accounts. The primary root administrator email is locked permanently to <span className="text-emerald-400 font-mono select-all font-bold">kaisoisaac@gmail.com</span>. Any custom modifications or remote logouts will check your email against this hardcoded setting first.
                </p>
              </div>

              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850">
                <h3 className="text-slate-100 font-bold mb-1 flex items-center gap-1.5 font-mono">
                  <span className="text-purple-400">4.</span> Official Google Identity Sync
                </h3>
                <p className="leading-relaxed text-slate-300">
                  We use <span className="text-purple-400 font-semibold">Official Google Sign-In</span> to securely verify your identity. This ensures your analytical data, streaks, and preferences are synchronized across devices using industry-standard OAuth 2.0 protocols.
                </p>
              </div>
            </div>

            <button
              id="confirm-auth-tips-btn"
              type="button"
              onClick={() => setShowAuthTips(false)}
              className="mt-6 w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl transition text-xs flex items-center justify-center cursor-pointer uppercase tracking-wider"
            >
              I Understand the Authentication Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
