import type { Language } from "../content/demos";
const labels: Record<string, [string, string]> = {
  error: ["Target error", "ターゲット誤差"],
  bend: ["Bend angle", "曲げ角度"],
  reach: ["Reach", "到達範囲"],
  singular: ["Bend plane", "曲げ平面"],
  tipX: ["Tip X", "先端 X"],
  tipY: ["Tip Y", "先端 Y"],
  bones: ["Bones", "ボーン数"],
  fabrikError: ["FABRIK error", "FABRIK 誤差"],
  ccdError: ["CCD error", "CCD 誤差"],
  iterations: ["Iteration budget", "反復上限"],
  curveLength: ["Curve length", "曲線の長さ"],
  minBone: ["Shortest chord", "最短のボーン"],
  maxBone: ["Longest chord", "最長のボーン"],
  weight: ["IK weight", "IK ウェイト"],
  matched: ["Source geometry", "元の形状"],
  contact: ["Contact", "接地状態"],
  solver: ["Solver", "ソルバ"],
  left: ["Left foot", "左足"],
  right: ["Right foot", "右足"],
  plantError: ["Plant error", "接地誤差"],
  swing: ["Requested swing", "要求スイング"],
  twist: ["Clamped twist", "制限後ツイスト"],
  limit: ["Swing limit", "スイング上限"],
  status: ["Constraint", "制約"],
  contacts: ["Floor contacts", "床との接触点"],
  selfContacts: ["Body contacts", "身体同士の接触点"],
  pulledBody: ["Grabbed part", "つかんだ部位"],
  pullForce: ["Pull force", "引く力"],
  jointError: ["Joint error", "関節誤差"],
  energy: ["Kinetic energy", "運動エネルギー"],
  sleeping: ["Sleeping bodies", "休止中の剛体"],
};
const values: Record<string, [string, string]> = {
  released: ["Released", "なし"],
  pelvis: ["Pelvis", "骨盤"],
  chest: ["Chest", "胸"],
  head: ["Head", "頭"],
  leftUpperArm: ["Left upper arm", "左上腕"],
  rightUpperArm: ["Right upper arm", "右上腕"],
  leftForearm: ["Left forearm", "左前腕"],
  rightForearm: ["Right forearm", "右前腕"],
  leftHand: ["Left hand", "左手"],
  rightHand: ["Right hand", "右手"],
  leftThigh: ["Left thigh", "左太もも"],
  rightThigh: ["Right thigh", "右太もも"],
  leftShin: ["Left shin", "左すね"],
  rightShin: ["Right shin", "右すね"],
  leftFoot: ["Left foot", "左足"],
  rightFoot: ["Right foot", "右足"],
  reachable: ["Reachable", "到達可能"],
  unreachable: ["Out of reach", "範囲外"],
  fallback: ["Singular fallback", "特異点の代替処理"],
  stable: ["Stable", "安定"],
  matched: ["Matched", "一致済み"],
  independent: ["Independent", "独立"],
  planted: ["Planted", "固定"],
  unlocked: ["Unlocked", "固定なし"],
  outOfReach: ["Out of reach", "範囲外"],
  kinematic: ["Kinematic", "キネマティック"],
  stance: ["Stance", "支持期"],
  swing: ["Swing", "遊脚期"],
  limited: ["Limited", "制限中"],
  free: ["Within limits", "制限内"],
};
export function metricLabel(key: string, lang: Language) {
  return labels[key]?.[lang === "en" ? 0 : 1] ?? key;
}
export function metricValue(
  key: string,
  value: string | number,
  lang: Language,
) {
  if (typeof value === "string")
    return values[value]?.[lang === "en" ? 0 : 1] ?? value;
  if (
    ["bones", "iterations", "contacts", "selfContacts", "sleeping"].includes(
      key,
    )
  )
    return String(value);
  if (["bend", "swing", "twist", "limit"].includes(key))
    return `${value.toFixed(0)}°`;
  if (key === "pullForce") return `${value.toFixed(0)} N`;
  if (key === "energy") return `${value.toFixed(2)} J`;
  return value.toFixed(3);
}
export function Metrics({
  metrics,
  language,
}: {
  metrics: Record<string, string | number>;
  language: Language;
}) {
  return (
    <dl className="metrics" aria-live="off">
      {Object.entries(metrics)
        .filter(([key]) => key !== "leftError" && key !== "rightError")
        .map(([key, value]) => (
          <div key={key}>
            <dt>{metricLabel(key, language)}</dt>
            <dd
              className={
                typeof value === "string" &&
                ["unreachable", "outOfReach", "fallback"].includes(value)
                  ? "warning"
                  : ""
              }
              data-metric={key}
            >
              {metricValue(key, value, language)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
