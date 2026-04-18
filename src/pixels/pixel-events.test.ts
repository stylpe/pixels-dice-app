import { describe, expect, it, vi } from "vitest";

import {
  attachPixelEventHandlers,
  detachPixelEventHandlers,
  type PixelEventHandlers,
} from "./pixel-events";

class FakePixel {
  calls: Array<{ method: string; event: string; listener: unknown }> = [];

  addEventListener(event: string, listener: unknown) {
    this.calls.push({ method: "add", event, listener });
  }

  removeEventListener(event: string, listener: unknown) {
    this.calls.push({ method: "remove", event, listener });
  }
}

describe("pixel event helpers", () => {
  it("attaches all pixel event handlers", () => {
    const pixel = new FakePixel();
    const handlers: PixelEventHandlers = {
      statusChanged: vi.fn(),
      rollState: vi.fn(),
      roll: vi.fn(),
      battery: vi.fn(),
    };

    expect(attachPixelEventHandlers(pixel as never, handlers)).toBe(handlers);
    expect(pixel.calls).toEqual([
      {
        method: "add",
        event: "statusChanged",
        listener: handlers.statusChanged,
      },
      { method: "add", event: "rollState", listener: handlers.rollState },
      { method: "add", event: "roll", listener: handlers.roll },
      { method: "add", event: "battery", listener: handlers.battery },
    ]);
  });

  it("detaches all pixel event handlers", () => {
    const pixel = new FakePixel();
    const handlers: PixelEventHandlers = {
      statusChanged: vi.fn(),
      rollState: vi.fn(),
      roll: vi.fn(),
      battery: vi.fn(),
    };

    detachPixelEventHandlers(pixel as never, handlers);

    expect(pixel.calls).toEqual([
      {
        method: "remove",
        event: "statusChanged",
        listener: handlers.statusChanged,
      },
      { method: "remove", event: "rollState", listener: handlers.rollState },
      { method: "remove", event: "roll", listener: handlers.roll },
      { method: "remove", event: "battery", listener: handlers.battery },
    ]);
  });
});
