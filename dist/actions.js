"use strict";

// Positions are offsets from the editable assembly. Key times are thousandths
// of the action duration so changing its length also retimes every track.
const restPose = { x: 0, y: 0, angle: 0, size: 100, opacity: 100 };
const poseLimits = {
  x: [-1000, 1000],
  y: [-1000, 1000],
  angle: [-360, 360],
  size: [5, 400],
};
const editor = { action: "nudge", target: "whole", at: 0, playing: false };
let walkEvents = [];

function readActions(value) {
  const actions = {};
  if (value === undefined) return actions;
  assertSprite(value && typeof value === "object" && !Array.isArray(value));
  for (const [action, tracks] of Object.entries(value)) {
    assertSprite(
      Object.hasOwn(eyeNames, action) &&
        action !== "default" &&
        tracks &&
        typeof tracks === "object" &&
        !Array.isArray(tracks),
    );
    actions[action] = {};
    for (const [target, keys] of Object.entries(tracks)) {
      assertSprite(
        (target === "whole" || parts.includes(target)) &&
          Array.isArray(keys) &&
          keys.length <= 1001,
      );
      let previous = -1;
      actions[action][target] = keys.map((key) => {
        assertSprite(
          key &&
            Number.isInteger(key.at) &&
            key.at > previous &&
            key.at <= 1000,
        );
        previous = key.at;
        const result = { at: key.at };
        for (const [prop, [min, max]] of Object.entries(poseLimits)) {
          assertSprite(
            Number.isFinite(key[prop]) && key[prop] >= min && key[prop] <= max,
          );
          result[prop] = key[prop];
        }
        if (action === "dead") {
          const opacity = key.opacity === undefined ? 100 : key.opacity;
          assertSprite(Number.isFinite(opacity) && opacity >= 0 && opacity <= 100);
          result.opacity = opacity;
        }
        return result;
      });
    }
  }
  return actions;
}

function poseAt(action, target, at) {
  const keys = data.actions?.[action]?.[target];
  if (!keys?.length) return restPose;
  const i = keys.findIndex((k) => k.at >= at);
  const next = i < 0 ? { at: 1000, ...restPose } : keys[i];
  if (next.at === at) return { ...restPose, ...next };
  const prev =
    i === 0 ? { at: 0, ...restPose } : keys[i < 0 ? keys.length - 1 : i - 1];
  const blend = (at - prev.at) / (next.at - prev.at);
  const pose = {};
  for (const k of Object.keys(restPose)) {
    const start = prev[k] ?? restPose[k];
    pose[k] = start + ((next[k] ?? restPose[k]) - start) * blend;
  }
  return pose;
}
function liveAction() {
  if (tab === "actions") return editor;
  if (expr === "default") return null;
  return {
    action: expr,
    at: clamp((exprTime / data.holds[expr]) * 1000, 0, 1000),
  };
}
function walkActionAt(time) {
  const event = walkEvents.findLast((e) => e.time <= time);
  if (!event || event.action === "default") return null;
  const age = time - event.time,
    duration = data.holds[event.action];
  return age < duration
    ? { action: event.action, at: (age / duration) * 1000 }
    : null;
}
function poseAround(matrix, pose, px, py) {
  matrix
    .translateSelf(px + pose.x, py + pose.y)
    .rotateSelf(pose.angle)
    .scaleSelf(pose.size / 100)
    .translateSelf(-px, -py);
}
function actionParent(id, sample) {
  const m = new DOMMatrix();
  if (sample && data.actions?.[sample.action]) {
    poseAround(
      m,
      poseAt(sample.action, "whole", sample.at),
      ...data.points.body,
    );
    if (id === "eyes")
      poseAround(
        m,
        poseAt(sample.action, "head", sample.at),
        ...data.points.head,
      );
  }
  return m;
}

function actionPanel() {
  const options = (entries, selected) =>
    Object.entries(entries)
      .map(
        ([id, n]) =>
          '<option value="' +
          id +
          '" ' +
          (id === selected ? "selected" : "") +
          ">" +
          n +
          "</option>",
      )
      .join("");
  const { default: unused, ...events } = eyeNames;
  return (
    '<div class="block"><h2>Action animation</h2><label>Trigger<select id="actionId">' +
    options(events, editor.action) +
    "</select></label>" +
    '<div class="row"><label for="actionDuration">Duration (s)</label>' +
    num("actionDuration", data.holds[editor.action], 0.1, 10, 0.1) +
    "</div>" +
    '<div class="row"><button id="actionPlay"></button><output id="actionClock"></output></div>' +
    '<input class="action-scrub" id="actionTime" type="range" min="0" max="1000" step="1" aria-label="Action playhead">' +
    '<div id="keyMarks" class="key-marks" aria-hidden="true"></div>' +
    '<div class="row"><label for="keyTime">Time (s)</label>' +
    num("keyTime", 0, 0, data.holds[editor.action], 0.001) +
    "</div>" +
    '</div><div class="block"><h2>Pose keyframes</h2><label>Animate<select id="actionPart">' +
    options({ whole: "Whole spider", ...names }, editor.target) +
    "</select></label>" +
    '<div class="fieldpair"><label>X offset (px)' +
    num("poseX", 0, -1000, 1000, 0.1) +
    "</label><label>Y offset (px)" +
    num("poseY", 0, -1000, 1000, 0.1) +
    "</label></div>" +
    '<div class="fieldpair"><label>Rotation (°)' +
    num("poseAngle", 0, -360, 360, 0.1) +
    "</label><label>Scale (%)" +
    num("poseSize", 100, 5, 400, 0.1) +
    "</label></div>" +
    (editor.action === "dead"
      ? '<div class="row"><label for="poseOpacity">Opacity (%)</label>' +
        num("poseOpacity", 100, 0, 100, 0.1) + "</div>"
      : "") +
    '<p class="note">Scrub to a time, then drag on the spider or edit a value to set a keyframe.</p>' +
    '<div class="row"><button id="setKey">Set keyframe</button><button id="deleteKey">Delete key</button></div>' +
    '<div id="actionKeys" class="action-keys" aria-label="Keyframes for selected part"></div></div>'
  );
}
const poseInputs = {
  x: "poseX",
  y: "poseY",
  angle: "poseAngle",
  size: "poseSize",
  opacity: "poseOpacity",
};
function updateActionFields() {
  const frame = poseAt(editor.action, editor.target, editor.at);
  for (const [key, id] of Object.entries(poseInputs)) {
    if ($(id) && (document.activeElement !== $(id) || editor.playing))
      $(id).value = +frame[key].toFixed(2);
  }
  $("actionPlay").textContent = editor.playing ? "Pause action" : "Play action";
  $("actionTime").value = editor.at;
  const duration = data.holds[editor.action];
  $("keyTime").max = duration;
  if (document.activeElement !== $("keyTime") || editor.playing)
    $("keyTime").value = +((editor.at * duration) / 1000).toFixed(3);
  $("actionClock").value =
    ((editor.at * duration) / 1000).toFixed(2) +
    " / " +
    duration.toFixed(2) +
    " s";
  const keyTime = Math.round(editor.at);
  $("deleteKey").disabled = !data.actions?.[editor.action]?.[
    editor.target
  ]?.some((k) => k.at === keyTime);
  $("actionKeys")
    .querySelectorAll("button")
    .forEach((el) =>
      el.setAttribute("aria-pressed", Number(el.dataset.at) === keyTime),
    );
}
function refreshKeys() {
  const list = $("actionKeys");
  list.replaceChildren();
  const marks = $("keyMarks");
  marks.replaceChildren();
  for (const key of data.actions?.[editor.action]?.[editor.target] || []) {
    const button = document.createElement("button");
    button.textContent =
      "◆ " + ((key.at * data.holds[editor.action]) / 1000).toFixed(2) + " s";
    button.dataset.at = key.at;
    button.onclick = () => seekAction(key.at);
    list.append(button);
    const mark = document.createElement("i");
    mark.style.left = key.at / 10 + "%";
    marks.append(mark);
  }
}
function seekAction(at) {
  editor.playing = false;
  editor.at = Math.round(clamp(at, 0, 1000));
  updateActionFields();
  draw();
}
function setActionKey(changes) {
  editor.playing = false;
  editor.at = Math.round(editor.at);
  data.actions ??= {};
  const tracks = (data.actions[editor.action] ??= {});
  const keys = (tracks[editor.target] ??= []);
  const key = {
    ...poseAt(editor.action, editor.target, editor.at),
    ...changes,
    at: editor.at,
  };
  if (editor.action !== "dead") delete key.opacity;
  const i = keys.findIndex((k) => k.at === editor.at);
  if (i >= 0) keys[i] = key;
  else {
    keys.push(key);
    keys.sort((a, b) => a.at - b.at);
  }
  refreshKeys();
  updateActionFields();
  draw();
}
function bindActionPanel() {
  on("keyTime", "focus", () => {
    editor.playing = false;
    updateActionFields();
  });
  on("keyTime", "change", (e) => {
    const seconds = e.target.valueAsNumber;
    if (Number.isFinite(seconds))
      seekAction((seconds / data.holds[editor.action]) * 1000);
    e.target.value = +((editor.at * data.holds[editor.action]) / 1000).toFixed(
      3,
    );
  });
  on("actionTime", "input", (e) => seekAction(+e.target.value));
  on("actionId", "change", (e) => {
    editor.action = e.target.value;
    editor.at = 0;
    editor.playing = false;
    render();
    draw();
  });
  on("actionPart", "change", (e) => {
    editor.playing = false;
    editor.target = e.target.value;
    render();
    draw();
  });
  numberField("actionDuration", (v) => {
    data.holds[editor.action] = v;
    refreshKeys();
    updateActionFields();
  });
  for (const [key, id] of Object.entries(poseInputs)) {
    on(id, "focus", () => {
      editor.playing = false;
      updateActionFields();
    });
    numberField(id, (v) => setActionKey({ [key]: v }));
  }
  on("setKey", "click", () => {
    setActionKey({});
    save();
  });
  on("deleteKey", "click", () => {
    const tracks = data.actions?.[editor.action];
    if (!tracks?.[editor.target]) return;
    editor.playing = false;
    tracks[editor.target] = tracks[editor.target].filter(
      (k) => k.at !== Math.round(editor.at),
    );
    refreshKeys();
    updateActionFields();
    save();
    draw();
  });
  on("actionPlay", "click", () => {
    if (!editor.playing && editor.at >= 1000) editor.at = 0;
    editor.playing = !editor.playing;
    updateActionFields();
    draw();
  });
  refreshKeys();
  updateActionFields();
}
