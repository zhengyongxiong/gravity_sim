export const UnitSystem = {
  NORMALIZED: 'normalized',
  SI: 'si',
};

export const UnitScale = {
  mass: 1.98847e30,
  distance: 1.495978707e11,
  time: 5.02264235e6,
};

UnitScale.velocity = UnitScale.distance / UnitScale.time;
UnitScale.density = UnitScale.mass / UnitScale.distance ** 3;

function convertVec3(vector, divisor) {
  return vector.scale(1 / divisor);
}

function restoreVec3(vector, multiplier) {
  return vector.scale(multiplier);
}

export function siToNormalized(body) {
  return {
    ...body,
    mass: body.mass / UnitScale.mass,
    visualMass: Number.isFinite(body.visualMass) ? body.visualMass / UnitScale.mass : body.visualMass,
    density: body.density / UnitScale.density,
    radius: body.radius / UnitScale.distance,
    position: convertVec3(body.position, UnitScale.distance),
    velocity: convertVec3(body.velocity, UnitScale.velocity),
    unitSystem: UnitSystem.NORMALIZED,
  };
}

export function normalizedToSi(body) {
  return {
    ...body,
    mass: body.mass * UnitScale.mass,
    visualMass: Number.isFinite(body.visualMass) ? body.visualMass * UnitScale.mass : body.visualMass,
    density: body.density * UnitScale.density,
    radius: body.radius * UnitScale.distance,
    position: restoreVec3(body.position, UnitScale.distance),
    velocity: restoreVec3(body.velocity, UnitScale.velocity),
    unitSystem: UnitSystem.SI,
  };
}
