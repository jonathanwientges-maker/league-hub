import { describe, expect, it, beforeEach } from "vitest";
import { readCache, writeCache } from "./persistentCache";

describe("persistentCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null for a cold cache", () => {
    expect(readCache("missing-key")).toBeNull();
  });

  it("round-trips data with a timestamp, so a second read is instant with no refetch", () => {
    writeCache("k", { hello: "world" });
    const cached = readCache<{ hello: string }>("k");
    expect(cached?.data).toEqual({ hello: "world" });
    expect(typeof cached?.timestamp).toBe("number");
  });

  it("does not throw if localStorage.setItem fails", () => {
    const original = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(() => writeCache("k", { a: 1 })).not.toThrow();
    localStorage.setItem = original;
  });

  it("does not throw and returns null on corrupted JSON", () => {
    localStorage.setItem("k", "{not json");
    expect(readCache("k")).toBeNull();
  });
});
