"use strict";
const windowNames = {
  lab: "bug lab",
  tank: "bug tank",
  color: "color picker",
  help: "intern handbook",
};
const icons = {
  tank: ["9e114", 75],
  color: ["2b49f", 72],
  reset: ["d1c12", 100],
  photo: ["64d25", 58],
  help: ["a7ade", 37],
};
const toolNames = {
  lab: "Spider lab",
  tank: "Bug tank",
  color: "Color picker",
  reset: "Reset plate",
  photo: "Take photograph",
  help: "Help",
};
const slotImages = ["80451", "6c34a", "8b38a", "cb4c9", "25399", "c8560"];
const windows = new Map();
let topWindow = 1,
  draft = null;
function labIcon() {
  const div = document.createElement("span");
  div.className = "bug-icon";
  const pieces = [
    ["3f091", 27.06, 0, 12.818, 12.818],
    ["c616d", 23.5, 18.52, 19.939, 19.939],
    ["8128f", 45.58, 9.97, 21.67, 37.03],
    ["02736", 0, 9.97, 21.67, 37.03, "scaleX(-1)"],
    ["55f38", 39.87, 20.65, 9.025, 8.062],
    ["f335d", 39.88, 20.65, 9.025, 8.062],
    ["4c23b", 39.88, 28.48, 9.025, 8.062, "scaleY(-1)"],
    ["cc199", 17.8, 20.65, 9.025, 8.062, "scaleX(-1)"],
    ["361b1", 17.8, 28.48, 9.025, 8.062, "rotate(180deg)"],
    ["c3c97", 27.4, 16.7, 11.394, 0.713, "rotate(90deg)"],
    ["adf97", 42.02, 28.48, 11.394, 0.713],
    ["adf97", 13.53, 28.48, 11.394, 0.713],
  ];
  for (const [file, x, y, w, h, t] of pieces) {
    const img = new Image();
    img.src = "assets/" + file + ".svg";
    img.alt = "";
    Object.assign(img.style, {
      left: (x / 67.25) * 100 + "%",
      top: (y / 47) * 100 + "%",
      width: (w / 67.25) * 100 + "%",
      height: (h / 47) * 100 + "%",
      transform: t || "none",
    });
    div.append(img);
  }
  return div;
}
function makeToolbar() {
  for (const [group, ids] of [
    ["topTools", ["lab", "tank", "color"]],
    ["bottomTools", ["reset", "photo", "help"]],
  ]) {
    for (const id of ids) {
      const button = document.createElement("button");
      button.dataset.tool = id;
      button.dataset.tip = toolNames[id];
      button.setAttribute("aria-label", toolNames[id]);
      if (id === "lab") button.append(labIcon());
      else {
        const [file, w] = icons[id],
          img = new Image();
        img.src = "assets/" + file + ".svg";
        img.alt = "";
        img.style.width = w + "%";
        button.append(img);
      }
      if (windowNames[id]) button.setAttribute("aria-pressed", "false");
      button.onclick = () => {
        if (!state.ready) return;
        if (id === "reset") resetPlate();
        else if (id === "photo") photograph();
        else toggleWindow(id);
      };
      $(group).append(button);
      if (id !== "help") {
        const line = document.createElement("span");
        line.className = "rule";
        $(group).append(line);
      }
    }
  }
  $("foodMode").onclick = () => {
    state.foodMode = !state.foodMode;
    $("foodMode").setAttribute("aria-pressed", state.foodMode);
    notify(
      state.foodMode
        ? "Food mode · Click to drop a letter."
        : "Spider mode · Click the plate to spawn.",
      1300,
    );
  };
}
function resetDraft() {
  draft = specimen("ellipse", 130, 210, "#65ff93");
  if (windows.has("lab")) refreshDraft(windows.get("lab"));
}
function setOpen(name, open) {
  windows.get(name).hidden = !open;
  document
    .querySelector('[data-tool="' + name + '"]')
    .setAttribute("aria-pressed", String(open));
}
function closeAllTools() {
  for (const name of windows.keys()) setOpen(name, false);
}
function fitWindow(win) {
  const r = win.getBoundingClientRect();
  win.style.left = clamp(r.left, 0, Math.max(0, W - r.width)) + "px";
  win.style.top = clamp(r.top, 0, Math.max(0, H - r.height)) + "px";
}
function toggleWindow(name) {
  if (!windows.has(name)) createWindow(name);
  const win = windows.get(name);
  setOpen(name, win.hidden);
  if (!win.hidden) {
    win.style.zIndex = ++topWindow;
    fitWindow(win);
    if (name === "color") syncPicker();
    if (name === "tank") refreshTank();
  }
}
function createWindow(name) {
  const el = document.createElement("section");
  el.className = "window";
  el.dataset.name = name;
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", windowNames[name]);
  const bar = document.createElement("div");
  bar.className = "titlebar";
  bar.innerHTML =
    '<div class="traffic"><button aria-label="Close window"></button><button aria-label="Minimize window"></button><button aria-label="Resize window"></button></div>';
  bar.append(document.createTextNode(windowNames[name]));
  el.append(bar, $(name + "Content").content.cloneNode(true));
  $("windows").append(el);
  windows.set(name, el);
  const pos = {
    lab: [0.58, 0.025],
    color: [0.1, 0.37],
    tank: [0.36, 0.19],
    help: [0.17, 0.12],
  }[name];
  el.style.left = W * pos[0] + "px";
  el.style.top = H * pos[1] + "px";
  el.addEventListener("pointerdown", () => {
    el.style.zIndex = ++topWindow;
  });
  let offset = null;
  bar.onpointerdown = (e) => {
    if (e.target.closest("button")) return;
    const r = el.getBoundingClientRect();
    offset = [e.clientX - r.left, e.clientY - r.top];
    bar.setPointerCapture(e.pointerId);
  };
  bar.onpointermove = (e) => {
    if (!offset) return;
    el.style.left =
      clamp(e.clientX - offset[0], 0, Math.max(0, W - el.offsetWidth)) + "px";
    el.style.top =
      clamp(e.clientY - offset[1], 0, Math.max(0, H - el.offsetHeight)) + "px";
  };
  bar.onlostpointercapture = () => (offset = null);
  const [red, yellow, green] = bar.querySelectorAll("button");
  red.onclick = yellow.onclick = () => setOpen(name, false);
  green.onclick = () => {
    el.classList.toggle("zoomed");
    fitWindow(el);
  };
  if (name === "lab") setupLab(el);
  if (name === "color") setupPicker(el);
  if (name === "tank") refreshTank();
}
function setupLab(el) {
  const apply = () => {
    draft ??= specimen("ellipse", 130, 210, "#65ff93");
    draft.w = +el.querySelector("[name=width]").value;
    draft.h = +el.querySelector("[name=length]").value;
    refreshDraft(el);
  };
  for (const b of el.querySelectorAll("[data-shape]"))
    b.onclick = () => {
      apply();
      draft.shape = b.dataset.shape;
      refreshDraft(el);
    };
  for (const range of el.querySelectorAll("input")) range.oninput = apply;
  el.querySelector("[data-cmd=clear]").onclick = () => {
    draft = null;
    refreshDraft(el);
  };
  el.querySelector("[data-cmd=add]").onclick = () => {
    if (!draft) return;
    if (
      state.tank.some(
        (v) => v.shape === draft.shape && v.w === draft.w && v.h === draft.h,
      )
    ) {
      notify("That variety is already in the tank.");
      return;
    }
    if (state.tank.length === 6) {
      notify("Tank full. Remove a variety to make room.");
      return;
    }
    state.tank.push({
      shape: draft.shape,
      w: draft.w,
      h: draft.h,
      color: draft.color,
    });
    saveTank();
    refreshTank();
    notify("Variety added to the tank.");
  };
  refreshDraft(el);
}
function refreshDraft(el) {
  el.querySelector("[data-cmd=add]").disabled = !draft;
  for (const b of el.querySelectorAll("[data-shape]"))
    b.setAttribute("aria-pressed", String(b.dataset.shape === draft?.shape));
  if (draft) {
    el.querySelector("[name=length]").value = draft.h;
    el.querySelector("[name=width]").value = draft.w;
  }
}
function saveTank() {
  try {
    sessionStorage.setItem("buglab-tank-v1", JSON.stringify(state.tank));
  } catch {}
}
function restoreTank() {
  try {
    const list = JSON.parse(sessionStorage.getItem("buglab-tank-v1"));
    if (Array.isArray(list))
      state.tank = list
        .filter(
          (v) =>
            ["ellipse", "rectangle"].includes(v.shape) &&
            v.w >= 45 &&
            v.w <= 260 &&
            v.h >= 55 &&
            v.h <= 260 &&
            /^#[0-9a-f]{6}$/i.test(v.color),
        )
        .slice(0, 6);
  } catch {}
}
function preview(cv, b, angle = 0.3) {
  const w = cv.clientWidth,
    h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * DPR) || cv.height !== Math.round(h * DPR)) {
    cv.width = Math.round(w * DPR);
    cv.height = Math.round(h * DPR);
  }
  const c = cv.getContext("2d");
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, w, h);
  if (b)
    drawTile(
      c,
      b,
      w / 2,
      h * 0.51,
      angle,
      Math.min(
        w / (345 + Math.max(0, b.w - 160)),
        h / (330 + Math.max(0, b.h - 160)),
      ),
      1,
    );
}
function refreshTank() {
  const el = windows.get("tank");
  if (!el) return;
  const grid = el.querySelector(".tank-grid");
  grid.replaceChildren();
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.style.background =
      "url(assets/" + slotImages[i] + ".svg) center / 100% 100%";
    if (state.tank[i]) {
      const v = state.tank[i],
        cv = document.createElement("canvas");
      cv.className = "specimen";
      cv.setAttribute("aria-label", v.shape + " variety");
      slot.append(cv);
      const rem = document.createElement("button");
      rem.className = "remove";
      rem.textContent = "×";
      rem.setAttribute("aria-label", "Remove variety " + (i + 1));
      rem.onclick = () => {
        state.tank.splice(i, 1);
        saveTank();
        refreshTank();
      };
      slot.append(rem);
      const b = specimen(v.shape, v.w, v.h, v.color);
      requestAnimationFrame(() => preview(cv, b));
    }
    grid.append(slot);
  }
  el.querySelector(".tank-count").textContent =
    state.tank.length + " / 6 varieties";
}
function setupPicker(el) {
  const box = el.querySelector(".rgb");
  for (const [i, ch] of ["R", "G", "B"].entries()) {
    const label = document.createElement("label"),
      r = document.createElement("input");
    r.type = "range";
    r.min = 0;
    r.max = 255;
    r.dataset.channel = i;
    r.setAttribute("aria-label", { R: "Red", G: "Green", B: "Blue" }[ch]);
    label.append(ch, r);
    box.append(label);
    r.oninput = () => {
      const b = state.selected;
      if (!b || b.action === "dead") return;
      b.color =
        "#" +
        Array.from(box.querySelectorAll("input"), (i) =>
          (+i.value).toString(16).padStart(2, "0"),
        ).join("");
      b.prev = pose(b);
    };
  }
  syncPicker();
}
function syncPicker() {
  const el = windows.get("color");
  if (!el) return;
  const b = state.selected;
  el.querySelector(".empty-target").hidden = Boolean(b);
  for (const r of el.querySelectorAll("input")) {
    r.disabled = !b;
    r.value = b
      ? parseInt(
          b.color.slice(1 + 2 * r.dataset.channel, 3 + 2 * r.dataset.channel),
          16,
        )
      : 0;
  }
}
function drawPreviews(dt) {
  const lab = windows.get("lab");
  if (lab && !lab.hidden) {
    if (draft) draft.gait += dt;
    preview(lab.querySelector("canvas"), draft);
  }
  const color = windows.get("color");
  if (color && !color.hidden)
    preview(color.querySelector("canvas"), state.selected, 0);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const open = [...windows.entries()]
      .filter(([, w]) => !w.hidden)
      .sort((a, b) => +b[1].style.zIndex - +a[1].style.zIndex);
    if (open.length) setOpen(open[0][0], false);
  }
});
async function init() {
  makeToolbar();
  resizeGame();
  restoreTank();
  window.addEventListener("resize", resizeGame);
  try {
    await Promise.all([loadSprite(), plateArt.decode()]);
    resetDraft();
    state.ready = true;
    const first = spawn(W * 0.27, H * 0.68, true);
    // Let the first live specimen walk onto the sheet, leaving its first mark.
    if (first) for (let i = 0; i < 90; i++) advance(first, 1 / 60);
    notify("Click the oval to spawn a spider.", 3400);
    requestAnimationFrame(tick);
  } catch (error) {
    notify(
      "The spider artwork could not load. Reload the plate to try again.",
      0,
    );
    console.error(error);
  }
}
init();
