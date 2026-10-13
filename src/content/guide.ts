/** Original educational copy. References are primary documentation or author publications. */
export type GuideId =
  | "fk"
  | "ik"
  | "chain"
  | "spline"
  | "blend"
  | "contact"
  | "walk"
  | "constraints"
  | "ragdoll";
export type Language = "en" | "ja";

export interface GuideStep {
  title: string;
  why: string;
  how: string;
}

export interface GuideText {
  title: string;
  lead: string;
  steps: GuideStep[];
  formula: string;
  formulaNote: string;
  observe: string[];
  failures: string[];
}

export interface GuideCitation {
  label: string;
  url: string;
}

export interface GuideChapter {
  id: GuideId;
  en: GuideText;
  ja: GuideText;
  citations: GuideCitation[];
}

export const guideChapters: Record<GuideId, GuideChapter> = {
  fk: {
    id: "fk",
    en: {
      title: "FK: a hierarchy of rotations",
      lead: "Forward kinematics starts with joint rotations and computes where the chain ends. A child inherits its parent’s motion, then adds its own local rotation.",
      steps: [
        {
          title: "Store the pose locally",
          why: "An elbow angle should describe the elbow relative to the upper arm, even when the entire arm turns.",
          how: "Give each joint a fixed parent-local offset and a unit quaternion for its local orientation. Sliders can be angles; the composed pose can still use quaternions.",
        },
        {
          title: "Evaluate from root to tip",
          why: "A child’s world transform depends on the parent’s already evaluated world transform.",
          how: "Multiply parent-world rotation by child-local rotation, in that order. Rotate the child’s offset by the parent-world rotation and add the parent position. These simple position equations assume unit scale.",
        },
        {
          title: "Read local and world axes",
          why: "Rotation order is visible: turning the shoulder changes the frame in which the elbow rotates.",
          how: "Hold the elbow control still and turn the shoulder. The elbow’s local value stays fixed while its world orientation and the hand’s path change.",
        },
      ],
      formula:
        "qWorld = qParentWorld × qLocal; pWorld = pParentWorld + rotate(qParentWorld, offsetLocal)",
      formulaNote:
        "Quaternion products are ordered. With this convention, the rightmost rotation acts first. General transforms use MWorld = MParentWorld × MLocal.",
      observe: [
        "Rotate one joint at a time. Everything below it moves; ancestors remain still.",
        "Change two joint angles in different orders. Compare the hand path, not just the final slider values.",
      ],
      failures: [
        "World-space and parent-local rotations are not interchangeable. Mixing them often looks correct only while the parent is unrotated.",
        "FK does not keep a hand or foot on a target. Non-uniform scale can introduce shear, so a rotation-only model no longer describes the full transform.",
      ],
    },
    ja: {
      title: "FK：回転を階層でつなぐ",
      lead: "順運動学（FK）は、各関節の回転からチェーンの先端位置を求めます。子は親の動きを受け継ぎ、その上に自身のローカル回転を加えます。",
      steps: [
        {
          title: "姿勢をローカル空間で持つ",
          why: "腕全体が向きを変えても、肘の角度は上腕に対する角度として扱いたいからです。",
          how: "各関節に、親の座標系で表した固定オフセットと、ローカル姿勢を表す単位クォータニオンを持たせます。スライダーの表示が角度でも、姿勢の合成にはクォータニオンを使えます。",
        },
        {
          title: "根元から先端へ計算する",
          why: "子のワールド変換を求めるには、親のワールド変換が先に必要です。",
          how: "親のワールド回転に子のローカル回転を、この順で掛けます。子のオフセットは親のワールド回転で回し、親の位置を加えます。この簡潔な位置の式は、スケールがすべて1の場合を想定しています。",
        },
        {
          title: "ローカル軸とワールド軸を見る",
          why: "肩を回すと、肘が回転する基準の座標系も変わります。回転の順序を目で確認できます。",
          how: "肘の値を固定したまま肩を回してみます。肘のローカル値は同じでも、ワールドでの向きと手の軌道は変わります。",
        },
      ],
      formula:
        "qWorld = qParentWorld × qLocal; pWorld = pParentWorld + rotate(qParentWorld, offsetLocal)",
      formulaNote:
        "クォータニオンの積は順序に依存します。この規約では右側の回転が先に作用します。一般の変換は MWorld = MParentWorld × MLocal で表します。",
      observe: [
        "関節を一つずつ回し、その関節より先だけが動くことを確かめます。親側の関節は動きません。",
        "二つの関節を動かす順序を変え、最後の値だけでなく手の移動経路も比べます。",
      ],
      failures: [
        "ワールド回転と親ローカル回転は別物です。取り違えると、親が回転していないときだけ正しく見えることがあります。",
        "FKだけでは手足を目標に固定できません。また、不均一なスケールはせん断を生むことがあり、回転だけのモデルでは変換全体を表せません。",
      ],
    },
    citations: [
      {
        label: "Three.js · Object3D transforms",
        url: "https://threejs.org/docs/pages/Object3D.html",
      },
      {
        label: "Three.js · Quaternion composition",
        url: "https://threejs.org/docs/pages/Quaternion.html",
      },
    ],
  },
  ik: {
    id: "ik",
    en: {
      title: "Two-bone IK: solve a triangle",
      lead: "Inverse kinematics starts with a desired endpoint. For an upper arm and forearm, fixed lengths turn the problem into a triangle; a pole chooses its bending plane.",
      steps: [
        {
          title: "Separate the request from the reachable result",
          why: "Two segments of lengths L1 and L2 cannot reach every point.",
          how: "Measure root-to-target distance d. Its unconstrained reachable interval is |L1 − L2| to L1 + L2. Clamp the solve distance to that interval; a small epsilon inset deliberately avoids exact folding and full extension.",
        },
        {
          title: "Choose a stable bend plane",
          why: "The endpoint alone leaves the elbow free to circle the root-to-target axis.",
          how: "Let u point toward the target. Project the root-to-pole vector perpendicular to u and normalize it to get bend direction v. This experiment uses a deterministic reference axis near collinearity. A stateful solver can first try the previous bend direction for continuity.",
        },
        {
          title: "Place the elbow and recover rotations",
          why: "The law of cosines gives the elbow’s distance along the target axis and its height off that axis.",
          how: "Compute a and h below, then place the elbow at root + a·u + h·v. Build segment orientations from the solved directions and convert world orientations into parent-local rotations.",
        },
      ],
      formula:
        "a = (L1² − L2² + d²) / (2d); h = √max(0, L1² − a²); elbow = root + a·u + h·v",
      formulaNote:
        "Here d is the clamped, nonzero solve distance. If target and root coincide, preserve a previous target direction or choose a deterministic fallback before normalizing.",
      observe: [
        "Keep the target still and move the pole. The elbow changes sides while the endpoint stays in place when reachable.",
        "Move beyond maximum reach or inside minimum reach. Watch the residual error instead of expecting the bones to stretch.",
      ],
      failures: [
        "At a straight or fully folded configuration the bend plane is underdetermined. A fallback keeps numbers finite; it cannot make every pole crossing continuous.",
        "This position solve does not determine hand orientation, enforce anatomical limits, or avoid obstacles. Those are additional constraints.",
      ],
    },
    ja: {
      title: "2ボーンIK：三角形を解く",
      lead: "逆運動学（IK）は、先端を置きたい位置から姿勢を求めます。上腕と前腕の長さが固定なら、問題は三角形になります。ポールは、その三角形が曲がる平面を決めます。",
      steps: [
        {
          title: "目標と到達できる位置を分ける",
          why: "長さL1、L2の2本のボーンでは、すべての点に届くわけではありません。",
          how: "根元から目標までの距離dを測ります。関節制限がなければ、到達距離は |L1 − L2| から L1 + L2 までです。この範囲に計算用の距離を制限します。境界から微小量だけ内側に寄せる処理は、完全な折り畳みや伸展を意図的に避けるものです。",
        },
        {
          title: "安定した曲げ平面を選ぶ",
          why: "先端位置だけでは、肘は根元と目標を結ぶ軸の周囲を自由に回れます。",
          how: "目標方向をuとし、根元からポールへのベクトルをuに垂直な平面へ投影します。それを正規化したvが曲げ方向です。この実験では、ほぼ一直線なら決められた基準軸を使います。履歴を持つソルバーなら、連続性のために前の曲げ方向を先に試せます。",
        },
        {
          title: "肘を置き、回転に戻す",
          why: "余弦定理から、肘の軸方向の距離と、軸から離れる高さが求まります。",
          how: "下の式でaとhを計算し、肘を root + a·u + h·v に置きます。各ボーンの方向から姿勢を作り、ワールド姿勢を親ローカルの回転に変換します。",
        },
      ],
      formula:
        "a = (L1² − L2² + d²) / (2d); h = √max(0, L1² − a²); elbow = root + a·u + h·v",
      formulaNote:
        "ここでdは範囲内に制限した、0ではない計算用距離です。目標が根元に重なる場合は、正規化する前に以前の目標方向か決められた代替方向を使います。",
      observe: [
        "目標を固定してポールを動かします。到達可能な範囲では、先端を保ったまま肘の向きが変わります。",
        "最長距離の外や最短距離の内側へ目標を動かし、ボーンの伸縮ではなく、残る位置誤差を観察します。",
      ],
      failures: [
        "完全に伸ばした姿勢や折り畳んだ姿勢では、曲げ平面が一意に定まりません。代替処理で数値は安定しても、すべてのポール移動で連続な姿勢を保証できるわけではありません。",
        "この位置解法だけでは、手の向き、人体らしい可動域、障害物回避は決まりません。それぞれ追加の制約が必要です。",
      ],
    },
    citations: [
      {
        label: "Ryan Juckett · Analytic Two-Bone IK",
        url: "https://www.ryanjuckett.com/analytic-two-bone-ik-in-2d/",
      },
      {
        label: "Autodesk Maya 2026 · Rotate Plane IK solver",
        url: "https://help.autodesk.com/cloudhelp/2026/ENU/Maya-CharacterAnimation/files/GUID-9942FFB5-65C2-46E2-B5A3-297667A9FB5D.htm",
      },
    ],
  },
  chain: {
    id: "chain",
    en: {
      title: "Chain IK: improve, measure, repeat",
      lead: "Longer chains have many possible poses. CCD adjusts rotations one joint at a time; FABRIK adjusts joint positions with alternating length-preserving passes.",
      steps: [
        {
          title: "CCD turns each joint toward the answer",
          why: "One rotation can reduce the current endpoint error without solving every joint at once.",
          how: "Visit joints from tip toward root. At each pivot, rotate the current pivot-to-end direction toward pivot-to-target, update descendants, and continue. Repeat the sweep within a fixed iteration budget.",
        },
        {
          title: "FABRIK rebuilds the chain from both ends",
          why: "Pinning the tip reaches the target but moves the root; pinning the root restores the base but may displace the tip.",
          how: "Set the tip to the target and reposition preceding joints at their stored segment lengths. Restore the original root and reposition following joints at those same lengths. Alternate until the residual is small or the budget is exhausted.",
        },
        {
          title: "Compare the same problem fairly",
          why: "Iteration count alone is not a speed or quality benchmark.",
          how: "Use the same starting pose, target, lengths, limits, and tolerance. Inspect endpoint error and shape as well as work per sweep. Starting from the previous frame’s pose can help temporal continuity.",
        },
      ],
      formula:
        "error = |tip − target|; FABRIK length projection: pNext = p + L · normalize(pNext − p)",
      formulaNote:
        "The projection is applied in the current pass direction. Guard zero-length direction vectors. Stop on tolerance or a stated iteration limit, rather than assuming exact convergence.",
      observe: [
        "Use a low iteration budget and watch successive sweeps. CCD and FABRIK can reach similar endpoints through different intermediate shapes.",
        "Move the target beyond total chain length. More iterations cannot remove an error caused by unreachable geometry.",
      ],
      failures: [
        "Neither unconstrained method chooses a uniquely natural pose. Joint limits, preferred bend directions, and multiple targets need explicit treatment.",
        "Near straight chains, conflicting limits, or awkward targets, progress can stall or jitter. FABRIK positions also need a separate orientation and twist reconstruction.",
      ],
    },
    ja: {
      title: "チェーンIK：近づけて、測って、繰り返す",
      lead: "長いチェーンでは、同じ先端位置を実現する姿勢が複数あります。CCDは関節の回転を順番に調整し、FABRIKはボーン長を保つ往復処理で関節位置を調整します。",
      steps: [
        {
          title: "CCDは各関節から目標へ向ける",
          why: "すべての関節を一度に解かなくても、一つの回転で現在の先端誤差を減らせます。",
          how: "先端側から根元へ関節をたどります。各支点で、先端への方向を目標への方向に近づけるよう回転し、子孫の位置を更新します。決められた反復回数の範囲で、この巡回を繰り返します。",
        },
        {
          title: "FABRIKは両端から組み直す",
          why: "先端を目標に置くと根元が動き、根元を戻すと先端が目標からずれることがあります。",
          how: "先端を目標に置き、保存したボーン長を保つよう根元側の関節を順に移します。次に根元を元の位置へ戻し、同じ長さを保って先端側へたどります。誤差が十分小さくなるか、反復上限に達するまで往復します。",
        },
        {
          title: "同じ条件で比較する",
          why: "反復回数だけでは、速度や品質を公平に比較できません。",
          how: "初期姿勢、目標、ボーン長、関節制限、許容誤差をそろえます。先端誤差だけでなく、姿勢の形や1回の処理量も見ます。前フレームの姿勢から始めると、時間方向の連続性を保ちやすくなります。",
        },
      ],
      formula:
        "error = |tip − target|; FABRIKの長さ補正：pNext = p + L · normalize(pNext − p)",
      formulaNote:
        "補正はその時点の巡回方向に沿って適用します。方向ベクトルが0の場合には代替処理が必要です。完全収束を仮定せず、許容誤差か反復上限で終了します。",
      observe: [
        "反復回数を少なくして途中の姿勢を見ます。CCDとFABRIKは、似た先端位置へ異なる形を経て近づくことがあります。",
        "目標をチェーンの全長より遠くへ動かします。届かない幾何条件は、反復回数を増やしても解消しません。",
      ],
      failures: [
        "制約のないどちらの方法も、自然な姿勢を一意に選ぶわけではありません。可動域、曲がりたい方向、複数目標は別途扱う必要があります。",
        "ほぼ直線の姿勢、相反する制限、難しい目標位置では、停滞や振動が起こり得ます。FABRIKの位置解から回転とねじれを復元する処理も必要です。",
      ],
    },
    citations: [
      {
        label: "Aristidou & Lasenby · FABRIK research and original paper",
        url: "https://www.andreasaristidou.com/FABRIK",
      },
      {
        label: "Ryan Juckett · Cyclic Coordinate Descent",
        url: "https://www.ryanjuckett.com/cyclic-coordinate-descent-in-2d/",
      },
      {
        label: "Kenwright · Inverse Kinematics: CCD",
        url: "https://www.tandfonline.com/doi/abs/10.1080/2165347X.2013.823362",
      },
    ],
  },
  spline: {
    id: "spline",
    en: {
      title: "Spline motion: position, direction, twist",
      lead: "A curve can guide a spine, tail, or tentacle. Sampling positions is only the first job: the chain also needs coherent orientation frames along the curve.",
      steps: [
        {
          title: "Sample distance, not just the parameter",
          why: "Equal changes in a curve parameter do not generally travel equal distances.",
          how: "Approximate cumulative arc length, then find parameters for evenly spaced distances. Three.js getPointAt and getSpacedPoints use an arc-length mapping. Rebuild its cache when control points change.",
        },
        {
          title: "Transport the frame along the tangent",
          why: "A tangent gives a forward direction but leaves roll unspecified. Reusing a fixed up vector can become unstable when the tangent aligns with it.",
          how: "Choose an initial perpendicular normal. Rotate each previous frame by the minimal rotation between neighboring tangents, then re-orthogonalize. This discrete parallel transport avoids introducing unnecessary spin along smooth sections.",
        },
        {
          title: "Add twist as an explicit choice",
          why: "A controlled roll should be distinguishable from accidental frame flipping.",
          how: "Apply a chosen twist around each local tangent after transport. With arc-length sampling enabled, distribute twist along normalized arc length. Closed curves may also need a seam correction so the final frame meets the first.",
        },
      ],
      formula: "s(t) = ∫₀ᵗ |C′(u)| du; choose ti with s(ti) ≈ i·s(1)/N",
      formulaNote:
        "C is the curve; N is the number of intervals. Equal arc lengths do not imply equal straight-line distances between sampled points.",
      observe: [
        "Bend the curve sharply and compare spacing along the curve with each straight segment’s length.",
        "Add twist and inspect the cross-section frames. Their roll should change deliberately while their forward axes follow the curve.",
      ],
      failures: [
        "This sampled-curve construction is not an exact fixed-bone-length IK solver: a chord is shorter than its curved arc, and chord lengths vary with curvature.",
        "Cusps, zero tangents, nearly opposite neighboring tangents, and insufficient sampling need special handling. Stable frames also do not provide collision avoidance.",
      ],
    },
    ja: {
      title: "スプライン：位置、方向、ねじれ",
      lead: "曲線は背骨、尻尾、触手などの動きを導けます。ただし、位置を並べるだけでは不十分です。曲線に沿って一貫した向きを持つ座標フレームも必要です。",
      steps: [
        {
          title: "パラメータではなく距離でサンプリング",
          why: "曲線パラメータを等間隔に増やしても、移動距離が等しくなるとは限りません。",
          how: "累積弧長を近似し、等間隔の距離に対応するパラメータを探します。Three.jsのgetPointAtとgetSpacedPointsは弧長の対応表を使います。制御点を変えたら、そのキャッシュも更新します。",
        },
        {
          title: "接線に沿ってフレームを運ぶ",
          why: "接線だけでは前方向は決まっても、ロールは決まりません。固定の上方向を毎回使う方法は、接線と上方向が重なる付近で不安定になります。",
          how: "最初に接線と垂直な法線を選びます。隣り合う接線を結ぶ最小回転で前のフレームを運び、直交性を整えます。この離散的な平行輸送は、滑らかな区間で不要な回転を加えることを避けます。",
        },
        {
          title: "ねじれを明示的に加える",
          why: "意図したロールと、不意に起こるフレームの反転は区別して扱う必要があります。",
          how: "フレームを運んだ後、各接線の周囲に指定したねじれを加えます。弧長サンプリングを有効にした場合は、正規化した弧長に沿ってねじれを分配します。閉曲線では、最後と最初のフレームを合わせる継ぎ目補正が必要になることもあります。",
        },
      ],
      formula: "s(t) = ∫₀ᵗ |C′(u)| du; s(ti) ≈ i·s(1)/N となるtiを選ぶ",
      formulaNote:
        "Cは曲線、Nは区間数です。弧長が等しくても、サンプル点を直線で結んだ距離が等しくなるわけではありません。",
      observe: [
        "曲線を強く曲げ、曲線に沿った間隔と、各点を直線で結んだ長さを比べます。",
        "ねじれを加えて断面フレームを見ます。前方向は曲線に沿い、ロールは指定に応じて変化することを確かめます。",
      ],
      failures: [
        "この曲線サンプリングは、ボーン長を厳密に固定するIKではありません。弦は対応する曲線の弧より短く、その長さは曲がり方に応じて変わります。",
        "尖点、長さ0の接線、ほぼ反対を向く隣接接線、粗すぎるサンプリングには特別な処理が必要です。フレームが安定していても、衝突を避ける機能はありません。",
      ],
    },
    citations: [
      {
        label: "Three.js · Curve and arc-length sampling",
        url: "https://threejs.org/docs/pages/Curve.html",
      },
      {
        label: "Three.js · CatmullRomCurve3",
        url: "https://threejs.org/docs/pages/CatmullRomCurve3.html",
      },
      {
        label: "Hanson & Ma · Parallel Transport Approach to Curve Framing",
        url: "https://scholarworks.iu.edu/dspace/items/39fbe931-c2c8-43a1-9c9d-a207b92d551e",
      },
    ],
  },
  blend: {
    id: "blend",
    en: {
      title: "IK ↔ FK: blend poses, match controls",
      lead: "An IK/FK blend combines two solved joint poses. Matching is a separate operation that aligns their controls so switching need not produce a visible jump.",
      steps: [
        {
          title: "Build two compatible local poses",
          why: "A meaningful blend requires the same skeleton, rest offsets, and parent-local coordinate conventions.",
          how: "Evaluate the FK controls and solve the IK target independently. Express both sets of joint orientations as normalized parent-local quaternions.",
        },
        {
          title: "Interpolate rotations, then run FK",
          why: "Interpolating joint positions can shrink segments. Interpolating local rotations preserves the chain’s fixed offsets.",
          how: "Use quaternion SLERP for each corresponding joint, with weight 0 for FK and 1 for IK. Compose the blended hierarchy afterward. Keep quaternion signs consistent for shortest-path interpolation.",
        },
        {
          title: "Match before changing modes",
          why: "A smooth interpolation cannot hide a mismatch between the two source poses at the moment of a hard switch.",
          how: "For FK → IK, place the target at the FK endpoint and derive the pole from the FK elbow’s offset from the root-to-tip line. Match endpoint orientation when supported. For IK → FK, copy the solved local rotations into the FK controls. Here, matching aligns the two source poses and selects the destination mode. At an intermediate blend weight it can change the displayed pose; it is not a bake of that blended pose.",
        },
      ],
      formula:
        "qLocal[i](w) = slerp(qFK[i], qIK[i], w); evaluate FK with fixed local offsets",
      formulaNote:
        "This is a pose-space blend. The hand’s world-space path is generally curved and does not have to stay on the IK target at intermediate weights.",
      observe: [
        "Scrub the weight between two different poses. Watch each segment rotate while its length remains fixed.",
        "Compare a hard switch before and after matching. Matching only the wrist position can still leave the elbow on the wrong side.",
      ],
      failures: [
        "A straight FK chain has no unique pole direction. Preserve the previous pole or a preferred bend direction when matching.",
        "Endpoint plus pole can match two-bone geometry, but arbitrary axial twist, joint limits, control offsets, and different rest poses need additional matching logic.",
      ],
    },
    ja: {
      title: "IK ↔ FK：姿勢を混ぜ、操作位置を合わせる",
      lead: "IK/FKブレンドは、二つの計算済み関節姿勢を混ぜます。マッチングは別の処理です。切り替え時に姿勢が跳ばないよう、双方のコントロールを合わせます。",
      steps: [
        {
          title: "互換性のある二つのローカル姿勢を作る",
          why: "適切に混ぜるには、骨格、基準オフセット、親ローカル座標系の規約をそろえる必要があります。",
          how: "FKコントロールとIK目標をそれぞれ独立に評価します。両方の関節姿勢を、正規化した親ローカルのクォータニオンで表します。",
        },
        {
          title: "回転を補間し、その後FKを計算",
          why: "関節位置を補間するとボーンが縮むことがあります。ローカル回転を補間すれば、固定オフセットを保てます。",
          how: "対応する各関節をクォータニオンのSLERPで補間します。重み0をFK、1をIKとし、補間後に階層全体を合成します。最短経路で補間するため、クォータニオンの符号もそろえます。",
        },
        {
          title: "切り替える前にマッチング",
          why: "滑らかな補間があっても、即時切り替えの瞬間に元の二つの姿勢が違えば、跳びは起こります。",
          how: "FKからIKへは、目標をFKの先端に置き、根元と先端を結ぶ直線から肘が離れる方向にポールを置きます。対応していれば先端の向きも合わせます。IKからFKへは、解いたローカル回転をFKコントロールに写します。このデモのマッチングは、二つの元の姿勢を合わせて切り替え先を選びます。中間ウェイトでは表示姿勢が変わる場合があり、ブレンド結果をそのまま保存する処理ではありません。",
        },
      ],
      formula:
        "qLocal[i](w) = slerp(qFK[i], qIK[i], w); 固定ローカルオフセットでFKを評価",
      formulaNote:
        "これは姿勢空間でのブレンドです。手のワールド軌道は一般に曲線となり、中間の重みでIK目標上に留まるとは限りません。",
      observe: [
        "異なる二つの姿勢の間で重みを変えます。ボーン長を保ったまま、それぞれの関節が回転する様子を見ます。",
        "マッチングの前後で即時切り替えを比べます。手首位置だけを合わせても、肘が反対側に残る場合があります。",
      ],
      failures: [
        "一直線のFKチェーンでは、ポール方向が一意に定まりません。以前のポールや優先する曲げ方向を保って合わせます。",
        "先端とポールで2ボーンの幾何形状は合わせられても、軸方向のねじれ、可動域、コントロールのオフセット、基準姿勢の差には追加処理が必要です。",
      ],
    },
    citations: [
      {
        label: "Three.js · Quaternion SLERP",
        url: "https://threejs.org/docs/pages/Quaternion.html",
      },
      {
        label: "Autodesk Maya 2026 · IK/FK Keys menu",
        url: "https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Animation/files/GUID-C5ACDDBC-9E30-443C-8419-F07FC41E9A86.htm",
      },
      {
        label: "Autodesk Maya 2026 · Pole vector constraint",
        url: "https://help.autodesk.com/cloudhelp/2026/ENU/Maya-Tech-Docs/Commands/poleVectorConstraint.html",
      },
    ],
  },
  contact: {
    id: "contact",
    en: {
      title: "Hand contact: give IK a surface goal",
      lead: "This experiment pins a hand target just above a horizontal floor. It demonstrates geometric contact IK; force, friction, and physical support require a physics model.",
      steps: [
        {
          title: "Describe the surface and hand marker",
          why: "A wrist joint and a palm contact point occupy different places.",
          how: "Represent a plane by a point and unit normal, or query scene geometry. Include the local offset from wrist to palm marker when constructing the wrist goal; otherwise the hand can appear buried in the surface.",
        },
        {
          title: "Correct the target, then solve the arm",
          why: "Changing only the visible hand disconnects it from the arm.",
          how: "Here, a floor-aligned point drives shoulder and elbow through two-bone IK. A general surface-contact system first measures signed distance and constructs the contact goal. Palm alignment and influence blending are additional steps, not part of this point-target experiment.",
        },
        {
          title: "Choose sliding or anchoring",
          why: "Preventing penetration does not automatically keep the hand attached to one point.",
          how: "The experiment demonstrates an anchored target. By contrast, projecting the hand onto a plane permits tangential sliding. A general planted-hand system retains an anchor while contact is active; on a moving object, store it in that object’s local coordinates.",
        },
      ],
      formula:
        "signedDistance = n · (p − planePoint); planeProjection = p − signedDistance · n",
      formulaNote:
        "n must be a unit normal. Projection gives a point on the plane; contact offsets, reach clamping, and orientation must still be handled.",
      observe: [
        "Move the body or the target toward the surface and watch how the elbow compensates.",
        "Toggle the hand lock and vary body lean. The locked hand aims at the same floor-aligned point while the free FK arm moves with the body.",
      ],
      failures: [
        "A single marker cannot guarantee that the whole palm, fingers, forearm, or body avoids intersections.",
        "IK does not generate reaction forces or guarantee balance. If the target is unreachable, choose a visible residual, release policy, or broader body adjustment.",
      ],
    },
    ja: {
      title: "手の接触：面上の目標をIKに渡す",
      lead: "この実験では、水平な床の少し上に手の目標を固定します。幾何的な接触IKを学ぶためのものです。力、摩擦、体を支える反力には物理モデルが必要です。",
      steps: [
        {
          title: "面と手の接触点を定義する",
          why: "手首の関節位置と、手のひらの接触位置は同じではありません。",
          how: "面上の点と単位法線で平面を表すか、シーンの形状を調べます。手首の目標を作る際は、手首から接触マーカーまでのローカルオフセットも考慮します。無視すると手が面に埋まって見えます。",
        },
        {
          title: "目標を補正して腕を解く",
          why: "見た目の手だけを動かすと、腕から離れてしまいます。",
          how: "ここでは床に合わせた一点を目標に、2ボーンIKで肩と肘を解きます。一般的な面接触システムでは、その前に符号付き距離を測り、接触目標を作ります。手のひらの向きや影響度のブレンドは追加処理で、この点目標の実験には含まれません。",
        },
        {
          title: "滑らせるか、固定するかを選ぶ",
          why: "めり込みを防ぐだけでは、手が面上の一点に留まるとは限りません。",
          how: "この実験は固定された目標を示します。一方、手を平面に投影するだけなら接線方向に滑れます。一般的な手の固定では、接触中は同じアンカーを使います。動く物体に触れる場合は、その物体のローカル座標でアンカーを保存します。",
        },
      ],
      formula:
        "signedDistance = n · (p − planePoint); planeProjection = p − signedDistance · n",
      formulaNote:
        "nは単位法線です。投影で求まるのは面上の点だけです。接触オフセット、到達範囲、手の向きは別途扱います。",
      observe: [
        "体や目標を面へ近づけ、肘がどのように補正されるかを見ます。",
        "手の固定を切り替え、体の傾きを変えます。固定中は床に合わせた同じ点を狙い、解除するとFKの腕が体とともに動きます。",
      ],
      failures: [
        "一つのマーカーだけでは、手のひら全体、指、前腕、体のすべてが交差しないことを保証できません。",
        "IKは反力を発生させず、バランスも保証しません。届かない場合は誤差を見せる、接触を解除する、体全体を補正するなどの方針が必要です。",
      ],
    },
    citations: [
      {
        label: "Autodesk HumanIK · Foot and Hand Contact",
        url: "https://help.autodesk.com/cloudhelp/2016/ENU/HumanIK-SDK-Help/files/GUID-DBE08C49-E87A-4053-A3D0-00C813122EE6.htm",
      },
      {
        label: "Autodesk Maya 2026 · Floor Contact attributes",
        url: "https://help.autodesk.com/cloudhelp/2026/ENU/Maya-CharacterAnimation/files/GUID-94E431AE-381F-4F09-8C55-9B0A4BAF8CB4.htm",
      },
      {
        label: "Rapier · Kinematic and dynamic rigid bodies",
        url: "https://rapier.rs/docs/user_guides/javascript/rigid_bodies/",
      },
    ],
  },
  walk: {
    id: "walk",
    en: {
      title: "Procedural walk: plant, lift, place",
      lead: "A useful walking model separates stance, when a foot stays on the ground, from swing, when it travels to the next foothold. The legs then solve toward those goals.",
      steps: [
        {
          title: "Store a world-space stance anchor",
          why: "Recomputing a planted foot from the moving pelvis makes it skate across a stationary floor.",
          how: "At touchdown, save the foot’s world position. Reuse that anchor during stance while the pelvis moves. On a moving platform, save a platform-local anchor and transform it back to world space each frame.",
        },
        {
          title: "Move the swing foot between footholds",
          why: "The recovering foot needs clearance and a controlled landing, rather than a second stationary anchor.",
          how: "At lift-off, capture the start and choose the next foothold. Interpolate horizontally and add an upward arc. Ease the endpoints; a simple sine lift is illustrative but has nonzero vertical endpoint velocity.",
        },
        {
          title: "Adjust the pelvis and solve both legs",
          why: "The hip position determines whether the fixed foot targets are reachable.",
          how: "Lower the pelvis when needed to respect the legs’ reach before solving each leg. Coordinate phase, stride, and body speed. Smoothing this compensation is a further refinement. Show any remaining reach failure instead of silently stretching a leg or dragging its planted foot.",
        },
      ],
      formula:
        "stance: pFootWorld = anchor; swing: x = lerp(x0, x1, ease(u)); y = ground(x) + h0 + H·sin²(πu)",
      formulaNote:
        "u runs from 0 to 1 during swing; h0 is the foot offset and H is lift height. Squared sine and endpoint easing give zero endpoint swing velocity on smooth terrain. This is a teaching trajectory, not a dynamics solution.",
      observe: [
        "Track the stance foot against the grid while the pelvis advances. A world-locked foot should stay on the same grid location.",
        "Increase stride and terrain height. Watch how foot placement changes knee bend and the automatic pelvis compensation.",
      ],
      failures: [
        "A plausible gait is not proof of physical balance. This model does not calculate center-of-mass support, ground reaction forces, or recovery from a fall.",
        "Abrupt direction changes, uneven terrain, stairs, foot roll, and obstacles require more planning and contact handling than an alternating pair of targets.",
      ],
    },
    ja: {
      title: "歩行生成：接地、持ち上げ、着地",
      lead: "歩行を作る基本は、足を地面に置く立脚期と、次の着地点へ運ぶ遊脚期を分けることです。その目標に向かって、両脚の姿勢を解きます。",
      steps: [
        {
          title: "立脚のアンカーをワールド座標で保存",
          why: "動く骨盤を基準に接地中の足位置を毎回作り直すと、止まっている床の上で足が滑ります。",
          how: "着地時に足のワールド位置を保存し、立脚中は骨盤が動いても同じアンカーを使います。動く足場では足場ローカルのアンカーを保存し、毎フレーム、ワールド座標へ戻します。",
        },
        {
          title: "遊脚を次の着地点へ運ぶ",
          why: "持ち上げる足には、地面を越える高さと、制御された着地が必要です。接地側と同じ固定点にはできません。",
          how: "離地時の位置を保存し、次の着地点を選びます。水平方向を補間して上向きの弧を加え、両端の動きを緩やかにします。単純な正弦波の持ち上げでは、両端の鉛直速度が0にならない点に注意します。",
        },
        {
          title: "骨盤を補正し、両脚を解く",
          why: "股関節の位置によって、固定された足の目標に届くかどうかが決まります。",
          how: "各脚のIKを解く前に、脚が届く範囲に収まるよう必要に応じて骨盤を下げます。位相、歩幅、体の移動速度をそろえます。補正を滑らかにする処理は、さらに改善できる点です。残る到達失敗は、脚を黙って伸ばしたり接地足を引きずったりせずに表示します。",
        },
      ],
      formula:
        "立脚：pFootWorld = anchor; 遊脚：x = lerp(x0, x1, ease(u)); y = ground(x) + h0 + H·sin²(πu)",
      formulaNote:
        "uは遊脚中の0〜1の進行度、h0は足のオフセット、Hは持ち上げる高さです。正弦の二乗と両端のイージングにより、滑らかな地形では遊脚の両端速度が0になります。これは学習用の軌道であり、動力学の解ではありません。",
      observe: [
        "骨盤が前進するとき、接地足とグリッドの位置関係を追います。ワールド固定された足は、同じグリッド位置に留まるはずです。",
        "歩幅と地形の高さを増やします。着地点、膝の曲がり、自動の骨盤補正の関係を観察します。",
      ],
      failures: [
        "歩いて見えても、物理的にバランスが取れている証拠にはなりません。このモデルは重心の支持、床反力、転倒からの回復を計算しません。",
        "急な方向転換、起伏、階段、足裏の転がり、障害物には、左右交互の目標より高度な計画と接触処理が必要です。",
      ],
    },
    citations: [
      {
        label: "Rune Skovbo Johansen · Semi-procedural locomotion thesis",
        url: "https://runevision.com/thesis/",
      },
      {
        label: "Autodesk · HumanIK floor contact and hip adaptation",
        url: "https://help.autodesk.com/cloudhelp/ENU/Stingray-Help/stingray_help/animation/HumanIK/setup_floor_contact.html",
      },
    ],
  },
  constraints: {
    id: "constraints",
    en: {
      title: "Joint limits: constrain in the right frame",
      lead: "This view demonstrates local swing–twist limits. A hinge permits a different motion, shown by the ragdoll’s elbows and knees. Both limits belong to a joint frame rather than a fixed direction in the room.",
      steps: [
        {
          title: "Measure relative to the joint’s rest frame",
          why: "World-space angle limits change their meaning when a parent rotates.",
          how: "Convert the candidate orientation into the parent-local joint frame, remove the rest orientation with a consistent multiplication convention, and constrain that relative rotation.",
        },
        {
          title: "Use a hinge for one rotational freedom",
          why: "A hinge permits rotation around one specified axis and rejects off-axis swing.",
          how: "Extract a signed angle around the local hinge axis, handle angle wrapping, clamp to the allowed interval, and reconstruct the rotation from that axis and angle. This is not the same as independently clamping three Euler channels.",
        },
        {
          title: "Separate swing from twist for a cone",
          why: "A shoulder-like joint can tilt away from its main axis and also rotate around that axis.",
          how: "Factor the unit quaternion into swing × twist. Limit the swing angle and the signed twist interval, then recombine and restore the rest frame. Apply constraints during an iterative solve and re-evaluate the endpoint afterward.",
        },
      ],
      formula:
        "qRelative = qSwing × qTwist; qTwist = normalize((a · v)·a, w), for qRelative = (v, w)",
      formulaNote:
        "a is the unit twist axis in the joint frame. The formula is singular when both w and the projected vector vanish; choose a consistent fallback instead of dividing by zero.",
      observe: [
        "Change swing and twist separately. Inspect how the limited pose differs from the requested ghost pose and how the local axes turn.",
        "Increase requested swing beyond its limit. Compare the ghost and solid poses, the requested angle and the constraint status.",
      ],
      failures: [
        "A circular cone is a simplified envelope, not a complete anatomical shoulder model. Real limits can be asymmetric and coupled.",
        "Hard clamping can create velocity discontinuities. Limits can make a previously reachable target impossible, and post-solve clamping alone can break contact.",
      ],
    },
    ja: {
      title: "関節制限：正しい座標系で制約する",
      lead: "この画面ではローカルなスイングとツイストの制限を示します。ヒンジが許す動きは異なり、ラグドールの肘と膝で確認できます。どちらも部屋の固定方向ではなく、関節の座標系で制限します。",
      steps: [
        {
          title: "関節の基準姿勢から測る",
          why: "ワールド空間で角度を制限すると、親を回したときに制限の意味が変わってしまいます。",
          how: "候補の姿勢を親ローカルの関節フレームへ変換し、掛け算の規約をそろえて基準回転を取り除きます。その相対回転に制限を適用します。",
        },
        {
          title: "1軸の自由度にはヒンジを使う",
          why: "ヒンジは指定した軸の周りだけ回転を許し、軸から外れる傾きを取り除きます。",
          how: "ローカルなヒンジ軸の周りの符号付き角度を抽出し、角度の折り返しを処理して、許容範囲に制限します。その軸と角度から回転を作り直します。オイラー角3成分を個別に制限する処理とは異なります。",
        },
        {
          title: "円錐制限ではスイングとツイストを分ける",
          why: "肩のような関節は、主軸から傾く動きと、主軸の周りにねじる動きの両方を持ちます。",
          how: "単位クォータニオンをスイング×ツイストに分解します。傾く角度と符号付きのねじれ範囲を制限し、合成して基準フレームに戻します。反復解法では処理の途中に制約を入れ、その後の先端誤差も確認します。",
        },
      ],
      formula:
        "qRelative = qSwing × qTwist; qRelative = (v, w) のとき qTwist = normalize((a · v)·a, w)",
      formulaNote:
        "aは関節フレーム内の単位ツイスト軸です。wと投影ベクトルがともに0になる姿勢では特異になります。0で割らず、一貫した代替処理を選びます。",
      observe: [
        "スイングとツイストを別々に変えます。制限後の姿勢と要求姿勢の薄い表示を比べ、ローカル軸の向きも見ます。",
        "要求スイングを上限より大きくし、ゴーストと実体の姿勢、要求角度、制限状態の表示を比較します。",
      ],
      failures: [
        "円形の円錐は単純化した可動域であり、肩の解剖学的な動きを完全に表すものではありません。実際の制限は非対称で、相互に影響することがあります。",
        "急なクランプは速度を不連続にします。制限により目標へ届かなくなることもあり、解いた後だけ角度を制限すると接触が崩れる場合があります。",
      ],
    },
    citations: [
      {
        label: "Marc B. Reynolds · Quaternion swing–twist derivation",
        url: "https://marc-b-reynolds.github.io/quaternions/2022/01/31/QuatAxisFactor.html",
      },
      {
        label: "Dobrowolski · Swing–twist decomposition paper",
        url: "https://arxiv.org/abs/1506.05481",
      },
      {
        label: "Rapier · Joint degrees of freedom",
        url: "https://rapier.rs/docs/user_guides/javascript/joints/",
      },
    ],
  },
  ragdoll: {
    id: "ragdoll",
    en: {
      title: "Ragdoll: let forces determine the motion",
      lead: "A physics ragdoll is an assembly of dynamic rigid bodies, collision shapes, and joint constraints. Rapier advances this system over time; the visible bones follow the simulated bodies.",
      steps: [
        {
          title: "Give each part physical state",
          why: "A falling pose needs velocity, mass, and angular inertia, not just animated joint angles.",
          how: "Create dynamic bodies and attach colliders with appropriate shape and density. Use a fixed body and collider for the floor. Bodies without colliders have no shape for contact detection.",
        },
        {
          title: "Connect bodies with physical joints",
          why: "Independent bodies would fall apart; visual parenting does not make a physical articulation.",
          how: "Define joint anchors in each body’s local coordinates. A spherical joint joins anchor positions while permitting rotation; a revolute joint leaves one rotational axis. Choose limits and adjacent-body collision filtering deliberately.",
        },
        {
          title: "Step physics, then copy its result",
          why: "Overwriting dynamic-body transforms every frame fights the physics solver.",
          how: "Advance Rapier on a fixed simulation step and render its body positions and rotations, accounting for mesh offsets. Gravity, impulses, joint responses, and floor contacts now determine the motion. Resetting is a deliberate reinitialization.",
        },
      ],
      formula:
        "motion state + forces + contacts + joint constraints → fixed physics step → new body poses",
      formulaNote:
        "Joint and contact constraints are solved numerically. They are not exact geometric promises at every intermediate solver iteration.",
      observe: [
        "Release the assembly and watch gravity, floor collisions, and the linked parts influence one another.",
        "Apply an impulse and compare it with directly dragging a pose. Momentum and collision response continue after the impulse.",
      ],
      failures: [
        "Overlapping initial colliders, mismatched anchors, extreme mass ratios, or a large timestep can create jitter or explosive motion. Increase accuracy only after checking the setup.",
        "Free spherical joints are not anatomical shoulders or knees. This educational ragdoll does not include muscle control, active balance, recovery, or a production animation-to-physics transition.",
      ],
    },
    ja: {
      title: "ラグドール：力から動きを決める",
      lead: "物理ラグドールは、動的剛体、衝突形状、関節制約を組み合わせたものです。Rapierが時間とともに状態を進め、表示用のボーンはシミュレーションされた剛体に追従します。",
      steps: [
        {
          title: "各パーツに物理状態を持たせる",
          why: "落下する姿勢を求めるには、関節角度だけでなく、速度、質量、慣性が必要です。",
          how: "動的剛体を作り、適切な形状と密度のコライダーを取り付けます。床には固定剛体とコライダーを使います。コライダーのない剛体には、接触判定に使う形状がありません。",
        },
        {
          title: "物理ジョイントで剛体をつなぐ",
          why: "独立した剛体はばらばらに落ちます。表示上の親子関係だけでは、物理的な関節にはなりません。",
          how: "各剛体のローカル座標でジョイントのアンカーを定義します。球関節はアンカー位置を結び、回転を許します。回転ジョイントは1本の回転軸を残します。可動域や隣接パーツ間の衝突判定は、意図して設定します。",
        },
        {
          title: "物理を進め、その結果を表示する",
          why: "動的剛体の変換を毎フレーム上書きすると、物理ソルバーの計算と競合します。",
          how: "Rapierを固定時間刻みで進め、メッシュとのオフセットを考慮して剛体の位置と回転を表示します。重力、力積、関節の応答、床との接触が動きを決めます。リセットは、状態を明示的に初期化し直す操作です。",
        },
      ],
      formula:
        "運動状態 + 力 + 接触 + 関節制約 → 固定時間刻みの物理計算 → 新しい剛体姿勢",
      formulaNote:
        "関節と接触の制約は数値的に解かれます。ソルバーの反復途中まで、幾何的に完全な一致を保証するものではありません。",
      observe: [
        "支えを外し、重力、床との衝突、つながったパーツが互いの動きにどう影響するかを見ます。",
        "力積を加え、姿勢を直接ドラッグする場合と比べます。力積を加えた後も、運動量と衝突の応答が続きます。",
      ],
      failures: [
        "初期コライダーの重なり、アンカーのずれ、極端な質量比、大きすぎる時間刻みは、振動や急激な飛び散りの原因になります。計算精度を増やす前に設定を確認します。",
        "自由な球関節は、人体の肩や膝をそのまま再現しません。この学習用ラグドールには、筋力制御、能動的なバランス、起き上がり、制作向けのアニメーションと物理の切り替えは含みません。",
      ],
    },
    citations: [
      {
        label: "Rapier · Rigid bodies",
        url: "https://rapier.rs/docs/user_guides/javascript/rigid_bodies/",
      },
      {
        label: "Rapier · Colliders",
        url: "https://rapier.rs/docs/user_guides/javascript/colliders/",
      },
      {
        label: "Rapier · Joints",
        url: "https://rapier.rs/docs/user_guides/javascript/joints/",
      },
      {
        label: "Rapier · Integration parameters",
        url: "https://rapier.rs/docs/user_guides/javascript/integration_parameters/",
      },
    ],
  },
};

export const guideOrder: GuideId[] = [
  "fk",
  "ik",
  "chain",
  "spline",
  "blend",
  "contact",
  "walk",
  "constraints",
  "ragdoll",
];

export function getGuideChapter(id: GuideId, language: Language): GuideText {
  return guideChapters[id][language];
}
