import { expect, test, type Page } from "@playwright/test";
import { makeNoisePng, makePng } from "../helpers";

const soil = () => ({ name: "soil.png", mimeType: "image/png", buffer: makePng(320, 240, [110, 80, 55]) });

async function uploadAndAnalyze(page: Page, city = "Pune") {
  await page.goto("/analyze");
  await expect(page.getByText("Mock provider active")).toBeVisible();
  await page.getByTestId("upload-input").setInputFiles(soil());
  await expect(page.getByAltText("Selected soil photo preview")).toBeVisible();
  await page.getByLabel(/city name/i).fill(city);
  await page.getByRole("button", { name: "Analyze soil" }).click();
  await expect(page.getByRole("heading", { name: "Loamy soil" })).toBeVisible();
}

test("application starts and health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: "ok", provider: { name: "mock", isMock: true }, historyStorage: "browser" });
});

test("upload → analyze → results → history → report", async ({ page }) => {
  await uploadAndAnalyze(page, "Nairobi");
  await expect(page.getByText(/Demo result\./)).toBeVisible();
  await expect(page.getByText("Laboratory test required").first()).toBeVisible();
  await expect(page.getByText(/Saved to history in this browser/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download report/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^soilclass-report-nairobi-\d{4}-\d{2}-\d{2}\.html$/);

  await page.goto("/history");
  const item = page.getByRole("link", { name: /Loamy soil/ });
  await expect(item).toContainText("Nairobi");
  await item.click();
  await expect(page.getByRole("heading", { name: "Loamy soil" })).toBeVisible();

  page.once("dialog", d => void d.accept());
  await page.goto("/history");
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByText("No saved analyses yet.")).toBeVisible();
});

test("city name is required", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByTestId("upload-input").setInputFiles(soil());
  await page.getByRole("button", { name: "Analyze soil" }).click();
  await expect(page.getByText("Please enter a city name.")).toBeVisible();
});

test("unsupported files are rejected in the browser", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByTestId("upload-input").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.locator(".alert-error")).toContainText(/Unsupported file/);
});

test("oversized photos are downscaled before upload", async ({ page }) => {
  const big = makeNoisePng(1600, 1200);
  expect(big.length).toBeGreaterThan(5 * 1024 * 1024);
  await page.goto("/analyze");
  await page.getByTestId("upload-input").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: big });
  await expect(page.getByAltText("Selected soil photo preview")).toBeVisible();
  await expect(page.getByText(/resized/i).first()).toBeVisible();
  await page.getByLabel(/city name/i).fill("Lima");
  await page.getByRole("button", { name: "Analyze soil" }).click();
  await expect(page.getByRole("heading", { name: "Loamy soil" })).toBeVisible();
});

test("camera capture with a (fake) device", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByRole("button", { name: /Take a Picture/ }).click();
  await expect(page.getByLabel("Live camera preview")).toBeVisible();
  await page.getByRole("button", { name: "Capture photo" }).click();
  await expect(page.getByAltText("Captured soil photo preview")).toBeVisible();
  await page.getByRole("button", { name: "Retake" }).click();
  await page.getByRole("button", { name: "Capture photo" }).click();
  await page.getByRole("button", { name: "Use this photo" }).click();
  await expect(page.getByAltText("Selected soil photo preview")).toBeVisible();
  await expect(page.getByText("Captured photo")).toBeVisible();
});

test("camera permission denied shows a fallback", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await page.goto("/analyze");
  await page.getByRole("button", { name: /Take a Picture/ }).click();
  await expect(page.locator(".alert-error")).toContainText(/permission was denied/i);
  await expect(page.getByRole("button", { name: "Use device camera app" })).toBeVisible();
});

test("pages render without horizontal overflow", async ({ page, isMobile }) => {
  for (const path of ["/", "/analyze", "/history", "/about", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
  if (isMobile) {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Not configured").or(page.getByText("Available"))).toBeVisible();
  }
});

test("results page has no horizontal overflow", async ({ page }) => {
  await uploadAndAnalyze(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
