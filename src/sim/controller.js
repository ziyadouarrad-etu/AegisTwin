import {
    defaultInputs,
    defaultOutputs,
    SENSOR_KEYS,
} from "./io.js";

export const TIMING = {
    beltSpeed: 2.7,
    clampClose: 0.45,
    pumpSpinUp: 0.25,
    pressDown: 1.35,
    pressHold: 0.55,
    pressUp: 0.9,
    clampOpen: 0.45,
    stopperUp: 0.35,
    scan: 1.15,
    stopperDown: 0.3,
    diverterExtend: 0.7,
    diverterRetract: 0.5,
    reset: 0.85,
    evaluate: 0.55,
    rejectSlide: 0.65,
};

export const LAYOUT = {
    s1: -4,
    s2: 0,
    s3: 4,
    exit: 6.8,
    entry: -8,
    rejectZ: -3.1,
};

const SENSOR_SET = new Set(SENSOR_KEYS);

function makeStation() {
    return {
        started: false,
        phase: "idle",
        t: 0,
        done: false,
        result: 0,
        pass: true,
    };
}

export class LineController {
    constructor() {
        this.inputs = defaultInputs();
        this.outputs = defaultOutputs();
        this.autoSensors = defaultInputs();
        this.overrides = {};
        this.manualSensors = false;

        this.state = 0;
        this.stateTime = 0;
        this.prevStart = 0;
        this.startPulse = 0;

        this.fault = false;
        this.resumePrepared = false;
        this.transferPrepared = false;

        this.cycle = 0;
        this.passCount = 0;
        this.rejectCount = 0;
        this.qcIndex = 0;

        this.parts = [];
        this.nextPartId = 1;

        this.stations = { S1: makeStation(), S2: makeStation(), S3: makeStation() };
        this.s1Part = null;
        this.s2Part = null;
        this.s3Part = null;
    }

    update(dt) {
        dt = Math.min(Math.max(dt, 0), 0.12);

        if (this.startPulse > 0) {
            this.startPulse -= dt;
            if (this.startPulse <= 0) this.inputs.START_PB = 0;
        }

        this.updatePartsMotion(dt);
        this.refreshSensors();

        if (this.inputs.E_STOP === 0) {
            if (!this.fault) this.enterFault();
            this.refreshSensors();
            this.prevStart = this.inputs.START_PB;
            return;
        }

        if (this.fault) {
            this.fault = false;
            this.outputs.L_FAULT = 0;
        }

        this.stateTime += dt;

        switch (this.state) {
            case 0:
                this.updateIdle();
                break;
            case 1:
                this.updateTransfer(dt);
                break;
            case 2:
                this.updateExecute(dt);
                break;
            case 3:
                this.updateReset(dt);
                break;
            case 4:
                this.updateEvaluate(dt);
                break;
        }

        this.refreshSensors();
        this.prevStart = this.inputs.START_PB;
    }

    pulseStart() {
        this.inputs.START_PB = 1;
        this.startPulse = 0.28;
    }

    toggleInput(key) {
        if (!SENSOR_SET.has(key)) {
            this.inputs[key] = this.inputs[key] ? 0 : 1;
            return this.inputs[key];
        }

        if (this.manualSensors) {
            this.inputs[key] = this.inputs[key] ? 0 : 1;
            return this.inputs[key];
        }

        const next = this.inputs[key] ? 0 : 1;
        this.overrides[key] = next;
        return next;
    }

    setOverride(key, value) {
        if (!SENSOR_SET.has(key)) return;
        this.overrides[key] = value ? 1 : 0;
    }

    clearOverride(key) {
        delete this.overrides[key];
    }

    clearOverrides() {
        this.overrides = {};
        this.manualSensors = false;
    }

    setManualSensors(enabled) {
        this.manualSensors = Boolean(enabled);
    }

    getStats() {
        return {
            cycle: this.cycle,
            pass: this.passCount,
            reject: this.rejectCount,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Inputs / sensors                                                    */
    /* ------------------------------------------------------------------ */

    refreshSensors() {
        const onBelt = (x, radius = 0.42) =>
            this.parts.some(
                (p) =>
                    p.state === "belt" &&
                    !p.removed &&
                    p.z > -0.55 &&
                    Math.abs(p.x - x) <= radius
            );

        this.autoSensors.S1_POS = onBelt(LAYOUT.s1) ? 1 : 0;
        this.autoSensors.S2_POS = onBelt(LAYOUT.s2) ? 1 : 0;
        this.autoSensors.S3_POS = onBelt(LAYOUT.s3) ? 1 : 0;
        this.autoSensors.S_EXIT = this.parts.some(
            (p) =>
                (p.state === "belt" || p.state === "queuedPack") &&
                !p.removed &&
                p.x >= LAYOUT.exit - 0.35
        )
            ? 1
            : 0;

        for (const key of SENSOR_KEYS) {
            if (this.overrides[key] !== undefined) {
                this.inputs[key] = this.overrides[key];
            } else if (!this.manualSensors) {
                this.inputs[key] = this.autoSensors[key] ? 1 : 0;
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* States                                                              */
    /* ------------------------------------------------------------------ */

    updateIdle() {
        this.clearOutputs();
        this.outputs.L_FAULT = this.fault ? 1 : 0;

        if (this.inputs.START_PB && !this.prevStart) {
            this.startCycle();
        }
    }

    startCycle() {
        if (this.inputs.E_STOP === 0) return;

        this.clearOutputs();
        this.resetStations();

        if (this.resumePrepared) {
            this.transferPrepared = true;
            this.resumePrepared = false;
        } else if (!this.parts.some((p) => p.state === "belt" && !p.removed)) {
            this.seedInitialParts();
            this.transferPrepared = true;
        } else {
            this.transferPrepared = false;
        }

        this.state = 1;
        this.stateTime = 0;
        this.outputs.L_RUN = 1;
        this.outputs.L_FAULT = 0;
    }

    updateTransfer(dt) {
        this.clearOutputs();
        this.outputs.M_CONV = 1;
        this.outputs.L_RUN = 1;

        if (!this.transferPrepared) this.prepareTransfer();

        const moving = this.parts.some((p) => p.state === "belt" && p.targetX !== null);
        const allPresent =
            this.inputs.S1_POS === 1 &&
            this.inputs.S2_POS === 1 &&
            this.inputs.S3_POS === 1;

        if (!moving && allPresent) {
            this.outputs.M_CONV = 0;
            this.beginExecute();
        }
    }

    updateExecute(dt) {
        this.clearOutputs();
        this.outputs.L_RUN = 1;

        this.updateStation1(dt);
        this.updateStation2(dt);
        this.updateStation3(dt);

        if (
            this.stations.S1.done &&
            this.stations.S2.done &&
            this.stations.S3.done
        ) {
            this.state = 3;
            this.stateTime = 0;
            this.cycle += 1;
            this.clearOutputs();
            this.outputs.L_RUN = 1;
        }
    }

    updateReset() {
        this.clearOutputs();
        this.outputs.L_RUN = 1;

        this.autoSensors.S1_DEPTH = 0;
        this.autoSensors.S2_QC_DONE = 0;
        this.autoSensors.S2_QC_PASS = 0;
        this.autoSensors.S3_REJ_OK = 0;

        if (this.stateTime >= TIMING.reset) {
            this.state = 4;
            this.stateTime = 0;
        }
    }

    updateEvaluate() {
        this.clearOutputs();
        this.outputs.L_RUN = 1;

        if (this.stateTime < TIMING.evaluate) return;

        if (this.inputs.E_STOP === 0) {
            this.enterFault();
            return;
        }

        if (this.inputs.STOP_PB === 0) {
            this.state = 0;
            this.stateTime = 0;
            this.outputs.L_RUN = 0;
            this.transferPrepared = false;
            return;
        }

        this.state = 1;
        this.stateTime = 0;
        this.outputs.L_RUN = 1;
        this.transferPrepared = false;
    }

    /* ------------------------------------------------------------------ */
    /* Station sequences                                                   */
    /* ------------------------------------------------------------------ */

    updateStation1(dt) {
        const st = this.stations.S1;
        if (!st.started) {
            st.started = true;
            st.phase = "clamp";
            st.t = 0;
        }
        st.t += dt;

        switch (st.phase) {
            case "clamp":
                this.outputs.Y1_CLAMP = 1;
                if (st.t >= TIMING.clampClose) {
                    st.phase = "pump";
                    st.t = 0;
                }
                break;
            case "pump":
                this.outputs.Y1_CLAMP = 1;
                this.outputs.M1_PRESS = 1;
                if (st.t >= TIMING.pumpSpinUp) {
                    st.phase = "down";
                    st.t = 0;
                }
                break;
            case "down":
                this.outputs.Y1_CLAMP = 1;
                this.outputs.M1_PRESS = 1;
                this.outputs.Y1_FEED = 1;
                if (st.t >= TIMING.pressDown) this.autoSensors.S1_DEPTH = 1;
                if (this.inputs.S1_DEPTH === 1) {
                    if (this.s1Part) this.s1Part.pressed = true;
                    st.phase = "hold";
                    st.t = 0;
                }
                break;
            case "hold":
                this.outputs.Y1_CLAMP = 1;
                this.outputs.M1_PRESS = 1;
                this.outputs.Y1_FEED = 1;
                this.autoSensors.S1_DEPTH = 1;
                if (st.t >= TIMING.pressHold) {
                    st.phase = "up";
                    st.t = 0;
                    this.autoSensors.S1_DEPTH = 0;
                }
                break;
            case "up":
                this.outputs.Y1_CLAMP = 1;
                this.outputs.M1_PRESS = 1;
                if (st.t >= TIMING.pressUp) {
                    st.phase = "unclamp";
                    st.t = 0;
                }
                break;
            case "unclamp":
                if (st.t >= TIMING.clampOpen) {
                    st.phase = "done";
                    st.done = true;
                }
                break;
            default:
                st.done = true;
                break;
        }
    }

    updateStation2(dt) {
        const st = this.stations.S2;
        if (!st.started) {
            st.started = true;
            st.phase = "stopper";
            st.t = 0;
        }
        st.t += dt;

        switch (st.phase) {
            case "stopper":
                this.outputs.Y2_STOPPER = 1;
                if (st.t >= TIMING.stopperUp) {
                    st.result = this.decideQcResult();
                    st.phase = "scan";
                    st.t = 0;
                }
                break;
            case "scan":
                this.outputs.Y2_STOPPER = 1;
                this.outputs.CMD_QC = 1;
                if (st.t >= TIMING.scan) {
                    this.autoSensors.S2_QC_DONE = 1;
                    this.autoSensors.S2_QC_PASS = st.result;
                    if (this.s2Part) {
                        this.s2Part.qcPass = st.result === 1;
                        this.s2Part.inspected = true;
                    }
                    st.phase = "measured";
                    st.t = 0;
                }
                break;
            case "measured":
                this.outputs.Y2_STOPPER = 1;
                this.autoSensors.S2_QC_DONE = 1;
                this.autoSensors.S2_QC_PASS = st.result;
                if (this.inputs.S2_QC_DONE === 1) {
                    st.phase = "release";
                    st.t = 0;
                }
                break;
            case "release":
                if (st.t >= TIMING.stopperDown) {
                    st.phase = "done";
                    st.done = true;
                }
                break;
            default:
                st.done = true;
                break;
        }
    }

    updateStation3(dt) {
        const st = this.stations.S3;
        if (!st.started) {
            st.started = true;
            const part = this.s3Part;
            st.pass = !part || part.qcPass !== false;
            if (st.pass) {
                st.phase = "passed";
                st.done = true;
                if (part && !part.passCounted) {
                    part.passCounted = true;
                    this.passCount += 1;
                }
            } else {
                st.phase = "extend";
                st.t = 0;
                if (part && !part.rejectCounted) {
                    part.rejectCounted = true;
                    this.rejectCount += 1;
                }
                if (part) {
                    part.state = "rejected";
                    part.rejectTime = 0;
                }
            }
        }
        st.t += dt;

        switch (st.phase) {
            case "extend":
                this.outputs.Y3_DIVERT = 1;
                if (st.t >= TIMING.diverterExtend) {
                    this.autoSensors.S3_REJ_OK = 1;
                    st.phase = "stroke";
                    st.t = 0;
                }
                break;
            case "stroke":
                this.outputs.Y3_DIVERT = 1;
                this.autoSensors.S3_REJ_OK = 1;
                if (this.inputs.S3_REJ_OK === 1) {
                    st.phase = "retract";
                    st.t = 0;
                }
                break;
            case "retract":
                if (st.t >= TIMING.diverterRetract) {
                    this.autoSensors.S3_REJ_OK = 0;
                    st.phase = "done";
                    st.done = true;
                }
                break;
            default:
                st.done = true;
                break;
        }
    }

    decideQcResult() {
        let forced = this.overrides.S2_QC_PASS;
        if (forced === undefined && this.manualSensors) {
            forced = this.inputs.S2_QC_PASS;
        }
        if (forced !== undefined) return forced ? 1 : 0;

        this.qcIndex += 1;
        return this.qcIndex % 4 === 0 ? 0 : 1;
    }

    /* ------------------------------------------------------------------ */
    /* Transfer preparation                                                */
    /* ------------------------------------------------------------------ */

    prepareTransfer() {
        const s1 = this.byStation("S1");
        const s2 = this.byStation("S2");
        const s3 = this.byStation("S3");

        if (s1) {
            s1.targetStation = "S2";
            s1.targetX = LAYOUT.s2;
        }
        if (s2) {
            s2.targetStation = "S3";
            s2.targetX = LAYOUT.s3;
        }
        if (s3) {
            s3.targetStation = "EXIT";
            s3.targetX = LAYOUT.exit;
        }

        this.spawnPart({ x: LAYOUT.entry, targetStation: "S1", targetX: LAYOUT.s1 });
        this.transferPrepared = true;
    }

    beginExecute() {
        this.state = 2;
        this.stateTime = 0;
        this.transferPrepared = false;
        this.outputs.M_CONV = 0;
        this.outputs.L_RUN = 1;

        this.resetStations();
        this.s1Part = this.byStation("S1");
        this.s2Part = this.byStation("S2");
        this.s3Part = this.byStation("S3");
    }

    seedInitialParts() {
        this.spawnPart({
            x: LAYOUT.s1,
            station: "S1",
            targetStation: null,
            targetX: null,
        });
        this.spawnPart({
            x: LAYOUT.s2,
            station: "S2",
            targetStation: null,
            targetX: null,
            pressed: true,
        });
        this.spawnPart({
            x: LAYOUT.s3,
            station: "S3",
            targetStation: null,
            targetX: null,
            pressed: true,
            inspected: true,
            qcPass: true,
        });
    }

    spawnPart(options = {}) {
        const part = {
            id: this.nextPartId++,
            x: options.x ?? LAYOUT.entry,
            z: 0,
            state: "belt",
            station: options.station ?? null,
            targetStation: options.targetStation ?? null,
            targetX: options.targetX ?? null,
            qcPass: options.qcPass ?? null,
            inspected: options.inspected ?? false,
            pressed: options.pressed ?? false,
            removed: false,
            rejectTime: 0,
            passCounted: false,
            rejectCounted: false,
        };
        this.parts.push(part);
        return part;
    }

    byStation(name) {
        return this.parts.find(
            (p) => p.state === "belt" && !p.removed && p.station === name
        );
    }

    completePacking(id) {
        const part = this.parts.find((p) => p.id === id);
        if (part) part.state = "packed";
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                             */
    /* ------------------------------------------------------------------ */

    updatePartsMotion(dt) {
        for (const part of this.parts) {
            if (part.removed) continue;

            if (part.state === "rejected") {
                const dz = LAYOUT.rejectZ - part.z;
                const step = dt * 4.2;
                if (Math.abs(dz) <= step) {
                    part.z = LAYOUT.rejectZ;
                } else {
                    part.z += Math.sign(dz) * step;
                }
                part.rejectTime = (part.rejectTime || 0) + dt;
                if (part.rejectTime > TIMING.rejectSlide && Math.abs(part.z - LAYOUT.rejectZ) < 0.05) {
                    part.removed = true;
                }
                continue;
            }

            if (part.state !== "belt" || part.targetX === null) continue;

            const dx = part.targetX - part.x;
            const step = dt * TIMING.beltSpeed;
            if (Math.abs(dx) <= step) {
                part.x = part.targetX;
                const target = part.targetStation;
                part.targetX = null;
                part.targetStation = null;
                if (target === "EXIT") {
                    part.station = "EXIT";
                    part.state = "queuedPack";
                } else if (target) {
                    part.station = target;
                }
            } else {
                part.x += Math.sign(dx) * step;
            }
        }
    }

    enterFault() {
        this.resumePrepared =
            this.state === 1 ? this.transferPrepared : this.state >= 2;

        this.fault = true;
        this.state = 0;
        this.stateTime = 0;
        this.clearOutputs();
        this.outputs.L_FAULT = 1;
        this.resetStations();

        this.autoSensors.S1_DEPTH = 0;
        this.autoSensors.S2_QC_DONE = 0;
        this.autoSensors.S2_QC_PASS = 0;
        this.autoSensors.S3_REJ_OK = 0;
        this.transferPrepared = this.resumePrepared;
    }

    resetStations() {
        this.stations = { S1: makeStation(), S2: makeStation(), S3: makeStation() };
        this.s1Part = null;
        this.s2Part = null;
        this.s3Part = null;
    }

    clearOutputs() {
        for (const key of Object.keys(this.outputs)) this.outputs[key] = 0;
    }
}
