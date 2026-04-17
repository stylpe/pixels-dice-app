import "./style.css";
import {
  formatBattery,
  formatCapabilities,
  formatFace,
  formatStatus,
} from "./pixels/format";
import { PixelsController } from "./pixels/pixels-controller";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root not found");
}

const appRoot = root;

const controller = new PixelsController();

function render() {
  const state = controller.getState();
  const connectDisabled = state.busy || !state.capabilities.bluetooth;
  const deviceReady = state.connectionStatus === "ready";
  const disconnectDisabled = state.busy || !state.pixel;
  const actionDisabled = state.busy || !deviceReady;

  appRoot.innerHTML = `
    <div class="shell">
      <section class="hero-panel panel">
        <div class="hero-copy">
          <p class="eyebrow">Pixels Dice Lab</p>
          <h1>Browser-first control room for Pixels dice.</h1>
          <p class="lede">
            Host-only setup. Vanilla TypeScript. No framework tax. Connect, inspect,
            blink, and watch roll events from Chromium.
          </p>
          <div class="action-row">
            <button data-action="connect" ${connectDisabled ? "disabled" : ""}>
              ${state.busy && !state.pixel ? "Working..." : "Connect Pixel"}
            </button>
            <button
              class="ghost"
              data-action="disconnect"
              ${disconnectDisabled ? "disabled" : ""}
            >
              Disconnect
            </button>
            <button
              class="ghost"
              data-action="blink"
              ${actionDisabled ? "disabled" : ""}
            >
              Blink Cyan
            </button>
            <button
              class="ghost"
              data-action="rssi"
              ${actionDisabled ? "disabled" : ""}
            >
              Refresh RSSI
            </button>
          </div>
          <p class="support-note">${formatCapabilities(state.capabilities)}</p>
          ${state.error ? `<p class="error-banner">${state.error}</p>` : ""}
        </div>
        <div class="signal-card">
          <p class="signal-label">Live Status</p>
          <p class="signal-value">${formatStatus(state.connectionStatus)}</p>
          <dl class="signal-grid">
            <div>
              <dt>Device</dt>
              <dd>${state.pixelName || "No Pixel selected"}</dd>
            </div>
            <div>
              <dt>Battery</dt>
              <dd>${formatBattery(state.batteryLevel, state.isCharging)}</dd>
            </div>
            <div>
              <dt>Face Up</dt>
              <dd>${formatFace(state.currentFace)}</dd>
            </div>
            <div>
              <dt>RSSI</dt>
              <dd>${state.rssi === null ? "Not sampled" : `${state.rssi} dBm`}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="dashboard-grid">
        <article class="panel stat-panel">
          <p class="kicker">Roll Feed</p>
          <div class="face-badge">${formatFace(state.currentFace)}</div>
          <p class="roll-state">${state.rollState}</p>
          <p class="subtle">
            Roll stream starts after device reaches ready state. Use this panel to verify
            connection, wake behavior, and face detection.
          </p>
        </article>

        <article class="panel checklist-panel">
          <p class="kicker">Host Workflow</p>
          <ol>
            <li>Run <span>pnpm dev</span> and open app in Chrome or Edge.</li>
            <li>Click connect and choose authorized Pixel.</li>
            <li>Use RSSI and blink controls to sanity-check link quality.</li>
            <li>Roll die and watch event log for live face updates.</li>
          </ol>
        </article>

        <article class="panel log-panel">
          <div class="panel-head">
            <p class="kicker">Event Log</p>
            <button class="ghost small" data-action="clear-log">Clear</button>
          </div>
          <ul class="event-log">
            ${state.eventLog
              .map(
                (entry) => `
                  <li>
                    <span class="timestamp">${entry.at}</span>
                    <span>${entry.message}</span>
                  </li>
                `,
              )
              .join("")}
          </ul>
        </article>
      </section>
    </div>
  `;

  bindActions();
}

function bindActions() {
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="connect"]')
    ?.addEventListener("click", () => {
      void controller.connect();
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="disconnect"]')
    ?.addEventListener("click", () => {
      void controller.disconnect();
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="blink"]')
    ?.addEventListener("click", () => {
      void controller.blink();
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="rssi"]')
    ?.addEventListener("click", () => {
      void controller.refreshRssi();
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="clear-log"]')
    ?.addEventListener("click", () => {
      controller.clearLog();
    });
}

controller.subscribe(render);
render();
