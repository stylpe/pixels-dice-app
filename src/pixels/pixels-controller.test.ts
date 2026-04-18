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
  }

  removeEventListener(
    event: string,
    listener: (...args: Array<unknown>) => void,
  ) {
    this.listeners.get(event)?.delete(listener);
  }

  async disconnect() {
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
});
