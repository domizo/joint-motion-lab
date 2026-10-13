# Joint Motion Lab

An interactive, bilingual motion laboratory for joint-based animation. The primary screen is a real Three.js viewport; the separate Guide explains the mechanism, the experiment, and its limitations.

The source repository is `joint-motion-lab`. Hosting is private unless the owner chooses to share it.

## Run locally

Requires Node.js 22.12+ or 24.

```sh
npm ci
npm run dev
```

```sh
npm run check      # strict TypeScript
npm test          # independent solver / scene / rigid-body tests
npm run build     # deployable static assets in dist/
npm run test:e2e   # actual WebGL browser tests, screenshots and traces
```

For the browser suite, first install its browser with `npx playwright install chromium`. CI installs the browser and Linux dependencies itself. The app works entirely client-side: no accounts, backend, analytics, remote model calls, character asset downloads, or API keys. Font files and Rapier's WebAssembly are bundled locally.

## Nine experiments

| Experiment        | Implementation                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| FK                | Parent-local quaternion composition, inherited rotations and local-axis helpers                   |
| Two-bone IK       | Analytic triangle solve, pole plane, reach clamping and deterministic singular fallback           |
| Chain solvers     | CCD and FABRIK from identical seeds, live error and iteration budget                              |
| Spline IK         | Catmull–Rom curve, arc-length sampling, parallel-transport frames and distributed twist           |
| IK/FK blend       | Local quaternion SLERP, FK evaluation and explicit pose matching in both directions               |
| Hand contact      | Fixed world-space target, moving shoulder, lock toggle and reach error                            |
| Walking           | Procedural stance/swing targets, planted world-space feet, leg IK and reach-aware pelvis height   |
| Joint constraints | Local swing/twist decomposition and angular clamping, requested/limited comparison                |
| Ragdoll           | Genuine Rapier rigid bodies, colliders, spherical and revolute joints, gravity and floor contacts |

The Guide contains original English/Japanese explanations, formulas, parameter experiments, failure cases, diagrams generated from the current settings (plus a labeled static ragdoll schematic), and primary-source links. The language switch changes both the lab and the guide. Every experiment has a direct URL, such as `?demo=spline&view=guide&lang=en`.

## Interaction

- Green IK target: drag directly, including touch; empty viewport: orbit; wheel/pinch: zoom
- Play/pause, reset, playback speed, construction visibility, per-experiment parameters
- Space toggles playback and R resets when focus is outside an interactive control
- Reduced-motion preference starts paused
- Hidden tabs, hidden lab views and offscreen viewports stop simulation advancement
- Lab/Guide navigation preserves parameters; selected sliders persist locally on reload
- Rapier loads only when the ragdoll is opened; physics uses a 1/120-second fixed step

## Architecture

```text
src/content/demos.ts       chapter metadata, controls, bilingual interface copy
src/content/guide.ts       technical teaching copy and source links
src/engine/kinematics.ts   pure mathematical solvers
src/engine/frame.ts        procedural scene and gait composition
src/engine/ragdoll.ts      genuine rigid-body dynamics, independent of Three.js
src/engine/renderer.ts     Three.js meshes, camera, pointer handling and disposal
src/components/           viewport lifecycle, guide, metrics and icons
```

Three.js 0.180.0 and Rapier 0.19.3 are pinned by the lockfile. React/Vite provide the application shell. The physics chunk includes its WebAssembly and is deliberately larger than the initial application bundle.

## Scope and limitations

This is an educational first release, not a production character-rigging package. All geometry is procedural. There is no skinning, character importing, keyframe editor, animation export, retargeting, active physical balance, or full animation-to-ragdoll transition system.

The first eight experiments are kinematic or geometric. Hand and foot targets do not exert forces. Only the ragdoll is a dynamics simulation. The spline follows equal arc lengths but does not enforce exact bone/chord lengths. Matching positions and bend direction does not preserve arbitrary joint twist or end-effector orientation. The pole fallback is deterministic rather than history-stabilized. Ragdoll spherical joints are unrestricted, and the numerical contact/constraint solver can produce small penetration or larger errors under strong impulses.

See [primary references and scope](docs/REFERENCE_SOURCES.md) and [verification record](docs/VERIFICATION.md).
