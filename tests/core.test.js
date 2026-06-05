import { assert, approx, test, vecApprox } from './test-utils.js';
import { Vec3 } from '../src/core/math.js';
import {
  BodyType,
  createBody,
  SimulationState,
} from '../src/core/simulation.js';
import {
  UnitSystem,
  normalizedToSi,
  siToNormalized,
} from '../src/core/units.js';
import { buildFabricGrid, heatColorForDepth, rippleHeight } from '../src/core/fabric.js';
import { createPresets } from '../src/core/presets.js';

test('Vec3 supports immutable vector arithmetic', () => {
  const a = new Vec3(1, 2, 3);
  const b = new Vec3(4, -2, 0.5);

  vecApprox(a.add(b), new Vec3(5, 0, 3.5));
  vecApprox(a.sub(b), new Vec3(-3, 4, 2.5));
  vecApprox(a.scale(2), new Vec3(2, 4, 6));
  approx(a.length(), Math.sqrt(14));
  assert.equal(a.x, 1);
});

test('SI and normalized unit conversion round-trips body values', () => {
  const body = createBody({
    name: 'Earth',
    type: BodyType.PLANET,
    mass: 5.972e24,
    density: 5514,
    radius: 6.371e6,
    position: new Vec3(1.496e11, 0, 0),
    velocity: new Vec3(0, 29780, 0),
    unitSystem: UnitSystem.SI,
  });

  const normalized = siToNormalized(body);
  const restored = normalizedToSi(normalized);

  approx(restored.mass, body.mass, 1e10);
  approx(restored.radius, body.radius, 1e-2);
  vecApprox(restored.position, body.position, 1);
  vecApprox(restored.velocity, body.velocity, 1e-6);
});

test('visual mass is explicit so rendering can use physical type scales', () => {
  const implicit = createBody({
    name: 'Normalized Planet',
    type: BodyType.PLANET,
    mass: 1,
    radius: 0.1,
  });
  const explicit = createBody({
    name: 'Earth',
    type: BodyType.PLANET,
    mass: 1,
    visualMass: 3e-6,
    radius: 0.1,
  });

  assert.equal(implicit.visualMass, undefined);
  assert.equal(explicit.visualMass, 3e-6);
});

test('pairwise gravity produces equal and opposite accelerations', () => {
  const state = new SimulationState({
    gravitationalConstant: 1,
    softening: 0,
  });
  state.setBodies([
    createBody({ name: 'A', mass: 2, radius: 0.1, position: new Vec3(-1, 0, 0) }),
    createBody({ name: 'B', mass: 3, radius: 0.1, position: new Vec3(1, 0, 0) }),
  ]);

  const accelerations = state.computeAccelerations();
  const totalForce = accelerations[0]
    .scale(state.bodies[0].mass)
    .add(accelerations[1].scale(state.bodies[1].mass));

  vecApprox(totalForce, Vec3.zero(), 1e-12);
  assert.ok(accelerations[0].x > 0);
  assert.ok(accelerations[1].x < 0);
});

test('Velocity Verlet keeps a normalized circular orbit nearly stable', () => {
  const state = new SimulationState({
    gravitationalConstant: 1,
    softening: 1e-5,
    collisionEnabled: false,
    maxTrailPoints: 256,
  });
  state.setBodies([
    createBody({ name: 'Star', type: BodyType.STAR, mass: 1, radius: 0.05, position: Vec3.zero() }),
    createBody({
      name: 'Planet',
      type: BodyType.PLANET,
      mass: 1e-6,
      radius: 0.01,
      position: new Vec3(1, 0, 0),
      velocity: new Vec3(0, 1, 0),
    }),
  ]);

  for (let i = 0; i < 1000; i += 1) state.step(0.01);

  const distance = state.bodies[1].position.length();
  approx(distance, 1, 0.04);
  assert.ok(state.bodies[1].trail.length <= 256);
});

test('collisions merge bodies with conserved momentum and hierarchy type', () => {
  const state = new SimulationState({
    gravitationalConstant: 0,
    collisionEnabled: true,
  });
  state.setBodies([
    createBody({
      name: 'Planet',
      type: BodyType.PLANET,
      mass: 2,
      density: 5,
      radius: 1,
      position: new Vec3(0, 0, 0),
      velocity: new Vec3(1, 0, 0),
    }),
    createBody({
      name: 'Particle',
      type: BodyType.PARTICLE,
      mass: 1,
      density: 1,
      radius: 1,
      position: new Vec3(1, 0, 0),
      velocity: new Vec3(-1, 0, 0),
    }),
  ]);

  state.resolveCollisions();

  assert.equal(state.bodies.length, 1);
  assert.equal(state.bodies[0].type, BodyType.PLANET);
  approx(state.bodies[0].mass, 3);
  vecApprox(state.bodies[0].velocity, new Vec3(1 / 3, 0, 0));
  approx(state.bodies[0].radius, Math.cbrt((3 * 3) / (4 * Math.PI * 5)));
  assert.equal(state.flashes.length, 1);
});

test('open universe despawns bodies beyond the configured radius', () => {
  const state = new SimulationState({
    gravitationalConstant: 0,
    despawnDistance: 10,
  });
  state.setBodies([
    createBody({ name: 'Keeper', position: new Vec3(9, 0, 0), radius: 0.1 }),
    createBody({ name: 'Gone', position: new Vec3(11, 0, 0), radius: 0.1 }),
  ]);

  state.despawnFarBodies();

  assert.deepEqual(state.bodies.map((body) => body.name), ['Keeper']);
});

test('preset catalog includes required named scenarios with valid bodies', () => {
  const presets = createPresets();
  const titles = presets.map((preset) => preset.title);

  for (const title of [
    'Earth and Moon',
    'Sun and Earth',
    'Binary Stars',
    'Figure Eight Three-Body',
    'Lagrange Triangle',
    'Particle Slingshot',
  ]) {
    assert.ok(titles.includes(title), `missing preset ${title}`);
  }

  for (const preset of presets) {
    assert.ok(preset.classification.length > 0);
    assert.ok(preset.bodies.length >= 2);
    assert.ok(preset.bodies.every((body) => body.mass > 0 && body.radius > 0));
  }
});

test('solar and lunar presets use readable science-inspired spacing', () => {
  const presets = createPresets();
  const earthMoon = presets.find((preset) => preset.title === 'Earth and Moon').bodies;
  const sunEarth = presets.find((preset) => preset.title === 'Sun and Earth').bodies;
  const [earth, moon] = earthMoon;
  const [sun, solarEarth] = sunEarth;

  assert.ok(moon.position.sub(earth.position).length() > earth.radius * 30);
  assert.ok(sun.position.sub(solarEarth.position).length() > sun.radius * 18);
  assert.ok(sun.radius > solarEarth.radius * 3);
  assert.ok(earth.radius > moon.radius * 2.5);
});

test('fabric superposes wells and heatmap moves from cool to hot with depth', () => {
  const bodies = [
    createBody({ name: 'A', type: BodyType.STAR, mass: 1, position: new Vec3(-1, 0, 0), radius: 0.1 }),
    createBody({ name: 'B', type: BodyType.STAR, mass: 1, position: new Vec3(1, 0, 0), radius: 0.1 }),
  ];

  const grid = buildFabricGrid(bodies, {
    size: 4,
    resolution: 5,
    strength: 1,
    softening: 0.1,
    heatmap: false,
    time: 0,
    wavesEnabled: false,
  });
  const center = grid.vertices.find((vertex) => Math.abs(vertex.x) < 1e-9 && Math.abs(vertex.z) < 1e-9);

  assert.ok(center.y < -1.8);
  assert.ok(heatColorForDepth(0.1, 3).b > heatColorForDepth(0.1, 3).r);
  assert.ok(heatColorForDepth(3, 3).r > heatColorForDepth(3, 3).b);
});

test('fabric heatmap depth uses constructive superposition', () => {
  const settings = {
    size: 4,
    resolution: 17,
    strength: 0.22,
    softening: 0.12,
    heatmap: true,
    time: 0,
    wavesEnabled: false,
    heatmapReferenceDepth: 1.35,
  };
  const single = buildFabricGrid([
    createBody({ name: 'A', type: BodyType.STAR, mass: 1, position: new Vec3(-0.5, 0, 0), radius: 0.08 }),
  ], settings);
  const paired = buildFabricGrid([
    createBody({ name: 'A', type: BodyType.STAR, mass: 1, position: new Vec3(-0.5, 0, 0), radius: 0.08 }),
    createBody({ name: 'B', type: BodyType.STAR, mass: 1, position: new Vec3(0.5, 0, 0), radius: 0.08 }),
  ], settings);
  const singleCenter = nearestFabricVertex(single, Vec3.zero());
  const pairedCenter = nearestFabricVertex(paired, Vec3.zero());

  assert.ok(pairedCenter.depth > singleCenter.depth * 1.8);
  assert.ok(pairedCenter.color.r > singleCenter.color.r);
  assert.ok(pairedCenter.color.b < singleCenter.color.b);
});

test('strong-system fabric display follows additive potential without visibility humps', () => {
  const preset = createPresets().find((candidate) => candidate.title === 'Sun and Earth');
  const grid = buildFabricGrid(preset.bodies, {
    size: 14,
    resolution: 145,
    strength: 0.22,
    softening: 0.2,
    heatmap: true,
    time: 0,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.9,
  });
  const earth = nearestFabricVertex(grid, new Vec3(3.2, 0, 0));
  const shoulder = nearestFabricVertex(grid, new Vec3(2.8, 0, 0));

  approx(earth.displayDepth, earth.depth, 1e-12);
  approx(shoulder.displayDepth, shoulder.depth, 1e-12);
});

test('sun earth heatmap has two downward wells with sun dominant', () => {
  const preset = createPresets().find((candidate) => candidate.title === 'Sun and Earth');
  const grid = buildFabricGrid(preset.bodies, {
    size: 14,
    resolution: 145,
    strength: 0.22,
    softening: 0.2,
    heatmap: true,
    time: 0,
    wavesEnabled: false,
    heatmapReferenceDepth: 0.9,
  });
  const sun = nearestFabricVertex(grid, Vec3.zero());
  const earth = nearestFabricVertex(grid, new Vec3(3.2, 0, 0));
  const innerShoulder = nearestFabricVertex(grid, new Vec3(2.7, 0, 0));
  const outerShoulder = nearestFabricVertex(grid, new Vec3(3.7, 0, 0));

  assert.ok(earth.displayDepth > innerShoulder.displayDepth * 1.4);
  assert.ok(earth.displayDepth > outerShoulder.displayDepth * 1.4);
  assert.ok(sun.displayDepth > earth.displayDepth * 2.8);
  assert.ok(sun.color.r > earth.color.r);
  assert.ok(earth.color.b > sun.color.b);
});

test('heatmap color ramp maps fixed height levels from cold top to warm bottom', () => {
  const top = heatColorForDepth(0, 1.35);
  const middle = heatColorForDepth(0.68, 1.35);
  const bottom = heatColorForDepth(1.35, 1.35);

  assert.ok(top.b > top.r + 120);
  assert.ok(middle.g > middle.b);
  assert.ok(bottom.r > bottom.b + 180);
});

test('visual gravitational ripple decays with distance', () => {
  const near = Math.abs(rippleHeight(1, 0, 4, 1));
  const far = Math.abs(rippleHeight(8, 0, 4, 1));

  assert.ok(near > far);
});

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
