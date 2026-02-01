import { describe, it, expect } from "vitest";
import {
  getRouteKind,
  getRedirectForUnauthenticated,
  getRedirectForNoMemberships,
  getRedirectForNoWorkspace,
  ROUTE_KINDS,
} from "./routes";

describe("getRouteKind", () => {
  it("classifies /signin as public", () => {
    expect(getRouteKind("/signin")).toBe("public");
    expect(getRouteKind("/signin/")).toBe("public");
  });

  it("classifies /onboarding and /select-workspace as setup", () => {
    expect(getRouteKind("/onboarding")).toBe("setup");
    expect(getRouteKind("/select-workspace")).toBe("setup");
  });

  it("classifies app routes as app", () => {
    expect(getRouteKind("/contracts")).toBe("app");
    expect(getRouteKind("/policies")).toBe("app");
    expect(getRouteKind("/exceptions")).toBe("app");
    expect(getRouteKind("/ledger")).toBe("app");
    expect(getRouteKind("/settings")).toBe("app");
    expect(getRouteKind("/settings/members")).toBe("app");
  });

  it("classifies root as public", () => {
    expect(getRouteKind("/")).toBe("public");
  });

  it("is deterministic: same path returns same kind", () => {
    for (const path of ["/signin", "/onboarding", "/select-workspace", "/contracts"]) {
      const a = getRouteKind(path);
      const b = getRouteKind(path);
      expect(a).toBe(b);
    }
  });
});

describe("routing matrix (no loops)", () => {
  it("unauthed -> signin", () => {
    expect(getRedirectForUnauthenticated("/")).toBe("/signin");
    expect(getRedirectForUnauthenticated("/contracts")).toBe("/signin");
    expect(getRedirectForUnauthenticated("/onboarding")).toBe("/signin");
  });

  it("authed + no memberships -> onboarding", () => {
    expect(getRedirectForNoMemberships("/")).toBe("/onboarding");
    expect(getRedirectForNoMemberships("/contracts")).toBe("/onboarding");
  });

  it("authed + memberships but no workspace -> select-workspace", () => {
    expect(getRedirectForNoWorkspace("/")).toBe("/select-workspace");
    expect(getRedirectForNoWorkspace("/contracts")).toBe("/select-workspace");
  });
});

describe("setup routes are never app", () => {
  it("onboarding and select-workspace are setup only", () => {
    const setupPaths = Array.from(ROUTE_KINDS.setup);
    for (const path of setupPaths) {
      expect(getRouteKind(path)).toBe("setup");
      expect(getRouteKind(path)).not.toBe("app");
    }
  });

  it("app routes do not include onboarding or select-workspace", () => {
    expect(ROUTE_KINDS.app.has("/onboarding")).toBe(false);
    expect(ROUTE_KINDS.app.has("/select-workspace")).toBe(false);
  });
});
