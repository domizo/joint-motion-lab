import { useCallback, useEffect, useRef, useState } from "react";
import { demos, getDemo, initialSettings, ui } from "./content/demos";
import type { DemoId, Language } from "./content/demos";
import { SceneView } from "./components/SceneView";
import type { Snapshot } from "./components/SceneView";
import { GuideView } from "./components/GuideView";
import { Metrics } from "./components/Metrics";
import { Arrow, JointMark, PlaybackIcon } from "./components/Icons";
import { V, DEG, twoBone, localRotations, forward } from "./engine/kinematics";
import { blendFK } from "./engine/frame";
function readStorage() {
  try {
    return JSON.parse(localStorage.getItem("joint-lab-v1") ?? "{}");
  } catch {
    return {};
  }
}
function route() {
  const q = new URLSearchParams(location.search);
  return {
    id: getDemo(q.get("demo") ?? "ik").id,
    view: q.get("view") === "guide" ? "guide" : "lab",
    language: q.get("lang") === "en" ? "en" : "ja",
  } as { id: DemoId; view: "lab" | "guide"; language: Language };
}
export default function App() {
  const initial = useRef(route()),
    [id, setId] = useState(initial.current.id),
    [view, setView] = useState(initial.current.view),
    [language, setLanguage] = useState<Language>(
      new URLSearchParams(location.search).has("lang")
        ? initial.current.language
        : readStorage().language === "en"
          ? "en"
          : "ja",
    );
  const [settings, setSettings] = useState<
    Record<string, Record<string, number>>
  >(() => {
    const base = initialSettings(),
      saved = readStorage().settings;
    for (const d of demos) {
      for (const c of d.controls) {
        const v = saved?.[d.id]?.[c.key];
        if (typeof v === "number" && Number.isFinite(v))
          base[d.id][c.key] = Math.min(c.max, Math.max(c.min, v));
      }
    }
    return base;
  });
  const reduced = useRef(
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [playing, setPlaying] = useState(!reduced.current),
    [animate, setAnimate] = useState(!reduced.current),
    [construction, setConstruction] = useState(true),
    [speed, setSpeed] = useState(1),
    [reset, setReset] = useState(0),
    [push, setPush] = useState(0),
    [front, setFront] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    time: 0,
    metrics: {},
    pose: [],
    frames: 0,
    status: "ready",
  });
  const current = useRef(snapshot);
  current.current = snapshot;
  const demo = getDemo(id),
    p = settings[id];
  const navigate = (
    nextId: DemoId,
    nextView: "lab" | "guide",
    lang = language,
  ) => {
    setId(nextId);
    setView(nextView);
    setLanguage(lang);
    const url = new URL(location.href);
    url.searchParams.set("demo", nextId);
    url.searchParams.set("view", nextView);
    url.searchParams.set("lang", lang);
    url.hash = "";
    history.pushState({}, "", url);
  };
  useEffect(() => {
    const pop = () => {
      const r = route();
      setId(r.id);
      setView(r.view);
      setLanguage(r.language);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem(
        "joint-lab-v1",
        JSON.stringify({ language, settings }),
      );
    } catch {
      /* Private browsing can disallow storage. */
    }
  }, [language, settings]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input,select,textarea,button,a") || view !== "lab")
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((p) => !p);
      }
      if (event.key.toLowerCase() === "r") setReset((r) => r + 1);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [view]);
  const setParam = useCallback(
    (key: string, value: number) =>
      setSettings(
        (s) =>
          ({
            ...s,
            [id]: {
              ...s[id],
              [key]: value,
              ...(key === "pole"
                ? { px: undefined, py: undefined, pz: undefined }
                : {}),
            },
          }) as Record<string, Record<string, number>>,
      ),
    [id],
  );
  const onTarget = useCallback(
    (x: number, y: number) => {
      setAnimate(false);
      const controls = getDemo(id).controls;
      const rangeX = controls.find((c) => c.key === "tx"),
        rangeY = controls.find((c) => c.key === "ty");
      if (rangeX) x = Math.max(rangeX.min, Math.min(rangeX.max, x));
      if (rangeY) y = Math.max(rangeY.min, Math.min(rangeY.max, y));
      setSettings((s) => ({ ...s, [id]: { ...s[id], tx: x, ty: y } }));
    },
    [id],
  );
  const match = (direction: "fk" | "ik") => {
    const t = current.current.time,
      root = V(0, 0.45),
      target = V(
        p.tx + (animate ? 0.25 * Math.sin(t * 0.7) : 0),
        p.ty + (animate ? 0.28 * Math.sin(t * 0.9) : 0),
      ),
      pole =
        p.px !== undefined
          ? V(p.px, p.py, p.pz)
          : root
              .clone()
              .add(
                V(
                  0.1,
                  1.8 * Math.cos(p.pole * DEG),
                  1.8 * Math.sin(p.pole * DEG),
                ),
              );
    let next: Record<string, number> = { ...p, tx: target.x, ty: target.y };
    if (direction === "fk") {
      const rotations = localRotations(twoBone(root, target, pole).points);
      rotations.forEach((q, i) => {
        next = {
          ...next,
          [`q${i}x`]: q.x,
          [`q${i}y`]: q.y,
          [`q${i}z`]: q.z,
          [`q${i}w`]: q.w,
        };
      });
      next.weight = 0;
    } else {
      const points = forward(root, [1.25, 1.1], blendFK(p)).points,
        end = points[2],
        elbow = points[1],
        axis = end.clone().sub(root).normalize(),
        projection = root
          .clone()
          .addScaledVector(axis, elbow.clone().sub(root).dot(axis));
      const bend = elbow.clone().sub(projection).normalize();
      const pole = root.clone().add(bend.multiplyScalar(2));
      next = {
        ...p,
        tx: end.x,
        ty: end.y,
        px: pole.x,
        py: pole.y,
        pz: pole.z,
        weight: 1,
      };
    }
    next.matched = 1;
    setSettings((s) => ({ ...s, blend: next }));
    setAnimate(false);
  };
  const needsTarget = ["ik", "chain", "blend"].includes(id);
  const canAnimate = !["walk", "ragdoll"].includes(id);
  return (
    <div className={`app view-${view}`}>
      <a className="skip" href="#main">
        {language === "ja" ? "本文へ" : "Skip to content"}
      </a>
      <header className="app-header">
        <a
          href="?demo=ik&view=lab"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("ik", "lab");
          }}
        >
          <JointMark />
          <span>Joint Motion Lab</span>
        </a>
        <nav aria-label="Workspace">
          <button
            className={view === "lab" ? "active" : ""}
            onClick={() => navigate(id, "lab")}
          >
            Lab
          </button>
          <button
            className={view === "guide" ? "active" : ""}
            onClick={() => navigate(id, "guide")}
          >
            Guide
          </button>
        </nav>
        <div className="language" aria-label="Language">
          <button
            aria-pressed={language === "en"}
            onClick={() => navigate(id, view, "en")}
          >
            EN
          </button>
          <span>/</span>
          <button
            aria-pressed={language === "ja"}
            onClick={() => navigate(id, view, "ja")}
          >
            日本語
          </button>
        </div>
      </header>
      <div className="app-body">
        <aside
          className="chapter-nav"
          aria-label={language === "ja" ? "デモ一覧" : "Demonstrations"}
        >
          {demos.map((d, i) => (
            <button
              key={d.id}
              onClick={() => navigate(d.id, view)}
              className={id === d.id ? "selected" : ""}
              aria-current={id === d.id ? "page" : undefined}
              data-demo={d.id}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {d.title[language]}
            </button>
          ))}
          <div className="rail-footer">
            {language === "ja"
              ? "動きから、仕組みへ。"
              : "From motion to mechanics."}
            <small>Three.js · Rapier</small>
          </div>
        </aside>
        <main id="main">
          <div className="lab-layout" hidden={view !== "lab"}>
            <section className="stage">
              <div className="stage-heading">
                <h1>{demo.title[language]}</h1>
                <p>{demo.lead[language]}</p>
              </div>
              <SceneView
                id={id}
                settings={p}
                playing={playing}
                speed={speed}
                animate={animate}
                construction={construction}
                visible={view === "lab"}
                reset={reset}
                push={push}
                front={front}
                language={language}
                onTarget={onTarget}
                onSnapshot={setSnapshot}
              />
              <div className="viewport-tools">
                <button
                  onClick={() => setFront((f) => !f)}
                  aria-label={
                    language === "ja"
                      ? "カメラを切り替える"
                      : "Switch camera view"
                  }
                >
                  {front ? "3D" : "Front"}
                </button>
                <span>
                  {needsTarget
                    ? language === "ja"
                      ? "緑をドラッグ · 余白で視点を回転"
                      : "Drag green target · orbit the empty space"
                    : language === "ja"
                      ? "ドラッグで回転 · スクロールで拡大"
                      : "Drag to orbit · scroll to zoom"}
                </span>
              </div>
              <div className="transport">
                <button
                  className="play"
                  onClick={() => setPlaying((p) => !p)}
                  data-testid="play-pause"
                >
                  <PlaybackIcon playing={playing} />
                  {(playing ? ui.pause : ui.play)[language]}
                </button>
                <button
                  onClick={() => setReset((r) => r + 1)}
                  data-testid="reset"
                >
                  {ui.reset[language]}
                </button>
                <div className="time" aria-label="Elapsed time">
                  {snapshot.time.toFixed(1)} <span>s</span>
                </div>
                <label className="speed">
                  <span>{language === "ja" ? "速度" : "Speed"}</span>
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    aria-label={
                      language === "ja" ? "再生速度" : "Playback speed"
                    }
                  >
                    <option value={0.25}>0.25×</option>
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={2}>2×</option>
                  </select>
                </label>
              </div>
            </section>
            <aside className="inspector">
              <h2>{demo.panel[language]}</h2>
              <div className="controls">
                {demo.controls.map((c) => (
                  <label className="slider" key={c.key}>
                    <span>
                      {c.label[language]}
                      <output>
                        {Number(p[c.key]).toFixed(c.step >= 1 ? 0 : 2)}
                        {c.unit}
                      </output>
                    </span>
                    <input
                      type="range"
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      value={p[c.key]}
                      onChange={(e) => setParam(c.key, Number(e.target.value))}
                      aria-label={c.label[language]}
                      data-control={c.key}
                    />
                  </label>
                ))}
                <div className="checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={construction}
                      onChange={(e) => setConstruction(e.target.checked)}
                    />
                    {ui.construction[language]}
                  </label>
                  {canAnimate && (
                    <label>
                      <input
                        type="checkbox"
                        checked={animate}
                        onChange={(e) => setAnimate(e.target.checked)}
                      />
                      {ui.animate[language]}
                    </label>
                  )}
                  {id === "spline" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={p.arc !== 0}
                        onChange={(e) =>
                          setParam("arc", Number(e.target.checked))
                        }
                      />
                      {language === "ja"
                        ? "弧長で等間隔に配置"
                        : "Equal arc-length spacing"}
                    </label>
                  )}
                  {id === "contact" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={p.lock !== 0}
                        onChange={(e) =>
                          setParam("lock", Number(e.target.checked))
                        }
                      />
                      {language === "ja"
                        ? "手を接地点に固定"
                        : "Lock the hand target"}
                    </label>
                  )}
                </div>
                {id === "blend" && (
                  <div className="match-buttons">
                    <button className="button" onClick={() => match("fk")}>
                      {ui.match[language]}
                    </button>
                    <button className="button" onClick={() => match("ik")}>
                      {language === "ja"
                        ? "IK を FK に合わせる"
                        : "Match IK to FK"}
                    </button>
                  </div>
                )}
                {id === "ragdoll" && (
                  <button
                    className="button lime"
                    onClick={() => setPush((n) => n + 1)}
                    disabled={snapshot.status !== "physics"}
                  >
                    {ui.push[language]}
                    <Arrow />
                  </button>
                )}
              </div>
              <Metrics metrics={snapshot.metrics} language={language} />
              <div className="inspector-note">
                <p>{demo.note[language]}</p>
                <button
                  className="text-link"
                  onClick={() => navigate(id, "guide")}
                >
                  {ui.guide[language]}
                  <Arrow />
                </button>
              </div>
            </aside>
          </div>
          {view === "guide" && (
            <GuideView
              id={id}
              language={language}
              settings={p}
              snapshot={snapshot}
              animate={animate}
              onLab={() => navigate(id, "lab")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
