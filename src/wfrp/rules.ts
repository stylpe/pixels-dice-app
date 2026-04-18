export type PercentileTestResult = {
  target: number;
  roll: number;
  success: boolean;
  successLevels: number;
};

export type HitLocation =
  | "Head"
  | "Left Arm"
  | "Right Arm"
  | "Body"
  | "Left Leg"
  | "Right Leg";

export type AttackTestResult = PercentileTestResult & {
  resolution: "success" | "failure" | "tie-breaker";
  isCritical: boolean;
  isFumble: boolean;
  hitLocation: HitLocation | null;
  hitLocationRoll: number | null;
  rawDamage: number | null;
};

export type AttackTestInput = {
  target: number;
  roll: number;
  damageBonus: number;
  isOpposed: boolean;
  defenderSuccessLevels?: number;
  criticalHitLocationRoll?: number;
};

export function combinePercentileRoll(tens: number, units: number): number {
  if (tens === 0 && units === 0) {
    return 100;
  }

  return tens + units;
}

export function evaluatePercentileTest(
  target: number,
  roll: number,
): PercentileTestResult {
  return {
    target,
    roll,
    success: roll <= target && roll !== 100,
    successLevels: getTensDigit(target) - getTensDigit(roll),
  };
}

export function getHitLocation(hitLocationRoll: number): HitLocation {
  const normalizedRoll = normalizePercentileRoll(hitLocationRoll);

  if (normalizedRoll <= 9) {
    return "Head";
  }

  if (normalizedRoll <= 24) {
    return "Left Arm";
  }

  if (normalizedRoll <= 44) {
    return "Right Arm";
  }

  if (normalizedRoll <= 79) {
    return "Body";
  }

  if (normalizedRoll <= 89) {
    return "Left Leg";
  }

  return "Right Leg";
}

export function evaluateAttackTest({
  target,
  roll,
  damageBonus,
  isOpposed,
  defenderSuccessLevels = 0,
  criticalHitLocationRoll,
}: AttackTestInput): AttackTestResult {
  const baseResult = evaluatePercentileTest(target, roll);
  const isDouble = hasMatchingDigits(roll);
  const defenderSl = isOpposed ? defenderSuccessLevels : 0;
  const needsTieBreaker =
    isOpposed && baseResult.success && baseResult.successLevels === defenderSl;
  const attackSucceeds =
    baseResult.success &&
    (!isOpposed || baseResult.successLevels > defenderSl || needsTieBreaker);
  const isCritical = attackSucceeds && isDouble;
  const isFumble = !baseResult.success && isDouble;

  if (!attackSucceeds) {
    return {
      ...baseResult,
      success: false,
      resolution: "failure",
      isCritical,
      isFumble,
      hitLocation: null,
      hitLocationRoll: null,
      rawDamage: null,
    };
  }

  const hitLocationRoll = isCritical
    ? criticalHitLocationRoll === undefined
      ? null
      : normalizePercentileRoll(criticalHitLocationRoll)
    : reversePercentileRoll(roll);

  return {
    ...baseResult,
    success: true,
    resolution: needsTieBreaker ? "tie-breaker" : "success",
    isCritical,
    isFumble,
    hitLocation:
      hitLocationRoll === null ? null : getHitLocation(hitLocationRoll),
    hitLocationRoll,
    rawDamage: baseResult.successLevels + damageBonus - defenderSl,
  };
}

function getTensDigit(value: number): number {
  if (value >= 100) {
    return 10;
  }

  return Math.floor(value / 10);
}

function hasMatchingDigits(roll: number): boolean {
  const normalizedRoll = normalizePercentileRoll(roll);
  const tens = Math.floor(normalizedRoll / 10);
  const units = normalizedRoll % 10;

  return tens === units;
}

function reversePercentileRoll(roll: number): number {
  const normalizedRoll = normalizePercentileRoll(roll);
  const tens = Math.floor(normalizedRoll / 10);
  const units = normalizedRoll % 10;
  const reversed = units * 10 + tens;

  return reversed === 0 ? 100 : reversed;
}

function normalizePercentileRoll(roll: number): number {
  if (roll <= 0) {
    return 100;
  }

  if (roll > 100) {
    return 100;
  }

  return Math.trunc(roll);
}
