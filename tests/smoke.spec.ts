import { expect, test } from "@playwright/test";

test("renders host workflow and connect action", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Browser-first control room for Pixels dice.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Pixel" }),
  ).toBeVisible();
  await expect(page.getByText("Host Workflow")).toBeVisible();
});
