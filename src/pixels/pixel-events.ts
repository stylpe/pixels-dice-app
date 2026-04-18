import type { Pixel } from "@systemic-games/pixels-web-connect";

export type PixelRollStateEvent = {
  state: string;
  face: number;
};

export type PixelBatteryEvent = {
  level: number;
  isCharging: boolean;
};

export type PixelEventHandlers = {
  statusChanged: () => void;
  rollState: (event: PixelRollStateEvent) => void;
  roll: (face: number) => void;
  battery: (event: PixelBatteryEvent) => void;
};

export function attachPixelEventHandlers(
  pixel: Pixel,
  handlers: PixelEventHandlers,
): PixelEventHandlers {
  pixel.addEventListener("statusChanged", handlers.statusChanged);
  pixel.addEventListener("rollState", handlers.rollState);
  pixel.addEventListener("roll", handlers.roll);
  pixel.addEventListener("battery", handlers.battery);

  return handlers;
}

export function detachPixelEventHandlers(
  pixel: Pixel,
  handlers: PixelEventHandlers,
) {
  pixel.removeEventListener("statusChanged", handlers.statusChanged);
  pixel.removeEventListener("rollState", handlers.rollState);
  pixel.removeEventListener("roll", handlers.roll);
  pixel.removeEventListener("battery", handlers.battery);
}
