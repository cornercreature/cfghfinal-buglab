const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCheck } = require("./browser.cjs");
test("assembly", () =>
  runCheck(async (browser, url) => {
    const page = await browser.newPage({
      viewport: { width: 1350, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForSelector('[data-part="body"]');
    assert(await page.locator("#walk").isDisabled());
    assert.equal(await page.locator(".part").count(), 5);
    const p = await page.evaluate(() => {
      const b = canvas.getBoundingClientRect(),
        g = geometry();
      return [b.left + g.x, b.top + g.y + 10 * g.fit];
    });
    await page.mouse.move(...p);
    await page.mouse.down();
    await page.mouse.move(p[0] + 14, p[1] + 8);
    await page.mouse.up();
    assert(await page.evaluate(() => data.points.body[0] > 5));
    await page.click("#rectangle");
    await page.fill("#width", "190");
    await page.press("#width", "Tab");
    assert.equal(await page.evaluate(() => data.w), 190);
    assert(
      await page.evaluate(
        () => data.points.right[0] > defaults.points.right[0],
      ),
    );
    await page.click("[data-tab=eyes]");
    for (const e of ["eat", "soft", "hard", "dead", "nudge"]) {
      await page.click("[data-eye=" + e + "]");
      assert.equal(await page.evaluate(() => expr), e);
    }
    await page.waitForFunction(() => expr === "default");
    await page.click("[data-tab=timing]");
    await page.fill("#speed", "2");
    await page.press("#speed", "Tab");
    assert.equal(await page.evaluate(() => data.timers.right.speed), 2);
    await page.click("#lock");
    await page.click("#animate");
    await page.waitForFunction(() => t > 0.1);
    await page.click("#play");
    assert.equal(await page.evaluate(() => playing), false);
    await page.click("#walk");
    await page.locator("#timeline").fill("2.5");
    await page.check("#ghost");
    assert.equal(await page.evaluate(() => t), 2.5);
    await page.reload();
    await page.waitForSelector(".part");
    assert(
      await page.evaluate(() => data.locked && data.shape === "rectangle"),
    );
    await page.click("#lock");
    assert(await page.locator("#walk").isDisabled());
    assert.deepEqual(errors, []);
    console.log(
      "Passed artwork load, drag, resize anchors, expression triggers and timeout, linked timing, confirm, animate, scrubbed walk, reload.",
    );
  }));
