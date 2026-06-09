import { Vec3 } from './math.js';
import { BodyType, createBody } from './simulation.js';

const SolarSpinAxis = tiltedAxis(7.25);
const EarthSpinAxis = tiltedAxis(23.44);
const MoonSpinAxis = tiltedAxis(1.54);

export function createPresets() {
  return [
    {
      title: 'Earth and Moon',
      classification: 'stable planet-moon orbit',
      bodies: [
        createBody({ name: 'Earth', type: BodyType.PLANET, mass: 1, visualMass: 3e-6, radius: 0.06, density: 5, position: Vec3.zero(), velocity: new Vec3(0, -0.004, 0), spinRate: 8.1, spinAxis: EarthSpinAxis, color: [80, 140, 255] }),
        createBody({ name: 'Moon', type: BodyType.PARTICLE, mass: 0.0123, visualMass: 3.7e-8, radius: 0.018, density: 3.3, position: new Vec3(2.25, 0, 0), velocity: new Vec3(0, 0, 0.67), spinRate: 0.67 / 2.25, spinAxis: MoonSpinAxis, tidallyLockedTo: 'Earth', color: [210, 210, 210] }),
      ],
    },
    {
      title: 'Sun and Earth',
      classification: 'near circular two-body ellipse',
      bodies: [
        createBody({ name: 'Sun', type: BodyType.STAR, mass: 1, visualMass: 1, radius: 0.16, density: 1.4, position: Vec3.zero(), velocity: new Vec3(0, 0, -3e-6 * 0.56), spinRate: (0.56 / 3.2) * (365.256 / 25.38), spinAxis: SolarSpinAxis, color: [255, 236, 180] }),
        createBody({ name: 'Earth', type: BodyType.PLANET, mass: 3e-6, visualMass: 0.022, radius: 0.014, density: 5.5, position: new Vec3(3.2, 0, 0), velocity: new Vec3(0, 0, 0.56), spinRate: (0.56 / 3.2) * 365.256, spinAxis: EarthSpinAxis, color: [80, 140, 255] }),
      ],
    },
    {
      title: 'Binary Stars',
      classification: 'fast glowing binary with visible ripples',
      bodies: [
        createBody({ name: 'Astra', type: BodyType.STAR, mass: 1, radius: 0.09, position: new Vec3(-0.6, 0, 0), velocity: new Vec3(0, 0, -0.65), color: [255, 220, 150] }),
        createBody({ name: 'Boreal', type: BodyType.STAR, mass: 1, radius: 0.09, position: new Vec3(0.6, 0, 0), velocity: new Vec3(0, 0, 0.65), color: [170, 210, 255] }),
      ],
    },
    {
      title: 'Figure Eight Three-Body',
      classification: 'choreographic stable three-body orbit',
      bodies: [
        createBody({ name: 'One', type: BodyType.PLANET, mass: 1, radius: 0.045, position: new Vec3(-0.97000436, 0, 0.24308753), velocity: new Vec3(0.466203685, 0, 0.43236573), color: [255, 120, 120] }),
        createBody({ name: 'Two', type: BodyType.PLANET, mass: 1, radius: 0.045, position: new Vec3(0.97000436, 0, -0.24308753), velocity: new Vec3(0.466203685, 0, 0.43236573), color: [120, 180, 255] }),
        createBody({ name: 'Three', type: BodyType.PLANET, mass: 1, radius: 0.045, position: Vec3.zero(), velocity: new Vec3(-0.93240737, 0, -0.86473146), color: [180, 255, 150] }),
      ],
    },
    {
      title: 'Lagrange Triangle',
      classification: 'stable equal-mass rotating triangle',
      bodies: rotatingTriangle(0.82, 1),
    },
    {
      title: 'Pythagorean Chaos',
      classification: 'chaotic three-star close-encounter system',
      bodies: [
        createBody({ name: 'Pythagoras 3', type: BodyType.STAR, mass: 3, visualMass: 0.75, radius: 0.018, position: new Vec3(1, 0, 0), velocity: Vec3.zero(), color: [255, 224, 170] }),
        createBody({ name: 'Pythagoras 4', type: BodyType.STAR, mass: 4, visualMass: 1, radius: 0.021, position: new Vec3(-2, 0, 0), velocity: Vec3.zero(), color: [255, 242, 205] }),
        createBody({ name: 'Pythagoras 5', type: BodyType.STAR, mass: 5, visualMass: 1.25, radius: 0.024, position: new Vec3(1, 0, 3), velocity: Vec3.zero(), color: [255, 205, 150] }),
      ],
    },
    {
      title: 'Exchange Orbit',
      classification: 'binary exchange encounter',
      bodies: [
        createBody({ name: 'Primary', type: BodyType.STAR, mass: 1.2, radius: 0.1, position: new Vec3(-0.35, 0, 0), velocity: new Vec3(0, 0, -0.45) }),
        createBody({ name: 'Companion', type: BodyType.PLANET, mass: 0.08, radius: 0.045, position: new Vec3(0.65, 0, 0), velocity: new Vec3(0, 0, 1.05), color: [140, 180, 255] }),
        createBody({ name: 'Visitor', type: BodyType.PLANET, mass: 0.12, radius: 0.05, position: new Vec3(-3, 0, -1.2), velocity: new Vec3(1.2, 0, 0.38), color: [255, 160, 120] }),
      ],
    },
    {
      title: 'Temporary Capture',
      classification: 'planet temporarily captures a passing particle',
      bodies: [
        createBody({ name: 'Star', type: BodyType.STAR, mass: 1, radius: 0.11, position: Vec3.zero(), velocity: Vec3.zero() }),
        createBody({ name: 'Planet', type: BodyType.PLANET, mass: 0.02, radius: 0.055, position: new Vec3(1.1, 0, 0), velocity: new Vec3(0, 0, 0.95), color: [90, 160, 255] }),
        createBody({ name: 'Probe', type: BodyType.PARTICLE, mass: 0.0002, radius: 0.014, position: new Vec3(1.6, 0, -0.3), velocity: new Vec3(-0.2, 0, 1.25), color: [240, 240, 240] }),
      ],
    },
    {
      title: 'Near Ejection Boundary',
      classification: 'system near the stability/ejection boundary',
      bodies: [
        createBody({ name: 'Star', type: BodyType.STAR, mass: 1, radius: 0.1, position: Vec3.zero(), velocity: Vec3.zero() }),
        createBody({ name: 'Inner', type: BodyType.PLANET, mass: 0.001, radius: 0.025, position: new Vec3(0.75, 0, 0), velocity: new Vec3(0, 0, 1.16), color: [120, 210, 255] }),
        createBody({ name: 'Outer', type: BodyType.PLANET, mass: 0.002, radius: 0.03, position: new Vec3(1.55, 0, 0), velocity: new Vec3(0, 0, 0.76), color: [255, 190, 120] }),
        createBody({ name: 'Perturber', type: BodyType.PLANET, mass: 0.0015, radius: 0.028, position: new Vec3(-1.8, 0, 0.2), velocity: new Vec3(0.1, 0, -0.72), color: [200, 140, 255] }),
      ],
    },
    {
      title: 'Particle Slingshot',
      classification: 'hyperbolic flyby and gravitational assist trails',
      bodies: [
        createBody({ name: 'Star', type: BodyType.STAR, mass: 1.2, radius: 0.11, position: Vec3.zero(), velocity: Vec3.zero() }),
        createBody({ name: 'Fast Particle', type: BodyType.PARTICLE, mass: 0.0001, radius: 0.012, position: new Vec3(-3, 0, -0.65), velocity: new Vec3(1.35, 0, 0.22), color: [255, 255, 255] }),
      ],
    },
    {
      title: 'Aesthetic Rosette',
      classification: 'aesthetically pleasing multi-orbit trail pattern',
      bodies: [
        createBody({ name: 'Glow Core', type: BodyType.STAR, mass: 1.4, radius: 0.12, position: Vec3.zero(), velocity: Vec3.zero(), color: [255, 230, 170] }),
        ...[0.72, 1.04, 1.38, 1.82].map((radius, index) => createBody({
          name: `Tracer ${index + 1}`,
          type: index === 0 ? BodyType.PLANET : BodyType.PARTICLE,
          mass: index === 0 ? 0.002 : 0.0001,
          radius: index === 0 ? 0.028 : 0.011,
          position: new Vec3(radius, 0, 0),
          velocity: new Vec3(0, 0, Math.sqrt(1.4 / radius) * (1 + index * 0.015)),
          color: [[80, 180, 255], [255, 140, 90], [160, 255, 140], [230, 170, 255]][index],
        })),
      ],
    },
  ];
}

function rotatingTriangle(radius, mass) {
  const angularSpeed = Math.sqrt((3 * mass) / (Math.sqrt(3) * radius) ** 3);
  return [0, 1, 2].map((index) => {
    const angle = index * (Math.PI * 2 / 3);
    const position = new Vec3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const tangent = new Vec3(-Math.sin(angle), 0, Math.cos(angle));
    return createBody({
      name: `L${index + 1}`,
      type: BodyType.PLANET,
      mass,
      radius: 0.05,
      position,
      velocity: tangent.scale(angularSpeed * radius),
      color: [[255, 120, 120], [120, 180, 255], [180, 255, 150]][index],
    });
  });
}

function tiltedAxis(degrees) {
  const radians = degrees * Math.PI / 180;
  return new Vec3(Math.sin(radians), Math.cos(radians), 0).normalized();
}
