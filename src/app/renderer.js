import { buildFabricGrid } from '../core/fabric.js';
import { Vec3 } from '../core/math.js';
import { cameraForward, cameraRight } from './camera.js';

const vertexShader = `
attribute vec3 a_position;
attribute vec4 a_color;
attribute float a_size;
uniform mat4 u_matrix;
varying vec4 v_color;
void main() {
  vec4 clip = u_matrix * vec4(a_position, 1.0);
  gl_Position = clip;
  gl_PointSize = a_size;
  v_color = a_color;
}`;

const pointVertexShader = `
attribute vec3 a_position;
attribute vec4 a_color;
attribute float a_size;
attribute float a_style;
attribute float a_seed;
uniform mat4 u_matrix;
varying vec4 v_color;
varying float v_style;
varying float v_seed;
void main() {
  vec4 clip = u_matrix * vec4(a_position, 1.0);
  gl_Position = clip;
  gl_PointSize = a_size / max(0.18, clip.w);
  v_color = a_color;
  v_style = a_style;
  v_seed = a_seed;
}`;

const spriteVertexShader = `
attribute vec3 a_position;
attribute vec2 a_uv;
attribute vec4 a_color;
attribute float a_style;
attribute float a_seed;
uniform mat4 u_matrix;
varying vec2 v_uv;
varying vec4 v_color;
varying float v_style;
varying float v_seed;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
  v_uv = a_uv;
  v_color = a_color;
  v_style = a_style;
  v_seed = a_seed;
}`;

const fragmentShader = `
precision mediump float;
varying vec4 v_color;
void main() {
  gl_FragColor = v_color;
}`;

const pointFragmentShader = `
precision mediump float;
varying vec4 v_color;
varying float v_style;
varying float v_seed;
void main() {
  vec2 delta = gl_PointCoord - vec2(0.5);
  float d = dot(delta, delta);
  if (d > 0.25) discard;
  float radius = sqrt(d) * 2.0;
  float edge = smoothstep(1.0, 0.86, radius);
  vec3 color = v_color.rgb;
  float alpha = v_color.a * edge;

  if (v_style > 0.5 && v_style < 1.5) {
    float core = smoothstep(0.95, 0.0, radius);
    float flame = 0.5 + 0.5 * sin((delta.x + v_seed) * 36.0) * sin((delta.y - v_seed) * 42.0);
    vec3 hot = mix(vec3(1.0, 0.35, 0.02), vec3(1.0, 0.95, 0.45), core);
    color = mix(vec3(0.85, 0.12, 0.02), hot, clamp(core + flame * 0.22, 0.0, 1.0));
    alpha = v_color.a * smoothstep(1.0, 0.04, radius);
  } else if (v_style > 1.5 && v_style < 2.5) {
    vec2 p = delta * 2.0;
    float sphere = sqrt(max(0.0, 1.0 - dot(p, p)));
    float land = sin(p.x * 9.0 + v_seed * 4.0) + sin(p.y * 13.0 - v_seed) + sin((p.x + p.y) * 7.0);
    float cloud = smoothstep(1.15, 1.85, sin(p.x * 18.0 + p.y * 6.0 + v_seed * 8.0));
    vec3 ocean = vec3(0.02, 0.22, 0.78);
    vec3 continent = vec3(0.10, 0.55, 0.20);
    color = mix(ocean, continent, smoothstep(0.25, 0.8, land));
    color = mix(color, vec3(1.0), cloud * 0.28);
    color *= 0.58 + sphere * 0.55;
    alpha = v_color.a * edge;
  } else if (v_style > 2.5 && v_style < 3.5) {
    float band = 0.5 + 0.5 * sin(delta.y * 28.0 + v_seed * 5.0);
    color = mix(v_color.rgb * 0.65, v_color.rgb * 1.28, band);
    alpha = v_color.a * edge;
  } else {
    float glow = smoothstep(0.25, 0.02, d);
    alpha = v_color.a * glow;
  }

  gl_FragColor = vec4(color, alpha);
}`;

const spriteFragmentShader = `
precision mediump float;
varying vec2 v_uv;
varying vec4 v_color;
varying float v_style;
varying float v_seed;
void main() {
  vec2 p = v_uv;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float radius = sqrt(d);
  float edge = smoothstep(1.0, 0.86, radius);
  vec3 color = v_color.rgb;
  float alpha = v_color.a * edge;

  if (v_style > 0.5 && v_style < 1.5) {
    float core = smoothstep(0.92, 0.0, radius);
    float flame = 0.5 + 0.5 * sin((p.x + v_seed) * 18.0) * sin((p.y - v_seed) * 24.0);
    vec3 ember = vec3(0.9, 0.12, 0.01);
    vec3 orange = vec3(1.0, 0.44, 0.03);
    vec3 whiteHot = vec3(1.0, 0.94, 0.55);
    color = mix(ember, orange, flame);
    color = mix(color, whiteHot, core);
    alpha = v_color.a * smoothstep(1.0, 0.02, radius);
  } else if (v_style > 1.5 && v_style < 2.5) {
    float sphere = sqrt(max(0.0, 1.0 - d));
    float land = sin(p.x * 7.0 + v_seed * 5.0) + sin(p.y * 10.0 - v_seed * 2.0) + sin((p.x - p.y) * 8.0);
    float cloud = smoothstep(1.35, 1.9, sin(p.x * 17.0 + p.y * 5.0 + v_seed * 9.0));
    vec3 ocean = vec3(0.01, 0.18, 0.76);
    vec3 continent = vec3(0.08, 0.48, 0.18);
    color = mix(ocean, continent, smoothstep(0.15, 0.7, land));
    color = mix(color, vec3(1.0), cloud * 0.22);
    color *= 0.52 + sphere * 0.62;
    alpha = v_color.a * edge;
  } else if (v_style > 2.5 && v_style < 3.5) {
    float band = 0.5 + 0.5 * sin(p.y * 14.0 + v_seed * 6.0);
    color = mix(v_color.rgb * 0.58, v_color.rgb * 1.25, band);
    alpha = v_color.a * edge;
  }

  gl_FragColor = vec4(color, alpha);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!this.gl) throw new Error('WebGL is not available in this browser.');
    this.lineProgram = createProgram(this.gl, vertexShader, fragmentShader);
    this.pointProgram = createProgram(this.gl, pointVertexShader, pointFragmentShader);
    this.spriteProgram = createProgram(this.gl, spriteVertexShader, spriteFragmentShader);
    this.positionBuffer = this.gl.createBuffer();
    this.uvBuffer = this.gl.createBuffer();
    this.colorBuffer = this.gl.createBuffer();
    this.sizeBuffer = this.gl.createBuffer();
    this.styleBuffer = this.gl.createBuffer();
    this.seedBuffer = this.gl.createBuffer();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const scale = window.devicePixelRatio || 1;
    const pixelWidth = Math.floor(width * scale);
    const pixelHeight = Math.floor(height * scale);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(state, camera, settings) {
    this.resize();
    const gl = this.gl;
    gl.clearColor(0.005, 0.008, 0.014, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const matrix = viewProjectionMatrix(camera, this.canvas.width / this.canvas.height);

    if (settings.heatmap) {
      const layers = buildFabricLayers(state.bodies, settings, state.time);
      gl.depthMask(false);
      this.drawTriangles(layers.surface, matrix, 1);
      gl.depthMask(true);
      if (settings.showFabric) this.drawLines(layers.grid, matrix, 1);
    } else if (settings.showFabric) {
      this.drawLines(buildFabricLines(state.bodies, settings, state.time), matrix, 1);
    }
    if (settings.showTrails) this.drawLines(buildTrailLines(state.bodies), matrix, 1);
    this.drawPoints(buildGlowPoints(state.bodies), matrix);
    this.drawSprites(buildBodySprites(state.bodies, camera), matrix);
    this.drawPoints(buildFlashPoints(state.flashes), matrix);
  }

  drawLines(batch, matrix, size) {
    if (batch.positions.length === 0) return;
    if (batch.overlay) this.gl.disable(this.gl.DEPTH_TEST);
    this.drawBatch(this.lineProgram, batch, matrix, this.gl.LINES, size);
    if (batch.overlay) this.gl.enable(this.gl.DEPTH_TEST);
  }

  drawTriangles(batch, matrix, size) {
    if (batch.positions.length === 0) return;
    this.drawBatch(this.lineProgram, batch, matrix, this.gl.TRIANGLES, size);
  }

  drawPoints(batch, matrix) {
    if (batch.positions.length === 0) return;
    this.drawBatch(this.pointProgram, batch, matrix, this.gl.POINTS, 1);
  }

  drawSprites(batch, matrix) {
    if (batch.positions.length === 0) return;
    const gl = this.gl;
    const program = this.spriteProgram;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(program.program);
    gl.uniformMatrix4fv(program.matrix, false, matrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.position);
    gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.uvs), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.uv);
    gl.vertexAttribPointer(program.uv, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.color);
    gl.vertexAttribPointer(program.color, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.styles), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.style);
    gl.vertexAttribPointer(program.style, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.seeds), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.seed);
    gl.vertexAttribPointer(program.seed, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, batch.positions.length / 3);
    gl.enable(gl.DEPTH_TEST);
  }

  drawBatch(program, batch, matrix, primitive, defaultSize) {
    const gl = this.gl;
    gl.useProgram(program.program);
    gl.uniformMatrix4fv(program.matrix, false, matrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.position);
    gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.color);
    gl.vertexAttribPointer(program.color, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.sizes ?? Array(batch.positions.length / 3).fill(defaultSize)), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(program.size);
    gl.vertexAttribPointer(program.size, 1, gl.FLOAT, false, 0, 0);

    if (program.style >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.styles ?? Array(batch.positions.length / 3).fill(0)), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(program.style);
      gl.vertexAttribPointer(program.style, 1, gl.FLOAT, false, 0, 0);
    }

    if (program.seed >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.seedBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch.seeds ?? Array(batch.positions.length / 3).fill(0)), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(program.seed);
      gl.vertexAttribPointer(program.seed, 1, gl.FLOAT, false, 0, 0);
    }

    gl.drawArrays(primitive, 0, batch.positions.length / 3);
  }
}

export function buildFabricSurface(bodies, settings, time) {
  const grid = buildFabricGrid(bodies, {
    size: settings.fabricSize,
    resolution: settings.fabricResolution,
    strength: settings.fabricStrength,
    softening: settings.fabricSoftening,
    heatmap: true,
    wavesEnabled: settings.showWaves,
    heatmapReferenceDepth: settings.heatmapReferenceDepth,
    heatmapExposure: settings.heatmapExposure,
    time,
  });
  const positions = [];
  const colors = [];
  const addVertex = (vertex) => {
    positions.push(vertex.x, vertex.y + (settings.heatmapLayerOffset ?? 0), vertex.z);
    pushColor(colors, vertex.color, heatmapAlphaForVertex(vertex, grid, settings));
  };

  for (let row = 0; row < grid.resolution - 1; row += 1) {
    for (let col = 0; col < grid.resolution - 1; col += 1) {
      const topLeft = grid.vertices[row * grid.resolution + col];
      const topRight = grid.vertices[row * grid.resolution + col + 1];
      const bottomLeft = grid.vertices[(row + 1) * grid.resolution + col];
      const bottomRight = grid.vertices[(row + 1) * grid.resolution + col + 1];

      addVertex(topLeft);
      addVertex(bottomLeft);
      addVertex(topRight);
      addVertex(topRight);
      addVertex(bottomLeft);
      addVertex(bottomRight);
    }
  }

  return { positions, colors };
}

export function buildFabricLayers(bodies, settings, time) {
  const grid = buildFabricLines(bodies, {
    ...settings,
    heatmap: false,
    gridLayerOffset: settings.gridLayerOffset ?? 0,
    gridAlpha: settings.gridAlpha ?? 0.22,
  }, time);
  grid.overlay = true;
  return {
    surface: buildFabricSurface(bodies, settings, time),
    grid,
  };
}

function heatmapAlphaForVertex(vertex, grid, settings) {
  const baseAlpha = settings.heatmapAlpha ?? 0.9;
  if (!settings.hideHeatmapBase) return baseAlpha;
  const relativeDepth = Math.max(0, vertex.displayDepth ?? Math.abs(vertex.y)) / Math.max(grid.maxDisplayDepth ?? grid.maxDepth, 1e-9);
  const visibility = grid.maxVisualMass <= 0.01
    ? smoothstep(0.17, 0.46, relativeDepth)
    : smoothstep(0.16, 0.55, relativeDepth);
  return baseAlpha * Math.max(0, Math.min(1, visibility));
}

function buildFabricLines(bodies, settings, time) {
  const grid = buildFabricGrid(bodies, {
    size: settings.fabricSize,
    resolution: settings.fabricResolution,
    strength: settings.fabricStrength,
    softening: settings.fabricSoftening,
    heatmap: settings.heatmap,
    wavesEnabled: settings.showWaves,
    heatmapReferenceDepth: settings.heatmapReferenceDepth,
    heatmapExposure: settings.heatmapExposure,
    time,
  });
  const positions = [];
  const colors = [];
  const offset = settings.gridLayerOffset ?? 0;
  const addSegment = (a, b) => {
    positions.push(a.x, a.y + offset, a.z, b.x, b.y + offset, b.z);
    pushColor(colors, a.color, settings.gridAlpha ?? (settings.heatmap ? 0.82 : 0.38));
    pushColor(colors, b.color, settings.gridAlpha ?? (settings.heatmap ? 0.82 : 0.38));
  };
  for (let row = 0; row < grid.resolution; row += 1) {
    for (let col = 0; col < grid.resolution - 1; col += 1) {
      addSegment(grid.vertices[row * grid.resolution + col], grid.vertices[row * grid.resolution + col + 1]);
    }
  }
  for (let col = 0; col < grid.resolution; col += 1) {
    for (let row = 0; row < grid.resolution - 1; row += 1) {
      addSegment(grid.vertices[row * grid.resolution + col], grid.vertices[(row + 1) * grid.resolution + col]);
    }
  }
  return { positions, colors };
}

function buildTrailLines(bodies) {
  const positions = [];
  const colors = [];
  for (const body of bodies) {
    const color = body.color ?? [220, 220, 220];
    for (let i = 1; i < body.trail.length; i += 1) {
      const a = body.trail[i - 1];
      const b = body.trail[i];
      const alpha = i / body.trail.length;
      positions.push(a.x, a.y + 0.015, a.z, b.x, b.y + 0.015, b.z);
      pushColor(colors, color, alpha * 0.45);
      pushColor(colors, color, alpha * 0.7);
    }
  }
  return { positions, colors };
}

function buildGlowPoints(bodies) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const body of bodies) {
    if (!body.glow) continue;
    positions.push(body.position.x, body.position.y, body.position.z);
    pushColor(colors, body.color, 0.25);
    sizes.push(Math.max(48, body.radius * 1400));
  }
  return { positions, colors, sizes };
}

export function buildBodyPoints(bodies) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const styles = [];
  const seeds = [];
  for (const body of bodies) {
    const style = bodyStyle(body);
    positions.push(body.position.x, body.position.y, body.position.z);
    pushColor(colors, body.selected ? [255, 255, 255] : body.color, 1);
    sizes.push(bodyPointSize(body, style));
    styles.push(style);
    seeds.push((body.id % 997) / 997);
  }
  return { positions, colors, sizes, styles, seeds };
}

function buildFlashPoints(flashes) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const flash of flashes) {
    const t = 1 - flash.age / flash.duration;
    positions.push(flash.position.x, flash.position.y, flash.position.z);
    pushColor(colors, [255, 230, 150], t * 0.8);
    sizes.push(Math.max(12, flash.radius * 500 * (1 + (1 - t))));
  }
  return { positions, colors, sizes };
}

function pushColor(colors, color, alpha) {
  colors.push((color.r ?? color[0]) / 255, (color.g ?? color[1]) / 255, (color.b ?? color[2]) / 255, alpha);
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return {
    program,
    position: gl.getAttribLocation(program, 'a_position'),
    uv: gl.getAttribLocation(program, 'a_uv'),
    color: gl.getAttribLocation(program, 'a_color'),
    size: gl.getAttribLocation(program, 'a_size'),
    style: gl.getAttribLocation(program, 'a_style'),
    seed: gl.getAttribLocation(program, 'a_seed'),
    matrix: gl.getUniformLocation(program, 'u_matrix'),
  };
}

export function buildBodySprites(bodies, camera) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const styles = [];
  const seeds = [];
  const forward = cameraForward(camera);
  const right = cameraRight(camera);
  const up = cross(right, forward).normalized();

  for (const body of bodies) {
    const style = bodyStyle(body);
    const halfSize = bodySpriteWorldSize(body, style);
    const center = body.position;
    const left = right.scale(-halfSize);
    const rightOffset = right.scale(halfSize);
    const down = up.scale(-halfSize);
    const upOffset = up.scale(halfSize);
    const vertices = [
      center.add(left).add(down),
      center.add(rightOffset).add(down),
      center.add(left).add(upOffset),
      center.add(rightOffset).add(down),
      center.add(rightOffset).add(upOffset),
      center.add(left).add(upOffset),
    ];
    const spriteUvs = [-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1];
    for (const vertex of vertices) {
      positions.push(vertex.x, vertex.y, vertex.z);
      pushColor(colors, body.selected ? [255, 255, 255] : body.color, 1);
      styles.push(style);
      seeds.push((body.id % 997) / 997);
    }
    uvs.push(...spriteUvs);
  }

  return { positions, uvs, colors, styles, seeds };
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function viewProjectionMatrix(camera, aspect) {
  const projection = perspective(camera.zoom * Math.PI / 180, aspect, 0.02, 4000);
  const forward = cameraForward(camera);
  const view = lookAt(camera.position, camera.position.add(forward), new Vec3(0, 1, 0));
  return multiply(projection, view);
}

function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye, target, upHint) {
  const z = eye.sub(target).normalized();
  const x = cross(upHint, z).normalized();
  const y = cross(z, x).normalized();
  return new Float32Array([
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -x.dot(eye), -y.dot(eye), -z.dot(eye), 1,
  ]);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0]
        + a[1 * 4 + row] * b[col * 4 + 1]
        + a[2 * 4 + row] * b[col * 4 + 2]
        + a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function cross(a, b) {
  return new Vec3(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
  );
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function bodyStyle(body) {
  if (body.glow) return 1;
  if (body.type === 'planet' && (body.name.toLowerCase().includes('earth') || isBluePlanet(body.color))) return 2;
  if (body.type === 'planet') return 3;
  return 0;
}

function bodyPointSize(body, style) {
  if (style === 1) return Math.max(220, body.radius * 1800);
  if (style === 2) return Math.max(104, body.radius * 2200);
  if (style === 3) return Math.max(78, body.radius * 1500);
  return Math.max(28, body.radius * 1000);
}

export function bodySpriteWorldSize(body, style = bodyStyle(body)) {
  if (style === 1) return Math.max(0.52, body.radius * 4.4);
  if (style === 2) return Math.max(0.12, body.radius * 2.6);
  if (style === 3) return Math.max(0.09, body.radius * 2.2);
  return Math.max(0.07, body.radius * 1.7);
}

function isBluePlanet(color) {
  return Array.isArray(color) && color[2] > color[0] && color[2] > color[1];
}
