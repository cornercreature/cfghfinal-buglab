"use strict";

const imageBlobs = new WeakMap();

function setFileButtons(enabled) {
  $("openSprite").disabled = $("saveSprite").disabled = !enabled;
}

async function packArtwork(image, filename) {
  if (image.src.startsWith("data:")) return image.src;
  let blob = imageBlobs.get(image);
  if (!blob) {
    const response = await fetch(image.src);
    if (!response.ok) throw new Error("The artwork could not be downloaded.");
    blob = await response.blob();
  }
  const mime = filename.endsWith(".svg") ? "image/svg+xml" : "image/png";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The artwork could not be read."));
    reader.readAsDataURL(blob.slice(0, blob.size, mime));
  });
}

function assertSprite(condition) {
  if (!condition)
    throw new Error("This file contains incomplete or invalid sprite data.");
}

function readSettings(raw, metadata) {
  const n = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  assertSprite(raw && n(raw.w, 24, 320) && n(raw.h, 24, 310));
  assertSprite(
    ["ellipse", "rectangle"].includes(raw.shape) &&
      /^#[0-9a-f]{6}$/i.test(raw.color),
  );
  assertSprite(
    typeof raw.locked === "boolean" && typeof raw.link === "boolean",
  );
  const result = structuredClone(defaults);
  for (const key of ["w", "h", "shape", "color", "locked", "link"])
    result[key] = raw[key];
  for (const key of parts) {
    const point = raw.points?.[key];
    assertSprite(
      Array.isArray(point) &&
        point.length === 2 &&
        point.every(Number.isFinite),
    );
    result.points[key] = [...point];
  }
  for (const side of ["left", "right"]) {
    assertSprite(n(raw.angles?.[side], -180, 180));
    result.angles[side] = raw.angles[side];
  }
  for (const key of Object.keys(eyeNames)) {
    assertSprite(n(raw.holds?.[key], 0.1, 10));
    result.holds[key] = raw.holds[key];
  }
  for (const key of Object.keys(clips)) {
    const timer = raw.timers?.[key];
    assertSprite(
      n(timer?.speed, 0.1, 4) &&
        Number.isInteger(timer.first) &&
        n(timer.first, 0, metadata[key].durations.length - 1),
    );
    result.timers[key] = { speed: timer.speed, first: timer.first };
  }
  result.actions = readActions(raw.actions);
  return result;
}

async function readSprite(file) {
  assertSprite(
    file?.format === "spider-studio" &&
      file.version === 1 &&
      typeof file.name === "string" &&
      file.name.trim().length > 0 &&
      file.name.length <= 100,
  );
  const images = {},
    metadata = {};
  for (const [key, filename] of Object.entries(sources)) {
    const src = file.artwork?.[key];
    const mime = filename.endsWith(".svg") ? "image/svg+xml" : "image/png";
    assertSprite(
      typeof src === "string" && src.startsWith("data:" + mime + ";base64,"),
    );
    const image = new Image();
    image.src = src;
    await image.decode();
    images[key] = image;
    if (Object.hasOwn(clips, key)) {
      const m = file.clips?.[key];
      assertSprite(
        m &&
          [m.width, m.height, m.cols].every(
            (v) => Number.isInteger(v) && v > 0,
          ) &&
          Array.isArray(m.durations) &&
          m.durations.length > 0 &&
          m.durations.length <= 320 &&
          m.durations.every((v) => Number.isFinite(v) && v > 0) &&
          m.width * m.cols === image.naturalWidth &&
          m.height * Math.ceil(m.durations.length / m.cols) ===
            image.naturalHeight,
      );
      metadata[key] = {
        width: m.width,
        height: m.height,
        cols: m.cols,
        durations: m.durations,
      };
    }
  }
  return { images, metadata, settings: readSettings(file.settings, metadata) };
}

function installArtwork({ images, metadata }) {
  Object.assign(imgs, images);
  Object.assign(clips, metadata);
}

function setupSpriteFiles() {
  const dialog = $("spriteDialog"),
    form = $("spriteForm"),
    nameInput = $("spriteName");
  const status = $("save");
  status.setAttribute("role", "status");
  setFileButtons(true);
  $("saveSprite").onclick = () => {
    nameInput.value = data.spriteName || "Untitled spider";
    $("exportError").hidden = true;
    dialog.showModal();
    nameInput.select();
  };
  $("cancelSprite").onclick = () => dialog.close();
  form.onsubmit = async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.value = "";
      nameInput.reportValidity();
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const settings = readSettings(data, clips);
      const metadata = structuredClone(clips);
      const artwork = Object.fromEntries(
        await Promise.all(
          Object.entries(sources).map(async ([key, filename]) => [
            key,
            await packArtwork(imgs[key], filename),
          ]),
        ),
      );
      const sprite = {
        format: "spider-studio",
        version: 1,
        name,
        settings,
        clips: metadata,
        artwork,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(sprite)], {
          type: "application/octet-stream",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download =
        (name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/[. ]+$/g, "") ||
          "Spider") + ".spider";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      data.spriteName = name;
      save();
      dialog.close();
      status.textContent = "Downloaded " + link.download;
    } catch (error) {
      $("exportError").textContent =
        error.message || "The sprite could not be saved.";
      $("exportError").hidden = false;
    } finally {
      submit.disabled = false;
    }
  };
  $("openSprite").onclick = () => $("spriteFile").click();
  $("spriteFile").onchange = async (event) => {
    const input = event.target,
      selected = input.files[0];
    input.value = "";
    if (!selected) return;
    document.querySelector("main").inert = true;
    status.textContent = "Opening sprite…";
    try {
      const file = JSON.parse(await selected.text());
      const decoded = await readSprite(file);
      const id = crypto.randomUUID();
      // Replace the previous artwork and GIF overrides together after validation.
      await clipStore("readwrite", (store) => {
        store.clear();
        return store.put({ name: "openedSprite", id, file });
      });
      installArtwork(decoded);
      data = { ...decoded.settings, spriteName: file.name, openedId: id };
      editor.playing = false;
      walkEvents = [];
      mode = "";
      playing = false;
      t = 0;
      drag = null;
      sel = "body";
      tab = "parts";
      clearExpression();
      save();
      render();
      draw();
      status.textContent = "Opened " + file.name;
    } catch (error) {
      status.textContent =
        "Could not open this sprite. Check the .spider file.";
    } finally {
      document.querySelector("main").inert = false;
    }
  };
}
