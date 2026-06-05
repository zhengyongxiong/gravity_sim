import { assert, approx, test, vecApprox } from './test-utils.js';
import { Vec3 } from '../src/core/math.js';
import {
  cameraForward,
  cameraForView,
  createCamera,
  moveCamera,
  pickNearestBody,
} from '../src/app/camera.js';
import {
  buildBodyPoints,
  buildBodySprites,
  buildFabricLayers,
  buildFabricSurface,
  bodySpriteWorldSize,
} from '../src/app/renderer.js';
import { buildFabricGrid, heatColorForDepth } from '../src/core/fabric.js';
import { createPresets } from '../src/core/presets.js';
import { BodyType, createBody } from '../src/core/simulation.js';

test('camera forward points along yaw and pitch', () => {
  vecApprox(cameraForward(createCamera({ yaw: 0, pitch: 0 })), new Vec3(0, 0, -1));
  const right = cameraForward(createCamera({ yaw: Math.PI / 2, pitch: 0 }));
  approx(right.x, 1, 1e-12);
  approx(right.z, 0, 1e-12);
});

test('camera movement follows local axes', () => {
  const camera = createCamera({ position: new Vec3(0, 0, 0), yaw: 0, pitch: 0, speed: 2 });
  const moved = moveCamera(camera, { forward: 1, right: 1, up: 1 }, 0.5);

  vecApprox(moved.position, new Vec3(1, 1, -1));
});

test('body picking returns nearest projected body inside hit radius', () => {
  const bodies = [
    createBody({ name: 'Far', position: new Vec3(0.1, 0, -2), radius: 0.1 }),
    createBody({ name: 'Near', position: new Vec3(0.05, 0, -1), radius: 0.1 }),
    createBody({ name: 'Miss', position: new Vec3(4, 0, -1), radius: 0.1 }),
  ];
  const camera = createCamera({ position: Vec3.zero(), yaw: 0, pitch: 0 });

  const picked = pickNearestBody(bodies, camera, { x: 400, y: 300 }, { width: 800, height: 600 });

  assert.equal(picked?.name, 'Near');
});

test('heatmap surface builds filled triangles instead of grid-only lines', () => {
  const bodies = [
    createBody({ name: 'Well', type: BodyType.STAR, mass: 1, position: Vec3.zero(), radius: 0.1 }),
  ];

  const surface = buildFabricSurface(bodies, {
    fabricSize: 2,
    fabricResolution: 3,
    fabricStrength: 1,
    fabricSoftening: 0.1,
    showWaves: false,
    heatmap: true,
  }, 0);

  assert.equal(surface.positions.length / 3, 24);
  assert.equal(surface.colors.length / 4, 24);
  assert.ok(surface.colors.some((value) => value > 0 && value < 1));
});

test('high resolution fabric creates a dense readable heatmap mesh', () => {
  const bodies = [
    createBody({ name: 'Well', type: BodyType.STAR, mass: 1, position: Vec3.zero(), radius: 0.1 }),
  ];
  const surface = buildFabricSurface(bodies, {
    fabricSize: 14,
    fabricResolution: 181,
    fabricStrength: 0.22,
    fabricSoftening: 0.2,
    showWaves: false,
    heatmap: true,
  }, 0);

  assert.equal(surface.positions.length / 3, (181 - 1) * (181 - 1) * 6);
});

test('heatmap grid overlay uses subtle thin-line alpha', () => {
  const bodies = [
    createBody({ name: 'Well', type: BodyType.STAR, mass: 1, position: Vec3.zero(), radius: 0.1 }),
  ];
  const layers = buildFabricLayers(bodies, {
    fabricSize: 14,
    fabricResolution: 17,
    fabricStrength: 0.22,
    fabricSoftening: 0.2,
    showWaves: false,
    showFabric: true,
    heatmap: true,
  }, 0);
  const alphas = layers.grid.colors.filter((_, index) => index % 4 === 3);

  assert.ok(Math.max(...alphas) <= 0.24);
});

test('heatmap mode combines continuous color surface and grid on the same geometry', () => {
  const bodies = [
    createBody({ name: 'Well', type: BodyType.STAR, mass: 1, position: Vec3.zero(), radius: 0.1 }),
  ];

  const layers = buildFabricLayers(bodies, {
    fabricSize: 2,
    fabricResolution: 3,
    fabricStrength: 1,
    fabricSoftening: 0.1,
    showWaves: false,
    showFabric: true,
    heatmap: true,
  }, 0);

  assert.ok(layers.surface.positions.length > 0);
  assert.ok(layers.grid.positions.length > 0);
  assert.equal(layers.grid.overlay, true);
  assert.ok(layers.grid.colors.every((value, index) => index % 4 === 3 || value < 0.6));
  assert.equal(layers.surface.positions[1], layers.grid.positions[1]);
});

test('hidden heatmap base makes cool regions transparent while keeping wells visible', () => {
  const bodies = [
    createBody({ name: 'Well', type: BodyType.STAR, mass: 1, position: Vec3.zero(), radius: 0.1 }),
  ];

  const surface = buildFabricSurface(bodies, {
    fabricSize: 4,
    fabricResolution: 5,
    fabricStrength: 1,
    fabricSoftening: 0.1,
    showWaves: false,
    heatmap: true,
    hideHeatmapBase: true,
  }, 0);
  const alphas = surface.colors.filter((_, index) => index % 4 === 3);

  assert.ok(Math.min(...alphas) < 0.08);
  assert.ok(Math.max(...alphas) > 0.5);
});

test('sun earth hidden-base heatmap keeps the additive field bridge visible', () => {
  const preset = createPresets().find((candidate) => candidate.title === 'Sun and Earth');
  const surface = buildFabricSurface(preset.bodies, {
    fabricSize: 14,
    fabricResolution: 145,
    fabricStrength: 0.22,
    fabricSoftening: 0.2,
    heatmap: true,
    showWaves: false,
    hideHeatmapBase: true,
    heatmapReferenceDepth: 0.9,
  }, 0);

  assert.ok(maxAlphaNear(surface, new Vec3(1.6, 0, 0), 0.16) > 0.2);
  assert.ok(maxAlphaNear(surface, new Vec3(6.5, 0, 6.5), 0.16) < 0.15);
});

test('default camera starts in a low side-view angle', () => {
  const camera = createCamera();

  assert.ok(camera.position.y > 0.6 && camera.position.y < 2.0);
  assert.ok(camera.position.z > 6);
  assert.ok(camera.pitch > -0.22 && camera.pitch < -0.04);
});

test('camera view presets switch between side and upward views', () => {
  const side = cameraForView('side');
  const upward = cameraForView('upward');
  const top = cameraForView('top');

  assert.ok(side.position.y > 0);
  assert.ok(side.pitch < 0);
  assert.ok(upward.position.y < 0);
  assert.ok(upward.pitch > 0);
  assert.ok(top.position.y > 7);
  assert.ok(top.pitch < -1.3);
});

test('body point rendering uses larger procedural styles for stars and earthlike planets', () => {
  const bodies = [
    createBody({ name: 'Sun', type: BodyType.STAR, radius: 0.12, position: Vec3.zero() }),
    createBody({ name: 'Earth', type: BodyType.PLANET, radius: 0.035, position: new Vec3(1, 0, 0), color: [80, 140, 255] }),
  ];

  const points = buildBodyPoints(bodies);

  assert.ok(points.sizes[0] >= 220);
  assert.ok(points.sizes[1] >= 100);
  assert.equal(points.styles[0], 1);
  assert.equal(points.styles[1], 2);
});

test('body billboard rendering creates textured quads for visible body detail', () => {
  const camera = cameraForView('side');
  const bodies = [
    createBody({ name: 'Sun', type: BodyType.STAR, radius: 0.12, position: Vec3.zero() }),
    createBody({ name: 'Earth', type: BodyType.PLANET, radius: 0.035, position: new Vec3(1, 0, 0), color: [80, 140, 255] }),
  ];

  const sprites = buildBodySprites(bodies, camera);

  assert.equal(sprites.positions.length / 3, 12);
  assert.equal(sprites.uvs.length / 2, 12);
  assert.deepEqual(sprites.styles, [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
});

test('visual body sizes preserve actual size ordering after exaggeration', () => {
  const sun = createBody({ name: 'Sun', type: BodyType.STAR, mass: 1, radius: 0.12, position: Vec3.zero() });
  const earth = createBody({ name: 'Earth', type: BodyType.PLANET, mass: 3e-6, radius: 0.035, position: new Vec3(1, 0, 0), color: [80, 140, 255] });
  const moon = createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, radius: 0.025, position: new Vec3(1.2, 0, 0), color: [210, 210, 210] });

  assert.ok(bodySpriteWorldSize(sun) > bodySpriteWorldSize(earth) * 2);
  assert.ok(bodySpriteWorldSize(earth) > bodySpriteWorldSize(moon) * 1.2);
});

test('heatmap color ramp is saturated for deep wells', () => {
  const hot = heatColorForDepth(3, 3);
  const cool = heatColorForDepth(0.02, 3);

  assert.ok(hot.r >= 250);
  assert.ok(hot.g <= 80);
  assert.ok(cool.b >= 245);
});

test('heatmap uses a shared scale so stronger systems look stronger', () => {
  const earthMoon = buildFabricSurface([
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.08, position: Vec3.zero(), color: [80, 140, 255] }),
    createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.025, position: new Vec3(1, 0, 0), color: [210, 210, 210] }),
  ], {
    fabricSize: 4,
    fabricResolution: 5,
    fabricStrength: 0.22,
    fabricSoftening: 0.16,
    showWaves: false,
    heatmap: true,
  }, 0);
  const sunEarth = buildFabricSurface([
    createBody({ name: 'Sun', type: BodyType.STAR, mass: 1, visualMass: 1, radius: 0.12, position: Vec3.zero(), color: [255, 236, 180] }),
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 3e-6, visualMass: 3e-6, radius: 0.035, position: new Vec3(1, 0, 0), color: [80, 140, 255] }),
  ], {
    fabricSize: 4,
    fabricResolution: 5,
    fabricStrength: 0.22,
    fabricSoftening: 0.16,
    showWaves: false,
    heatmap: true,
  }, 0);

  const maxRed = (surface) => Math.max(...surface.colors.filter((_, index) => index % 4 === 0));
  assert.ok(maxRed(sunEarth) > maxRed(earthMoon) + 0.2);
});

test('default visual masses keep normalized planets cooler than stars', () => {
  const planetGrid = buildFabricGrid([
    createBody({ name: 'Equal Numeric Planet', type: BodyType.PLANET, mass: 1, radius: 0.05, position: Vec3.zero() }),
  ], {
    size: 2,
    resolution: 9,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });
  const starGrid = buildFabricGrid([
    createBody({ name: 'Equal Numeric Star', type: BodyType.STAR, mass: 1, radius: 0.05, position: Vec3.zero() }),
  ], {
    size: 2,
    resolution: 9,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });

  const maxRed = (grid) => Math.max(...grid.vertices.map((vertex) => vertex.color.r / 255));
  assert.ok(maxRed(starGrid) > 0.95);
  assert.ok(maxRed(planetGrid) < 0.35);
});

test('earth moon heatmap remains visible when blue base is hidden', () => {
  const surface = buildFabricSurface([
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.08, position: Vec3.zero(), color: [80, 140, 255] }),
    createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.025, position: new Vec3(1, 0, 0), color: [210, 210, 210] }),
  ], {
    fabricSize: 9,
    fabricResolution: 55,
    fabricStrength: 0.22,
    fabricSoftening: 0.16,
    heatmap: true,
    showWaves: false,
    hideHeatmapBase: true,
    heatmapReferenceDepth: 0.22 / 0.16,
  }, 0);
  const alphas = surface.colors.filter((_, index) => index % 4 === 3);

  assert.ok(Math.max(...alphas) > 0.65);
  assert.ok(alphas.filter((alpha) => alpha > 0.25).length > 24);
  assert.ok(maxAlphaNear(surface, new Vec3(1, 0, 0), 0.18) > 0.45);
});

test('earth moon heatmap gives the moon a local well instead of only earth spillover', () => {
  const grid = buildFabricGrid([
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.08, position: Vec3.zero(), color: [80, 140, 255] }),
    createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.025, position: new Vec3(1, 0, 0), color: [210, 210, 210] }),
  ], {
    size: 9,
    resolution: 55,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });

  const moon = nearestFabricVertex(grid, new Vec3(1, 0, 0));
  const besideMoon = nearestFabricVertex(grid, new Vec3(1, 0, 0.33));

  assert.ok(moon.heat > besideMoon.heat * 1.75);
});

test('earth moon heatmap exposes separate visible wells and a connecting field', () => {
  const grid = buildFabricGrid([
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.08, position: Vec3.zero(), color: [80, 140, 255] }),
    createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.025, position: new Vec3(1, 0, 0), color: [210, 210, 210] }),
  ], {
    size: 9,
    resolution: 55,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });

  const earth = nearestFabricVertex(grid, Vec3.zero());
  const moon = nearestFabricVertex(grid, new Vec3(1, 0, 0));
  const between = nearestFabricVertex(grid, new Vec3(0.5, 0, 0));

  assert.ok(earth.fieldVisibility > 0.62);
  assert.ok(moon.fieldVisibility > 0.48);
  assert.ok(between.fieldVisibility > 0.22);
  assert.ok(earth.massTier > moon.massTier + 0.2);
});

test('earth moon heatmap has side-view visible fabric wells', () => {
  const grid = buildFabricGrid([
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.08, position: Vec3.zero(), color: [80, 140, 255] }),
    createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.025, position: new Vec3(1, 0, 0), color: [210, 210, 210] }),
  ], {
    size: 9,
    resolution: 55,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });

  const earth = nearestFabricVertex(grid, Vec3.zero());
  const moon = nearestFabricVertex(grid, new Vec3(1, 0, 0));
  const between = nearestFabricVertex(grid, new Vec3(0.5, 0, 0));

  assert.ok(Math.abs(earth.y) > 0.32);
  assert.ok(Math.abs(moon.y) > 0.2);
  assert.ok(Math.abs(between.y) > 0.15);
  assert.ok(Math.abs(earth.y) > Math.abs(moon.y) * 1.15);
});

test('side view projects the moon sprite large enough for narrow displays', () => {
  const camera = cameraForView('side');
  const moon = createBody({
    name: 'Moon',
    type: BodyType.PARTICLE,
    mass: 0.0123,
    radius: 0.025,
    position: new Vec3(1, 0, 0),
    color: [210, 210, 210],
  });
  const depth = moon.position.sub(camera.position).dot(cameraForward(camera));
  const focalLength = (460 / 2) / Math.tan((camera.zoom * Math.PI / 180) / 2);
  const pixelRadius = (bodySpriteWorldSize(moon) / depth) * focalLength;

  assert.ok(pixelRadius > 4.5);
});

test('low mass heatmap wells remain bright enough on black space', () => {
  const grid = buildFabricGrid([
    createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.08, position: Vec3.zero(), color: [80, 140, 255] }),
    createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.025, position: new Vec3(1, 0, 0), color: [210, 210, 210] }),
  ], {
    size: 9,
    resolution: 55,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });

  const moon = nearestFabricVertex(grid, new Vec3(1, 0, 0));

  assert.ok(moon.color.b > 230);
  assert.ok(moon.color.g > 80);
});

test('moon sprite keeps a readable minimum world size', () => {
  const moon = createBody({
    name: 'Moon',
    type: BodyType.PARTICLE,
    mass: 0.0123,
    radius: 0.025,
    position: Vec3.zero(),
    color: [210, 210, 210],
  });

  assert.ok(bodySpriteWorldSize(moon) >= 0.07);
});

test('heatmap colors follow absolute fabric depth instead of body type', () => {
  const grid = buildFabricGrid([
    createBody({ name: 'Probe', type: BodyType.PARTICLE, mass: 0.0001, radius: 0.012, position: new Vec3(-1.25, 0, 0) }),
    createBody({ name: 'Planet', type: BodyType.PLANET, mass: 1, visualMass: 0.08, radius: 0.05, position: Vec3.zero() }),
    createBody({ name: 'Star', type: BodyType.STAR, mass: 1, radius: 0.1, position: new Vec3(1.25, 0, 0) }),
  ], {
    size: 4,
    resolution: 49,
    strength: 0.22,
    softening: 0.16,
    heatmap: true,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.22 / 0.16,
  });

  const probe = nearestFabricVertex(grid, new Vec3(-1.25, 0, 0));
  const planet = nearestFabricVertex(grid, Vec3.zero());
  const star = nearestFabricVertex(grid, new Vec3(1.25, 0, 0));

  assert.ok(Math.abs(probe.y) < Math.abs(planet.y));
  assert.ok(Math.abs(planet.y) < Math.abs(star.y));
  assert.ok(probe.color.b > probe.color.r + 120);
  assert.ok(planet.color.g > planet.color.b);
  assert.ok(star.color.r > star.color.b + 180);
});

test('strong preset heatmaps do not turn the whole fabric into an explosion sheet', () => {
  const preset = createPresets().find((candidate) => candidate.title === 'Pythagorean Chaos');
  const surface = buildFabricSurface(preset.bodies, {
    fabricSize: 9,
    fabricResolution: 55,
    fabricStrength: 0.22,
    fabricSoftening: 0.16,
    heatmap: true,
    showWaves: false,
    hideHeatmapBase: true,
    heatmapReferenceDepth: 0.22 / 0.16,
  }, 0);
  const alphas = surface.colors.filter((_, index) => index % 4 === 3);

  assert.ok(alphas.filter((alpha) => alpha > 0.6).length < alphas.length * 0.35);
  assert.ok(Math.min(...alphas) < 0.08);
});

test('planet-only choreography heatmaps keep transparent space between wells', () => {
  const preset = createPresets().find((candidate) => candidate.title === 'Figure Eight Three-Body');
  const surface = buildFabricSurface(preset.bodies, {
    fabricSize: 9,
    fabricResolution: 55,
    fabricStrength: 0.22,
    fabricSoftening: 0.16,
    heatmap: true,
    showWaves: false,
    hideHeatmapBase: true,
    heatmapReferenceDepth: 0.22 / 0.16,
  }, 0);
  const alphas = surface.colors.filter((_, index) => index % 4 === 3);

  assert.ok(alphas.filter((alpha) => alpha > 0.6).length < alphas.length * 0.45);
  assert.ok(Math.min(...alphas) < 0.08);
});

function maxAlphaNear(surface, position, radius) {
  let maxAlpha = 0;
  for (let i = 0; i < surface.positions.length; i += 3) {
    const dx = surface.positions[i] - position.x;
    const dz = surface.positions[i + 2] - position.z;
    if (Math.sqrt(dx * dx + dz * dz) <= radius) {
      maxAlpha = Math.max(maxAlpha, surface.colors[(i / 3) * 4 + 3]);
    }
  }
  return maxAlpha;
}

function nearestFabricVertex(grid, position) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const vertex of grid.vertices) {
    const dx = vertex.x - position.x;
    const dz = vertex.z - position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = vertex;
    }
  }
  return nearest;
}
