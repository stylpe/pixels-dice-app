import type {
  BluetoothCapabilities,
  PixelStatus,
} from "@systemic-games/pixels-web-connect";

export function formatStatus(status: PixelStatus): string {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "identifying":
      return "Identifying";
    case "ready":
      return "Ready";
    case "disconnecting":
      return "Disconnecting";
    default:
      return "Disconnected";
  }
}

export function formatCapabilities(
  capabilities: BluetoothCapabilities,
): string {
  if (!capabilities.bluetooth) {
    return "Web Bluetooth missing here. Use Chrome on localhost or HTTPS.";
  }

  if (!capabilities.persistentPermissions) {
    return "Web Bluetooth available. Persistent permission backend off, so saved dice may still need user approval again after browser restart.";
  }

  return "Web Bluetooth available and persistent permissions backend detected. Saved dice can auto-reconnect when still authorized.";
}

export function formatBattery(
  level: number | null,
  isCharging: boolean,
): string {
  if (level === null) {
    return "Unknown";
  }

  return `${level}%${isCharging ? " charging" : ""}`;
}

export function formatFace(face: number | null): string {
  if (face === null) {
    return "--";
  }

  return String(face);
}
