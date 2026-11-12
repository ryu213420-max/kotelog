import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const uid = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function login(page: Page, name = uid()) {
  await page.goto(`/auth/dev-login?name=${encodeURIComponent(name)}`);
  return name;
}

async function registerDog(page: Page, name = "こてつ", breed = "ミニチュアダックスフンド") {
  await expect(page.getByRole("heading", { name: "わんこを登録" })).toBeVisible();
  await page.getByTestId("dog-name-input").fill(name);
  await page.getByTestId("dog-breed-input").fill(breed);
    await page.getByTestId("dog-birthday-input").fill("2023-06-23");
  await page.getByTestId("dog-save").click();
  await expect(page.getByTestId("dog-name")).toHaveText(name);
}

const pngBuffer = () => readFileSync(new URL("./fixtures/dog.png", import.meta.url));

test.describe("認証", () => {
  test("未ログインはログイン画面へ。Google ボタンのみでキャッチコピーなし", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    const btn = page.getByRole("link", { name: "Google でログイン" });
    await expect(btn).toHaveAttribute("href", "/auth/google");
    const text = (await page.locator("main").innerText()).replace(/\s+/g, "");
    expect(text).toBe("わんログGoogleでログイン");
  });

  test("API は未ログインで 401", async ({ request }) => {
    const r = await request.get("/api/dogs");
    expect(r.status()).toBe(401);
  });

  test("ログアウトでログイン画面に戻る", async ({ page }) => {
    await login(page);
    await registerDog(page);
    await page.getByRole("link", { name: "設定" }).click();
    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });
});

test.describe("スケルトン", () => {
  test("読み込み中は全画面スケルトンを表示", async ({ page }) => {
    await login(page);
    await registerDog(page);
    await page.route("**/api/me", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto("/stats");
    const sk = page.getByTestId("skeleton");
    await expect(sk).toBeVisible();
    const box = await sk.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.height).toBeGreaterThanOrEqual(vp.height - 1);
    await expect(page.getByRole("heading", { name: "グラフ" })).toBeVisible();
    await expect(sk).toHaveCount(0);
  });
});

test.describe("記録", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await registerDog(page);
  });

  test("散歩を記録すると今日の散歩とタイムラインに反映", async ({ page }) => {
    await page.getByTestId("quick-walk").click();
    const vh = page.viewportSize()!.height;
    await expect.poll(async () => { const b = (await page.getByRole("dialog").boundingBox())!; return b.y >= 0 && b.y + b.height <= vh + 1; }).toBe(true);
    await page.getByTestId("value-input").fill("30");
    await page.getByTestId("save-record").click();
    await expect(page.getByRole("status").filter({ hasText: "散歩を記録しました" })).toBeVisible();
    await expect(page.getByTestId("today-walk")).toContainText("30");
    await expect(page.getByTestId("record-item").first()).toContainText("散歩・30分");
  });

  test("ごはんをステッパーと区分で記録", async ({ page }) => {
    await page.getByTestId("add-button").click();
    await page.getByRole("radio", { name: "ごはん" }).click();
    for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "増やす" }).click();
    await expect(page.getByTestId("value-input")).toHaveValue("80");
    await page.getByRole("button", { name: "夜" }).click();
    await page.getByTestId("save-record").click();
    await expect(page.getByTestId("today-meal")).toContainText("1");
    await expect(page.getByTestId("record-item").first()).toContainText("ごはん・夜 80g");
  });

  test("AI クイック入力で自然文から記録を作成", async ({ page }) => {
    await page.getByTestId("add-button").click();
    await page.getByTestId("ai-input").fill("朝ごはん 80g食べた");
    await page.getByTestId("ai-submit").click();
    await expect(page.getByRole("radio", { name: "ごはん" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("value-input")).toHaveValue("80");
    await expect(page.getByRole("button", { name: "朝" })).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("save-record").click();
    await expect(page.getByTestId("record-item").first()).toContainText("ごはん・朝 80g");
  });

  test("トイレ・健康・日記も記録できる", async ({ page }) => {
    for (const [type, tag, note] of [
      ["toilet", "うんち", null],
      ["health", "通院", "ワクチン接種"],
      ["diary", null, "公園で走り回った"],
    ] as const) {
      await page.getByTestId(`quick-${type}`).click();
      if (tag) await page.getByRole("button", { name: tag, exact: true }).click();
      if (note) await page.getByTestId("note-input").fill(note);
      await page.getByTestId("save-record").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await expect(page.getByTestId("record-item")).toHaveCount(3);
    await expect(page.getByTestId("today-toilet")).toContainText("1");
    await expect(page.getByText("公園で走り回った")).toBeVisible();
  });

  test("体重未入力では保存できない", async ({ page }) => {
    await page.getByTestId("quick-weight").click();
    await page.getByTestId("save-record").click();
    await expect(page.getByRole("status").filter({ hasText: "体重を入力してください" })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("記録を削除できる", async ({ page }) => {
    await page.getByTestId("quick-diary").click();
    await page.getByTestId("note-input").fill("消す記録");
    await page.getByTestId("save-record").click();
    const item = page.getByTestId("record-item").filter({ hasText: "消す記録" });
    await item.click();
    await item.getByRole("button", { name: "削除" }).click();
    await expect(item).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("dog-name")).toBeVisible();
    await expect(page.getByText("消す記録")).toHaveCount(0);
  });

  test("写真を記録し、AI で文章化してアルバムに表示", async ({ page }) => {
    await page.getByTestId("add-button").click();
    await page.getByRole("radio", { name: "日記" }).click();
    await page.getByTestId("photo-input").setInputFiles({ name: "dog.png", mimeType: "image/png", buffer: pngBuffer() });
    const cap = page.getByTestId("ai-caption");
    await expect(cap).toBeEnabled();
    await cap.click();
    await expect(page.getByTestId("note-input")).toHaveValue(/こてつ/);
    await page.getByTestId("save-record").click();
    await expect(page.getByTestId("record-item").first().locator("img")).toBeVisible();

    await page.getByRole("link", { name: "アルバム" }).click();
    const grid = page.getByTestId("album-grid");
    await expect(grid.locator("img")).toHaveCount(1);
    await grid.locator("button").first().click();
    await expect(page.getByRole("dialog", { name: "写真" })).toContainText("こてつ");
  });
});

test.describe("グラフと AI", () => {
  test("体重グラフ・散歩グラフ・AI まとめ", async ({ page }) => {
    await login(page);
    await registerDog(page);
    const dogs = await (await page.request.get("/api/dogs")).json();
    const id = dogs[0].id;
    const now = Date.now();
    for (const [d, v] of [[3, 4.1], [2, 4.2], [1, 4.4]] as const) {
      await page.request.post(`/api/dogs/${id}/records`, {
        data: { type: "weight", value: v, at: new Date(now - d * 86400_000).toISOString() },
        headers: { origin: "http://localhost:5173" },
      });
    }
    await page.request.post(`/api/dogs/${id}/records`, { data: { type: "walk", value: 45 }, headers: { origin: "http://localhost:5173" } });

    await page.reload();
    await expect(page.getByTestId("dog-name")).toBeVisible();
    await page.getByRole("link", { name: "グラフ" }).click();
    const wc = page.getByTestId("weight-card");
    await expect(wc).toContainText("4.4");
    await expect(wc).toContainText("+0.3kg");
    await expect(wc.locator("circle")).toHaveCount(3);
    await expect(page.getByTestId("walk-card")).toContainText("合計 45分");

    await page.getByTestId("ai-summary").click();
    await expect(page.getByTestId("ai-summary-text").locator("li")).toHaveCount(3);
  });
});

test.describe("わんこ管理", () => {
  test("複数登録・切替・編集・削除", async ({ page }) => {
    await login(page);
    await registerDog(page, "こてつ");
    await page.getByRole("link", { name: "わんこを追加" }).first().click();
    await registerDog(page, "モカ", "柴犬");
    await page.getByRole("button", { name: "こてつに切り替え" }).click();
    await expect(page.getByTestId("dog-name")).toHaveText("こてつ");

    await page.getByRole("link", { name: "設定" }).click();
    await expect(page.getByTestId("dog-row")).toHaveCount(2);
    await page.getByTestId("dog-row").filter({ hasText: "モカ" }).click();
    await page.getByTestId("dog-name-input").fill("モカちゃん");
    await page.getByTestId("dog-save").click();
    await expect(page.getByTestId("dog-name")).toHaveText("モカちゃん");

    await page.getByRole("link", { name: "設定" }).click();
    await page.getByTestId("dog-row").filter({ hasText: "モカちゃん" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("dog-delete").click();
    await expect(page.getByTestId("dog-row")).toHaveCount(1);
  });
});

test.describe("セキュリティ", () => {
  test("他人のわんこ・写真にはアクセスできない", async ({ browser }) => {
    const a = await browser.newContext();
    const pa = await a.newPage();
    await login(pa);
    await registerDog(pa);
    const dogId = (await (await pa.request.get("/api/dogs")).json())[0].id;
    const up = await pa.request.post("/api/photos", { data: pngBuffer(), headers: { "content-type": "image/png", origin: "http://localhost:5173" } });
    const { key } = await up.json();

    const b = await browser.newContext();
    const pb = await b.newPage();
    await login(pb);
    expect((await pb.request.get(`/api/dogs/${dogId}/records`)).status()).toBe(404);
    expect((await pb.request.get(`/api/photos/${key}`)).status()).toBe(403);
    expect(
      (await pb.request.post(`/api/dogs/${dogId}/records`, { data: { type: "walk" }, headers: { origin: "http://localhost:5173" } })).status(),
    ).toBe(404);
    await a.close();
    await b.close();
  });

  test("別オリジンからの書き込みは拒否", async ({ page }) => {
    await login(page);
    const r = await page.request.post("/api/dogs", { data: { name: "x" }, headers: { origin: "https://evil.example" } });
    expect(r.status()).toBe(403);
  });
});

test.describe("モバイル表示", () => {
  test("横スクロールが発生しない", async ({ page }) => {
    await login(page);
    await registerDog(page);
    for (const path of ["/", "/stats", "/album", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("プロフィール", () => {
  test("こてつの犬種と年齢が表示される", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-12T12:00:00+09:00"));
    await login(page);
    await registerDog(page);
    await expect(page.getByText("ミニチュアダックスフンド・3歳4ヶ月")).toBeVisible();
  });
});

test.describe("ちっちゃいこてつエージェント", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await registerDog(page);
  });

  test("ホームに常駐してひとこと話す", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-12T12:00:00+09:00"));
    await page.reload();
    await expect(page.getByTestId("agent")).toBeVisible();
    await expect(page.getByTestId("agent-bubble")).toHaveText("おさんぽ行きたいワン");
  });

  test("話しかけると返事をする", async ({ page }) => {
    await page.getByTestId("agent").click();
    await expect(page.getByRole("dialog", { name: "こてつと話す" })).toBeVisible();
    await page.getByTestId("agent-input").fill("こんにちは");
    await page.getByTestId("agent-send").click();
    await expect(page.getByTestId("agent-reply")).toContainText("こてつ");
    await expect(page.getByTestId("agent-recorded")).toHaveCount(0);
  });

  test("報告するとエージェントが記録してくれる", async ({ page }) => {
    await page.getByTestId("agent").click();
    await page.getByRole("button", { name: "散歩30分行ったよ" }).click();
    await expect(page.getByTestId("agent-recorded")).toContainText("散歩・30分");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("today-walk")).toContainText("30");
    await expect(page.getByTestId("record-item").first()).toContainText("散歩・30分");
  });

  test("記録すると喜ぶ", async ({ page }) => {
    await page.getByTestId("quick-toilet").click();
    await page.getByRole("button", { name: "おしっこ" }).click();
    await page.getByTestId("save-record").click();
    await expect(page.getByTestId("agent-bubble")).toHaveText("うれしいワン！");
  });
});
