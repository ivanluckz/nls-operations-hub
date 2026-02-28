/**
 * Dev badge utilities — shared across components.
 * Dev badge holders get special perks:
 * - Rainbow glow name (CSS class: dev-name-glow)
 * - Glowing message border (CSS class: dev-msg-glow)
 * - Spinning rainbow avatar ring (CSS class: dev-ring)
 * - Animated nameplate behind display name (CSS class: dev-nameplate)
 * - Animated profile card banner + floating particles
 * - Bypass badge approval
 * - Admin-lite read-only access
 */

/** Check if a user's badges include "Dev" */
export function isDevUser(badges: string[]): boolean {
  return badges.includes("Dev");
}

/** CSS class for a Dev user's display name */
export function devNameClass(badges: string[]): string {
  return isDevUser(badges) ? "dev-name-glow" : "";
}

/** CSS class for a Dev user's message row */
export function devMsgClass(badges: string[]): string {
  return isDevUser(badges) ? "dev-msg-glow" : "";
}

/** Wrapper div class for a Dev user's avatar (spinning rainbow ring decoration) */
export function devAvatarClass(badges: string[]): string {
  return isDevUser(badges) ? "dev-ring" : "";
}

/** CSS class for the nameplate background behind a Dev user's display name */
export function devNameplateClass(badges: string[]): string {
  return isDevUser(badges) ? "dev-nameplate" : "";
}
