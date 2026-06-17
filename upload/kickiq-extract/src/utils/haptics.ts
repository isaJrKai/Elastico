// Simple helper to trigger browser-native haptic vibration feedback for mobile devices
export function triggerHaptic(type: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
    try {
      switch (type) {
        case "light":
          window.navigator.vibrate(15);
          break;
        case "medium":
          window.navigator.vibrate(35);
          break;
        case "heavy":
          window.navigator.vibrate(60);
          break;
        case "success":
          window.navigator.vibrate([15, 30, 20]);
          break;
        case "error":
          window.navigator.vibrate([55, 75]);
          break;
      }
    } catch (e) {
      // Ignored silently or unsupported
    }
  }
}
