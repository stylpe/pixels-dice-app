import { describe, expect, it } from "vitest";

import {
  createPocSessionState,
  registerPocDie,
  registerPocRoll,
  setPocTarget,
} from "./poc-session";

describe("poc session", () => {
  it("evaluates paired roll against current target", () => {
    const withDice = registerPocDie(
      registerPocDie(createPocSessionState(), {
        systemId: "tens-1",
        dieType: "d00",
        name: "Pixels Tens",
      }),
      {
        systemId: "units-1",
        dieType: "d10",
        name: "Pixels Units",
      },
    );

    const withTarget = setPocTarget(withDice, 54);
    const afterTens = registerPocRoll(withTarget, {
      systemId: "tens-1",
      face: 30,
      at: 1_000,
    });
    const afterUnits = registerPocRoll(afterTens, {
      systemId: "units-1",
      face: 4,
      at: 1_140,
    });

    expect(afterUnits.latestResult).toEqual({
      tens: 30,
      units: 4,
      roll: 34,
      target: 54,
      success: true,
      successLevels: 2,
      at: 1_140,
    });
  });

  it("updates target without clearing previous dice registration", () => {
    const state = setPocTarget(createPocSessionState(), 67);

    expect(state.target).toBe(67);
    expect(state.pairing.tensDie).toBeNull();
    expect(state.pairing.unitsDie).toBeNull();
  });

  it("surfaces unsupported die reason from pairing state", () => {
    const state = registerPocDie(createPocSessionState(), {
      systemId: "weird-1",
      dieType: "unknown",
      name: "Mystery Die",
    });

    expect(state.unsupportedReason).toContain("Unsupported die type");
  });
});
