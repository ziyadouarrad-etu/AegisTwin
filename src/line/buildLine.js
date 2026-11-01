import * as THREE from "three";
import {
    box,
    createClamp,
    createControlCabinet,
    createCrate,
    createDiverter,
    createLabelSprite,
    createQcStation,
    createRejectChute,
    createRollers,
    createSensorPost,
    createStackLight,
    createStopper,
    cylinder,
    makePart,
    std,
} from "./procedural.js";

const ASSETS = {
    conveyor: "./public/models/conveyor_belt/scene.gltf",
    press: "./public/models/hydraulic_press/scene.gltf",
    robot: "./public/models/assembly_robot_arm/scene.gltf",
};

function moveToward(current, target, maxDelta) {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}

function orientLongestToX(holder) {
    holder.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(holder);
    let size = bounds.getSize(new THREE.Vector3());

    const axes = [
        { axis: "x", size: size.x },
        { axis: "y", size: size.y },
        { axis: "z", size: size.z },
    ].sort((a, b) => b.size - a.size);

    const longAxis = axes[0].axis;
    const midAxis = axes[1].axis;
    const shortAxis = axes[2].axis;

    if (longAxis === "x" && shortAxis === "y") return;

    const image = {
        x: new THREE.Vector3(),
        y: new THREE.Vector3(),
        z: new THREE.Vector3(),
    };
    image[longAxis].set(1, 0, 0);
    image[midAxis].set(0, 0, 1);
    image[shortAxis].set(0, 1, 0);

    const matrix = new THREE.Matrix4().makeBasis(image.x, image.y, image.z);
    if (matrix.determinant() < 0) {
        image[midAxis].set(0, 0, -1);
        matrix.makeBasis(image.x, image.y, image.z);
    }

    const orientation = new THREE.Group();
    orientation.quaternion.setFromRotationMatrix(matrix);
    const inner = new THREE.Group();
    while (holder.children.length) inner.add(holder.children[0]);
    orientation.add(inner);
    holder.add(orientation);
    holder.updateMatrixWorld(true);
}

function normalizeModel(root, { length, height, alignLongAxis = false }) {
    const holder = new THREE.Group();
    holder.add(root);
    holder.updateMatrixWorld(true);

    if (alignLongAxis) {
        orientLongestToX(holder);
        holder.updateMatrixWorld(true);
    }

    let bounds = new THREE.Box3().setFromObject(holder);
    let size = bounds.getSize(new THREE.Vector3());

    let scale = 1;
    if (length) {
        scale = length / Math.max(size.x, 0.0001);
    } else if (height) {
        scale = height / Math.max(size.y, 0.0001);
    }
    holder.scale.setScalar(scale);
    holder.updateMatrixWorld(true);

    bounds = new THREE.Box3().setFromObject(holder);
    const center = bounds.getCenter(new THREE.Vector3());
    holder.position.x -= center.x;
    holder.position.z -= center.z;
    holder.position.y -= bounds.min.y;
    holder.updateMatrixWorld(true);

    bounds = new THREE.Box3().setFromObject(holder);
    size = bounds.getSize(new THREE.Vector3());

    return { holder, size, bounds };
}

function findTopSurfaceY(object) {
    object.updateMatrixWorld(true);

    const bins = new Map();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const normal = new THREE.Vector3();

    object.traverse((mesh) => {
        if (!mesh.isMesh || !mesh.geometry) return;

        const position = mesh.geometry.attributes.position;
        if (!position) return;

        const index = mesh.geometry.index;
        const count = index ? index.count : position.count;

        for (let i = 0; i < count; i += 3) {
            const ia = index ? index.getX(i) : i;
            const ib = index ? index.getX(i + 1) : i + 1;
            const ic = index ? index.getX(i + 2) : i + 2;

            a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
            b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
            c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);

            ab.subVectors(b, a);
            ac.subVectors(c, a);
            normal.crossVectors(ab, ac);

            const area = normal.length() * 0.5;
            if (area < 1e-6) continue;

            normal.normalize();
            if (normal.y < 0.85) continue;

            const y = (a.y + b.y + c.y) / 3;
            const bin = Math.round(y * 50);
            bins.set(bin, (bins.get(bin) || 0) + area);
        }
    });

    let bestBin = null;
    let bestArea = -1;

    for (const [bin, area] of bins) {
        if (area > bestArea) {
            bestArea = area;
            bestBin = bin;
        }
    }

    return bestBin === null ? null : bestBin / 50;
}

function createPressGantry(x, beltTop) {
    const group = new THREE.Group();
    group.position.x = x;

    const frameMat = std(0x3f4a55, { metalness: 0.7, roughness: 0.35 });
    const goldMat = std(0xd6a642, { metalness: 0.75, roughness: 0.3 });
    const rodMat = std(0xd9e1e7, { metalness: 0.95, roughness: 0.14 });

    for (const z of [-0.85, 0.85]) {
        group.add(box(0.17, 3.15, 0.17, frameMat, 0, 1.58, z));
        group.add(box(0.46, 0.1, 0.46, frameMat, 0, 0.05, z));
    }
    group.add(box(0.3, 0.24, 2.0, frameMat, 0, 3.12, 0));

    const cylinderBody = cylinder(0.24, 0.72, goldMat, 24);
    cylinderBody.position.set(0, 2.62, 0);
    group.add(cylinderBody);

    const ramGroup = new THREE.Group();
    const rod = cylinder(0.075, 1.55, rodMat, 18);
    rod.position.set(0, beltTop + 1.95, 0);
    ramGroup.add(rod);

    const die = box(0.86, 0.16, 0.86, std(0x28313a, { metalness: 0.7, roughness: 0.35 }), 0, beltTop + 1.22, 0);
    ramGroup.add(die);
    group.add(ramGroup);

    const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.1, 2.85, -0.1),
        new THREE.Vector3(-0.7, 2.6, -0.9),
        new THREE.Vector3(-1.1, 1.4, -1.7),
        new THREE.Vector3(-1.5, 0.8, -2.15),
    ]);
    const hose = new THREE.Mesh(
        new THREE.TubeGeometry(hoseCurve, 28, 0.045, 8, false),
        std(0x0f1317, { metalness: 0.2, roughness: 0.75 })
    );
    hose.castShadow = true;
    group.add(hose);

    const label = createLabelSprite("STATION 1  ·  PRESS", "#fbbf24");
    label.position.set(0, 4.0, 0);
    group.add(label);

    let progress = 0;

    return {
        group,
        update(dt, feeding) {
            progress = moveToward(progress, feeding ? 1 : 0, dt / (feeding ? 1.35 : 0.9));
            ramGroup.position.y = -progress * 0.86;
        },
        getProgress: () => progress,
    };
}

function createGripper() {
    const group = new THREE.Group();
    const mat = std(0x1f2937, { metalness: 0.6, roughness: 0.4 });
    const fingerMat = std(0xd6a642, { metalness: 0.5, roughness: 0.4 });

    group.add(box(0.4, 0.18, 0.26, mat, 0, 0.18, 0));
    group.add(cylinder(0.05, 0.45, mat, 12).translateY(0.45));

    const left = box(0.07, 0.3, 0.08, fingerMat, -0.14, 0, 0);
    const right = box(0.07, 0.3, 0.08, fingerMat, 0.14, 0, 0);
    group.add(left, right);
    group.visible = false;

    let close = 0;
    const home = new THREE.Vector3(7.2, 3.0, 0);
    const target = new THREE.Vector3(7.2, 3.0, 0);

    return {
        group,
        home,
        place(x, y, z, dt) {
            target.set(x, y, z);
            group.position.lerp(target, Math.min(1, dt * 8));
        },
        setVisible(value) {
            group.visible = Boolean(value);
        },
        setClosed(value, dt) {
            close += ((value ? 1 : 0) - close) * Math.min(1, dt * 12);
            left.position.x = THREE.MathUtils.lerp(-0.26, -0.12, close);
            right.position.x = THREE.MathUtils.lerp(0.26, 0.12, close);
        },
    };
}

function tintConveyor(sceneRoot) {
    const maps = [];
    sceneRoot.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        child.material = Array.isArray(child.material)
            ? materials.map((m) => m.clone())
            : materials[0].clone();

        const cloned = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of cloned) {
            if (material.map) {
                material.map.wrapS = THREE.RepeatWrapping;
                material.map.wrapT = THREE.RepeatWrapping;
                material.map.repeat.set(4, 1);
                material.map.anisotropy = 4;
                maps.push(material.map);
            }
            material.side = THREE.DoubleSide;
        }
    });
    return maps;
}

export async function buildLine(scene, loader) {
    const [conveyor, press, robot] = await Promise.all([
        loader.loadAsync(ASSETS.conveyor),
        loader.loadAsync(ASSETS.press),
        loader.loadAsync(ASSETS.robot),
    ]);

    const root = new THREE.Group();
    root.name = "production-line";
    scene.add(root);

    /* ---------------------------------------------------------------- */
    /* Conveyor                                                          */
    /* ---------------------------------------------------------------- */
    const conveyorView = normalizeModel(conveyor.scene, {
        length: 15.5,
        alignLongAxis: true,
    });

    const conveyorPivot = new THREE.Group();
    conveyorPivot.add(conveyorView.holder);

    const conveyorRoll = new THREE.Group();
    conveyorRoll.rotation.x = Math.PI / 2;
    conveyorRoll.add(conveyorPivot);

    const conveyorRig = new THREE.Group();
    conveyorRig.add(conveyorRoll);
    root.add(conveyorRig);

    conveyorRig.updateMatrixWorld(true);
    let conveyorBounds = new THREE.Box3().setFromObject(conveyorRig);
    let conveyorSize = conveyorBounds.getSize(new THREE.Vector3());
    const widthScale = conveyorSize.z > 0.01 ? 2.9 / conveyorSize.z : 1;
    conveyorRig.scale.z = widthScale;
    conveyorRig.updateMatrixWorld(true);

    conveyorBounds = new THREE.Box3().setFromObject(conveyorRig);
    const conveyorCenter = conveyorBounds.getCenter(new THREE.Vector3());
    conveyorRig.position.x -= conveyorCenter.x;
    conveyorRig.position.z -= conveyorCenter.z;
    conveyorRig.position.y -= conveyorBounds.min.y;
    conveyorRig.updateMatrixWorld(true);

    conveyorBounds = new THREE.Box3().setFromObject(conveyorRig);
    conveyorSize = conveyorBounds.getSize(new THREE.Vector3());
    const targetHeight = conveyorView.size.y;

    if (conveyorSize.y > 1e-6) {
        conveyorRig.scale.y *= targetHeight / conveyorSize.y;
        conveyorRig.updateMatrixWorld(true);

        conveyorBounds = new THREE.Box3().setFromObject(conveyorRig);
        const center = conveyorBounds.getCenter(new THREE.Vector3());
        conveyorRig.position.x -= center.x;
        conveyorRig.position.z -= center.z;
        conveyorRig.position.y -= conveyorBounds.min.y;
        conveyorRig.updateMatrixWorld(true);

        conveyorBounds = new THREE.Box3().setFromObject(conveyorRig);
    }

    conveyorSize = conveyorBounds.getSize(new THREE.Vector3());
    const beltWidth = conveyorSize.z;
    const beltTop = findTopSurfaceY(conveyorRig) ?? conveyorBounds.max.y;
    const beltMaps = tintConveyor(conveyorRig);

    const rollers = createRollers(beltTop, 14.6, Math.max(1.9, beltWidth * 0.82));
    root.add(rollers.group);

    /* ---------------------------------------------------------------- */
    /* Station 1 - press                                                 */
    /* ---------------------------------------------------------------- */
    const pressView = normalizeModel(press.scene, { height: 2.9 });
    const pressPivot = new THREE.Group();
    pressPivot.add(pressView.holder);
    pressPivot.position.set(-4.2, 0, -2.55);
    pressPivot.rotation.y = Math.PI * 0.08;
    root.add(pressPivot);
    pressPivot.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    let pressRod = null;
    let pressRodBaseY = 0;
    pressPivot.traverse((o) => {
        if (!pressRod && o.name === "rod") {
            pressRod = o;
            pressRodBaseY = o.position.y;
        }
    });

    const pressStation = createPressGantry(-4, beltTop);
    root.add(pressStation.group);

    const clamp = createClamp(-4, beltTop);
    root.add(clamp.group);

    /* ---------------------------------------------------------------- */
    /* Station 2 - vision QC                                             */
    /* ---------------------------------------------------------------- */
    const qcStation = createQcStation(beltTop);
    root.add(qcStation.group);

    const stopper = createStopper(beltTop);
    root.add(stopper.group);

    /* ---------------------------------------------------------------- */
    /* Station 3 - sorting                                               */
    /* ---------------------------------------------------------------- */
    const diverter = createDiverter(4, beltTop);
    root.add(diverter.group);

    const chute = createRejectChute();
    chute.group.position.x = 4;
    root.add(chute.group);

    /* ---------------------------------------------------------------- */
    /* Packaging robot                                                   */
    /* ---------------------------------------------------------------- */
    const robotView = normalizeModel(robot.scene, { height: 2.65 });
    const robotPivot = new THREE.Group();
    robotPivot.add(robotView.holder);
    robotPivot.position.set(7.5, 0, -2.0);
    robotPivot.rotation.y = THREE.MathUtils.degToRad(-55);
    root.add(robotPivot);
    robotPivot.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    const crate = createCrate();
    root.add(crate.group);

    const gripper = createGripper();
    root.add(gripper.group);

    const packagingLabel = createLabelSprite("PACKAGING", "#34d399");
    packagingLabel.position.set(7.9, 3.6, 0.2);
    root.add(packagingLabel);

    /* ---------------------------------------------------------------- */
    /* Sensors, indicators, cabinet                                      */
    /* ---------------------------------------------------------------- */
    const sensors = {
        S1: createSensorPost(-4, "S1", beltTop),
        S2: createSensorPost(0, "S2", beltTop),
        S3: createSensorPost(4, "S3", beltTop),
        EXIT: createSensorPost(6.8, "EXIT", beltTop),
    };
    for (const sensor of Object.values(sensors)) root.add(sensor.group);

    const stackLight = createStackLight(-8.1, -1.7);
    root.add(stackLight.group);
    root.add(createControlCabinet(-8.7, -2.7).group);

    const entryLabel = createLabelSprite("RAW BLANKS  →", "#38bdf8");
    entryLabel.position.set(-8.2, 3.6, 0);
    root.add(entryLabel);

    const floorPad = box(18.5, 0.06, 8.5, std(0x151c23, { metalness: 0.15, roughness: 0.9 }), 0.4, 0.03, 0);
    floorPad.receiveShadow = true;
    root.add(floorPad);

    /* ---------------------------------------------------------------- */
    /* Parts / packaging runtime                                         */
    /* ---------------------------------------------------------------- */
    const partViews = new Map();
    const packJobs = new Map();
    const packedViews = [];

    function ensurePartView(part) {
        let view = partViews.get(part.id);
        if (!view) {
            const parts = makePart();
            root.add(parts.group);
            view = { parts, removedAt: null, part };
            partViews.set(part.id, view);
        }
        return view;
    }

    function dropPartFromController(controller, view) {
        const index = controller.parts.indexOf(view.part);
        if (index !== -1) controller.parts.splice(index, 1);
        if (partViews.get(view.part.id) === view) partViews.delete(view.part.id);
        root.remove(view.parts.group);
        view.parts.dispose();
    }

    function startPackJob(part, view) {
        part.state = "packing";
        const start = view.parts.group.position.clone();
        packJobs.set(part.id, {
            part,
            view,
            t: 0,
            start,
            control: new THREE.Vector3(7.2, beltTop + 2.5, 0.4),
            end: new THREE.Vector3(
                8.5,
                0.42 + Math.min(packedViews.length, 6) * 0.32,
                1.45
            ),
        });
        gripper.setVisible(true);
    }

    function updatePackJobs(controller, dt) {
        for (const [id, job] of packJobs) {
            job.t += dt;
            const t = job.t;
            const partGroup = job.view.parts.group;

            if (t < 0.55) {
                const k = THREE.MathUtils.smoothstep(t / 0.55, 0, 1);
                gripper.place(
                    THREE.MathUtils.lerp(7.2, LAYOUT_EXIT_X - 0.1, k),
                    THREE.MathUtils.lerp(3.0, beltTop + 1.15, k),
                    THREE.MathUtils.lerp(0.4, 0, k),
                    dt
                );
                gripper.setClosed(false, dt);
                partGroup.position.set(LAYOUT_EXIT_X, beltTop, 0);
                robotPivot.rotation.y = THREE.MathUtils.lerp(
                    robotPivot.rotation.y,
                    THREE.MathUtils.degToRad(-55),
                    Math.min(1, dt * 5)
                );
            } else if (t < 1.05) {
                gripper.setClosed(true, dt);
                partGroup.position.set(LAYOUT_EXIT_X, beltTop, 0);
            } else if (t < 2.65) {
                const k = THREE.MathUtils.smoothstep((t - 1.05) / 1.6, 0, 1);
                const a = new THREE.Vector3(LAYOUT_EXIT_X, beltTop + 0.2, 0);
                const p = new THREE.Vector3().copy(a).lerp(job.control, k);
                const q = new THREE.Vector3().copy(job.control).lerp(job.end, k);
                partGroup.position.copy(p.lerp(q, k));
                gripper.place(
                    partGroup.position.x,
                    partGroup.position.y + 0.7,
                    partGroup.position.z,
                    dt
                );
                gripper.setClosed(true, dt);
                robotPivot.rotation.y = THREE.MathUtils.lerp(
                    robotPivot.rotation.y,
                    THREE.MathUtils.degToRad(25),
                    Math.min(1, dt * 3)
                );
            } else if (t < 3.05) {
                gripper.setClosed(false, dt);
                partGroup.position.lerp(job.end, Math.min(1, dt * 8));
                gripper.place(
                    job.end.x,
                    job.end.y + 0.8,
                    job.end.z,
                    dt
                );
            } else {
                partGroup.position.copy(job.end);
                gripper.setClosed(false, dt);
                gripper.place(7.2, 3.0, 0.4, dt);
                job.part.state = "packed";
                job.view.parts.setPressed(job.part.pressed);
                job.view.parts.setInspection(true, true);
                packedViews.push(job.view);
                packJobs.delete(id);

                while (packedViews.length > 7) {
                    const old = packedViews.shift();
                    if (old) dropPartFromController(controller, old);
                }
            }
            job.view.parts.setPressed(job.part.pressed);
            job.view.parts.setInspection(true, true);
        }
    }

    const LAYOUT_EXIT_X = 6.8;

    function updateParts(controller, dt, elapsed, running) {
        let packBusy = packJobs.size > 0;
        for (const part of controller.parts) {
            const view = ensurePartView(part);
            if (view.removedAt !== null) continue;

            if (part.removed) {
                view.parts.group.visible = false;
                view.removedAt = elapsed;
                continue;
            }

            if (part.state === "queuedPack" && !packJobs.has(part.id) && !packBusy) {
                startPackJob(part, view);
                packBusy = true;
            }

            if (packJobs.has(part.id) || part.state === "packed" || part.state === "packing") {
                continue;
            }

            const group = view.parts.group;
            group.visible = true;
            group.position.x = part.x;
            group.position.z = part.z;
            group.position.y =
                beltTop +
                (part.state === "rejected" ? -Math.max(0, -part.z) * 0.22 : 0);

            if (part.state === "rejected") {
                group.rotation.x = Math.min(0.5, Math.max(0, -part.z) * 0.16);
                group.rotation.z = Math.min(0.7, Math.max(0, -part.z) * 0.18);
            } else {
                group.rotation.x *= 0.9;
                group.rotation.z *= 0.9;
                if (running) group.rotation.y += dt * 1.4;
            }

            view.parts.setPressed(part.pressed);
            view.parts.setInspection(
                part.qcPass === null ? true : part.qcPass,
                part.inspected
            );
        }

        for (const view of [...partViews.values()]) {
            if (view.removedAt !== null && elapsed - view.removedAt > 1.2) {
                dropPartFromController(controller, view);
            }
        }
    }

    /* ---------------------------------------------------------------- */
    /* Frame update                                                      */
    /* ---------------------------------------------------------------- */
    let beltOffset = 0;
    let time = 0;
    let lastController = null;

    function update(controller, dt) {
        lastController = controller;
        time += dt;
        const outputs = controller.outputs;
        const inputs = controller.inputs;

        beltOffset += dt * (outputs.M_CONV ? 0.42 : 0);
        for (const map of beltMaps) map.offset.x = beltOffset;
        rollers.update(dt, outputs.M_CONV === 1);

        pressStation.update(dt, outputs.Y1_FEED === 1);
        const pressProgress = pressStation.getProgress();
        if (pressRod) {
            pressRod.position.y = pressRodBaseY - pressProgress * 55;
        }
        clamp.update(dt, outputs.Y1_CLAMP === 1);
        stopper.update(dt, outputs.Y2_STOPPER === 1);
        diverter.update(dt, outputs.Y3_DIVERT === 1);
        qcStation.update(dt, {
            active: outputs.CMD_QC === 1,
            result: inputs.S2_QC_PASS,
            done: inputs.S2_QC_DONE === 1,
        });

        sensors.S1.update(inputs.S1_POS === 1);
        sensors.S2.update(inputs.S2_POS === 1);
        sensors.S3.update(inputs.S3_POS === 1);
        sensors.EXIT.update(inputs.S_EXIT === 1);

        stackLight.update(time, {
            run: outputs.L_RUN === 1,
            fault: outputs.L_FAULT === 1,
            idle: controller.state === 0 && outputs.L_FAULT === 0,
        });

        updatePackJobs(controller, dt);
        updateParts(controller, dt, time, outputs.M_CONV === 1);

        if (packJobs.size === 0 && gripper.group.visible) {
            const anyPacking = controller.parts.some((p) => p.state === "packing");
            if (!anyPacking) {
                gripper.group.visible = false;
            }
        }

        if (!controller.parts.some((p) => p.state === "queuedPack" || p.state === "packing")) {
            robotPivot.rotation.y = THREE.MathUtils.lerp(
                robotPivot.rotation.y,
                THREE.MathUtils.degToRad(-55) + Math.sin(time * 0.6) * 0.03,
                Math.min(1, dt * 1.5)
            );
        }
    }

    return {
        root,
        beltTop,
        update,
        getBounds() {
            return new THREE.Box3().setFromObject(root);
        },
        getDebug() {
            const lineBounds = new THREE.Box3().setFromObject(root);
            const conveyorBounds = new THREE.Box3().setFromObject(conveyorRig);
            const pressBounds = new THREE.Box3().setFromObject(pressPivot);
            const robotBounds = new THREE.Box3().setFromObject(robotPivot);
            const serialize = (b) => ({
                min: { x: b.min.x, y: b.min.y, z: b.min.z },
                max: { x: b.max.x, y: b.max.y, z: b.max.z },
                size: {
                    x: b.max.x - b.min.x,
                    y: b.max.y - b.min.y,
                    z: b.max.z - b.min.z,
                },
            });
            return {
                beltTop,
                beltWidth,
                conveyor: serialize(conveyorBounds),
                press: serialize(pressBounds),
                robot: serialize(robotBounds),
                line: serialize(lineBounds),
                runtime: {
                    parts: lastController?.parts.length ?? 0,
                    partViews: partViews.size,
                    packJobs: packJobs.size,
                    packedViews: packedViews.length,
                    queued: lastController?.parts.filter((p) => p.state === "queuedPack").length ?? 0,
                },
            };
        },
    };
}
