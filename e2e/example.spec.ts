import { expect, test } from "@playwright/test";

// サンプルテスト - このテストは消す前提のものです
test("サンプルページの表示確認", async ({ page }) => {
  // アプリケーションのトップページに移動
  await page.goto("/");

  // bodyタグが存在することを確認（基本的なページレンダリングテスト）
  await expect(page.locator("body")).toBeVisible();

  // ページ全体のスクリーンショットを撮影
  await page.screenshot({ path: "test-results/home-page.png", fullPage: true });
});
