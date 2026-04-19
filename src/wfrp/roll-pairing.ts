import { combinePercentileRoll } from "./rules";

const PAIRING_WINDOW_MS = 250;

type SupportedDieType = "d00" | "d10";

type RegisteredDie = {
  systemId: string;
  dieType: SupportedDieType;
  name: string;
};

type UnsupportedDie = {
  systemId: string;
  dieType: string;
  name: string;
};

type PendingRoll = {
  systemId: string;
  face: number;
  at: number;
};

type CombinedRoll = {
  tens: number;
  units: number;
  roll: number;
  at: number;
};

export type RollPairingState = {
  tensDie: RegisteredDie | null;
  unitsDie: RegisteredDie | null;
  unsupportedDie: UnsupportedDie | null;
  unsupportedReason: string | null;
  pendingTensRoll: PendingRoll | null;
  pendingUnitsRoll: PendingRoll | null;
  lastResult: CombinedRoll | null;
};

export function createEmptyRollPairingState(): RollPairingState {
  return {
    tensDie: null,
    unitsDie: null,
    unsupportedDie: null,
    unsupportedReason: null,
    pendingTensRoll: null,
    pendingUnitsRoll: null,
    lastResult: null,
  };
}

export function registerDie(
  state: RollPairingState,
  die: { systemId: string; dieType: string; name: string },
): RollPairingState {
  if (die.dieType === "d00") {
    const tensDie: RegisteredDie = {
      systemId: die.systemId,
      dieType: "d00",
      name: die.name,
    };

    return {
      ...state,
      tensDie,
      unsupportedDie: null,
      unsupportedReason: null,
    };
  }

  if (die.dieType === "d10") {
    const unitsDie: RegisteredDie = {
      systemId: die.systemId,
      dieType: "d10",
      name: die.name,
    };

    return {
      ...state,
      unitsDie,
      unsupportedDie: null,
      unsupportedReason: null,
    };
  }

  return {
    ...state,
    unsupportedDie: die,
    unsupportedReason:
      "Unsupported die type for v1. Official Pixels d10 and d00 required.",
  };
}

export function registerRoll(
  state: RollPairingState,
  roll: { systemId: string; face: number; at: number },
): RollPairingState {
  if (state.tensDie?.systemId === roll.systemId) {
    return pairRolls({
      ...state,
      pendingTensRoll: roll,
    });
  }

  if (state.unitsDie?.systemId === roll.systemId) {
    return pairRolls({
      ...state,
      pendingUnitsRoll: roll,
    });
  }

  return state;
}

function pairRolls(state: RollPairingState): RollPairingState {
  const { pendingTensRoll, pendingUnitsRoll } = state;

  if (!pendingTensRoll || !pendingUnitsRoll) {
    return {
      ...state,
      lastResult: null,
    };
  }

  const timeDelta = Math.abs(pendingTensRoll.at - pendingUnitsRoll.at);

  if (timeDelta > PAIRING_WINDOW_MS) {
    const keepTensRoll = pendingTensRoll.at > pendingUnitsRoll.at;

    return {
      ...state,
      pendingTensRoll: keepTensRoll ? pendingTensRoll : null,
      pendingUnitsRoll: keepTensRoll ? null : pendingUnitsRoll,
      lastResult: null,
    };
  }

  return {
    ...state,
    pendingTensRoll: null,
    pendingUnitsRoll: null,
    lastResult: {
      tens: pendingTensRoll.face,
      units: pendingUnitsRoll.face,
      roll: combinePercentileRoll(pendingTensRoll.face, pendingUnitsRoll.face),
      at: Math.max(pendingTensRoll.at, pendingUnitsRoll.at),
    },
  };
}
