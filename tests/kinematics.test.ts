import { describe, it, expect } from "vitest";
import { Quaternion } from "three";
import {
  V,
  twoBone,
  forward,
  localRotations,
  blendPose,
  fabrik,
  ccd,
  splinePose,
  constrainSwingTwist,
  walkingFoot,
  DEG,
} from "../src/engine/kinematics";
const lengths = (p: ReturnType<typeof V>[]) =>
  p.slice(1).map((v, i) => v.distanceTo(p[i]));
describe("analytic IK", () => {
  it("reaches target and preserves lengths for a 3D pole", () => {
    const r = twoBone(V(), V(1.2, 1, 0.4), V(0, 2, 2));
    expect(r.error).toBeLessThan(1e-8);
    expect(lengths(r.points)[0]).toBeCloseTo(1.25, 6);
    expect(lengths(r.points)[1]).toBeCloseTo(1.1, 6);
  });
  it("clamps unreachable far and near targets with reported error", () => {
    for (const target of [V(9), V()]) {
      const r = twoBone(V(), target, V(0, 1));
      expect(r.reachable).toBe(false);
      expect(r.error).toBeGreaterThan(0);
      expect(lengths(r.points)[0]).toBeCloseTo(1.25, 5);
      expect(lengths(r.points)[1]).toBeCloseTo(1.1, 5);
    }
  });
  it("has finite deterministic fallback when pole aligns", () => {
    const r = twoBone(V(), V(1), V(2));
    expect(r.poleFallback).toBe(true);
    expect(r.points.flatMap((v) => v.toArray()).every(Number.isFinite)).toBe(
      true,
    );
  });
  it("handles random targets without changing bone lengths", () => {
    for (let i = 0; i < 100; i++) {
      const r = twoBone(
        V(),
        V(Math.sin(i) * 3, Math.cos(i * 1.3) * 2, Math.sin(i * 2) * 2),
        V(0, 2, 1),
      );
      lengths(r.points).forEach((n, j) =>
        expect(n).toBeCloseTo([1.25, 1.1][j], 5),
      );
    }
  });
});
describe("quaternion hierarchy and blend", () => {
  it("inherits parent rotation", () => {
    const r = forward(
      V(),
      [1, 1],
      [
        new Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2),
        new Quaternion(),
      ],
    );
    expect(r.points[2].distanceTo(V(0, 2))).toBeLessThan(1e-8);
  });
  it("matches FK to an IK solution and keeps lengths throughout SLERP", () => {
    const p = twoBone(V(), V(1, 1, 0.2), V(0, 2, 1)).points,
      q = localRotations(p);
    expect(
      forward(V(), [1.25, 1.1], q).points[2].distanceTo(p[2]),
    ).toBeLessThan(1e-8);
    for (let w = 0; w <= 1; w += 0.1) {
      lengths(
        blendPose(V(), [1.25, 1.1], [new Quaternion(), new Quaternion()], q, w)
          .points,
      ).forEach((n, i) => expect(n).toBeCloseTo([1.25, 1.1][i], 6));
    }
  });
});
describe("iterative chains", () => {
  for (const solve of [fabrik, ccd])
    it(`${solve.name} converges while preserving fixed lengths`, () => {
      const p = [V(), V(0.7, 0.1), V(1.4, 0), V(2.1, 0.1), V(2.8, 0)],
        r = solve(p, V(1.5, 1.3), 80);
      expect(r.error).toBeLessThan(0.002);
      lengths(r.points).forEach((n, i) =>
        expect(n).toBeCloseTo(lengths(p)[i], 6),
      );
    });
});
describe("spline and constraints", () => {
  it("produces normalized transported frames on a curve", () => {
    const r = splinePose([V(), V(1, 1), V(2, -1, 0.5), V(3, 1)], 20, Math.PI);
    r.rotations.forEach((q) => expect(q.length()).toBeCloseTo(1, 6));
    expect(r.points[20].distanceTo(V(3, 1))).toBeLessThan(1e-8);
  });
  it("clamps swing and twist independently", () => {
    const input = new Quaternion()
      .setFromAxisAngle(V(0, 0, 1), 90 * DEG)
      .multiply(new Quaternion().setFromAxisAngle(V(1), 80 * DEG));
    const r = constrainSwingTwist(input, V(1), 30 * DEG, 20 * DEG);
    expect(r.limited).toBe(true);
    expect(r.twistAngle).toBeCloseTo(20 * DEG);
    expect(r.rotation.length()).toBeCloseTo(1);
  });
});
describe("procedural gait", () => {
  it("locks each foot in world space during stance", () => {
    for (const offset of [0, 0.5]) {
      const samples = [0.01, 0.1, 0.3, 0.6].map((p) =>
        walkingFoot((p - offset + 1) * 1.3, offset, 1.2, 0.3),
      );
      expect(samples.every((s) => s.stance)).toBe(true);
      samples.forEach((s) =>
        expect(s.position.distanceTo(samples[0].position)).toBeLessThan(1e-8),
      );
    }
  });
  it("swing is airborne and lands continuously", () => {
    const a = walkingFoot(1.3 * (1 - 1e-7), 0, 1.2, 0.3),
      b = walkingFoot(1.3, 0, 1.2, 0.3);
    expect(a.position.distanceTo(b.position)).toBeLessThan(1e-5);
    expect(walkingFoot(1.3 * 0.8, 0, 1.2, 0.3).position.y).toBeGreaterThan(0.3);
  });
});

describe("degenerate input guards", () => {
  it("rejects non-finite analytic input and preserves tiny valid bones", () => {
    expect(() => twoBone(V(), V(NaN), V(0, 1))).toThrow(RangeError);
    expect(() => twoBone(V(), V(1), V(0, 1), Infinity, 1)).toThrow(RangeError);
    const result = twoBone(V(), V(1e-9, 0.5e-9), V(0, 1e-9), 1e-9, 1e-9);
    for (const length of lengths(result.points))
      expect(Math.abs(length - 1e-9)).toBeLessThan(1e-15);
  });
  it("rejects an entirely coincident spline instead of returning invalid quaternions", () => {
    expect(() => splinePose([V(), V(), V(), V()])).toThrow(RangeError);
  });
  it("FABRIK escapes a vertical collinear seed", () => {
    const r = fabrik([V(), V(0, 1), V(0, 2)], V(0, 1.5), 100);
    expect(r.error).toBeLessThan(0.001);
  });
});
