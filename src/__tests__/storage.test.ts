import { afterEach, describe, expect, it } from "vitest";
import { getItem, loadJSON, removeItem, saveJSON, setItem } from "../storage";

const original = globalThis.localStorage;

afterEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = original;
});

describe("storage helpers (private-mode Safari and corrupt payloads)", () => {
  it("round-trips strings and JSON through the in-memory storage", () => {
    setItem("mounthope.test.string", "harbor");
    expect(getItem("mounthope.test.string")).toBe("harbor");
    expect(getItem("mounthope.test.missing", "fallback")).toBe("fallback");

    saveJSON("mounthope.test.json", { quality: 0, hidden: ["menu"] });
    expect(loadJSON("mounthope.test.json", { quality: 1, hidden: [] })).toEqual({
      quality: 0,
      hidden: ["menu"],
    });
  });

  it("returns the fallback for malformed JSON instead of throwing", () => {
    localStorage.setItem("mounthope.test.bad", "{");
    expect(loadJSON("mounthope.test.bad", { ok: false })).toEqual({ ok: false });
  });

  it("returns the fallback and swallows writes when storage throws", () => {
    const throwing = {
      get length() {
        throw new Error("denied");
      },
      clear() {
        throw new Error("denied");
      },
      getItem() {
        throw new Error("private mode");
      },
      key() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("quota");
      },
    } as unknown as Storage;
    (globalThis as { localStorage?: Storage }).localStorage = throwing;

    expect(getItem("mounthope.touchlayout.v3", null)).toBeNull();
    expect(loadJSON("mounthope.settings.v1", { quality: 1 })).toEqual({ quality: 1 });
    expect(() => setItem("mounthope.debug", "1")).not.toThrow();
    expect(() => saveJSON("mounthope.settings.v1", { quality: 0 })).not.toThrow();
    expect(() => removeItem("mounthope.debug", "mounthope.settings.v1")).not.toThrow();
  });

  it("removes every requested key when storage works", () => {
    localStorage.setItem("mounthope.a", "1");
    localStorage.setItem("mounthope.b", "2");
    removeItem("mounthope.a", "mounthope.b");
    expect(localStorage.getItem("mounthope.a")).toBeNull();
    expect(localStorage.getItem("mounthope.b")).toBeNull();
  });
});
