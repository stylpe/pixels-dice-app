import {
  type BluetoothCapabilities,
  Color,
  getBluetoothCapabilities,
  type Pixel,
  type PixelStatus,
  repeatConnect,
  requestPixel,
} from "@systemic-games/pixels-web-connect";

type LogEntry = {
  at: string;
  message: string;
};

type AppState = {
  busy: boolean;
  capabilities: BluetoothCapabilities;
  connectionStatus: PixelStatus;
  currentFace: number | null;
  batteryLevel: number | null;
  isCharging: boolean;
  pixelName: string;
  rollState: string;
  rssi: number | null;
  eventLog: LogEntry[];
  error: string | null;
  pixel: Pixel | null;
};

const MAX_LOG_ENTRIES = 14;

export class PixelsController {
  private listeners = new Set<() => void>();
  private pixelListeners = new Map<string, (...args: unknown[]) => void>();
  private pixel: Pixel | null = null;
  private state: AppState = {
    busy: false,
    capabilities: getBluetoothCapabilities(),
    connectionStatus: "disconnected",
    currentFace: null,
    batteryLevel: null,
    isCharging: false,
    pixelName: "",
    rollState: "unknown",
    rssi: null,
    eventLog: [entry("App ready. Connect a Pixel to begin.")],
    error: null,
    pixel: null,
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

      if (this.pixel !== pixel) {
        this.detachPixel();
        this.pixel = pixel;
        this.attachPixel(pixel);
      }

      this.addLog(`Selected ${pixel.name || "Pixel device"}.`);

      await repeatConnect(pixel, {
        retries: 3,
        onWillRetry: (delay, retriesLeft, error) => {
          this.addLog(
            `Connect retry in ${delay}ms. ${retriesLeft} retries left. ${this.normalizeError(error)}`,
          );
        },
      });

      this.syncFromPixel();
      this.addLog("Pixel ready.");
    } catch (error) {
      this.patch({ error: this.normalizeError(error) });
      this.addLog(`Connect failed: ${this.normalizeError(error)}`);
    } finally {
      this.patch({ busy: false });
    }
  }

  async disconnect() {
    if (!this.pixel) {
      return;
    }

    this.patch({ busy: true, error: null });

    try {
      await this.pixel.disconnect();
      this.syncFromPixel();
      this.addLog("Disconnect requested.");
    } catch (error) {
      this.patch({ error: this.normalizeError(error) });
      this.addLog(`Disconnect failed: ${this.normalizeError(error)}`);
    } finally {
      this.patch({ busy: false });
    }
  }

  async blink() {
    if (!this.pixel) {
      return;
    }

    this.patch({ busy: true, error: null });

    try {
      await this.pixel.blink(Color.cyan, {
        count: 2,
        duration: 350,
        fade: 0.3,
      });
      this.addLog("Blink command sent.");
      this.syncFromPixel();
    } catch (error) {
      this.patch({ error: this.normalizeError(error) });
      this.addLog(`Blink failed: ${this.normalizeError(error)}`);
    } finally {
      this.patch({ busy: false });
    }
  }

  async refreshRssi() {
    if (!this.pixel) {
      return;
    }

    this.patch({ busy: true, error: null });

    try {
      const rssi = await this.pixel.queryRssi();
      this.patch({ rssi });
      this.addLog(`RSSI sampled at ${rssi} dBm.`);
    } catch (error) {
      this.patch({ error: this.normalizeError(error) });
      this.addLog(`RSSI query failed: ${this.normalizeError(error)}`);
    } finally {
      this.patch({ busy: false });
    }
  }

  private attachPixel(pixel: Pixel) {
    const onStatusChanged = () => {
      this.syncFromPixel();
      this.addLog(`Status changed to ${pixel.status}.`);
    };
    const onRollState = (event: { state: string; face: number }) => {
      this.patch({ currentFace: event.face, rollState: event.state });
      this.addLog(`Roll state ${event.state}; face ${event.face}.`);
    };
    const onRoll = (face: number) => {
      this.patch({ currentFace: face });
      this.addLog(`Rolled ${face}.`);
    };
    const onBattery = (event: { level: number; isCharging: boolean }) => {
      this.patch({ batteryLevel: event.level, isCharging: event.isCharging });
      this.addLog(
        `Battery ${event.level}%${event.isCharging ? ", charging" : ""}.`,
      );
    };

    pixel.addEventListener("statusChanged", onStatusChanged);
    pixel.addEventListener("rollState", onRollState);
    pixel.addEventListener("roll", onRoll);
    pixel.addEventListener("battery", onBattery);

    this.pixelListeners.set("statusChanged", onStatusChanged);
    this.pixelListeners.set(
      "rollState",
      onRollState as (...args: unknown[]) => void,
    );
    this.pixelListeners.set("roll", onRoll as (...args: unknown[]) => void);
    this.pixelListeners.set(
      "battery",
      onBattery as (...args: unknown[]) => void,
    );

    this.syncFromPixel();
  }

  private detachPixel() {
    if (!this.pixel) {
      return;
    }

    const statusChanged = this.pixelListeners.get("statusChanged");
    const rollState = this.pixelListeners.get("rollState");
    const roll = this.pixelListeners.get("roll");
    const battery = this.pixelListeners.get("battery");

    if (statusChanged) {
      this.pixel.removeEventListener(
        "statusChanged",
        statusChanged as () => void,
      );
    }

    if (rollState) {
      this.pixel.removeEventListener(
        "rollState",
        rollState as (event: { state: string; face: number }) => void,
      );
    }

    if (roll) {
      this.pixel.removeEventListener("roll", roll as (face: number) => void);
    }

    if (battery) {
      this.pixel.removeEventListener(
        "battery",
        battery as (event: { level: number; isCharging: boolean }) => void,
      );
    }

    this.pixelListeners.clear();
    this.pixel = null;
    this.patch({
      connectionStatus: "disconnected",
      currentFace: null,
      batteryLevel: null,
      isCharging: false,
      pixelName: "",
      rollState: "unknown",
      rssi: null,
      pixel: null,
    });
  }

  private syncFromPixel() {
    if (!this.pixel) {
      this.patch({ pixel: null });
      return;
    }

    this.patch({
      pixel: this.pixel,
      connectionStatus: this.pixel.status,
      currentFace: this.pixel.currentFace || null,
      batteryLevel: this.pixel.batteryLevel,
      isCharging: this.pixel.isCharging,
      pixelName: this.pixel.name,
      rollState: this.pixel.rollState,
      rssi: this.pixel.rssi || this.state.rssi,
    });
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

function entry(message: string): LogEntry {
  const at = new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  return { at, message };
}
