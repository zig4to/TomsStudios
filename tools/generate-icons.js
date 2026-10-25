/* Generator ikon za PWA — brez odvisnosti.
   Zaženi z: npm run icons
   Nariše kapsulo s kvadratkom in krogom na barvni preliv in zapiše PNG-je v icons/.
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

const STOPS = [
  { t: 0.0, c: [0xa8, 0x55, 0xf7] }, // vijolična
  { t: 1.0, c: [0x3b, 0x82, 0xf6] }, // modra
];

function gradient(t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].t) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const k = (t - a.t) / (b.t - a.t);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * k,
        a.c[1] + (b.c[1] - a.c[1]) * k,
        a.c[2] + (b.c[2] - a.c[2]) * k,
      ];
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

function inRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x > w || y > h) return false;
  const dx = Math.max(r - x, x - (w - r), 0);
  const dy = Math.max(r - y, y - (h - r), 0);
  return dx * dx + dy * dy <= r * r;
}

// Obroba (črta znotraj oblike), da razmiki med oblikami ostanejo.
const STROKE = 1.2;
function inOutline(x, y, w, h, r) {
  const ri = Math.max(0, Math.min(r - STROKE / 2, (w - 2 * STROKE) / 2, (h - 2 * STROKE) / 2));
  return inRect(x, y, w, h, r) && !inRect(x - STROKE, y - STROKE, w - 2 * STROKE, h - 2 * STROKE, ri);
}

// Kapsula v koordinatah 24 x 24: visok stolpec levo, desno kvadratek in poln krog.
// Ista oblika kot .brand-mark v index.html.
function inGlyph(x, y) {
  const capsule = inOutline(x - 3, y - 3, 8, 18, 4);
  const square = inOutline(x - 13, y - 3, 8, 8, 1.4);
  const dot = (x - 17) ** 2 + (y - 17) ** 2 <= 16;
  return capsule || square || dot;
}

function render(size, { maskable = false } = {}) {
  const SS = 4; // nadvzorčenje za mehke robove
  const radius = maskable ? 0 : size * 0.22;
  const glyph = maskable ? 0.55 : 0.72; // delež stranice, ki ga zavzame viewBox 24
  const out = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (!inRoundRect(px, py, size, radius)) continue;

          const gx = ((px - size / 2) / (size * glyph)) * 24 + 12;
          const gy = ((py - size / 2) / (size * glyph)) * 24 + 12;

          let col;
          if (inGlyph(gx, gy)) {
            col = [255, 255, 255];
          } else {
            col = gradient((px / size) * 0.62 + (py / size) * 0.38);
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
