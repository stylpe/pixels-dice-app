import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetBluetoothCapabilities,
  mockGetPixel,
  mockRepeatConnect,
  mockRequestPixel,
} = vi.hoisted(() => ({
  mockGetBluetoothCapabilities: vi.fn(),
  mockGetPixel: vi.fn(),
  mockRepeatConnect: vi.fn(),
  mockRequestPixel: vi.fn(),
}));

vi.mock("@systemic-games/pixels-web-connect", () => ({
  getBluetoothCapabilities: mockGetBluetoothCapabilities,
  getPixel: mockGetPixel,
  repeatConnect: mockRepeatConnect,
  requestPixel: mockRequestPixel,
}));

import { PixelsController } from "./pixels-controller";

class FakeStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }
}

class FakePixel {
  systemId: string;
  dieType: string;
  name: string;
  status: "disconnected" | "ready" = "disconnected";
  currentFace: number | null = null;
  batteryLevel: number | null = null;
  isCharging = false;
  failDisconnect = false;
  onAddEventListener: ((event: string) => void) | null = null;
  private listeners = new Map<string, Set<(...args: Array<unknown>) => void>>();

  constructor(systemId: string, dieType: string, name: string) {
    this.systemId = systemId;
    this.dieType = dieType;
    this.name = name;
  }

  addEventListener(event: string, listener: (...args: Array<unknown>) => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    this.onAddEventListener?.(event);
  }

  removeEventListener(
    event: string,
    listener: (...args: Array<unknown>) => void,
  ) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: Array<unknown>) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }

  async disconnect() {
    if (this.failDisconnect) {
      throw new Error(`${this.name} disconnect failed`);
    }

    this.status = "disconnected";
  }
}

const storage = new FakeStorage();

describe("pixels controller autoconnect", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    mockGetBluetoothCapabilities.mockReturnValue({
      bluetooth: true,
      persistentPermissions: true,
    });
    mockRepeatConnect.mockImplementation(async (pixel: FakePixel) => {
      pixel.status = "ready";
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  it("persists connected die ids after manual connect", async () => {
    mockRequestPixel.mockResolvedValue(new FakePixel("tens-1", "d00", "Tens"));

    const controller = new PixelsController();

    await controller.connect();

    expect(storage.getItem("pixels-wfrp.saved-dice")).toBe('{"tens":"tens-1"}');
    expect(controller.getState().tensDie.name).toBe("Tens");
  });

  it("auto-reconnects saved authorized dice on initialize", async () => {
    storage.setItem(
      "pixels-wfrp.saved-dice",
      JSON.stringify({ tens: "tens-1", units: "units-1" }),
    );
    mockGetPixel.mockImplementation(async (systemId: string) => {
      if (systemId === "tens-1") {
        return new FakePixel(systemId, "d00", "Saved Tens");
      }

      if (systemId === "units-1") {
        return new FakePixel(systemId, "d10", "Saved Units");
      }

      return undefined;
    });

    const controller = new PixelsController();

    await controller.initialize();

    expect(mockGetPixel).toHaveBeenCalledTimes(2);
    expect(controller.getState().tensDie.name).toBe("Saved Tens");
    expect(controller.getState().unitsDie.name).toBe("Saved Units");
    expect(controller.getState().autoReconnectStatus).toBe(
      "Auto-reconnected 2 saved dice.",
    );
    expect(controller.getState().eventLog[0]?.message).toBe(
      "Auto-reconnect restored 2 saved dice.",
    );
  });

  it("logs when persistent permissions backend is unavailable", async () => {
    mockGetBluetoothCapabilities.mockReturnValue({
      bluetooth: true,
      persistentPermissions: false,
    });

    const controller = new PixelsController();

    await controller.initialize();

    expect(controller.getState().eventLog[0]?.message).toContain(
      "Auto-reconnect unavailable: persistent Bluetooth permissions backend not detected.",
    );
    expect(controller.getState().eventLog[0]?.message).toContain(
      "Copy into new tab:",
    );
    expect(controller.getState().eventLog[0]?.message).toContain(
      "chrome://flags/#enable-web-bluetooth-new-permissions-backend",
    );
    expect(controller.getState().autoReconnectStatus).toBe(
      "Auto-reconnect unavailable until persistent Bluetooth permissions are supported.",
    );
  });

  it("disconnect resets connected dice and session state", async () => {
    const tens = new FakePixel("tens-1", "d00", "Tens");
    const units = new FakePixel("units-1", "d10", "Units");

    mockRequestPixel.mockResolvedValueOnce(tens).mockResolvedValueOnce(units);

    const controller = new PixelsController();

    await controller.connect();
    await controller.connect();

    controller.setTarget(63);
    controller.setAttackMode(true);
    controller.setAttackDamageBonus(4);
    controller.setOpposed(true);
    controller.setDefenderSuccessLevels(2);
    controller.setCriticalHitLocationRoll(11);

    tens.emit("roll", 70);
    units.emit("roll", 4);

    expect(controller.getState().latestResult?.roll).toBe(74);

    await controller.disconnect();

    const state = controller.getState();

    expect(state.tensDie.pixel).toBeNull();
    expect(state.unitsDie.pixel).toBeNull();
    expect(state.target).toBe(50);
    expect(state.attackMode).toBe(false);
    expect(state.damageBonus).toBe(0);
    expect(state.isOpposed).toBe(false);
    expect(state.defenderSuccessLevels).toBe(0);
    expect(state.criticalHitLocationRoll).toBeNull();
    expect(state.latestResult).toBeNull();
    expect(state.error).toBeNull();
    expect(state.eventLog[0]?.message).toBe("Disconnected dice.");
  });

  it("disconnect still clears already-disconnected dice when one disconnect fails", async () => {
    const tens = new FakePixel("tens-1", "d00", "Tens");
    const units = new FakePixel("units-1", "d10", "Units");

    units.failDisconnect = true;
    mockRequestPixel.mockResolvedValueOnce(tens).mockResolvedValueOnce(units);

    const controller = new PixelsController();

    await controller.connect();
    await controller.connect();
    await controller.disconnect();

    const state = controller.getState();

    expect(state.tensDie.pixel).toBeNull();
    expect(state.error).toBe("Units disconnect failed");
  });

  it("disconnects unsupported dice instead of leaving them connected unmanaged", async () => {
    const weird = new FakePixel("weird-1", "d20", "Weird");

    mockRequestPixel.mockResolvedValue(weird);

    const controller = new PixelsController();

    await controller.connect();

    expect(weird.status).toBe("disconnected");
    expect(controller.getState().tensDie.pixel).toBeNull();
    expect(controller.getState().unitsDie.pixel).toBeNull();
    expect(controller.getState().error).toContain("Unsupported die type");
  });

  it("registers die before listeners can handle immediate roll events", async () => {
    const tens = new FakePixel("tens-1", "d00", "Tens");
    const units = new FakePixel("units-1", "d10", "Units");

    units.onAddEventListener = (event) => {
      if (event === "roll") {
        tens.emit("roll", 70);
        units.emit("roll", 4);
      }
    };
    mockRequestPixel.mockResolvedValueOnce(tens).mockResolvedValueOnce(units);

    const controller = new PixelsController();

    await controller.connect();
    await controller.connect();

    expect(controller.getState().latestResult?.roll).toBe(74);
  });
});
