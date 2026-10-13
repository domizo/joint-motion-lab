# Joint-motion guide: references and scope

Checked on 2026-10-13. The guide is original English and Japanese teaching copy, with original explanations and experiments. It does not reproduce source prose or claim to implement every feature of the referenced systems.

## Library documentation

- [Three.js Object3D](https://threejs.org/docs/pages/Object3D.html): local and world transforms, parent relationships, matrices, and quaternion access
- [Three.js Quaternion](https://threejs.org/docs/pages/Quaternion.html): ordered quaternion multiplication, unit-vector alignment, and spherical interpolation
- [Three.js Curve](https://threejs.org/docs/pages/Curve.html): arc-length mapping, spaced samples, tangents, and cache invalidation
- [Three.js CatmullRomCurve3](https://threejs.org/docs/pages/CatmullRomCurve3.html): the curve family used by the experiment
- [Rapier rigid bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/): dynamic, fixed, and kinematic behavior; the distinction between bodies and colliders
- [Rapier colliders](https://rapier.rs/docs/user_guides/javascript/colliders/): collision geometry, material properties, and physical mass contribution
- [Rapier joints](https://rapier.rs/docs/user_guides/javascript/joints/): local anchors, permitted degrees of freedom, spherical joints, and revolute joints
- [Rapier integration parameters](https://rapier.rs/docs/user_guides/javascript/integration_parameters/): timestep and iterative-solver accuracy trade-offs

These pages were opened successfully. Library documentation is rolling; the project’s package lock, rather than the date of a web page, determines its actual runtime versions.

## Algorithms and original research

- [Ryan Juckett, Analytic Two-Bone IK in 2D](https://www.ryanjuckett.com/analytic-two-bone-ik-in-2d/): the geometric reachable interval and analytic triangle solution; applicable in 3D after choosing a plane
- [Ryan Juckett, Cyclic Coordinate Descent in 2D](https://www.ryanjuckett.com/cyclic-coordinate-descent-in-2d/): sequential joint optimization and iteration stopping
- [Andreas Aristidou and Joan Lasenby, FABRIK](https://www.andreasaristidou.com/FABRIK): the author’s research page for the 2011 algorithm and subsequent constrained extensions
  - Original paper: _Graphical Models_ 73(5), 243–260, [DOI: 10.1016/j.gmod.2011.05.003](https://doi.org/10.1016/j.gmod.2011.05.003)
  - The author page and original publisher record were verified in indexed web results. Direct author-page/PDF retrieval timed out during checking; no claim of full-text retrieval is made
- [Ben Kenwright, Inverse Kinematics – Cyclic Coordinate Descent](https://www.tandfonline.com/doi/abs/10.1080/2165347X.2013.823362): original research on practical CCD, including convergence and limitation handling; publisher abstract verified in web results
- [Andrew Hanson and Hui Ma, Parallel Transport Approach to Curve Framing](https://scholarworks.iu.edu/dspace/items/39fbe931-c2c8-43a1-9c9d-a207b92d551e): original 1995 technical report, hosted by Indiana University
- [Marc B. Reynolds, Quaternion swing twist decomposition](https://marc-b-reynolds.github.io/quaternions/2022/01/31/QuatAxisFactor.html): the author’s derivation, factor order, and ill-conditioned cases
- [Przemysław Dobrowolski, Swing-twist decomposition in Clifford algebra](https://arxiv.org/abs/1506.05481): original 2015 paper on the decomposition
- [Rune Skovbo Johansen, Automated Semi-Procedural Animation for Character Locomotion](https://runevision.com/thesis/): the author’s 2009 thesis page and associated locomotion visualizations

The author pages and repository entries above were opened successfully except where explicitly noted. References explain principles; the implementation is a compact educational treatment, not a reproduction of these complete research systems.

## Rigging and contact references

- [Autodesk Maya 2026, Rotate Plane IK solver](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-CharacterAnimation/files/GUID-9942FFB5-65C2-46E2-B5A3-297667A9FB5D.htm): pole-controlled bending planes and flip conditions
- [Autodesk Maya 2026, IK/FK Keys menu](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Animation/files/GUID-C5ACDDBC-9E30-443C-8419-F07FC41E9A86.htm): matching and transition concepts
- [Autodesk Maya 2026, poleVectorConstraint](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Tech-Docs/Commands/poleVectorConstraint.html): the relationship between pole targets and the rotate plane
- [Autodesk HumanIK SDK, Foot and Hand Contact](https://help.autodesk.com/cloudhelp/2016/ENU/HumanIK-SDK-Help/files/GUID-DBE08C49-E87A-4053-A3D0-00C813122EE6.htm): geometric contact correction; this is archived 2016 documentation
- [Autodesk Maya 2026, HumanIK Floor Contact attributes](https://help.autodesk.com/cloudhelp/2026/ENU/Maya-CharacterAnimation/files/GUID-94E431AE-381F-4F09-8C55-9B0A4BAF8CB4.htm): contact markers and floor representation
- [Autodesk Stingray, Set up floor contact using HumanIK](https://help.autodesk.com/cloudhelp/ENU/Stingray-Help/stingray_help/animation/HumanIK/setup_floor_contact.html): foot planting and hip adaptation; this is archived product documentation

These pages were opened successfully. Archived Autodesk material is cited for stable rigging concepts, not as a recommendation to use discontinued products or old APIs.

## Boundaries made explicit in the guide

- FK uses fixed local offsets and quaternion composition; the simplified position formula assumes unit scale
- Two-bone IK has a reachable annulus, a pole-plane ambiguity, and explicit singular fallbacks
- CCD and FABRIK are iterative and do not promise a unique natural pose or convergence under arbitrary constraints
- Equal arc-length samples do **not** imply fixed straight bone lengths; spline transport and user twist are separate operations
- IK/FK pose blending uses local quaternion interpolation and hierarchy evaluation; control matching is a separate operation
- The contact experiment uses a floor-aligned point target. General surface projection, palm orientation, and moving-surface anchoring are explained as extensions
- The walking model is procedural target generation with leg IK. Its appearance does not establish physical balance
- The constraints panel demonstrates swing–twist limits; the ragdoll provides actual revolute elbow and knee joints
- The ragdoll uses Rapier dynamics, colliders, and joints. It does not claim anatomical fidelity, active balance, or a full animation/physics transition system
