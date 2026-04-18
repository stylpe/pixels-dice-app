import {
  createEmptyRollPairingState,
  type RollPairingState,
  registerDie,
  registerRoll,
} from "./roll-pairing";
import { evaluatePercentileTest } from "./rules";

export type PocResult = {
  tens: number;
  units: number;
  roll: number;
  target: number;
  success: boolean;
  successLevels: number;
  at: number;
};

export type PocSessionState = {
  target: number;
  pairing: RollPairingState;
  latestResult: PocResult | null;
  unsupportedReason: string | null;
};

const DEFAULT_TARGET = 50;

export function createPocSessionState(): PocSessionState {
  return {
    target: DEFAULT_TARGET,
    pairing: createEmptyRollPairingState(),
    latestResult: null,
    unsupportedReason: null,
  };
}

export function setPocTarget(
  state: PocSessionState,
  target: number,
): PocSessionState {
  return {
    ...state,
    target,
  };
}

export function registerPocDie(
  state: PocSessionState,
  die: { systemId: string; dieType: string; name: string },
): PocSessionState {
  const pairing = registerDie(state.pairing, die);

  return {
    ...state,
    pairing,
    unsupportedReason: pairing.unsupportedReason,
  };
}

export function registerPocRoll(
  state: PocSessionState,
  roll: { systemId: string; face: number; at: number },
): PocSessionState {
  const pairing = registerRoll(state.pairing, roll);

  if (!pairing.lastResult) {
    return {
      ...state,
      pairing,
    };
  }

  const evaluation = evaluatePercentileTest(
    state.target,
    pairing.lastResult.roll,
  );

  return {
    ...state,
    pairing,
    latestResult: {
      tens: pairing.lastResult.tens,
      units: pairing.lastResult.units,
      roll: pairing.lastResult.roll,
      target: state.target,
      success: evaluation.success,
      successLevels: evaluation.successLevels,
      at: pairing.lastResult.at,
    },
  };
}
