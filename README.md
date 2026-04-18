# Pixels Dice Lab

Host-first browser app starter for Pixels dice using Vite, vanilla TypeScript, pnpm, Biome, Vitest, and Playwright.

## Stack

- Vite + vanilla TypeScript
- pnpm for dependency management
- Biome for format and lint
- Vitest for unit tests
- Playwright for browser smoke tests
- `@systemic-games/pixels-web-connect` for Web Bluetooth access

## Why this shape

- No backend. Browser is runtime environment.
- No framework overhead while learning Pixels APIs.
- Pixels connection logic isolated in `src/pixels` so UI can be swapped later.

## Run

```bash
pnpm install
pnpm dev
```

Open app in Chrome or Edge at the local URL Vite prints.
Chrome is primary dev and test target.

For explicit local modes:

```bash
pnpm dev:desktop
pnpm dev:usb
pnpm adb:reverse
```

## Commands

```bash
pnpm build
pnpm check
pnpm test
pnpm playwright:install
pnpm test:e2e
```

## Debug In Chrome

- Use VS Code Run and Debug with `Chrome: Launch Pixels App`.
- That profile starts Vite on `http://localhost:5173` and opens Google Chrome with debugger attached.
- Chrome is preferred because persistent Web Bluetooth permission support is the main tested path.
- Edge can still work for basic Web Bluetooth, but it is no longer the primary dev target.

## Android USB Testing

- Enable USB debugging on Android device.
- Connect phone over USB.
- Run `pnpm adb:reverse` so phone `localhost:5173` points at laptop port 5173.
- Run `pnpm dev:usb` to bind Vite on `127.0.0.1:5173`.
- Open `http://localhost:5173` in Chrome on phone.
- VS Code task shortcut: run `phone-usb`.

## Web Bluetooth caveats

- Use Chromium-based browser. Chrome is primary target.
- Web Bluetooth requires secure context. `localhost` works for development.
- Android over USB can use `adb reverse` plus `http://localhost:5173` to keep secure-context behavior without LAN HTTPS.
- Browser inside terminal tooling is irrelevant here. Real runtime is host browser.
- Reconnect persistence depends on Chrome permissions backend state.
- Windows reconnect timing can be flaky; `repeatConnect()` already used for that.

## Project layout

- `src/main.ts`: DOM rendering and UI wiring
- `src/pixels/pixels-controller.ts`: Pixels device orchestration and app state
- `src/pixels/format.ts`: UI-facing formatting helpers
- `tests/smoke.spec.ts`: Playwright smoke test

## Next likely additions

- remember last authorized `systemId`
- reconnect helper for previously authorized dice
- animation playground using `@systemic-games/pixels-edit-animation`
- richer log filtering and telemetry panels
