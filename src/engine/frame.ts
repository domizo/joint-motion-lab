import { Quaternion, Vector3 } from "three";
import type { DemoId } from "../content/demos";
import {
  V,
  DEG,
  twoBone,
  forward,
  localRotations,
  blendPose,
  fabrik,
  ccd,
  splinePose,
  constrainSwingTwist,
  walkingFoot,
  terrainHeight,
} from "./kinematics";
export interface Segment {
  a: Vector3;
  b: Vector3;
  color?: number;
  radius?: number;
  ghost?: boolean;
}
export interface Marker {
  position: Vector3;
  color: number;
  size?: number;
  type?: "target" | "pole" | "joint" | "contact";
}
export interface Line {
  points: Vector3[];
  color: number;
}
export interface Frame {
  segments: Segment[];
  markers: Marker[];
  lines: Line[];
  metrics: Record<string, number | string>;
  target?: Vector3;
  focus: Vector3;
  terrain?: number;
  ground?: number;
  pose: number[];
}
const INK = 0x3c4640,
  LIME = 0xb8d955,
  VIOLET = 0x967be1;
export const emptyFrame = (): Frame => ({
  segments: [],
  markers: [],
  lines: [],
  metrics: {},
  focus: V(0, 1.4),
  pose: [],
});
function chain(f: Frame, p: Vector3[], color = INK, r = 0.085, ghost = false) {
  for (let i = 0; i < p.length - 1; i++)
    f.segments.push({ a: p[i], b: p[i + 1], color, radius: r, ghost });
  for (const v of p)
    f.markers.push({ position: v, color, size: r * 1.65, type: "joint" });
  f.pose.push(...p.flatMap((p) => p.toArray()));
}
function ring(center: Vector3, r: number) {
  return Array.from({ length: 97 }, (_, i) =>
    center
      .clone()
      .add(
        V(
          Math.cos((i / 96) * Math.PI * 2) * r,
          Math.sin((i / 96) * Math.PI * 2) * r,
        ),
      ),
  );
}
function axes(f: Frame, origin: Vector3, q: Quaternion, size = 0.25) {
  [V(1), V(0, 1), V(0, 0, 1)].forEach((a, i) =>
    f.lines.push({
      points: [
        origin,
        origin.clone().add(a.multiplyScalar(size).applyQuaternion(q)),
      ],
      color: [0xc76257, 0x6a9e67, 0x708ec3][i],
    }),
  );
}
export function blendFK(p: Record<string, number>) {
  return p.q0x !== undefined
    ? [
        new Quaternion(p.q0x, p.q0y, p.q0z, p.q0w),
        new Quaternion(p.q1x, p.q1y, p.q1z, p.q1w),
      ]
    : [
        new Quaternion().setFromAxisAngle(V(0, 0, 1), 75 * DEG),
        new Quaternion().setFromAxisAngle(V(0, 0, 1), -100 * DEG),
      ];
}
export function makeFrame(
  id: DemoId,
  p: Record<string, number>,
  time: number,
  animate: boolean,
  construction: boolean,
): Frame {
  const f = emptyFrame(),
    t = animate ? time : 0,
    root = V(0, 0.45),
    target = V(p.tx ?? 1.5, p.ty ?? 1.5),
    pole =
      p.px !== undefined
        ? V(p.px, p.py, p.pz)
        : root
            .clone()
            .add(
              V(
                0.1,
                1.8 * Math.cos((p.pole ?? 25) * DEG),
                1.8 * Math.sin((p.pole ?? 25) * DEG),
              ),
            );
  if (["ik", "chain", "blend"].includes(id) && animate) {
    target.x += 0.25 * Math.sin(t * 0.7);
    target.y += 0.28 * Math.sin(t * 0.9);
  }
  if (id === "fk") {
    const q = [
      p.shoulder + 12 * Math.sin(t),
      p.elbow + 22 * Math.sin(t * 0.8),
      p.wrist + 18 * Math.sin(t * 1.2),
    ].map((a) => new Quaternion().setFromAxisAngle(V(0, 0, 1), a * DEG));
    const r = forward(root, [1.1, 0.9, 0.55], q);
    chain(f, r.points);
    f.markers.push({ position: r.points[3], color: LIME, size: 0.16 });
    if (construction) r.worlds.forEach((q, i) => axes(f, r.points[i], q));
    f.metrics = { tipX: r.points[3].x, tipY: r.points[3].y, bones: 3 };
  } else if (id === "ik" || id === "blend") {
    const r = twoBone(root, target, pole);
    let points = r.points;
    if (id === "blend") {
      const ik = localRotations(r.points),
        fk = blendFK(p);
      points = blendPose(root, [1.25, 1.1], fk, ik, p.weight).points;
      if (construction) {
        chain(f, r.points, 0xb1bcae, 0.03, true);
        chain(f, forward(root, [1.25, 1.1], fk).points, VIOLET, 0.025, true);
      }
      f.metrics = {
        weight: p.weight,
        error: points[2].distanceTo(target),
        matched: forward(root, [1.25, 1.1], fk).points.every(
          (point, i) => point.distanceTo(r.points[i]) < 1e-5,
        )
          ? "matched"
          : "independent",
      };
    } else
      f.metrics = {
        error: r.error,
        bend: r.bend / DEG,
        reach: r.reachable ? "reachable" : "unreachable",
        singular: r.singular || r.poleFallback ? "fallback" : "stable",
      };
    chain(f, points);
    f.target = target;
    f.markers.push({
      position: target,
      color: LIME,
      size: 0.16,
      type: "target",
    });
    if (construction) {
      f.markers.push({
        position: pole,
        color: VIOLET,
        size: 0.09,
        type: "pole",
      });
      f.lines.push(
        { points: [root, pole, points[1]], color: VIOLET },
        { points: ring(root, 2.35), color: 0xb0b8ad },
      );
    }
  } else if (id === "chain") {
    const initial = [
      root,
      root.clone().add(V(0.65, 0.12)),
      root.clone().add(V(1.3, 0)),
      root.clone().add(V(1.95, 0.12)),
      root.clone().add(V(2.6, 0)),
      root.clone().add(V(3.25, 0.12)),
    ];
    const a = fabrik(initial, target, p.iterations),
      b = ccd(initial, target, p.iterations);
    chain(f, a.points);
    chain(
      f,
      b.points.map((v) => v.clone().add(V(0, 0, -0.48))),
      VIOLET,
      0.05,
    );
    f.target = target;
    f.markers.push({
      position: target,
      color: LIME,
      size: 0.16,
      type: "target",
    });
    f.metrics = {
      fabrikError: a.error,
      ccdError: b.error,
      iterations: p.iterations,
    };
  } else if (id === "spline") {
    const controls = [
      V(-1.5, 0.3),
      V(-1, 1.15, p.amplitude * Math.sin(t)),
      V(p.amplitude * Math.cos(t * 0.6), 2),
      V(1.5, 2.6, p.amplitude * Math.sin(t * 0.7 + 0.6)),
    ];
    const r = splinePose(controls, p.segments, p.twist * DEG, p.arc !== 0);
    chain(f, r.points, INK, 0.055);
    f.lines.push({ points: r.curve.getPoints(100), color: LIME });
    if (construction) {
      controls.forEach((position) =>
        f.markers.push({ position, color: VIOLET, size: 0.075, type: "pole" }),
      );
      r.rotations.forEach((q, i) => {
        if (i % 2 === 0) axes(f, r.points[i], q, 0.24);
      });
    }
    const lens = r.points.slice(1).map((v, i) => v.distanceTo(r.points[i]));
    f.metrics = {
      curveLength: r.length,
      minBone: Math.min(...lens),
      maxBone: Math.max(...lens),
    };
  } else if (id === "contact") {
    const shift = p.lean + 0.18 * Math.sin(t * 0.9),
      hip = V(-0.65 + shift, 1.12),
      chest = V(-0.15 + shift, 1.65);
    chain(
      f,
      [V(-1, 0.12), V(-1.13, 0.66), hip, chest, V(chest.x + 0.05, 2.12)],
      INK,
      0.12,
    );
    const hand = V(p.tx, p.ground + 0.14),
      shoulder = chest.clone().add(V(0.1, 0.02));
    const r = twoBone(
      shoulder,
      hand,
      shoulder.clone().add(V(0, 0.5, 1)),
      1.1,
      1.1,
    );
    if (p.lock === 0) {
      const loose = forward(
        shoulder,
        [1.1, 1.1],
        [
          new Quaternion().setFromAxisAngle(V(0, 0, 1), -25 * DEG),
          new Quaternion().setFromAxisAngle(V(0, 0, 1), -75 * DEG),
        ],
      );
      chain(f, loose.points);
      f.metrics = {
        error: loose.points[2].distanceTo(hand),
        contact: "unlocked",
      };
    } else {
      chain(f, r.points);
      f.metrics = {
        error: r.error,
        contact: r.error < 0.005 ? "planted" : "outOfReach",
      };
    }
    f.markers.push({
      position: hand,
      color: LIME,
      size: 0.16,
      type: "contact",
    });
    f.ground = p.ground;
    f.metrics.solver = "kinematic";
  } else if (id === "walk") {
    const a = walkingFoot(time, 0, p.stride, p.lift, p.terrain),
      b = walkingFoot(time, 0.5, p.stride, p.lift, p.terrain),
      x = (time / 1.3) * p.stride;
    const desiredY =
      1.52 +
      (terrainHeight(x - 0.15, p.terrain) +
        terrainHeight(x + 0.15, p.terrain)) *
        0.5 +
      0.025 * Math.cos((time / 1.3) * Math.PI * 4);
    const reachCeiling = Math.min(
      ...[a, b].map(
        (foot) =>
          foot.position.y +
          Math.sqrt(Math.max(0, 1.62 ** 2 - (foot.position.x - x) ** 2)) -
          0.025,
      ),
    );
    const y = Math.min(desiredY, reachCeiling),
      hip = V(x, y),
      chest = V(x, y + 0.62),
      head = V(x, y + 1.02);
    chain(f, [hip, chest, head], INK, 0.12);
    for (const [i, foot] of [a, b].entries()) {
      const h = hip.clone().add(V(0, 0, i === 0 ? -0.24 : 0.24));
      const leg = twoBone(
        h,
        foot.position,
        h.clone().add(V(0.85, -0.2, 0)),
        0.81,
        0.81,
      );
      chain(f, leg.points);
      f.segments.push({
        a: leg.points[2].clone().add(V(-0.11)),
        b: leg.points[2].clone().add(V(0.18)),
        radius: 0.085,
        color: foot.stance ? LIME : INK,
      });
      if (construction)
        f.markers.push({
          position: foot.position
            .clone()
            .setY(terrainHeight(foot.position.x, p.terrain) + 0.02),
          color: foot.stance ? LIME : VIOLET,
          size: 0.065,
          type: "contact",
        });
      const shoulder = chest.clone().add(V(0, 0, i === 0 ? -0.34 : 0.34)),
        angle =
          (20 * Math.sin((time / 1.3) * Math.PI * 2 + (i ? 0 : Math.PI)) - 90) *
          DEG;
      chain(
        f,
        forward(
          shoulder,
          [0.46, 0.45],
          [
            new Quaternion().setFromAxisAngle(V(0, 0, 1), angle),
            new Quaternion().setFromAxisAngle(V(0, 0, 1), -15 * DEG),
          ],
        ).points,
        INK,
        0.065,
      );
      f.metrics[i === 0 ? "leftError" : "rightError"] = leg.error;
    }
    f.metrics.left = a.stance ? "stance" : "swing";
    f.metrics.right = b.stance ? "stance" : "swing";
    f.metrics.plantError = Math.max(
      a.stance ? Number(f.metrics.leftError) : 0,
      b.stance ? Number(f.metrics.rightError) : 0,
    );
    f.focus = V(x, 1.5);
    f.terrain = p.terrain;
  } else if (id === "constraints") {
    const origin = V(-0.7, 1.35),
      swing = (p.swing + 15 * Math.sin(t)) * DEG,
      request = new Quaternion()
        .setFromAxisAngle(V(0, 0, 1), swing)
        .multiply(new Quaternion().setFromAxisAngle(V(1), p.twist * DEG)),
      r = constrainSwingTwist(request, V(1), p.limit * DEG, 45 * DEG);
    const end = origin.clone().add(V(1.7).applyQuaternion(r.rotation));
    chain(f, [origin, end]);
    if (construction) {
      chain(
        f,
        [origin, origin.clone().add(V(1.7).applyQuaternion(request))],
        VIOLET,
        0.03,
        true,
      );
      axes(f, end, r.rotation, 0.45);
      f.lines.push({
        points: Array.from({ length: 40 }, (_, i) =>
          origin
            .clone()
            .add(
              V(
                Math.cos((-p.limit + (i / 39) * p.limit * 2) * DEG),
                Math.sin((-p.limit + (i / 39) * p.limit * 2) * DEG),
              ).multiplyScalar(1.7),
            ),
        ),
        color: LIME,
      });
    }
    f.metrics = {
      swing: r.swingAngle / DEG,
      twist: r.twistAngle / DEG,
      limit: p.limit,
      status: r.limited ? "limited" : "free",
    };
  }
  if (["fk", "ik", "chain", "blend"].includes(id)) {
    f.segments.unshift({
      a: V(0, 0.08),
      b: root.clone(),
      color: 0x7b8577,
      radius: 0.12,
    });
    f.segments.unshift({
      a: V(0, 0.03),
      b: V(0, 0.11),
      color: 0x7b8577,
      radius: 0.28,
    });
  }
  if (id !== "walk") f.focus = V(0.7, 1.3);
  return f;
}
