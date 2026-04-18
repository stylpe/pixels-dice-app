import { describe, expect, it } from "vitest";

import {
  createPocSessionState,
  registerPocDie,
  registerPocRoll,
  setAttackDamageBonus,
  setAttackMode,
  setCriticalHitLocationRoll,
  setDefenderSuccessLevels,
  setOpposed,
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

    expect(afterUnits.latestResult).toMatchObject({
      tens: 30,
      units: 4,
      roll: 34,
      target: 54,
      success: true,
      resolution: "success",
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

  it("evaluates attack mode fields on successful paired roll", () => {
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

    const withAttack = setAttackDamageBonus(
      setAttackMode(setPocTarget(withDice, 54), true),
      4,
    );
    const afterTens = registerPocRoll(withAttack, {
      systemId: "tens-1",
      face: 30,
      at: 1_000,
    });
    const afterUnits = registerPocRoll(afterTens, {
      systemId: "units-1",
      face: 4,
      at: 1_120,
    });

    expect(afterUnits.latestResult).toMatchObject({
      roll: 34,
      target: 54,
      success: true,
      successLevels: 2,
      resolution: "success",
      isAttackMode: true,
      damageBonus: 4,
      isOpposed: false,
      defenderSuccessLevels: 0,
      rawDamage: 6,
      isCritical: false,
      isFumble: false,
      hitLocation: "Right Arm",
      hitLocationRoll: 43,
    });
  });

  it("recomputes attack result when opposed fields change after a roll", () => {
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

    const rolled = registerPocRoll(
      registerPocRoll(
        setAttackDamageBonus(
          setAttackMode(setPocTarget(withDice, 62), true),
          5,
        ),
        {
          systemId: "tens-1",
          face: 10,
          at: 1_000,
        },
      ),
      {
        systemId: "units-1",
        face: 2,
        at: 1_120,
      },
    );

    const opposed = setDefenderSuccessLevels(setOpposed(rolled, true), 2);

    expect(opposed.latestResult).toMatchObject({
      roll: 12,
      resolution: "success",
      successLevels: 5,
      isOpposed: true,
      defenderSuccessLevels: 2,
      rawDamage: 8,
    });
  });

  it("marks equal opposed SL as tie-breaker while showing provisional damage", () => {
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

    const rolled = registerPocRoll(
      registerPocRoll(
        setAttackDamageBonus(
          setAttackMode(setPocTarget(withDice, 62), true),
          5,
        ),
        {
          systemId: "tens-1",
          face: 10,
          at: 1_000,
        },
      ),
      {
        systemId: "units-1",
        face: 2,
        at: 1_120,
      },
    );

    const opposed = setDefenderSuccessLevels(setOpposed(rolled, true), 5);

    expect(opposed.latestResult).toMatchObject({
      roll: 12,
      success: true,
      resolution: "tie-breaker",
      successLevels: 5,
      isOpposed: true,
      defenderSuccessLevels: 5,
      rawDamage: 5,
      hitLocation: "Left Arm",
    });
  });

  it("marks attack as failed when opponent SL becomes higher", () => {
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

    const rolled = registerPocRoll(
      registerPocRoll(
        setAttackDamageBonus(
          setAttackMode(setPocTarget(withDice, 62), true),
          5,
        ),
        {
          systemId: "tens-1",
          face: 10,
          at: 1_000,
        },
      ),
      {
        systemId: "units-1",
        face: 2,
        at: 1_120,
      },
    );

    const opposed = setDefenderSuccessLevels(setOpposed(rolled, true), 6);

    expect(opposed.latestResult).toMatchObject({
      roll: 12,
      success: false,
      resolution: "failure",
      successLevels: 5,
      isOpposed: true,
      defenderSuccessLevels: 6,
      rawDamage: null,
      hitLocation: null,
    });
  });

  it("recomputes hit location when critical reroll is supplied", () => {
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

    const rolled = registerPocRoll(
      registerPocRoll(
        setAttackDamageBonus(
          setAttackMode(setPocTarget(withDice, 55), true),
          4,
        ),
        {
          systemId: "tens-1",
          face: 40,
          at: 1_000,
        },
      ),
      {
        systemId: "units-1",
        face: 4,
        at: 1_120,
      },
    );

    const withCritReroll = setCriticalHitLocationRoll(rolled, 18);

    expect(withCritReroll.latestResult).toMatchObject({
      roll: 44,
      isCritical: true,
      resolution: "success",
      hitLocationRoll: 18,
      hitLocation: "Left Arm",
    });
  });
});
