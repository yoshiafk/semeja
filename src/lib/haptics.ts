/**
 * Utility for triggering haptic feedback using the navigator.vibrate API.
 * This is safe to call on devices that do not support vibration (e.g. desktop).
 */

export function triggerHaptic(type: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  if (typeof window === "undefined" || !navigator.vibrate) {
    return;
  }

  // Apple Design Principle 13: Multimodal feedback.
  // Match the character to the action's physicality.
  switch (type) {
    case "light":
      // A subtle bump for general interactions (e.g., tapping a tab, expanding an accordion)
      navigator.vibrate(10);
      break;
    case "medium":
      // A more pronounced bump (e.g., confirming a selection)
      navigator.vibrate(25);
      break;
    case "heavy":
      // A heavy hit (e.g., an important commit or boundary resistance)
      navigator.vibrate(50);
      break;
    case "success":
      // Two distinct taps
      navigator.vibrate([15, 100, 15]);
      break;
    case "error":
      // Three rapid taps
      navigator.vibrate([20, 50, 20, 50, 20]);
      break;
  }
}
