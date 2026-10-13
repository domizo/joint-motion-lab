import { useEffect, useRef, useState } from "react";
import type { DemoId, Language } from "../content/demos";
import { LabRenderer } from "../engine/renderer";
import { makeFrame } from "../engine/frame";
import type { RagdollSimulation } from "../engine/ragdoll";
export interface Snapshot {
  time: number;
  metrics: Record<string, number | string>;
  pose: number[];
  frames: number;
  status: string;
}
export interface SceneProps {
  id: DemoId;
  settings: Record<string, number>;
  playing: boolean;
  speed: number;
  animate: boolean;
  construction: boolean;
  visible: boolean;
  reset: number;
  push: number;
  front: boolean;
  language: Language;
  onTarget: (x: number, y: number) => void;
  onSnapshot: (snapshot: Snapshot) => void;
}
declare global {
  interface Window {
    __JOINT_LAB__?: () => Snapshot;
  }
}
export function SceneView(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props),
    [error, setError] = useState(""),
    [physicsError, setPhysicsError] = useState(""),
    [loading, setLoading] = useState(false);
  current.current = props;
  useEffect(() => {
    if (!host.current) return;
    let render: LabRenderer;
    try {
      render = new LabRenderer(host.current, (x, y) =>
        current.current.onTarget(x, y),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "WebGL initialization failed");
      return;
    }
    let alive = true,
      raf = 0,
      time = 0,
      last = performance.now(),
      notify = 0,
      frames = 0,
      accumulator = 0,
      lastId = current.current.id,
      lastReset = current.current.reset,
      lastPush = current.current.push,
      lastFront = current.current.front,
      sim: RagdollSimulation | undefined,
      loadingPhysics = false,
      physicsFailed = false,
      visible = true;
    let snapshot: Snapshot = {
      time: 0,
      metrics: {},
      pose: [],
      frames: 0,
      status: "ready",
    };
    window.__JOINT_LAB__ = () => snapshot;
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    observer.observe(host.current);
    const startPhysics = async () => {
      loadingPhysics = true;
      setLoading(true);
      setPhysicsError("");
      try {
        const { createRagdollSimulation } = await import("../engine/ragdoll");
        const next = await createRagdollSimulation();
        if (!alive) {
          next.dispose();
          return;
        }
        sim = next;
        loadingPhysics = false;
        setLoading(false);
      } catch (e) {
        if (alive) {
          physicsFailed = true;
          loadingPhysics = false;
          setPhysicsError(String(e));
          setLoading(false);
        }
      }
    };
    const tick = (now: number) => {
      if (!alive) return;
      const p = current.current,
        dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (p.id !== lastId) {
        time = 0;
        accumulator = 0;
        lastPush = p.push;
        lastId = p.id;
        physicsFailed = false;
        setPhysicsError("");
        sim?.reset();
        render.home(p.front);
        snapshot = { time: 0, metrics: {}, pose: [], frames, status: "ready" };
        p.onSnapshot(snapshot);
      }
      if (p.reset !== lastReset) {
        time = 0;
        accumulator = 0;
        lastPush = p.push;
        sim?.reset();
        lastReset = p.reset;
        physicsFailed = false;
        setPhysicsError("");
        render.home(p.front);
      }
      if (p.front !== lastFront) {
        render.home(p.front);
        lastFront = p.front;
      }
      if (p.push !== lastPush && p.id === "ragdoll" && sim) {
        sim?.applyImpulse({ x: p.settings.push ?? 2, y: 0.5, z: 1 });
        lastPush = p.push;
      }
      if (p.visible && visible && !document.hidden) {
        if (p.id === "ragdoll" && !sim && !loadingPhysics && !physicsFailed)
          void startPhysics();
        if (p.playing) {
          if (p.id !== "ragdoll") time += dt * p.speed;
          else if (sim) {
            accumulator += dt * p.speed;
            let count = 0;
            while (accumulator >= sim.fixedDt && count < 24) {
              sim.step();
              accumulator -= sim.fixedDt;
              count++;
            }
            time = sim.getMetrics().elapsedTime;
          }
        }
        if (p.id === "ragdoll" && sim) {
          const bodies = sim.getBodies(),
            m = sim.getMetrics();
          render.setRagdoll(bodies, p.construction, sim.getJoints());
          snapshot = {
            time,
            metrics: {
              contacts: m.groundContactCount,
              jointError: m.maxJointError,
              energy: m.kineticEnergy,
              sleeping: m.sleepingCount,
            },
            pose: bodies.flatMap((b) => [
              b.position.x,
              b.position.y,
              b.position.z,
            ]),
            frames: ++frames,
            status: "physics",
          };
        } else if (p.id !== "ragdoll") {
          const f = makeFrame(
            p.id,
            p.settings,
            time,
            p.animate,
            p.construction,
          );
          render.setFrame(f);
          snapshot = {
            time,
            metrics: f.metrics,
            pose: f.pose,
            frames: ++frames,
            status: "kinematic",
          };
        }
        render.render();
        if (now - notify > 100) {
          p.onSnapshot(snapshot);
          notify = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      sim?.dispose();
      render.dispose();
      delete window.__JOINT_LAB__;
    };
  }, []);
  return (
    <div ref={host} className="scene-host" data-testid="scene">
      {loading && props.id === "ragdoll" && (
        <div className="scene-status" role="status">
          {props.language === "ja"
            ? "物理エンジンを読み込み中…"
            : "Loading the physics engine…"}
        </div>
      )}
      {physicsError && props.id === "ragdoll" && (
        <div className="scene-status scene-error" role="alert">
          <strong>
            {props.language === "ja"
              ? "物理エンジンを読み込めません"
              : "Physics could not load"}
          </strong>
          <p>
            {props.language === "ja"
              ? "リセットで再試行できます。他のデモとガイドは引き続き使えます。"
              : "Use Reset to retry. The other demos and Guide remain available."}
          </p>
          <details>
            <summary>Details</summary>
            {physicsError}
          </details>
        </div>
      )}
      {error && (
        <div className="scene-status scene-error" role="alert">
          <strong>
            {props.language === "ja"
              ? "3D を表示できません"
              : "3D is unavailable"}
          </strong>
          <p>
            {props.language === "ja"
              ? "WebGL2 対応のブラウザで、ハードウェアアクセラレーションを有効にして開いてください。ガイドは引き続き読めます。"
              : "Open with a WebGL2-capable browser and hardware acceleration enabled. The guide remains available."}
          </p>
          <details>
            <summary>Details</summary>
            {error}
          </details>
        </div>
      )}
    </div>
  );
}
