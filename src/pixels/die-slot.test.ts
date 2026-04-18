import { describe, expect, it } from "vitest";

import {
  createEmptyDieSlot,
  getDieRoleFromType,
  toDieSlotState,
} from "./die-slot";

describe("die slot helpers", () => {
  it("maps official die types to roles", () => {
    expect(getDieRoleFromType("d00")).toBe("tens");
    expect(getDieRoleFromType("d10")).toBe("units");
    expect(getDieRoleFromType("d6")).toBeNull();
  });

  it("creates empty slots", () => {
    expect(createEmptyDieSlot("tens")).toEqual({
      role: "tens",
      pixel: null,
      connectionStatus: "disconnected",
      currentFace: null,
      batteryLevel: null,
      isCharging: false,
      name: "",
      dieType: null,
    });
  });

  it("builds slot state from pixel snapshot", () => {
    const pixel = {
      status: "ready",
      currentFace: 70,
      batteryLevel: 87,
      isCharging: true,
      name: "Tens",
      dieType: "d00",
    };

    expect(toDieSlotState("tens", pixel as never)).toEqual({
      role: "tens",
      pixel,
      connectionStatus: "ready",
      currentFace: 70,
      batteryLevel: 87,
      isCharging: true,
      name: "Tens",
      dieType: "d00",
    });
  });
});
