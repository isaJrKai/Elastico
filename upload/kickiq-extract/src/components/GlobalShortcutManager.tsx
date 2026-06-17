import React, { useEffect } from "react";
import { triggerHaptic } from "../utils/haptics";

interface GlobalShortcutManagerProps {
  onSwitchTab: (tab: "dashboard" | "admin") => void;
  onCycleMatch: () => void;
  onToggleCompare: () => void;
  onExportReport: () => void;
  onOpenTour: () => void;
}

export default function GlobalShortcutManager({
  onSwitchTab,
  onCycleMatch,
  onToggleCompare,
  onExportReport,
  onOpenTour,
}: GlobalShortcutManagerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore standard input nodes to allow typing freely
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      // Read uppercase trigger
      const key = e.key.toUpperCase();

      switch (key) {
        case "D":
          e.preventDefault();
          triggerHaptic("medium");
          onSwitchTab("dashboard");
          break;
        case "A":
          e.preventDefault();
          triggerHaptic("medium");
          onSwitchTab("admin");
          break;
        case "M":
          e.preventDefault();
          triggerHaptic("light");
          onCycleMatch();
          break;
        case "C":
          e.preventDefault();
          triggerHaptic("light");
          onToggleCompare();
          break;
        case "E":
          e.preventDefault();
          triggerHaptic("heavy");
          onExportReport();
          break;
        case "H":
          e.preventDefault();
          triggerHaptic("success");
          onOpenTour();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSwitchTab, onCycleMatch, onToggleCompare, onExportReport, onOpenTour]);

  return null; // Pure functional behavioral manager
}
