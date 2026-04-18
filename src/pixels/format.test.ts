import { describe, expect, it } from "vitest";

import {
  formatBattery,
  formatCapabilities,
  formatFace,
  formatStatus,
} from "./format";

describe("format helpers", () => {
  it("formats status labels", () => {
    expect(formatStatus("ready")).toBe("Ready");
    expect(formatStatus("disconnected")).toBe("Disconnected");
  });

  it("formats capability guidance", () => {
    expect(
      formatCapabilities({ bluetooth: false, persistentPermissions: false }),
    ).toContain("Use Chrome on localhost or HTTPS");

    expect(
      formatCapabilities({ bluetooth: true, persistentPermissions: false }),
    ).toContain("saved dice may still need user approval again");

    expect(
      formatCapabilities({ bluetooth: true, persistentPermissions: true }),
    ).toContain("Saved dice can auto-reconnect");
  });

  it("formats battery and face values", () => {
    expect(formatBattery(null, false)).toBe("Unknown");
    expect(formatBattery(87, true)).toBe("87% charging");
    expect(formatFace(null)).toBe("--");
    expect(formatFace(20)).toBe("20");
  });
});
