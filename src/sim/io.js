export const INPUT_DEFS = [
    { key: "START_PB", addr: "DI_0", group: "Operator", desc: "Line cycle start", type: "momentary", normal: 0 },
    { key: "STOP_PB", addr: "DI_1", group: "Operator", desc: "Controlled line stop (NC)", type: "toggle", normal: 1 },
    { key: "E_STOP", addr: "DI_2", group: "Operator", desc: "Master emergency cutoff (NC)", type: "toggle", normal: 1 },
    { key: "S1_POS", addr: "DI_3", group: "Station 1", desc: "Part locked at press station", type: "sensor", normal: 0 },
    { key: "S1_DEPTH", addr: "DI_4", group: "Station 1", desc: "Press ram reached bottom limit", type: "sensor", normal: 0 },
    { key: "S2_POS", addr: "DI_5", group: "Station 2", desc: "Part locked at inspection", type: "sensor", normal: 0 },
    { key: "S2_QC_PASS", addr: "DI_6", group: "Station 2", desc: "Part passed tolerance test", type: "sensor", normal: 0 },
    { key: "S2_QC_DONE", addr: "DI_7", group: "Station 2", desc: "Inspection measurement complete", type: "sensor", normal: 0 },
    { key: "S3_POS", addr: "DI_8", group: "Station 3", desc: "Part arrived at diverter", type: "sensor", normal: 0 },
    { key: "S3_REJ_OK", addr: "DI_9", group: "Station 3", desc: "Reject pusher full stroke", type: "sensor", normal: 0 },
    { key: "S_EXIT", addr: "DI_10", group: "Exit", desc: "Part exited on main belt", type: "sensor", normal: 0 },
];

export const OUTPUT_DEFS = [
    { key: "M_CONV", addr: "DO_0", group: "Transfer", desc: "Main conveyor motor", fault: false },
    { key: "Y1_CLAMP", addr: "DO_1", group: "Station 1", desc: "Press part clamp", fault: false },
    { key: "M1_PRESS", addr: "DO_2", group: "Station 1", desc: "Press hydraulic pump (M1_PRESS)", fault: false },
    { key: "Y1_FEED", addr: "DO_3", group: "Station 1", desc: "Press ram down", fault: false },
    { key: "Y2_STOPPER", addr: "DO_4", group: "Station 2", desc: "Inspection stop pin", fault: false },
    { key: "CMD_QC", addr: "DO_5", group: "Station 2", desc: "Vision system trigger", fault: false },
    { key: "Y3_DIVERT", addr: "DO_6", group: "Station 3", desc: "Reject pusher cylinder", fault: false },
    { key: "L_RUN", addr: "DO_7", group: "Indicators", desc: "Line active lamp", fault: false },
    { key: "L_FAULT", addr: "DO_8", group: "Indicators", desc: "Fault lamp / siren", fault: true },
];

export const INPUT_KEYS = INPUT_DEFS.map((d) => d.key);
export const OUTPUT_KEYS = OUTPUT_DEFS.map((d) => d.key);
export const SENSOR_KEYS = INPUT_DEFS.filter((d) => d.type === "sensor").map((d) => d.key);

export function defaultInputs() {
    const values = {};
    for (const def of INPUT_DEFS) values[def.key] = def.normal;
    return values;
}

export function defaultOutputs() {
    const values = {};
    for (const def of OUTPUT_DEFS) values[def.key] = 0;
    return values;
}

export const STATE_NAMES = [
    { num: 0, name: "IDLE", detail: "All stop" },
    { num: 1, name: "TRANSFER", detail: "Conveyor running" },
    { num: 2, name: "EXECUTE", detail: "3 stations parallel" },
    { num: 3, name: "RESET", detail: "Actuators retract" },
    { num: 4, name: "EVALUATE", detail: "Cycle decision" },
];
