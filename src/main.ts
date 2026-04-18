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

function render() {
  const focusState = captureFocusState();
  const state = controller.getState();
  const targetField = getDraftFieldState(
    "target",
    String(state.target),
    parseTargetDraft,
    focusState?.action === "target",
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
  const attackPanel = state.attackMode
    ? renderAttackPanel(state.latestResult)
    : "";
  const critLocationPrompt =
    state.attackMode && state.latestResult?.isCritical
      ? `
        <label class="target-field compact-field">
          <span>Crit Location Reroll</span>
          <input
            type="text"
            inputmode="numeric"
            value="${escapeAttribute(criticalHitLocationField.value)}"
            placeholder="Roll 1-100"
            data-action="critical-hit-location-roll"
            aria-invalid="${criticalHitLocationField.invalid}"
            class="${criticalHitLocationField.invalid ? "is-invalid" : ""}"
          />
        </label>
      `
      : "";

  appRoot.innerHTML = `
    <div class="shell">
      <section class="hero-panel panel">
        <div class="hero-copy">
          <p class="eyebrow">Pixels WFRP V1</p>
          <h1>Run WFRP tests with connected Pixels dice.</h1>
          <p class="lede">
            Plain d% and attack helper mode. Connect official Pixels d00 and d10 dice,
            then resolve target, SL, hit location, and raw damage in one pass.
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
          <div class="config-grid">
            <label class="target-field">
              <span>Target</span>
              <input
                type="text"
                inputmode="numeric"
                value="${escapeAttribute(targetField.value)}"
                data-action="target"
                aria-invalid="${targetField.invalid}"
                class="${targetField.invalid ? "is-invalid" : ""}"
              />
            </label>
            <div class="mode-card">
              <p class="mode-label">Mode</p>
              <div class="toggle-row">
                <button
                  class="${state.attackMode ? "ghost" : "toggle-active"}"
                  data-action="mode-plain"
                >
                  Plain d%
                </button>
                <button
                  class="${state.attackMode ? "toggle-active" : "ghost"}"
                  data-action="mode-attack"
                >
                  Attack Helper
                </button>
              </div>
            </div>
          </div>
          ${state.attackMode ? renderAttackFields(state) : ""}
          ${critLocationPrompt}
          ${state.attackMode ? '<p class="attack-note">Attack-only rules active: crit/fumble, hit location, and raw damage before armor/TB.</p>' : ""}
          <p class="support-note">${formatCapabilities(state.capabilities)}</p>
          ${state.error ? `<p class="error-banner">${state.error}</p>` : ""}
        </div>
        <div class="signal-card">
          <p class="signal-label">Latest Result</p>
          <p class="signal-value result-${resultTone}">${state.latestResult ? state.latestResult.roll : "--"}</p>
          <p class="result-summary">${getResultSummary(state.latestResult)}</p>
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
              <dd>${getOutcomeLabel(state.latestResult)}</dd>
            </div>
            <div>
              <dt>Dice</dt>
              <dd>${state.latestResult ? `${state.latestResult.tens} + ${state.latestResult.units}` : "--"}</dd>
            </div>
          </dl>
          ${attackPanel}
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
          <p class="kicker">V1 Flow</p>
          <ol>
            <li>Run <span>pnpm dev</span> and open app in Chrome.</li>
            <li>Connect official Pixels d00 and d10 dice.</li>
            <li>Choose plain d% or attack helper mode.</li>
            <li>Set target and attack values if needed.</li>
            <li>Roll both dice and watch result panel resolve.</li>
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
  restoreFocusState(focusState);
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
    .querySelector<HTMLInputElement>('[data-action="opposed"]')
    ?.addEventListener("change", (event) => {
      controller.setOpposed((event.currentTarget as HTMLInputElement).checked);
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

function renderAttackFields(
  state: ReturnType<PixelsController["getState"]>,
): string {
  const damageBonusField = getDraftFieldState(
    "damage-bonus",
    String(state.damageBonus),
    parseUnsignedDraft,
    document.activeElement instanceof HTMLInputElement &&
      document.activeElement.dataset.action === "damage-bonus",
  );
  const defenderSuccessLevelsField = getDraftFieldState(
    "defender-success-levels",
    String(state.defenderSuccessLevels),
    parseSignedDraft,
    document.activeElement instanceof HTMLInputElement &&
      document.activeElement.dataset.action === "defender-success-levels",
  );

  return `
    <section class="attack-fields">
      <label class="target-field compact-field">
        <span>Damage Bonus</span>
        <input
          type="text"
          value="${escapeAttribute(damageBonusField.value)}"
          data-action="damage-bonus"
          aria-invalid="${damageBonusField.invalid}"
          class="${damageBonusField.invalid ? "is-invalid" : ""}"
        />
      </label>
      <label class="check-field">
        <input
          type="checkbox"
          ${state.isOpposed ? "checked" : ""}
          data-action="opposed"
        />
        <span>Opposed Test</span>
      </label>
      <label class="target-field compact-field ${state.isOpposed ? "" : "disabled-field"}">
        <span>Opponent SL</span>
        <input
          type="text"
          value="${escapeAttribute(defenderSuccessLevelsField.value)}"
          data-action="defender-success-levels"
          aria-invalid="${defenderSuccessLevelsField.invalid}"
          class="${defenderSuccessLevelsField.invalid ? "is-invalid" : ""}"
          ${state.isOpposed ? "" : "disabled"}
        />
      </label>
    </section>
  `;
}

function renderAttackPanel(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult) {
    return `
      <section class="attack-result-panel attack-result-idle">
        <div class="attack-result-head">
          <p class="attack-result-title">Attack Result</p>
        </div>
        <dl class="attack-result-grid">
          <div>
            <dt>Damage</dt>
            <dd>--</dd>
          </div>
          <div>
            <dt>Hit</dt>
            <dd>--</dd>
          </div>
          <div>
            <dt>Special</dt>
            <dd>Waiting</dd>
          </div>
        </dl>
      </section>
    `;
  }

  const tone = getAttackPanelTone(latestResult);
  const toneLabel = getAttackPanelLabel(latestResult);
  const hitValue =
    latestResult.hitLocation ??
    (latestResult.isCritical ? "Reroll Needed" : "--");

  return `
    <section class="attack-result-panel attack-result-${tone}">
      <div class="attack-result-head">
        <p class="attack-result-title">Attack Result</p>
        ${toneLabel ? `<span class="attack-result-badge attack-result-badge-${tone}">${toneLabel}</span>` : ""}
      </div>
      <dl class="attack-result-grid">
        <div>
          <dt>Damage</dt>
          <dd>${latestResult.rawDamage ?? "--"}</dd>
        </div>
        <div>
          <dt>Hit</dt>
          <dd>${hitValue}</dd>
        </div>
        <div>
          <dt>Special</dt>
          <dd>${latestResult.isCritical ? "Critical" : latestResult.isFumble ? "Fumble" : "None"}</dd>
        </div>
      </dl>
      ${renderDamageFormula(latestResult)}
      ${renderTieBreakerNotice(latestResult)}
    </section>
  `;
}

function renderTieBreakerNotice(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult || latestResult.resolution !== "tie-breaker") {
    return "";
  }

  return '<p class="tie-banner">Tie on SL. Compare relevant skill or characteristic to decide winner. Attack details stay provisional until that check is done.</p>';
}

function renderDamageFormula(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult?.isAttackMode || latestResult.rawDamage === null) {
    return "";
  }

  const formula = latestResult.isOpposed
    ? `${latestResult.successLevels} SL + ${latestResult.damageBonus} DB - (${latestResult.defenderSuccessLevels} Opp SL) = ${latestResult.rawDamage}`
    : `${latestResult.successLevels} SL + ${latestResult.damageBonus} DB = ${latestResult.rawDamage}`;

  return `
    <p class="result-formula">
      <span class="formula-label">Damage Formula</span>
      <span class="formula-value">${formula}</span>
    </p>
  `;
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
    return `Opposed tie on ${latestResult.successLevels} SL. Compare skill or characteristic.`;
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

function getAttackPanelTone(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): "idle" | "success" | "failure" | "warning" {
  if (!latestResult) {
    return "idle";
  }

  return getResultTone(latestResult);
}

function getAttackPanelLabel(
  latestResult: ReturnType<PixelsController["getState"]>["latestResult"],
): string {
  if (!latestResult) {
    return "";
  }

  if (latestResult.resolution === "tie-breaker") {
    return "Tie Break";
  }

  if (latestResult.isOpposed) {
    return "Opposed";
  }

  return "";
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

controller.subscribe(render);
render();
