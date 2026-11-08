/* Generator ikon za PWA — brez odvisnosti.
   Zaženi z: npm run icons
   Nariše belo črko B (Rajdhani Light) na vijoličen preliv in zapiše PNG-je v icons/.
   Neobvezen argument: druga izhodna mapa (npr. za predogled). */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------- minimalni PNG zapisovalnik ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- risanje ---------- */
/* Bitneverse: črka B (Chakra Petch Light) bela na prelivu „Ultravijolična“,
   z rahlo senco. Koordinate scene so 0–100 (kot v icon-b.html). */

const STOPS = [
  { t: 0.0, c: [0x2e, 0x10, 0x65] },
  { t: 0.5, c: [0x6d, 0x28, 0xd9] },
  { t: 1.0, c: [0xc0, 0x26, 0xd3] },
];

function gradient(t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].t) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const k = (t - a.t) / (b.t - a.t);
      return [0, 1, 2].map((j) => a.c[j] + (b.c[j] - a.c[j]) * k);
    }
  }
  return STOPS[STOPS.length - 1].c;
}

function inRoundRect(x, y, size, r) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const dx = Math.max(r - x, x - (size - r), 0);
  const dy = Math.max(r - y, y - (size - r), 0);
  return dx * dx + dy * dy <= r * r;
}

// Obris črke „B“ iz Rajdhani-Light.ttf (enote fonta, 1000/em, y navzgor; krivulje zglajene v daljice).
const B_ADV = 544;
const B_CONTOURS = [
  [[129, 28], [335, 28], [347, 28], [359, 30], [369, 32], [379, 35], [389, 39], [397, 43], [405, 49], [412, 56], [418, 63], [424, 71], [428, 79], [432, 89], [435, 99], [437, 110], [439, 122], [439, 134], [439, 205], [437, 230], [432, 251], [423, 270], [411, 285], [394, 296], [375, 304], [352, 309], [325, 311], [129, 311], [127, 311], [125, 311], [124, 310], [122, 309], [121, 308], [121, 307], [120, 305], [120, 303], [120, 36], [120, 34], [121, 33], [121, 31], [122, 30], [124, 29], [125, 29], [127, 28]],
  [[129, 339], [325, 339], [337, 339], [349, 341], [360, 343], [370, 346], [380, 350], [389, 354], [397, 360], [405, 367], [411, 374], [417, 382], [422, 390], [426, 400], [429, 410], [431, 421], [433, 433], [433, 445], [433, 509], [433, 521], [431, 533], [429, 544], [426, 554], [422, 564], [418, 572], [412, 580], [406, 588], [399, 594], [391, 600], [383, 604], [373, 608], [363, 611], [353, 613], [341, 615], [329, 615], [129, 615], [127, 615], [125, 615], [124, 614], [122, 613], [121, 612], [121, 611], [120, 609], [120, 607], [120, 347], [120, 345], [121, 344], [121, 342], [122, 341], [124, 340], [125, 340], [127, 339]],
  [[90, 9], [90, 634], [90, 636], [91, 638], [91, 639], [92, 641], [93, 642], [95, 642], [96, 643], [98, 643], [329, 643], [344, 642], [358, 641], [371, 638], [384, 634], [396, 629], [407, 623], [417, 616], [427, 608], [435, 598], [442, 588], [449, 577], [454, 565], [458, 553], [461, 539], [462, 525], [463, 510], [463, 444], [462, 422], [458, 402], [451, 384], [441, 368], [429, 354], [414, 342], [396, 333], [375, 325], [384, 324], [393, 322], [401, 319], [409, 315], [417, 310], [425, 305], [433, 298], [440, 290], [447, 281], [453, 272], [458, 263], [462, 253], [465, 242], [467, 230], [469, 218], [469, 206], [469, 133], [468, 118], [467, 104], [464, 90], [460, 78], [455, 66], [448, 55], [441, 45], [433, 36], [423, 27], [413, 20], [402, 14], [390, 9], [377, 5], [364, 2], [350, 1], [335, 0], [98, 0], [96, 0], [95, 1], [93, 1], [92, 2], [91, 4], [91, 5], [90, 7]],
];
// Tako kot SVG <text x=50 y=51 text-anchor=middle dominant-baseline=central font-size=72.6>
const B_SIZE = 64.8 * 1.12;
const B_CENTRAL = (930 - 346) / 2; // sredina med ascender in descender
const B_SEGS = [];
for (const c of B_CONTOURS) {
  const pts = c.map(([fx, fy]) => [50 + ((fx - B_ADV / 2) * B_SIZE) / 1000, 51 + ((B_CENTRAL - fy) * B_SIZE) / 1000]);
  for (let i = 0; i < pts.length; i++) B_SEGS.push([pts[i], pts[(i + 1) % pts.length]]);
}

function inB(x, y) {
  let inside = false;
  for (const [[x1, y1], [x2, y2]] of B_SEGS) {
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function distB(x, y) {
  let best = Infinity;
  for (const [[x1, y1], [x2, y2]] of B_SEGS) {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - x1 - t * dx, y - y1 - t * dy));
  }
  return inB(x, y) ? -best : best;
}

// senca: feDropShadow dy=1.6, stdDeviation=2, #1e1b4b, 45 % (približek z razdaljo)
const SHADOW = [0x1e, 0x1b, 0x4b];
function erfc(x) {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  const r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
function shadowAlpha(x, y) {
  const d = distB(x, y - 1.6);
  if (d > 8) return 0;
  return 0.45 * 0.5 * erfc(d / (2 * Math.SQRT2));
}

function render(size, { maskable = false } = {}) {
  const SS = 4; // nadvzorčenje za mehke robove
  const radius = maskable ? 0 : size * 0.29;
  const scale = maskable ? 0.84 : 1; // maskable: črka v varnem krogu
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      // senca je mehka → dovolj en vzorec na piksel
      const cx = (((x + 0.5) / size) * 100 - 50) / scale + 50;
      const cy = (((y + 0.5) / size) * 100 - 50) / scale + 50;
      const sh = shadowAlpha(cx, cy);

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (!inRoundRect(px, py, size, radius)) continue;
          const ux = (px / size) * 100;
          const uy = (py / size) * 100;
          const gx = (ux - 50) / scale + 50;
          const gy = (uy - 50) / scale + 50;

          let col;
          if (inB(gx, gy)) {
            col = [255, 255, 255];
          } else {
            const bg = gradient((ux + uy) / 200);
            col = bg.map((v, j) => v + (SHADOW[j] - v) * sh);
          }
          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }

      const n = SS * SS;
      const i = (y * size + x) * 4;
      if (a > 0) {
        const cov = a / (n * 255);
        out[i] = Math.round(r / (a / 255));
        out[i + 1] = Math.round(g / (a / 255));
        out[i + 2] = Math.round(b / (a / 255));
        out[i + 3] = Math.round(cov * 255);
      }
    }
  }
  return encodePNG(size, out);
}

/* ---------- zapis ---------- */

const outArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const dir = outArg ? path.resolve(outArg) : path.join(__dirname, "..", "icons");
fs.mkdirSync(dir, { recursive: true });

const files = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-192.png", 192, { maskable: true }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon-180.png", 180, { maskable: true }],
  ["favicon-32.png", 32, {}],
];

for (const [name, size, opts] of files) {
  const png = render(size, opts);
  fs.writeFileSync(path.join(dir, name), png);
  console.log("  " + name + "  " + size + "x" + size + "  " + (png.length / 1024).toFixed(1) + " kB");
}
console.log("\nIkone zapisane v " + dir);
