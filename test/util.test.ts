import { describe, expect, it } from "vitest";

import { inferAdsaArea } from "../src/util.js";

describe("inferAdsaArea", () => {
  it("uses the innermost non-generic directory as the area", () => {
    expect(inferAdsaArea("src/auth/login.ts")).toBe("auth");
    expect(inferAdsaArea("src/payments/checkout.ts")).toBe("payments");
    expect(inferAdsaArea("src/services/notifications/dispatch.ts")).toBe(
      "notifications",
    );
  });

  it("falls back to the file basename when the path is generic-only", () => {
    expect(inferAdsaArea("src/index.ts")).toBe("index");
    expect(inferAdsaArea("lib/util.ts")).toBe("util");
  });

  it("is deterministic across runs", () => {
    const a = inferAdsaArea("src/auth/login.ts");
    const b = inferAdsaArea("src/auth/login.ts");
    expect(a).toBe(b);
  });
});
