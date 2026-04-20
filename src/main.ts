import { ChevronDown, ChevronUp, createIcons, Wrench, X } from "lucide";
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

type DraftFieldAction =
  | "target"
  | "damage-bonus"
  | "defender-success-levels"
  | "critical-hit-location-roll";

type FocusState = {
  action: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

type DraftFieldState = {
  value: string;
  invalid: boolean;
};

const fieldDrafts: Partial<Record<DraftFieldAction, string>> = {};
const uiState = {
  toolsOpen: false,
  logExpanded: false,
};

function render() {
  const focusState = captureFocusState();
  const state = controller.getState();
  const targetField = getDraftFieldState(
    "target",
    String(state.target),
    parseTargetDraft,
    focusState?.action === "target",
  );
  const damageBonusField = getDraftFieldState(
    "damage-bonus",
    String(state.damageBonus),
    parseUnsignedDraft,
    focusState?.action === "damage-bonus",
  );
  const defenderSuccessLevelsField = getDraftFieldState(
    "defender-success-levels",
    String(state.defenderSuccessLevels),
    parseSignedDraft,
    focusState?.action === "defender-success-levels",
  );
  const criticalHitLocationField = getDraftFieldState(
    "critical-hit-location-roll",
    state.criticalHitLocationRoll === null
      ? ""
      : String(state.criticalHitLocationRoll),
    parseTargetDraft,
    focusState?.action === "critical-hit-location-roll",
  );
  const connectDisabled = state.busy || !state.capabilities.bluetooth;
  const disconnectDisabled =
    state.busy || (!state.tensDie.pixel && !state.unitsDie.pixel);
  const resultTone = getResultTone(state.latestResult);
  const shownLogEntries = uiState.logExpanded
    ? state.eventLog
    : state.eventLog.slice(0, 3);
  const latestRollValue = state.latestResult ? state.latestResult.roll : "--";
  const latestDiceValue = state.latestResult
    ? `${state.latestResult.tens} + ${state.latestResult.units}`
    : "--";
  const critLocationPrompt =
    state.attackMode && state.latestResult?.isCritical
      ? renderInputField(
          "Crit Reroll",
          "critical-hit-location-roll",
          criticalHitLocationField,
          false,
          "critical-reroll-field",
          "1-100",
        )
      : "";

  appRoot.innerHTML = `
    <div class="app-shell tone-${resultTone}">
      <header class="status-strip">
        ${renderDieStatusChip(state.tensDie, "d00")}
        ${renderDieStatusChip(state.unitsDie, "d10")}
        ${renderReconnectBadge(state.autoReconnectStatus)}
      </header>

      <main class="control-deck">
        <section class="mode-inputs">
          <div class="mode-row" role="tablist" aria-label="Roll mode">
            <button
              class="mode-pill ${state.attackMode ? "ghost" : "is-active"}"
              data-action="mode-plain"
            >
              Plain d%
            </button>
            <button
              class="mode-pill ${state.attackMode ? "is-active" : "ghost"}"
              data-action="mode-attack"
            >
              Attack
            </button>
            <button
              class="mode-pill ${state.isOpposed ? "is-active" : "ghost"} ${state.attackMode ? "" : "is-hidden"}"
              data-action="toggle-opposed"
              ${state.attackMode ? "" : "disabled"}
            >
              Opposed
            </button>
          </div>

          <div class="input-grid ${state.attackMode ? "attack-active" : ""}">
            ${renderInputField("Target", "target", targetField, false, "", "1-100")}
            ${state.attackMode ? renderInputField("Damage", "damage-bonus", damageBonusField, false, "", "0") : ""}
            ${state.attackMode ? renderInputField("Opp SL", "defender-success-levels", defenderSuccessLevelsField, !state.isOpposed, "", "0") : ""}
            ${critLocationPrompt}
          </div>
        </section>

        <section class="result-hero result-${resultTone}">
          <div class="result-mainline">
            <p class="result-roll">${latestRollValue}</p>
            <div class="result-copy">
              <p class="result-summary-line">${getResultSummary(state.latestResult)}</p>
              <p class="result-detail-line">
                <span>SL ${state.latestResult ? state.latestResult.successLevels : "--"}</span>
                <span>Dice ${latestDiceValue}</span>
              </p>
            </div>
          </div>
          ${renderResultDetails(state)}
          ${state.error ? `<p class="error-banner">${escapeHtml(state.error)}</p>` : ""}
        </section>

        <section class="primary-actions">
          <button data-action="connect" ${connectDisabled ? "disabled" : ""}>
            ${state.busy ? "Working..." : disconnectDisabled ? "Connect Dice" : "Connect More"}
          </button>
          <button
            class="ghost"
            data-action="disconnect"
            ${disconnectDisabled ? "disabled" : ""}
          >
            Disconnect
          </button>
          <button class="ghost tools-trigger" data-action="toggle-tools">
            <i data-lucide="wrench"></i>
            Tools
          </button>
        </section>

        <section class="lower-deck">
          ${renderDiceTelemetry(state)}

          <section class="log-section ${uiState.logExpanded ? "is-open" : ""}">
            <button class="log-toggle" data-action="toggle-log">
              <span>Event Log</span>
              <i data-lucide="${uiState.logExpanded ? "chevron-up" : "chevron-down"}"></i>
            </button>
            <ul class="event-log">
              ${shownLogEntries
                .map(
                  (entry) => `
                    <li>
                      <span class="timestamp">${entry.at}</span>
                      <span>${escapeHtml(entry.message)}</span>
                    </li>
                  `,
                )
                .join("")}
            </ul>
          </section>
        </section>
      </main>

      ${uiState.toolsOpen ? renderToolsOverlay(state) : ""}
    </div>
  `;

  createIcons({
    icons: {
      Wrench,
      X,
      ChevronDown,
      ChevronUp,
    },
    attrs: {
      width: "18",
      height: "18",
      strokeWidth: "1.75",
    },
  });

  bindActions();
  restoreFocusState(focusState);
}

function renderInputField(
  label: string,
  action: DraftFieldAction,
  field: DraftFieldState,
  disabled = false,
  extraClass = "",
  placeholder = "",
): string {
  return `
    <label class="compact-field ${disabled ? "is-disabled" : ""} ${extraClass}">
      <span>${label}</span>
      <input
        type="text"
        inputmode="numeric"
        value="${escapeAttribute(field.value)}"
        placeholder="${escapeAttribute(placeholder)}"
        data-action="${action}"
        aria-invalid="${field.invalid}"
        class="${field.invalid ? "is-invalid" : ""}"
        ${disabled ? "disabled" : ""}
      />
    </label>
  `;
}

function renderDieStatusChip(
  die: ReturnType<PixelsController["getState"]>["tensDie"],
  label: "d00" | "d10",
): string {
  return `
    <section class="die-chip state-${getDieStateTone(die.connectionStatus)}">
      ${renderDieGlyph(label)}
      <div class="die-chip-icons">
        ${renderConnectionGlyph(die.connectionStatus)}
        ${renderBatteryGlyph(die.batteryLevel, die.isCharging)}
      </div>
    </section>
  `;
}

function renderReconnectBadge(status: string | null): string {
  if (!status) {
    return '<section class="reconnect-chip state-idle"><span>Saved off</span></section>';
  }

  const normalized = status.toLowerCase();
  const tone =
    normalized.includes("unavailable") || normalized.includes("failed")
      ? "warning"
      : normalized.includes("saved") ||
          normalized.includes("ready") ||
          normalized.includes("reconnected")
        ? "active"
        : "idle";
  const shortLabel = normalized.includes("unavailable")
    ? "Reconnect !"
    : normalized.includes("saved") ||
        normalized.includes("ready") ||
        normalized.includes("reconnected")
      ? "Saved on"
      : "Saved off";

  return `
    <section class="reconnect-chip state-${tone}">
      <span>${shortLabel}</span>
    </section>
  `;
}

function renderResultDetails(
  state: ReturnType<PixelsController["getState"]>,
): string {
  if (!state.latestResult) {
    return `
      <p class="result-facts-line muted-details">
        <span><strong>Target</strong> ${state.target}</span>
        <span><strong>Status</strong> Waiting for roll</span>
      </p>
    `;
  }

  const detailItems = state.attackMode
    ? `
        <span><strong>Damage</strong> ${state.latestResult.rawDamage ?? "--"}</span>
        <span><strong>Hit</strong> ${state.latestResult.hitLocation ?? (state.latestResult.isCritical ? "Reroll needed" : "--")}</span>
        <span><strong>Special</strong> ${state.latestResult.isCritical ? "Critical" : state.latestResult.isFumble ? "Fumble" : "None"}</span>
      `
    : `
        <span><strong>Target</strong> ${state.latestResult.target}</span>
        <span><strong>Outcome</strong> ${getOutcomeLabel(state.latestResult)}</span>
      `;

  const note =
    state.latestResult.resolution === "tie-breaker"
      ? '<p class="result-note">Tie on SL. Compare skill or characteristic to settle outcome.</p>'
      : state.attackMode && state.latestResult.rawDamage !== null
        ? `<p class="result-note">${renderDamageFormulaText(state.latestResult)}</p>`
        : "";

  return `
    <p class="result-facts-line ${state.attackMode ? "" : "muted-details"}">
      ${detailItems}
    </p>
    ${note}
  `;
}

function renderDiceTelemetry(
  state: ReturnType<PixelsController["getState"]>,
): string {
  return `
    <section class="dice-telemetry" aria-label="Connected dice status">
      <div class="telemetry-columns" aria-hidden="true">
        <span><span class="telemetry-label-long">Die</span><span class="telemetry-label-short">Die</span></span>
        <span><span class="telemetry-label-long">Name</span><span class="telemetry-label-short">Name</span></span>
        <span><span class="telemetry-label-long">Face</span><span class="telemetry-label-short">Face</span></span>
        <span><span class="telemetry-label-long">Battery</span><span class="telemetry-label-short">Batt</span></span>
        <span><span class="telemetry-label-long">Status</span><span class="telemetry-label-short">State</span></span>
      </div>
      ${renderDieTelemetryRow(state.tensDie, "Tens d00")}
      ${renderDieTelemetryRow(state.unitsDie, "Units d10")}
    </section>
  `;
}

function renderDieTelemetryRow(
  die: ReturnType<PixelsController["getState"]>["tensDie"],
  label: string,
): string {
  const status = formatStatus(die.connectionStatus as never);
  const compactStatus = formatCompactTelemetryStatus(die.connectionStatus);
  const battery = formatBattery(die.batteryLevel, die.isCharging);
  const compactBattery = formatCompactTelemetryBattery(
    die.batteryLevel,
    die.isCharging,
  );

  return `
    <section class="telemetry-row state-${getDieStateTone(die.connectionStatus)}">
      <div class="telemetry-cell telemetry-kind">
        <span class="telemetry-cell-label">Die</span>
        <p class="telemetry-label">${label}</p>
      </div>
      <div class="telemetry-cell telemetry-name-cell">
        <span class="telemetry-cell-label">Name</span>
        <p class="telemetry-name">${die.name || "Not connected"}</p>
      </div>
      <div class="telemetry-cell telemetry-metric">
        <span class="telemetry-cell-label">Face</span>
        <p class="telemetry-value">${formatFace(die.currentFace)}</p>
      </div>
      <div class="telemetry-cell telemetry-metric">
        <span class="telemetry-cell-label">Battery</span>
        <p class="telemetry-value" title="${escapeHtml(battery)}">${compactBattery}</p>
      </div>
      <div class="telemetry-cell telemetry-status-cell">
        <span class="telemetry-cell-label">Status</span>
        <p class="telemetry-status" title="${escapeHtml(status)}">${compactStatus}</p>
      </div>
    </section>
  `;
}

function formatCompactTelemetryStatus(connectionStatus: string): string {
  switch (connectionStatus) {
    case "connecting":
      return "Linking";
    case "identifying":
      return "ID";
    case "ready":
      return "Ready";
    case "disconnecting":
      return "Closing";
    default:
      return "Offline";
  }
}

function formatCompactTelemetryBattery(
  level: number | null,
  isCharging: boolean,
): string {
  if (level === null) {
    return "--";
  }

  return `${level}%${isCharging ? "+" : ""}`;
}

function renderToolsOverlay(
  state: ReturnType<PixelsController["getState"]>,
): string {
  return `
    <div class="tools-overlay" data-action="close-tools-backdrop">
      <section class="tools-panel" aria-label="Tools and diagnostics">
        <header class="tools-header">
          <div>
            <p class="tools-kicker">Tools</p>
            <h2>Utility and diagnostics</h2>
          </div>
          <button class="ghost icon-button" data-action="toggle-tools" aria-label="Close tools">
            <i data-lucide="x"></i>
          </button>
        </header>

        <div class="tools-grid">
          <section>
            <p class="tools-label">Capabilities</p>
            <p class="tools-copy">${escapeHtml(formatCapabilities(state.capabilities))}</p>
          </section>
          <section>
            <p class="tools-label">Reconnect</p>
            <p class="tools-copy">${escapeHtml(state.autoReconnectStatus ?? "Saved dice not configured yet.")}</p>
          </section>
          <section>
            <p class="tools-label">Latest result</p>
            <p class="tools-copy">${escapeHtml(getResultSummary(state.latestResult))}</p>
          </section>
          <section>
            <p class="tools-label">Supported flow</p>
            <p class="tools-copy">Chrome is the main browser target. Official Pixels d00 and d10 remain the supported dice path.</p>
          </section>
        </div>

        <div class="tools-actions">
          <button class="ghost" data-action="clear-log">Clear log</button>
        </div>
      </section>
    </div>
  `;
}

function renderConnectionGlyph(connectionStatus: string): string {
  const bars =
    connectionStatus === "ready"
      ? 3
      : connectionStatus === "connecting" || connectionStatus === "identifying"
        ? 2
        : connectionStatus === "disconnecting"
          ? 1
          : 0;

  return `
    <span class="signal-bars" aria-hidden="true">
      ${[1, 2, 3]
        .map(
          (index) =>
            `<span class="signal-bar ${index <= bars ? "is-on" : ""}"></span>`,
        )
        .join("")}
    </span>
  `;
}

function renderBatteryGlyph(level: number | null, isCharging: boolean): string {
  if (level === null) {
    return '<span class="battery-glyph is-unknown"><span class="battery-shell"></span></span>';
  }

  const segments =
    level >= 81 ? 5 : level >= 61 ? 4 : level >= 41 ? 3 : level >= 21 ? 2 : 1;
  const tone = level <= 20 ? "is-low" : "";

  return `
    <span class="battery-glyph ${tone} ${isCharging ? "is-charging" : ""}" aria-hidden="true">
      <span class="battery-shell">
        ${Array.from({ length: 5 }, (_, index) => `<span class="battery-segment ${index < segments ? "is-on" : ""}"></span>`).join("")}
      </span>
      ${isCharging ? '<span class="battery-bolt">+</span>' : ""}
    </span>
  `;
}

function renderDieGlyph(label: "d00" | "d10"): string {
  const text = label === "d00" ? "00" : "0";
  const faceClass = label === "d00" ? "is-double" : "is-single";

  return `
    <span class="die-glyph ${faceClass}" aria-label="${label} die">
      <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
        <path class="die-side-face" d="M24 6.5 10 22 8 26 12.5 27"></path>
        <path class="die-side-face" d="M24 6.5 38 22 40 26 35.5 27"></path>
        <path class="die-face" d="M24 6.5 35.5 27 24 33 12.5 27Z"></path>
        <path class="die-bottom-seams" d="M8 26 24 38 M24 33 24 38 M40 26 24 38"></path>
        <text x="24" y="24.9" text-anchor="middle" dominant-baseline="middle">${text}</text>
      </svg>
    </span>
  `;
}

function getDieStateTone(connectionStatus: string): string {
  switch (connectionStatus) {
    case "ready":
      return "connected";
    case "connecting":
    case "identifying":
    case "disconnecting":
      return "busy";
    default:
      return "idle";
  }
}

function captureFocusState(): FocusState | null {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLInputElement)) {
    return null;
  }

  const action = activeElement.dataset.action;

  if (!action) {
    return null;
  }

  return {
    action,
    selectionStart: activeElement.selectionStart,
    selectionEnd: activeElement.selectionEnd,
  };
}

function restoreFocusState(focusState: FocusState | null) {
  if (!focusState) {
    return;
  }

  const input = appRoot.querySelector<HTMLInputElement>(
    `[data-action="${focusState.action}"]`,
  );

  if (!input || input.disabled) {
    return;
  }

  input.focus();

  if (focusState.selectionStart === null || focusState.selectionEnd === null) {
    return;
  }

  input.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
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
    .querySelectorAll<HTMLButtonElement>('[data-action="toggle-tools"]')
    .forEach((button) => {
      button.addEventListener("click", () => {
        uiState.toolsOpen = !uiState.toolsOpen;
        render();
      });
    });
  appRoot
    .querySelector<HTMLDivElement>('[data-action="close-tools-backdrop"]')
    ?.addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) {
        return;
      }

      uiState.toolsOpen = false;
      render();
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="toggle-log"]')
    ?.addEventListener("click", () => {
      uiState.logExpanded = !uiState.logExpanded;
      render();
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="clear-log"]')
    ?.addEventListener("click", () => {
      controller.clearLog();
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="target"]')
    ?.addEventListener("input", (event) => {
      updateDraftField(
        "target",
        (event.currentTarget as HTMLInputElement).value,
        parseTargetDraft,
        (value) => {
          controller.setTarget(value);
        },
      );
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="target"]')
    ?.addEventListener("blur", () => {
      finalizeDraftField("target", parseTargetDraft);
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="mode-plain"]')
    ?.addEventListener("click", () => {
      controller.setAttackMode(false);
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="mode-attack"]')
    ?.addEventListener("click", () => {
      controller.setAttackMode(true);
    });
  appRoot
    .querySelector<HTMLButtonElement>('[data-action="toggle-opposed"]')
    ?.addEventListener("click", () => {
      controller.setOpposed(!controller.getState().isOpposed);
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="damage-bonus"]')
    ?.addEventListener("input", (event) => {
      updateDraftField(
        "damage-bonus",
        (event.currentTarget as HTMLInputElement).value,
        parseUnsignedDraft,
        (value) => {
          controller.setAttackDamageBonus(value);
        },
      );
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="damage-bonus"]')
    ?.addEventListener("blur", () => {
      finalizeDraftField("damage-bonus", parseUnsignedDraft);
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="defender-success-levels"]')
    ?.addEventListener("input", (event) => {
      updateDraftField(
        "defender-success-levels",
        (event.currentTarget as HTMLInputElement).value,
        parseSignedDraft,
        (value) => {
          controller.setDefenderSuccessLevels(value);
        },
      );
    });
  appRoot
    .querySelector<HTMLInputElement>('[data-action="defender-success-levels"]')
    ?.addEventListener("blur", () => {
      finalizeDraftField("defender-success-levels", parseSignedDraft);
    });
  appRoot
    .querySelector<HTMLInputElement>(
      '[data-action="critical-hit-location-roll"]',
    )
    ?.addEventListener("input", (event) => {
      updateDraftField(
        "critical-hit-location-roll",
        (event.currentTarget as HTMLInputElement).value,
        parseTargetDraft,
        (value) => {
          controller.setCriticalHitLocationRoll(value);
        },
      );
    });
  appRoot
    .querySelector<HTMLInputElement>(
      '[data-action="critical-hit-location-roll"]',
    )
    ?.addEventListener("blur", () => {
      finalizeDraftField("critical-hit-location-roll", parseTargetDraft);
    });
}

function getDraftFieldState(
  action: DraftFieldAction,
  committedValue: string,
  parse: (value: string) => number | null,
  isFocused: boolean,
): DraftFieldState {
  const draftValue = fieldDrafts[action];

  if (draftValue === undefined) {
    return {
      value: committedValue,
      invalid: false,
    };
  }

  const parsedValue = parse(draftValue);

  if (
    !isFocused &&
    parsedValue !== null &&
    String(parsedValue) === committedValue
  ) {
    delete fieldDrafts[action];

    return {
      value: committedValue,
      invalid: false,
    };
  }

  return {
    value: draftValue,
    invalid: parsedValue === null,
  };
}

function updateDraftField(
  action: DraftFieldAction,
  rawValue: string,
  parse: (value: string) => number | null,
  onValid: (value: number) => void,
) {
  fieldDrafts[action] = rawValue;

  const parsedValue = parse(rawValue);

  if (parsedValue === null) {
    render();
    return;
  }

  onValid(parsedValue);
}

function finalizeDraftField(
  action: DraftFieldAction,
  parse: (value: string) => number | null,
) {
  const draftValue = fieldDrafts[action];

  if (draftValue === undefined) {
    return;
  }

  if (parse(draftValue) === null) {
    render();
    return;
  }

  delete fieldDrafts[action];
  render();
}

function getResultTone(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): "idle" | "success" | "failure" | "warning" {
  if (!latestResult) {
    return "idle";
  }

  if (latestResult.resolution === "tie-breaker") {
    return "warning";
  }

  return latestResult.success ? "success" : "failure";
}

function getOutcomeLabel(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult) {
    return "Waiting";
  }

  if (latestResult.resolution === "tie-breaker") {
    return "Tie Break";
  }

  return latestResult.success ? "Success" : "Failure";
}

function getResultSummary(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult) {
    return "Waiting for roll.";
  }

  if (latestResult.resolution === "tie-breaker") {
    return `Opposed tie on ${latestResult.successLevels} SL.`;
  }

  if (latestResult.success) {
    return `Success by ${latestResult.successLevels} SL.`;
  }

  if (
    latestResult.isAttackMode &&
    latestResult.isOpposed &&
    latestResult.successLevels >= 0
  ) {
    return "Lost opposed test. Opponent has higher SL.";
  }

  return `Failure by ${Math.abs(latestResult.successLevels)} SL.`;
}

function renderDamageFormulaText(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult?.isAttackMode || latestResult.rawDamage === null) {
    return "";
  }

  return latestResult.isOpposed
    ? `${latestResult.successLevels} SL + ${latestResult.damageBonus} DB - (${latestResult.defenderSuccessLevels} Opp SL) = ${latestResult.rawDamage}`
    : `${latestResult.successLevels} SL + ${latestResult.damageBonus} DB = ${latestResult.rawDamage}`;
}

function parseTargetDraft(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsedValue = Number(value);

  if (parsedValue < 1 || parsedValue > 100) {
    return null;
  }

  return parsedValue;
}

function parseUnsignedDraft(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function parseSignedDraft(value: string): number | null {
  if (!/^-?\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

controller.subscribe(render);
render();
void controller.initialize();
