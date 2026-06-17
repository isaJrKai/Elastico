import { useEffect, useState } from "react";
import { Match } from "../types";

/**
 * Custom React hook that monitors live match status updates.
 * When a match transitions to "live" and reaches the exact "half-time" marker (minute 45),
 * it triggers a callback to invite the user to submit a custom predictive analysis.
 * 
 * @param match The current selected/detailed match to monitor
 * @param onHalftimeTrigger Callback of format (matchId: number) => void to fire when halftime is reached
 */
export function useHalftimeMonitor(
  match: Match | null,
  onHalftimeTrigger: (matchId: number) => void
) {
  // Store match IDs that have already triggered a halftime notice during the active session
  const [triggeredMatchIds, setTriggeredMatchIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!match) return;

    const isHalftime = match.status === "live" && match.simulation_minute === 45;
    const alreadyTriggered = triggeredMatchIds[match.id];

    if (isHalftime && !alreadyTriggered) {
      // Mark as triggered so we don't spam the user with redundant alerts during frequent polling ticks
      setTriggeredMatchIds((prev) => ({
        ...prev,
        [match.id]: true,
      }));

      // Fire the invitation callback
      onHalftimeTrigger(match.id);
    }

    // Reset the trigger if the match gets run again/reseeded (e.g. simulation minute returns to 0)
    if (match.status === "live" && match.simulation_minute === 0 && alreadyTriggered) {
      setTriggeredMatchIds((prev) => {
        const copy = { ...prev };
        delete copy[match.id];
        return copy;
      });
    }
  }, [match?.id, match?.status, match?.simulation_minute, onHalftimeTrigger, triggeredMatchIds]);
}
