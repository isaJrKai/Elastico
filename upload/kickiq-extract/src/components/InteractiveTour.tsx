import React, { useState, useEffect } from "react";
import { Sparkles, ArrowRight, ArrowLeft, X, Keyboard, HelpCircle } from "lucide-react";
import { triggerHaptic } from "../utils/haptics";

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InteractiveTour({ isOpen, onClose }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      triggerHaptic("medium");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tourSteps = [
    {
      title: "⚽ Welcome to KICKIQ Analyst!",
      description: "Welcome to the ultimate predictive analyzer for the World Cup 2026! Let us show you around your new high-tech forecasting command station.",
      position: "center",
      icon: "🌐"
    },
    {
      title: "🏟️ Dynamic Fixtures Deck",
      description: "On the left column, you'll find the roster of matches. Each card dynamically adopts the primary jersey color of the competing teams to enhance visual identification! You can also toggle 'Compare Mode' here.",
      position: "left-deck",
      icon: "🥋"
    },
    {
      title: "📊 Side-by-Side Poisson Radar & ELO Ratios",
      description: "Take advantage of our brand new 'Rivalry Intensity Index' overlay radar chart in the dashboard! See head-to-head metrics comparing Attacking, Defensive Discipline, Midfield Speed, and Clash Volatility in real-time.",
      position: "radar-correlator",
      icon: "📐"
    },
    {
      title: "📈 Poisson Predictions & ELO Trendline",
      description: "Under the 'Predictive Poisson Trend Engine' widget, you can analyze a calculated 5-step rolling forecast. Seamlessly toggle between historical ELO ratings and future Poisson expectations curves!",
      position: "trendline-widget",
      icon: "📉"
    },
    {
      title: "📥 Pro Report Exports",
      description: "Generate structured, professional report documents instantly! Click 'Export Report' on any selected match to compile a beautifully formatted PDF containing all analytical matrices and field logs.",
      position: "export-report",
      icon: "📄"
    },
    {
      title: "⌨️ Speed Keyboard Commands",
      description: "Navigate with ultimate professional keyboard workflow speed: Press 'D' (Dashboard command station), 'M' (Cycle selected matches), 'A' (Admin panel view), 'E' (Export report PDF), 'C' (Toggle Match Compare Mode), or 'H' to show this guide!",
      position: "shortcuts",
      icon: "⌨️"
    }
  ];

  const handleNext = () => {
    triggerHaptic("light");
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    triggerHaptic("light");
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    triggerHaptic("success");
    localStorage.setItem("kickiq_tour_completed", "true");
    onClose();
  };

  const step = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none animate-fade-in">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.15)] overflow-hidden flex flex-col relative"
        id="interactive-tour-card"
      >
        {/* Top bar with tiny sparkles */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-slate-900 to-teal-500/10 h-1.5 w-full" />
        
        {/* Absolute close button */}
        <button 
          onClick={handleComplete}
          className="absolute top-4 right-4 text-slate-550 hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card Body */}
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner animate-bounce mb-2">
            {step.icon}
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Guide Step {currentStep + 1} of {tourSteps.length}
            </span>
            <h3 className="text-sm font-black uppercase text-slate-105 tracking-wider font-mono">
              {step.title}
            </h3>
          </div>

          <p className="text-[10.5px] text-slate-400 leading-relaxed max-w-sm mx-auto font-sans font-medium min-h-[64px]">
            {step.description}
          </p>
        </div>

        {/* Navigation Controls in Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-850/80 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase font-mono px-3 py-1.5 rounded-lg border border-slate-800 transition-colors ${
              currentStep === 0 
                ? "opacity-30 cursor-not-allowed text-slate-650" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1">
            {tourSteps.map((_, idx) => (
              <span 
                key={idx} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "bg-emerald-400 w-3" : "bg-slate-800"
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase font-mono px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]"
          >
            <span>{currentStep === tourSteps.length - 1 ? "Finish" : "Next"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Keyboard short-cut tip line */}
        <div className="bg-slate-950/40 py-2 px-4 border-t border-slate-850/40 flex items-center justify-center gap-1.5 text-[8px] font-mono text-slate-500">
          <Keyboard className="w-3 h-3 text-slate-600" />
          <span>PRO TIP: Press <kbd className="bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-slate-400">Esc</kbd> or <kbd className="bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-slate-400">H</kbd> to skip/restart anytime</span>
        </div>
      </div>
    </div>
  );
}
