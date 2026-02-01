/**
 * Deterministic route classification for auth/workspace guards.
 * Prevents redirect loops by ensuring setup routes never require workspace.
 */

export type RouteKind = "public" | "setup" | "app";

/** Paths that require no auth (public). */
const PUBLIC_PATHS = new Set(["/signin"]);

/** Paths that require auth only (no workspace). Must not be under (app) layout. */
const SETUP_PATHS = new Set(["/onboarding", "/select-workspace"]);

/** Paths that require auth + workspace (protected app). */
const APP_PATHS = new Set([
  "/contracts",
  "/policies",
  "/exceptions",
  "/ledger",
  "/settings",
  "/settings/members",
]);

/**
 * Classifies a pathname into public, setup, or app.
 * Deterministic: same path always returns same kind.
 */
export function getRouteKind(pathname: string): RouteKind {
  const path = pathname.replace(/\/$/, "") || "/";
  if (PUBLIC_PATHS.has(path)) return "public";
  if (SETUP_PATHS.has(path)) return "setup";
  if (APP_PATHS.has(path)) return "app";
  if (path.startsWith("/settings/")) return "app";
  return "public";
}

/**
 * Where an unauthenticated user should be sent.
 */
export function getRedirectForUnauthenticated(pathname: string): string {
  return "/signin";
}

/**
 * Where an authenticated user with no memberships should be sent.
 */
export function getRedirectForNoMemberships(_pathname: string): string {
  return "/onboarding";
}

/**
 * Where an authenticated user with memberships but no selected workspace should be sent.
 */
export function getRedirectForNoWorkspace(_pathname: string): string {
  return "/select-workspace";
}

export const ROUTE_KINDS = {
  public: PUBLIC_PATHS,
  setup: SETUP_PATHS,
  app: APP_PATHS,
} as const;
