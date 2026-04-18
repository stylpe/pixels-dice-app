import {
  type BluetoothCapabilities,
  getBluetoothCapabilities,
  type Pixel,
  type PixelStatus,
  repeatConnect,
  requestPixel,
} from "@systemic-games/pixels-web-connect";
import {
  createPocSessionState,
  type PocResult,
  type PocSessionState,
  registerPocDie,
  registerPocRoll,
  setPocTarget,
} from "../wfrp/poc-session";

type LogEntry = {
  at: string;
  message: string;
};

type DieSlotState = {
  role: "tens" | "units";
  pixel: Pixel | null;
  connectionStatus: PixelStatus;
  currentFace: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  name: string;
  dieType: string | null;
};

type AppState = {
  busy: boolean;
  capabilities: BluetoothCapabilities;
  target: number;
  session: PocSessionState;
  latestResult: PocResult | null;
  tensDie: DieSlotState;
  unitsDie: DieSlotState;
  eventLog: LogEntry[];
  error: string | null;
};

const MAX_LOG_ENTRIES = 14;

export class PixelsController {
  private listeners = new Set<() => void>();
  private pixelListeners = new Map<
    string,
    {
      statusChanged: () => void;
      rollState: (event: { state: string; face: number }) => void;
      roll: (face: number) => void;
      battery: (event: { level: number; isCharging: boolean }) => void;
    }
  >();
  private state: AppState = {
    busy: false,
    capabilities: getBluetoothCapabilities(),
    target: 50,
    session: createPocSessionState(),
    latestResult: null,
    tensDie: emptyDieSlot("tens"),
    unitsDie: emptyDieSlot("units"),
    eventLog: [entry("App ready. Connect official Pixels d00 and d10 dice.")],
    error: null,
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  setTarget(target: number) {
    const safeTarget = clampTarget(target);
    const session = setPocTarget(this.state.session, safeTarget);
    const latestResult = this.state.latestResult
      ? {
          ...this.state.latestResult,
          target: safeTarget,
        }
      : null;

    this.patch({ target: safeTarget, session, latestResult });
  }

  clearLog() {
    this.patch({ eventLog: [entry("Log cleared.")] });
  }

  async connect() {
    if (!this.state.capabilities.bluetooth) {
      this.patch({
        error: "Web Bluetooth unavailable in this browser context.",
      });
      return;
    }

    this.patch({ busy: true, error: null });

    try {
      const pixel = await requestPixel();

      this.addLog(`Selected ${pixel.name || "Pixels die"}.`);

      await repeatConnect(pixel, {
        retries: 3,
        onWillRetry: (delay, retriesLeft, error) => {
          this.addLog(
            `Connect retry in ${delay}ms. ${retriesLeft} retries left. ${this.normalizeError(error)}`,
          );
        },
      });

      const dieType = pixel.dieType;
      const role = getRoleFromDieType(dieType);

      if (!role) {
        const session = registerPocDie(this.state.session, {
          systemId: pixel.systemId,
          dieType,
          name: pixel.name,
        });

        this.patch({
          session,
          error:
            session.unsupportedReason ||
            "Unsupported die type for v1. Official Pixels d10 and d00 required.",
        });
        this.addLog(`Rejected die type ${dieType || "unknown"}.`);
        return;
      }

      const currentPixel = this.getPixelForRole(role);
      if (currentPixel && currentPixel !== pixel) {
        this.patch({
          error: `${capitalize(role)} die already connected. Disconnect first to replace it.`,
        });
        this.addLog(`${capitalize(role)} die already occupied.`);
        return;
      }

      if (currentPixel !== pixel) {
        this.attachPixel(role, pixel);
      }

      const session = registerPocDie(this.state.session, {
        systemId: pixel.systemId,
        dieType,
        name: pixel.name,
      });

      this.patch({
        session,
        latestResult: session.latestResult,
        error: null,
      });
      this.syncRole(role, pixel);
      this.addLog(`${capitalize(role)} die ready.`);
    } catch (error) {
      this.patch({ error: this.normalizeError(error) });
      this.addLog(`Connect failed: ${this.normalizeError(error)}`);
    } finally {
      this.patch({ busy: false });
    }
  }

  async disconnect() {
    const pixels = [this.state.tensDie.pixel, this.state.unitsDie.pixel].filter(
      (pixel): pixel is Pixel => pixel !== null,
    );

    if (pixels.length === 0) {
      return;
    }

    this.patch({ busy: true, error: null });

    try {
      await Promise.all(pixels.map((pixel) => pixel.disconnect()));
      this.detachAllPixels();
      this.addLog("Disconnected dice.");
    } catch (error) {
      this.patch({ error: this.normalizeError(error) });
      this.addLog(`Disconnect failed: ${this.normalizeError(error)}`);
    } finally {
      this.patch({ busy: false });
    }
  }

  private attachPixel(role: "tens" | "units", pixel: Pixel) {
    const onStatusChanged = () => {
      this.syncRole(role, pixel);
      this.addLog(`${capitalize(role)} die status ${pixel.status}.`);
    };
    const onRollState = (event: { state: string; face: number }) => {
      this.syncRole(role, pixel);
      this.addLog(
        `${capitalize(role)} die ${event.state}; face ${event.face}.`,
      );
    };
    const onRoll = (face: number) => {
      const session = registerPocRoll(this.state.session, {
        systemId: pixel.systemId,
        face,
        at: Date.now(),
      });

      this.patch({ session, latestResult: session.latestResult });
      this.syncRole(role, pixel);
      this.addLog(`${capitalize(role)} die rolled ${face}.`);

      if (session.latestResult) {
        this.addLog(
          `Result ${session.latestResult.roll} vs ${session.latestResult.target}; SL ${session.latestResult.successLevels}.`,
        );
      }
    };
    const onBattery = (event: { level: number; isCharging: boolean }) => {
      this.syncRole(role, pixel);
      this.addLog(
        `${capitalize(role)} die battery ${event.level}%${event.isCharging ? ", charging" : ""}.`,
      );
    };

    pixel.addEventListener("statusChanged", onStatusChanged);
    pixel.addEventListener("rollState", onRollState);
    pixel.addEventListener("roll", onRoll);
    pixel.addEventListener("battery", onBattery);

    this.pixelListeners.set(pixel.systemId, {
      statusChanged: onStatusChanged,
      rollState: onRollState,
      roll: onRoll,
      battery: onBattery,
    });

    this.patchRolePixel(role, pixel);
    this.syncRole(role, pixel);
  }

  private detachAllPixels() {
    this.detachRole("tens");
    this.detachRole("units");
    this.patch({
      session: createPocSessionState(),
      latestResult: null,
      target: 50,
      error: null,
    });
  }

  private detachRole(role: "tens" | "units") {
    const pixel = this.getPixelForRole(role);

    if (!pixel) {
      return;
    }

    const listeners = this.pixelListeners.get(pixel.systemId);

    if (listeners) {
      pixel.removeEventListener("statusChanged", listeners.statusChanged);
      pixel.removeEventListener("rollState", listeners.rollState);
      pixel.removeEventListener("roll", listeners.roll);
      pixel.removeEventListener("battery", listeners.battery);
      this.pixelListeners.delete(pixel.systemId);
    }

    this.patch({
      [role === "tens" ? "tensDie" : "unitsDie"]: emptyDieSlot(role),
    } as Partial<AppState>);
  }

  private syncRole(role: "tens" | "units", pixel: Pixel) {
    const slot: DieSlotState = {
      role,
      pixel,
      connectionStatus: pixel.status,
      currentFace: pixel.currentFace || null,
      batteryLevel: pixel.batteryLevel,
      isCharging: pixel.isCharging,
      name: pixel.name,
      dieType: pixel.dieType,
    };

    this.patch({
      [role === "tens" ? "tensDie" : "unitsDie"]: slot,
    } as Partial<AppState>);
  }

  private patchRolePixel(role: "tens" | "units", pixel: Pixel) {
    this.patch({
      [role === "tens" ? "tensDie" : "unitsDie"]: {
        ...this.getSlot(role),
        pixel,
      },
    } as Partial<AppState>);
  }

  private getPixelForRole(role: "tens" | "units"): Pixel | null {
    return this.getSlot(role).pixel;
  }

  private getSlot(role: "tens" | "units"): DieSlotState {
    return role === "tens" ? this.state.tensDie : this.state.unitsDie;
  }

  private patch(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private addLog(message: string) {
    const eventLog = [entry(message), ...this.state.eventLog].slice(
      0,
      MAX_LOG_ENTRIES,
    );
    this.patch({ eventLog });
  }

  private normalizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

function getRoleFromDieType(dieType: string): "tens" | "units" | null {
  if (dieType === "d00") {
    return "tens";
  }

  if (dieType === "d10") {
    return "units";
  }

  return null;
}

function emptyDieSlot(role: "tens" | "units"): DieSlotState {
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

function clampTarget(target: number): number {
  if (!Number.isFinite(target)) {
    return 50;
  }

  return Math.min(100, Math.max(1, Math.round(target)));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function entry(message: string): LogEntry {
  const at = new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  return { at, message };
}
