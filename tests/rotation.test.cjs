const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCheck } = require("./browser.cjs");
test("rotation", () =>
  runCheck(async (browser, url) => {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 840 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url);
    await page.waitForSelector("[data-part=left]");
    await page.evaluate(() => {
      const old = structuredClone(data);
      delete old.angles;
      old.points.head[0] = 7;
      localStorage.setItem("spider-studio-v1", JSON.stringify(old));
    });
    await page.reload();
    await page.click("[data-part=left]");
    assert.deepEqual(
      await page.evaluate(() => [
        data.angles.left,
        data.angles.right,
        data.points.head[0],
      ]),
      [0, 0, 7],
    );
    const scene = () =>
      page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = c.height = 512;
        const cx = c.getContext("2d");
        cx.translate(256, 256);
        spider(cx, 0);
        return c.toDataURL();
      });
    const original = await scene();
    await page.fill("#angle", "35");
    await page.press("#angle", "Tab");
    assert.equal(await page.evaluate(() => data.angles.left), 35);
    assert.notEqual(await scene(), original);
    await page.click("[data-part=right]");
    await page.fill("#angle", "-25");
    await page.press("#angle", "Tab");
    const points = await page.evaluate(() => {
      const g = geometry(),
        r = canvas.getBoundingClientRect(),
        m = partTransform("right");
      const pivot = m.transformPoint({ x: legPivot("right"), y: 0 }),
        hand = m.transformPoint({ x: handleOffset("right"), y: 0 });
      const screen = (x, y) => [
        r.left + g.x + x * g.fit,
        r.top + g.y + y * g.fit,
      ];
      return [
        screen(hand.x, hand.y),
        screen(pivot.x + hand.y - pivot.y, pivot.y - hand.x + pivot.x),
      ];
    });
    await page.mouse.move(...points[0]);
    await page.mouse.down();
    await page.mouse.move(...points[1], { steps: 12 });
    await page.mouse.up();
    assert.ok(
      Math.abs((await page.evaluate(() => data.angles.right)) + 115) < 2,
    );
    const hit = await page.evaluate(() => {
      const m = partTransform("right");
      for (let y = -130; y <= 130; y += 2) {
        for (let x = -95; x < 100; x += 2) {
          const p = m.transformPoint({ x, y });
          if (partAt(p.x, p.y) === "right") return true;
        }
      }
      return false;
    });
    assert(hit);
    await page.click("#lock");
    assert(await page.locator("#angle").isDisabled());
    await page.click("#animate");
    await page.click("#walk");
    await page.waitForFunction(() => t > 0.15);
    await page.reload();
    await page.click("[data-part=left]");
    assert.equal(await page.locator("#angle").inputValue(), "35");
    assert(await page.locator("#angle").isDisabled());
    assert.deepEqual(errors, []);
    console.log(
      "Passed migration, independent numeric edits, on-canvas rotation, rotated picking, placement lock, previews, and reload.",
    );
  }));
