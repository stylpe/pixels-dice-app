import {
  createEmptyRollPairingState,
  type RollPairingState,
  registerDie,
  registerRoll,
} from "./roll-pairing";
import { evaluateAttackTest, evaluatePercentileTest } from "./rules";

export type PocResult = {
  tens: number;
  units: number;
  roll: number;
  target: number;
  success: boolean;
  resolution: "success" | "failure" | "tie-breaker";
  successLevels: number;
  at: number;
  isAttackMode: boolean;
  damageBonus: number;
  isOpposed: boolean;
  defenderSuccessLevels: number;
  isCritical: boolean;
  isFumble: boolean;
  hitLocation: string | null;
  hitLocationRoll: number | null;
  rawDamage: number | null;
};

export type AttackOptions = {
  enabled: boolean;
  damageBonus: number;
  isOpposed: boolean;
  defenderSuccessLevels: number;
  criticalHitLocationRoll: number | null;
};

export type PocSessionState = {
  target: number;
  attack: AttackOptions;
  pairing: RollPairingState;
  latestResult: PocResult | null;
  unsupportedReason: string | null;
};

const DEFAULT_TARGET = 50;

export function createPocSessionState(): PocSessionState {
  return {
    target: DEFAULT_TARGET,
    attack: {
      enabled: false,
      damageBonus: 0,
      isOpposed: false,
      defenderSuccessLevels: 0,
      criticalHitLocationRoll: null,
    },
    pairing: createEmptyRollPairingState(),
    latestResult: null,
    unsupportedReason: null,
  };
}

export function setPocTarget(
  state: PocSessionState,
  target: number,
): PocSessionState {
  return recomputeLatestResult({
    ...state,
    target,
  });
}

export function setAttackMode(
  state: PocSessionState,
  enabled: boolean,
): PocSessionState {
  return recomputeLatestResult({
    ...state,
    attack: {
      ...state.attack,
      enabled,
    },
  });
}

export function setAttackDamageBonus(
  state: PocSessionState,
  damageBonus: number,
): PocSessionState {
  return recomputeLatestResult({
    ...state,
    attack: {
      ...state.attack,
      damageBonus,
    },
  });
}

export function setOpposed(
  state: PocSessionState,
  isOpposed: boolean,
): PocSessionState {
  return recomputeLatestResult({
    ...state,
    attack: {
      ...state.attack,
      isOpposed,
    },
  });
}

export function setDefenderSuccessLevels(
  state: PocSessionState,
  defenderSuccessLevels: number,
): PocSessionState {
  return recomputeLatestResult({
    ...state,
    attack: {
      ...state.attack,
      defenderSuccessLevels,
    },
  });
}

export function setCriticalHitLocationRoll(
  state: PocSessionState,
  criticalHitLocationRoll: number | null,
): PocSessionState {
  return recomputeLatestResult({
    ...state,
    attack: {
      ...state.attack,
      criticalHitLocationRoll,
    },
  });
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

  return recomputeLatestResult({
    ...state,
    pairing,
  });
}

function recomputeLatestResult(state: PocSessionState): PocSessionState {
  const latestPair = state.pairing.lastResult;

  if (!latestPair) {
    return {
      ...state,
      latestResult: null,
    };
  }

  if (!state.attack.enabled) {
    const evaluation = evaluatePercentileTest(state.target, latestPair.roll);

    return {
      ...state,
      latestResult: {
        tens: latestPair.tens,
        units: latestPair.units,
        roll: latestPair.roll,
        target: state.target,
        success: evaluation.success,
        resolution: evaluation.success ? "success" : "failure",
        successLevels: evaluation.successLevels,
        at: latestPair.at,
        isAttackMode: false,
        damageBonus: state.attack.damageBonus,
        isOpposed: state.attack.isOpposed,
        defenderSuccessLevels: state.attack.defenderSuccessLevels,
        isCritical: false,
        isFumble: false,
        hitLocation: null,
        hitLocationRoll: null,
        rawDamage: null,
      },
    };
  }

  const attackResult = evaluateAttackTest({
    target: state.target,
    roll: latestPair.roll,
    damageBonus: state.attack.damageBonus,
    isOpposed: state.attack.isOpposed,
    defenderSuccessLevels: state.attack.defenderSuccessLevels,
    criticalHitLocationRoll: state.attack.criticalHitLocationRoll ?? undefined,
  });

  return {
    ...state,
    latestResult: {
      tens: latestPair.tens,
      units: latestPair.units,
      roll: latestPair.roll,
      target: state.target,
      success: attackResult.success,
      resolution: attackResult.resolution,
      successLevels: attackResult.successLevels,
      at: latestPair.at,
      isAttackMode: true,
      damageBonus: state.attack.damageBonus,
      isOpposed: state.attack.isOpposed,
      defenderSuccessLevels: state.attack.defenderSuccessLevels,
      isCritical: attackResult.isCritical,
      isFumble: attackResult.isFumble,
      hitLocation: attackResult.hitLocation,
      hitLocationRoll: attackResult.hitLocationRoll,
      rawDamage: attackResult.rawDamage,
    },
  };
}
