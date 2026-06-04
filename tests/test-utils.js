import assert from 'node:assert/strict';

globalThis.__tests = [];

export function test(name, fn) {
  try {
    fn();
    globalThis.__tests.push({ name, ok: true });
  } catch (error) {
    globalThis.__tests.push({ name, ok: false, error });
  }
}

export function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

export function vecApprox(actual, expected, tolerance = 1e-9) {
  approx(actual.x, expected.x, tolerance);
  approx(actual.y, expected.y, tolerance);
  approx(actual.z, expected.z, tolerance);
}

export { assert };
