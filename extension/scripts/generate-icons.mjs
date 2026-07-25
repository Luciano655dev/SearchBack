// Generates the Searchback icons (a loop arrow on an indigo rounded square)
// as PNGs with zero dependencies, using a minimal PNG encoder on top of
// node's zlib. Run via `npm run icons`; output goes to public/icons/.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Signed-distance drawing at 4x supersampling for smooth edges.
function drawIcon(size) {
  const ss = 4;
  const S = size * ss;
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [23, 23, 23]; // #171717 — neutral, matches the minimal UI
  const fg = [255, 255, 255];
  // Chrome Web Store guidance asks for a 96px mark centered in the 128px
  // canvas. The same 75% proportion keeps every toolbar size consistent.
  const markSize = S * 0.75;
  const markHalf = markSize / 2;
  const radius = markSize * 0.22;
  const cx = S / 2;
  const cy = S / 2;
  const loopR = markSize * 0.27;
  const strokeW = markSize * 0.09;
  // Loop is an arc with a gap at the top-right; an arrowhead sits at the
  // gap's leading edge, reading as "comes back around".
  const gapStart = -70 * (Math.PI / 180);
  const gapEnd = -10 * (Math.PI / 180);
  const headAngle = gapEnd;
  const headSize = markSize * 0.11;

  const hx = cx + loopR * Math.cos(headAngle);
  const hy = cy + loopR * Math.sin(headAngle);
  const tangent = headAngle + Math.PI / 2; // arc direction (counter-clockwise gap edge)
  const tip = [hx + headSize * Math.cos(tangent - Math.PI), hy + headSize * Math.sin(tangent - Math.PI)];
  const b1 = [hx + headSize * 0.9 * Math.cos(headAngle), hy + headSize * 0.9 * Math.sin(headAngle)];
  const b2 = [hx - headSize * 0.9 * Math.cos(headAngle), hy - headSize * 0.9 * Math.sin(headAngle)];

  function inRoundedSquare(x, y) {
    const dx = Math.max(Math.abs(x - cx) - (markHalf - radius), 0);
    const dy = Math.max(Math.abs(y - cy) - (markHalf - radius), 0);
    return dx * dx + dy * dy <= radius * radius;
  }
  function inLoop(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dist - loopR) > strokeW / 2) return false;
    let angle = Math.atan2(dy, dx);
    // Exclude the gap.
    const inGap = angle > gapStart && angle < gapEnd;
    return !inGap;
  }
  function inTriangle(x, y) {
    const [ax, ay] = tip;
    const [bx, by] = b1;
    const [ccx, ccy] = b2;
    const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
    const d2 = (x - ccx) * (by - ccy) - (bx - ccx) * (y - ccy);
    const d3 = (x - ax) * (ccy - ay) - (ccx - ax) * (y - ay);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgCov = 0;
      let fgCov = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = px * ss + sx + 0.5;
          const y = py * ss + sy + 0.5;
          if (!inRoundedSquare(x, y)) continue;
          bgCov++;
          if (inLoop(x, y) || inTriangle(x, y)) fgCov++;
        }
      }
      const total = ss * ss;
      const alpha = bgCov / total;
      const fgFrac = bgCov > 0 ? fgCov / bgCov : 0;
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(bg[0] * (1 - fgFrac) + fg[0] * fgFrac);
      rgba[i + 1] = Math.round(bg[1] * (1 - fgFrac) + fg[1] * fgFrac);
      rgba[i + 2] = Math.round(bg[2] * (1 - fgFrac) + fg[2] * fgFrac);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon${size}.png`), drawIcon(size));
}
console.log("Icons written to public/icons/");
