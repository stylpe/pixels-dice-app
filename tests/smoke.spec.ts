import { expect, test } from "@playwright/test";

test("renders POC flow and target input", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Roll percentile tests with connected Pixels dice.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Die" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Target" })).toHaveValue(
    "50",
  );
  await expect(page.getByText("POC Flow")).toBeVisible();
});
