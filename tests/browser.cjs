const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../dist");
const types = {
  ".js": "application/javascript",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".css": "text/css",
};
async function runCheck(check) {
  const server = http.createServer((req, res) => {
    const filename = path.join(
      root,
      req.url === "/" ? "index.html" : req.url.split("?")[0],
    );
    if (!filename.startsWith(root + "/") || !fs.existsSync(filename)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(filename)] });
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROME_BIN,
    });
    await check(browser, "http://127.0.0.1:" + server.address().port);
  } finally {
    try {
      await browser?.close();
    } finally {
      server.close();
    }
  }
}
module.exports = { runCheck };
