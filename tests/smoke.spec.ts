import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 3_000 });

test("renders V1 controls and target input", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Run WFRP tests with connected Pixels dice.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Die" })).toBeVisible();
  await expect(page.locator('[data-action="target"]')).toHaveValue("50");
  await expect(
    page.getByRole("button", { name: "Attack Helper" }),
  ).toBeVisible();
  await expect(page.getByText("V1 Flow")).toBeVisible();
});

test("keeps focus while typing multi-digit values", async ({ page }) => {
  await page.goto("/");

  const target = page.locator('[data-action="target"]');
  await target.click();
  await target.press("ControlOrMeta+A");
  await target.pressSequentially("54");
  await expect(target).toHaveValue("54");

  await page.getByRole("button", { name: "Attack Helper" }).click();

  const damageBonus = page.locator('[data-action="damage-bonus"]');
  await damageBonus.click();
  await damageBonus.press("ControlOrMeta+A");
  await damageBonus.pressSequentially("12");
  await expect(damageBonus).toHaveValue("12");
});

test("keeps empty and invalid input visible with error styling", async ({
  page,
}) => {
  await page.goto("/");

  const target = page.locator('[data-action="target"]');
  await target.fill("");
  await expect(target).toHaveValue("");
  await expect(target).toHaveAttribute("aria-invalid", "true");

  await page.goto("/");

  await page.getByRole("button", { name: "Attack Helper" }).click();

  const damageBonus = page.locator('[data-action="damage-bonus"]');
  await damageBonus.fill("-");
  await expect(damageBonus).toHaveValue("-");
  await expect(damageBonus).toHaveAttribute("aria-invalid", "true");

  await page.locator('[data-action="opposed"]').check();

  const opponentSl = page.locator('[data-action="defender-success-levels"]');
  await opponentSl.fill("abc");
  await expect(opponentSl).toHaveValue("abc");
  await expect(opponentSl).toHaveAttribute("aria-invalid", "true");
});

test("allows negative opponent SL", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Attack Helper" }).click();
  await page.locator('[data-action="opposed"]').check();

  const opponentSl = page.locator('[data-action="defender-success-levels"]');
  await opponentSl.fill("-2");
  await expect(opponentSl).toHaveValue("-2");
  await expect(opponentSl).toHaveAttribute("aria-invalid", "false");
});
