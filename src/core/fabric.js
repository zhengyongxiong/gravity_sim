import { BodyType } from './simulation.js';

const VisualMassScale = {
  [BodyType.STAR]: 1,
  [BodyType.NEUTRON_STAR]: 1.4,
  [BodyType.WHITE_DWARF]: 0.8,
  [BodyType.PLANET]: 0.00012,
  [BodyType.PARTICLE]: 0.00000003,
};

export function buildFabricGrid(bodies, settings) {
  const {
    size = 12,
    resolution = 50,
    strength = 0.2,
    softening = 0.15,
    heatmap = false,
    time = 0,
    wavesEnabled = false,
    heatmapReferenceDepth = strength / softening,
    heatmapExposure = 500000,
  } = settings ?? {};
  const vertices = [];
  const step = size / Math.max(1, resolution - 1);
  const half = size / 2;
  const maxDepth = heatmapReferenceDepth;
  const bodyFields = bodies.map((body) => createBodyField(body, step, softening));
  const maxVisualMass = bodyFields.reduce((max, field) => Math.max(max, field.mass), 0);
  const effectiveExposure = maxVisualMass > 0.01 ? Math.min(heatmapExposure, 20) : heatmapExposure;
  let minHeat = Infinity;
  let maxHeat = 0;
  let maxRawDepth = 0;
  let maxDisplayDepth = 0;

  for (let row = 0; row < resolution; row += 1) {
    const z = -half + row * step;
    for (let column = 0; column < resolution; column += 1) {
      const x = -half + column * step;
      const field = sampleFabricField(x, z, bodyFields, { strength, time, wavesEnabled });
      const depth = field.depth;
      maxRawDepth = Math.max(maxRawDepth, depth);
      const heatValue = heatmapIntensity(depth, maxDepth, effectiveExposure);
      minHeat = Math.min(minHeat, heatValue);
      maxHeat = Math.max(maxHeat, heatValue);
      vertices.push({
        x,
        y: -depth,
        z,
        depth,
        heat: heatValue,
        linearHeat: clamp(depth / Math.max(maxDepth, 1e-9), 0, 1),
        massTier: field.massTier,
        localVisibility: field.localVisibility,
        color: { r: 115, g: 122, b: 130 },
      });
    }
  }

  const heatRange = Math.max(1e-9, maxHeat - minHeat);
  for (const vertex of vertices) {
    vertex.sceneHeat = clamp((vertex.heat - minHeat) / heatRange, 0, 1);
    const bridgeVisibility = smoothstep(0.04, 0.34, vertex.sceneHeat) * (maxVisualMass > 0.01 ? 0.38 : 0.34);
    vertex.fieldVisibility = clamp(Math.max(vertex.localVisibility, bridgeVisibility), 0, 1);
    vertex.displayDepth = visualDisplayDepth(vertex, maxVisualMass, maxRawDepth);
    maxDisplayDepth = Math.max(maxDisplayDepth, vertex.displayDepth);
    vertex.y = -vertex.displayDepth;
    if (heatmap) vertex.color = heatColorForDepth(heatmapColorDepth(vertex, maxVisualMass), maxDepth);
  }

  return { vertices, resolution, size, maxDepth, maxVisualMass, maxRawDepth, maxDisplayDepth, minHeat, maxHeat };
}

export function fabricDepthAt(x, z, bodies, settings = {}) {
  const strength = settings.strength ?? 0.2;
  const softening = settings.softening ?? 0.15;
  const fields = bodies.map((body) => createBodyField(body, softening, softening));

  return sampleFabricField(x, z, fields, {
    strength,
    time: settings.time ?? 0,
    wavesEnabled: settings.wavesEnabled,
  }).depth;
}

function sampleFabricField(x, z, bodyFields, settings) {
  let depth = 0;
  let dominantVisibility = -1;
  let massTier = 0;
  let localVisibility = 0;

  for (const field of bodyFields) {
    const body = field.body;
    const dx = x - body.position.x;
    const dz = z - body.position.z;
    const distanceSquared = dx * dx + dz * dz;
    const distance = Math.sqrt(distanceSquared + field.softening * field.softening);
    depth += (field.mass * settings.strength) / distance;

    const visibility = bodyFieldVisibility(field, distanceSquared);
    localVisibility = Math.max(localVisibility, visibility);
    if (visibility > dominantVisibility) {
      dominantVisibility = visibility;
      massTier = field.massTier;
    }

    if (settings.wavesEnabled && body.glow) {
      depth += rippleHeight(distance, settings.time ?? 0, body.mass, settings.strength);
    }
  }

  return { depth, massTier, localVisibility };
}

export function visualGravityMass(body) {
  if (Number.isFinite(body.visualMass)) return Math.max(0, body.visualMass);
  const scale = VisualMassScale[body.type] ?? VisualMassScale[BodyType.PARTICLE];
  return Math.max(0, body.mass * scale);
}

export function massHeatTier(mass) {
  return clamp((Math.log10(Math.max(mass, 1e-12)) + 8) / 8, 0, 1);
}

function createBodyField(body, step, softening) {
  const mass = visualGravityMass(body);
  const massTier = massHeatTier(mass);
  return {
    body,
    mass,
    massTier,
    softening: visualSofteningForBody(body, softening),
    visibilityRadius: visualWellRadiusForBody(body, step, softening, massTier),
  };
}

function visualSofteningForBody(body, softening) {
  const radius = Number.isFinite(body.radius) ? body.radius : 0;
  if (body.glow || body.type === BodyType.STAR || body.type === BodyType.NEUTRON_STAR || body.type === BodyType.WHITE_DWARF) {
    return Math.min(softening, Math.max(radius, softening * 0.12));
  }
  if (body.type === BodyType.PLANET) {
    return Math.min(softening, Math.max(radius * 1.45, softening * 0.08));
  }
  return Math.min(softening, Math.max(radius * 0.45, softening * 0.03));
}

function visualWellRadiusForBody(body, step, softening, massTier) {
  const radius = Number.isFinite(body.radius) ? body.radius : 0;
  const radiusFromGrid = step * (1.2 + 3.7 * Math.sqrt(massTier));
  const radiusFromBody = radius * (body.glow ? 4.5 : 8);
  const cap = softening * (body.glow ? 5.2 : 4.4);
  return Math.min(cap, Math.max(step * 1.35, radiusFromGrid, radiusFromBody));
}

function bodyFieldVisibility(field, distanceSquared) {
  const radiusSquared = Math.max(field.visibilityRadius * field.visibilityRadius, 1e-9);
  const radial = Math.exp(-distanceSquared / (2 * radiusSquared));
  const massWeight = 0.55 + 0.4 * Math.sqrt(field.massTier);
  return radial * massWeight;
}

function visualDisplayDepth(vertex, maxVisualMass, maxRawDepth) {
  const rawDepth = Math.max(0, vertex.depth ?? 0);
  const weakSystem = maxVisualMass <= 0.01;

  if (!weakSystem) return Math.min(2.4, rawDepth);

  const relativeDepth = rawDepth / Math.max(maxRawDepth, 1e-12);
  return Math.min(0.8, Math.pow(relativeDepth, 0.42) * 0.72);
}

function heatmapColorDepth(vertex, maxVisualMass) {
  return maxVisualMass <= 0.01
    ? Math.max(0, vertex.displayDepth ?? 0) * 0.55
    : Math.max(0, vertex.displayDepth ?? 0);
}

export function heatmapIntensity(depth, maxDepth, exposure = 1) {
  const scaledDepth = Math.max(0, depth) * exposure;
  const scaledMax = Math.max(maxDepth, 1e-9) * exposure;
  return clamp(Math.log1p(scaledDepth) / Math.log1p(scaledMax), 0, 1);
}

export function heatColorForMassTier(tier, intensity = 1) {
  const t = clamp(tier, 0, 1);
  const brightness = 0.92 + 0.08 * clamp(intensity * 1.35, 0, 1);
  let color;
  if (t < 0.24) {
    const local = t / 0.24;
    color = {
      r: 0,
      g: Math.round(92 + 118 * local),
      b: 255,
    };
  } else if (t < 0.52) {
    const local = (t - 0.24) / 0.28;
    color = {
      r: Math.round(0 + 42 * local),
      g: Math.round(150 + 95 * local),
      b: Math.round(255 - 105 * local),
    };
  } else if (t < 0.78) {
    const local = (t - 0.52) / 0.26;
    color = {
      r: Math.round(42 + 210 * local),
      g: Math.round(245 - 15 * local),
      b: Math.round(150 - 125 * local),
    };
  } else {
    const local = (t - 0.78) / 0.22;
    color = {
      r: 255,
      g: Math.round(210 - 168 * local),
      b: Math.round(25 - 25 * local),
    };
  }
  return {
    r: Math.round(color.r * brightness),
    g: Math.round(color.g * brightness),
    b: Math.round(color.b * brightness),
  };
}

export function heatColorForDepth(depth, maxDepth, exposure = 1) {
  const normalizedDepth = (Math.max(0, depth) / Math.max(maxDepth, 1e-9)) * Math.max(1, exposure);
  return heatColorForLevel(clamp(normalizedDepth, 0, 1));
}

function heatColorForLevel(level) {
  const t = clamp(level, 0, 1);
  if (t < 0.18) {
    const local = t / 0.18;
    return {
      r: Math.round(8 + 6 * local),
      g: Math.round(34 + 96 * local),
      b: 255,
    };
  }
  if (t < 0.38) {
    const local = (t - 0.18) / 0.2;
    return {
      r: Math.round(14 + 18 * local),
      g: Math.round(130 + 102 * local),
      b: Math.round(255 - 165 * local),
    };
  }
  if (t < 0.62) {
    const local = (t - 0.38) / 0.24;
    return {
      r: Math.round(32 + 216 * local),
      g: Math.round(232 + 16 * local),
      b: Math.round(120 - 112 * local),
    };
  }
  if (t < 0.82) {
    const local = (t - 0.62) / 0.2;
    return {
      r: 255,
      g: Math.round(248 - 108 * local),
      b: 8,
    };
  }
  const local = (t - 0.82) / 0.18;
  return {
    r: 255,
    g: Math.round(140 - 122 * local),
    b: Math.round(8 - 8 * local),
  };
}

export function rippleHeight(distance, time, mass, strength) {
  const waveSpeed = 2.5;
  const wavelength = 1.15;
  const phase = distance * wavelength * Math.PI * 2 - time * waveSpeed * Math.PI * 2;
  const amplitude = strength * Math.min(1, mass) * 0.12;
  return (Math.sin(phase) * amplitude) / (1 + distance * distance * 0.35);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
