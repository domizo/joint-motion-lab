import { test, expect, type Page } from "@playwright/test";
import type { RagdollBodyId } from "../../src/engine/ragdoll";

test.use({ video: "on" });

async function standing(page: Page) {
  const toggle = page.getByTestId("play-pause");
  if ((await toggle.textContent())?.includes("Pause")) await toggle.click();
  await page.getByTestId("reset").click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__JOINT_LAB__!())).time)
    .toBe(0);
  await page.getByLabel("Playback speed", { exact: true }).selectOption("0.25");
  if (
    (await page
      .getByRole("button", { name: "Switch camera view", exact: true })
      .textContent()) === "Front"
  )
    await page
      .getByRole("button", { name: "Switch camera view", exact: true })
      .click();
  await toggle.click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__JOINT_LAB__?.().time! > 0);
}
async function bodyPoint(page: Page, id: RagdollBodyId) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  const points = JSON.parse((await canvas.getAttribute("data-body-targets"))!);
  return { x: box!.x + points[id].x, y: box!.y + points[id].y };
}
async function grab(page: Page, id: RagdollBodyId) {
  await standing(page);
  const point = await bodyPoint(page, id);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__JOINT_LAB__!())).drag?.bodyId,
    )
    .toBe(id);
  return point;
}
async function released(page: Page) {
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__JOINT_LAB__!())).drag ?? null,
    )
    .toBeNull();
}

test.describe("physical body surface dragging", () => {
  test("mouse grabs head, torso, hand and foot at surface anchors", async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?demo=ragdoll&lang=en");
    await page.waitForFunction(
      () => window.__JOINT_LAB__?.().status === "physics",
    );
    for (const id of ["head", "chest", "leftHand", "rightFoot"] as const) {
      const point = await grab(page, id);
      const a = await page.evaluate(() => window.__JOINT_LAB__!());
      expect(
        Math.hypot(
          a.drag!.localAnchor.x,
          a.drag!.localAnchor.y,
          a.drag!.localAnchor.z,
        ),
      ).toBeGreaterThan(0.035);
      const camera = await page.locator("canvas").getAttribute("data-camera");
      await page.mouse.move(point.x + 55, point.y - 65, { steps: 12 });
      await expect
        .poll(
          async () =>
            (await page.evaluate(() => window.__JOINT_LAB__!())).drag
              ?.forceMagnitude ?? 0,
        )
        .toBeGreaterThan(1);
      await page.waitForTimeout(700);
      const b = await page.evaluate(() => window.__JOINT_LAB__!());
      expect(b.drag!.target.x).toBeGreaterThan(a.drag!.target.x);
      expect(b.pose).not.toEqual(a.pose);
      expect(b.pose.every(Number.isFinite)).toBeTruthy();
      expect(b.drag!.forceMagnitude).toBeLessThanOrEqual(
        b.drag!.maxForce + 0.001,
      );
      expect(await page.locator("canvas").getAttribute("data-camera")).toBe(
        camera,
      );
      await page.screenshot({
        path: info.outputPath(`pull-${id}.png`),
        fullPage: true,
      });
      await page.mouse.up();
      await released(page);
    }
    expect(errors).toEqual([]);
  });

  test("cancel, capture loss, blur, pause, reset and navigation release the spring", async ({
    page,
  }) => {
    await page.goto("/?demo=ragdoll&lang=en");
    await page.waitForFunction(
      () => window.__JOINT_LAB__?.().status === "physics",
    );
    for (const event of [
      "pointercancel",
      "lostpointercapture",
      "blur",
      "pause",
      "reset",
      "guide",
      "mode",
    ] as const) {
      await grab(page, "head");
      await page.locator("canvas").focus();
      if (event === "pause") await page.keyboard.press("Space");
      else if (event === "reset") await page.keyboard.press("r");
      else if (event === "blur")
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      else if (event === "guide")
        await page
          .getByRole("button", { name: "Guide", exact: true })
          .evaluate((el) => (el as HTMLButtonElement).click());
      else if (event === "mode")
        await page
          .locator("[data-demo=ik]")
          .evaluate((el) => (el as HTMLButtonElement).click());
      else await page.locator("canvas").dispatchEvent(event, { pointerId: 1 });
      // Hidden Guide stops frames: inspect again after returning to the Lab.
      if (event === "guide")
        await page.getByRole("button", { name: "Lab", exact: true }).click();
      if (event === "mode") await page.locator("[data-demo=ragdoll]").click();
      await released(page);
      await page.mouse.up();
    }
    await standing(page);
    await page.getByTestId("play-pause").click();
    const point = await bodyPoint(page, "head");
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 80, point.y - 50);
    await page.mouse.up();
    await released(page);
    const paused = await page.evaluate(() => window.__JOINT_LAB__!());
    await page.waitForTimeout(200);
    expect((await page.evaluate(() => window.__JOINT_LAB__!())).time).toBe(
      paused.time,
    );
    await page.getByTestId("play-pause").click();
    await released(page);
  });

  test("body contacts are distinct from floor contacts and can be toggled", async ({
    page,
  }, info) => {
    await page.goto("/?demo=ragdoll&lang=en");
    await page.waitForFunction(
      () => window.__JOINT_LAB__?.().status === "physics",
    );
    await page.getByLabel("Playback speed", { exact: true }).selectOption("2");
    await expect
      .poll(
        async () =>
          Number(
            await page.locator("[data-metric=selfContacts]").textContent(),
          ),
        { timeout: 25000 },
      )
      .toBeGreaterThan(0);
    await page.waitForFunction(() => window.__JOINT_LAB__?.().time! > 4);
    const state = await page.evaluate(() => window.__JOINT_LAB__!());
    expect(
      state.selfContacts!.every((c) => c.bodyA !== c.bodyB && c.distance <= 0),
    ).toBeTruthy();
    await page.screenshot({
      path: info.outputPath("self-collision-neck.png"),
      fullPage: true,
    });
    await page.getByLabel("Self-collision", { exact: true }).uncheck();
    await expect(page.locator("[data-metric=selfContacts]")).toHaveText("0");
    await expect
      .poll(async () =>
        Number(await page.locator("[data-metric=contacts]").textContent()),
      )
      .toBeGreaterThan(0);
    await page.getByLabel("Self-collision", { exact: true }).check();
    await page.getByTestId("reset").click();
    await expect
      .poll(
        async () =>
          Number(
            await page.locator("[data-metric=selfContacts]").textContent(),
          ),
        { timeout: 25000 },
      )
      .toBeGreaterThan(0);
  });
});

test.describe("touch body pulling", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("real touch pulls a hand and head; cancel and second-pointer arbitration stay bounded", async ({
    page,
    context,
  }, info) => {
    await page.goto("/?demo=ragdoll&lang=en");
    await page.waitForFunction(
      () => window.__JOINT_LAB__?.().status === "physics",
    );
    const cdp = await context.newCDPSession(page);
    for (const id of ["rightHand", "head"] as const) {
      await standing(page);
      const point = await bodyPoint(page, id);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: point.x, y: point.y, id: 7 }],
      });
      await expect
        .poll(
          async () =>
            (await page.evaluate(() => window.__JOINT_LAB__!())).drag?.bodyId,
        )
        .toBe(id);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: point.x + 30, y: point.y - 65, id: 7 }],
      });
      await expect
        .poll(
          async () =>
            (await page.evaluate(() => window.__JOINT_LAB__!())).drag
              ?.forceMagnitude ?? 0,
        )
        .toBeGreaterThan(1);
      await page.screenshot({
        path: info.outputPath(`touch-${id}.png`),
        fullPage: true,
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: point.x + 30, y: point.y - 65, id: 7 },
          { x: 40, y: 400, id: 9 },
        ],
      });
      expect(
        (await page.evaluate(() => window.__JOINT_LAB__!())).drag?.bodyId,
      ).toBe(id);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      await released(page);
      expect(
        (await page.evaluate(() => window.__JOINT_LAB__!())).pose.every(
          Number.isFinite,
        ),
      ).toBeTruthy();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await cdp.detach();
  });
});
