# 3-Station Production Line

Interactive Three.js simulation of a press, vision-inspection and sorting line with a packaging robot.

## Run

The page uses ES modules and loads local glTF assets, so it must be served over HTTP:

```powershell
python serve.py 8000
```

Open <http://localhost:8000/>. Do not open `index.html` with `file://`.

## Controls

- **START** starts the cycle. In idle, the first start seeds one part at each station.
- **STOP** is a normally-closed input. Setting it to `0` stops the line after the current cycle completes.
- **E-STOP** is a normally-closed input. Setting it to `0` stops all outputs immediately. Release it and press **START** to resume.
- **Speed** scales the controller and animation timestep.
- **Reset view** restores the fitted camera.
- **A / M** buttons on sensor rows lock and release a manual sensor override.
- **Manual sensor mode** freezes automatic sensor updates; click sensor rows to toggle their values.
- **Clear overrides** releases all overrides and leaves manual sensor mode.

## Process

1. `IDLE` — all outputs off.
2. `TRANSFER` — conveyor runs until all three stations are occupied.
3. `EXECUTE` — stations run in parallel:
   - S1 clamps, presses and releases.
   - S2 stops the part, triggers vision QC, records pass/fail and retracts.
   - S3 diverts failed parts into the reject bin, or passes them to the exit.
4. `RESET` — actuators retract and sensors clear.
5. `EVALUATE` — start the next transfer, or return to idle when STOP is active.

Every fourth inspected part fails in automatic mode, so both pass and reject paths are visible.

## I/O

| Input | Address | Meaning |
| --- | --- | --- |
| `START_PB` | DI_0 | Cycle start |
| `STOP_PB` | DI_1 | Controlled stop, NC |
| `E_STOP` | DI_2 | Emergency stop, NC |
| `S1_POS` | DI_3 | Part at press |
| `S1_DEPTH` | DI_4 | Press ram at bottom |
| `S2_POS` | DI_5 | Part at inspection |
| `S2_QC_PASS` | DI_6 | QC passed |
| `S2_QC_DONE` | DI_7 | QC complete |
| `S3_POS` | DI_8 | Part at diverter |
| `S3_REJ_OK` | DI_9 | Reject pusher at full stroke |
| `S_EXIT` | DI_10 | Part at exit |

| Output | Address | Meaning |
| --- | --- | --- |
| `M_CONV` | DO_0 | Main conveyor motor |
| `Y1_CLAMP` | DO_1 | Press clamp |
| `M1_PRESS` | DO_2 | Press pump |
| `Y1_FEED` | DO_3 | Press ram down |
| `Y2_STOPPER` | DO_4 | Inspection stop pin |
| `CMD_QC` | DO_5 | Vision trigger |
| `Y3_DIVERT` | DO_6 | Reject pusher |
| `L_RUN` | DO_7 | Run lamp |
| `L_FAULT` | DO_8 | Fault lamp |

The original `DO_2` drilling spindle output is implemented as the hydraulic press pump (`M1_PRESS`) because this line uses a press instead of a drill.

## Structure

- `src/sim/controller.js` — GRAFCET controller, sensors, parts and statistics.
- `src/sim/io.js` — I/O definitions and defaults.
- `src/line/buildLine.js` — prefab loading, station layout, robot packaging and part animation.
- `src/line/procedural.js` — procedural clamps, stoppers, QC gantry, diverter, chute, crate and part meshes.
- `src/ui/panels.js` — input/output panels, state strip and controls.
- `src/main.js` — renderer, camera, loading and frame loop.
- `serve.py` — local static server with correct glTF/bin MIME types.

## Model Credits

All three models are licensed under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

- "Conveyor Belt" by Cianon — <https://sketchfab.com/3d-models/conveyor-belt-55f0d0f9b3384ea4b49cfc8aef97dcf9>
- "Hydraulic Press" by Scarecrow_original — <https://sketchfab.com/3d-models/hydraulic-press-0998c9054c3b4c7b9b1f6cf2f2b40d45>
- "Assembly Robot Arm" by Infant — <https://sketchfab.com/3d-models/assembly-robot-arm-65b03e22e9e64b7087906747f209aad8>

See the `license.txt` file in each model folder for the original notices.
