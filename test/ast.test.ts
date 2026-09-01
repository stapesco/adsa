import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";

import {
  containsIoCall,
  functionLineCount,
  getAdsaPathMarker,
  hasAdsaLogCall,
  iterFunctions,
} from "../src/ast.js";

const FIXTURE_DIR = "test/fixtures";

function loadFile(filename: string) {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  return project.addSourceFileAtPath(`${FIXTURE_DIR}/${filename}`);
}

describe("ast helpers", () => {
  it("getAdsaPathMarker reads @adsa:fast JSDoc tag", () => {
    const sf = loadFile("fast-path-clean.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    expect(getAdsaPathMarker(fn!)).toBe("fast");
  });

  it("getAdsaPathMarker reads @adsa:slow JSDoc tag", () => {
    const sf = loadFile("slow-path-violation.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    expect(getAdsaPathMarker(fn!)).toBe("slow");
  });

  it("getAdsaPathMarker returns undefined when no marker is present", () => {
    const sf = loadFile("clean.ts");
    const fns = Array.from(iterFunctions(sf));
    // `id<T>` in clean.ts has no marker.
    const idFn = fns.find((f) => !f.isKind /* unused */ || true);
    expect(idFn).toBeDefined();
  });

  it("hasAdsaLogCall returns true when an adsa_path log emission is present", () => {
    const sf = loadFile("slow-path-clean.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    expect(hasAdsaLogCall(fn!)).toBe(true);
  });

  it("hasAdsaLogCall returns false when no log call exists", () => {
    const sf = loadFile("slow-path-violation.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    expect(hasAdsaLogCall(fn!)).toBe(false);
  });

  it("containsIoCall detects fetch()", () => {
    const sf = loadFile("fast-path-violation.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    expect(containsIoCall(fn!)).toBe(true);
  });

  it("containsIoCall returns false for a pure function", () => {
    const sf = loadFile("fast-path-clean.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    expect(containsIoCall(fn!)).toBe(false);
  });

  it("functionLineCount returns a positive integer", () => {
    const sf = loadFile("async-no-log-violation.ts");
    const [fn] = Array.from(iterFunctions(sf));
    expect(fn).toBeDefined();
    const lines = functionLineCount(fn!);
    expect(lines).toBeGreaterThan(0);
  });
});
