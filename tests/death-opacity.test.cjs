const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCheck } = require("./browser.cjs");
const fs = require("node:fs");
test("death-opacity", () =>
  runCheck(async (browser, url) => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 840 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url);
    await page.waitForSelector("[data-part=left]");

    async function download(p, name) {
      await p.click("#saveSprite");
      await p.fill("#spriteName", name);
      const [file] = await Promise.all([
        p.waitForEvent("download", { timeout: 8000 }),
        p.getByRole("button", { name: "Download sprite" }).click(),
      ]);
      assert.equal(file.suggestedFilename(), name + ".spider");
      return fs.readFileSync(await file.path());
    }

    await page.click("[data-tab=actions]");
    assert.equal(await page.locator("#poseOpacity").count(), 0);
    await page.selectOption("#actionId", "dead");
    const seek = async (to) => page.locator("#actionTime").fill(String(to));
    const opacity = async (v) => {
      await page.fill("#poseOpacity", String(v));
      await page.press("#poseOpacity", "Tab");
    };
    const pixels = () =>
      page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 600;
        c.height = 600;
        const cx = c.getContext("2d");
        cx.translate(300, 300);
        spider(cx, 0);
        const p = cx.getImageData(0, 0, 600, 600).data;
        let max = 0;
        for (let i = 3; i < p.length; i += 4) max = Math.max(max, p[i]);
        return { center: p[(310 * 600 + 300) * 4 + 3], max };
      });
    await seek(1000);
    await opacity(0);
    assert.deepEqual(await pixels(), { center: 0, max: 0 });
    await seek(500);
    assert.equal(await page.locator("#poseOpacity").inputValue(), "50");
    const half = await pixels();
    assert(half.center >= 127 && half.center <= 128);
    assert.equal(half.max, half.center);
    await page.selectOption("#actionPart", "body");
    await opacity(0);
    const partial = await pixels();
    assert(partial.center === 0 && partial.max === half.max);
    const file = JSON.parse(await download(page, "Death fade"));
    assert.equal(file.settings.actions.dead.whole[0].opacity, 0);
    const other = await browser.newPage();
    await other.goto(page.url());
    await other.waitForSelector("#openSprite:enabled");
    async function open(obj) {
      await other.setInputFiles("#spriteFile", {
        name: "study.spider",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(JSON.stringify(obj)),
      });
      await other.waitForFunction(
        (n) => document.querySelector("#save").textContent === "Opened " + n,
        obj.name,
      );
    }
    await open(file);
    await other.click("[data-tab=actions]");
    await other.selectOption("#actionId", "dead");
    await other.locator("#actionTime").fill("500");
    assert.equal(await other.locator("#poseOpacity").inputValue(), "50");
    await other.click("[data-tab=eyes]");
    await other.click("[data-eye=dead]");
    await other.waitForFunction(
      () => expr === "dead" && deathOpacity(liveAction(), "whole") < 0.9,
    );
    const legacy = structuredClone(file);
    legacy.name = "Legacy";
    delete legacy.settings.actions.dead.whole[0].opacity;
    await open(legacy);
    assert.equal(
      await other.evaluate(() => data.actions.dead.whole[0].opacity),
      100,
    );
    assert.deepEqual(errors, []);
    console.log(
      "Verified death-only input, whole-sprite and independent body alpha, half-opacity pixels, invisible endpoint, playback, file round trip, and legacy keys.",
    );
  }));
