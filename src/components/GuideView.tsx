import { useMemo } from "react";
import type { DemoId, Language } from "../content/demos";
import { ui } from "../content/demos";
import { guideChapters } from "../content/guide";
import { makeFrame } from "../engine/frame";
import type { Snapshot } from "./SceneView";
import { Arrow } from "./Icons";
import { Metrics } from "./Metrics";
function Diagram({
  id,
  settings,
  snapshot,
  animate,
}: {
  id: DemoId;
  settings: Record<string, number>;
  snapshot: Snapshot;
  animate: boolean;
}) {
  const frame = useMemo(
    () => makeFrame(id, settings, snapshot.time, animate, true),
    [id, settings, snapshot.time, animate],
  );
  if (id === "ragdoll")
    return (
      <svg
        viewBox="0 0 700 300"
        className="guide-diagram"
        role="img"
        aria-label="Rigid bodies joined by constraints fall toward a colliding floor"
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0 0 6 3 0 6" fill="#967be1" />
          </marker>
        </defs>
        <path d="M50 265h600" stroke="#b1bba4" strokeWidth="2" />
        <g
          stroke="#3c4640"
          fill="#3c4640"
          strokeWidth="16"
          strokeLinecap="round"
        >
          <path d="m350 128 0 63m0-42-48 31m48-31 48 31m-48 11-28 53m28-53 28 53" />
          <circle cx="350" cy="95" r="22" />
        </g>
        <g fill="#d4ed72">
          {[
            [350, 128],
            [350, 191],
            [302, 180],
            [398, 180],
            [322, 244],
            [378, 244],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="6" />
          ))}
        </g>
        <path
          d="M490 85v110"
          stroke="#967be1"
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
        <text x="510" y="145">
          gravity
        </text>
        <text x="60" y="249">
          collider
        </text>
        <text x="390" y="116">
          joint constraint
        </text>
      </svg>
    );
  const points = [
    ...frame.segments.flatMap((s) => [s.a, s.b]),
    ...frame.markers.map((m) => m.position),
  ];
  if (!points.length) return null;
  const xs = points.map((p) => p.x + p.z * 0.25),
    ys = points.map((p) => p.y),
    minX = Math.min(...xs) - 0.3,
    maxX = Math.max(...xs) + 0.3,
    minY = Math.min(...ys) - 0.3,
    maxY = Math.max(...ys) + 0.3,
    scale = Math.min(530 / (maxX - minX), 235 / (maxY - minY));
  const project = (p: { x: number; y: number; z: number }) => ({
    x: 350 + (p.x + p.z * 0.25 - (minX + maxX) / 2) * scale,
    y: 153 - (p.y - (minY + maxY) / 2) * scale,
  });
  return (
    <svg
      viewBox="0 0 700 310"
      className="guide-diagram"
      role="img"
      aria-label={`${id} current pose diagram, projected into the page`}
    >
      <path d="M45 279h610" stroke="#d4dbcb" />
      {frame.lines.map((l, i) => (
        <polyline
          key={"l" + i}
          points={l.points
            .map((p) => {
              const a = project(p);
              return `${a.x},${a.y}`;
            })
            .join(" ")}
          fill="none"
          stroke={`#${l.color.toString(16).padStart(6, "0")}`}
          strokeWidth="1"
          strokeDasharray="4 5"
        />
      ))}
      {frame.segments.map((s, i) => {
        const a = project(s.a),
          b = project(s.b);
        return (
          <line
            key={"s" + i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={`#${(s.color ?? 0x3c4640).toString(16).padStart(6, "0")}`}
            strokeWidth={s.ghost ? 2 : 5}
            opacity={s.ghost ? 0.3 : 1}
            strokeLinecap="round"
          />
        );
      })}
      {frame.markers.map((m, i) => {
        const a = project(m.position);
        return (
          <g key={"m" + i}>
            <circle
              cx={a.x}
              cy={a.y}
              r={m.type === "target" ? 10 : m.type === "pole" ? 6 : 5}
              fill={`#${m.color.toString(16).padStart(6, "0")}`}
            />
            {["target", "pole"].includes(m.type ?? "") && (
              <text x={a.x + 13} y={a.y - 10}>
                {m.type}
              </text>
            )}
          </g>
        );
      })}
      <text x="46" y="302">
        {id === "walk"
          ? "stance → swing → stance"
          : id === "blend"
            ? "local quaternion SLERP"
            : id === "spline"
              ? "tangent · transported normal · twist"
              : id === "constraints"
                ? "requested → constrained"
                : id === "fk"
                  ? "parent world × local rotation"
                  : "root → joint → endpoint"}
      </text>
    </svg>
  );
}
export function GuideView({
  id,
  language,
  settings,
  snapshot,
  animate,
  onLab,
}: {
  id: DemoId;
  language: Language;
  settings: Record<string, number>;
  snapshot: Snapshot;
  animate: boolean;
  onLab: () => void;
}) {
  const chapter = guideChapters[id],
    text = chapter[language];
  const guideMetrics =
    id === "ragdoll"
      ? snapshot.status === "physics"
        ? snapshot.metrics
        : {}
      : makeFrame(id, settings, snapshot.time, animate, true).metrics;
  return (
    <div className="guide-layout">
      <article className="guide-article">
        <header>
          <h1>{text.title}</h1>
          <p className="guide-lead">{text.lead}</p>
        </header>
        <figure>
          <Diagram
            id={id}
            settings={settings}
            snapshot={snapshot}
            animate={animate}
          />
          <figcaption>
            {id === "ragdoll"
              ? language === "ja"
                ? "剛体・関節・重力を示す概念図。現在のシミュレーション姿勢ではありません。"
                : "A schematic of bodies, joints and gravity, not the current simulated pose."
              : language === "ja"
                ? "現在の設定から構成した図。回転や動きは Lab で確認できます。"
                : "A diagram of the current settings. Explore rotation and motion in the Lab."}
          </figcaption>
        </figure>
        <section id="concept" className="guide-steps">
          {text.steps.map((step, i) => (
            <div className="guide-step" key={step.title}>
              <span className="step-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.why}</p>
                <p>{step.how}</p>
              </div>
            </div>
          ))}
        </section>
        <div className="formula">
          <p>{text.formula}</p>
          <small>{text.formulaNote}</small>
        </div>
        <section id="try">
          <h2>{ui.observe[language]}</h2>
          <ol>
            {text.observe.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <button className="button lime" onClick={onLab}>
            {ui.open[language]}
            <Arrow />
          </button>
        </section>
        <section id="limits">
          <h2>{ui.failures[language]}</h2>
          <ul>
            {text.failures.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section id="sources">
          <h2>{ui.source[language]}</h2>
          <ul className="source-list">
            {chapter.citations.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                  <Arrow />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>
      <aside className="guide-outline">
        <p>{language === "ja" ? "このページ" : "On this page"}</p>
        <a href="#concept">{language === "ja" ? "仕組み" : "Concept"}</a>
        <a href="#try">{ui.observe[language]}</a>
        <a href="#limits">{ui.failures[language]}</a>
        <a href="#sources">{ui.source[language]}</a>
        <button className="button lime" onClick={onLab}>
          {ui.open[language]}
          <Arrow />
        </button>
        <div className="guide-current">
          <p>{language === "ja" ? "現在の実験" : "Current experiment"}</p>
          <Metrics metrics={guideMetrics} language={language} />
        </div>
      </aside>
    </div>
  );
}
