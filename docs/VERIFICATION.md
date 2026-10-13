# Verification record

## Mathematical and physical checks

- Strict TypeScript compilation and production Vite build pass
- 39 numerical/content tests cover analytic IK reach and degenerate poles; quaternion hierarchy, pose blending and matching invariants; CCD/FABRIK convergence and bone lengths; spline frames; swing/twist clamps; stationary stance feet and continuous landing; entire scene sampling, reachable default IK/contact, walking slider envelope; bilingual guide completeness; visible endpoint-marker separation
- Rapier subset: 18 tests for actual gravity, ground contact, joint-anchor connection, deterministic replay/reset, real impulses, sleep/wake, finite state, detached outputs, and cleanup
- The initial release’s default 10-second Rapier drop produced a maximum anchor error of approximately 1.02 mm and all 15 bodies sleeping. This is a measured default case, not a universal accuracy guarantee. Shape-based contact can briefly penetrate the floor, and strong impulses can produce larger constraint errors
- Additional independent review exercised five 20-second physics scenarios, 100 resets, random swing/twist rotations, solver degeneracies, and initialization/disposal/retry lifecycle behavior
- Full dependency audit after the Vite 7.3.7 update reported zero known vulnerabilities on 2026-10-13

## Ragdoll surface pulling and neck-contact regression

The ragdoll supports a picked body-local surface anchor, an implicit damped spring applied as a fixed-step impulse at that point, a 900 N force cap, 1.5 m elastic-extension cap, and 6 m/s physical-target speed limit. The requested pointer and physical spring target are distinct. It never teleports a body to the pointer. Mouse and one-finger touch share the same raycast and camera-facing plane; empty space controls the orbit camera. Pausing ends the grab and prevents a deferred pull.

An independent check reproduced a specific old defect: head/chest contact was excluded at the neck, permitting approximately 35 cm signed shape overlap. The neck is now collision-enabled while the other directly joined limb/spine pairs stay filtered. Body-only contact diagnostics exclude floor/walls and positive speculative distances. Turning self-collision off deliberately permits interpenetration; it does not disable the floor.

Local regressions cover all fifteen grabbed segments, force/target caps, extreme pointer jumps, off-center torque, exact low hand/foot anchors, deterministic replay, release/reset/disposal, self-contact on/off comparison, geometric sphere/torso separation, and sustained head pulling into the torso. A renderer event harness additionally checked cancellation, lost capture, blur, visibility loss, camera changes, multiple pointers and listener cleanup.

Independent post-fix measurements: default head/chest overlap 2.13 mm; normal all-part drags 2.84 mm with maximum joint-anchor error 0.201 mm. Extreme alternating target jumps remained finite and settled after release, but transient head/chest overlap reached 24.8 mm. These are scenario measurements, not universal nonpenetration guarantees.

The browser suite now includes four additional interaction tests for head/torso/hand/foot mouse picking, interruption cleanup, self-contact filtering, and real Chromium touch input on mobile. Passing touch and drag runs retain videos as well as screenshots. The latest Actions run is the authority for the current source; the historical run below records the original nine-demo baseline.

## Actual WebGL browser checks

[The complete browser suite passed](https://github.com/domizo/joint-motion-lab/actions/runs/38333479163) on source `2676165beb0d8d4858f81c0f8fa405e1dde23439`: 12 tests, no retries, in Chromium with software WebGL on Ubuntu/Node 24. Tests use the production Vite preview, not a development build. Every subsequent source push reruns the same checks; see [the latest workflow results](https://github.com/domizo/joint-motion-lab/actions).

- Each of the nine demos produces nonempty WebGL pixels, finite changing poses, changing rendered pixels, advancing time, stable paused state and zero time after a paused reset
- Slider input produces the explicit out-of-reach state; direct pointer dragging moves the IK target
- Lab/Guide navigation and browser history retain scene parameters
- Both matching buttons and the ragdoll push button respond in the browser; the test observes a matched pose and nonzero energy. Independent numerical tests establish matching invariants and the effect of an impulse relative to an unpushed simulation. The browser reverse-match check starts from already matched sources, and nonzero energy alone cannot distinguish an impulse from gravity
- English desktop (1536 × 1024) and Japanese mobile (390 × 844) layouts are captured; all mobile demo controls fit without horizontal page overflow
- The largest mobile target position remains within the canvas
- The per-demo tests detect uncaught page exceptions. No uncaught exceptions were reported; browser-console warning coverage is not exhaustive

The saved screenshots were inspected, including every desktop demo, the desktop guide, Japanese mobile guide/lab, and the mobile drag/target state. Review found and corrected guide pole clipping, tight mobile framing, and overlapping endpoint-marker surfaces. Screenshot artifacts and the HTML test report are retained in Actions for 14 days. For the original baseline, videos and traces were retained on failure; passing runs used pixel/pose assertions and screenshots. The new surface-pull tests additionally retain successful videos.

For the original release, deployable runtime assets were compared byte-for-byte with successful run `38333479163` on source `2676165beb0d8d4858f81c0f8fa405e1dde23439`, excluding the local-only hosting identity. That comparison is historical and does not attest later runtime changes. The surface-drag and neck-contact update has its own [exact-source workflow and artifacts](https://github.com/domizo/joint-motion-lab/actions/runs/38340280029); subsequent fixes are identified by their source commit in the latest workflow results. Publication requires a fresh asset comparison with the successful current-runtime artifact. The hosted Site is private; its cloud-browser visit stops at the owner sign-in gate. No new sign-in or access grant was performed. Hosted authentication behavior and rendering beyond that gate have not been tested. Native deployment metadata verifies publication separately from same-source browser QA.

## Visual reference and deliberate differences

References are `qa/lab-concept.png` and `qa/guide-concept.png`. Both references and actual browser captures were inspected. The implementation retains the charcoal chapter rail, lime selection, pale 3D stage, right-hand controls, and separate editorial guide.

Intentional implementation differences from concept:

- The approved name is Joint Motion Lab; a narrower rail and inspector leave more room for motion
- A genuine open-ended simulation uses elapsed seconds, not a fake finite media timeline
- Input animation is an explicit toggle; FK/IK matching, contact lock and physical push controls are functional necessities
- Bones, models and diagrams are code-native, with a lighter ground and restrained materials rather than a raster illustration
- Guides use real primary references and detailed failure cases rather than shortened concept copy
- The mobile chapter rail scrolls horizontally and the inspector moves below the viewport

## Remaining coverage limits

This is an educational first release. Browser testing currently covers Chromium software WebGL, not Safari, Firefox, every GPU/driver, or prolonged mobile thermal performance. The updated drag suite uses mouse input and Chromium-emulated touch; physical iOS/Android devices remain untested. Numerical tolerances and bounded simulation steps do not guarantee production-rigging or physically exact results under arbitrary inputs.
