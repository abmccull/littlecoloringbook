import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("home page renders hero + primary CTA", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/colorbook|coloring/i);
    await expect(page.getByRole("link", { name: /try it|try a free|get started|start/i }).first()).toBeVisible();
  });

  test("sample builder loads without server error", async ({ page }) => {
    const response = await page.goto("/sample");
    expect(response?.ok()).toBe(true);
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
  });

  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
  });

  test("refunds page renders", async ({ page }) => {
    const response = await page.goto("/refunds");
    expect(response?.ok()).toBe(true);
    await expect(page.locator("body")).toContainText(/refund|guarantee/i);
  });
});

test.describe("auth flow", () => {
  test("sign-in page renders email input", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("textbox", { name: /email/i }).first()).toBeVisible();
  });
});
