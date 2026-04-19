import { describe, expect, it } from "vitest";
import {
  createEmptyRoleSlotPatch,
  createRolePixelPatch,
  createSyncedRolePatch,
  getPixelForRole,
  getSlot,
} from "./controller-slots";
import type { AppState } from "./controller-state";
import { createInitialAppState } from "./controller-state";

describe("controller slot helpers", () => {
  it("gets slot and pixel by role", () => {
    const pixel = { name: "Tens" };
    const state: AppState = {
      ...createInitialAppState(
        { bluetooth: true, persistentPermissions: true },
        { at: "now", message: "ready" },
      ),
      tensDie: {
        role: "tens",
        pixel: pixel as never,
        connectionStatus: "ready",
        currentFace: 70,
        batteryLevel: 80,
        isCharging: false,
        name: "Tens",
        dieType: "d00",
      },
    };

    expect(getSlot(state, "tens").name).toBe("Tens");
    expect(getPixelForRole(state, "tens")).toBe(pixel);
    expect(getPixelForRole(state, "units")).toBeNull();
  });

  it("creates pixel-only patch without dropping slot snapshot fields", () => {
    const pixel = { systemId: "tens-1" };
    const state: AppState = {
      ...createInitialAppState(
        { bluetooth: true, persistentPermissions: true },
        { at: "now", message: "ready" },
      ),
      tensDie: {
        role: "tens",
        pixel: null,
        connectionStatus: "ready",
        currentFace: 20,
        batteryLevel: 91,
        isCharging: true,
        name: "Known Tens",
        dieType: "d00",
      },
    };

    expect(createRolePixelPatch(state, "tens", pixel as never)).toEqual({
      tensDie: {
        role: "tens",
        pixel,
        connectionStatus: "ready",
        currentFace: 20,
        batteryLevel: 91,
        isCharging: true,
        name: "Known Tens",
        dieType: "d00",
      },
    });
  });

  it("creates synced and empty slot patches", () => {
    const pixel = {
      status: "ready",
      currentFace: 90,
      batteryLevel: 50,
      isCharging: false,
      name: "Units",
      dieType: "d10",
    };

    expect(createSyncedRolePatch("units", pixel as never)).toEqual({
      unitsDie: {
        role: "units",
        pixel,
        connectionStatus: "ready",
        currentFace: 90,
        batteryLevel: 50,
        isCharging: false,
        name: "Units",
        dieType: "d10",
      },
    });

    expect(createEmptyRoleSlotPatch("units")).toEqual({
      unitsDie: {
        role: "units",
        pixel: null,
        connectionStatus: "disconnected",
        currentFace: null,
        batteryLevel: null,
        isCharging: false,
        name: "",
        dieType: null,
      },
    });
  });
});
