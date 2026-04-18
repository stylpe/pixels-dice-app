import { describe, expect, it } from "vitest";

import {
  combinePercentileRoll,
  evaluateAttackTest,
  evaluatePercentileTest,
  getHitLocation,
} from "./rules";

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

describe("getHitLocation", () => {
  it("maps reversed roll bands to hit locations", () => {
    expect(getHitLocation(18)).toBe("Left Arm");
    expect(getHitLocation(43)).toBe("Right Arm");
    expect(getHitLocation(70)).toBe("Body");
    expect(getHitLocation(84)).toBe("Left Leg");
    expect(getHitLocation(97)).toBe("Right Leg");
  });
});

describe("evaluateAttackTest", () => {
  it("calculates unopposed raw damage on success", () => {
    expect(
      evaluateAttackTest({
        target: 54,
        roll: 34,
        damageBonus: 4,
        isOpposed: false,
      }),
    ).toEqual({
      target: 54,
      roll: 34,
      success: true,
      successLevels: 2,
      resolution: "success",
      isCritical: false,
      isFumble: false,
      hitLocation: "Right Arm",
      hitLocationRoll: 43,
      rawDamage: 6,
    });
  });

  it("uses rerolled hit location on critical hit", () => {
    expect(
      evaluateAttackTest({
        target: 55,
        roll: 44,
        damageBonus: 4,
        isOpposed: false,
        criticalHitLocationRoll: 18,
      }),
    ).toEqual({
      target: 55,
      roll: 44,
      success: true,
      successLevels: 1,
      resolution: "success",
      isCritical: true,
      isFumble: false,
      hitLocation: "Left Arm",
      hitLocationRoll: 18,
      rawDamage: 5,
    });
  });

  it("keeps critical hit location pending until reroll is supplied", () => {
    expect(
      evaluateAttackTest({
        target: 55,
        roll: 44,
        damageBonus: 4,
        isOpposed: false,
      }),
    ).toEqual({
      target: 55,
      roll: 44,
      success: true,
      successLevels: 1,
      resolution: "success",
      isCritical: true,
      isFumble: false,
      hitLocation: null,
      hitLocationRoll: null,
      rawDamage: 5,
    });
  });

  it("subtracts defender SL for opposed attacks", () => {
    expect(
      evaluateAttackTest({
        target: 62,
        roll: 12,
        damageBonus: 5,
        isOpposed: true,
        defenderSuccessLevels: 2,
      }),
    ).toEqual({
      target: 62,
      roll: 12,
      success: true,
      successLevels: 5,
      resolution: "success",
      isCritical: false,
      isFumble: false,
      hitLocation: "Left Arm",
      hitLocationRoll: 21,
      rawDamage: 8,
    });
  });

  it("marks equal opposed SL as tie-breaker and keeps provisional outputs", () => {
    expect(
      evaluateAttackTest({
        target: 62,
        roll: 12,
        damageBonus: 5,
        isOpposed: true,
        defenderSuccessLevels: 5,
      }),
    ).toEqual({
      target: 62,
      roll: 12,
      success: true,
      successLevels: 5,
      resolution: "tie-breaker",
      isCritical: false,
      isFumble: false,
      hitLocation: "Left Arm",
      hitLocationRoll: 21,
      rawDamage: 5,
    });
  });

  it("fails opposed attacks when defender SL is higher", () => {
    expect(
      evaluateAttackTest({
        target: 62,
        roll: 12,
        damageBonus: 5,
        isOpposed: true,
        defenderSuccessLevels: 6,
      }),
    ).toEqual({
      target: 62,
      roll: 12,
      success: false,
      successLevels: 5,
      resolution: "failure",
      isCritical: false,
      isFumble: false,
      hitLocation: null,
      hitLocationRoll: null,
      rawDamage: null,
    });
  });

  it("marks doubles on failed attack as fumble and no damage", () => {
    expect(
      evaluateAttackTest({
        target: 41,
        roll: 88,
        damageBonus: 5,
        isOpposed: true,
        defenderSuccessLevels: 3,
      }),
    ).toEqual({
      target: 41,
      roll: 88,
      success: false,
      successLevels: -4,
      resolution: "failure",
      isCritical: false,
      isFumble: true,
      hitLocation: null,
      hitLocationRoll: null,
      rawDamage: null,
    });
  });
});
