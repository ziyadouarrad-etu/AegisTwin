import * as THREE from "three";

export const COLORS = {
    steel: 0x8794a2,
    darkSteel: 0x2f3942,
    darkerSteel: 0x1b232a,
    yellow: 0xf0b429,
    red: 0xef4444,
    green: 0x22c55e,
    amber: 0xf59e0b,
    rubber: 0x14181c,
    wood: 0x8a5a33,
    blue: 0x2563eb,
};

export function std(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        metalness: options.metalness ?? 0.45,
        roughness: options.roughness ?? 0.55,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 1,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        side: options.side ?? THREE.FrontSide,
    });
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function cylinder(radius, height, material, segments = 24) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, segments),
        material
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function createLabelSprite(text, accent = "#38bdf8") {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(8, 14, 20, 0.82)";
    roundRect(ctx, 8, 18, 496, 92, 18);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    roundRect(ctx, 8, 18, 496, 92, 18);
    ctx.stroke();

    ctx.fillStyle = "#e8f4ff";
    ctx.font = "700 46px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 65);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        })
    );
    sprite.scale.set(2.3, 0.58, 1);
    sprite.renderOrder = 10;
    return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function makePart() {
    const group = new THREE.Group();

    const bodyMat = std(0xb8c2cc, { metalness: 0.72, roughness: 0.32 });
    const body = cylinder(0.34, 0.42, bodyMat, 28);
    body.position.y = 0.21;
    group.add(body);

    const flangeMat = std(0x8c98a4, { metalness: 0.7, roughness: 0.35 });
    const flange = cylinder(0.42, 0.07, flangeMat, 32);
    flange.position.y = 0.035;
    group.add(flange);

    const capMat = std(0x6d7a86, { metalness: 0.78, roughness: 0.28 });
    const cap = cylinder(0.2, 0.06, capMat, 24);
    cap.position.y = 0.45;
    group.add(cap);

    const dentMat = std(0x3a434b, { metalness: 0.5, roughness: 0.7 });
    const dent = cylinder(0.2, 0.045, dentMat, 24);
    dent.position.y = 0.485;
    dent.visible = false;
    group.add(dent);

    const ringMat = new THREE.MeshStandardMaterial({
        color: COLORS.green,
        emissive: COLORS.green,
        emissiveIntensity: 0.7,
        metalness: 0.2,
        roughness: 0.35,
        transparent: true,
        opacity: 0.92,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 10, 40), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    ring.visible = false;
    group.add(ring);

    group.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    return {
        group,
        setPressed(value) {
            dent.visible = Boolean(value);
        },
        setInspection(pass, inspected) {
            ring.visible = Boolean(inspected);
            if (inspected) {
                const color = pass ? COLORS.green : COLORS.red;
                ringMat.color.setHex(color);
                ringMat.emissive.setHex(color);
            }
        },
        dispose() {
            group.traverse((o) => {
                if (o.isMesh) {
                    o.geometry?.dispose();
                    if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
                    else o.material?.dispose();
                }
            });
        },
    };
}

export function createRollers(beltTop, length = 16.6, width = 2.6) {
    const group = new THREE.Group();
    const mat = std(COLORS.darkSteel, { metalness: 0.8, roughness: 0.35 });
    const geometry = new THREE.CylinderGeometry(0.11, 0.11, width, 14);
    geometry.rotateX(Math.PI / 2);

    const rollers = [];
    const count = 18;
    for (let i = 0; i < count; i += 1) {
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(-length / 2 + 0.5 + (i * (length - 1)) / (count - 1), beltTop - 0.13, 0);
        mesh.castShadow = true;
        group.add(mesh);
        rollers.push(mesh);
    }

    return {
        group,
        update(dt, running) {
            if (!running) return;
            for (const roller of rollers) roller.rotation.z -= dt * 7.5;
        },
    };
}

export function createClamp(x, beltTop) {
    const group = new THREE.Group();
    group.position.x = x;

    const bodyMat = std(COLORS.yellow, { metalness: 0.5, roughness: 0.42 });
    const rodMat = std(0xc4ccd4, { metalness: 0.9, roughness: 0.2 });

    const jaws = new THREE.Group();
    const left = box(0.4, 0.62, 0.24, bodyMat, 0, beltTop + 0.34, 0);
    const right = box(0.4, 0.62, 0.24, bodyMat, 0, beltTop + 0.34, 0);
    jaws.add(left, right);

    const leftRod = cylinder(0.05, 1.1, rodMat);
    leftRod.rotation.x = Math.PI / 2;
    leftRod.position.set(0, beltTop + 0.34, 0);
    const rightRod = leftRod.clone();
    jaws.add(leftRod, rightRod);

    group.add(jaws);

    const postMat = std(COLORS.darkSteel, { metalness: 0.65, roughness: 0.4 });
    for (const z of [-1.35, 1.35]) {
        const post = box(0.16, 1.55, 0.16, postMat, 0, 0.78, z);
        group.add(post);
    }

    let progress = 0;

    return {
        group,
        update(dt, closed) {
            const target = closed ? 1 : 0;
            progress += (target - progress) * Math.min(1, dt * 9);
            const jawZ = THREE.MathUtils.lerp(0.92, 0.4, progress);
            left.position.z = -jawZ;
            right.position.z = jawZ;
            leftRod.position.z = -jawZ - 0.5;
            rightRod.position.z = jawZ + 0.5;
            leftRod.scale.y = rightRod.scale.y = 1;
        },
    };
}

export function createStopper(beltTop) {
    const group = new THREE.Group();
    group.position.x = 0.62;

    const housingMat = std(COLORS.darkSteel, { metalness: 0.55, roughness: 0.5 });
    const housing = box(0.5, 0.42, 0.5, housingMat, 0, beltTop - 0.55, 0);
    group.add(housing);

    const pinMat = std(0xf8fafc, { metalness: 0.85, roughness: 0.2 });
    const pin = cylinder(0.075, 0.95, pinMat, 16);
    pin.position.y = beltTop - 0.82;
    group.add(pin);

    const capMat = std(COLORS.red, { metalness: 0.4, roughness: 0.45 });
    const cap = cylinder(0.13, 0.08, capMat, 16);
    cap.position.y = 0.48;
    pin.add(cap);

    let progress = 0;

    return {
        group,
        update(dt, up) {
            const target = up ? 1 : 0;
            progress += (target - progress) * Math.min(1, dt * 11);
            pin.position.y = THREE.MathUtils.lerp(beltTop - 0.82, beltTop + 0.2, progress);
        },
    };
}

export function createQcStation(beltTop) {
    const group = new THREE.Group();
    const frameMat = std(0x475569, { metalness: 0.7, roughness: 0.35 });
    const accentMat = std(COLORS.blue, { metalness: 0.3, roughness: 0.4, emissive: COLORS.blue, emissiveIntensity: 0.25 });

    for (const z of [-1.25, 1.25]) {
        const post = box(0.16, 2.5, 0.16, frameMat, 0, 1.25, z);
        group.add(post);
        const foot = box(0.4, 0.1, 0.4, frameMat, 0, 0.05, z);
        group.add(foot);
    }

    const beam = box(0.22, 0.22, 2.7, frameMat, 0, 2.5, 0);
    group.add(beam);

    const cameraBody = box(0.62, 0.34, 0.5, std(0x111827, { metalness: 0.5, roughness: 0.4 }), 0, 2.2, 0);
    group.add(cameraBody);

    const lens = cylinder(0.11, 0.16, accentMat, 20);
    lens.position.set(0, 1.98, 0);
    group.add(lens);

    const beamMat = new THREE.MeshStandardMaterial({
        color: COLORS.green,
        emissive: COLORS.green,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const scan = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.62, 0.95), beamMat);
    scan.position.set(0, beltTop + 0.75, 0);
    scan.visible = false;
    group.add(scan);

    const light = new THREE.PointLight(COLORS.green, 0, 4);
    light.position.set(0, beltTop + 0.9, 0);
    group.add(light);

    const screenMat = new THREE.MeshStandardMaterial({
        color: 0x0b1620,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.45,
        roughness: 0.3,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.4), screenMat);
    screen.position.set(0, 2.2, 0.26);
    group.add(screen);

    const label = createLabelSprite("STATION 2  ·  VISION QC", "#38bdf8");
    label.position.set(0, 3.2, 0);
    group.add(label);

    let notice = 0;

    return {
        group,
        update(dt, { active, result, done }) {
            const color = result === 0 ? COLORS.red : COLORS.green;
            beamMat.color.setHex(color);
            beamMat.emissive.setHex(color);
            light.color.setHex(color);
            scan.visible = Boolean(active);
            light.intensity = active ? 1.6 : done ? 0.35 : 0;
            notice += dt;
            if (active) {
                scan.position.z = Math.sin(notice * 9) * 0.42;
                scan.position.x = Math.sin(notice * 5) * 0.12;
            } else {
                scan.position.z *= 0.85;
                scan.position.x *= 0.85;
            }
            screenMat.emissiveIntensity = active ? 1.2 : done ? 1.5 : 0.35;
            screenMat.emissive.setHex(done ? color : 0x0ea5e9);
        },
    };
}

export function createDiverter(x, beltTop) {
    const group = new THREE.Group();
    group.position.x = x;

    const baseMat = std(COLORS.darkSteel, { metalness: 0.65, roughness: 0.4 });
    const base = box(0.4, 0.45, 0.6, baseMat, 0, beltTop + 0.28, 1.55);
    group.add(base);

    const rodMat = std(0xd5dde4, { metalness: 0.9, roughness: 0.2 });
    const rod = cylinder(0.055, 1, rodMat, 14);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(0, beltTop + 0.32, 1.0);
    group.add(rod);

    const plateMat = std(COLORS.red, { metalness: 0.4, roughness: 0.5 });
    const plate = box(0.78, 0.55, 0.1, plateMat, 0, beltTop + 0.32, 0.5);
    group.add(plate);

    let progress = 0;

    return {
        group,
        update(dt, extended) {
            const target = extended ? 1 : 0;
            progress += (target - progress) * Math.min(1, dt * 8);

            const plateZ = THREE.MathUtils.lerp(0.5, -0.95, progress);
            plate.position.z = plateZ;
            rod.position.z = (plateZ + 1.55) / 2;
            rod.scale.y = Math.max(0.12, Math.abs(1.55 - plateZ));
        },
    };
}

export function createRejectChute() {
    const group = new THREE.Group();
    const chuteMat = std(0x3b4652, { metalness: 0.55, roughness: 0.5 });
    const chute = box(1.35, 0.08, 2.6, chuteMat, 0, 0.55, -2.15);
    chute.rotation.x = -0.26;
    group.add(chute);

    const railMat = std(0x252f38, { metalness: 0.4, roughness: 0.6 });
    for (const x of [-0.68, 0.68]) {
        const rail = box(0.06, 0.24, 2.6, railMat, x, 0.67, -2.15);
        rail.rotation.x = -0.26;
        group.add(rail);
    }

    const bin = new THREE.Group();
    bin.position.set(0, 0, -3.45);
    const binMat = std(COLORS.red, { metalness: 0.3, roughness: 0.65 });
    const binFloor = box(1.4, 0.08, 1.2, binMat, 0, 0.06, 0);
    bin.add(binFloor);
    for (const x of [-0.66, 0.66]) bin.add(box(0.08, 0.55, 1.2, binMat, x, 0.32, 0));
    for (const z of [-0.56, 0.56]) bin.add(box(1.4, 0.55, 0.08, binMat, 0, 0.32, z));
    group.add(bin);

    const label = createLabelSprite("REJECT BIN", "#f87171");
    label.position.set(0, 1.25, -3.45);
    group.add(label);

    return { group };
}

export function createCrate() {
    const group = new THREE.Group();
    group.position.set(8.5, 0, 1.45);

    const wood = std(COLORS.wood, { metalness: 0.05, roughness: 0.85 });
    const wallT = 0.08;
    group.add(box(1.5, 0.08, 1.2, wood, 0, 0.04, 0));
    group.add(box(1.5, 0.55, wallT, wood, 0, 0.32, -0.56));
    group.add(box(1.5, 0.55, wallT, wood, 0, 0.32, 0.56));
    group.add(box(wallT, 0.55, 1.2, wood, -0.71, 0.32, 0));
    group.add(box(wallT, 0.55, 1.2, wood, 0.71, 0.32, 0));

    const label = createLabelSprite("PACKAGED", "#34d399");
    label.position.set(0, 1.4, 0);
    group.add(label);

    return { group };
}

export function createStackLight(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const poleMat = std(0x4b5563, { metalness: 0.7, roughness: 0.35 });
    const pole = cylinder(0.055, 2.55, poleMat, 12);
    pole.position.y = 1.28;
    group.add(pole);
    group.add(box(0.5, 0.08, 0.5, poleMat, 0, 0.04, 0));

    const makeLamp = (y, color) => {
        const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.08,
            metalness: 0.2,
            roughness: 0.3,
            transparent: true,
            opacity: 0.9,
        });
        const mesh = cylinder(0.13, 0.2, mat, 20);
        mesh.position.y = y;
        group.add(mesh);
        return mat;
    };

    const redMat = makeLamp(2.25, COLORS.red);
    const amberMat = makeLamp(2.48, COLORS.amber);
    const greenMat = makeLamp(2.71, COLORS.green);

    const redLight = new THREE.PointLight(COLORS.red, 0, 4);
    redLight.position.y = 2.25;
    group.add(redLight);
    const greenLight = new THREE.PointLight(COLORS.green, 0, 4);
    greenLight.position.y = 2.71;
    group.add(greenLight);

    return {
        group,
        update(time, { run, fault, idle }) {
            const blink = (Math.sin(time * 9) + 1) * 0.5;
            redMat.emissiveIntensity = fault ? 0.3 + blink * 2.4 : 0.05;
            redLight.intensity = fault ? 0.6 + blink * 2.2 : 0;
            greenMat.emissiveIntensity = run ? 1.8 : 0.05;
            greenLight.intensity = run ? 1.4 : 0;
            amberMat.emissiveIntensity = idle ? 0.8 : 0.05;
        },
    };
}

export function createSensorPost(x, name, beltTop) {
    const group = new THREE.Group();
    group.position.x = x;

    const postMat = std(0x38434e, { metalness: 0.6, roughness: 0.45 });
    const post = box(0.1, 1.05, 0.1, postMat, 0, beltTop + 0.45, -1.05);
    group.add(post);

    const headMat = std(0x111827, { metalness: 0.4, roughness: 0.5 });
    const head = box(0.18, 0.16, 0.28, headMat, 0, beltTop + 0.98, -0.92);
    group.add(head);

    const ledMat = new THREE.MeshStandardMaterial({
        color: COLORS.amber,
        emissive: COLORS.amber,
        emissiveIntensity: 0.08,
        metalness: 0.1,
        roughness: 0.3,
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), ledMat);
    led.position.set(0, beltTop + 0.96, -0.78);
    group.add(led);

    const label = createLabelSprite(name, "#fbbf24");
    label.scale.set(1.1, 0.28, 1);
    label.position.set(0, beltTop + 1.38, -0.9);
    group.add(label);

    return {
        group,
        update(active) {
            ledMat.emissiveIntensity = active ? 2.2 : 0.08;
        },
    };
}

export function createControlCabinet(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const bodyMat = std(0x2b3742, { metalness: 0.5, roughness: 0.55 });
    const body = box(1.2, 1.75, 0.72, bodyMat, 0, 0.88, 0);
    group.add(body);

    const panelMat = std(0x111a22, { metalness: 0.35, roughness: 0.6 });
    const panel = box(1.0, 0.95, 0.04, panelMat, 0, 1.15, 0.37);
    group.add(panel);

    const lampMat = new THREE.MeshStandardMaterial({
        color: COLORS.green,
        emissive: COLORS.green,
        emissiveIntensity: 1.4,
        roughness: 0.3,
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), lampMat);
    lamp.position.set(-0.32, 1.45, 0.4);
    group.add(lamp);

    const warning = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16),
        std(COLORS.red, { metalness: 0.3, roughness: 0.4, emissive: COLORS.red, emissiveIntensity: 0.5 })
    );
    warning.rotation.x = Math.PI / 2;
    warning.position.set(0.02, 1.45, 0.4);
    group.add(warning);

    return { group };
}
