const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCheck } = require("./browser.cjs");
test("trail-edge", () =>
  runCheck(async (browser, url) => {
    for (const dpr of [1, 2]) {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 840 },
        deviceScaleFactor: dpr,
      });
      await page.goto(url);
      await page.waitForSelector("[data-part=body]");
      await page.click("#lock");
      for (const shape of ["ellipse", "rectangle"]) {
        await page.click("#" + shape);
        await page.click("#walk");
        const result = await page.evaluate(() => {
          playing = false;
          const snapshot = () =>
            ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          function compare(time) {
            t = time;
            draw();
            const actual = snapshot();
            const stroke = ctx.stroke;
            ctx.stroke = function (...args) {
              if (this.globalCompositeOperation !== "destination-out")
                return stroke.apply(this, args);
            };
            try {
              draw();
            } finally {
              delete ctx.stroke;
            }
            const baseline = snapshot();
            let disappeared = 0,
              added = 0;
            for (let i = 3; i < actual.length; i += 4) {
              if (actual[i] + 80 < baseline[i]) disappeared++;
              if (actual[i] > baseline[i] + 5) added++;
            }
            draw();
            return { disappeared, added };
          }
          const start = compare(0),
            bend = compare(2),
            end = compare(4);
          const g = geometry(),
            p = walkPose(4, g),
            scale = walkScale(g);
          const rear = p.x - (data.points.body[1] + data.h / 2) * scale;
          const s = snapshot(),
            d = window.devicePixelRatio;
          const alpha = (offset) =>
            s[
              (Math.floor(p.y * d) * canvas.width +
                Math.floor((rear - offset) * d)) *
                4 +
                3
            ];
          const samples = [alpha(-2), alpha(1), alpha(4)];
          mode = "animate";
          const inPlace = compare(2);
          mode = "";
          const assembly = compare(0);
          return { start, bend, end, inPlace, assembly, samples };
        });
        assert.equal(
          result.start.disappeared +
            result.inPlace.disappeared +
            result.assembly.disappeared,
          0,
        );
        for (const sample of [result.bend, result.end]) {
          assert(sample.disappeared > 15);
          assert.equal(sample.added, 0);
        }
        const [body, gap, trail] = result.samples;
        assert(body > 245 && gap < 80 && trail > 245, JSON.stringify(result));
        console.log(shape, dpr + "x", JSON.stringify(result.samples));
      }
      await page.close();
    }
  }));
