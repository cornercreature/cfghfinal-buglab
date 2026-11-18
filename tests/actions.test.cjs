const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCheck } = require("./browser.cjs");
const fs = require("node:fs");
test("actions", () =>
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

    const base = await page.evaluate(() => structuredClone(data.points));
    const field = async (id, val) => {
      await page.fill("#" + id, "" + val);
      await page.press("#" + id, "Tab");
    };
    const seek = async (val) => {
      await page.locator("#actionTime").fill("" + val);
    };
    await page.click("#lock");
    await page.click("[data-tab=actions]");
    for (const [i, id] of ["nudge", "soft", "hard", "dead", "eat"].entries()) {
      await page.selectOption("#actionId", id);
      await page.selectOption("#actionPart", "whole");
      await seek(500);
      await field("poseX", 20 + i * 5);
      await field("poseAngle", 10);
      await field("poseSize", 85);
      await seek(250);
      assert.equal(
        Number(await page.locator("#poseX").inputValue()),
        (20 + i * 5) / 2,
      );
      await page.click("#actionPlay");
      await page.waitForFunction(() => editor.at > 300);
      await page.click("#actionPlay");
      await page.locator('[data-at="500"]').click();
      assert.equal(await page.locator("#poseAngle").inputValue(), "10");
    }
    await page.selectOption("#actionId", "nudge");
    await seek(500);
    await page.selectOption("#actionPart", "body");
    await field("poseY", 22);
    await page.click("#deleteKey");
    assert.equal(await page.locator("#poseY").inputValue(), "0");
    const coords = await page.evaluate(() => {
      const m = partTransform("body"),
        r = canvas.getBoundingClientRect(),
        g = geometry();
      return [r.left + g.x + m.e * g.fit, r.top + g.y + m.f * g.fit];
    });
    await page.mouse.move(...coords);
    await page.mouse.down();
    await page.mouse.move(coords[0] + 23, coords[1] + 11, { steps: 3 });
    await page.mouse.up();
    assert(
      await page.evaluate(() => Math.abs(data.actions.nudge.body[0].x) > 1),
    );
    assert.deepEqual(await page.evaluate(() => data.points), base);
    const bytes = await download(page, "Action study"),
      out = JSON.parse(bytes);
    assert.equal(Object.keys(out.settings.actions).length, 5);
    await page.click("[data-tab=eyes]");
    for (const id of ["nudge", "soft", "hard", "dead", "eat"]) {
      await page.click("[data-eye=" + id + "]");
      await page.waitForFunction(
        (id) => expr === id && exprTime > 0.05 && partTransform("body").e > 0,
        id,
      );
    }
    await page.click("#walk");
    await page.click("[data-eye=nudge]");
    await page.waitForFunction(() => t > 0.2 && walkEvents.length > 0);
    await page.click("#play");
    assert.equal(await page.evaluate(() => walkActionAt(t).action), "nudge");
    const other = await browser.newPage();
    other.on("pageerror", (e) => errors.push(String(e)));
    await other.goto(page.url());
    await other.waitForSelector("#openSprite:enabled");
    async function open(file) {
      await other.setInputFiles("#spriteFile", {
        name: "study.spider",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(JSON.stringify(file)),
      });
      await other.waitForFunction(
        (n) => document.getElementById("save").textContent === "Opened " + n,
        file.name,
      );
    }
    await open(out);
    await other.reload();
    await other.waitForSelector("#openSprite:enabled");
    assert.deepEqual(
      await other.evaluate(() => data.actions),
      out.settings.actions,
    );
    const legacy = structuredClone(out);
    delete legacy.settings.actions;
    legacy.name = "Old study";
    await open(legacy);
    assert.deepEqual(await other.evaluate(() => data.actions), {});
    assert.deepEqual(errors, []);
    console.log(
      "Verified five action triggers, interpolation, edit/delete, locked canvas drag, walk preview, unchanged assembly, download/open/reload, and legacy sprites.",
    );
  }));
