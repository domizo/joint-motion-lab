import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Line as ThreeLine,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Frame } from "./frame";
import type { RagdollBodyState } from "./ragdoll";
import { V, terrainHeight } from "./kinematics";
export class LabRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 1, 0.01, 100);
  readonly orbit: OrbitControls;
  private stage = new Group();
  private bones: Mesh[] = [];
  private markers: Mesh[] = [];
  private lines: ThreeLine[] = [];
  private bodies = new Map<string, Mesh>();
  private materials = new Map<string, MeshStandardMaterial>();
  private cylinder = new CylinderGeometry(1, 1, 1, 16);
  private sphere = new SphereGeometry(1, 20, 16);
  private box = new BoxGeometry(1, 1, 1);
  private floor: Mesh;
  private contactPlatform: Mesh;
  private grid: GridHelper;
  private terrain: Mesh;
  private ray = new Raycaster();
  private target?: Vector3;
  private targetMarker?: Mesh;
  private drag = false;
  private disposed = false;
  private focus = V(0.35, 1.3);
  private resize: ResizeObserver;
  private plane = new Plane(V(0, 0, 1), 0);
  private frames = 0;
  constructor(
    readonly host: HTMLElement,
    readonly onTarget: (x: number, y: number) => void,
  ) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0xf5f6f1);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D joint demonstration",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.dataset.webgl = "ready";
    host.appendChild(this.renderer.domElement);
    this.scene.fog = new Fog(0xf5f6f1, 14, 32);
    this.scene.add(
      this.stage,
      new AmbientLight(0xffffff, 1.1),
      new HemisphereLight(0xffffff, 0x7d8879, 2),
    );
    const sun = new DirectionalLight(0xffffff, 3.4);
    sun.position.set(-2, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.floor = new Mesh(new PlaneGeometry(80, 80), this.material(0xe9ece3));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.contactPlatform = new Mesh(this.box, this.material(0xe0e7d2));
    this.contactPlatform.receiveShadow = true;
    this.contactPlatform.visible = false;
    this.scene.add(this.contactPlatform);
    this.grid = new GridHelper(80, 160, 0xb6beb0, 0xd5dbd0);
    this.grid.position.y = 0.002;
    this.scene.add(this.grid);
    this.terrain = new Mesh(
      new PlaneGeometry(20, 5, 160, 1),
      this.material(0xe4e9d7),
    );
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.receiveShadow = true;
    this.terrain.visible = false;
    this.scene.add(this.terrain);
    this.camera.position.set(4.6, 3.5, 6.8);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.copy(this.focus);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 3;
    this.orbit.maxDistance = 12;
    this.orbit.maxPolarAngle = Math.PI * 0.49;
    this.orbit.enablePan = false;
    this.orbit.update();
    this.resize = new ResizeObserver(() => this.setSize());
    this.resize.observe(host);
    this.setSize();
    this.renderer.domElement.addEventListener("pointerdown", this.down, true);
    this.renderer.domElement.addEventListener("pointermove", this.move);
    this.renderer.domElement.addEventListener("pointerup", this.up);
    this.renderer.domElement.addEventListener("pointercancel", this.up);
  }
  private material(color: number, ghost = false) {
    const key = color + "-" + ghost;
    let m = this.materials.get(key);
    if (!m) {
      m = new MeshStandardMaterial({
        color,
        metalness: 0.3,
        roughness: 0.34,
        transparent: ghost,
        opacity: ghost ? 0.32 : 1,
        wireframe: ghost,
      });
      this.materials.set(key, m);
    }
    return m;
  }
  private setSize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  private pointer(event: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new Vector2(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
  }
  private down = (e: PointerEvent) => {
    if (!this.targetMarker || !this.target) return;
    this.pointer(e);
    const hit = this.ray.intersectObject(this.targetMarker);
    const rect = this.renderer.domElement.getBoundingClientRect(),
      projected = this.target.clone().project(this.camera),
      px = rect.left + ((projected.x + 1) * rect.width) / 2,
      py = rect.top + ((1 - projected.y) * rect.height) / 2;
    const touchHit = Math.hypot(e.clientX - px, e.clientY - py) <= 22;
    if (hit.length || touchHit) {
      this.drag = true;
      this.orbit.enabled = false;
      this.renderer.domElement.setPointerCapture(e.pointerId);
      this.plane.set(V(0, 0, 1), -this.target.z);
      e.stopImmediatePropagation();
    }
  };
  private move = (e: PointerEvent) => {
    this.pointer(e);
    if (this.drag) {
      const point = this.ray.ray.intersectPlane(this.plane, V());
      if (point)
        this.onTarget(
          Math.min(3.6, Math.max(-0.8, point.x)),
          Math.min(3.5, Math.max(0.1, point.y)),
        );
    } else {
      const hit =
        this.targetMarker && this.ray.intersectObject(this.targetMarker).length;
      this.renderer.domElement.style.cursor = hit ? "grab" : "default";
    }
  };
  private up = () => {
    this.drag = false;
    this.orbit.enabled = true;
  };
  setFrame(f: Frame) {
    this.bodies.forEach((m) => (m.visible = false));
    this.target = f.target;
    this.targetMarker = undefined;
    f.segments.forEach((s, i) => {
      let mesh = this.bones[i];
      if (!mesh) {
        mesh = new Mesh(this.cylinder);
        mesh.castShadow = true;
        this.stage.add(mesh);
        this.bones.push(mesh);
      }
      mesh.visible = true;
      mesh.material = this.material(s.color ?? 0x3c4640, s.ghost);
      const delta = s.b.clone().sub(s.a);
      mesh.position.copy(s.a).lerp(s.b, 0.5);
      mesh.quaternion.setFromUnitVectors(V(0, 1), delta.normalize());
      mesh.scale.set(s.radius ?? 0.08, s.a.distanceTo(s.b), s.radius ?? 0.08);
    });
    this.bones.slice(f.segments.length).forEach((m) => (m.visible = false));
    f.markers.forEach((s, i) => {
      let mesh = this.markers[i];
      if (!mesh) {
        mesh = new Mesh(this.sphere);
        mesh.castShadow = true;
        this.stage.add(mesh);
        this.markers.push(mesh);
      }
      mesh.visible = true;
      mesh.position.copy(s.position);
      mesh.material = this.material(s.color);
      mesh.scale.setScalar(s.size ?? 0.12);
      if (s.type === "target") this.targetMarker = mesh;
    });
    this.markers.slice(f.markers.length).forEach((m) => (m.visible = false));
    this.updateLines(f.lines);
    this.follow(f.focus);
    this.floor.position.y = 0;
    this.grid.position.y = 0.003;
    this.contactPlatform.visible = (f.ground ?? 0) > 0;
    if (this.contactPlatform.visible) {
      const contact = f.markers.find((m) => m.type === "contact");
      this.contactPlatform.position.set(
        contact?.position.x ?? 1,
        (f.ground ?? 0) / 2,
        0,
      );
      this.contactPlatform.scale.set(0.85, f.ground ?? 0, 0.8);
    }
    this.terrain.visible = f.terrain !== undefined && f.terrain > 0;
    if (this.terrain.visible) {
      this.terrain.position.x = Math.floor(f.focus.x / 4) * 4;
      const pos = this.terrain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++)
        pos.setZ(
          i,
          terrainHeight(pos.getX(i) + this.terrain.position.x, f.terrain!),
        );
      pos.needsUpdate = true;
      this.terrain.geometry.computeVertexNormals();
    }
  }
  private updateLines(lines: Frame["lines"]) {
    lines.forEach((l, i) => {
      let line = this.lines[i];
      if (!line) {
        line = new ThreeLine(new BufferGeometry(), new LineBasicMaterial());
        this.stage.add(line);
        this.lines.push(line);
      }
      line.visible = true;
      line.geometry.dispose();
      line.geometry = new BufferGeometry().setFromPoints(l.points);
      (line.material as LineBasicMaterial).color.setHex(l.color);
    });
    this.lines.slice(lines.length).forEach((l) => (l.visible = false));
  }
  setRagdoll(
    bodies: RagdollBodyState[],
    construction: boolean,
    joints: {
      anchorA: { x: number; y: number; z: number };
      anchorB: { x: number; y: number; z: number };
    }[],
  ) {
    this.bones.forEach((m) => (m.visible = false));
    this.markers.forEach((m) => (m.visible = false));
    this.target = undefined;
    this.targetMarker = undefined;
    this.floor.position.y = 0;
    this.grid.position.y = 0.003;
    this.terrain.visible = false;
    this.contactPlatform.visible = false;
    for (const b of bodies) {
      let mesh = this.bodies.get(b.id);
      if (!mesh) {
        let geometry: BufferGeometry = this.box;
        if (b.shape === "capsule")
          geometry = new CapsuleGeometry(b.radius!, b.halfHeight! * 2, 8, 16);
        if (b.shape === "sphere") geometry = this.sphere;
        mesh = new Mesh(
          geometry,
          this.material(b.id === "chest" ? 0xb8d955 : 0x434d47),
        );
        mesh.castShadow = true;
        this.stage.add(mesh);
        this.bodies.set(b.id, mesh);
      }
      mesh.visible = true;
      mesh.position.set(b.position.x, b.position.y, b.position.z);
      mesh.quaternion.set(
        b.rotation.x,
        b.rotation.y,
        b.rotation.z,
        b.rotation.w,
      );
      if (b.shape === "box")
        mesh.scale.set(b.dimensions.x, b.dimensions.y, b.dimensions.z);
      if (b.shape === "sphere") mesh.scale.setScalar(b.radius!);
    }
    if (construction)
      joints.forEach((joint, i) => {
        let marker = this.markers[i];
        if (!marker) {
          marker = new Mesh(this.sphere, this.material(0x967be1));
          this.stage.add(marker);
          this.markers.push(marker);
        }
        marker.visible = true;
        marker.material = this.material(0x967be1);
        marker.scale.setScalar(0.045);
        marker.position.set(joint.anchorA.x, joint.anchorA.y, joint.anchorA.z);
      });
    this.updateLines(
      construction
        ? joints.map((j) => ({
            points: [
              V(j.anchorA.x, j.anchorA.y, j.anchorA.z),
              V(j.anchorB.x, j.anchorB.y, j.anchorB.z),
            ],
            color: 0x967be1,
          }))
        : [],
    );
    this.follow(V(0, 1));
  }
  private follow(focus: Vector3) {
    const delta = focus.clone().sub(this.focus);
    this.camera.position.add(delta);
    this.orbit.target.add(delta);
    this.focus.copy(focus);
    this.floor.position.x = Math.floor(focus.x / 10) * 10;
    this.grid.position.x = Math.floor(focus.x / 2) * 2;
  }
  home(front = false) {
    this.orbit.target.copy(this.focus);
    this.camera.position
      .copy(this.focus)
      .add(front ? V(0, 0.5, 7.8) : V(4.2, 2.5, 6.8));
    this.orbit.update();
  }
  render() {
    if (this.disposed) return;
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.renderer.domElement.dataset.frames = String(this.frames);
  }
  dispose() {
    this.disposed = true;
    this.resize.disconnect();
    this.orbit.dispose();
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.down,
      true,
    );
    this.renderer.domElement.removeEventListener("pointermove", this.move);
    this.renderer.domElement.removeEventListener("pointerup", this.up);
    this.renderer.domElement.removeEventListener("pointercancel", this.up);
    this.scene.traverse((o) => {
      if (o instanceof Mesh || o instanceof ThreeLine) {
        o.geometry.dispose();
      }
    });
    this.materials.forEach((m) => m.dispose());
    this.lines.forEach((line) =>
      (line.material as LineBasicMaterial).dispose(),
    );
    this.grid.geometry.dispose();
    (this.grid.material as LineBasicMaterial).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
