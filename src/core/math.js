export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static zero() {
    return new Vec3();
  }

  static from(value) {
    if (value instanceof Vec3) return value;
    return new Vec3(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0);
  }

  add(other) {
    const rhs = Vec3.from(other);
    return new Vec3(this.x + rhs.x, this.y + rhs.y, this.z + rhs.z);
  }

  sub(other) {
    const rhs = Vec3.from(other);
    return new Vec3(this.x - rhs.x, this.y - rhs.y, this.z - rhs.z);
  }

  scale(scalar) {
    return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  dot(other) {
    const rhs = Vec3.from(other);
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
  }

  lengthSquared() {
    return this.dot(this);
  }

  length() {
    return Math.sqrt(this.lengthSquared());
  }

  normalized() {
    const length = this.length();
    if (length === 0) return Vec3.zero();
    return this.scale(1 / length);
  }

  distanceTo(other) {
    return this.sub(other).length();
  }

  withY(y) {
    return new Vec3(this.x, y, this.z);
  }
}
