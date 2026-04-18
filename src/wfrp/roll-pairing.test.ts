import { describe, expect, it } from "vitest";

import {
  createEmptyRollPairingState,
  registerDie,
  registerRoll,
} from "./roll-pairing";

describe("registerDie", () => {
  it("assigns official Pixels d00 to tens and d10 to units", () => {
    const initial = createEmptyRollPairingState();

    const withTens = registerDie(initial, {
      systemId: "tens-1",
      dieType: "d00",
      name: "Pixels Tens",
    });

    const withUnits = registerDie(withTens, {
      systemId: "units-1",
      dieType: "d10",
      name: "Pixels Units",
    });

    expect(withUnits.tensDie?.systemId).toBe("tens-1");
    expect(withUnits.unitsDie?.systemId).toBe("units-1");
  });

  it("rejects unsupported die types for v1", () => {
    const state = registerDie(createEmptyRollPairingState(), {
      systemId: "weird-1",
      dieType: "unknown",
      name: "Mystery Die",
    });

    expect(state.unsupportedDie?.systemId).toBe("weird-1");
    expect(state.unsupportedReason).toContain("Unsupported die type");
  });
});

describe("registerRoll", () => {
  it("creates combined percentile result when both dice roll within pairing window", () => {
    const initial = registerDie(
      registerDie(createEmptyRollPairingState(), {
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

    const afterTens = registerRoll(initial, {
      systemId: "tens-1",
      face: 50,
      at: 1_000,
    });

    const afterUnits = registerRoll(afterTens, {
      systemId: "units-1",
      face: 4,
      at: 1_180,
    });

    expect(afterUnits.lastResult).toEqual({
      tens: 50,
      units: 4,
      roll: 54,
      at: 1_180,
    });
  });

  it("does not pair rolls outside pairing window", () => {
    const initial = registerDie(
      registerDie(createEmptyRollPairingState(), {
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

    const afterTens = registerRoll(initial, {
      systemId: "tens-1",
      face: 50,
      at: 1_000,
    });

    const afterUnits = registerRoll(afterTens, {
      systemId: "units-1",
      face: 4,
      at: 1_500,
    });

    expect(afterUnits.lastResult).toBeNull();
  });
});
