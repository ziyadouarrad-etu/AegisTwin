import { INPUT_DEFS, OUTPUT_DEFS, SENSOR_KEYS, STATE_NAMES } from "../sim/io.js";

const SENSOR_SET = new Set(SENSOR_KEYS);

export class PanelUI {
    constructor(controller, { onCameraReset, onSpeedChange } = {}) {
        this.controller = controller;
        this.onCameraReset = onCameraReset;
        this.onSpeedChange = onSpeedChange;

        this.inputRows = new Map();
        this.outputRows = new Map();
        this.stateChips = new Map();

        this.el = {
            inputRows: document.getElementById("inputRows"),
            outputRows: document.getElementById("outputRows"),
            inputCount: document.getElementById("inputCount"),
            outputCount: document.getElementById("outputCount"),
            stateBadge: document.getElementById("stateBadge"),
            stateLabel: document.getElementById("stateLabel"),
            stateStrip: document.getElementById("stateStrip"),
            cycleCount: document.getElementById("cycleCount"),
            passCount: document.getElementById("passCount"),
            rejectCount: document.getElementById("rejectCount"),
            btnStart: document.getElementById("btnStart"),
            btnStop: document.getElementById("btnStop"),
            btnEstop: document.getElementById("btnEstop"),
            btnCamera: document.getElementById("btnCamera"),
            btnClearOverrides: document.getElementById("btnClearOverrides"),
            manualSensors: document.getElementById("manualSensors"),
            speed: document.getElementById("speed"),
            speedValue: document.getElementById("speedValue"),
            dockHint: document.getElementById("dockHint"),
            loading: document.getElementById("loading"),
            loadingText: document.getElementById("loadingText"),
            progressBar: document.getElementById("progressBar"),
            errorToast: document.getElementById("errorToast"),
        };

        this.el.inputCount.textContent = String(INPUT_DEFS.length);
        this.el.outputCount.textContent = String(OUTPUT_DEFS.length);

        this.buildInputs();
        this.buildOutputs();
        this.buildStateStrip();
        this.bindControls();
    }

    buildInputs() {
        const groups = new Map();
        for (const def of INPUT_DEFS) {
            if (!groups.has(def.group)) groups.set(def.group, []);
            groups.get(def.group).push(def);
        }

        for (const [group, defs] of groups) {
            const label = document.createElement("div");
            label.className = "io-group-label";
            label.textContent = group;
            this.el.inputRows.appendChild(label);

            for (const def of defs) {
                const row = document.createElement("div");
                row.className = "io-row clickable";
                row.setAttribute("role", "button");
                row.tabIndex = 0;
                row.title = `${def.desc} (${def.addr})`;

                const led = document.createElement("span");
                led.className = "led";

                const meta = document.createElement("span");
                meta.className = "io-meta";
                const tag = document.createElement("span");
                tag.className = "io-tag";
                tag.textContent = def.key;
                const desc = document.createElement("span");
                desc.className = "io-desc";
                desc.textContent = def.desc;
                meta.append(tag, desc);

                const addr = document.createElement("span");
                addr.className = "io-addr";
                addr.textContent = def.addr;

                const value = document.createElement("span");
                value.className = "io-value";
                value.textContent = "0";

                const override = document.createElement("button");
                if (SENSOR_SET.has(def.key)) {
                    override.className = "override-btn";
                    override.type = "button";
                    override.textContent = "A";
                    override.title = "Manual override";
                    override.addEventListener("click", (event) => {
                        event.stopPropagation();
                        if (this.controller.overrides[def.key] !== undefined) {
                            this.controller.clearOverride(def.key);
                        } else {
                            this.controller.setOverride(def.key, this.controller.inputs[def.key]);
                        }
                    });
                } else {
                    override.className = "override-spacer";
                }

                row.append(led, meta, addr, value, override);
                row.addEventListener("click", () => this.handleInputClick(def.key));
                row.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        this.handleInputClick(def.key);
                    }
                });

                this.inputRows.set(def.key, { row, led, value, override, def });
                this.el.inputRows.appendChild(row);
            }
        }
    }

    buildOutputs() {
        const groups = new Map();
        for (const def of OUTPUT_DEFS) {
            if (!groups.has(def.group)) groups.set(def.group, []);
            groups.get(def.group).push(def);
        }

        for (const [group, defs] of groups) {
            const label = document.createElement("div");
            label.className = "io-group-label";
            label.textContent = group;
            this.el.outputRows.appendChild(label);

            for (const def of defs) {
                const row = document.createElement("div");
                row.className = `io-row output${def.fault ? " fault" : ""}`;
                row.title = `${def.desc} (${def.addr})`;

                const led = document.createElement("span");
                led.className = "led";

                const meta = document.createElement("span");
                meta.className = "io-meta";
                const tag = document.createElement("span");
                tag.className = "io-tag";
                tag.textContent = def.key;
                const desc = document.createElement("span");
                desc.className = "io-desc";
                desc.textContent = def.desc;
                meta.append(tag, desc);

                const addr = document.createElement("span");
                addr.className = "io-addr";
                addr.textContent = def.addr;

                const value = document.createElement("span");
                value.className = "io-value";
                value.textContent = "0";

                const spacer = document.createElement("span");
                spacer.className = "override-spacer";

                row.append(led, meta, addr, value, spacer);
                this.outputRows.set(def.key, { row, led, value, def });
                this.el.outputRows.appendChild(row);
            }
        }
    }

    buildStateStrip() {
        STATE_NAMES.forEach((state, index) => {
            const chip = document.createElement("div");
            chip.className = "state-chip";
            chip.title = state.detail;

            const num = document.createElement("span");
            num.className = "chip-num";
            num.textContent = String(state.num);

            const name = document.createElement("span");
            name.textContent = state.name;

            chip.append(num, name);
            this.stateChips.set(state.num, chip);
            this.el.stateStrip.appendChild(chip);

            if (index < STATE_NAMES.length - 1) {
                const arrow = document.createElement("span");
                arrow.className = "state-arrow";
                arrow.textContent = "→";
                this.el.stateStrip.appendChild(arrow);
            }
        });
    }

    bindControls() {
        this.el.btnStart.addEventListener("click", () => this.controller.pulseStart());
        this.el.btnStop.addEventListener("click", () => this.controller.toggleInput("STOP_PB"));
        this.el.btnEstop.addEventListener("click", () => this.controller.toggleInput("E_STOP"));

        this.el.btnCamera.addEventListener("click", () => this.onCameraReset?.());
        this.el.btnClearOverrides.addEventListener("click", () => this.controller.clearOverrides());

        this.el.manualSensors.addEventListener("change", (event) => {
            this.controller.setManualSensors(event.target.checked);
        });

        this.el.speed.addEventListener("input", (event) => {
            const value = Number(event.target.value);
            this.el.speedValue.textContent = `${value.toFixed(2)}×`;
            this.onSpeedChange?.(value);
        });
    }

    handleInputClick(key) {
        if (key === "START_PB") {
            this.controller.pulseStart();
            return;
        }
        this.controller.toggleInput(key);
    }

    update() {
        const c = this.controller;

        for (const [key, row] of this.inputRows) {
            const value = c.inputs[key];
            const on = value === 1;
            row.row.classList.toggle("pressed", on);
            row.led.classList.toggle("on", on);
            row.value.textContent = String(value);

            if (SENSOR_SET.has(key)) {
                const isOverride = c.overrides[key] !== undefined;
                row.override.classList.toggle("active", isOverride);
                row.override.textContent = isOverride ? "M" : "A";
                row.override.title = c.manualSensors
                    ? "Manual sensor mode is active"
                    : isOverride
                      ? "Manual override (click to release)"
                      : "Lock manual override";
            }
        }

        for (const [key, row] of this.outputRows) {
            const on = c.outputs[key] === 1;
            row.row.classList.toggle("on", on);
            row.led.classList.toggle("on", on);
            row.value.textContent = String(c.outputs[key]);
        }

        for (const [num, chip] of this.stateChips) {
            chip.classList.toggle("active", c.state === num);
        }

        const stats = c.getStats();
        this.el.cycleCount.textContent = String(stats.cycle);
        this.el.passCount.textContent = String(stats.pass);
        this.el.rejectCount.textContent = String(stats.reject);

        let badgeClass = "state-badge";
        let label = `STATE ${c.state} · ${STATE_NAMES[c.state].name}`;
        if (c.fault) {
            badgeClass += " fault";
            label = "STATE 0 · E-STOP FAULT";
        } else if (c.state === 0) {
            badgeClass += " stopped";
            label = "STATE 0 · IDLE";
        } else {
            badgeClass += " running";
        }
        this.el.stateBadge.className = badgeClass;
        this.el.stateLabel.textContent = label;

        this.el.btnStart.disabled = c.state !== 0 || c.fault || c.inputs.E_STOP === 0;
        this.el.btnStop.classList.toggle("active", c.inputs.STOP_PB === 0);
        this.el.btnEstop.classList.toggle("active", c.inputs.E_STOP === 0);
        this.el.manualSensors.checked = c.manualSensors;

        if (c.fault) {
            this.el.dockHint.textContent = "Emergency stop active. Release E-STOP, then press START.";
        } else if (c.state === 0) {
            this.el.dockHint.textContent = c.inputs.E_STOP === 0
                ? "Release E-STOP to clear the fault."
                : "Press START to begin the line cycle.";
        } else if (c.state === 1) {
            this.el.dockHint.textContent = "Transferring parts to all three stations.";
        } else if (c.state === 2) {
            this.el.dockHint.textContent = "Press · Vision QC · Sort executing in parallel.";
        } else if (c.state === 3) {
            this.el.dockHint.textContent = "Retracting actuators and clearing sensors.";
        } else {
            this.el.dockHint.textContent = c.inputs.STOP_PB === 0
                ? "STOP active — line will idle after this cycle."
                : "Cycle complete. Starting next transfer.";
        }
    }

    setProgress(percent, text) {
        this.el.progressBar.style.width = `${Math.max(3, Math.min(100, percent))}%`;
        if (text) this.el.loadingText.textContent = text;
    }

    hideLoading() {
        this.el.loading.classList.add("hidden");
    }

    showError(message) {
        this.el.loading.classList.add("hidden");
        this.el.errorToast.textContent = message;
        this.el.errorToast.classList.add("visible");
        setTimeout(() => this.el.errorToast.classList.remove("visible"), 9000);
    }
}
