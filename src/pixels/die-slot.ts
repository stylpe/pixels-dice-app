import type { Pixel, PixelStatus } from "@systemic-games/pixels-web-connect";

export type DieRole = "tens" | "units";

export type DieSlotState = {
  role: DieRole;
  pixel: Pixel | null;
  connectionStatus: PixelStatus;
  currentFace: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  name: string;
  dieType: string | null;
};

export function getDieRoleFromType(dieType: string): DieRole | null {
  if (dieType === "d00") {
    return "tens";
  }

  if (dieType === "d10") {
    return "units";
  }

  return null;
}

export function createEmptyDieSlot(role: DieRole): DieSlotState {
  return {
    role,
    pixel: null,
    connectionStatus: "disconnected",
    currentFace: null,
    batteryLevel: null,
    isCharging: false,
    name: "",
    dieType: null,
  };
}

export function toDieSlotState(role: DieRole, pixel: Pixel): DieSlotState {
  return {
    role,
    pixel,
    connectionStatus: pixel.status,
    currentFace: pixel.currentFace ?? null,
    batteryLevel: pixel.batteryLevel,
    isCharging: pixel.isCharging,
    name: pixel.name,
    dieType: pixel.dieType,
  };
}
