// Read-only UI verification against the running app and an existing local Patient account.
// No API interception, fixture insertion, authentication bypass or clinical writes.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const root = resolve(import.meta.dirname, "..");
const passwordLine = readFileSync(resolve(root, ".env"), "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("CLINORA_DEV_PATIENTS_PASSWORD="));
const password = passwordLine
  ?.slice(passwordLine.indexOf("=") + 1)
  .trim()
  .replace(/^['"]|['"]$/g, "");
if (!password)
  throw new Error(
    "The documented local Patient test password is not configured.",
  );
const output = resolve(root, ".codex-smoke/patient-dashboard");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.argv[3],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
const interactions = [];
page.on("pageerror", (error) => errors.push(error.message));
const apiStatus = {};
let historyCount = null;
page.on("response", async (response) => {
  const path = new URL(response.url()).pathname;
  if (path.startsWith("/api/v1/patient/")) apiStatus[path] = response.status();
  if (path === "/api/v1/patient/health-trends" && response.ok()) {
    const json = await response.json();
    historyCount = json.data.points.length;
  }
});
try {
  await page.goto("http://localhost:5173/patient");
  await page
    .getByLabel("Email", { exact: true })
    .fill("rumana.akter.patient@clinora.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/patient", { timeout: 20000 });
  await page.locator(".patient-home__metrics").waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".patient-home__loading"),
  );
  await page.locator(".patient-home video").evaluate(async (video) => {
    if (video.readyState < 2)
      await new Promise((resolve) =>
        video.addEventListener("loadeddata", resolve, { once: true }),
      );
  });
  await page.evaluate(() => document.fonts.ready);
  const dimensions = [];
  for (const width of [1672, 1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    // Allow responsive chart observers and the existing shell entrance to settle.
    await page.waitForTimeout(350);
    const geometry = await page.evaluate(() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const art = Array.from(
        document.querySelectorAll(".patient-home *"),
      ).filter((element) =>
        [
          getComputedStyle(element).backgroundImage,
          getComputedStyle(element, "::before").backgroundImage,
          getComputedStyle(element, "::after").backgroundImage,
        ].some((value) => value.includes("cinematic-poster")),
      );
      return {
        viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        videoCount: document.querySelectorAll(".patient-home video").length,
        duplicatePosterImages: document.querySelectorAll(
          '.patient-home img[src*="cinematic-poster"]',
        ).length,
        duplicatePosterBackgrounds: art.length,
        workspace: box(".patient-home"),
        actions: box(".patient-home__actions"),
        actionCards: Array.from(
          document.querySelectorAll(".patient-home__action"),
        ).map((element) => ({
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        })),
        rail: box(".patient-home__rail"),
        chartCount: document.querySelectorAll(".patient-home__sparkline")
          .length,
      };
    });
    dimensions.push(geometry);
    await page.screenshot({
      path: resolve(output, `patient-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Upload a report", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  interactions.push({
    action: "Upload action opens existing dialog",
    passed: await dialog.isVisible(),
  });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  interactions.push({
    action: "Ctrl K focuses search",
    passed: await page
      .getByRole("textbox", { name: /Jump to reports/ })
      .evaluate((element) => element === document.activeElement),
  });
  await page
    .getByRole("textbox", { name: /Jump to reports/ })
    .fill("health record");
  await page.getByRole("textbox", { name: /Jump to reports/ }).press("Enter");
  await page.waitForURL("**/patient/history");
  interactions.push({
    action: "Search navigates to existing Health Record",
    passed: true,
  });
  await page.goto("http://localhost:5173/patient");
  await page.locator(".patient-home__metrics").waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".patient-home__loading"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator(".patient-home__media img").waitFor();
  interactions.push({
    action: "Reduced motion uses exactly one poster and no video",
    passed:
      (await page.locator(".patient-home__media img").count()) === 1 &&
      (await page.locator(".patient-home video").count()) === 0,
  });
  const result = { apiStatus, historyCount, errors, dimensions, interactions };
  writeFileSync(
    resolve(output, "verification.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  if (
    errors.length ||
    interactions.some((item) => !item.passed) ||
    dimensions.some(
      (item) =>
        item.scrollWidth > item.viewport ||
        item.videoCount !== 1 ||
        item.duplicatePosterImages ||
        item.duplicatePosterBackgrounds,
    )
  )
    process.exitCode = 1;
} finally {
  // Revoke only the session created by this validation, through the regular logout action.
  if (page.url().endsWith("/patient")) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("button", { name: "Open Patient account menu" })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL("**/login");
  }
  await browser.close();
}
