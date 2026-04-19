import type { BluetoothCapabilities } from "@systemic-games/pixels-web-connect";
import {
  createPocSessionState,
  type PocResult,
  type PocSessionState,
} from "../wfrp/poc-session";
import { createEmptyDieSlot, type DieSlotState } from "./die-slot";

export type LogEntry = {
  at: string;
  message: string;
};

export type AppState = {
  busy: boolean;
  capabilities: BluetoothCapabilities;
  autoReconnectStatus: string | null;
  target: number;
  attackMode: boolean;
  damageBonus: number;
  isOpposed: boolean;
  defenderSuccessLevels: number;
  criticalHitLocationRoll: number | null;
  session: PocSessionState;
  latestResult: PocResult | null;
  tensDie: DieSlotState;
  unitsDie: DieSlotState;
  eventLog: LogEntry[];
  error: string | null;
};

export function createInitialAppState(
  capabilities: BluetoothCapabilities,
  initialLogEntry: LogEntry,
): AppState {
  return {
    busy: false,
    capabilities,
    autoReconnectStatus: null,
    target: 50,
    attackMode: false,
    damageBonus: 0,
    isOpposed: false,
    defenderSuccessLevels: 0,
    criticalHitLocationRoll: null,
    session: createPocSessionState(),
    latestResult: null,
    tensDie: createEmptyDieSlot("tens"),
    unitsDie: createEmptyDieSlot("units"),
    eventLog: [initialLogEntry],
    error: null,
  };
}

export function createDetachedPixelsPatch(): Partial<AppState> {
  return {
    session: createPocSessionState(),
    latestResult: null,
    target: 50,
    attackMode: false,
    damageBonus: 0,
    isOpposed: false,
    defenderSuccessLevels: 0,
    criticalHitLocationRoll: null,
    error: null,
  };
}

export function createSessionPatch(
  session: PocSessionState,
  patch: Partial<AppState> = {},
): Partial<AppState> {
  return {
    session,
    target: session.target,
    attackMode: session.attack.enabled,
    damageBonus: session.attack.damageBonus,
    isOpposed: session.attack.isOpposed,
    defenderSuccessLevels: session.attack.defenderSuccessLevels,
    criticalHitLocationRoll: session.attack.criticalHitLocationRoll,
    latestResult: session.latestResult,
    ...patch,
  };
}
