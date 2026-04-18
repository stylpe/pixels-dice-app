import type { BluetoothCapabilities } from "@systemic-games/pixels-web-connect";
import type { DieRole } from "./die-slot";

export type SavedDiceIds = Partial<Record<DieRole, string>>;

type AutoReconnectSupport = {
  available: boolean;
  autoReconnectStatus: string | null;
  logMessage: string;
};

const SAVED_DICE_STORAGE_KEY = "pixels-wfrp.saved-dice";
const CHROME_BLUETOOTH_FLAGS_URL =
  "chrome://flags/#enable-web-bluetooth-new-permissions-backend";

export function getAutoReconnectSupport(
  capabilities: BluetoothCapabilities,
): AutoReconnectSupport {
  if (!capabilities.bluetooth) {
    return {
      available: false,
      autoReconnectStatus: "Auto-reconnect unavailable in this browser.",
      logMessage: "Auto-reconnect unavailable: Web Bluetooth missing.",
    };
  }

  if (!capabilities.persistentPermissions) {
    return {
      available: false,
      autoReconnectStatus:
        "Auto-reconnect unavailable until persistent Bluetooth permissions are supported.",
      logMessage:
        "Auto-reconnect unavailable: persistent Bluetooth permissions backend not detected. " +
        `Copy into new tab: ${CHROME_BLUETOOTH_FLAGS_URL}`,
    };
  }

  return {
    available: true,
    autoReconnectStatus: null,
    logMessage:
      "Auto-reconnect supported: persistent Bluetooth permissions backend detected.",
  };
}

export function getSavedReconnectRoles(savedDiceIds: SavedDiceIds): DieRole[] {
  const roles: DieRole[] = [];

  if (savedDiceIds.tens) {
    roles.push("tens");
  }

  if (savedDiceIds.units) {
    roles.push("units");
  }

  return roles;
}

export function getNoSavedDiceLogMessage(): string {
  return "Auto-reconnect ready, but no saved dice ids found yet.";
}

export function getNoSavedDiceStatus(): string {
  return "No saved dice to auto-reconnect yet.";
}

export function getAutoReconnectCheckingMessage(roleCount: number): string {
  return `Auto-reconnect checking ${roleCount} saved ${roleCount === 1 ? "die" : "dice"}.`;
}

export function getSavedDieUnauthorizedMessage(role: DieRole): string {
  return `Saved ${role} die not currently authorized. Connect manually if needed.`;
}

export function getAutoReconnectStatus(restoredCount: number): string {
  return restoredCount > 0
    ? `Auto-reconnected ${restoredCount} saved ${restoredCount === 1 ? "die" : "dice"}.`
    : "Saved dice not reconnected. Manual connect still available.";
}

export function getAutoReconnectSummary(restoredCount: number): string {
  return restoredCount > 0
    ? `Auto-reconnect restored ${restoredCount} saved ${restoredCount === 1 ? "die" : "dice"}.`
    : "Auto-reconnect found no currently authorized saved dice.";
}

export function persistDieSystemId(role: DieRole, systemId: string) {
  const savedDiceIds = readSavedDiceIds();
  savedDiceIds[role] = systemId;
  writeSavedDiceIds(savedDiceIds);
}

export function readSavedDiceIds(): SavedDiceIds {
  const storage = getStorage();

  if (!storage) {
    return {};
  }

  const rawValue = storage.getItem(SAVED_DICE_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object") {
      return {};
    }

    const savedDiceIds: SavedDiceIds = {};

    if (typeof parsedValue.tens === "string") {
      savedDiceIds.tens = parsedValue.tens;
    }

    if (typeof parsedValue.units === "string") {
      savedDiceIds.units = parsedValue.units;
    }

    return savedDiceIds;
  } catch {
    return {};
  }
}

function writeSavedDiceIds(savedDiceIds: SavedDiceIds) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(SAVED_DICE_STORAGE_KEY, JSON.stringify(savedDiceIds));
}

function getStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  return globalThis.localStorage;
}
