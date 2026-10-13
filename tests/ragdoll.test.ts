import { afterEach, describe, expect, it } from "vitest";
import {
  createRagdollSimulation,
  type RagdollBodyState,
  type RagdollSimulation,
  type Vec3,
} from "../src/engine/ragdoll";

function rotate(v: Vec3, q: RagdollBodyState["rotation"]): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + q.y * tz - q.z * ty,
    y: v.y + q.w * ty + q.z * tx - q.x * tz,
    z: v.z + q.w * tz + q.x * ty - q.y * tx,
  };
}

/** Exact sphere/OBB signed distance, including the sphere-centre-inside-box case. */
function headChestSeparation(bodies: RagdollBodyState[]) {
  const head = bodies.find(({ id }) => id === "head")!;
  const chest = bodies.find(({ id }) => id === "chest")!;
  const q = chest.rotation;
  const local = rotate(
    {
      x: head.position.x - chest.position.x,
      y: head.position.y - chest.position.y,
      z: head.position.z - chest.position.z,
    },
    { x: -q.x, y: -q.y, z: -q.z, w: q.w },
  );
  const delta = {
    x: Math.abs(local.x) - chest.dimensions.x / 2,
    y: Math.abs(local.y) - chest.dimensions.y / 2,
    z: Math.abs(local.z) - chest.dimensions.z / 2,
  };
  return (
    Math.hypot(
      Math.max(delta.x, 0),
      Math.max(delta.y, 0),
      Math.max(delta.z, 0),
    ) +
    Math.min(Math.max(delta.x, delta.y, delta.z), 0) -
    head.radius!
  );
}

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
  it("grabs an exact off-centre collider point without teleporting and applies physical torque", async () => {
    const simulation = await makeSimulation({ tilt: 0 });
    const initial = simulation.getBodies();
    const head = initial.find(({ id }) => id === "head")!;
    const point = {
      x: head.position.x + head.radius!,
      y: head.position.y,
      z: head.position.z,
    };
    simulation.beginDrag("head", point);
    expect(simulation.getDragState()!.localAnchor.x).toBeCloseTo(
      head.radius!,
      6,
    );
    simulation.updateDragTarget({ ...point, z: point.z + 0.5 });
    expect(simulation.getBodies()).toEqual(initial);
    expect(simulation.getDragState()!.forceMagnitude).toBe(0);
    simulation.step();
    const moved = simulation.getBodies().find(({ id }) => id === "head")!;
    expect(Math.abs(moved.angularVelocity.y)).toBeGreaterThan(0.1);
    expect(simulation.getDragState()!.forceMagnitude).toBeGreaterThan(1);
    expect(simulation.getDragState()!.localAnchor.x).toBeCloseTo(
      head.radius!,
      6,
    );
    const offset = rotate(
      simulation.getDragState()!.localAnchor,
      moved.rotation,
    );
    expect(simulation.getDragState()!.worldAnchor.x).toBeCloseTo(
      moved.position.x + offset.x,
      6,
    );
    simulation.endDrag();
    expect(simulation.getDragState()).toBeNull();
  });

  it("keeps all fifteen surface-grabbed bodies finite with capped forces and coherent joints", async () => {
    const simulation = await makeSimulation();
    const ids = simulation.getBodies().map(({ id }) => id);
    let worstError = 0;
    for (const id of ids) {
      simulation.reset();
      const body = simulation.getBodies().find((part) => part.id === id)!;
      const offset = rotate(
        { x: body.dimensions.x / 2, y: 0, z: 0 },
        body.rotation,
      );
      const point = {
        x: body.position.x + offset.x,
        y: body.position.y + offset.y,
        z: body.position.z + offset.z,
      };
      simulation.beginDrag(id, point);
      const anchor = simulation.getDragState()!.localAnchor;
      for (let step = 0; step < 240; step++) {
        const t = step * simulation.fixedDt;
        simulation.updateDragTarget({
          x: point.x + 0.6 * Math.sin(t * 2),
          y: point.y + 0.8,
          z: point.z + 0.4 * Math.cos(t * 2),
        });
        simulation.step();
        const drag = simulation.getDragState()!;
        expect(drag.localAnchor).toEqual(anchor);
        expect(drag.forceMagnitude).toBeLessThanOrEqual(drag.maxForce + 1e-8);
        expect(drag.extension).toBeLessThanOrEqual(drag.maxExtension);
        expect(Object.values(drag.force).every(Number.isFinite)).toBe(true);
        const metrics = simulation.getMetrics();
        worstError = Math.max(worstError, metrics.maxJointError);
        expect(metrics.maxSpeed).toBeLessThan(20);
        expect(Number.isFinite(metrics.kineticEnergy)).toBe(true);
        for (const part of simulation.getBodies()) {
          expect(
            [
              ...Object.values(part.position),
              ...Object.values(part.rotation),
            ].every(Number.isFinite),
          ).toBe(true);
          expect(Math.abs(part.position.x)).toBeLessThan(6.1);
          expect(Math.abs(part.position.z)).toBeLessThan(6.1);
          expect(part.position.y).toBeGreaterThan(-0.05);
          expect(part.position.y).toBeLessThan(8.1);
        }
      }
      simulation.endDrag();
    }
    expect(worstError).toBeLessThan(0.05);
  }, 20000);

  it("preserves the picked surface point on low-lying hands and feet", async () => {
    const simulation = await makeSimulation();
    simulation.step(1200);
    let lowPicks = 0;
    for (const body of simulation
      .getBodies()
      .filter(({ id }) => /Hand|Foot/.test(id))) {
      for (const axis of ["x", "y", "z"] as const) {
        for (const sign of [-1, 1]) {
          const local = { x: 0, y: 0, z: 0 };
          local[axis] = (sign * body.dimensions[axis]) / 2;
          const offset = rotate(local, body.rotation);
          const point = {
            x: body.position.x + offset.x,
            y: body.position.y + offset.y,
            z: body.position.z + offset.z,
          };
          if (point.y >= 0.08) continue;
          lowPicks++;
          simulation.beginDrag(body.id, point);
          const state = simulation.getDragState()!;
          expect(state.worldAnchor.x).toBeCloseTo(point.x, 6);
          expect(state.worldAnchor.y).toBeCloseTo(point.y, 6);
          expect(state.worldAnchor.z).toBeCloseTo(point.z, 6);
          simulation.endDrag();
        }
      }
    }
    expect(lowPicks).toBeGreaterThan(0);
  });

  it("clamps extreme drag targets, validates picks, detaches state and clears release/reset/dispose", async () => {
    const simulation = await makeSimulation();
    const head = simulation.getBodies().find(({ id }) => id === "head")!;
    simulation.beginDrag("head", head.position);
    simulation.updateDragTarget({ x: 1e300, y: -1e300, z: -1e300 });
    let state = simulation.getDragState()!;
    expect(state.target.x).toBeLessThan(simulation.bounds.halfWidth);
    expect(state.target.z).toBeGreaterThan(-simulation.bounds.halfWidth);
    expect(state.target.y).toBeGreaterThanOrEqual(simulation.bounds.groundY);
    state.localAnchor.x = 999;
    state.target.x = 999;
    state.force.x = 999;
    state.worldAnchor.x = 999;
    state = simulation.getDragState()!;
    expect(state.localAnchor.x).not.toBe(999);
    expect(state.target.x).not.toBe(999);
    expect(state.worldAnchor.x).not.toBe(999);
    expect(state.force.x).toBe(0);
    simulation.step(120);
    expect(simulation.getDragState()!.forceMagnitude).toBeLessThanOrEqual(
      900 + 1e-8,
    );
    expect(() => simulation.updateDragTarget({ x: NaN, y: 0, z: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      simulation.beginDrag("head", { x: 0, y: Infinity, z: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      simulation.beginDrag("missing" as "head", head.position),
    ).toThrow(RangeError);
    simulation.endDrag();
    simulation.endDrag();
    simulation.updateDragTarget(head.position);
    expect(simulation.getDragState()).toBeNull();
    simulation.step(3600);
    expect(simulation.getMetrics().kineticEnergy).toBeLessThan(0.1);
    simulation.beginDrag(
      "head",
      simulation.getBodies().find(({ id }) => id === "head")!.position,
    );
    expect(
      simulation.getBodies().find(({ id }) => id === "head")!.sleeping,
    ).toBe(false);
    simulation.reset();
    expect(simulation.getDragState()).toBeNull();
    simulation.dispose();
    expect(() => simulation.getDragState()).toThrow(/disposed/);
    expect(() => simulation.beginDrag("head", head.position)).toThrow(
      /disposed/,
    );
  });

  it("replays dragging deterministically and reset removes an active grab", async () => {
    const simulation = await makeSimulation();
    const replay = () => {
      const hand = simulation.getBodies().find(({ id }) => id === "leftHand")!;
      simulation.beginDrag("leftHand", {
        ...hand.position,
        x: hand.position.x - 0.065,
      });
      simulation.updateDragTarget({ x: 1, y: 3, z: 0.7 });
      simulation.step(240);
      simulation.endDrag();
      simulation.step(120);
      return {
        bodies: simulation.getBodies(),
        metrics: simulation.getMetrics(),
      };
    };
    const first = replay();
    simulation.reset();
    expect(replay()).toEqual(first);
    simulation.beginDrag("chest", simulation.getBodies()[1].position);
    simulation.reset();
    expect(simulation.getDragState()).toBeNull();
  });

  it("rate-limits the physical target and survives alternating enclosure-corner requests", async () => {
    const simulation = await makeSimulation();
    const hand = simulation.getBodies().find(({ id }) => id === "leftHand")!;
    simulation.beginDrag("leftHand", {
      ...hand.position,
      x: hand.position.x - hand.dimensions.x / 2,
    });
    let previous = simulation.getDragState()!.springTarget;
    for (let step = 0; step < 600; step++) {
      const sign = Math.floor(step / 4) % 2 ? -1 : 1;
      simulation.updateDragTarget({
        x: sign * 1e10,
        y: sign * 1e10,
        z: -sign * 1e10,
      });
      simulation.step();
      const state = simulation.getDragState()!;
      expect(
        Math.hypot(
          state.springTarget.x - previous.x,
          state.springTarget.y - previous.y,
          state.springTarget.z - previous.z,
        ),
      ).toBeLessThanOrEqual(state.maxTargetSpeed * simulation.fixedDt + 1e-10);
      previous = state.springTarget;
      expect(state.forceMagnitude).toBeLessThanOrEqual(state.maxForce + 1e-8);
      expect(state.extension).toBeLessThanOrEqual(state.maxExtension);
      const metrics = simulation.getMetrics();
      expect(metrics.maxJointError).toBeLessThan(0.025);
      expect(metrics.maxSpeed).toBeLessThan(20);
      expect(Number.isFinite(metrics.kineticEnergy)).toBe(true);
    }
    simulation.endDrag();
    simulation.step(2400);
    expect(simulation.getMetrics().kineticEnergy).toBeLessThan(0.1);
  });

  it("reports actual self-contact pairs and keeps the head outside the chest", async () => {
    const simulation = await makeSimulation();
    const disabled = await makeSimulation({ selfCollision: false });
    const excluded = new Set(
      simulation
        .getJoints()
        .filter(({ id }) => id !== "neck")
        .map(({ bodyA, bodyB }) => [bodyA, bodyB].sort().join(":")),
    );
    const seen = new Set<string>();
    let worstEnabled = 0,
      worstDisabled = 0,
      disabledGround = 0;
    for (let step = 0; step < 1200; step++) {
      simulation.step();
      disabled.step();
      worstEnabled = Math.min(
        worstEnabled,
        headChestSeparation(simulation.getBodies()),
      );
      worstDisabled = Math.min(
        worstDisabled,
        headChestSeparation(disabled.getBodies()),
      );
      const contacts = simulation.getSelfContacts();
      const metrics = simulation.getMetrics();
      expect(metrics.selfContactCount).toBe(contacts.length);
      expect(metrics.selfContactPairCount).toBe(
        new Set(
          contacts.map(({ bodyA, bodyB }) => [bodyA, bodyB].sort().join(":")),
        ).size,
      );
      for (const contact of contacts) {
        const key = [contact.bodyA, contact.bodyB].sort().join(":");
        seen.add(key);
        expect(excluded.has(key)).toBe(false);
        expect(contact.distance).toBeLessThanOrEqual(0);
        expect(contact.penetration).toBe(-contact.distance);
        expect(Object.values(contact.point).every(Number.isFinite)).toBe(true);
      }
      const disabledMetrics = disabled.getMetrics();
      disabledGround = Math.max(
        disabledGround,
        disabledMetrics.groundContactCount,
      );
      expect(disabled.getSelfContacts()).toEqual([]);
      expect(disabledMetrics.selfContactCount).toBe(0);
      expect(disabledMetrics.selfCollisionEnabled).toBe(false);
    }
    expect(seen.has("chest:head")).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
    expect(worstEnabled).toBeGreaterThan(-0.025);
    expect(worstDisabled).toBeLessThan(-0.1); // Reproduces the former visible neck exclusion bug.
    expect(disabledGround).toBeGreaterThan(0); // Environment contacts must never fake self contacts.
    expect(simulation.getMetrics().selfCollisionEnabled).toBe(true);
  }, 20000);

  it("changes real collision filters at runtime while preserving the selected mode across reset", async () => {
    const simulation = await makeSimulation();
    simulation.step(24);
    simulation.setSelfCollision(false);
    simulation.step(1200);
    expect(simulation.getSelfContacts()).toEqual([]);
    expect(headChestSeparation(simulation.getBodies())).toBeLessThan(-0.1);
    expect(simulation.getMetrics().groundContactCount).toBeGreaterThan(0);
    simulation.reset();
    expect(simulation.getMetrics().selfCollisionEnabled).toBe(false);
    simulation.setSelfCollision(true);
    simulation.step(1200);
    expect(headChestSeparation(simulation.getBodies())).toBeGreaterThan(-0.025);
    expect(simulation.getMetrics().selfCollisionEnabled).toBe(true);
  });

  it("resists sustained head dragging into the chest without severe geometric overlap", async () => {
    const simulation = await makeSimulation({ spawnHeight: 0.3 });
    const head = simulation.getBodies().find(({ id }) => id === "head")!;
    simulation.beginDrag("head", {
      ...head.position,
      x: head.position.x + head.radius!,
    });
    let worstSeparation = 0;
    let actualHeadContacts = 0;
    for (let step = 0; step < 720; step++) {
      const chest = simulation.getBodies().find(({ id }) => id === "chest")!;
      simulation.updateDragTarget(chest.position);
      simulation.step();
      worstSeparation = Math.min(
        worstSeparation,
        headChestSeparation(simulation.getBodies()),
      );
      actualHeadContacts += simulation
        .getSelfContacts()
        .filter(
          ({ bodyA, bodyB }) =>
            [bodyA, bodyB].sort().join(":") === "chest:head",
        ).length;
      expect(simulation.getMetrics().maxJointError).toBeLessThan(0.025);
    }
    expect(actualHeadContacts).toBeGreaterThan(0);
    expect(worstSeparation).toBeGreaterThan(-0.025);
  });

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
