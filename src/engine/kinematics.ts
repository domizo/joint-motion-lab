import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from "three";
export const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
export const DEG = Math.PI / 180;
const EPS = 1e-7;
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export interface TwoBoneResult {
  points: Vector3[];
  error: number;
  reachable: boolean;
  singular: boolean;
  poleFallback: boolean;
  bend: number;
}
/** Analytic triangle solve; pole is a world-space point, not an Euler angle. */
export function twoBone(
  root: Vector3,
  target: Vector3,
  pole: Vector3,
  a = 1.25,
  b = 1.1,
): TwoBoneResult {
  if (
    ![a, b].every((n) => Number.isFinite(n) && n > 0) ||
    !Number.isFinite(a * a + b * b)
  )
    throw new RangeError("Bone lengths must be finite and positive");
  if (![root, target, pole].every((v) => v.toArray().every(Number.isFinite)))
    throw new RangeError("Vectors must be finite");
  const epsilon = (a + b) * 1e-9;
  const delta = target.clone().sub(root),
    requested = delta.length();
  const axis = requested > epsilon ? delta.divideScalar(requested) : V(1, 0, 0);
  const min = Math.abs(a - b) + epsilon,
    max = a + b - epsilon,
    d = clamp(requested, min, max);
  let perpendicular = pole
    .clone()
    .sub(root)
    .addScaledVector(axis, -pole.clone().sub(root).dot(axis));
  const poleFallback = perpendicular.lengthSq() < EPS * EPS;
  if (poleFallback) {
    const seed = Math.abs(axis.y) < 0.9 ? V(0, 1, 0) : V(0, 0, 1);
    perpendicular = seed.addScaledVector(axis, -seed.dot(axis));
  }
  perpendicular.normalize();
  const along = (a * a + d * d - b * b) / (2 * d),
    height = Math.sqrt(Math.max(0, a * a - along * along));
  const elbow = root
    .clone()
    .addScaledVector(axis, along)
    .addScaledVector(perpendicular, height);
  const end = root.clone().addScaledVector(axis, d);
  return {
    points: [root.clone(), elbow, end],
    error: end.distanceTo(target),
    reachable: requested >= Math.abs(a - b) && requested <= a + b,
    singular: requested < epsilon || height < (a + b) * 1e-4,
    poleFallback,
    bend: Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)),
  };
}
export function forward(root: Vector3, lengths: number[], local: Quaternion[]) {
  const points = [root.clone()],
    worlds: Quaternion[] = [];
  let rotation = new Quaternion();
  lengths.forEach((length, i) => {
    rotation = rotation
      .clone()
      .multiply(local[i] ?? new Quaternion())
      .normalize();
    worlds.push(rotation.clone());
    points.push(
      points.at(-1)!.clone().add(V(length).applyQuaternion(rotation)),
    );
  });
  return { points, worlds };
}
export function localRotations(points: Vector3[]) {
  let parent = new Quaternion();
  const result: Quaternion[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = points[i + 1].clone().sub(points[i]).normalize();
    const world = new Quaternion().setFromUnitVectors(V(1), d);
    result.push(parent.clone().invert().multiply(world));
    parent = world;
  }
  return result;
}
export function blendPose(
  root: Vector3,
  lengths: number[],
  a: Quaternion[],
  b: Quaternion[],
  weight: number,
) {
  return forward(
    root,
    lengths,
    a.map((q, i) =>
      q
        .clone()
        .slerp(b[i], clamp(weight, 0, 1))
        .normalize(),
    ),
  );
}
export interface ChainResult {
  points: Vector3[];
  error: number;
  iterations: number;
  reachable: boolean;
}
export function fabrik(
  initial: Vector3[],
  target: Vector3,
  maxIterations = 24,
  tolerance = 1e-4,
): ChainResult {
  const p = initial.map((x) => x.clone()),
    root = p[0].clone(),
    lengths = p.slice(1).map((x, i) => x.distanceTo(p[i]));
  const reach = lengths.reduce((a, b) => a + b, 0),
    reachable = root.distanceTo(target) <= reach;
  if (!reachable) {
    const axis = target.clone().sub(root).normalize();
    for (let i = 1; i < p.length; i++)
      p[i].copy(p[i - 1]).addScaledVector(axis, lengths[i - 1]);
    return {
      points: p,
      error: p.at(-1)!.distanceTo(target),
      iterations: 0,
      reachable,
    };
  }
  let iterations = 0;
  // Break a collinear seed in any orientation so a bend direction can emerge.
  const seedAxis = p.at(-1)!.clone().sub(root).normalize();
  if (
    p.length > 2 &&
    p.every(
      (point) =>
        point.clone().sub(root).cross(seedAxis).length() < reach * 1e-7,
    )
  ) {
    const seed = Math.abs(seedAxis.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
    const perpendicular = seed
      .addScaledVector(seedAxis, -seed.dot(seedAxis))
      .normalize();
    p[Math.floor(p.length / 2)].addScaledVector(perpendicular, reach * 0.002);
  }
  for (; iterations < maxIterations; iterations++) {
    p.at(-1)!.copy(target);
    for (let i = p.length - 2; i >= 0; i--) {
      const dir = p[i].clone().sub(p[i + 1]);
      if (dir.lengthSq() < EPS) dir.set(0, 1, 0);
      p[i].copy(p[i + 1]).addScaledVector(dir.normalize(), lengths[i]);
    }
    p[0].copy(root);
    for (let i = 1; i < p.length; i++) {
      const dir = p[i].clone().sub(p[i - 1]);
      if (dir.lengthSq() < EPS) dir.set(0, 1, 0);
      p[i].copy(p[i - 1]).addScaledVector(dir.normalize(), lengths[i - 1]);
    }
    if (p.at(-1)!.distanceTo(target) < tolerance) {
      iterations++;
      break;
    }
  }
  return {
    points: p,
    error: p.at(-1)!.distanceTo(target),
    iterations,
    reachable,
  };
}
export function ccd(
  initial: Vector3[],
  target: Vector3,
  maxIterations = 24,
  tolerance = 1e-4,
): ChainResult {
  const p = initial.map((x) => x.clone());
  let iterations = 0;
  const reach = p.slice(1).reduce((sum, x, i) => sum + x.distanceTo(p[i]), 0);
  for (; iterations < maxIterations; iterations++) {
    for (let i = p.length - 2; i >= 0; i--) {
      const a = p.at(-1)!.clone().sub(p[i]),
        b = target.clone().sub(p[i]);
      if (a.lengthSq() < EPS || b.lengthSq() < EPS) continue;
      const q = new Quaternion().setFromUnitVectors(
        a.normalize(),
        b.normalize(),
      );
      for (let j = i + 1; j < p.length; j++)
        p[j].sub(p[i]).applyQuaternion(q).add(p[i]);
    }
    if (p.at(-1)!.distanceTo(target) < tolerance) {
      iterations++;
      break;
    }
  }
  return {
    points: p,
    error: p.at(-1)!.distanceTo(target),
    iterations,
    reachable: p[0].distanceTo(target) <= reach,
  };
}
export function splinePose(
  controls: Vector3[],
  segments = 14,
  twist = 0,
  arcLength = true,
) {
  if (
    controls.length < 2 ||
    !controls.every((v) => v.toArray().every(Number.isFinite)) ||
    controls.every((v) => v.equals(controls[0]))
  )
    throw new RangeError(
      "A spline requires finite, non-coincident control points",
    );
  if (
    !Number.isInteger(segments) ||
    segments < 1 ||
    segments > 1000 ||
    !Number.isFinite(twist)
  )
    throw new RangeError("Invalid spline sampling parameters");
  const curve = new CatmullRomCurve3(controls, false, "centripetal");
  curve.arcLengthDivisions = 400;
  const points: Vector3[] = [],
    rotations: Quaternion[] = [],
    normals: Vector3[] = [];
  let previous = V(0, 1, 0),
    normal = V(0, 0, 1);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments,
      tangent = (
        arcLength ? curve.getTangentAt(u) : curve.getTangent(u)
      ).normalize();
    if (tangent.lengthSq() < 1e-12) tangent.copy(i > 0 ? previous : V(1, 0, 0));
    if (i > 0)
      normal.applyQuaternion(
        new Quaternion().setFromUnitVectors(previous, tangent),
      );
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    if (normal.lengthSq() < EPS)
      normal.copy(V(0, 1, 0).cross(tangent).normalize());
    const n = normal.clone().applyAxisAngle(tangent, twist * u),
      binormal = tangent.clone().cross(n).normalize();
    rotations.push(
      new Quaternion()
        .setFromRotationMatrix(new Matrix4().makeBasis(tangent, n, binormal))
        .normalize(),
    );
    points.push(arcLength ? curve.getPointAt(u) : curve.getPoint(u));
    normals.push(n);
    previous = tangent;
  }
  return { points, rotations, normals, curve, length: curve.getLength() };
}
/** Decompose q = swing * twist about a normalized local axis, then clamp each angle. */
export function constrainSwingTwist(
  q: Quaternion,
  axis: Vector3,
  maxSwing: number,
  maxTwist: number,
) {
  const v = V(q.x, q.y, q.z),
    p = axis.clone().multiplyScalar(v.dot(axis));
  let twist = new Quaternion(p.x, p.y, p.z, q.w);
  if (twist.lengthSq() < EPS) twist.identity();
  else twist.normalize();
  if (twist.w < 0) twist.set(-twist.x, -twist.y, -twist.z, -twist.w);
  const swing = q.clone().multiply(twist.clone().invert()).normalize();
  const swingAngle = 2 * Math.acos(clamp(Math.abs(swing.w), 0, 1));
  let twistAngle =
    2 * Math.atan2(V(twist.x, twist.y, twist.z).dot(axis), twist.w);
  twistAngle = clamp(twistAngle, -maxTwist, maxTwist);
  const limitedSwing =
    swingAngle > maxSwing
      ? new Quaternion().slerp(swing, maxSwing / swingAngle)
      : swing;
  return {
    rotation: limitedSwing
      .multiply(new Quaternion().setFromAxisAngle(axis, twistAngle))
      .normalize(),
    swingAngle,
    twistAngle,
    limited:
      swingAngle > maxSwing ||
      Math.abs(
        2 * Math.atan2(V(twist.x, twist.y, twist.z).dot(axis), twist.w),
      ) > maxTwist,
  };
}
export function terrainHeight(x: number, amount: number) {
  return amount * (0.5 + 0.5 * Math.sin(x * 0.9));
}
export function walkingFoot(
  time: number,
  offset: number,
  stride: number,
  lift: number,
  terrain = 0,
) {
  const cycle = time / 1.3 + offset,
    turn = Math.floor(cycle),
    phase = cycle - turn,
    stance = phase < 0.62;
  const plantedX = (turn - offset) * stride + 0.26 * stride;
  const u = clamp((phase - 0.62) / 0.38, 0, 1),
    ease = u * u * (3 - 2 * u);
  const x = plantedX + (stance ? 0 : stride * ease),
    y =
      terrainHeight(x, terrain) +
      0.085 +
      (stance ? 0 : lift * Math.sin(Math.PI * u) ** 2);
  return {
    position: V(x, y, offset === 0 ? -0.24 : 0.24),
    stance,
    phase,
    plantedX,
  };
}
