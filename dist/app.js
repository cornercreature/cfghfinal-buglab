"use strict";
const $ = (id) => document.getElementById(id);
const icons = {
  check: "m4 12 5 5L20 6",
  canvas: "M3 9V4h5m8 0h5v5m0 6v5h-5m-8 0H3v-5",
  grid: "M4 4h16v16H4zM4 12h16M12 4v16",
  playbox: "M3 5h18v14H3zM10 9l5 3-5 3z",
  loop: "M5 8a8 8 0 0 1 14 1l2-3m-2 3-4-1M19 16a8 8 0 0 1-14-1l-2 3m2-3 4 1",
  route: "M3 18h4c5 0 3-12 9-12h5m-4-3 4 3-4 3",
  play: "M7 4l12 8-12 8z",
  pause: "M8 5v14m8-14v14",
  edit: "M5 15 16 4l4 4L9 19l-5 1z",
  ellipse: "M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0",
  rectangle: "M3 5h18v14H3z",
};
function icon(name) {
  return (
    '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="' +
    icons[name] +
    '"/></svg>'
  );
}
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
const names = {
  body: "Body",
  eyes: "Eyes",
  head: "Head",
  left: "Left legs",
  right: "Right legs",
};
const eyeNames = {
  default: "Default",
  nudge: "Nudge",
  soft: "Light damage",
  hard: "Serious damage",
  dead: "Death",
  eat: "Eating",
};
const parts = ["body", "eyes", "head", "left", "right"];
const drawOrder = ["left", "right", "body", "head", "eyes"];
const timers = Object.fromEntries(
  Object.keys(clips).map((k) => [k, { speed: 1, first: 0 }]),
);
const defaults = {
  w: 160,
  h: 160,
  shape: "ellipse",
  color: "#080808",
  locked: false,
  angles: { left: 0, right: 0 },
  actions: {},
  points: {
    body: [0, 10],
    head: [0, -101],
    eyes: [0, -111],
    left: [-106, 8],
    right: [65, 32],
  },
  timers,
  link: true,
  holds: Object.fromEntries(Object.keys(eyeNames).map((k) => [k, 1])),
};
let data = structuredClone(defaults);
try {
  let saved = JSON.parse(localStorage.getItem("spider-studio-v1"));
  if (saved?.points?.right && saved?.holds?.dead && saved?.timers?.left)
    data = saved;
} catch {}
data.angles = Object.fromEntries(
  ["left", "right"].map((side) => {
    const angle = data.angles?.[side];
    return [
      side,
      Number.isFinite(angle) ? Math.max(-180, Math.min(180, angle)) : 0,
    ];
  }),
);
function save() {
  try {
    localStorage.setItem("spider-studio-v1", JSON.stringify(data));
    $("save").textContent = "Saved on this device";
  } catch {
    $("save").textContent = "Session only";
  }
}
let sel = "body",
  tab = "parts",
  zoom = 1,
  mode = "",
  playing = false,
  t = 0,
  expr = "default",
  exprTime = 0,
  exprStart = 0,
  timingPart = "left",
  drag = null,
  ready = false;
const imgs = {},
  canvas = $("canvas"),
  ctx = canvas.getContext("2d"),
  clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sources = {
  head: "605ce.svg",
  dead: "262ad.svg",
  hard: "e44d9.svg",
  eat: "99558.svg",
  softL: "b3c16.svg",
  softR: "6643f.svg",
  eyeL: "f9df1.svg",
  eyeR: "03cb0.svg",
  pupilL: "8d0e8.svg",
  pupilR: "9d628.svg",
  left: "left.png",
  right: "right.png?v=a6666244f7a8",
  nudge: "nudge.png?v=68cbe792a33e",
};
const loadImages = Promise.all(
  Object.entries(sources).map(async ([key, file]) => {
    const img = new Image();
    img.src = "assets/" + file;
    await img.decode();
    imgs[key] = img;
  }),
);
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
function bodyPath(c) {
  c.beginPath();
  if (data.shape === "ellipse")
    c.ellipse(0, 0, data.w / 2, data.h / 2, 0, 0, Math.PI * 2);
  else c.rect(-data.w / 2, -data.h / 2, data.w, data.h);
}
function paintPart(c, id, seconds = 0) {
  if (id === "body") {
    c.fillStyle = data.color;
    bodyPath(c);
    c.fill();
  } else if (id === "head") {
    centered(c, "head", 0, 0, 45, 45);
  } else if (id === "eyes") {
    eyes(
      c,
      tab === "actions" ? editor.action : expr,
      tab === "actions"
        ? (editor.at * data.holds[editor.action]) / 1000
        : exprTime,
    );
  } else
    clip(c, id, (280.2 * clips[id].width) / clips[id].height, 280.2, seconds);
}
function bounds(id) {
  if (id === "body") return [data.w, data.h];
  if (id === "eyes")
    return [101, expr === "eat" ? 47 : expr === "default" ? 22 : 40];
  return id === "head"
    ? [45, 45]
    : [(280.2 * clips[id].width) / clips[id].height, 280.2];
}
function isLeg(id) {
  return id === "left" || id === "right";
}
function legPivot(id) {
  return bounds(id)[0] * (id === "left" ? 0.26 : -0.26);
}
function partTransform(id, sample = liveAction()) {
  const matrix = actionParent(id, sample).translateSelf(...data.points[id]);
  const pose = sample ? poseAt(sample.action, id, sample.at) : restPose;
  const pivot = isLeg(id) ? legPivot(id) : 0;
  poseAround(
    matrix,
    { ...pose, angle: pose.angle + (isLeg(id) ? data.angles[id] : 0) },
    pivot,
    0,
  );
  return matrix;
}
function placePart(c, id, sample = liveAction()) {
  const { a, b, c: skew, d, e, f } = partTransform(id, sample);
  c.transform(a, b, skew, d, e, f);
}
function handleOffset(id) {
  return (bounds(id)[0] / 2 + 18) * (id === "left" ? -1 : 1);
}
function drawSelection(c) {
  const [w, h] = bounds(sel);
  c.save();
  placePart(c, sel);
  c.strokeStyle = "#a997c7";
  c.lineWidth = 0.9;
  c.setLineDash([3, 4]);
  c.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  c.setLineDash([]);
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const px = sx * (w / 2 + 3),
        py = sy * (h / 2 + 3);
      c.fillStyle = "white";
      c.fillRect(px - 2.4, py - 2.4, 4.8, 4.8);
      c.strokeRect(px - 2.4, py - 2.4, 4.8, 4.8);
    }
  if (isLeg(sel)) {
    const handle = handleOffset(sel);
    c.strokeStyle = "#6744bd";
    c.beginPath();
    c.moveTo(Math.sign(handle) * (w / 2 + 3), 0);
    c.lineTo(handle, 0);
    c.stroke();
    for (const [x, radius] of [
      [handle, 5],
      [legPivot(sel), 3],
    ]) {
      c.beginPath();
      c.arc(x, 0, radius, 0, 2 * Math.PI);
      c.fillStyle = "white";
      c.fill();
      c.stroke();
    }
  }
  c.restore();
}
function deathOpacity(sample, target) {
  return sample?.action === "dead" ? poseAt("dead", target, sample.at).opacity / 100 : 1;
}
function drawSpiderParts(c, time, sample) {
  for (const id of drawOrder) {
    c.save();
    c.globalAlpha *= deathOpacity(sample, id);
    placePart(c, id, sample);
    paintPart(c, id, time);
    c.restore();
  }
}
const fadeLayer = document.createElement("canvas");
const fadeContext = fadeLayer.getContext("2d");
function spider(c, time) {
  const sample = liveAction();
  const opacity = deathOpacity(sample, "whole");
  if (opacity === 0) return;
  if (opacity === 1) {
    drawSpiderParts(c, time, sample);
    return;
  }
  // Composite the assembled sprite once so overlapping parts fade together.
  if (fadeLayer.width !== c.canvas.width) fadeLayer.width = c.canvas.width;
  if (fadeLayer.height !== c.canvas.height) fadeLayer.height = c.canvas.height;
  fadeContext.resetTransform();
  fadeContext.clearRect(0, 0, fadeLayer.width, fadeLayer.height);
  fadeContext.setTransform(c.getTransform());
  drawSpiderParts(fadeContext, time, sample);
  c.save();
  c.resetTransform();
  c.globalAlpha *= opacity;
  c.drawImage(fadeLayer, 0, 0);
  c.restore();
}
function geometry() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  const fit = Math.min(w / 480, h / 355, 1.55) * zoom;
  return { w, h, fit, x: w / 2, y: h / 2 + 10 };
}
function walkPose(s, g) {
  const a = clamp(s / 4, 0, 1),
    amp = Math.min(g.h * 0.19, 84);
  return {
    x: g.w * (0.18 + 0.64 * a),
    y: g.h * 0.48 + amp * Math.cos(Math.PI * a),
    angle:
      Math.atan2(-amp * Math.PI * Math.sin(Math.PI * a), g.w * 0.64) +
      Math.PI / 2,
  };
}
function transform(c, p, scale) {
  c.translate(p.x, p.y);
  c.rotate(p.angle);
  c.scale(scale, scale);
}
function walkScale(g) {
  return Math.min(g.fit * 0.43, g.w / 1250, g.h / 650);
}
function placeBrush(sample) {
  ctx.translate(...data.points.body);
  if (
    sample &&
    (data.actions?.[sample.action]?.body?.length ||
      data.actions?.[sample.action]?.whole?.length)
  ) {
    let scale = 1;
    for (const target of ["whole", "body"]) {
      const pose = poseAt(sample.action, target, sample.at);
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.angle * Math.PI / 180);
      ctx.scale(pose.size / 100, pose.size / 100);
      scale *= pose.size / 100;
    }
    return scale;
  }
  return 1;
}
// The brush is a transformed copy of the body at successive sub-pixel intervals.
function walkFrame(g) {
  const scale = walkScale(g),
    elapsed = t;
  const count = Math.ceil((elapsed / 4) * (g.w * 0.64 + g.h * 0.7) * 2);
  ctx.fillStyle = data.color;
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const time = count ? (elapsed * i) / count : 0;
    const p = walkPose(time, g);
    ctx.save();
    transform(ctx, p, scale);
    placeBrush(walkActionAt(time));
    if (data.shape === "ellipse") {
      ctx.moveTo(data.w / 2, 0);
      ctx.ellipse(0, 0, data.w / 2, data.h / 2, 0, 0, 2 * Math.PI);
      ctx.closePath();
    } else ctx.rect(-data.w / 2, -data.h / 2, data.w, data.h);
    ctx.restore();
  }
  ctx.fill();
  if (elapsed > 0) {
    ctx.save();
    transform(ctx, walkPose(elapsed, g), scale);
    const sample = liveAction();
    const brushScale = placeBrush(sample);
    bodyPath(ctx);
    // Cut only the trail. The body covers the inner half of the stroke,
    // leaving two CSS pixels of the sheet visible along the contact edge.
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = deathOpacity(sample, "whole") * deathOpacity(sample, "body");
    ctx.lineWidth = 4 / (scale * brushScale);
    ctx.stroke();
    ctx.restore();
  }
  if ($("ghost").checked) {
    for (let s = 0; s <= elapsed + 0.001; s += 0.45) {
      ctx.save();
      transform(ctx, walkPose(s, g), scale);
      placeBrush(walkActionAt(s));
      bodyPath(ctx);
      ctx.strokeStyle = "#b687fb";
      ctx.lineWidth = 1.25 / scale;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.save();
  transform(ctx, walkPose(t, g), scale);
  spider(ctx, t);
  ctx.restore();
}
function draw() {
  if (!ready) return;
  const g = geometry(),
    dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(g.w * dpr) ||
    canvas.height !== Math.round(g.h * dpr)
  ) {
    canvas.width = Math.round(g.w * dpr);
    canvas.height = Math.round(g.h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.w, g.h);
  if (mode === "walk") walkFrame(g);
  else {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(g.fit, g.fit);
    spider(
      ctx,
      tab === "actions" ? (editor.at * data.holds[editor.action]) / 1000 : t,
    );
    if (tab !== "actions" && !data.locked) drawSelection(ctx);
    ctx.restore();
  }
  $("clock").value = t.toFixed(2) + " s";
  $("timeline").value = t;
}
function thumb(el, id, e) {
  if (!ready) return;
  const c = el.getContext("2d");
  el.width = e ? 162 : 108;
  el.height = e ? 72 : 90;
  c.translate(el.width / 2, el.height / 2);
  if (e) {
    c.scale(1.25, 1.25);
    eyes(c, e, 0);
  } else {
    const [w, h] = bounds(id),
      sc = Math.min(90 / w, 72 / h);
    c.scale(sc, sc);
    paintPart(c, id, 0);
  }
}
const num = (id, value, min, max, step = 1) =>
  '<input class="numeric" id="' +
  id +
  '" type="number" value="' +
  value +
  '" min="' +
  min +
  '" max="' +
  max +
  '" step="' +
  step +
  '">';
function positionText(id) {
  return data.points[id].map(Math.round).join(", ");
}
function partPanel() {
  return (
    '<div class="block"><h2>Sprite parts</h2><div class="list">' +
    parts
      .map(
        (id) =>
          '<button class="part ' +
          (id === sel ? "active" : "") +
          '" data-part="' +
          id +
          '" aria-pressed="' +
          (id === sel) +
          '"><span class="thumb"><canvas data-thumb="' +
          id +
          '"></canvas></span>' +
          names[id] +
          '<span class="coords">' +
          positionText(id) +
          "</span></button>",
      )
      .join("") +
    "</div></div>" +
    '<div class="block"><h2>' +
    names[sel] +
    " settings</h2>" +
    (sel === "body"
      ? '<div class="shape"><button id="ellipse" aria-pressed="' +
        (data.shape === "ellipse") +
        '">' +
        icon("ellipse") +
        'Ellipse</button><button id="rectangle" aria-pressed="' +
        (data.shape === "rectangle") +
        '">' +
        icon("rectangle") +
        'Rectangle</button></div><div class="fieldpair"><label>Width (px)' +
        num("width", data.w, 24, 320) +
        "</label><label>Height (px)" +
        num("height", data.h, 24, 310) +
        '</label></div><div class="color-row"><label for="color">Body color</label><label class="color-field"><input type="color" id="color" value="' +
        data.color +
        '"><span id="hex">' +
        data.color.toUpperCase() +
        "</span></label></div>"
      : '<div class="fieldpair"><label>X position' +
        num("posX", Math.round(data.points[sel][0]), -250, 250) +
        "</label><label>Y position" +
        num("posY", Math.round(data.points[sel][1]), -200, 200) +
        "</label></div>") +
    (isLeg(sel)
      ? '<div class="row"><label for="angle">Rotation (°)</label>' +
        num("angle", data.angles[sel], -180, 180) +
        "</div>" +
        (data.locked
          ? ""
          : '<p class="note">Drag the outer round handle to rotate around the inner pivot.</p>')
      : "") +
    "</div>"
  );
}
function eyePanel() {
  return (
    '<div class="block"><h2>Eye expressions</h2><div class="expression-grid">' +
    Object.entries(eyeNames)
      .map(
        ([id, n]) =>
          '<button data-eye="' +
          id +
          '" aria-pressed="' +
          (id === expr) +
          '"><canvas data-et="' +
          id +
          '"></canvas>' +
          n +
          "</button>",
      )
      .join("") +
    '</div><p class="small">Select an expression to trigger it on the spider.</p></div><div class="block"><h2>Expression duration</h2><label>Expression<select id="holdSelect">' +
    Object.entries(eyeNames)
      .filter(([id]) => id !== "default")
      .map(([id, n]) => '<option value="' + id + '">' + n + "</option>")
      .join("") +
    '</select></label><div class="row"><label for="hold">Return to default (s)</label>' +
    num("hold", data.holds.nudge, 0.1, 10, 0.1) +
    "</div></div>"
  );
}
function timingPanel() {
  const s = data.timers[timingPart];
  return (
    '<div class="block"><h2>Clip timing</h2><label>Animated sprite<select id="clip">' +
    Object.keys(clips)
      .map(
        (k) =>
          '<option value="' +
          k +
          '" ' +
          (k === timingPart ? "selected" : "") +
          ">" +
          (names[k] || "Nudge eyes") +
          "</option>",
      )
      .join("") +
    '</select></label><div class="row"><label for="speed">Playback speed (×)</label>' +
    num("speed", s.speed, 0.1, 4, 0.1) +
    '</div><div class="row"><label for="first">Starting frame</label>' +
    num("first", s.first + 1, 1, clips[timingPart].durations.length) +
    '</div><p class="small">' +
    clips[timingPart].durations.length +
    " frames · " +
    (clips[timingPart].durations.reduce((a, b) => a + b, 0) / 1000).toFixed(2) +
    ' s at original speed</p><label class="upload">Import replacement GIF<input type="file" id="importClip" accept="image/gif,.gif"></label><p id="importNote" class="note" role="status"></p></div><div class="block"><label><input type="checkbox" id="link" ' +
    (data.link ? "checked" : "") +
    "> Link leg timing</label></div>"
  );
}
function on(id, event, fn) {
  $(id)?.addEventListener(event, fn);
}
function numberField(id, callback) {
  on(id, "change", (e) => {
    const input = e.target;
    let value = input.valueAsNumber;
    if (!Number.isFinite(value)) {
      render();
      return;
    }
    value = clamp(value, +input.min, +input.max);
    if (input.step === "1") value = Math.round(value);
    input.value = value;
    callback(value);
    save();
    draw();
  });
}
function move(id, dx, dy) {
  data.points[id][0] += dx;
  data.points[id][1] += dy;
  if (id === "head") {
    data.points.eyes[0] += dx;
    data.points.eyes[1] += dy;
  }
}
function resize(key, value) {
  const delta = value - data[key];
  data[key] = value;
  if (key === "w") {
    move("left", -delta * 0.43, 0);
    move("right", delta * 0.43, 0);
  } else move("head", 0, -delta / 2);
  render();
}
function changeTiming(key, v) {
  data.timers[timingPart][key] = v;
  if (data.link && timingPart !== "nudge") {
    const other = timingPart === "left" ? "right" : "left";
    data.timers[other][key] =
      key === "first" ? Math.min(v, clips[other].durations.length - 1) : v;
  }
}
let holdTarget = "nudge";
function render() {
  document
    .querySelectorAll("[data-tab]")
    .forEach((el) => el.setAttribute("aria-selected", el.dataset.tab === tab));
  $("inspector").innerHTML =
    tab === "parts"
      ? partPanel()
      : tab === "eyes"
        ? eyePanel()
        : tab === "actions"
          ? actionPanel()
          : timingPanel();
  if (tab === "actions") bindActionPanel();
  document
    .querySelectorAll("[data-thumb]")
    .forEach((el) => thumb(el, el.dataset.thumb));
  document
    .querySelectorAll("[data-et]")
    .forEach((el) => thumb(el, null, el.dataset.et));
  document.querySelectorAll("[data-part]").forEach(
    (el) =>
      (el.onclick = () => {
        sel = el.dataset.part;
        render();
        draw();
      }),
  );
  for (const shape of ["rectangle", "ellipse"])
    on(shape, "click", () => {
      data.shape = shape;
      save();
      render();
      draw();
    });
  numberField("width", (v) => resize("w", v));
  numberField("height", (v) => resize("h", v));
  on("color", "input", (e) => {
    data.color = e.target.value;
    $("hex").textContent = data.color.toUpperCase();
    save();
    draw();
    thumb(document.querySelector("[data-thumb=body]"), "body");
  });
  for (const [i, key] of ["posX", "posY"].entries()) {
    if ($(key)) $(key).disabled = data.locked;
    numberField(key, (v) => {
      move(
        sel,
        i === 0 ? v - data.points[sel][0] : 0,
        i === 1 ? v - data.points[sel][1] : 0,
      );
      render();
    });
  }
  if ($("angle")) {
    $("angle").disabled = data.locked;
    numberField("angle", (degrees) => {
      data.angles[sel] = degrees;
    });
  }
  document.querySelectorAll("[data-eye]").forEach(
    (el) =>
      (el.onclick = () => {
        if (mode === "walk") {
          walkEvents = walkEvents.filter((e) => e.time < t);
          walkEvents.push({ time: t, action: el.dataset.eye });
        }
        trigger(el.dataset.eye);
        if (expr !== "default") holdTarget = expr;
        render();
        draw();
      }),
  );
  if ($("holdSelect")) {
    $("holdSelect").value = holdTarget;
    $("hold").value = data.holds[holdTarget];
  }
  on("holdSelect", "change", (e) => {
    holdTarget = e.target.value;
    $("hold").value = data.holds[holdTarget];
  });
  numberField("hold", (v) => (data.holds[holdTarget] = v));
  on("importClip", "change", async (e) => {
    const file = e.target.files[0],
      part = timingPart;
    if (!file) return;
    setFileButtons(false);
    e.target.disabled = true;
    const note = $("importNote");
    note.textContent = "Reading GIF frames…";
    try {
      const item = await decodeClip(file, part);
      await clipStore("readwrite", (store) => store.put(item));
      await applyImported(item);
      data.locked = false;
      mode = "";
      t = 0;
      playing = false;
      save();
      render();
      draw();
      if ($("importNote"))
        $("importNote").textContent =
          file.name + " loaded. Confirm its placement to preview.";
    } catch (error) {
      note.textContent = error.message || "Could not import this GIF.";
      e.target.disabled = false;
    } finally {
      setFileButtons(true);
    }
  });
  on("clip", "change", (e) => {
    timingPart = e.target.value;
    render();
  });
  numberField("speed", (v) => changeTiming("speed", v));
  numberField("first", (v) => changeTiming("first", v - 1));
  on("link", "change", (e) => {
    data.link = e.target.checked;
    if (data.link) {
      const src = timingPart === "right" ? "right" : "left";
      const other = src === "right" ? "left" : "right";
      data.timers[other] = {
        ...data.timers[src],
        first: Math.min(
          data.timers[src].first,
          clips[other].durations.length - 1,
        ),
      };
    }
    save();
  });
  syncControls();
}
function syncControls() {
  document.querySelector(".preview").hidden = tab === "actions";
  $("lock").hidden = tab === "actions";
  const locked = data.locked;
  $("lock").innerHTML =
    icon(locked ? "edit" : "check") +
    (locked ? "Edit placement" : "Confirm placement");
  $("instruction").textContent =
    tab === "actions"
      ? "Set poses on the action timeline and play them with the matching eyes."
      : locked
        ? "Placement confirmed. Preview your spider or adjust its brush."
        : "Drag the parts into position, then confirm your spider to preview it.";
  $("state").textContent =
    tab === "actions"
      ? eyeNames[editor.action]
      : mode === "walk"
        ? "Test walk"
        : mode === "animate"
          ? "Animating in place"
          : locked
            ? "Placement locked"
            : "Editing";
  for (const id of ["walk", "animate"]) {
    $(id).disabled = !locked;
    $(id).setAttribute("aria-pressed", id === mode);
  }
  $("play").disabled = $("timeline").disabled = !mode;
  $("play").innerHTML = icon(playing ? "pause" : "play");
  $("ghostLabel").hidden = mode !== "walk";
}
function trigger(e) {
  expr = e;
  exprTime = 0;
  exprStart = t;
}
function clearExpression() {
  trigger("default");
  document
    .querySelectorAll("[data-eye]")
    .forEach((el) => el.setAttribute("aria-pressed", el.dataset.eye === expr));
}
document.querySelectorAll("[data-tab]").forEach(
  (el) =>
    (el.onclick = () => {
      if (tab === "actions" || el.dataset.tab === "actions") {
        editor.playing = false;
        playing = false;
        mode = "";
        t = 0;
        clearExpression();
      }
      tab = el.dataset.tab;
      render();
      draw();
    }),
);
on("lock", "click", () => {
  data.locked = !data.locked;
  playing = false;
  mode = "";
  t = 0;
  clearExpression();
  save();
  render();
  draw();
});
for (const id of ["walk", "animate"])
  on(id, "click", () => {
    walkEvents = [];
    mode = id;
    playing = true;
    t = 0;
    clearExpression();
    syncControls();
    draw();
  });
on("play", "click", () => {
  if (t >= 4) t = 0;
  playing = !playing;
  syncControls();
  draw();
});
on("timeline", "input", (e) => {
  playing = false;
  t = +e.target.value;
  if (mode === "walk") syncWalkExpression();
  else if (expr !== "default") {
    exprTime = Math.max(0, t - exprStart);
    if (exprTime >= data.holds[expr]) clearExpression();
  }
  syncControls();
  draw();
});
on("ghost", "change", draw);
function setZoom(v) {
  zoom = clamp(v, 0.5, 1.8);
  $("zoom").textContent = Math.round(zoom * 100) + "%";
  draw();
}
on("smaller", "click", () => setZoom(zoom - 0.1));
on("larger", "click", () => setZoom(zoom + 0.1));
on("zoom", "click", () => setZoom(1));
on("grid", "click", () => {
  $("grid").setAttribute("aria-pressed", $("stage").classList.toggle("grid"));
});
function world(event) {
  const r = canvas.getBoundingClientRect(),
    g = geometry();
  return [
    (event.clientX - r.left - g.x) / g.fit,
    (event.clientY - r.top - g.y) / g.fit,
  ];
}
const hitCanvas = document.createElement("canvas");
hitCanvas.width = hitCanvas.height = 13;
const hit = hitCanvas.getContext("2d", { willReadFrequently: true });
function partAt(x, y) {
  for (const id of [...drawOrder].reverse()) {
    hit.setTransform(1, 0, 0, 1, 0, 0);
    hit.clearRect(0, 0, 13, 13);
    hit.translate(6 - x, 6 - y);
    placePart(hit, id);
    paintPart(hit, id, t);
    const rgba = hit.getImageData(0, 0, 13, 13).data;
    for (let a = 3; a < rgba.length; a += 4) if (rgba[a] > 90) return id;
  }
  return null;
}
function onRotationHandle(x, y) {
  if (!isLeg(sel)) return false;
  const handle = partTransform(sel).transformPoint({
    x: handleOffset(sel),
    y: 0,
  });
  return Math.hypot(x - handle.x, y - handle.y) <= 10 / geometry().fit;
}
function pointerAngle(x, y) {
  const [cx, cy] = data.points[sel];
  return (Math.atan2(y - cy, x - cx - legPivot(sel)) * 180) / Math.PI;
}
on("canvas", "pointerdown", (e) => {
  if (!ready) return;
  if (tab === "actions") {
    const [x, y] = world(e),
      id = partAt(x, y);
    if (!id) return;
    editor.playing = false;
    if (editor.target !== "whole") editor.target = id;
    editor.at = Math.round(editor.at);
    const pose = poseAt(editor.action, editor.target, editor.at);
    const parent =
      editor.target === "whole"
        ? new DOMMatrix()
        : actionParent(editor.target, editor);
    drag = {
      action: true,
      x,
      y,
      baseX: pose.x,
      baseY: pose.y,
      inverse: parent.inverse(),
    };
    canvas.setPointerCapture(e.pointerId);
    render();
    draw();
    return;
  }
  if (data.locked) return;
  const [x, y] = world(e),
    rotating = onRotationHandle(x, y),
    id = rotating ? sel : partAt(x, y);
  if (!id) return;
  sel = id;
  tab = "parts";
  drag = rotating
    ? { angleOffset: data.angles[sel] - pointerAngle(x, y) }
    : { x, y };
  canvas.setPointerCapture(e.pointerId);
  canvas.focus();
  canvas.style.cursor = "grabbing";
  render();
  draw();
});
on("canvas", "pointermove", (e) => {
  if (ready && tab === "actions") {
    const [x, y] = world(e);
    canvas.style.cursor = drag ? "grabbing" : partAt(x, y) ? "grab" : "default";
    if (drag?.action) {
      const dx = x - drag.x,
        dy = y - drag.y,
        m = drag.inverse;
      setActionKey({
        x: clamp(drag.baseX + m.a * dx + m.c * dy, -1000, 1000),
        y: clamp(drag.baseY + m.b * dx + m.d * dy, -1000, 1000),
      });
    }
    return;
  }
  if (!ready || data.locked) {
    canvas.style.cursor = "default";
    return;
  }
  const [x, y] = world(e);
  if (!drag) {
    canvas.style.cursor =
      onRotationHandle(x, y) || partAt(x, y) ? "grab" : "default";
    return;
  }
  if ("angleOffset" in drag) {
    const degrees = Math.round(pointerAngle(x, y) + drag.angleOffset);
    data.angles[sel] = ((degrees + 540) % 360) - 180;
    if ($("angle")) $("angle").value = data.angles[sel];
    draw();
    return;
  }
  move(sel, x - drag.x, y - drag.y);
  drag = { x, y };
  draw();
});
function finishDrag() {
  if (drag) {
    drag = null;
    canvas.style.cursor = "grab";
    save();
    render();
    draw();
  }
}
on("canvas", "pointerup", finishDrag);
on("canvas", "pointercancel", finishDrag);
on("canvas", "lostpointercapture", finishDrag);
on("canvas", "keydown", (e) => {
  if (data.locked || tab === "actions") return;
  const delta = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[e.key];
  if (delta) {
    e.preventDefault();
    move(sel, ...delta.map((a) => a * (e.shiftKey ? 10 : 1)));
    save();
    render();
    draw();
  }
});
function syncWalkExpression() {
  const sample = walkActionAt(t);
  const previous = expr;
  expr = sample?.action || "default";
  exprTime = sample ? (sample.at * data.holds[expr]) / 1000 : 0;
  if (expr === previous) return;
  document
    .querySelectorAll("[data-eye]")
    .forEach((el) => el.setAttribute("aria-pressed", el.dataset.eye === expr));
}
let last = 0;
function tick(now) {
  const dt = last ? (now - last) / 1000 : 0;
  last = now;
  let changed = false;
  if (tab === "actions" && editor.playing) {
    editor.at = Math.min(
      1000,
      editor.at + (dt * 1000) / data.holds[editor.action],
    );
    if (editor.at >= 1000) editor.playing = false;
    updateActionFields();
    changed = true;
  }
  const advancingWalk = mode === "walk" && playing;
  if (playing) {
    t += dt;
    if (t >= 4) {
      if (mode === "walk") {
        t = 4;
        playing = false;
        syncControls();
      } else t %= 4;
    }
    changed = true;
  }
  if (advancingWalk) syncWalkExpression();
  else if (expr !== "default" && (playing || !mode || t >= 4)) {
    exprTime += dt;
    if (exprTime >= data.holds[expr]) clearExpression();
    changed = true;
  }
  if (changed) draw();
  requestAnimationFrame(tick);
}
document.addEventListener("visibilitychange", () => {
  last = 0;
});
new ResizeObserver(draw).observe(canvas);
loadImages
  .then(async () => {
    try {
      const replacements = await clipStore("readonly", (store) =>
        store.getAll(),
      );
      const opened = replacements.find((item) => item.name === "openedSprite");
      if (opened) {
        const decoded = await readSprite(opened.file);
        installArtwork(decoded);
        if (data.openedId !== opened.id)
          data = {
            ...decoded.settings,
            spriteName: opened.file.name,
            openedId: opened.id,
          };
      }
      await Promise.all(
        replacements
          .filter((item) => Object.hasOwn(clips, item.name))
          .map(applyImported),
      );
    } catch {}
    ready = true;
    setupSpriteFiles();
    render();
    draw();
    requestAnimationFrame(tick);
  })
  .catch(() => {
    $("instruction").textContent =
      "Artwork could not load. Reopen the workbench to retry.";
    $("lock").disabled = true;
  });
