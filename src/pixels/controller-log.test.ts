import { describe, expect, it } from "vitest";

import {
  createLogEntry,
  getConnectFailedMessage,
  getConnectRetryMessage,
  getDieAlreadyConnectedMessage,
  getDieBatteryMessage,
  getDieReadyMessage,
  getDieRolledMessage,
  getDieRollStateMessage,
  getDieStatusMessage,
  getDisconnectFailedMessage,
  getRejectedDieTypeMessage,
  getResultSummaryMessage,
  getSelectedPixelMessage,
} from "./controller-log";

describe("controller log helpers", () => {
  it("builds common connection messages", () => {
    expect(getSelectedPixelMessage("")).toBe("Selected Pixels die.");
    expect(getConnectFailedMessage("boom")).toBe("Connect failed: boom");
    expect(getDisconnectFailedMessage("boom")).toBe("Disconnect failed: boom");
    expect(getConnectRetryMessage(250, 2, "busy")).toBe(
      "Connect retry in 250ms. 2 retries left. busy",
    );
  });

  it("builds die-specific log messages", () => {
    expect(getDieAlreadyConnectedMessage("tens")).toBe(
      "Tens die already connected. Disconnect first to replace it.",
    );
    expect(getRejectedDieTypeMessage(null)).toBe("Rejected die type unknown.");
    expect(getDieReadyMessage("units", "auto")).toBe("Units die ready (auto).");
    expect(getDieStatusMessage("tens", "ready")).toBe("Tens die status ready.");
    expect(getDieRollStateMessage("units", "landed", 8)).toBe(
      "Units die landed; face 8.",
    );
    expect(getDieRolledMessage("tens", 70)).toBe("Tens die rolled 70.");
    expect(getDieBatteryMessage("units", 87, true)).toBe(
      "Units die battery 87%, charging.",
    );
  });

  it("builds result summary and log entries", () => {
    expect(
      getResultSummaryMessage({
        tens: 7,
        units: 4,
        roll: 74,
        target: 63,
        success: false,
        resolution: "failure",
        successLevels: -2,
        at: 123,
        isAttackMode: false,
        damageBonus: 0,
        isOpposed: false,
        defenderSuccessLevels: 0,
        isCritical: false,
        isFumble: false,
        hitLocation: null,
        hitLocationRoll: null,
        rawDamage: null,
      }),
    ).toBe("Result 74 vs 63; SL -2.");

    const entry = createLogEntry("Ready.");

    expect(entry.message).toBe("Ready.");
    expect(entry.at).not.toBe("");
  });
});
