"use strict";
// The saved workbench sprite supplies the artwork, assembly, clip timing and action tracks.
let data, clips;
const imgs = {};
async function loadSprite() {
  const response = await fetch("assets/spidersprite.spider");
  if (!response.ok) throw new Error("Sprite could not load.");
  const sprite = await response.json();
  data = sprite.settings;
  clips = sprite.clips;
  await Promise.all(
    Object.entries(sprite.artwork).map(async ([name, src]) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      imgs[name] = img;
    }),
  );
}
function frameAt(name, seconds) {
  const c = clips[name],
    settings = data.timers[name],
    length = c.durations.reduce((a, b) => a + b, 0);
  let elapsed =
    (Math.max(0, seconds) * 1000 * settings.speed +
      c.durations.slice(0, settings.first).reduce((a, b) => a + b, 0)) %
    length;
  for (let i = 0; i < c.durations.length; i++) {
    if (elapsed < c.durations[i]) return i;
    elapsed -= c.durations[i];
  }
  return 0;
}
function clip(c, name, w, h, seconds) {
  const s = clips[name],
    f = frameAt(name, seconds);
  c.drawImage(
    imgs[name],
    (f % s.cols) * s.width,
    Math.floor(f / s.cols) * s.height,
    s.width,
    s.height,
    -w / 2,
    -h / 2,
    w,
    h,
  );
}
function centered(c, key, x, y, w, h) {
  c.drawImage(imgs[key], x - w / 2, y - h / 2, w, h);
}
function eyes(c, e, seconds) {
  const w = 99;
  if (e === "default") {
    c.save();
    c.scale(w / 388, w / 388);
    c.translate(-193, -39);
    for (const [file, x, y, a, b, d] of [
      ["eyeL", 87.71, 38.97, 0.99849, 0.054934, 1],
      ["eyeR", 298.54, 38.97, -0.997921, 0.064447, -1],
    ]) {
      c.save();
      c.translate(x, y);
      c.transform(a, b, -b * d, a * d, 0, 0);
      centered(c, file, 0, 0, 175, 70);
      c.restore();
    }
    centered(c, "pupilL", 85.21, 37.97, 95, 69);
    c.save();
    c.translate(301.04, 37.97);
    c.scale(-1, 1);
    centered(c, "pupilR", 0, 0, 95, 69);
    c.restore();
    c.restore();
    return;
  }
  if (e === "nudge") {
    clip(c, "nudge", w, (w * clips.nudge.height) / clips.nudge.width, seconds);
    return;
  }
  if (e === "soft") {
    c.save();
    c.scale(w / 358, w / 358);
    centered(c, "softL", -102.5, 2.5, 153, 116);
    centered(c, "softR", 102.5, -2.5, 153, 116);
    c.restore();
    return;
  }
  centered(c, e, 0, 0, w, (w * imgs[e].naturalHeight) / imgs[e].naturalWidth);
}
const neutral = { x: 0, y: 0, angle: 0, size: 100, opacity: 100 };
function wholePose(b) {
  const keys = data.actions[b.action]?.whole;
  if (!keys?.length) return neutral;
  const at = Math.min(1000, (1000 * b.age) / data.holds[b.action]);
  let prev = { at: 0, ...neutral },
    next = { at: 1000, ...neutral };
  for (const k of keys) {
    if (k.at <= at) prev = k;
    if (k.at >= at) {
      next = k;
      break;
    }
  }
  const f = next.at === prev.at ? 0 : (at - prev.at) / (next.at - prev.at);
  const pose = {};
  for (const prop of Object.keys(neutral)) {
    const a = prev[prop] ?? neutral[prop],
      z = next[prop] ?? neutral[prop];
    pose[prop] = a + (z - a) * f;
  }
  return pose;
}
function bodyPath(c, shape, w, h) {
  c.beginPath();
  if (shape === "rectangle") c.rect(-w / 2, -h / 2, w, h);
  else c.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * Math.PI);
}
const tileSize = 560,
  center = tileSize / 2;
function spriteTile(b) {
  const legTime = b.action === "dead" ? b.frozenGait : b.gait;
  const k = [
    b.shape,
    b.w,
    b.h,
    b.color,
    b.action,
    frameAt("left", legTime),
    frameAt("right", legTime),
    b.action === "nudge" ? frameAt("nudge", b.age) : 0,
  ].join("|");
  if (b.tileKey === k) return b.tile;
  b.tileKey = k;
  if (!b.tile) {
    b.tile = document.createElement("canvas");
    b.tile.width = b.tile.height = tileSize;
  }
  const c = b.tile.getContext("2d");
  c.resetTransform();
  c.clearRect(0, 0, tileSize, tileSize);
  c.translate(center, center);
  const body = data.points.body;
  for (const id of ["left", "right", "body", "head", "eyes"]) {
    c.save();
    const leg = id === "left" || id === "right";
    let x = data.points[id][0] - body[0],
      y = data.points[id][1] - body[1];
    if (leg) x += (b.w - data.w) * 0.43 * (id === "left" ? -1 : 1);
    if (id === "head" || id === "eyes") y -= (b.h - data.h) / 2;
    c.translate(x, y);
    if (leg) {
      const w = (280.2 * clips[id].width) / clips[id].height;
      const pivot = w * (id === "left" ? 0.26 : -0.26);
      c.translate(pivot, 0);
      c.rotate((data.angles[id] * Math.PI) / 180);
      c.translate(-pivot, 0);
      clip(c, id, w, 280.2, legTime);
    } else if (id === "body") {
      bodyPath(c, b.shape, b.w, b.h);
      c.fillStyle = b.color;
      c.fill();
    } else if (id === "head") centered(c, "head", 0, 0, 45, 45);
    else eyes(c, b.action, b.age);
    c.restore();
  }
  return b.tile;
}
function drawTile(c, b, x, y, angle, scale, opacity = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(scale, scale);
  c.globalAlpha *= opacity;
  c.drawImage(spriteTile(b), -center, -center);
  c.restore();
}
