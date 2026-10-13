import { afterEach, describe, expect, it } from "vitest";
import {
  createRagdollSimulation,
  type RagdollSimulation,
} from "../src/engine/ragdoll";

const simulations: RagdollSimulation[] = [];
async function makeSimulation(
  options?: Parameters<typeof createRagdollSimulation>[0],
) {
  const simulation = await createRagdollSimulation(options);
  simulations.push(simulation);
  return simulation;
}
afterEach(() => {
  for (const simulation of simulations.splice(0)) simulation.dispose();
});

describe("Rapier ragdoll physics", () => {
  it("builds fifteen dynamic bodies and fourteen coherent spherical/hinge joints", async () => {
    const simulation = await makeSimulation();
    const bodies = simulation.getBodies();
    const joints = simulation.getJoints();
    expect(bodies).toHaveLength(15);
    expect(joints).toHaveLength(14);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(15);
    expect(joints.filter((joint) => joint.kind === "revolute")).toHaveLength(6);
    expect(joints.filter((joint) => joint.kind === "spherical")).toHaveLength(
      8,
    );
    for (const body of bodies) {
      expect(body.mass).toBeGreaterThan(0);
      expect(body.sleeping).toBe(false);
      expect(body.dimensions.x).toBeGreaterThan(0);
    }
    expect(simulation.getMetrics().maxJointError).toBeLessThan(0.000001);
    expect(simulation.getMetrics().contactCount).toBe(0);
  });

  it("falls under gravity without animation or externally supplied poses", async () => {
    const simulation = await makeSimulation();
    const start = simulation.getMetrics().centerOfMass.y;
    simulation.step(24);
    const metrics = simulation.getMetrics();
    const fallenDistance = start - metrics.centerOfMass.y;
    expect(metrics.elapsedTime).toBeCloseTo(0.2, 10);
    expect(fallenDistance).toBeGreaterThan(0.17);
    expect(fallenDistance).toBeLessThan(0.22);
    expect(metrics.groundContactCount).toBe(0);
    expect(metrics.averageSpeed).toBeGreaterThan(1.8);
    expect(metrics.kineticEnergy).toBeGreaterThan(50);
    for (const body of simulation.getBodies())
      expect(body.linearVelocity.y).toBeLessThan(-1.7);
  });

  it("makes real ground contacts and holds its joints together for ten seconds", async () => {
    const simulation = await makeSimulation();
    let maxError = 0;
    let groundContacts = 0;
    for (let i = 0; i < 1200; i++) {
      simulation.step();
      const metrics = simulation.getMetrics();
      maxError = Math.max(maxError, metrics.maxJointError);
      groundContacts = Math.max(groundContacts, metrics.groundContactCount);
      expect(Number.isFinite(metrics.kineticEnergy)).toBe(true);
      expect(metrics.maxSpeed).toBeLessThan(20);
      for (const body of simulation.getBodies()) {
        for (const value of [
          ...Object.values(body.position),
          ...Object.values(body.rotation),
        ]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        expect(body.position.y).toBeGreaterThan(-0.025);
        expect(body.position.y).toBeLessThan(simulation.bounds.height);
        expect(Math.abs(body.position.x)).toBeLessThan(
          simulation.bounds.halfWidth,
        );
        expect(Math.abs(body.position.z)).toBeLessThan(
          simulation.bounds.halfWidth,
        );
      }
    }
    expect(groundContacts).toBeGreaterThan(0);
    expect(maxError).toBeLessThan(0.01);
    expect(simulation.getMetrics().centerOfMass.y).toBeLessThan(0.6);
    expect(simulation.getMetrics().averageSpeed).toBeLessThan(0.1);
    expect(simulation.getMetrics().sleepingCount).toBe(15);
  });

  it("does not advance when the caller pauses, even across wall-clock time", async () => {
    const simulation = await makeSimulation();
    simulation.step(30);
    const bodies = simulation.getBodies();
    const metrics = simulation.getMetrics();
    await new Promise((resolve) => setTimeout(resolve, 35));
    simulation.step(0);
    expect(simulation.getBodies()).toEqual(bodies);
    expect(simulation.getMetrics()).toEqual(metrics);
    simulation.step();
    expect(simulation.getMetrics().stepCount).toBe(31);
  });

  it("resets all state and replays exactly the same deterministic trajectory", async () => {
    const simulation = await makeSimulation();
    const initial = simulation.getBodies();
    simulation.step(50);
    simulation.applyImpulse({ x: 3, y: 2, z: 8 });
    simulation.step(300);
    const first = simulation.getBodies();
    const firstMetrics = simulation.getMetrics();
    simulation.reset();
    expect(simulation.getBodies()).toEqual(initial);
    expect(simulation.getMetrics().stepCount).toBe(0);
    expect(simulation.getMetrics().contactCount).toBe(0);
    expect(simulation.getMetrics().kineticEnergy).toBe(0);
    simulation.step(50);
    simulation.applyImpulse({ x: 3, y: 2, z: 8 });
    simulation.step(300);
    expect(simulation.getBodies()).toEqual(first);
    expect(simulation.getMetrics()).toEqual(firstMetrics);
  });

  it("applies physical impulses and safely caps extreme input", async () => {
    const simulation = await makeSimulation();
    simulation.applyImpulse({ x: 14, y: 0, z: 0 }, "chest");
    const chest = simulation.getBodies().find((body) => body.id === "chest")!;
    expect(chest.linearVelocity.x).toBeCloseTo(1, 5);
    expect(simulation.getMetrics().kineticEnergy).toBeCloseTo(7, 4);
    simulation.step(60);
    expect(simulation.getMetrics().centerOfMass.x).toBeGreaterThan(0.08);
    simulation.reset();
    simulation.applyImpulse({ x: 1e9, y: 0, z: 0 }, "chest");
    expect(
      simulation.getBodies().find((body) => body.id === "chest")!.linearVelocity
        .x,
    ).toBeCloseTo(25 / 14, 5);
    expect(() => simulation.applyImpulse({ x: NaN, y: 0, z: 0 })).toThrow(
      RangeError,
    );
    expect(() => simulation.applyImpulse({ x: Infinity, y: 0, z: 0 })).toThrow(
      RangeError,
    );
  });

  it("stays finite and bounded under repeated off-centre pushes", async () => {
    const simulation = await makeSimulation();
    let worstError = 0;
    for (let i = 0; i < 1200; i++) {
      if (i % 120 === 0)
        simulation.applyImpulse(
          { x: 12, y: 4, z: -6 },
          i % 240 === 0 ? "leftHand" : "rightFoot",
        );
      simulation.step();
      const metrics = simulation.getMetrics();
      worstError = Math.max(worstError, metrics.maxJointError);
      expect(Number.isFinite(metrics.kineticEnergy)).toBe(true);
      for (const body of simulation.getBodies()) {
        expect(Math.abs(body.position.x)).toBeLessThan(6.1);
        expect(Math.abs(body.position.z)).toBeLessThan(6.1);
        expect(body.position.y).toBeGreaterThan(-0.05);
        expect(body.position.y).toBeLessThan(8.1);
      }
    }
    expect(worstError).toBeLessThan(0.05);
  });

  it("allows resting bodies to sleep and wakes a body for an impulse", async () => {
    const simulation = await makeSimulation();
    simulation.step(3600);
    expect(simulation.getMetrics().sleepingCount).toBeGreaterThan(0);
    simulation.applyImpulse();
    expect(
      simulation.getBodies().find((body) => body.id === "chest")!.sleeping,
    ).toBe(false);
    simulation.step(12);
    expect(simulation.getMetrics().kineticEnergy).toBeGreaterThan(0);
  });

  it("validates stepping, returns detached data, and frees native memory idempotently", async () => {
    const simulation = await makeSimulation();
    expect(() => simulation.step(-1)).toThrow(RangeError);
    expect(() => simulation.step(0.5)).toThrow(RangeError);
    expect(() => simulation.step(Infinity)).toThrow(RangeError);
    const body = simulation.getBodies()[0];
    body.position.y = -100;
    body.dimensions.x = 999;
    expect(simulation.getBodies()[0].position.y).toBeGreaterThan(0);
    expect(simulation.getBodies()[0].dimensions.x).toBeLessThan(1);
    simulation.dispose();
    simulation.free();
    expect(() => simulation.step()).toThrow(/disposed/);
    expect(() => simulation.getBodies()).toThrow(/disposed/);
    expect(() => simulation.reset()).toThrow(/disposed/);
    await expect(createRagdollSimulation({ spawnHeight: -1 })).rejects.toThrow(
      RangeError,
    );
  });
});
