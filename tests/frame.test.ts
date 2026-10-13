import { describe, it, expect } from "vitest";
import { demos } from "../src/content/demos";
import { makeFrame } from "../src/engine/frame";
import { guideChapters } from "../src/content/guide";
describe("scene snapshots", () => {
  it("all kinematic demos remain finite over a long observation window", () => {
    for (const d of demos.filter((d) => d.id !== "ragdoll"))
      for (let t = 0; t < 40; t += 0.17) {
        const f = makeFrame(d.id, d.defaults, t, true, true);
        expect(f.pose.length).toBeGreaterThan(0);
        expect(f.pose.every(Number.isFinite)).toBeTruthy();
        for (const value of Object.values(f.metrics))
          if (typeof value === "number")
            expect(Number.isFinite(value)).toBeTruthy();
      }
  });
  it("endpoint highlights clear coincident joint surfaces", () => {
    for (const id of ["fk", "ik", "chain", "contact"] as const) {
      const f = makeFrame(
        id,
        demos.find((d) => d.id === id)!.defaults,
        0,
        false,
        true,
      );
      const highlights = f.markers.filter((m) => m.color === 0xb8d955);
      expect(highlights.length).toBeGreaterThan(0);
      for (const marker of highlights) {
        const coincident = f.markers.filter(
          (m) =>
            m.type === "joint" &&
            m.position.distanceTo(marker.position) < 0.002,
        );
        for (const joint of coincident)
          expect(marker.size! - joint.size!).toBeGreaterThan(0.01);
      }
    }
  });
  it("default IK stays reachable across the whole input cycle", () => {
    for (let t = 0; t < 30; t += 0.1) {
      const f = makeFrame(
        "ik",
        demos.find((d) => d.id === "ik")!.defaults,
        t,
        true,
        true,
      );
      expect(f.metrics.error).toBeLessThan(0.001);
    }
  });
  it("locked hand contact follows the target as shoulder moves", () => {
    for (let t = 0; t < 20; t += 0.1) {
      const f = makeFrame(
        "contact",
        demos.find((d) => d.id === "contact")!.defaults,
        t,
        true,
        true,
      );
      expect(f.metrics.error).toBeLessThan(0.001);
    }
  });
  it("walk ankles reach stance targets across the slider envelope", () => {
    for (const stride of [0.4, 1.1, 1.6])
      for (const terrain of [0, 0.45])
        for (let time = 0; time < 8; time += 0.075) {
          const f = makeFrame(
            "walk",
            { stride, terrain, lift: 0.6 },
            time,
            true,
            true,
          );
          expect(f.metrics.leftError).toBeLessThan(0.002);
          expect(f.metrics.rightError).toBeLessThan(0.002);
          expect(f.metrics.plantError).toBeLessThan(0.002);
        }
  });
  it("all chapters contain two complete guide languages and primary sources", () => {
    for (const d of demos) {
      const g = guideChapters[d.id];
      expect(g.citations.length).toBeGreaterThan(0);
      for (const lang of ["en", "ja"] as const) {
        expect(g[lang].steps.length).toBeGreaterThan(1);
        expect(g[lang].observe.length).toBeGreaterThan(0);
        expect(g[lang].failures.length).toBeGreaterThan(0);
        expect(g[lang].formula.length).toBeGreaterThan(0);
      }
    }
  });
});
