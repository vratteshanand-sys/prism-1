import { describe, expect, it } from "vitest";
import { asArray, clampScore, normalizeSeverity, parseAiObject } from "./ai-result";
describe("model response boundaries", () => {
  it.each(["null", "[]", "3", '"hello"', "false", "{"])("rejects unusable JSON: %s", (raw) => expect(() => parseAiObject(raw)).toThrow());
  it("accepts an object", () => expect(parseAiObject('{"summary":"Done"}')).toEqual({ summary: "Done" }));
  it("removes null flags before route mapping and bounds the array", () => {
    expect(asArray([null, { sentence: "x" }, undefined])).toEqual([{ sentence: "x" }]);
    expect(asArray(Array.from({ length: 60 }, (_, n) => n))).toHaveLength(50);
    expect(asArray({})).toEqual([]);
  });
  it("clamps invalid and out-of-range risk scores", () => {
    expect(clampScore(NaN)).toBe(0);
    expect(clampScore(Infinity)).toBe(0);
    expect(clampScore(-4)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(24.7)).toBe(25);
    expect(normalizeSeverity("unexpected")).toBe("medium");
  });
});
