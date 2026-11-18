"use strict";
const $ = (id) => document.getElementById(id);
const scene = $("scene"),
  screenCtx = scene.getContext("2d"),
  trail = document.createElement("canvas"),
  ink = trail.getContext("2d");
const state = {
  bugs: [],
  food: [],
  tank: [],
  selected: null,
  hold: null,
  foodMode: false,
  ready: false,
};
const clamp = (v, min, max) => Math.max(min, Math.min(max, v)),
  random = (min, max) => min + Math.random() * (max - min);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
let W = 0,
  H = 0,
  DPR = 1,
  now = 0,
  last = 0,
  timer = 0,
  nextId = 1;
const plateArt = new Image();
plateArt.src = "assets/cb2f3.svg";
function notify(text, ms = 2000) {
  clearTimeout(timer);
  $("message").textContent = text;
  if (ms)
    timer = setTimeout(() => {
      $("message").textContent = "";
    }, ms);
}
function resizeGame() {
  const w = innerWidth,
    h = innerHeight,
    d = Math.min(devicePixelRatio || 1, 2);
  if (w === W && h === H && d === DPR) return;
  const old = document.createElement("canvas");
  old.width = trail.width;
  old.height = trail.height;
  old.getContext("2d").drawImage(trail, 0, 0);
  const was = DPR;
  W = w;
  H = h;
  DPR = d;
  for (const cv of [scene, trail]) {
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
  }
  ink.setTransform(d, 0, 0, d, 0, 0);
  ink.drawImage(old, 0, 0, old.width / was, old.height / was);
  for (const b of state.bugs) {
    b.prev = null;
    contain(b);
  }
  for (const f of state.food) {
    f.x = clamp(f.x, 10, w - 10);
    f.y = clamp(f.y, 10, h - 10);
  }
  document.querySelectorAll(".window:not([hidden])").forEach(fitWindow);
}
function inOval(x, y) {
  return (
    (((x / W) * 1440 - 726.5) / 675.5) ** 2 +
      (((y / H) * 1024 - 512.491) / 476.13) ** 2 <=
    1
  );
}
function randomColor() {
  const h = Math.random() * 6,
    i = Math.floor(h),
    f = h - i,
    v = random(0.68, 0.96),
    s = random(0.45, 0.8),
    p = v * (1 - s),
    q = v * (1 - s * f),
    u = v * (1 - s * (1 - f));
  return (
    "#" +
    [
      [v, u, p],
      [q, v, p],
      [p, v, u],
      [p, q, v],
      [u, p, v],
      [v, p, q],
    ][i]
      .map((n) =>
        Math.round(n * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function specimen(shape = "ellipse", w = 160, h = 160, color = "#080808") {
  return {
    shape,
    w,
    h,
    color,
    action: "default",
    age: 0,
    gait: 0,
    frozenGait: 0,
  };
}
function spawn(x, y, starter = false) {
  if (!inOval(x, y)) return null;
  const v = state.tank[Math.floor(Math.random() * state.tank.length)];
  const b = Object.assign(
    specimen(v?.shape, v?.w, v?.h, v ? randomColor() : data.color),
    {
      id: nextId++,
      x,
      y,
      dir: starter ? -0.97 : random(-Math.PI, Math.PI),
      scale:
        (starter ? 0.7 : random(0.3, 0.76)) *
        clamp(Math.min(W / 1080, H / 735), 0.55, 1.24),
      speed: random(24, 46),
      phase: random(0, 12),
      gait: random(0, 0.3),
      injury: 0,
      scarred: false,
      healAt: Infinity,
      prev: null,
      steerUntil: 0,
      nudgeDir: 0,
    },
  );
  state.bugs.push(b);
  contain(b);
  paintTrail(b);
  return b;
}
// Use the animated silhouette for wall contact, including long rectangular bodies.
const boundsCanvas = document.createElement("canvas");
boundsCanvas.width = boundsCanvas.height = 96;
const boundsCtx = boundsCanvas.getContext("2d", { willReadFrequently: true });
function wallLimits(b, a, scale) {
  const tile = spriteTile(b);
  if (b.boundsKey !== b.tileKey) {
    boundsCtx.clearRect(0, 0, 96, 96);
    boundsCtx.drawImage(tile, 0, 0, 96, 96);
    const pixels = boundsCtx.getImageData(0, 0, 96, 96).data;
    b.outline = [];
    for (let y = 0; y < 96; y++) {
      let first = -1,
        last = -1;
      for (let x = 0; x < 96; x++)
        if (pixels[(y * 96 + x) * 4 + 3] > 2) {
          if (first < 0) first = x;
          last = x;
        }
      if (first >= 0)
        for (const x of [first, last])
          b.outline.push([
            ((x + 0.5) * tileSize) / 96 - center,
            ((y + 0.5) * tileSize) / 96 - center,
          ]);
    }
    b.boundsKey = b.tileKey;
  }
  const cos = Math.cos(a) * scale,
    sin = Math.sin(a) * scale;
  let left = 0,
    right = 0,
    top = 0,
    bottom = 0;
  for (const [x, y] of b.outline) {
    const dx = x * cos - y * sin,
      dy = x * sin + y * cos;
    left = Math.min(left, dx);
    right = Math.max(right, dx);
    top = Math.min(top, dy);
    bottom = Math.max(bottom, dy);
  }
  const margin = 10 + (tileSize / 96) * scale * 0.71;
  return {
    left: Math.min(W / 2, margin - left),
    right: Math.max(W / 2, W - margin - right),
    top: Math.min(H / 2, margin - top),
    bottom: Math.max(H / 2, H - margin - bottom),
  };
}
function contain(b) {
  const wall = wallLimits(b, b.dir + Math.PI / 2, b.scale);
  b.x = clamp(b.x, wall.left, wall.right);
  b.y = clamp(b.y, wall.top, wall.bottom);
}
function pose(b) {
  const p = wholePose(b),
    a = b.dir + Math.PI / 2,
    offsetDir = b.action === "nudge" ? b.nudgeDir : a;
  const x =
    b.x + b.scale * (p.x * Math.cos(offsetDir) - p.y * Math.sin(offsetDir));
  const y =
    b.y + b.scale * (p.x * Math.sin(offsetDir) + p.y * Math.cos(offsetDir));
  const s = (b.scale * p.size) / 100,
    angle = a + (p.angle * Math.PI) / 180,
    wall = wallLimits(b, angle, s);
  return {
    x: clamp(x, wall.left, wall.right),
    y: clamp(y, wall.top, wall.bottom),
    a: angle,
    s,
    alpha: p.opacity / 100,
  };
}
function paintTrail(b) {
  const p = pose(b),
    old = b.prev || p;
  const da = angleDiff(p.a, old.a);
  const count = Math.max(
    1,
    Math.ceil(
      (Math.hypot(p.x - old.x, p.y - old.y) +
        (Math.abs(da) * Math.max(b.w, b.h) * p.s) / 2) /
        1.25,
    ),
  );
  ink.fillStyle = b.color;
  for (let i = 1; i <= count; i++) {
    const f = i / count;
    ink.save();
    ink.translate(old.x + (p.x - old.x) * f, old.y + (p.y - old.y) * f);
    ink.rotate(old.a + da * f);
    const s = old.s + (p.s - old.s) * f;
    ink.scale(s, s);
    bodyPath(ink, b.shape, b.w, b.h);
    ink.fill();
    ink.restore();
  }
  b.prev = p;
}
function act(b, action) {
  if (b.action === "dead") return;
  b.action = action;
  b.age = 0;
  if (action === "dead") b.frozenGait = b.gait;
}
function injure(b) {
  b.scarred = true;
  b.injury++;
  b.healAt = now + 5;
  act(b, ["default", "soft", "hard", "dead"][b.injury]);
  if (b.injury === 3) {
    if (state.selected === b) {
      state.selected = null;
      syncPicker();
    }
    state.hold = null;
    notify("Spider lost.", 1400);
  }
}
function updateHold(time) {
  const h = state.hold;
  if (!h) return;
  const elapsed = (time - h.start) / 1000;
  while (state.hold && elapsed > h.next) {
    h.hits++;
    h.next += 1;
    injure(h.b);
  }
}
function releaseHold(time, cancel = false) {
  const h = state.hold;
  if (!h) return;
  if (!cancel) updateHold(time);
  if (!cancel && !h.hits && h.b.action !== "dead") {
    if (time - h.start <= 400) {
      state.selected = h.b;
      syncPicker();
      notify("Spider selected.", 950);
    } else {
      h.b.nudgeDir = h.dir;
      h.b.dir = h.dir;
      h.b.steerUntil = now + 0.75;
      act(h.b, "nudge");
    }
  }
  state.hold = null;
}
function advance(b, dt) {
  b.age += dt;
  if (b.action === "dead") return;
  if (b.action !== "default" && b.age >= data.holds[b.action]) {
    b.action = "default";
    b.age = 0;
  }
  if (b.injury && now >= b.healAt && state.hold?.b !== b) {
    b.injury--;
    b.healAt = b.injury ? now + 5 : Infinity;
  }
  b.gait += dt;
  let nearest = null,
    min = Infinity;
  for (const f of state.food) {
    const d = Math.hypot(f.x - b.x, f.y - b.y);
    if (d < min) {
      min = d;
      nearest = f;
    }
  }
  let goal = b.dir + Math.sin(now * 1.4 + b.phase) * 0.52;
  const wall = wallLimits(b, b.dir + Math.PI / 2, b.scale);
  if (nearest && b.steerUntil <= now) {
    goal = Math.atan2(nearest.y - b.y, nearest.x - b.x);
    const reachableDistance = Math.hypot(
      clamp(nearest.x, wall.left, wall.right) - b.x,
      clamp(nearest.y, wall.top, wall.bottom) - b.y,
    );
    if (
      reachableDistance < Math.max(12, b.w * b.scale * 0.48) &&
      b.action === "default"
    ) {
      state.food.splice(state.food.indexOf(nearest), 1);
      act(b, "eat");
    }
  }
  if (b.steerUntil > now) goal = b.nudgeDir;
  const reach = nearest ? 10 : Math.min(22, Math.min(W, H) * 0.04);
  let ax = Math.cos(goal),
    ay = Math.sin(goal);
  if (b.x < wall.left + reach)
    ax += 2.4 * clamp((wall.left + reach - b.x) / reach, 0, 1);
  if (b.x > wall.right - reach)
    ax -= 2.4 * clamp((b.x - wall.right + reach) / reach, 0, 1);
  if (b.y < wall.top + reach)
    ay += 2.4 * clamp((wall.top + reach - b.y) / reach, 0, 1);
  if (b.y > wall.bottom - reach)
    ay -= 2.4 * clamp((b.y - wall.bottom + reach) / reach, 0, 1);
  goal = Math.atan2(ay, ax);
  b.dir += clamp(angleDiff(goal, b.dir), -dt * 2.75, dt * 2.75);
  const distance =
    dt *
    b.speed *
    (b.action === "eat" ? 0.27 : 1) *
    (b.steerUntil > now ? 1.6 : 1);
  b.x += Math.cos(b.dir) * distance;
  b.y += Math.sin(b.dir) * distance;
  contain(b);
  paintTrail(b);
}
function drawFood(c) {
  c.fillStyle = "#454545";
  c.font = "bold 21px Georgia,serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const f of state.food) c.fillText(f.letter, f.x, f.y);
}
function drawScene(c, photo = false) {
  c.save();
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, W, H);
  c.drawImage(trail, 0, 0, W, H);
  for (const b of state.bugs) {
    if (photo && b.action === "dead") continue;
    const p = pose(b);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.a);
    c.globalCompositeOperation = "destination-out";
    c.globalAlpha = p.alpha;
    bodyPath(c, b.shape, b.w * p.s, b.h * p.s);
    c.lineWidth = 4;
    c.stroke();
    c.restore();
  }
  drawFood(c);
  for (const b of state.bugs) {
    if (photo && b.action === "dead") continue;
    const p = pose(b);
    drawTile(c, b, p.x, p.y, p.a, p.s, p.alpha);
  }
  const h = state.hold;
  if (h && !photo) {
    const p = pose(h.b),
      elapsed = (performance.now() - h.start) / 1000,
      from = h.hits ? h.next - 1 : 0;
    c.save();
    c.strokeStyle =
      h.hits >= 2 ? "#bd4036" : elapsed > 0.4 ? "#aa742c" : "#747474";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(
      p.x,
      p.y,
      (Math.max(h.b.w, h.b.h) * p.s) / 2 + 8,
      -Math.PI / 2,
      -Math.PI / 2 +
        Math.PI * 2 * clamp((elapsed - from) / (h.next - from), 0, 1),
    );
    c.stroke();
    c.restore();
  }
  c.restore();
}
const hitCanvas = document.createElement("canvas");
hitCanvas.width = hitCanvas.height = 5;
const hitCtx = hitCanvas.getContext("2d", { willReadFrequently: true });
function hitBug(x, y) {
  for (let i = state.bugs.length - 1; i >= 0; i--) {
    const b = state.bugs[i],
      p = pose(b);
    if (p.alpha < 0.015 || Math.hypot(x - p.x, y - p.y) > center * 1.42 * p.s)
      continue;
    hitCtx.clearRect(0, 0, 5, 5);
    drawTile(hitCtx, b, 2.5 + p.x - x, 2.5 + p.y - y, p.a, p.s);
    if (
      hitCtx.getImageData(0, 0, 5, 5).data.some((v, j) => j % 4 === 3 && v > 45)
    )
      return b;
  }
  return null;
}
let consumedPointer = null;
document.addEventListener(
  "pointerdown",
  (e) => {
    if (!state.ready || e.button !== 0 || !e.isPrimary) return;
    consumedPointer = null;
    const b = hitBug(e.clientX, e.clientY);
    const background = e.target === $("plate") || e.target === $("desktop");
    if (!b && !background) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    consumedPointer = e.pointerId;
    $("desktop").setPointerCapture(e.pointerId);
    if (b) {
      if (b.action === "dead") return;
      const p = pose(b),
        dx = p.x - e.clientX,
        dy = p.y - e.clientY;
      state.hold = {
        b,
        id: e.pointerId,
        start: performance.now(),
        dir: Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : b.dir,
        hits: 0,
        next: b.scarred ? 0.65 : 0.8,
      };
    } else if (state.foodMode) {
      state.food.push({
        x: e.clientX,
        y: e.clientY,
        letter: String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      });
    } else spawn(e.clientX, e.clientY);
  },
  true,
);
document.addEventListener(
  "pointerup",
  (e) => {
    if (consumedPointer === e.pointerId) {
      e.stopImmediatePropagation();
      e.preventDefault();
      releaseHold(performance.now());
    }
  },
  true,
);
document.addEventListener(
  "click",
  (e) => {
    if (consumedPointer !== null && e.detail > 0) {
      consumedPointer = null;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
document.addEventListener("pointercancel", () => {
  releaseHold(performance.now(), true);
  consumedPointer = null;
});
window.addEventListener("blur", () => releaseHold(performance.now(), true));
document.addEventListener("visibilitychange", () => {
  last = 0;
  releaseHold(performance.now(), true);
});
function resetPlate() {
  state.bugs.length = state.food.length = 0;
  state.selected = null;
  state.hold = null;
  state.foodMode = false;
  $("foodMode").setAttribute("aria-pressed", "false");
  ink.clearRect(0, 0, W, H);
  closeAllTools();
  resetDraft();
  drawScene(screenCtx);
  notify("Plate cleared. Tank kept.");
}
async function photograph() {
  const layer = document.createElement("canvas");
  layer.width = scene.width;
  layer.height = scene.height;
  drawScene(layer.getContext("2d"), true);
  const out = document.createElement("canvas");
  out.width = layer.width;
  out.height = layer.height;
  const c = out.getContext("2d");
  c.fillStyle = "#f1f1f1";
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(plateArt, 0, 0, out.width, out.height);
  c.drawImage(layer, 0, 0);
  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
  if (!blob) {
    notify("Could not save this photograph.");
    return;
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download =
    "magic-plate-" + new Date().toISOString().replace(/[:.]/g, "-") + ".png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  notify("Photograph saved.");
}
function tick(ms) {
  const dt = last ? clamp((ms - last) / 1000, 0, 0.1) : 0;
  last = ms;
  now += dt;
  updateHold(ms);
  for (const b of state.bugs) advance(b, dt);
  state.bugs = state.bugs.filter(
    (b) => b.action !== "dead" || b.age < data.holds.dead,
  );
  drawScene(screenCtx);
  drawPreviews(dt);
  requestAnimationFrame(tick);
}
