import { Vec3 } from '../core/math.js';

export const CameraView = {
  SIDE: 'side',
  UPWARD: 'upward',
  TOP: 'top',
};

export function createCamera(options = {}) {
  return {
    position: Vec3.from(options.position ?? new Vec3(1.15, 1.05, 7.3)),
    yaw: options.yaw ?? 0,
    pitch: options.pitch ?? -0.12,
    speed: options.speed ?? 3.5,
    sensitivity: options.sensitivity ?? 0.0025,
    zoom: options.zoom ?? 45,
  };
}

export function cameraForView(view) {
  if (view === CameraView.UPWARD || view === 'upward') {
    return createCamera({
      position: new Vec3(0, -2.4, 7.2),
      yaw: 0,
      pitch: 0.26,
      zoom: 55,
    });
  }
  if (view === CameraView.TOP || view === 'top') {
    return createCamera({
      position: new Vec3(0, 8.8, 0.01),
      yaw: 0,
      pitch: -Math.PI / 2 + 0.03,
      zoom: 52,
    });
  }
  return createCamera({
    position: new Vec3(1.15, 1.05, 7.3),
    yaw: 0,
    pitch: -0.12,
    zoom: 45,
  });
}

export function cameraForward(camera) {
  const cp = Math.cos(camera.pitch);
  return new Vec3(
    Math.sin(camera.yaw) * cp,
    Math.sin(camera.pitch),
    -Math.cos(camera.yaw) * cp,
  ).normalized();
}

export function cameraRight(camera) {
  const forward = cameraForward({ ...camera, pitch: 0 });
  return new Vec3(forward.z * -1, 0, forward.x).normalized();
}

export function moveCamera(camera, intent, dt) {
  const forward = cameraForward({ ...camera, pitch: 0 });
  const right = cameraRight(camera);
  const up = new Vec3(0, 1, 0);
  const velocity = forward
    .scale(intent.forward ?? 0)
    .add(right.scale(intent.right ?? 0))
    .add(up.scale(intent.up ?? 0));

  return {
    ...camera,
    position: camera.position.add(velocity.scale(camera.speed * dt)),
  };
}

export function rotateCamera(camera, deltaX, deltaY) {
  const pitch = clamp(
    camera.pitch - deltaY * camera.sensitivity,
    -Math.PI / 2 + 0.02,
    Math.PI / 2 - 0.02,
  );
  return {
    ...camera,
    yaw: camera.yaw + deltaX * camera.sensitivity,
    pitch,
  };
}

export function zoomCamera(camera, wheelDelta) {
  return {
    ...camera,
    zoom: clamp(camera.zoom + Math.sign(wheelDelta) * 3, 25, 85),
  };
}

export function pickNearestBody(bodies, camera, pointer, viewport) {
  let best = null;
  let bestDepth = Infinity;
  for (const body of bodies) {
    const projected = projectBody(body, camera, viewport);
    if (!projected.visible) continue;
    const dx = pointer.x - projected.x;
    const dy = pointer.y - projected.y;
    const hitRadius = Math.max(10, projected.radius);
    if (dx * dx + dy * dy <= hitRadius * hitRadius && projected.depth < bestDepth) {
      best = body;
      bestDepth = projected.depth;
    }
  }
  return best;
}

export function projectBody(body, camera, viewport) {
  const forward = cameraForward(camera);
  const right = cameraRight(camera);
  const up = right.cross ? right.cross(forward).normalized() : cross(right, forward).normalized();
  const relative = body.position.sub(camera.position);
  const x = relative.dot(right);
  const y = relative.dot(up);
  const depth = relative.dot(forward);
  if (depth <= 0.01) return { visible: false };
  const focal = (viewport.height / 2) / Math.tan((camera.zoom * Math.PI / 180) / 2);
  return {
    visible: true,
    x: viewport.width / 2 + (x / depth) * focal,
    y: viewport.height / 2 - (y / depth) * focal,
    depth,
    radius: (body.radius / depth) * focal,
  };
}

function cross(a, b) {
  return new Vec3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
