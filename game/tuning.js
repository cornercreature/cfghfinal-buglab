"use strict";
const params = new URLSearchParams(location.search);
const pageMode = params.has("tuning")
  ? "tuning"
  : params.has("preview")
    ? "preview"
    : "plate";
const tuningKey = "buglab-tuning-v1";
const minimumSpawnPercent = 2;
const defaults = {
  minSize: minimumSpawnPercent,
  maxSize: 76,
  nudge: 0.4,
  light: 0.8,
  serious: 1.8,
  death: 2.8,
};
const timingKeys = ["nudge", "light", "serious", "death"];
function readTuning() {
  try {
    const values = JSON.parse(localStorage.getItem(tuningKey));
    if (
      values &&
      Object.keys(defaults).every((k) => Number.isFinite(values[k])) &&
      values.minSize >= minimumSpawnPercent &&
      values.maxSize <= 120 &&
      values.minSize <= values.maxSize &&
      timingKeys.every(
        (k, i) =>
          values[k] >= 0.05 &&
          values[k] <= 6 &&
          (!i || values[k] - values[timingKeys[i - 1]] >= 0.04999),
      )
    )
      return values;
  } catch {}
  return { ...defaults };
}
let tuning = readTuning();
function injuredCutoff() {
  return tuning.nudge + (tuning.light - tuning.nudge) * 0.625;
}
window.addEventListener("storage", (e) => {
  if (e.key === tuningKey || e.key === null) {
    tuning = readTuning();
    if (pageMode === "tuning") refreshControls();
  }
});
const controls = [];
function refreshControls() {
  for (const { input, output, key, size } of controls) {
    input.value = tuning[key];
    output.textContent = size
      ? tuning[key] + "%"
      : tuning[key].toFixed(2) + " s";
    input.setAttribute("aria-valuetext", output.textContent);
  }
}
function initWorkbench() {
  document.title = "Tuning workbench · Bug Lab";
  document.body.className = "workbench";
  document.getElementById("desktop").hidden = true;
  const main = document.createElement("main");
  main.innerHTML = `<header><a href="?">← Magic plate</a><h1>Tuning workbench</h1></header>
  <section><h2>Spawn size</h2><p>Set the smallest and largest spider as a percentage of its designed size.</p><div id="sizes"></div></section>
  <section><h2>Press timeline</h2><p>Drag a marker to set when a held press reaches each stage. Release before Nudge to select.</p><div id="times"></div></section>
  <section><h2>Preview</h2><p>Try a fresh spider with these settings. Click the test plate to spawn more.</p><button id="trialRun">Preview spider</button> <button id="restore">Restore defaults</button><span id="saved" role="status"></span><div id="trialHost"></div></section>`;
  document.body.append(main);
  function save() {
    try {
      localStorage.setItem(tuningKey, JSON.stringify(tuning));
      main.querySelector("#saved").textContent = "Saved in this browser.";
    } catch {
      main.querySelector("#saved").textContent = "Browser storage unavailable.";
    }
    refreshControls();
  }
  function rail(id, keys, labels, min, max, step, size) {
    const group = main.querySelector(id),
      rail = document.createElement("div"),
      legend = document.createElement("div");
    rail.className = "tune-rail";
    legend.className = "tune-legend";
    group.append(rail, legend);
    keys.forEach((key, i) => {
      const input = document.createElement("input"),
        output = document.createElement("output"),
        label = document.createElement("label");
      input.type = "range";
      input.id = "tune-" + key;
      input.min = min;
      input.max = max;
      input.step = step;
      input.setAttribute("aria-label", labels[i]);
      label.htmlFor = input.id;
      label.append(labels[i], output);
      rail.append(input);
      legend.append(label);
      controls.push({ input, output, key, size });
      input.oninput = () => {
        const gap = size ? 0 : step;
        const low = i ? tuning[keys[i - 1]] + gap : min,
          high = i + 1 < keys.length ? tuning[keys[i + 1]] - gap : max;
        tuning[key] = Number(
          Math.max(low, Math.min(high, +input.value)).toFixed(2),
        );
        save();
      };
    });
  }
  rail(
    "#sizes",
    ["minSize", "maxSize"],
    ["Smallest", "Largest"],
    minimumSpawnPercent,
    120,
    1,
    true,
  );
  rail(
    "#times",
    timingKeys,
    ["Nudge", "Light damage", "Serious damage", "Death"],
    0.05,
    6,
    0.05,
    false,
  );
  main.querySelector("#restore").onclick = () => {
    tuning = { ...defaults };
    save();
  };
  main.querySelector("#trialRun").onclick = () => {
    const frame = document.createElement("iframe");
    frame.title = "Interactive spider test plate";
    frame.src = "?preview";
    main.querySelector("#trialHost").replaceChildren(frame);
  };
  refreshControls();
}
