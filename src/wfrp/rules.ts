export type PercentileTestResult = {
  target: number;
  roll: number;
  success: boolean;
  successLevels: number;
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

function getTensDigit(value: number): number {
  if (value >= 100) {
    return 10;
  }

  return Math.floor(value / 10);
}
