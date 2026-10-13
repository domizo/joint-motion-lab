export type Language = "en" | "ja";
export type DemoId =
  | "fk"
  | "ik"
  | "chain"
  | "spline"
  | "blend"
  | "contact"
  | "walk"
  | "constraints"
  | "ragdoll";
export type Words = { en: string; ja: string };
export const words = (en: string, ja: string): Words => ({ en, ja });
export interface Control {
  key: string;
  label: Words;
  min: number;
  max: number;
  step: number;
  unit?: string;
}
export interface Demo {
  id: DemoId;
  title: Words;
  lead: Words;
  panel: Words;
  note: Words;
  controls: Control[];
  defaults: Record<string, number>;
}
const c = (
  key: string,
  en: string,
  ja: string,
  min: number,
  max: number,
  step = 0.01,
  unit = "",
): Control => ({ key, label: words(en, ja), min, max, step, unit });
export const demos: Demo[] = [
  {
    id: "fk",
    title: words("Forward kinematics", "Forward Kinematics"),
    lead: words(
      "Rotate a joint. Its children follow.",
      "関節を回す。子の関節へ、動きが伝わる。",
    ),
    panel: words("Local rotations", "ローカル回転"),
    note: words(
      "Each angle lives in its parent’s coordinate frame. The final position is a consequence of those rotations.",
      "各角度は親の座標系を基準にします。先端位置は、回転を順番に積み重ねた結果です。",
    ),
    controls: [
      c("shoulder", "Shoulder", "肩", -90, 90, 1, "°"),
      c("elbow", "Elbow", "肘", -130, 130, 1, "°"),
      c("wrist", "Wrist", "手首", -100, 100, 1, "°"),
    ],
    defaults: { shoulder: 38, elbow: 40, wrist: -50 },
  },
  {
    id: "ik",
    title: words("Inverse kinematics", "Inverse Kinematics"),
    lead: words(
      "Move the target. Watch the chain find its pose.",
      "ターゲットを動かす。先端へ届く姿勢を見つける。",
    ),
    panel: words("Two-bone solver", "2ボーン IK"),
    note: words(
      "The green target sets the endpoint. The violet pole chooses the bend plane. Drag the target directly, or use the sliders.",
      "緑のターゲットで先端位置を、紫のポールで曲がる平面を指定。ターゲットは直接ドラッグできます。",
    ),
    controls: [
      c("tx", "Target reach", "ターゲット X", -0.8, 3, 0.01),
      c("ty", "Target height", "ターゲット Y", 0.1, 3.2, 0.01),
      c("pole", "Pole angle", "ポール角度", -180, 180, 1, "°"),
    ],
    defaults: { tx: 1.5, ty: 1.5, pole: 25 },
  },
  {
    id: "chain",
    title: words("Chain solvers", "Chain Solvers"),
    lead: words(
      "One target. Two different routes to the answer.",
      "ひとつの目標へ、異なる解き方で近づく。",
    ),
    panel: words("CCD / FABRIK", "CCD / FABRIK"),
    note: words(
      "Dark bones: FABRIK. Violet bones: CCD, offset in depth for comparison. Both start from the same pose every frame.",
      "黒は FABRIK、紫は CCD。見比べやすく奥行きをずらしています。毎フレーム、同じ初期姿勢から解きます。",
    ),
    controls: [
      c("tx", "Target reach", "ターゲット X", -0.4, 3.6),
      c("ty", "Target height", "ターゲット Y", 0.1, 3.5),
      c("iterations", "Iteration budget", "反復回数", 1, 60, 1),
    ],
    defaults: { tx: 1.7, ty: 2.4, iterations: 15 },
  },
  {
    id: "spline",
    title: words("Spline IK", "Spline IK"),
    lead: words(
      "A curve becomes a spine. A frame gives it direction.",
      "曲線が背骨になる。フレームが向きを決める。",
    ),
    panel: words("Curve & frames", "曲線とフレーム"),
    note: words(
      "Equal arc-length samples with transported frames. Chord lengths vary slightly on bends; this is a curve-following rig, without fixed-length preservation.",
      "弧長で等間隔に配置し、フレームを平行移動。曲がった部分のボーン長は変化するため、厳密な定長ソルバではありません。",
    ),
    controls: [
      c("amplitude", "Bend amplitude", "曲がりの強さ", 0, 1.2),
      c("twist", "End twist", "末端のねじり", -180, 180, 1, "°"),
      c("segments", "Segments", "セグメント数", 6, 24, 1),
    ],
    defaults: { amplitude: 0.7, twist: 100, segments: 14, arc: 1 },
  },
  {
    id: "blend",
    title: words("IK / FK blend", "IK / FK Blend"),
    lead: words(
      "Two poses. One continuous transition.",
      "2つの姿勢を、途切れずにつなぐ。",
    ),
    panel: words("Local quaternion blend", "ローカル回転の補間"),
    note: words(
      "Blend parent-local quaternions, then evaluate FK. Match aligns the source controls before switching. At an intermediate weight, it can change the displayed pose.",
      "親に対するローカル回転を SLERP してから FK で評価。Match で切替前のコントロールを合わせます。中間ウェイトでは表示姿勢が変わる場合があります。",
    ),
    controls: [
      c("weight", "IK weight", "IK ウェイト", 0, 1, 0.01),
      c("tx", "Target reach", "ターゲット X", -0.5, 2.8),
      c("ty", "Target height", "ターゲット Y", 0.2, 3),
    ],
    defaults: { weight: 0.5, tx: 1.2, ty: 2.3, pole: 25, matched: 0 },
  },
  {
    id: "contact",
    title: words("Ground contact", "Ground Contact"),
    lead: words(
      "Move the body. Keep the hand in place.",
      "体が動いても、手は同じ場所に。",
    ),
    panel: words("Hand contact IK", "手の接地 IK"),
    note: words(
      "The hand target is fixed in world space while the shoulder moves. This is a kinematic constraint, with no forces or collision response.",
      "肩が動いても、手のターゲットはワールド空間に固定。力や衝突応答を解かない、キネマティックな拘束です。",
    ),
    controls: [
      c("lean", "Body lean", "体の傾き", -0.3, 0.5),
      c("tx", "Contact position", "接地点 X", 0.6, 1.8),
      c("ground", "Surface height", "接地面の高さ", 0, 0.65),
    ],
    defaults: { lean: 0, tx: 1.15, ground: 0, lock: 1 },
  },
  {
    id: "walk",
    title: words("Walk cycle", "Walk Cycle"),
    lead: words(
      "Plant. Transfer weight. Lift. Repeat.",
      "接地し、重心を運び、足を上げる。",
    ),
    panel: words("Procedural gait + IK", "プロシージャル歩行 + IK"),
    note: words(
      "Stance targets stay fixed in world space. Swing follows a smooth arc. Pelvis height follows terrain; balance and ground reaction forces are not simulated.",
      "支持脚の目標はワールド空間に固定。遊脚は滑らかな弧で移動し、骨盤の高さを地形に合わせます。力学的なバランス制御は行いません。",
    ),
    controls: [
      c("stride", "Stride length", "歩幅", 0.4, 1.6),
      c("lift", "Foot lift", "足上げの高さ", 0.1, 0.6),
      c("terrain", "Terrain height", "地形の高さ", 0, 0.45),
    ],
    defaults: { stride: 1.1, lift: 0.28, terrain: 0.12 },
  },
  {
    id: "constraints",
    title: words("Joint constraints", "Joint Constraints"),
    lead: words(
      "A joint can move. A rig decides how far.",
      "動ける方向と、動かせる範囲を分けて考える。",
    ),
    panel: words("Swing / twist limits", "スイング・ツイスト制限"),
    note: words(
      "The wireframe is the requested pose. The solid bone clamps swing and twist in local space. This geometric clamp does not simulate a resisting force.",
      "ワイヤーは要求された姿勢、実線はローカル空間でスイングとツイストを制限した姿勢。これは幾何学的な制限で、抵抗力のシミュレーションではありません。",
    ),
    controls: [
      c("swing", "Requested swing", "要求スイング", 0, 150, 1, "°"),
      c("twist", "Requested twist", "要求ツイスト", -180, 180, 1, "°"),
      c("limit", "Swing limit", "スイング上限", 10, 90, 1, "°"),
    ],
    defaults: { swing: 65, twist: 85, limit: 45 },
  },
  {
    id: "ragdoll",
    title: words("Ragdoll physics", "Ragdoll Physics"),
    lead: words(
      "Grab a body part. Pull, release, and watch the response.",
      "体の好きな場所をつかむ。引っ張って、離してみる。",
    ),
    panel: words("Rapier rigid bodies", "Rapier 剛体シミュレーション"),
    note: words(
      "Drag any body surface while playing to pull with a bounded spring. Empty space orbits the camera. Self-collision covers nonadjacent parts and head/chest; other joined pairs stay filtered. Orange construction markers show body contacts.",
      "再生中に体の表面をドラッグすると、上限のあるばねで引っ張れます。空いている場所ではカメラが回転。自己衝突は非隣接部位と頭・胸が対象で、ほかの接続ペアは除外します。オレンジ色の補助表示は身体同士の接触点です。",
    ),
    controls: [c("push", "Push strength", "押す強さ", 0, 5, 0.1)],
    defaults: { push: 2, selfCollision: 1 },
  },
];
export const getDemo = (id: string) =>
  demos.find((d) => d.id === id) ?? demos[1];
export const initialSettings = () =>
  Object.fromEntries(demos.map((d) => [d.id, { ...d.defaults }]));
export const ui = {
  play: words("Play", "再生"),
  pause: words("Pause", "一時停止"),
  reset: words("Reset", "リセット"),
  guide: words("Read the guide", "ガイドを読む"),
  construction: words("Show construction", "補助線を表示"),
  animate: words("Animate input", "入力をアニメーション"),
  match: words("Match FK to IK", "FK を IK に合わせる"),
  push: words("Push the body", "体を押す"),
  open: words("Open in Lab", "Lab で動かす"),
  source: words("Sources", "参考資料"),
  failures: words("Failure cases & limits", "失敗例と制約"),
  observe: words("Try it yourself", "動かして確かめる"),
  why: words("Why", "なぜ"),
  how: words("How", "どのように"),
  back: words("Back to the lab", "Lab に戻る"),
};
