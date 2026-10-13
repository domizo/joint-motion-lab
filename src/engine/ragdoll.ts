import RAPIER from "@dimforge/rapier3d-compat";

/** SI units throughout: metres, seconds, kilograms, radians and newton-seconds. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Quat extends Vec3 {
  w: number;
}
export type RagdollBodyId =
  | "pelvis"
  | "chest"
  | "head"
  | "leftUpperArm"
  | "leftForearm"
  | "leftHand"
  | "rightUpperArm"
  | "rightForearm"
  | "rightHand"
  | "leftThigh"
  | "leftShin"
  | "leftFoot"
  | "rightThigh"
  | "rightShin"
  | "rightFoot";

export interface RagdollBodyState {
  id: RagdollBodyId;
  label: string;
  shape: "box" | "capsule" | "sphere";
  /** Full extents, not half extents. Capsules are aligned with local +Y. */
  dimensions: Vec3;
  radius?: number;
  /** Half length of the capsule's cylindrical segment, excluding its caps. */
  halfHeight?: number;
  position: Vec3;
  rotation: Quat;
  linearVelocity: Vec3;
  angularVelocity: Vec3;
  mass: number;
  sleeping: boolean;
}

export interface RagdollJointState {
  id: string;
  label: string;
  kind: "spherical" | "revolute";
  bodyA: RagdollBodyId;
  bodyB: RagdollBodyId;
  anchorA: Vec3;
  anchorB: Vec3;
  error: number;
  limits?: [number, number];
}

export interface RagdollMetrics {
  elapsedTime: number;
  stepCount: number;
  bodyCount: number;
  jointCount: number;
  /** Number of real solver contact points, counting each collider pair once. */
  contactCount: number;
  groundContactCount: number;
  maxJointError: number;
  averageSpeed: number;
  maxSpeed: number;
  /** Sum of translational and rotational kinetic energy, in joules. */
  kineticEnergy: number;
  sleepingCount: number;
  centerOfMass: Vec3;
}

export interface RagdollOptions {
  /** Height added to the initial standing pose, in metres. Default 1.1. */
  spawnHeight?: number;
  /** Initial whole-body forward lean, in radians. Default 0.16. */
  tilt?: number;
}

export interface RagdollSimulation {
  readonly fixedDt: number;
  readonly bounds: { halfWidth: number; height: number; groundY: number };
  /** Advances exactly this many fixed steps. A paused caller simply stops calling it. */
  step(steps?: number): void;
  /** Rebuilds the entire world, including solver caches, for deterministic replay. */
  reset(): void;
  /** Applies an impulse at a body's centre of mass. Magnitude is capped at 25 Ns. */
  applyImpulse(impulse?: Vec3, bodyId?: RagdollBodyId): void;
  getBodies(): RagdollBodyState[];
  getJoints(): RagdollJointState[];
  getMetrics(): RagdollMetrics;
  dispose(): void;
  free(): void;
}

interface PartDefinition {
  id: RagdollBodyId;
  label: string;
  shape: RagdollBodyState["shape"];
  dimensions: Vec3;
  radius?: number;
  halfHeight?: number;
  position: Vec3;
  mass: number;
}
interface JointDefinition {
  id: string;
  label: string;
  kind: RagdollJointState["kind"];
  bodyA: RagdollBodyId;
  bodyB: RagdollBodyId;
  anchor: Vec3;
  limits?: [number, number];
}
interface Part {
  definition: PartDefinition;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}
interface Connection {
  definition: JointDefinition;
  joint: RAPIER.ImpulseJoint;
  a: Part;
  b: Part;
}

const V = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => V(a.x - b.x, a.y - b.y, a.z - b.z);
const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);
const inverse = (q: Quat): Quat => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
function rotate(v: Vec3, q: Quat): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return V(
    v.x + q.w * tx + q.y * tz - q.z * ty,
    v.y + q.w * ty + q.z * tx - q.x * tz,
    v.z + q.w * tz + q.x * ty - q.y * tx,
  );
}

function definitions(): { parts: PartDefinition[]; joints: JointDefinition[] } {
  const parts: PartDefinition[] = [
    {
      id: "pelvis",
      label: "Pelvis",
      shape: "box",
      dimensions: V(0.42, 0.26, 0.3),
      position: V(0, 1.0, 0),
      mass: 9,
    },
    {
      id: "chest",
      label: "Chest",
      shape: "box",
      dimensions: V(0.54, 0.54, 0.3),
      position: V(0, 1.4, 0),
      mass: 14,
    },
    {
      id: "head",
      label: "Head",
      shape: "sphere",
      dimensions: V(0.4, 0.4, 0.4),
      radius: 0.2,
      position: V(0, 1.93, 0),
      mass: 4.5,
    },
  ];
  const joints: JointDefinition[] = [
    {
      id: "spine",
      label: "Spine",
      kind: "spherical",
      bodyA: "pelvis",
      bodyB: "chest",
      anchor: V(0, 1.14, 0),
    },
    {
      id: "neck",
      label: "Neck",
      kind: "spherical",
      bodyA: "chest",
      bodyB: "head",
      anchor: V(0, 1.71, 0),
    },
  ];
  for (const [side, sign] of [
    ["left", -1],
    ["right", 1],
  ] as const) {
    const label = side === "left" ? "Left" : "Right";
    const armX = sign * 0.4;
    const legX = sign * 0.13;
    const capsule = (
      id: RagdollBodyId,
      name: string,
      position: Vec3,
      radius: number,
      halfHeight: number,
      mass: number,
    ) => {
      parts.push({
        id,
        label: `${label} ${name}`,
        shape: "capsule",
        radius,
        halfHeight,
        dimensions: V(radius * 2, (halfHeight + radius) * 2, radius * 2),
        position,
        mass,
      });
    };
    capsule(`${side}UpperArm`, "upper arm", V(armX, 1.4, 0), 0.085, 0.115, 2.4);
    capsule(`${side}Forearm`, "forearm", V(armX, 1.005, 0), 0.07, 0.105, 1.6);
    parts.push({
      id: `${side}Hand`,
      label: `${label} hand`,
      shape: "box",
      dimensions: V(0.13, 0.18, 0.1),
      position: V(armX, 0.74, 0),
      mass: 0.7,
    });
    capsule(`${side}Thigh`, "thigh", V(legX, 0.72, 0), 0.105, 0.105, 5.2);
    capsule(`${side}Shin`, "shin", V(legX, 0.31, 0), 0.085, 0.105, 3.0);
    parts.push({
      id: `${side}Foot`,
      label: `${label} foot`,
      shape: "box",
      dimensions: V(0.18, 0.13, 0.32),
      position: V(legX, 0.075, 0.07),
      mass: 1.0,
    });
    joints.push(
      {
        id: `${side}Shoulder`,
        label: `${label} shoulder`,
        kind: "spherical",
        bodyA: "chest",
        bodyB: `${side}UpperArm`,
        anchor: V(armX, 1.6, 0),
      },
      {
        id: `${side}Elbow`,
        label: `${label} elbow`,
        kind: "revolute",
        bodyA: `${side}UpperArm`,
        bodyB: `${side}Forearm`,
        anchor: V(armX, 1.2, 0),
        limits: [-2.4, 0.05],
      },
      {
        id: `${side}Wrist`,
        label: `${label} wrist`,
        kind: "spherical",
        bodyA: `${side}Forearm`,
        bodyB: `${side}Hand`,
        anchor: V(armX, 0.825, 0),
      },
      {
        id: `${side}Hip`,
        label: `${label} hip`,
        kind: "spherical",
        bodyA: "pelvis",
        bodyB: `${side}Thigh`,
        anchor: V(legX, 0.935, 0),
      },
      {
        id: `${side}Knee`,
        label: `${label} knee`,
        kind: "revolute",
        bodyA: `${side}Thigh`,
        bodyB: `${side}Shin`,
        anchor: V(legX, 0.51, 0),
        limits: [-0.05, 2.35],
      },
      {
        id: `${side}Ankle`,
        label: `${label} ankle`,
        kind: "revolute",
        bodyA: `${side}Shin`,
        bodyB: `${side}Foot`,
        anchor: V(legX, 0.115, 0),
        limits: [-0.5, 0.5],
      },
    );
  }
  return { parts, joints };
}

let rapierReady: Promise<void> | undefined;

/**
 * Real Rapier rigid-body dynamics. No animation poses, timers or kinematic overrides.
 * Spherical joints deliberately allow unrestricted rotation; this is a joint demo,
 * not a medical/anatomical model. Adjacent segments have collisions disabled while
 * non-adjacent segments keep self-collision. See https://rapier.rs/docs/user_guides/javascript/joints/.
 */
export async function createRagdollSimulation(
  options: RagdollOptions = {},
): Promise<RagdollSimulation> {
  const spawnHeight = options.spawnHeight ?? 1.1;
  const tilt = options.tilt ?? 0.16;
  if (!Number.isFinite(spawnHeight) || spawnHeight < 0.15 || spawnHeight > 4) {
    throw new RangeError("spawnHeight must be between 0.15 and 4 metres");
  }
  if (!Number.isFinite(tilt) || Math.abs(tilt) > 0.6)
    throw new RangeError("tilt must be between -0.6 and 0.6 radians");
  rapierReady ??= RAPIER.init().catch((error: unknown) => {
    rapierReady = undefined;
    throw error;
  });
  await rapierReady;

  const fixedDt = 1 / 120;
  const bounds = Object.freeze({ halfWidth: 6, height: 8, groundY: 0 });
  const model = definitions();
  let world: RAPIER.World;
  let parts: Part[] = [];
  let connections: Connection[] = [];
  let ground: RAPIER.Collider;
  let steps = 0;
  let disposed = false;
  const assertAlive = () => {
    if (disposed) throw new Error("Ragdoll simulation has been disposed");
  };

  function build() {
    world = new RAPIER.World(V(0, -9.81, 0));
    world.timestep = fixedDt;
    world.numSolverIterations = 12;
    world.numInternalPgsIterations = 2;
    world.maxCcdSubsteps = 2;
    ground = world.createCollider(
      RAPIER.ColliderDesc.cuboid(6.25, 0.25, 6.25)
        .setTranslation(0, -0.25, 0)
        .setFriction(0.85)
        .setRestitution(0),
    );
    // A distant physical enclosure keeps repeated user impulses in a finite sandbox.
    for (const side of [-1, 1]) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.25, 4, 6.25).setTranslation(
          side * 6.25,
          4,
          0,
        ),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(6.25, 4, 0.25).setTranslation(
          0,
          4,
          side * 6.25,
        ),
      );
    }
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(6.25, 0.25, 6.25).setTranslation(0, 8.25, 0),
    );
    const rotation: Quat = {
      x: Math.sin(tilt / 2),
      y: 0,
      z: 0,
      w: Math.cos(tilt / 2),
    };
    parts = model.parts.map((definition) => {
      const position = add(
        rotate(definition.position, rotation),
        V(0, spawnHeight, 0),
      );
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setRotation(rotation)
          .setCanSleep(true)
          .setCcdEnabled(true)
          .setLinearDamping(0.18)
          .setAngularDamping(0.75),
      );
      let desc: RAPIER.ColliderDesc;
      if (definition.shape === "sphere")
        desc = RAPIER.ColliderDesc.ball(definition.radius!);
      else if (definition.shape === "capsule")
        desc = RAPIER.ColliderDesc.capsule(
          definition.halfHeight!,
          definition.radius!,
        );
      else
        desc = RAPIER.ColliderDesc.cuboid(
          definition.dimensions.x / 2,
          definition.dimensions.y / 2,
          definition.dimensions.z / 2,
        );
      const collider = world.createCollider(
        desc.setMass(definition.mass).setFriction(0.7).setRestitution(0.02),
        body,
      );
      return { definition, body, collider };
    });
    const byId = new Map(parts.map((part) => [part.definition.id, part]));
    connections = model.joints.map((definition) => {
      const a = byId.get(definition.bodyA)!;
      const b = byId.get(definition.bodyB)!;
      const anchorA = sub(definition.anchor, a.definition.position);
      const anchorB = sub(definition.anchor, b.definition.position);
      const data =
        definition.kind === "spherical"
          ? RAPIER.JointData.spherical(anchorA, anchorB)
          : RAPIER.JointData.revolute(anchorA, anchorB, V(1, 0, 0));
      const joint = world.createImpulseJoint(data, a.body, b.body, true);
      joint.setContactsEnabled(false);
      if (definition.limits)
        (joint as RAPIER.RevoluteImpulseJoint).setLimits(...definition.limits);
      return { definition, joint, a, b };
    });
    steps = 0;
  }
  build();

  const getJoints = (): RagdollJointState[] => {
    assertAlive();
    return connections.map(({ definition, joint, a, b }) => {
      const anchorA = add(
        a.body.translation(),
        rotate(joint.anchor1(), a.body.rotation()),
      );
      const anchorB = add(
        b.body.translation(),
        rotate(joint.anchor2(), b.body.rotation()),
      );
      return {
        id: definition.id,
        label: definition.label,
        kind: definition.kind,
        bodyA: definition.bodyA,
        bodyB: definition.bodyB,
        anchorA,
        anchorB,
        error: length(sub(anchorA, anchorB)),
        limits: definition.limits ? [...definition.limits] : undefined,
      };
    });
  };
  const dispose = () => {
    if (disposed) return;
    world.free();
    parts = [];
    connections = [];
    disposed = true;
  };

  return {
    fixedDt,
    bounds,
    step(count = 1) {
      assertAlive();
      if (!Number.isInteger(count) || count < 0 || count > 12000)
        throw new RangeError("steps must be an integer from 0 to 12000");
      for (let i = 0; i < count; i++) {
        world.step();
        steps++;
      }
    },
    reset() {
      assertAlive();
      world.free();
      build();
    },
    applyImpulse(impulse = V(3, 4, 10), bodyId = "chest") {
      assertAlive();
      if (![impulse.x, impulse.y, impulse.z].every(Number.isFinite))
        throw new RangeError("Impulse must contain finite numbers");
      const part = parts.find((p) => p.definition.id === bodyId);
      if (!part) throw new RangeError(`Unknown body: ${bodyId}`);
      const magnitude = length(impulse);
      const factor = magnitude > 25 ? 25 / magnitude : 1;
      part.body.applyImpulse(
        V(impulse.x * factor, impulse.y * factor, impulse.z * factor),
        true,
      );
    },
    getBodies() {
      assertAlive();
      return parts.map(({ definition, body }) => ({
        ...definition,
        dimensions: { ...definition.dimensions },
        position: { ...body.translation() },
        rotation: { ...body.rotation() },
        linearVelocity: { ...body.linvel() },
        angularVelocity: { ...body.angvel() },
        mass: body.mass(),
        sleeping: body.isSleeping(),
      }));
    },
    getJoints,
    getMetrics() {
      assertAlive();
      let contactCount = 0;
      let groundContactCount = 0;
      let kineticEnergy = 0;
      let totalSpeed = 0;
      let maxSpeed = 0;
      let sleepingCount = 0;
      let totalMass = 0;
      const centerOfMass = V();
      const seen = new Set<string>();
      for (const { body, collider } of parts) {
        const velocity = body.linvel();
        const speed = length(velocity);
        totalSpeed += speed;
        maxSpeed = Math.max(maxSpeed, speed);
        const mass = body.mass();
        totalMass += mass;
        const position = body.worldCom();
        centerOfMass.x += mass * position.x;
        centerOfMass.y += mass * position.y;
        centerOfMass.z += mass * position.z;
        const inertia = body.principalInertia();
        const localOmega = rotate(body.angvel(), inverse(body.rotation()));
        const omega = rotate(
          localOmega,
          inverse(body.principalInertiaLocalFrame()),
        );
        kineticEnergy +=
          0.5 *
          (mass * speed * speed +
            inertia.x * omega.x ** 2 +
            inertia.y * omega.y ** 2 +
            inertia.z * omega.z ** 2);
        if (body.isSleeping()) sleepingCount++;
        world.contactPairsWith(collider, (other) => {
          const pairKey =
            collider.handle < other.handle
              ? `${collider.handle}:${other.handle}`
              : `${other.handle}:${collider.handle}`;
          if (seen.has(pairKey)) return;
          seen.add(pairKey);
          world.contactPair(collider, other, (manifold) => {
            // Broad-phase proximity alone is not a contact. Use actual solver points.
            const count = manifold.numSolverContacts();
            contactCount += count;
            if (other.handle === ground.handle) groundContactCount += count;
          });
        });
      }
      centerOfMass.x /= totalMass;
      centerOfMass.y /= totalMass;
      centerOfMass.z /= totalMass;
      return {
        elapsedTime: steps * fixedDt,
        stepCount: steps,
        bodyCount: parts.length,
        jointCount: connections.length,
        contactCount,
        groundContactCount,
        maxJointError: Math.max(0, ...getJoints().map((joint) => joint.error)),
        averageSpeed: totalSpeed / parts.length,
        maxSpeed,
        kineticEnergy,
        sleepingCount,
        centerOfMass,
      };
    },
    dispose,
    free: dispose,
  };
}
