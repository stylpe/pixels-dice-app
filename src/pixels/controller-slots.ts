import type { Pixel } from "@systemic-games/pixels-web-connect";

import type { AppState } from "./controller-state";
import {
  createEmptyDieSlot,
  type DieRole,
  type DieSlotState,
  toDieSlotState,
} from "./die-slot";

type RoleSlotPatch = Partial<Pick<AppState, "tensDie" | "unitsDie">>;

export function getSlot(state: AppState, role: DieRole): DieSlotState {
  return role === "tens" ? state.tensDie : state.unitsDie;
}

export function getPixelForRole(state: AppState, role: DieRole): Pixel | null {
  return getSlot(state, role).pixel;
}

export function createEmptyRoleSlotPatch(role: DieRole): RoleSlotPatch {
  return createRoleSlotPatch(role, createEmptyDieSlot(role));
}

export function createSyncedRolePatch(
  role: DieRole,
  pixel: Pixel,
): RoleSlotPatch {
  return createRoleSlotPatch(role, toDieSlotState(role, pixel));
}

export function createRolePixelPatch(
  state: AppState,
  role: DieRole,
  pixel: Pixel,
): RoleSlotPatch {
  return createRoleSlotPatch(role, {
    ...getSlot(state, role),
    pixel,
  });
}

function createRoleSlotPatch(role: DieRole, slot: DieSlotState): RoleSlotPatch {
  return role === "tens" ? { tensDie: slot } : { unitsDie: slot };
}
