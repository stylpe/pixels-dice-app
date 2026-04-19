import type { PixelStatus } from "@systemic-games/pixels-web-connect";

import type { PocResult } from "../wfrp/poc-session";
import type { LogEntry } from "./controller-state";
import type { DieRole } from "./die-slot";

export function createLogEntry(message: string): LogEntry {
  const at = new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  return { at, message };
}

export function getSelectedPixelMessage(name: string): string {
  return `Selected ${name || "Pixels die"}.`;
}

export function getConnectFailedMessage(errorMessage: string): string {
  return `Connect failed: ${errorMessage}`;
}

export function getDisconnectFailedMessage(errorMessage: string): string {
  return `Disconnect failed: ${errorMessage}`;
}

export function getConnectRetryMessage(
  delay: number,
  retriesLeft: number,
  errorMessage: string,
): string {
  return `Connect retry in ${delay}ms. ${retriesLeft} retries left. ${errorMessage}`;
}

export function getRejectedDieTypeMessage(dieType: string | null): string {
  return `Rejected die type ${dieType || "unknown"}.`;
}

export function getDieAlreadyConnectedMessage(role: DieRole): string {
  return `${capitalize(role)} die already connected. Disconnect first to replace it.`;
}

export function getDieReadyMessage(
  role: DieRole,
  source: "manual" | "auto",
): string {
  return `${capitalize(role)} die ready${source === "auto" ? " (auto)." : "."}`;
}

export function getDieStatusMessage(
  role: DieRole,
  status: PixelStatus,
): string {
  return `${capitalize(role)} die status ${status}.`;
}

export function getDieRollStateMessage(
  role: DieRole,
  state: string,
  face: number,
): string {
  return `${capitalize(role)} die ${state}; face ${face}.`;
}

export function getDieRolledMessage(role: DieRole, face: number): string {
  return `${capitalize(role)} die rolled ${face}.`;
}

export function getResultSummaryMessage(result: PocResult): string {
  return `Result ${result.roll} vs ${result.target}; SL ${result.successLevels}.`;
}

export function getDieBatteryMessage(
  role: DieRole,
  level: number,
  isCharging: boolean,
): string {
  return `${capitalize(role)} die battery ${level}%${isCharging ? ", charging" : ""}.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
