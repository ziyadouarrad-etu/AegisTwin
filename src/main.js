import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { LineController } from "./sim/controller.js";
import { buildLine } from "./line/buildLine.js";
import { PanelUI } from "./ui/panels.js";

const canvas = document.getElementById("viewport");

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b0f);
scene.fog = new THREE.Fog(0x070b0f, 22, 60);

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);
camera.position.set(0, 8.5, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0, 1.2, 0);
controls.minDistance = 4;
controls.maxDistance = 42;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

/* -------------------------------------------------------------------- */
/* Environment                                                          */
/* -------------------------------------------------------------------- */
const hemi = new THREE.HemisphereLight(0xbdd7ff, 0x0a0f14, 0.6);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
keyLight.position.set(7, 14, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -14;
keyLight.shadow.camera.right = 14;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 45;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x7aa2ff, 0.85);
fillLight.position.set(-9, 6, -7);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
rimLight.position.set(0, 5, -12);
scene.add(rimLight);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({
        color: 0x0d1319,
        roughness: 0.97,
        metalness: 0.05,
    })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(80, 80, 0x22313d, 0x121a21);
grid.position.y = 0.005;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

/* -------------------------------------------------------------------- */
/* App                                                                  */
/* -------------------------------------------------------------------- */
const controller = new LineController();
let line = null;
let speed = 1;
let resizeCamera = null;

window.__ERRORS__ = [];
window.addEventListener("error", (event) => {
    window.__ERRORS__.push(String(event.message || event.error || event));
});
window.addEventListener("unhandledrejection", (event) => {
    window.__ERRORS__.push(String(event.reason || event));
});
window.__APP__ = {
    scene,
    camera,
    controls,
    renderer,
    controller,
    get line() {
        return line;
    },
};

const ui = new PanelUI(controller, {
    onCameraReset: () => resetCamera(),
    onSpeedChange: (value) => {
        speed = value;
    },
});

const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (_url, loaded, total) => {
    const percent = total > 0 ? (loaded / total) * 100 : 5;
    ui.setProgress(percent, `Loading models ${loaded}/${total}…`);
};
loadingManager.onLoad = () => ui.setProgress(100, "Finalising scene…");

const loader = new GLTFLoader(loadingManager);

function fitCamera(bounds) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fitHeight = size.y / 2 / Math.tan(fov / 2);
    const fitWidth = size.x / 2 / (Math.tan(fov / 2) * camera.aspect);
    const distance = Math.max(fitHeight, fitWidth, 6) * 1.18;

    const position = new THREE.Vector3(
        center.x + distance * 0.12,
        center.y + distance * 0.56,
        center.z + distance * 0.92
    );
    const target = new THREE.Vector3(center.x, center.y + 0.35, center.z);

    return { position, target };
}

function resetCamera() {
    if (!resizeCamera) return;
    camera.position.copy(resizeCamera.position);
    controls.target.copy(resizeCamera.target);
    controls.update();
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onResize);

async function init() {
    ui.setProgress(5, "Loading conveyor, press and robot…");
    try {
        line = await buildLine(scene, loader);

        const bounds = line.getBounds();
        resizeCamera = fitCamera(bounds);
        camera.position.copy(resizeCamera.position);
        controls.target.copy(resizeCamera.target);
        controls.update();

        ui.setProgress(100, "Ready");
        ui.hideLoading();
    } catch (error) {
        console.error(error);
        ui.showError(
            "Could not load the production line. Run it from a local server: python serve.py"
        );
    }
}

/* -------------------------------------------------------------------- */
/* Render loop                                                          */
/* -------------------------------------------------------------------- */
let lastFrame = performance.now();

function animate(now) {
    requestAnimationFrame(animate);

    const realDelta = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.1);
    lastFrame = now;
    const delta = realDelta * speed;

    if (line) {
        controller.update(delta);
        line.update(controller, delta);
    }

    controls.update();
    renderer.render(scene, camera);
    ui.update();
}

init();
requestAnimationFrame(animate);
