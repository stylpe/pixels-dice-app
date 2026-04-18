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
  const disconnectDisabled =
    state.busy || (!state.tensDie.pixel && !state.unitsDie.pixel);
  const resultTone = state.latestResult
    ? state.latestResult.success
      ? "success"
      : "failure"
    : "idle";

  appRoot.innerHTML = `
    <div class="shell">
      <section class="hero-panel panel">
        <div class="hero-copy">
          <p class="eyebrow">Pixels WFRP POC</p>
          <h1>Roll percentile tests with connected Pixels dice.</h1>
          <p class="lede">
            Thin first slice. Connect official Pixels d00 and d10 dice, enter target,
            and get D% plus success levels.
          </p>
          <div class="action-row">
            <button data-action="connect" ${connectDisabled ? "disabled" : ""}>
              ${state.busy ? "Working..." : "Connect Die"}
            </button>
            <button
              class="ghost"
              data-action="disconnect"
              ${disconnectDisabled ? "disabled" : ""}
            >
              Disconnect Dice
            </button>
          </div>
          <label class="target-field">
            <span>Target</span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value="${state.target}"
              data-action="target"
            />
          </label>
          <p class="support-note">${formatCapabilities(state.capabilities)}</p>
          ${state.error ? `<p class="error-banner">${state.error}</p>` : ""}
        </div>
        <div class="signal-card">
          <p class="signal-label">Latest Result</p>
          <p class="signal-value result-${resultTone}">${state.latestResult ? state.latestResult.roll : "--"}</p>
          <dl class="signal-grid result-grid">
            <div>
              <dt>Target</dt>
              <dd>${state.target}</dd>
            </div>
            <div>
              <dt>SL</dt>
              <dd>${state.latestResult ? state.latestResult.successLevels : "--"}</dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>${state.latestResult ? (state.latestResult.success ? "Success" : "Failure") : "Waiting"}</dd>
            </div>
            <div>
              <dt>Dice</dt>
              <dd>${state.latestResult ? `${state.latestResult.tens} + ${state.latestResult.units}` : "--"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="dashboard-grid">
        <article class="panel dice-panel">
          <p class="kicker">Connected Dice</p>
          <div class="die-grid">
            ${renderDieCard(state.tensDie, "Tens d00")}
            ${renderDieCard(state.unitsDie, "Units d10")}
          </div>
        </article>

        <article class="panel checklist-panel">
          <p class="kicker">POC Flow</p>
          <ol>
            <li>Run <span>pnpm dev</span> and open app in Chrome.</li>
            <li>Connect official Pixels d00 and d10 dice.</li>
            <li>Set target value for test.</li>
            <li>Roll both dice and watch D% plus SL update.</li>
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
    .querySelector<HTMLButtonElement>('[data-action="clear-log"]')
    ?.addEventListener("click", () => {
      controller.clearLog();
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="target"]')
    ?.addEventListener("input", (event) => {
      const target = Number((event.currentTarget as HTMLInputElement).value);
      controller.setTarget(target);
    });
}

function renderDieCard(
  die: {
    connectionStatus: string;
    name: string;
    currentFace: number | null;
    batteryLevel: number | null;
    isCharging: boolean;
  },
  label: string,
): string {
  return `
    <section class="die-card">
      <p class="die-label">${label}</p>
      <p class="die-name">${die.name || "Not connected"}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>${formatStatus(die.connectionStatus as never)}</dd>
        </div>
        <div>
          <dt>Face</dt>
          <dd>${formatFace(die.currentFace)}</dd>
        </div>
        <div>
          <dt>Battery</dt>
          <dd>${formatBattery(die.batteryLevel, die.isCharging)}</dd>
        </div>
      </dl>
    </section>
  `;
}

controller.subscribe(render);
render();
