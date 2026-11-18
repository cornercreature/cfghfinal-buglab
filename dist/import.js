// Imported clips stay in this browser. Rasterize each composed GIF frame into
// a compact sheet so the shared playhead can seek without native GIF playback.
async function decodeClip(file, name) {
  const gif = new GifReader(new Uint8Array(await file.arrayBuffer()));
  const frames = gif.numFrames(),
    pixels = gif.width * gif.height;
  if (
    !frames ||
    pixels > 12000000 ||
    frames > 320 ||
    frames * pixels > 180000000
  )
    throw new Error("Choose a smaller GIF for the workbench.");
  const rescale = Math.min(1, 400 / Math.max(gif.width, gif.height));
  const width = Math.max(1, Math.round(gif.width * rescale));
  const height = Math.max(1, Math.round(gif.height * rescale));
  const cols = Math.ceil(Math.sqrt(frames));
  const sheet = document.createElement("canvas");
  sheet.width = cols * width;
  sheet.height = Math.ceil(frames / cols) * height;
  const frame = document.createElement("canvas");
  frame.width = gif.width;
  frame.height = gif.height;
  const f = frame.getContext("2d"),
    out = sheet.getContext("2d");
  let rgba = new Uint8ClampedArray(pixels * 4);
  const durations = [];
  for (let i = 0; i < frames; i++) {
    const info = gif.frameInfo(i);
    const previous = info.disposal === 3 ? rgba.slice() : null;
    gif.decodeAndBlitFrameRGBA(i, rgba);
    f.putImageData(new ImageData(rgba, gif.width, gif.height), 0, 0);
    out.drawImage(
      frame,
      (i % cols) * width,
      Math.floor(i / cols) * height,
      width,
      height,
    );
    durations.push(info.delay ? info.delay * 10 : 100);
    if (previous) rgba = previous;
    if (info.disposal === 2)
      for (let y = info.y; y < info.y + info.height; y++) {
        const start = 4 * (y * gif.width + info.x);
        rgba.fill(0, start, start + info.width * 4);
      }
    if (i % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const blob = await new Promise((resolve) => sheet.toBlob(resolve));
  if (!blob) throw new Error("Could not read the GIF frames.");
  return {
    name,
    blob,
    label: file.name,
    meta: { width, height, cols, durations },
  };
}
async function clipStore(mode, operation) {
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open("spider-sprite-clips", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("clips", { keyPath: "name" });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("clips", mode),
        request = operation(transaction.objectStore("clips"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
async function applyImported(item) {
  const url = URL.createObjectURL(item.blob),
    img = new Image();
  try {
    img.src = url;
    await img.decode();
    imageBlobs.set(img, item.blob);
  } finally {
    URL.revokeObjectURL(url);
  }
  imgs[item.name] = img;
  clips[item.name] = item.meta;
  data.timers[item.name].first = Math.min(
    data.timers[item.name].first,
    item.meta.durations.length - 1,
  );
}
