/**
 * Dev badge utilities — shared across components.
 * Dev badge holders get special perks:
 * - Rainbow glow name (CSS class: dev-name-glow)
 * - Glowing message border (CSS class: dev-msg-glow)
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
