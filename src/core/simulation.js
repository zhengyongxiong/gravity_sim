import { Vec3 } from './math.js';
import { UnitSystem, siToNormalized } from './units.js';

export const BodyType = {
  STAR: 'star',
  PLANET: 'planet',
  PARTICLE: 'particle',
  NEUTRON_STAR: 'neutron_star',
  WHITE_DWARF: 'white_dwarf',
};

export const BodyTypeDefaults = {
  [BodyType.STAR]: {
    density: 1,
    color: [255, 244, 214],
    glow: true,
    hierarchy: 4,
  },
  [BodyType.NEUTRON_STAR]: {
    density: 12,
    color: [170, 210, 255],
    glow: true,
    hierarchy: 5,
  },
  [BodyType.WHITE_DWARF]: {
    density: 6,
    color: [210, 230, 255],
    glow: true,
    hierarchy: 4,
  },
  [BodyType.PLANET]: {
    density: 5,
    color: [90, 150, 255],
    glow: false,
    hierarchy: 2,
  },
  [BodyType.PARTICLE]: {
    density: 1,
    color: [230, 230, 230],
    glow: false,
    hierarchy: 1,
  },
};

let nextBodyId = 1;

export function radiusFromMassDensity(mass, density) {
  return Math.cbrt((3 * mass) / (4 * Math.PI * density));
}

export function createBody(options = {}) {
  const type = options.type ?? BodyType.PARTICLE;
  const defaults = BodyTypeDefaults[type] ?? BodyTypeDefaults[BodyType.PARTICLE];
  const mass = options.mass ?? 1;
  const density = options.density ?? defaults.density;
  const radius = options.radius ?? radiusFromMassDensity(mass, density);
  const body = {
    id: options.id ?? nextBodyId++,
    name: options.name ?? type,
    type,
    mass,
    visualMass: options.visualMass ?? (options.unitSystem === UnitSystem.SI ? mass : undefined),
    density,
    radius,
    position: Vec3.from(options.position),
    velocity: Vec3.from(options.velocity),
    acceleration: Vec3.from(options.acceleration),
    color: options.color ?? defaults.color,
    glow: options.glow ?? defaults.glow,
    trail: options.trail ? options.trail.map(Vec3.from) : [],
    selected: options.selected ?? false,
    unitSystem: options.unitSystem ?? UnitSystem.NORMALIZED,
  };

  if (body.unitSystem === UnitSystem.SI) return siToNormalized(body);
  return body;
}

export class SimulationState {
  constructor(config = {}) {
    this.config = {
      gravitationalConstant: config.gravitationalConstant ?? 1,
      softening: config.softening ?? 0.02,
      collisionEnabled: config.collisionEnabled ?? true,
      despawnDistance: config.despawnDistance ?? 1000,
      maxTrailPoints: config.maxTrailPoints ?? 800,
    };
    this.bodies = [];
    this.flashes = [];
    this.time = 0;
  }

  setBodies(bodies) {
    this.bodies = bodies.map((body) => createBody(body));
    this.bodies.forEach((body) => {
      body.acceleration = Vec3.zero();
      body.trail = body.trail ?? [];
    });
  }

  computeAccelerations(bodies = this.bodies) {
    const accelerations = bodies.map(() => Vec3.zero());
    const g = this.config.gravitationalConstant;
    const softeningSquared = this.config.softening ** 2;

    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const delta = bodies[j].position.sub(bodies[i].position);
        const distanceSquared = delta.lengthSquared() + softeningSquared;
        if (distanceSquared === 0) continue;
        const inverseDistance = 1 / Math.sqrt(distanceSquared);
        const inverseDistanceCubed = inverseDistance ** 3;
        const scaled = delta.scale(g * inverseDistanceCubed);
        accelerations[i] = accelerations[i].add(scaled.scale(bodies[j].mass));
        accelerations[j] = accelerations[j].sub(scaled.scale(bodies[i].mass));
      }
    }

    return accelerations;
  }

  step(dt) {
    if (dt <= 0) return;
    const previousAccelerations = this.computeAccelerations();

    this.bodies = this.bodies.map((body, index) => {
      const position = body.position
        .add(body.velocity.scale(dt))
        .add(previousAccelerations[index].scale(0.5 * dt * dt));
      return { ...body, position };
    });

    const nextAccelerations = this.computeAccelerations();
    this.bodies = this.bodies.map((body, index) => {
      const velocity = body.velocity.add(
        previousAccelerations[index].add(nextAccelerations[index]).scale(0.5 * dt),
      );
      const trail = [...body.trail, body.position];
      while (trail.length > this.config.maxTrailPoints) trail.shift();
      return { ...body, velocity, acceleration: nextAccelerations[index], trail };
    });

    if (this.config.collisionEnabled) this.resolveCollisions();
    this.despawnFarBodies();
    this.updateFlashes(dt);
    this.time += dt;
  }

  resolveCollisions() {
    let changed = true;
    while (changed) {
      changed = false;
      outer:
      for (let i = 0; i < this.bodies.length; i += 1) {
        for (let j = i + 1; j < this.bodies.length; j += 1) {
          const a = this.bodies[i];
          const b = this.bodies[j];
          if (a.position.distanceTo(b.position) < a.radius + b.radius) {
            const merged = mergeBodies(a, b);
            this.flashes.push(createCollisionFlash(a, b, merged));
            this.bodies.splice(j, 1);
            this.bodies.splice(i, 1, merged);
            changed = true;
            break outer;
          }
        }
      }
    }
  }

  despawnFarBodies() {
    const limit = this.config.despawnDistance;
    this.bodies = this.bodies.filter((body) => body.position.length() <= limit);
  }

  updateFlashes(dt) {
    this.flashes = this.flashes
      .map((flash) => ({ ...flash, age: flash.age + dt }))
      .filter((flash) => flash.age < flash.duration);
  }
}

export function mergeBodies(a, b) {
  const primary = choosePrimaryType(a, b);
  const mass = a.mass + b.mass;
  const density = BodyTypeDefaults[primary].hierarchy >= BodyTypeDefaults[a.type].hierarchy
    ? (primary === a.type ? a.density : b.density)
    : BodyTypeDefaults[primary].density;
  const momentum = a.velocity.scale(a.mass).add(b.velocity.scale(b.mass));
  const position = a.position.scale(a.mass).add(b.position.scale(b.mass)).scale(1 / mass);
  const trail = [...a.trail, ...b.trail].slice(-Math.max(a.trail.length, b.trail.length, 1));

  return createBody({
    name: `${a.name}+${b.name}`,
    type: primary,
    mass,
    density,
    radius: radiusFromMassDensity(mass, density),
    position,
    velocity: momentum.scale(1 / mass),
    trail,
  });
}

function choosePrimaryType(a, b) {
  const aRank = BodyTypeDefaults[a.type]?.hierarchy ?? 0;
  const bRank = BodyTypeDefaults[b.type]?.hierarchy ?? 0;
  return aRank >= bRank ? a.type : b.type;
}

function kineticEnergy(body) {
  return 0.5 * body.mass * body.velocity.lengthSquared();
}

function createCollisionFlash(a, b, merged) {
  const lostEnergy = Math.max(0, kineticEnergy(a) + kineticEnergy(b) - kineticEnergy(merged));
  return {
    position: merged.position,
    energy: lostEnergy,
    radius: Math.max(a.radius, b.radius) * (1.8 + Math.min(4, lostEnergy)),
    age: 0,
    duration: 0.65,
  };
}
