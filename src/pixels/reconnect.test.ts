import { beforeEach, describe, expect, it } from "vitest";

import {
  getAutoReconnectCheckingMessage,
  getAutoReconnectStatus,
  getAutoReconnectSummary,
  getAutoReconnectSupport,
  getNoSavedDiceLogMessage,
  getNoSavedDiceStatus,
  getSavedDieUnauthorizedMessage,
  getSavedReconnectRoles,
  persistDieSystemId,
  readSavedDiceIds,
} from "./reconnect";

class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }
}

const storage = new FakeStorage();

describe("reconnect helpers", () => {
  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  it("describes reconnect support states", () => {
    expect(
      getAutoReconnectSupport({
        bluetooth: false,
        persistentPermissions: false,
      }),
    ).toMatchObject({
      available: false,
      autoReconnectStatus: "Auto-reconnect unavailable in this browser.",
    });

    expect(
      getAutoReconnectSupport({
        bluetooth: true,
        persistentPermissions: false,
      }),
    ).toMatchObject({
      available: false,
      autoReconnectStatus:
        "Auto-reconnect unavailable until persistent Bluetooth permissions are supported.",
    });

    expect(
      getAutoReconnectSupport({
        bluetooth: true,
        persistentPermissions: true,
      }),
    ).toMatchObject({
      available: true,
      autoReconnectStatus: null,
    });
  });

  it("persists and reads saved dice ids", () => {
    persistDieSystemId("tens", "tens-1");
    persistDieSystemId("units", "units-1");

    expect(readSavedDiceIds()).toEqual({
      tens: "tens-1",
      units: "units-1",
    });
    expect(getSavedReconnectRoles(readSavedDiceIds())).toEqual([
      "tens",
      "units",
    ]);
  });

  it("formats reconnect messages", () => {
    expect(getNoSavedDiceLogMessage()).toBe(
      "Auto-reconnect ready, but no saved dice ids found yet.",
    );
    expect(getNoSavedDiceStatus()).toBe("No saved dice to auto-reconnect yet.");
    expect(getAutoReconnectCheckingMessage(2)).toBe(
      "Auto-reconnect checking 2 saved dice.",
    );
    expect(getSavedDieUnauthorizedMessage("tens")).toBe(
      "Saved tens die not currently authorized. Connect manually if needed.",
    );
    expect(getAutoReconnectStatus(0)).toBe(
      "Saved dice not reconnected. Manual connect still available.",
    );
    expect(getAutoReconnectSummary(2)).toBe(
      "Auto-reconnect restored 2 saved dice.",
    );
  });
});
