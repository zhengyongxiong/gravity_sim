import { cameraForView, createCamera, cameraForward, moveCamera, pickNearestBody, rotateCamera, zoomCamera } from './app/camera.js';
import { Renderer } from './app/renderer.js';
import { Vec3 } from './core/math.js';
import { BodyType, createBody, SimulationState } from './core/simulation.js';
import { UnitScale, UnitSystem } from './core/units.js';
import { createPresets } from './core/presets.js';

const canvas = document.querySelector('#scene');
const renderer = new Renderer(canvas);
const presets = createPresets();
const state = new SimulationState({
  gravitationalConstant: 1,
  softening: 0.018,
  despawnDistance: 1200,
  maxTrailPoints: 900,
});
let activePreset = 0;
let camera = createCamera();
let paused = false;
let cursorMode = false;
let selectedId = null;
let accumulator = 0;
let previousTime = performance.now();
const fixedDt = 1 / 180;
const keys = new Set();

const settings = {
  showTrails: true,
  showFabric: true,
  heatmap: false,
  showWaves: false,
  fabricSize: 14,
  fabricResolution: 145,
  fabricStrength: 0.22,
  fabricSoftening: 0.2,
  heatmapReferenceDepth: 0.9,
  heatmapExposure: 500000,
  hideHeatmapBase: false,
  timeScale: 0.45,
};

const ui = Object.fromEntries(
  ['presetSelect', 'presetMeta', 'loadPreset', 'pauseButton', 'resetButton', 'trailToggle',
    'fabricToggle', 'heatmapToggle', 'hideHeatmapBaseToggle', 'wavesToggle', 'collisionsToggle',
    'timeScale', 'sideViewButton', 'upwardViewButton', 'topViewButton',
    'unitMode', 'spawnType', 'spawnMass', 'spawnDensity', 'spawnRadius', 'spawnVelocity',
    'spawnButton', 'selectedStats', 'fpsLabel', 'countLabel', 'modeLabel']
    .map((id) => [id, document.querySelector(`#${id}`)]),
);

initUi();
loadPreset(0);
installDebugHooks();
requestAnimationFrame(loop);

function initUi() {
  for (const [index, preset] of presets.entries()) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = preset.title;
    ui.presetSelect.append(option);
  }

  ui.presetSelect.addEventListener('change', () => {
    activePreset = Number(ui.presetSelect.value);
    updatePresetMeta();
  });
  ui.loadPreset.addEventListener('click', () => loadPreset(activePreset));
  ui.resetButton.addEventListener('click', () => loadPreset(activePreset));
  ui.pauseButton.addEventListener('click', () => togglePause());
  ui.spawnButton.addEventListener('click', spawnFromCamera);
  ui.trailToggle.addEventListener('change', () => { settings.showTrails = ui.trailToggle.checked; });
  ui.fabricToggle.addEventListener('change', () => { settings.showFabric = ui.fabricToggle.checked; });
  ui.heatmapToggle.addEventListener('change', () => { settings.heatmap = ui.heatmapToggle.checked; });
  ui.hideHeatmapBaseToggle.addEventListener('change', () => { settings.hideHeatmapBase = ui.hideHeatmapBaseToggle.checked; });
  ui.wavesToggle.addEventListener('change', () => { settings.showWaves = ui.wavesToggle.checked; });
  ui.collisionsToggle.addEventListener('change', () => { state.config.collisionEnabled = ui.collisionsToggle.checked; });
  ui.sideViewButton.addEventListener('click', () => { camera = cameraForView('side'); });
  ui.upwardViewButton.addEventListener('click', () => { camera = cameraForView('upward'); });
  ui.topViewButton.addEventListener('click', () => { camera = cameraForView('top'); });
  ui.timeScale.addEventListener('change', () => {
    settings.timeScale = parseNumber(ui.timeScale.value, settings.timeScale, 0, 25);
    ui.timeScale.value = String(settings.timeScale);
  });

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', (event) => {
    camera = zoomCamera(camera, event.deltaY);
    event.preventDefault();
  }, { passive: false });
  document.addEventListener('pointerlockchange', updateModeLabel);
}

function loadPreset(index) {
  activePreset = index;
  ui.presetSelect.value = String(index);
  state.setBodies(presets[index].bodies);
  state.flashes = [];
  state.time = 0;
  selectedId = null;
  updatePresetMeta();
  updateUiReadouts(60);
}

function updatePresetMeta() {
  ui.presetMeta.textContent = presets[activePreset]?.classification ?? '';
}

function onKeyDown(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  keys.add(event.code);
  if (event.code === 'Escape') {
    togglePause();
    event.preventDefault();
  } else if (event.code === 'KeyO') {
    cursorMode = !cursorMode;
    if (cursorMode && document.pointerLockElement) document.exitPointerLock();
    updateModeLabel();
  } else if (event.code === 'KeyT') {
    ui.trailToggle.checked = !ui.trailToggle.checked;
    settings.showTrails = ui.trailToggle.checked;
  } else if (event.code === 'KeyV') {
    ui.fabricToggle.checked = !ui.fabricToggle.checked;
    settings.showFabric = ui.fabricToggle.checked;
  } else if (event.code === 'KeyY') {
    ui.heatmapToggle.checked = !ui.heatmapToggle.checked;
    settings.heatmap = ui.heatmapToggle.checked;
  }
}

function onCanvasClick(event) {
  if (!cursorMode) {
    canvas.requestPointerLock?.();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const picked = pickNearestBody(
    state.bodies,
    camera,
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    { width: rect.width, height: rect.height },
  );
  selectedId = picked?.id ?? null;
  for (const body of state.bodies) body.selected = body.id === selectedId;
  updateUiReadouts(currentFps);
}

function onMouseMove(event) {
  if (cursorMode) return;
  if (document.pointerLockElement === canvas || event.buttons === 1) {
    camera = rotateCamera(camera, event.movementX, event.movementY);
  }
}

function togglePause() {
  paused = !paused;
  ui.pauseButton.textContent = paused ? 'Resume' : 'Pause';
}

function spawnFromCamera() {
  const unitMode = ui.unitMode.value;
  const type = ui.spawnType.value;
  let mass = parseNumber(ui.spawnMass.value, 0.001, 1e-12);
  let density = parseNumber(ui.spawnDensity.value, 5, 1e-12);
  let radius = parseNumber(ui.spawnRadius.value, 0.025, 1e-12);
  let speed = parseNumber(ui.spawnVelocity.value, 1, -1e12, 1e12);

  if (unitMode === UnitSystem.SI) {
    mass /= UnitScale.mass;
    density /= UnitScale.density;
    radius /= UnitScale.distance;
    speed /= UnitScale.velocity;
  }

  const forward = cameraForward(camera);
  const body = createBody({
    name: `${type} ${state.bodies.length + 1}`,
    type,
    mass,
    density,
    radius,
    position: camera.position.add(forward.scale(0.4)),
    velocity: forward.scale(speed),
  });
  if (type === BodyType.STAR || type === BodyType.WHITE_DWARF || type === BodyType.NEUTRON_STAR) {
    body.glow = true;
  }
  state.bodies.push(body);
}

let currentFps = 60;
function loop(now) {
  const frameDt = Math.min(0.1, (now - previousTime) / 1000);
  previousTime = now;
  currentFps = currentFps * 0.9 + (1 / Math.max(frameDt, 1 / 240)) * 0.1;

  updateCamera(frameDt);
  if (!paused) {
    accumulator += frameDt * settings.timeScale;
    while (accumulator >= fixedDt) {
      state.step(fixedDt);
      accumulator -= fixedDt;
    }
  }

  renderer.draw(state, camera, settings);
  updateUiReadouts(currentFps);
  requestAnimationFrame(loop);
}

function updateCamera(dt) {
  const intent = {
    forward: (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0),
    right: (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0),
    up: (keys.has('Space') ? 1 : 0) + (keys.has('ShiftLeft') || keys.has('ShiftRight') ? -1 : 0),
  };
  camera = moveCamera(camera, intent, dt);
}

function updateUiReadouts(fps) {
  ui.fpsLabel.textContent = `FPS ${Math.round(fps)}`;
  ui.countLabel.textContent = `${state.bodies.length} bodies`;
  updateModeLabel();
  const selected = state.bodies.find((body) => body.id === selectedId);
  ui.selectedStats.textContent = selected ? formatStats(selected) : 'Click a body in cursor mode.';
}

function updateModeLabel() {
  ui.modeLabel.textContent = cursorMode
    ? 'Cursor mode: click bodies/sidebar'
    : 'Camera mode: click scene for mouse look';
  canvas.style.cursor = cursorMode ? 'crosshair' : 'none';
}

function formatStats(body) {
  return [
    body.name,
    `type: ${body.type}`,
    `mass: ${fmt(body.mass)}`,
    `density: ${fmt(body.density)}`,
    `radius: ${fmt(body.radius)}`,
    `position: ${fmtVec(body.position)}`,
    `velocity: ${fmtVec(body.velocity)}`,
    `speed: ${fmt(body.velocity.length())}`,
  ].join('\n');
}

function fmtVec(v) {
  return `(${fmt(v.x)}, ${fmt(v.y)}, ${fmt(v.z)})`;
}

function fmt(value) {
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.001) return value.toExponential(3);
  return value.toFixed(4);
}

function parseNumber(value, fallback, min = -Infinity, max = Infinity) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function installDebugHooks() {
  window.gravitySim = {
    snapshot: () => ({
      paused,
      cursorMode,
      activePreset: presets[activePreset].title,
      bodyCount: state.bodies.length,
      selectedId,
      settings: { ...settings },
      collisionsEnabled: state.config.collisionEnabled,
      bodyNames: state.bodies.map((body) => body.name),
    }),
  };
}
