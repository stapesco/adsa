import { describe, expect, it, vi } from "vitest";

import { withAdsaLogging, type LoggerLike } from "../src/lib/instrument.js";

function makeLogger() {
  const calls: Array<{ obj: Record<string, unknown>; msg?: string }> = [];
  const log: LoggerLike = {
    info: (obj, msg) => {
      calls.push({ obj, msg });
    },
  };
  return { log, calls };
}

describe("withAdsaLogging", () => {
  it("emits adsa_path: fast when predicate succeeds", async () => {
    const { log, calls } = makeLogger();
    const result = await withAdsaLogging({
      area: "auth",
      predicate: () => true,
      slowPath: () => "slow",
      log,
    });
    expect(result.path).toBe("fast");
    expect((result as { value: boolean }).value).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0]!.obj.adsa_path).toBe("fast");
    expect(calls[0]!.obj.adsa_area).toBe("auth");
  });

  it("emits adsa_path: slow when predicate throws", async () => {
    const { log, calls } = makeLogger();
    const result = await withAdsaLogging({
      area: "auth",
      predicate: () => {
        throw new Error("token invalid");
      },
      slowPath: () => "session",
      log,
    });
    expect(result.path).toBe("slow");
    expect((result as { value: string }).value).toBe("session");
    expect(calls.length).toBe(1);
    expect(calls[0]!.obj.adsa_path).toBe("slow");
    expect(calls[0]!.obj.adsa_reason).toBe("predicate_threw");
  });

  it("emits adsa_path: slow when forceSlow is true", async () => {
    const { log, calls } = makeLogger();
    const result = await withAdsaLogging({
      area: "auth",
      predicate: () => "fast",
      slowPath: () => "slow",
      log,
      forceSlow: true,
    });
    expect(result.path).toBe("slow");
    expect(calls[0]!.obj.adsa_path).toBe("slow");
    expect(calls[0]!.obj.adsa_reason).toBe("force_slow");
  });

  it("supports async predicate and slowPath", async () => {
    const { log, calls } = makeLogger();
    const predicate = vi.fn(async () => 42);
    const slowPath = vi.fn(async () => "slow-value");
    const result = await withAdsaLogging({
      area: "permission",
      predicate,
      slowPath,
      log,
    });
    expect(result.path).toBe("fast");
    expect((result as { value: number }).value).toBe(42);
    expect(predicate).toHaveBeenCalledOnce();
    expect(slowPath).not.toHaveBeenCalled();
    expect(calls[0]!.obj.adsa_area).toBe("permission");
  });
});
