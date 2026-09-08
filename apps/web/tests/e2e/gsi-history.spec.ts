import { test, expect } from "@playwright/test";

test("GSI history maps every usable point and filters without mixing flagged records", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/map");
  const cookie = page.getByRole("button", { name:"Essential Only" });
  if (await cookie.isVisible()) await cookie.click({position:{x:8,y:10}});
  const panel = page.getByRole("region", { name:"GSI historical inventory" });
  const mapStatus = page.getByTestId("gsi-map-status");
  await expect(panel.getByText("11,022 records", {exact:true})).toBeVisible();
  await expect(mapStatus).toHaveAttribute("data-marker-count", "11020");
  if (await cookie.isVisible()) await cookie.click({position:{x:8,y:10}});
  await expect(page.locator(".leaflet-gsiHistory-pane canvas")).toBeAttached();
  await page.getByLabel("Toggle GSI History layer").uncheck();
  await expect(mapStatus).toHaveCount(0);
  await page.getByLabel("Toggle GSI History layer").check();
  await expect(mapStatus).toHaveAttribute("data-marker-count", "11020");
  for (const [state, count] of [["Arunachal Pradesh",1220],["Assam",856],["Manipur",1631],["Meghalaya",1051],["Mizoram",3486],["Nagaland",1902],["Sikkim",777],["Tripura",97]] as const) {
    await page.getByLabel("GSI state", {exact:true}).selectOption(state);
    await expect(mapStatus).toHaveAttribute("data-marker-count", String(count));
  }
  await page.getByLabel("GSI state", {exact:true}).selectOption("Assam");
  await expect(mapStatus).toHaveAttribute("data-marker-count", "856");
  await page.getByLabel("GSI historical district", {exact:true}).selectOption("Hailakandi");
  await page.getByRole("button", {name:"Browse mapped records"}).click();
  await page.getByRole("button", {name:"View GSI record 1", exact:true}).click();
  const drawer = page.getByRole("complementary", {name:"GSI historical record details"});
  await expect(drawer.getByRole("heading", {name:"Kukinala slide"})).toBeVisible();
  await expect(drawer.getByText("Not recorded in the source", {exact:true})).toBeVisible();
  await page.getByRole("button", {name:"Close GSI record"}).click();
  await page.getByLabel("GSI state", {exact:true}).selectOption("");
  await expect(mapStatus).toHaveAttribute("data-marker-count", "11020");
  await page.getByRole("button", {name:"2 flagged coordinates",exact:true}).click();
  await expect(panel.getByRole("heading", {name:"Flagged records · excluded from the map"})).toBeVisible();
  await expect(panel.getByRole("button", {name:/View GSI record/})).toHaveCount(2);
  await page.getByRole("button", {name:"View GSI record 22139", exact:true}).click();
  await expect(drawer.getByText("-23.736217", {exact:true})).toBeVisible();
  await expect(drawer.getByRole("note")).toContainText("not plotted");
  await expect(mapStatus).toHaveAttribute("data-marker-count", "11020");
  await page.screenshot({path:`../../test-results/gsi-history-${test.info().project.name}.png`, fullPage:true, animations:"disabled"});
  expect(errors).toEqual([]);
});

test("historical service failure offers retry without showing stale markers", async ({page}) => {
  let failed = true;
  await page.route("**/api/v1/gsi-history?*", route => failed ? route.fulfill({status:503, contentType:"application/json", body:JSON.stringify({error:{message:"Historical source unavailable"}})}) : route.continue());
  await page.goto("/map");
  await expect(page.getByRole("alert").filter({hasText:"Historical source unavailable"})).toBeVisible();
  await expect(page.getByTestId("gsi-map-status")).toHaveAttribute("data-marker-count", "0");
  failed = false;
  await page.getByRole("button", {name:"Retry GSI data"}).click();
  await expect(page.getByTestId("gsi-map-status")).toHaveAttribute("data-marker-count", "11020");
});
