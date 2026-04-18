import { describe, expect, it } from "vitest";

import { combinePercentileRoll, evaluatePercentileTest } from "./rules";

describe("combinePercentileRoll", () => {
  it("combines tens and units dice into a percentile roll", () => {
    expect(combinePercentileRoll(50, 4)).toBe(54);
    expect(combinePercentileRoll(20, 9)).toBe(29);
  });

  it("treats double zero as 100", () => {
    expect(combinePercentileRoll(0, 0)).toBe(100);
  });
});

describe("evaluatePercentileTest", () => {
  it("marks passing rolls and computes success levels", () => {
    expect(evaluatePercentileTest(54, 34)).toEqual({
      target: 54,
      roll: 34,
      success: true,
      successLevels: 2,
    });
  });

  it("marks failing rolls and computes negative success levels", () => {
    expect(evaluatePercentileTest(54, 73)).toEqual({
      target: 54,
      roll: 73,
      success: false,
      successLevels: -2,
    });
  });

  it("treats 100 as worst possible failure", () => {
    expect(evaluatePercentileTest(54, 100)).toEqual({
      target: 54,
      roll: 100,
      success: false,
      successLevels: -5,
    });
  });
});
