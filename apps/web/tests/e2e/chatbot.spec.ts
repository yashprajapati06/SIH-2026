import { test, expect } from "@playwright/test";

test("answers from the real API with citations and correct state totals", async ({ page }) => {
  await page.goto("/chatbot");
  await expect(page.getByRole("heading", { name: "Ask about landslides." })).toBeVisible();
  const cookieButton = page.getByRole("button", { name: "Essential Only" });
  if (await cookieButton.isVisible()) await cookieButton.click();
  await expect(page.getByText("11,022", { exact: true })).toBeAttached();
  await page.getByRole("button", { name: "How many landslide records are in Assam?" }).click();
  await expect(page.getByText(/I found 857 matching historical inventory rows for Assam/)).toBeVisible();
  await page.getByText("Sources & matching records (6)", { exact: true }).click();
  await expect(page.getByRole("link", { name: /GSI Northeast historical snapshot/ })).toBeVisible();
  await page.getByText("Sources & matching records (6)", { exact: true }).click();
  await page.getByLabel("Your landslide question").fill("Assam mein kitne landslides hain?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText(/Assam: 857 matching historical inventory rows mile/)).toBeVisible();
  await page.screenshot({ path: `../../test-results/chatbot-${test.info().project.name.replace(/ /g, "-").toLowerCase()}.png`, fullPage: true });
  await page.getByRole("button", { name: "Clear chat" }).click();
  await expect(page.getByText("Start with a place or a question.")).toBeVisible();
});

test("unknown places and live forecasts are not represented as verified facts", async ({ page }) => {
  await page.goto("/chatbot");
  await page.getByLabel("Your landslide question").fill("Show landslides in Atlantis");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("No matching evidence", { exact: true })).toBeVisible();
  await page.getByLabel("Your landslide question").fill("Will a landslide happen in Assam tomorrow?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText(/I cannot confirm current conditions or predict a landslide here/)).toBeVisible();
  await page.getByText("Sources & matching records (2)", { exact: true }).click();
  await expect(page.getByRole("link", { name: /Official SACHET alerts/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
