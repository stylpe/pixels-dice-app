import {
  getBluetoothCapabilities,
  getPixel,
  type Pixel,
  repeatConnect,
  requestPixel,
} from "@systemic-games/pixels-web-connect";
import {
  type PocSessionState,
  registerPocDie,
  registerPocRoll,
  setAttackDamageBonus,
  setAttackMode,
  setCriticalHitLocationRoll,
  setDefenderSuccessLevels,
  setOpposed,
  setPocTarget,
} from "../wfrp/poc-session";
import {
  createEmptyRoleSlotPatch,
  createRolePixelPatch,
  createSyncedRolePatch,
  getPixelForRole,
} from "./controller-slots";
import {
  type AppState,
  createDetachedPixelsPatch,
  createInitialAppState,
  createSessionPatch,
  type LogEntry,
} from "./controller-state";
import { type DieRole, getDieRoleFromType } from "./die-slot";
import {
  attachPixelEventHandlers,
  detachPixelEventHandlers,
  type PixelBatteryEvent,
  type PixelEventHandlers,
  type PixelRollStateEvent,
} from "./pixel-events";
import {
  getAutoReconnectCheckingMessage,
  getAutoReconnectStatus,
  getAutoReconnectSummary,
  getAutoReconnectSupport,
  getNoSavedDiceLogMessage,
  getNoSavedDiceStatus,
  getSavedDieUnauthorizedMessage,
  getSavedReconnectRoles,
  persistDieSystemId,
  readSavedDiceIds,
} from "./reconnect";

const MAX_LOG_ENTRIES = 14;

export class PixelsController {
  private listeners = new Set<() => void>();
  private pixelListeners = new Map<string, PixelEventHandlers>();
  private state: AppState = createInitialAppState(
    getBluetoothCapabilities(),
    entry("App ready. Connect official Pixels d00 and d10 dice."),
  );

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
    this.applySession(session);
  }

  setAttackMode(enabled: boolean) {
    this.applySession(setAttackMode(this.state.session, enabled));
  }

  setAttackDamageBonus(damageBonus: number) {
    this.applySession(
      setAttackDamageBonus(this.state.session, clampSignedNumber(damageBonus)),
    );
  }

  setOpposed(isOpposed: boolean) {
    this.applySession(setOpposed(this.state.session, isOpposed));
  }

  setDefenderSuccessLevels(defenderSuccessLevels: number) {
    this.applySession(
      setDefenderSuccessLevels(
        this.state.session,
        clampSignedNumber(defenderSuccessLevels),
      ),
    );
  }

  setCriticalHitLocationRoll(criticalHitLocationRoll: number | null) {
    this.applySession(
      setCriticalHitLocationRoll(this.state.session, criticalHitLocationRoll),
    );
  }

  clearLog() {
    this.patch({ eventLog: [entry("Log cleared.")] });
  }

  async initialize() {
    const support = getAutoReconnectSupport(this.state.capabilities);

    this.addLog(support.logMessage);

    if (support.autoReconnectStatus) {
      this.patch({ autoReconnectStatus: support.autoReconnectStatus });
    }

    await this.tryAutoReconnect();
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
      await this.connectPixel(pixel, "manual");
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

  private async tryAutoReconnect() {
    const support = getAutoReconnectSupport(this.state.capabilities);

    if (!support.available) {
      return;
    }

    const savedDiceIds = readSavedDiceIds();
    const roles = getSavedReconnectRoles(savedDiceIds);

    if (roles.length === 0) {
      this.addLog(getNoSavedDiceLogMessage());
      this.patch({ autoReconnectStatus: getNoSavedDiceStatus() });
      return;
    }

    this.addLog(getAutoReconnectCheckingMessage(roles.length));
    this.patch({
      busy: true,
      autoReconnectStatus: "Trying saved dice...",
      error: null,
    });

    try {
      const reconnectResults = await Promise.all(
        roles.map(async (role) => {
          const systemId = savedDiceIds[role];

          if (!systemId) {
            return false;
          }

          const pixel = await getPixel(systemId);

          if (!pixel) {
            this.addLog(getSavedDieUnauthorizedMessage(role));
            return false;
          }

          try {
            await this.connectPixel(pixel, "auto");
            return true;
          } catch (error) {
            this.addLog(
              `Auto-reconnect failed for ${role} die: ${this.normalizeError(error)}`,
            );
            return false;
          }
        }),
      );

      const restoredCount = reconnectResults.filter(Boolean).length;

      this.patch({
        autoReconnectStatus: getAutoReconnectStatus(restoredCount),
      });
      this.addLog(getAutoReconnectSummary(restoredCount));
    } finally {
      this.patch({ busy: false });
    }
  }

  private async connectPixel(pixel: Pixel, source: "manual" | "auto") {
    await repeatConnect(pixel, {
      retries: 3,
      onWillRetry: (delay, retriesLeft, error) => {
        this.addLog(
          `Connect retry in ${delay}ms. ${retriesLeft} retries left. ${this.normalizeError(error)}`,
        );
      },
    });

    const dieType = pixel.dieType;
    const role = getDieRoleFromType(dieType);

    if (!role) {
      const session = registerPocDie(this.state.session, {
        systemId: pixel.systemId,
        dieType,
        name: pixel.name,
      });

      this.applySession(session, {
        error:
          session.unsupportedReason ||
          "Unsupported die type for v1. Official Pixels d10 and d00 required.",
      });
      this.addLog(`Rejected die type ${dieType || "unknown"}.`);
      return;
    }

    const currentPixel = getPixelForRole(this.state, role);
    if (currentPixel && currentPixel !== pixel) {
      throw new Error(
        `${capitalize(role)} die already connected. Disconnect first to replace it.`,
      );
    }

    if (currentPixel !== pixel) {
      this.attachPixel(role, pixel);
    }

    const session = registerPocDie(this.state.session, {
      systemId: pixel.systemId,
      dieType,
      name: pixel.name,
    });

    this.applySession(session, {
      autoReconnectStatus:
        source === "auto"
          ? `Reconnected saved ${role} die.`
          : this.state.autoReconnectStatus,
      error: null,
    });
    this.patch(createSyncedRolePatch(role, pixel));
    persistDieSystemId(role, pixel.systemId);
    this.addLog(
      `${capitalize(role)} die ready${source === "auto" ? " (auto)." : "."}`,
    );
  }

  private attachPixel(role: DieRole, pixel: Pixel) {
    const onStatusChanged = () => {
      this.patch(createSyncedRolePatch(role, pixel));
      this.addLog(`${capitalize(role)} die status ${pixel.status}.`);
    };
    const onRollState = (event: PixelRollStateEvent) => {
      this.patch(createSyncedRolePatch(role, pixel));
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

      this.applySession(session);
      this.patch(createSyncedRolePatch(role, pixel));
      this.addLog(`${capitalize(role)} die rolled ${face}.`);

      if (session.latestResult) {
        this.addLog(
          `Result ${session.latestResult.roll} vs ${session.latestResult.target}; SL ${session.latestResult.successLevels}.`,
        );
      }
    };
    const onBattery = (event: PixelBatteryEvent) => {
      this.patch(createSyncedRolePatch(role, pixel));
      this.addLog(
        `${capitalize(role)} die battery ${event.level}%${event.isCharging ? ", charging" : ""}.`,
      );
    };

    const handlers = attachPixelEventHandlers(pixel, {
      statusChanged: onStatusChanged,
      rollState: onRollState,
      roll: onRoll,
      battery: onBattery,
    });

    this.pixelListeners.set(pixel.systemId, handlers);

    this.patch(createRolePixelPatch(this.state, role, pixel));
    this.patch(createSyncedRolePatch(role, pixel));
  }

  private detachAllPixels() {
    this.detachRole("tens");
    this.detachRole("units");
    this.patch(createDetachedPixelsPatch());
  }

  private detachRole(role: DieRole) {
    const pixel = getPixelForRole(this.state, role);

    if (!pixel) {
      return;
    }

    const listeners = this.pixelListeners.get(pixel.systemId);

    if (listeners) {
      detachPixelEventHandlers(pixel, listeners);
      this.pixelListeners.delete(pixel.systemId);
    }

    this.patch(createEmptyRoleSlotPatch(role));
  }

  private patch(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private applySession(
    session: PocSessionState,
    patch: Partial<AppState> = {},
  ) {
    this.patch(createSessionPatch(session, patch));
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

function clampTarget(target: number): number {
  if (!Number.isFinite(target)) {
    return 50;
  }

  return Math.min(100, Math.max(1, Math.round(target)));
}

function clampSignedNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
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
