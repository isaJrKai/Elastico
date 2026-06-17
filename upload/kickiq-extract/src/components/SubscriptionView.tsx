import React, { useState } from "react";
import { Crown, Check, ShieldCheck, Zap, X, CreditCard } from "lucide-react";
import { User } from "../types";

interface SubscriptionViewProps {
  user: User;
  onUpgradeSuccess: (updatedUser: User) => void;
  onClose: () => void;
  authToken: string;
}

export default function SubscriptionView({ user, onUpgradeSuccess, onClose, authToken }: SubscriptionViewProps) {
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "elite">("pro");
  const [upgrading, setUpgrading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const PLANS = [
    {
      id: "free" as const,
      name: "Standard Recruit",
      price: "$0",
      period: "forever",
      description: "Basic World Cup 2026 ELO matchups monitoring.",
      features: [
        "Base ELO match listing metrics",
        "1 Quick simulation match limit",
        "Limited analyst commentary",
        "Standard layout access",
      ],
      color: "border-slate-800 text-slate-300",
    },
    {
      id: "pro" as const,
      name: "KickIQ Pro Analyst",
      price: "$4.99",
      period: "monthly",
      badge: "POPULAR",
      description: "Unlock extensive Dixon-Coles expected goals projection matrices.",
      features: [
        "Unlimited Quick Match Simulations",
        "Dixon-Coles Poisson goals matrix",
        "Intermediate xG ratings indices",
        "Priority AI Analyst chat answers",
        "24/7 Server diagnostic access",
      ],
      color: "border-emerald-500/40 text-emerald-300 ring-2 ring-emerald-500/20",
    },
    {
      id: "elite" as const,
      name: "StrikIQ Elite Intelligence",
      price: "$8.00",
      period: "monthly",
      badge: "ELITE METRICS",
      description: "Exclusive statistical intervals and automated temporal simulations.",
      features: [
        "Everything in Pro and more",
        "Wilson 95% Score Win Probability intervals",
        "Real-Time Temporal Live Ticking simulations",
        "Custom squad ELO ranking calibration panel",
        "Ultimate Gemini LLM commentary bandwidth",
        "Special Elite Discord channel badge",
      ],
      color: "border-teal-500/50 text-teal-300 shadow-[0_0_20px_rgba(20,184,166,0.1)]",
    },
  ];

  const handleMockCheckout = async () => {
    setUpgrading(true);
    try {
      const res = await fetch("/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          userId: user.id,
          plan: selectedPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upgrading transaction failed.");

      if (data.success && data.user) {
        setPaymentSuccess(true);
        setTimeout(() => {
          onUpgradeSuccess(data.user);
          setPaymentSuccess(false);
          onClose();
        }, 1500);
      }
    } catch (e) {
      alert("Payment processing failure, please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto">
        
        {/* Glowing backdrop meshes */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800/80 cursor-pointer transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 mb-3 uppercase tracking-widest font-mono">
            <Crown className="w-3.5 h-3.5" />
            Pricing Plans & Subscriptions
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 font-sans">
            Upgrade Your Analytics Bandwidth
          </h2>
          <p className="text-slate-400 text-xs mt-1.5 max-w-lg mx-auto">
            Gain deep Dixon-Coles expected score models, live simulation trackers, and premium Gemini dialogue credits.
          </p>
        </div>

        {paymentSuccess ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto text-3xl animate-bounce">
              🎉
            </div>
            <h3 className="text-xl font-bold text-emerald-300">Transaction Confirmed!</h3>
            <p className="text-xs text-slate-400">Upgrading your credentials parameters... Launching Elite Dashboards.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isActive = user.plan === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`bg-slate-950/40 p-5 rounded-2xl border flex flex-col relative transition ${plan.color} ${
                      isActive ? "bg-emerald-950/10 border-emerald-500/40" : ""
                    }`}
                  >
                    {plan.badge && (
                      <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-extrabold uppercase tracking-widest">
                        {plan.badge}
                      </span>
                    )}

                    <div className="mb-4">
                      <h3 className="text-sm font-extrabold tracking-tight text-slate-100">{plan.name}</h3>
                      <p className="text-[10px] text-slate-500 mt-1 min-h-[30px]">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1 mb-4 border-b border-slate-800 pb-4">
                      <span className="text-2xl font-extrabold text-slate-100">{plan.price}</span>
                      <span className="text-[10px] text-slate-500">/{plan.period}</span>
                    </div>

                    <ul className="space-y-2 flex-1 mb-6">
                      {plan.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex gap-2 text-[11px] text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isActive ? (
                      <div className="w-full text-center py-2 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                        ✓ ACTIVE PLAN
                      </div>
                    ) : (
                      plan.id !== "free" && (
                        <button
                          onClick={() => setSelectedPlan(plan.id as "pro" | "elite")}
                          className={`w-full py-2.5 text-xs font-bold rounded-xl border cursor-pointer transition ${
                            selectedPlan === plan.id
                              ? "bg-slate-100 text-slate-950 border-slate-100 hover:bg-slate-200"
                              : "bg-slate-900 border-slate-800 hover:bg-slate-850 hover:text-slate-100 text-slate-400"
                          }`}
                        >
                          Select {plan.name.split(" ")[1]}
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom billing checkout panels */}
            {user.plan !== "elite" && (
              <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Payment checkout with PayPal
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Confirming subscription to <strong className="text-teal-400 font-mono text-sm">{selectedPlan.toUpperCase()}</strong> membership parameters.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleMockCheckout}
                  disabled={upgrading || user.plan === selectedPlan}
                  className="w-full md:w-auto px-6 py-3 rounded-xl bg-orange-400 hover:bg-orange-300 text-slate-950 font-extrabold tracking-wide text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {upgrading ? "Processing upgrade..." : `Confirm Payment Upgrade`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
