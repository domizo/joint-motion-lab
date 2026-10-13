import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
const demos = [
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
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
for (const id of demos)
  test(`${id}: WebGL render, motion, pause and reset`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/?demo=${id}&view=lab&lang=en`);
    await expect(page.locator("canvas[data-webgl=ready]")).toBeVisible();

    await page.getByTestId("reset").click();
    await page.waitForFunction(() => window.__JOINT_LAB__?.().pose.length! > 0);
    if (id === "ragdoll")
      await page.waitForFunction(
        () => window.__JOINT_LAB__?.().status === "physics",
      );
    await page.waitForTimeout(180);
    const a = await page.evaluate(() => window.__JOINT_LAB__!());
    const shotA = await page.locator("canvas").screenshot();
    await page.waitForTimeout(700);
    const b = await page.evaluate(() => window.__JOINT_LAB__!());
    const shotB = await page.locator("canvas").screenshot();
    expect(b.pose.every(Number.isFinite)).toBeTruthy();
    expect(b.time).toBeGreaterThan(a.time);
    expect(b.pose).not.toEqual(a.pose);
    expect(hash(shotA), `${id}: actual WebGL pixels must change`).not.toBe(
      hash(shotB),
    );
    expect(shotB.byteLength).toBeGreaterThan(10000);
    await page.screenshot({
      path: testInfo.outputPath(`${id}-desktop.png`),
      fullPage: true,
    });
    await page.getByTestId("play-pause").click();
    const paused = await page.evaluate(() => window.__JOINT_LAB__!());
    await page.waitForTimeout(220);
    const later = await page.evaluate(() => window.__JOINT_LAB__!());
    expect(later.time).toBe(paused.time);
    expect(later.pose).toEqual(paused.pose);
    await page.getByTestId("reset").click();
    await expect
      .poll(
        async () => (await page.evaluate(() => window.__JOINT_LAB__!())).time,
        { timeout: 15000 },
      )
      .toBe(0);
    await page.getByTestId("play-pause").click();
    expect(errors).toEqual([]);
  });
test("controls, guide routing and bilingual mobile layout", async ({
  page,
}, testInfo) => {
  await page.goto("/?demo=ik&view=lab&lang=en");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Animate input", { exact: true }).uncheck();
  await page.getByLabel("Target reach", { exact: true }).focus();
  await page.keyboard.press("End");
  await expect(page.locator("[data-metric=reach]")).toHaveText("Out of reach");
  const setting = await page.locator("[data-control=tx]").inputValue();
  await page
    .getByRole("button", { name: "Read the guide", exact: true })
    .click();
  await expect(page.locator(".guide-article")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("guide-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open in Lab", exact: true })
    .first()
    .click();
  expect(await page.locator("[data-control=tx]").inputValue()).toBe(setting);
  await page.goBack();
  await expect(page.locator(".guide-article")).toBeVisible();
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("guide-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Lab", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("lab-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  for (const id of demos) {
    await page.locator(`[data-demo="${id}"]`).click();
    await expect(page.locator(".inspector h2")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});
test("IK/FK matching and real physics push", async ({ page }) => {
  await page.goto("/?demo=blend&view=lab&lang=en");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Animate input", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Match FK to IK", exact: true })
    .click();
  await expect(page.locator("[data-control=weight]")).toHaveValue("0");
  await expect
    .poll(async () =>
      Number(await page.locator("[data-metric=error]").textContent()),
    )
    .toBeLessThan(0.001);
  await page.locator("[data-control=weight]").focus();
  await page.keyboard.press("End");
  await expect
    .poll(async () =>
      Number(await page.locator("[data-metric=error]").textContent()),
    )
    .toBeLessThan(0.001);
  await page
    .getByRole("button", { name: "Match IK to FK", exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(await page.locator("[data-metric=error]").textContent()),
    )
    .toBeLessThan(0.001);
  await page.locator("[data-demo=ragdoll]").click();
  await page.waitForFunction(
    () => window.__JOINT_LAB__?.().status === "physics",
  );
  await page.getByTestId("reset").click();
  await page
    .getByRole("button", { name: "Push the body", exact: true })
    .click();
  await page.waitForTimeout(500);
  const snap = await page.evaluate(() => window.__JOINT_LAB__!());
  expect(Number(snap.metrics.energy)).toBeGreaterThan(0);
  expect(snap.pose.every(Number.isFinite)).toBeTruthy();
});

test("direct target dragging and mobile target framing", async ({
  page,
}, testInfo) => {
  await page.goto("/?demo=ik&view=lab&lang=en");
  await page.getByLabel("Animate input", { exact: true }).uncheck();
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-target-x", /.+/);
  const before = Number(await page.locator("[data-control=tx]").inputValue());
  const rect = await canvas.boundingBox();
  const x = Number(await canvas.getAttribute("data-target-x")),
    y = Number(await canvas.getAttribute("data-target-y"));
  await page.mouse.move(rect!.x + x, rect!.y + y);
  await page.mouse.down();
  await page.mouse.move(rect!.x + x - 65, rect!.y + y + 15, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.locator("[data-control=tx]").inputValue()),
    )
    .toBeLessThan(before - 0.05);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Target reach", { exact: true }).press("End");
  await expect
    .poll(async () => {
      const box = await canvas.boundingBox();
      const target = Number(await canvas.getAttribute("data-target-x"));
      return target > 15 && target < box!.width - 15;
    })
    .toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("target-mobile.png"),
    fullPage: true,
  });
});
