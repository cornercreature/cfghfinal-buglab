const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCheck } = require("./browser.cjs");
const fs = require("node:fs");
test("sprite-save", () =>
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
    const plain = JSON.parse(await download(page, "Original"));
    assert.equal(Object.keys(plain.artwork).length, 13);
    await page.click("#rectangle");
    await page.click("[data-part=right]");
    await page.fill("#angle", "41");
    await page.press("#angle", "Tab");
    await page.click("[data-tab=timing]");
    await page.selectOption("#clip", "right");
    await page.setInputFiles(
      "#importClip",
      require("node:path").resolve(__dirname, "../artwork/legs/legsr.gif"),
    );
    await page.waitForFunction(() =>
      document.querySelector("#importNote")?.textContent.includes("loaded."),
    );
    await page.fill("#speed", "1.4");
    await page.press("#speed", "Tab");
    await page.click("#lock");
    const bytes = await download(page, "Bend study");
    const expected = JSON.parse(bytes);
    assert.equal(expected.settings.angles.right, 41);
    assert.equal(expected.settings.timers.right.speed, 1.4);
    assert.equal(expected.settings.locked, true);
    assert.notEqual(expected.artwork.right, plain.artwork.right);
    const other = await browser.newPage();
    other.on("pageerror", (e) => errors.push(String(e)));
    await other.goto(page.url());
    await other.waitForSelector("#openSprite:enabled");
    const open = async (contents) =>
      other.setInputFiles("#spriteFile", {
        name: "Study.spider",
        mimeType: "application/octet-stream",
        buffer: contents,
      });
    await open(bytes);
    await other.waitForFunction(
      () => document.querySelector("#save").textContent === "Opened Bend study",
    );
    await other.reload();
    await other.waitForSelector("#saveSprite:enabled");
    await other.click("#walk");
    await other.waitForFunction(() => t > 0.1);
    const reopened = JSON.parse(await download(other, "Bend study"));
    assert.deepEqual(reopened, expected);
    await open(Buffer.from('{"version":1}'));
    await other.waitForFunction(() =>
      document.querySelector("#save").textContent.includes("Could not open"),
    );
    assert.equal(await other.evaluate(() => data.spriteName), "Bend study");
    assert.deepEqual(errors, []);
    console.log(
      "Verified named downloads, all 13 artwork assets, custom GIF, settings, fresh-browser open, reload, walk preview, and identical re-export. Invalid files preserve the current sprite.",
    );
  }));
