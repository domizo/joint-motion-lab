# Verification record

## Passed locally

- Strict TypeScript compilation
- Production Vite build
- 29 numerical/content tests covering analytic IK reach and degenerate poles; quaternion hierarchy, pose blending and matching invariants; CCD/FABRIK convergence and bone lengths; spline frames; swing/twist clamps; stationary stance feet and continuous landing; entire scene sampling, reachable default IK/contact, walking slider envelope; bilingual guide completeness
- Rapier subset: 9 tests for actual gravity, ground contact, joint-anchor connection, deterministic replay/reset, real impulses, sleep/wake, finite state, detached outputs, and cleanup
- A default 10-second Rapier drop produced a maximum anchor error of approximately 1.02 mm and all 15 bodies sleeping. This is a measured default case, not a universal accuracy guarantee

## Prepared, not yet run

The Playwright workflow checks actual WebGL pixels as well as numerical poses for all nine demos, pause/reset, input controls, language and guide routing, matching, physical pushes, and mobile overflow. It saves desktop/mobile screenshots, videos on failure, and traces.

Browser execution and visual fidelity review are still pending. The available local Chromium launch is known to be blocked by the execution environment, and the separate cloud browser cannot reach this filesystem's localhost server. No fresh blocked launch was repeated. Browser CI can run after a repository name and creation are approved. Static builds and numerical tests are not presented as proof of rendered motion.

## Visual reference and deliberate differences

References are `qa/lab-concept.png` and `qa/guide-concept.png`, inspected using the image viewer. The design uses a charcoal chapter rail, lime selection, light 3D stage, restrained right-hand controls, and a separate editorial guide.

Intentional implementation differences from concept:

- A genuine open-ended simulation uses elapsed seconds, not a fake finite media timeline
- Input animation is an explicit toggle; FK/IK matching, contact lock and physical push controls are functional necessities
- Diagrams and models are code-native and computed from scene state, rather than raster illustrations
- Guides use real primary references and detailed failure cases rather than the shortened concept copy
- The mobile chapter rail scrolls horizontally and the inspector moves below the viewport

After browser execution, compare title hierarchy, rail/inspector proportions, typography, palette, 3D framing, guide diagrams, control spacing, mobile overflow and motion before claiming visual completion.
